import { z } from "zod";
import { randomUUID } from "crypto";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { corsair } from "@/server/corsair";
import {
  corsairEntities,
  corsairAccounts,
  corsairIntegrations,
  emailPriorities,
  userSettings,
  user,
} from "@/server/db/schema";
import { eq, and, desc, or, like, inArray, count, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { syncEmbeddings } from "@/server/api/tasks/embeddings";
import {
  syncPriorities,
  isSyncingPriorities,
} from "@/server/api/tasks/prioritizer";

const headerSafeString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => !/[\r\n]/.test(value), {
      message: "Email header values cannot contain line breaks.",
    });

const requiredHeaderSafeString = (max: number) =>
  headerSafeString(max).refine((value) => value.length > 0, {
    message: "Required email header cannot be empty.",
  });

const extractHeaderEmail = (value: string) => {
  const trimmed = value.trim();
  const match = trimmed.match(/<([^<>]+)>$/);
  return (match?.[1] ?? trimmed).trim();
};

const emailListSchema = headerSafeString(2000).refine(
  (value) =>
    value
      .split(",")
      .map((part) => extractHeaderEmail(part))
      .filter(Boolean)
      .every((email) => z.string().email().safeParse(email).success),
  { message: "Expected a comma-separated list of valid email addresses." },
);

// Helper to construct a base64url encoded MIME email
export function buildRawEmail(
  to: string,
  subject: string,
  body: string,
  cc?: string,
  bcc?: string,
  parentMessageId?: string,
) {
  const assertHeaderSafe = (name: string, value: string | undefined) => {
    if (value && /[\r\n]/.test(value)) {
      throw new Error(`${name} header cannot contain line breaks.`);
    }
  };

  const encodeHeaderValue = (value: string) => {
    assertHeaderSafe("Encoded", value);
    if (/[^\x00-\x7F]/.test(value)) {
      return `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`;
    }
    return value;
  };

  const encodeHeaderEmailList = (value: string) => {
    assertHeaderSafe("Address list", value);
    if (!/[^\x00-\x7F]/.test(value)) return value;
    const parts = value.split(",");
    return parts
      .map((part) => {
        const trimmed = part.trim();
        const match = trimmed.match(/^(.*?)\s*<(.*?)>$/);
        if (match) {
          const name = match[1]?.trim() ?? "";
          const email = match[2]?.trim() ?? "";
          if (/[^\x00-\x7F]/.test(name)) {
            return `=?UTF-8?B?${Buffer.from(name).toString("base64")}?= <${email}>`;
          }
        }
        return trimmed;
      })
      .join(", ");
  };

  const emailLines: string[] = [];
  if (to) emailLines.push(`To: ${encodeHeaderEmailList(to)}`);
  if (cc) emailLines.push(`Cc: ${encodeHeaderEmailList(cc)}`);
  if (bcc) emailLines.push(`Bcc: ${encodeHeaderEmailList(bcc)}`);
  if (parentMessageId) {
    assertHeaderSafe("Message-ID", parentMessageId);
    emailLines.push(`In-Reply-To: ${parentMessageId}`);
    emailLines.push(`References: ${parentMessageId}`);
  }
  emailLines.push(`Subject: ${encodeHeaderValue(subject)}`);
  emailLines.push(`Content-Type: text/html; charset=utf-8`);
  emailLines.push(`MIME-Version: 1.0`);
  emailLines.push(``);
  emailLines.push(body);

  const email = emailLines.join("\r\n");

  return Buffer.from(email)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export const gmailRouter = createTRPCRouter({
  listThreads: protectedProcedure
    .input(
      z.object({
        refresh: z.boolean().optional().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Query all connected Gmail accounts for this user
      const accounts = await ctx.db
        .select({
          id: corsairAccounts.id,
          tenantId: corsairAccounts.tenantId,
          emailAddress: corsairAccounts.emailAddress,
        })
        .from(corsairAccounts)
        .innerJoin(
          corsairIntegrations,
          eq(corsairAccounts.integrationId, corsairIntegrations.id),
        )
        .where(
          and(
            or(
              eq(corsairAccounts.tenantId, userId),
              like(corsairAccounts.tenantId, `${userId}\\_%`),
            ),
            eq(corsairIntegrations.name, "gmail"),
          ),
        );

      if (input.refresh) {
        for (const account of accounts) {
          const tenant = corsair.withTenant(account.tenantId);
          try {
            // Trigger live resync which updates the corsair_entities table automatically
            const res = await tenant.gmail.api.threads.list({});
            const threadsList = res.threads ?? [];

            // Pre-fetch details for the top 20 threads to populate subject and sender
            const top20 = threadsList.slice(0, 20);
            await Promise.all(
              top20.map(async (t) => {
                if (t.id) {
                  try {
                    const fullThread = await tenant.gmail.api.threads.get({
                      id: t.id,
                    });
                    // Cache full thread data in corsairEntities using upsert
                    await ctx.db
                      .insert(corsairEntities)
                      .values({
                        id: randomUUID(),
                        accountId: account.id,
                        entityId: t.id,
                        entityType: "threads",
                        version: "1",
                        data: fullThread,
                        updatedAt: new Date(),
                      })
                      .onConflictDoUpdate({
                        target: [
                          corsairEntities.accountId,
                          corsairEntities.entityId,
                          corsairEntities.entityType,
                        ],
                        set: {
                          data: fullThread,
                          updatedAt: new Date(),
                        },
                      });
                  } catch (e) {
                    console.error(
                      `[Pre-fetch] Failed to pre-fetch thread ${t.id}:`,
                      e,
                    );
                  }
                }
              }),
            );
          } catch (err: any) {
            console.error(
              `Failed to resync Gmail threads for ${account.emailAddress}:`,
              err,
            );
          }
        }
      }

      // Trigger background tasks asynchronously
      void syncEmbeddings(userId).catch((err) => {
        console.error("Background embeddings sync failed for Gmail:", err);
      });
      void syncPriorities(userId).catch((err) => {
        console.error("Background priority sync failed for Gmail:", err);
      });

      // Query cached threads from the local database across all user's accounts
      let threads = await ctx.db
        .select({
          id: corsairEntities.id,
          entityId: corsairEntities.entityId,
          data: sql<any>`
            jsonb_build_object(
              'id', ${corsairEntities.data}->'id',
              'historyId', ${corsairEntities.data}->'historyId',
              'messages', (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', msg->'id',
                    'snippet', msg->'snippet',
                    'labelIds', msg->'labelIds',
                    'internalDate', msg->'internalDate',
                    'payload', jsonb_build_object(
                      'headers', (
                        SELECT jsonb_agg(h)
                        FROM jsonb_to_recordset(msg->'payload'->'headers') AS h(name text, value text)
                        WHERE lower(h.name) IN ('from', 'subject')
                      )
                    )
                  )
                )
                FROM jsonb_array_elements(${corsairEntities.data}->'messages') AS msg
              )
            )
          `,
          updatedAt: corsairEntities.updatedAt,
          priority: emailPriorities.priority,
          priorityReason: emailPriorities.reason,
          accountId: corsairEntities.accountId,
          emailAddress: corsairAccounts.emailAddress,
        })
        .from(corsairEntities)
        .innerJoin(
          corsairAccounts,
          eq(corsairEntities.accountId, corsairAccounts.id),
        )
        .innerJoin(
          corsairIntegrations,
          eq(corsairAccounts.integrationId, corsairIntegrations.id),
        )
        .leftJoin(
          emailPriorities,
          eq(corsairEntities.id, emailPriorities.emailId),
        )
        .where(
          and(
            or(
              eq(corsairAccounts.tenantId, userId),
              like(corsairAccounts.tenantId, `${userId}\\_%`),
            ),
            eq(corsairIntegrations.name, "gmail"),
            eq(corsairEntities.entityType, "threads"),
          ),
        )
        .orderBy(desc(corsairEntities.updatedAt));

      // Auto-sync on first load if account exists but database has no threads for this specific account
      let didSyncAny = false;
      for (const account of accounts) {
        const hasThreads = threads.some((t) => t.accountId === account.id);
        if (!hasThreads && !input.refresh) {
          didSyncAny = true;
          const tenant = corsair.withTenant(account.tenantId);
          try {
            console.log(
              `[Gmail Auto-sync] Populating Gmail threads for account ${account.emailAddress}...`,
            );
            const res = await tenant.gmail.api.threads.list({});
            const threadsList = res.threads ?? [];

            // Pre-fetch details for the top 20 threads
            const top20 = threadsList.slice(0, 20);
            await Promise.all(
              top20.map(async (t) => {
                if (t.id) {
                  try {
                    const fullThread = await tenant.gmail.api.threads.get({
                      id: t.id,
                    });
                    // Cache full thread data in corsairEntities using upsert
                    await ctx.db
                      .insert(corsairEntities)
                      .values({
                        id: randomUUID(),
                        accountId: account.id,
                        entityId: t.id,
                        entityType: "threads",
                        version: "1",
                        data: fullThread,
                        updatedAt: new Date(),
                      })
                      .onConflictDoUpdate({
                        target: [
                          corsairEntities.accountId,
                          corsairEntities.entityId,
                          corsairEntities.entityType,
                        ],
                        set: {
                          data: fullThread,
                          updatedAt: new Date(),
                        },
                      });
                  } catch (e) {
                    console.error(
                      `[Auto-sync Pre-fetch] Failed to pre-fetch thread ${t.id}:`,
                      e,
                    );
                  }
                }
              }),
            );
          } catch (err: any) {
            console.error(
              `[Gmail Auto-sync] Failed to auto-sync Gmail threads for ${account.emailAddress}:`,
              err,
            );
          }
        }
      }

      if (didSyncAny) {
        // Query again to include newly populated threads
        threads = await ctx.db
          .select({
            id: corsairEntities.id,
            entityId: corsairEntities.entityId,
            data: sql<any>`
              jsonb_build_object(
                'id', ${corsairEntities.data}->'id',
                'historyId', ${corsairEntities.data}->'historyId',
                'messages', (
                  SELECT jsonb_agg(
                    jsonb_build_object(
                      'id', msg->'id',
                      'snippet', msg->'snippet',
                      'labelIds', msg->'labelIds',
                      'internalDate', msg->'internalDate',
                      'payload', jsonb_build_object(
                        'headers', (
                          SELECT jsonb_agg(h)
                          FROM jsonb_to_recordset(msg->'payload'->'headers') AS h(name text, value text)
                          WHERE lower(h.name) IN ('from', 'subject')
                        )
                      )
                    )
                  )
                  FROM jsonb_array_elements(${corsairEntities.data}->'messages') AS msg
                )
              )
            `,
            updatedAt: corsairEntities.updatedAt,
            priority: emailPriorities.priority,
            priorityReason: emailPriorities.reason,
            accountId: corsairEntities.accountId,
            emailAddress: corsairAccounts.emailAddress,
          })
          .from(corsairEntities)
          .innerJoin(
            corsairAccounts,
            eq(corsairEntities.accountId, corsairAccounts.id),
          )
          .innerJoin(
            corsairIntegrations,
            eq(corsairAccounts.integrationId, corsairIntegrations.id),
          )
          .leftJoin(
            emailPriorities,
            eq(corsairEntities.id, emailPriorities.emailId),
          )
          .where(
            and(
              or(
                eq(corsairAccounts.tenantId, userId),
                like(corsairAccounts.tenantId, `${userId}\\_%`),
              ),
              eq(corsairIntegrations.name, "gmail"),
              eq(corsairEntities.entityType, "threads"),
            ),
          )
          .orderBy(desc(corsairEntities.updatedAt));
      }

      // Ensure details are pre-fetched for any threads that lack message details
      const threadsToFetch = threads.filter((t) => {
        const threadData = t.data as any;
        return (
          !threadData ||
          !threadData.messages ||
          threadData.messages.length === 0
        );
      });

      if (threadsToFetch.length > 0) {
        console.log(
          `[Gmail Router] Fetching full details for ${threadsToFetch.length} threads lacking message details...`,
        );
        // Limit to top 20 at a time to prevent rate limiting
        const chunk = threadsToFetch.slice(0, 20);
        await Promise.all(
          chunk.map(async (t) => {
            try {
              const account = accounts.find((a) => a.id === t.accountId);
              const tenantId = account?.tenantId ?? userId;
              const tenant = corsair.withTenant(tenantId);
              const fullThread = await tenant.gmail.api.threads.get({
                id: t.entityId,
              });
              // Cache full thread data in corsairEntities
              await ctx.db
                .update(corsairEntities)
                .set({
                  data: fullThread,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(corsairEntities.entityId, t.entityId),
                    eq(corsairEntities.entityType, "threads"),
                  ),
                );

              // Update in-memory data for immediate return
              t.data = fullThread;
            } catch (e) {
              console.error(
                `[Pre-fetch] Failed to pre-fetch thread details for ${t.entityId}:`,
                e,
              );
            }
          }),
        );
      }

      // Deduplicate threads by id to ensure we never return duplicates to the client (e.g. from multiple left-joined priorities)
      const seenIds = new Set<string>();
      const uniqueThreads = [];
      for (const t of threads) {
        if (!seenIds.has(t.id)) {
          seenIds.add(t.id);
          uniqueThreads.push(t);
        }
      }

      // Sort by the date of the latest message in each thread descending (most recent first)
      const getThreadTimestamp = (t: any) => {
        const threadData = t.data as any;
        const messages = threadData?.messages ?? [];
        if (messages.length > 0) {
          const dates = messages
            .map((m: any) =>
              m.internalDate ? parseInt(m.internalDate, 10) : 0,
            )
            .filter((d: number) => !isNaN(d) && d > 0);
          if (dates.length > 0) {
            return Math.max(...dates);
          }
        }
        return t.updatedAt ? new Date(t.updatedAt).getTime() : 0;
      };

      uniqueThreads.sort(
        (a, b) => getThreadTimestamp(b) - getThreadTimestamp(a),
      );

      return uniqueThreads;
    }),

  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const accounts = await ctx.db
      .select({ id: corsairAccounts.id })
      .from(corsairAccounts)
      .innerJoin(
        corsairIntegrations,
        eq(corsairAccounts.integrationId, corsairIntegrations.id),
      )
      .where(
        and(
          or(
            eq(corsairAccounts.tenantId, userId),
            like(corsairAccounts.tenantId, `${userId}\\_%`),
          ),
          eq(corsairIntegrations.name, "gmail"),
        ),
      );

    if (accounts.length === 0) return 0;
    const accountIds = accounts.map((a) => a.id);

    const result = await ctx.db.execute(sql`
      SELECT COUNT(*) AS count
      FROM corsair_entities
      WHERE entity_type = 'threads'
        AND account_id IN (${sql.join(
          accountIds.map((id) => sql`${id}`),
          sql`, `,
        )})
        AND jsonb_path_exists(data, '$.messages[*].labelIds[*] ? (@ == "UNREAD")')
    `);

    return Number((result[0] as any)?.count ?? 0);
  }),

  syncInbox: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Query all connected Gmail accounts for this user
    const accounts = await ctx.db
      .select({
        id: corsairAccounts.id,
        tenantId: corsairAccounts.tenantId,
        emailAddress: corsairAccounts.emailAddress,
      })
      .from(corsairAccounts)
      .innerJoin(
        corsairIntegrations,
        eq(corsairAccounts.integrationId, corsairIntegrations.id),
      )
      .where(
        and(
          or(
            eq(corsairAccounts.tenantId, userId),
            like(corsairAccounts.tenantId, `${userId}\\_%`),
          ),
          eq(corsairIntegrations.name, "gmail"),
        ),
      );

    console.log(
      `[Gmail Manual Sync] Syncing ${accounts.length} accounts for user ${userId}...`,
    );

    for (const account of accounts) {
      const tenant = corsair.withTenant(account.tenantId);
      try {
        console.log(
          `[Gmail Manual Sync] Syncing account ${account.emailAddress}...`,
        );
        const res = await tenant.gmail.api.threads.list({});
        const threadsList = res.threads ?? [];

        // Pre-fetch details for the top 20 threads to populate subject and sender
        const top20 = threadsList.slice(0, 20);
        await Promise.all(
          top20.map(async (t) => {
            if (t.id) {
              try {
                const fullThread = await tenant.gmail.api.threads.get({
                  id: t.id,
                });
                // Cache full thread data in corsairEntities using upsert
                await ctx.db
                  .insert(corsairEntities)
                  .values({
                    id: randomUUID(),
                    accountId: account.id,
                    entityId: t.id,
                    entityType: "threads",
                    version: "1",
                    data: fullThread,
                    updatedAt: new Date(),
                  })
                  .onConflictDoUpdate({
                    target: [
                      corsairEntities.accountId,
                      corsairEntities.entityId,
                      corsairEntities.entityType,
                    ],
                    set: {
                      data: fullThread,
                      updatedAt: new Date(),
                    },
                  });
              } catch (e) {
                console.error(
                  `[Manual Sync Pre-fetch] Failed to pre-fetch thread ${t.id}:`,
                  e,
                );
              }
            }
          }),
        );
      } catch (err: any) {
        console.error(`Manual sync failed for ${account.emailAddress}:`, err);
      }
    }

    // Trigger background tasks asynchronously
    void syncEmbeddings(userId).catch((err) => {
      console.error("Background embeddings sync failed for Gmail:", err);
    });
    void syncPriorities(userId).catch((err) => {
      console.error("Background priority sync failed for Gmail:", err);
    });

    return { success: true };
  }),

  getConnectionStatus: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const accounts = await ctx.db
      .select({
        id: corsairAccounts.id,
        emailAddress: corsairAccounts.emailAddress,
      })
      .from(corsairAccounts)
      .innerJoin(
        corsairIntegrations,
        eq(corsairAccounts.integrationId, corsairIntegrations.id),
      )
      .where(
        and(
          or(
            eq(corsairAccounts.tenantId, userId),
            like(corsairAccounts.tenantId, `${userId}\\_%`),
          ),
          eq(corsairIntegrations.name, "gmail"),
        ),
      );

    return {
      connected: accounts.length > 0,
      accounts: accounts.map((acc) => ({
        id: acc.id,
        emailAddress: acc.emailAddress ?? "Connected",
      })),
    };
  }),

  disconnect: protectedProcedure
    .input(z.object({ accountId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const [account] = await ctx.db
        .select({ id: corsairAccounts.id })
        .from(corsairAccounts)
        .where(
          and(
            eq(corsairAccounts.id, input.accountId),
            or(
              eq(corsairAccounts.tenantId, userId),
              like(corsairAccounts.tenantId, `${userId}\\_%`),
            ),
          ),
        )
        .limit(1);

      if (account) {
        const accountId = account.id;

        // Delete app-specific email priorities linked to the entities of this account
        const entities = await ctx.db
          .select({ id: corsairEntities.id })
          .from(corsairEntities)
          .where(eq(corsairEntities.accountId, accountId));

        const entityIds = entities.map((e) => e.id);
        if (entityIds.length > 0) {
          await ctx.db
            .delete(emailPriorities)
            .where(inArray(emailPriorities.emailId, entityIds));
        }

        // Delete dependent corsair entities
        await ctx.db
          .delete(corsairEntities)
          .where(eq(corsairEntities.accountId, accountId));

        // Delete the account
        await ctx.db
          .delete(corsairAccounts)
          .where(eq(corsairAccounts.id, accountId));

        return { success: true };
      }
      return { success: false };
    }),

  getThread: protectedProcedure
    .input(
      z.object({
        id: z.string().trim().min(1),
        refresh: z.boolean().optional().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Securely look up the thread entity ensuring it belongs to the current user
      const [threadAccount] = await ctx.db
        .select({
          tenantId: corsairAccounts.tenantId,
          data: corsairEntities.data,
        })
        .from(corsairEntities)
        .innerJoin(
          corsairAccounts,
          eq(corsairEntities.accountId, corsairAccounts.id),
        )
        .innerJoin(
          corsairIntegrations,
          eq(corsairAccounts.integrationId, corsairIntegrations.id),
        )
        .where(
          and(
            eq(corsairEntities.entityId, input.id),
            eq(corsairEntities.entityType, "threads"),
            eq(corsairIntegrations.name, "gmail"),
            or(
              eq(corsairAccounts.tenantId, userId),
              like(corsairAccounts.tenantId, `${userId}\\_%`),
            ),
          ),
        )
        .limit(1);

      if (!threadAccount) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Thread not found or you do not have permission to access it.",
        });
      }

      // If not forced refresh, try to serve from local cached data
      if (!input.refresh && threadAccount.data) {
        const cachedThread = threadAccount.data as any;
        if (cachedThread.messages && cachedThread.messages.length > 0) {
          console.info(
            `[getThread] Serving thread ${input.id} from local database cache.`,
          );
          return cachedThread;
        }
      }

      const tenantId = threadAccount.tenantId;
      const tenant = corsair.withTenant(tenantId);

      try {
        const thread = await tenant.gmail.api.threads.get({ id: input.id });

        // Cache full thread data in database
        await ctx.db
          .update(corsairEntities)
          .set({
            data: thread,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(corsairEntities.entityId, input.id),
              eq(corsairEntities.entityType, "threads"),
            ),
          );

        return thread;
      } catch (err: any) {
        console.error("Failed to fetch Gmail thread:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to fetch thread: ${err.message || err}`,
        });
      }
    }),

  sendEmail: protectedProcedure
    .input(
      z.object({
        to: z.string().email().max(320).trim(),
        subject: requiredHeaderSafeString(1000),
        body: z.string().min(1).max(50000).trim(),
        cc: emailListSchema.optional(),
        bcc: emailListSchema.optional(),
        threadId: z.string().optional(),
        parentMessageId: headerSafeString(998).optional(),
        fromEmail: z.string().email().max(320).trim().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Resolve tenantId based on preferred email or fallback to primary account
      const preferredEmail = input.fromEmail;
      const accounts = await ctx.db
        .select({
          tenantId: corsairAccounts.tenantId,
          emailAddress: corsairAccounts.emailAddress,
        })
        .from(corsairAccounts)
        .innerJoin(
          corsairIntegrations,
          eq(corsairAccounts.integrationId, corsairIntegrations.id),
        )
        .where(
          and(
            or(
              eq(corsairAccounts.tenantId, userId),
              like(corsairAccounts.tenantId, `${userId}\\_%`),
            ),
            eq(corsairIntegrations.name, "gmail"),
          ),
        );

      let tenantId = userId;

      if (input.threadId) {
        // Securely look up the thread entity to verify ownership and resolve the correct tenant ID
        const [threadAccount] = await ctx.db
          .select({ tenantId: corsairAccounts.tenantId })
          .from(corsairEntities)
          .innerJoin(
            corsairAccounts,
            eq(corsairEntities.accountId, corsairAccounts.id),
          )
          .innerJoin(
            corsairIntegrations,
            eq(corsairAccounts.integrationId, corsairIntegrations.id),
          )
          .where(
            and(
              eq(corsairEntities.entityId, input.threadId),
              eq(corsairEntities.entityType, "threads"),
              eq(corsairIntegrations.name, "gmail"),
              or(
                eq(corsairAccounts.tenantId, userId),
                like(corsairAccounts.tenantId, `${userId}\\_%`),
              ),
            ),
          )
          .limit(1);

        if (!threadAccount) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "The specified threadId does not exist or you do not have access to it.",
          });
        }
        tenantId = threadAccount.tenantId;
      } else {
        const fallbackAccount = accounts[0];
        if (fallbackAccount) {
          const matched = preferredEmail
            ? accounts.find(
                (a) =>
                  a.emailAddress?.toLowerCase() ===
                  preferredEmail.toLowerCase(),
              )
            : null;
          tenantId = matched ? matched.tenantId : fallbackAccount.tenantId;
        }
      }

      const tenant = corsair.withTenant(tenantId);

      try {
        const raw = buildRawEmail(
          input.to,
          input.subject,
          input.body,
          input.cc,
          input.bcc,
          input.parentMessageId,
        );
        const res = await tenant.gmail.api.messages.send({
          raw,
          threadId: input.threadId,
        });
        return res;
      } catch (err: any) {
        console.error("Failed to send email via Corsair:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to send email: ${err.message || err}`,
        });
      }
    }),

  createDraft: protectedProcedure
    .input(
      z.object({
        to: z.string().email().max(320).trim().optional(),
        subject: headerSafeString(1000).optional(),
        body: z.string().min(1).max(50000).trim(),
        cc: emailListSchema.optional(),
        bcc: emailListSchema.optional(),
        fromEmail: z.string().email().max(320).trim().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Resolve tenantId
      const preferredEmail = input.fromEmail;
      const accounts = await ctx.db
        .select({
          tenantId: corsairAccounts.tenantId,
          emailAddress: corsairAccounts.emailAddress,
        })
        .from(corsairAccounts)
        .innerJoin(
          corsairIntegrations,
          eq(corsairAccounts.integrationId, corsairIntegrations.id),
        )
        .where(
          and(
            or(
              eq(corsairAccounts.tenantId, userId),
              like(corsairAccounts.tenantId, `${userId}\\_%`),
            ),
            eq(corsairIntegrations.name, "gmail"),
          ),
        );

      let tenantId = userId;
      const fallbackAccount = accounts[0];
      if (fallbackAccount) {
        const matched = preferredEmail
          ? accounts.find(
              (a) =>
                a.emailAddress?.toLowerCase() === preferredEmail.toLowerCase(),
            )
          : null;
        tenantId = matched ? matched.tenantId : fallbackAccount.tenantId;
      }

      const tenant = corsair.withTenant(tenantId);

      try {
        const raw = buildRawEmail(
          input.to ?? "",
          input.subject ?? "",
          input.body,
          input.cc,
          input.bcc,
        );
        const res = await tenant.gmail.api.drafts.create({
          draft: {
            message: { raw },
          },
        });
        return res;
      } catch (err: any) {
        console.error("Failed to create draft via Corsair:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to create draft: ${err.message || err}`,
        });
      }
    }),

  archiveThread: protectedProcedure
    .input(z.object({ id: z.string().trim().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Securely look up the thread entity ensuring it belongs to the current user
      const [threadAccount] = await ctx.db
        .select({ tenantId: corsairAccounts.tenantId })
        .from(corsairEntities)
        .innerJoin(
          corsairAccounts,
          eq(corsairEntities.accountId, corsairAccounts.id),
        )
        .innerJoin(
          corsairIntegrations,
          eq(corsairAccounts.integrationId, corsairIntegrations.id),
        )
        .where(
          and(
            eq(corsairEntities.entityId, input.id),
            eq(corsairEntities.entityType, "threads"),
            eq(corsairIntegrations.name, "gmail"),
            or(
              eq(corsairAccounts.tenantId, userId),
              like(corsairAccounts.tenantId, `${userId}\\_%`),
            ),
          ),
        )
        .limit(1);

      if (!threadAccount) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Thread not found or you do not have permission to access it.",
        });
      }

      const tenantId = threadAccount.tenantId;
      const tenant = corsair.withTenant(tenantId);

      try {
        // Archive by removing 'INBOX' label from the thread
        const res = await tenant.gmail.api.threads.modify({
          id: input.id,
          removeLabelIds: ["INBOX"],
        });
        return res;
      } catch (err: any) {
        console.error("Failed to archive thread:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to archive thread: ${err.message || err}`,
        });
      }
    }),

  deleteThread: protectedProcedure
    .input(z.object({ id: z.string().trim().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Securely look up the thread entity ensuring it belongs to the current user
      const [threadAccount] = await ctx.db
        .select({ tenantId: corsairAccounts.tenantId })
        .from(corsairEntities)
        .innerJoin(
          corsairAccounts,
          eq(corsairEntities.accountId, corsairAccounts.id),
        )
        .innerJoin(
          corsairIntegrations,
          eq(corsairAccounts.integrationId, corsairIntegrations.id),
        )
        .where(
          and(
            eq(corsairEntities.entityId, input.id),
            eq(corsairEntities.entityType, "threads"),
            eq(corsairIntegrations.name, "gmail"),
            or(
              eq(corsairAccounts.tenantId, userId),
              like(corsairAccounts.tenantId, `${userId}\\_%`),
            ),
          ),
        )
        .limit(1);

      if (!threadAccount) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Thread not found or you do not have permission to access it.",
        });
      }

      const tenantId = threadAccount.tenantId;
      const tenant = corsair.withTenant(tenantId);

      try {
        // Move thread to trash
        const res = await tenant.gmail.api.threads.trash({ id: input.id });
        return res;
      } catch (err: any) {
        console.error("Failed to delete thread:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to delete thread: ${err.message || err}`,
        });
      }
    }),

  getPriorityRules: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    try {
      const [settings] = await ctx.db
        .select({ priorityInstructions: userSettings.priorityInstructions })
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);
      return settings?.priorityInstructions ?? "";
    } catch (err: any) {
      console.error("Failed to get priority rules:", err);
      return "";
    }
  }),

  isPrioritizing: protectedProcedure.query(({ ctx }) => {
    return isSyncingPriorities(ctx.session.user.id);
  }),

  setPriorityRules: protectedProcedure
    .input(z.object({ rules: z.string().max(5000).trim() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      try {
        // Upsert rules in userSettings
        await ctx.db
          .insert(userSettings)
          .values({
            userId,
            priorityInstructions: input.rules,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: userSettings.userId,
            set: {
              priorityInstructions: input.rules,
              updatedAt: new Date(),
            },
          });

        // Delete existing priorities to trigger a clean re-classification using the new rules
        await ctx.db
          .delete(emailPriorities)
          .where(eq(emailPriorities.tenantId, userId));

        // Trigger priority sync asynchronously in the background
        void syncPriorities(userId).catch((err) => {
          console.error(
            "Background priority sync failed after updating rules:",
            err,
          );
        });

        return { success: true };
      } catch (err: any) {
        console.error("Failed to set priority rules:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to update priority rules: ${err.message || err}`,
        });
      }
    }),

  getUsername: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    try {
      const [settings] = await ctx.db
        .select({ username: userSettings.username })
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);
      return settings?.username ?? "";
    } catch (err: any) {
      console.error("Failed to get username settings:", err);
      return "";
    }
  }),

  setUsername: protectedProcedure
    .input(z.object({ username: z.string().min(1).max(100).trim() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      try {
        await ctx.db
          .insert(userSettings)
          .values({
            userId,
            username: input.username,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: userSettings.userId,
            set: {
              username: input.username,
              updatedAt: new Date(),
            },
          });
        return { success: true };
      } catch (err: any) {
        console.error("Failed to set username:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to update username: ${err.message || err}`,
        });
      }
    }),

  getModelMode: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    try {
      const [settings] = await ctx.db
        .select({ modelMode: userSettings.modelMode })
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);
      return settings?.modelMode ?? "careful";
    } catch (err: any) {
      console.error("Failed to get model mode settings:", err);
      return "careful";
    }
  }),

  setModelMode: protectedProcedure
    .input(z.object({ mode: z.enum(["careful", "autonomous"]) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      try {
        await ctx.db
          .insert(userSettings)
          .values({
            userId,
            modelMode: input.mode,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: userSettings.userId,
            set: {
              modelMode: input.mode,
              updatedAt: new Date(),
            },
          });
        return { success: true };
      } catch (err: any) {
        console.error("Failed to set model mode:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to update model mode: ${err.message || err}`,
        });
      }
    }),

  getContacts: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    try {
      const threads = await ctx.db
        .select({ data: corsairEntities.data })
        .from(corsairEntities)
        .innerJoin(
          corsairAccounts,
          eq(corsairEntities.accountId, corsairAccounts.id),
        )
        .where(
          and(
            or(
              eq(corsairAccounts.tenantId, userId),
              like(corsairAccounts.tenantId, `${userId}\\_%`),
            ),
            eq(corsairEntities.entityType, "threads"),
          ),
        );

      const contactMap = new Map<
        string,
        { name: string; email: string; count: number }
      >();

      const getHeaderValue = (msg: any, name: string): string | undefined => {
        if (!msg) return undefined;
        if (msg[name.toLowerCase()]) return msg[name.toLowerCase()];
        const headers = msg.payload?.headers ?? [];
        return headers.find(
          (h: any) => h.name?.toLowerCase() === name.toLowerCase(),
        )?.value;
      };

      const processHeader = (headerValue: string) => {
        if (!headerValue) return;
        const parts = headerValue.split(",");
        for (const part of parts) {
          const trimmed = part.trim();
          if (!trimmed) continue;

          let name = "";
          let email = "";
          const match = trimmed.match(/^(.*?)\s*<(.*?)>$/);
          if (match) {
            name = match[1]?.replace(/^["']|["']$/g, "").trim() ?? "";
            email = match[2]?.trim().toLowerCase() ?? "";
          } else if (trimmed.includes("@")) {
            email = trimmed.toLowerCase();
            name = trimmed.split("@")[0] ?? "";
          }

          if (email && email.includes("@")) {
            const existing = contactMap.get(email);
            if (existing) {
              existing.count += 1;
              if (name && !existing.name) {
                existing.name = name;
              }
            } else {
              contactMap.set(email, { name, email, count: 1 });
            }
          }
        }
      };

      for (const t of threads) {
        const threadData = t.data as any;
        const messages = threadData?.messages ?? [];
        for (const msg of messages) {
          const fromVal = getHeaderValue(msg, "from");
          if (fromVal) processHeader(fromVal);

          const toVal = getHeaderValue(msg, "to");
          if (toVal) processHeader(toVal);
        }
      }

      const contacts = Array.from(contactMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 150);

      return contacts;
    } catch (err) {
      console.error("[GetContacts] Failed to fetch contacts:", err);
      return [];
    }
  }),

  getLearningStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    try {
      const [manualCountRes] = await ctx.db
        .select({ value: count() })
        .from(emailPriorities)
        .where(
          and(
            eq(emailPriorities.tenantId, userId),
            eq(emailPriorities.manuallyUpdated, true),
          ),
        );

      const [totalPrioritizedRes] = await ctx.db
        .select({ value: count() })
        .from(emailPriorities)
        .where(eq(emailPriorities.tenantId, userId));

      const [spamCountRes] = await ctx.db
        .select({ value: count() })
        .from(emailPriorities)
        .where(
          and(
            eq(emailPriorities.tenantId, userId),
            eq(emailPriorities.isSpam, true),
          ),
        );

      const [settings] = await ctx.db
        .select({ learntHabits: userSettings.learntHabits })
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);

      return {
        manualOverrides: manualCountRes?.value ?? 0,
        totalPrioritized: totalPrioritizedRes?.value ?? 0,
        spamFiltered: spamCountRes?.value ?? 0,
        learntHabits: settings?.learntHabits ?? "",
      };
    } catch (err) {
      console.error("[GetLearningStats] Failed to fetch stats:", err);
      return {
        manualOverrides: 0,
        totalPrioritized: 0,
        spamFiltered: 0,
      };
    }
  }),

  setThreadPriority: protectedProcedure
    .input(
      z.object({
        threadId: z.string(),
        priority: z.enum(["urgent", "normal", "low"]),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      try {
        const [thread] = await ctx.db
          .select({ id: corsairEntities.id })
          .from(corsairEntities)
          .innerJoin(
            corsairAccounts,
            eq(corsairEntities.accountId, corsairAccounts.id),
          )
          .where(
            and(
              eq(corsairEntities.entityId, input.threadId),
              eq(corsairEntities.entityType, "threads"),
              or(
                eq(corsairAccounts.tenantId, userId),
                like(corsairAccounts.tenantId, `${userId}\\_%`),
              ),
            ),
          )
          .limit(1);

        if (!thread) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Thread not found or unauthorized.",
          });
        }

        const [existing] = await ctx.db
          .select({ id: emailPriorities.id })
          .from(emailPriorities)
          .where(eq(emailPriorities.emailId, thread.id))
          .limit(1);

        if (existing) {
          await ctx.db
            .update(emailPriorities)
            .set({
              priority: input.priority,
              reason: input.reason ?? "Manually adjusted by user",
              manuallyUpdated: true,
              isSpam: false,
              updatedAt: new Date(),
            })
            .where(eq(emailPriorities.id, existing.id));
        } else {
          await ctx.db.insert(emailPriorities).values({
            id: crypto.randomUUID(),
            tenantId: userId,
            emailId: thread.id,
            priority: input.priority,
            reason: input.reason ?? "Manually adjusted by user",
            manuallyUpdated: true,
            isSpam: false,
          });
        }

        return { success: true };
      } catch (err: any) {
        console.error("Failed to set thread priority:", err);
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to update thread priority: ${err.message || err}`,
        });
      }
    }),

  getSubscriptionStatus: protectedProcedure.query(async ({ ctx }) => {
    const userEmail = ctx.session.user.email;
    const { isPremiumUser } = await import("@/server/subscription");
    const isPremium = await isPremiumUser(userEmail);

    const [dbUser] = await ctx.db
      .select({
        premiumOverride: user.premiumOverride,
        premium: user.premium,
      })
      .from(user)
      .where(eq(user.email, userEmail))
      .limit(1);

    return {
      isPremium,
      premiumOverride: dbUser?.premiumOverride ?? false,
      premium: dbUser?.premium ?? false,
    };
  }),
});
