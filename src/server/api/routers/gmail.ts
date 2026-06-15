import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { corsair } from "@/server/corsair";
import { corsairEntities, corsairAccounts, corsairIntegrations, emailPriorities, userSettings } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { syncEmbeddings } from "@/server/api/tasks/embeddings";
import { syncPriorities } from "@/server/api/tasks/prioritizer";

// Helper to construct a base64url encoded MIME email
export function buildRawEmail(
  to: string,
  subject: string,
  body: string,
  cc?: string,
  bcc?: string,
  parentMessageId?: string
) {
  const encodeHeaderValue = (value: string) => {
    if (/[^\x00-\x7F]/.test(value)) {
      return `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`;
    }
    return value;
  };

  const encodeHeaderEmailList = (value: string) => {
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
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const tenant = corsair.withTenant(userId);

      if (input.refresh) {
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
                  const fullThread = await tenant.gmail.api.threads.get({ id: t.id });
                  // Cache full thread data in corsairEntities
                  await ctx.db
                    .update(corsairEntities)
                    .set({
                      data: fullThread,
                      updatedAt: new Date(),
                    })
                    .where(
                      and(
                        eq(corsairEntities.entityId, t.id),
                        eq(corsairEntities.entityType, "threads")
                      )
                    );
                } catch (e) {
                  console.error(`[Pre-fetch] Failed to pre-fetch thread ${t.id}:`, e);
                }
              }
            })
          );
        } catch (err: any) {
          console.error("Failed to resync Gmail threads:", err);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to refresh Gmail cache: ${err.message || err}`,
          });
        }
      }

      // Trigger background tasks asynchronously
      void syncEmbeddings(userId).catch((err) => {
        console.error("Background embeddings sync failed for Gmail:", err);
      });
      void syncPriorities(userId).catch((err) => {
        console.error("Background priority sync failed for Gmail:", err);
      });

      // Query cached threads from the local database
      let threads = await ctx.db
        .select({
          id: corsairEntities.id,
          entityId: corsairEntities.entityId,
          data: corsairEntities.data,
          updatedAt: corsairEntities.updatedAt,
          priority: emailPriorities.priority,
          priorityReason: emailPriorities.reason,
        })
        .from(corsairEntities)
        .innerJoin(corsairAccounts, eq(corsairEntities.accountId, corsairAccounts.id))
        .innerJoin(corsairIntegrations, eq(corsairAccounts.integrationId, corsairIntegrations.id))
        .leftJoin(emailPriorities, eq(corsairEntities.id, emailPriorities.emailId))
        .where(
          and(
            eq(corsairAccounts.tenantId, userId),
            eq(corsairIntegrations.name, "gmail"),
            eq(corsairEntities.entityType, "threads")
          )
        )
        .orderBy(desc(corsairEntities.updatedAt));

      // Auto-sync on first load if account exists but database is empty
      if (threads.length === 0 && !input.refresh) {
        const hasAccount = await ctx.db
          .select({ id: corsairAccounts.id })
          .from(corsairAccounts)
          .innerJoin(corsairIntegrations, eq(corsairAccounts.integrationId, corsairIntegrations.id))
          .where(
            and(
              eq(corsairAccounts.tenantId, userId),
              eq(corsairIntegrations.name, "gmail")
            )
          )
          .limit(1);

        if (hasAccount.length > 0) {
          try {
            console.log(`[Gmail Auto-sync] Populating Gmail threads for user ${userId}...`);
            const res = await tenant.gmail.api.threads.list({});
            const threadsList = res.threads ?? [];

            // Pre-fetch details for the top 20 threads
            const top20 = threadsList.slice(0, 20);
            await Promise.all(
              top20.map(async (t) => {
                if (t.id) {
                  try {
                    const fullThread = await tenant.gmail.api.threads.get({ id: t.id });
                    // Cache full thread data in corsairEntities
                    await ctx.db
                      .update(corsairEntities)
                      .set({
                        data: fullThread,
                        updatedAt: new Date(),
                      })
                      .where(
                        and(
                          eq(corsairEntities.entityId, t.id),
                          eq(corsairEntities.entityType, "threads")
                        )
                      );
                  } catch (e) {
                    console.error(`[Auto-sync Pre-fetch] Failed to pre-fetch thread ${t.id}:`, e);
                  }
                }
              })
            );

            // Query again
            threads = await ctx.db
              .select({
                id: corsairEntities.id,
                entityId: corsairEntities.entityId,
                data: corsairEntities.data,
                updatedAt: corsairEntities.updatedAt,
                priority: emailPriorities.priority,
                priorityReason: emailPriorities.reason,
              })
              .from(corsairEntities)
              .innerJoin(corsairAccounts, eq(corsairEntities.accountId, corsairAccounts.id))
              .innerJoin(corsairIntegrations, eq(corsairAccounts.integrationId, corsairIntegrations.id))
              .leftJoin(emailPriorities, eq(corsairEntities.id, emailPriorities.emailId))
              .where(
                and(
                  eq(corsairAccounts.tenantId, userId),
                  eq(corsairIntegrations.name, "gmail"),
                  eq(corsairEntities.entityType, "threads")
                )
              )
              .orderBy(desc(corsairEntities.updatedAt));
          } catch (err: any) {
            console.error("[Gmail Auto-sync] Failed to auto-sync Gmail threads:", err);
          }
        }
      }

      // Ensure details are pre-fetched for any threads that lack message details
      const threadsToFetch = threads.filter((t) => {
        const threadData = t.data as any;
        return !threadData || !threadData.messages || threadData.messages.length === 0;
      });

      if (threadsToFetch.length > 0) {
        console.log(`[Gmail Router] Fetching full details for ${threadsToFetch.length} threads lacking message details...`);
        // Limit to top 20 at a time to prevent rate limiting
        const chunk = threadsToFetch.slice(0, 20);
        await Promise.all(
          chunk.map(async (t) => {
            try {
              const fullThread = await tenant.gmail.api.threads.get({ id: t.entityId });
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
                    eq(corsairEntities.entityType, "threads")
                  )
                );
              
              // Update in-memory data for immediate return
              t.data = fullThread;
            } catch (e) {
              console.error(`[Pre-fetch] Failed to pre-fetch thread details for ${t.entityId}:`, e);
            }
          })
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
            .map((m: any) => (m.internalDate ? parseInt(m.internalDate, 10) : 0))
            .filter((d: number) => !isNaN(d) && d > 0);
          if (dates.length > 0) {
            return Math.max(...dates);
          }
        }
        return t.updatedAt ? new Date(t.updatedAt).getTime() : 0;
      };

      uniqueThreads.sort((a, b) => getThreadTimestamp(b) - getThreadTimestamp(a));

      return uniqueThreads;
    }),

  getConnectionStatus: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const account = await ctx.db
      .select({
        id: corsairAccounts.id,
        emailAddress: corsairAccounts.emailAddress,
      })
      .from(corsairAccounts)
      .innerJoin(corsairIntegrations, eq(corsairAccounts.integrationId, corsairIntegrations.id))
      .where(
        and(
          eq(corsairAccounts.tenantId, userId),
          eq(corsairIntegrations.name, "gmail")
        )
      )
      .limit(1);

    const [acc] = account;
    if (acc) {
      return {
        connected: true,
        emailAddress: acc.emailAddress ?? "Connected",
      };
    }
    return { connected: false };
  }),

  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const account = await ctx.db
      .select({ id: corsairAccounts.id })
      .from(corsairAccounts)
      .innerJoin(corsairIntegrations, eq(corsairAccounts.integrationId, corsairIntegrations.id))
      .where(
        and(
          eq(corsairAccounts.tenantId, userId),
          eq(corsairIntegrations.name, "gmail")
        )
      )
      .limit(1);

    const [acc] = account;
    if (acc) {
      const accountId = acc.id;

      // Delete app-specific email priorities
      await ctx.db.delete(emailPriorities).where(eq(emailPriorities.tenantId, userId));

      // Delete dependent corsair entities
      await ctx.db.delete(corsairEntities).where(eq(corsairEntities.accountId, accountId));

      // Delete the account
      await ctx.db.delete(corsairAccounts).where(eq(corsairAccounts.id, accountId));

      return { success: true };
    }
    return { success: false };
  }),

  getThread: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const tenant = corsair.withTenant(userId);

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
              eq(corsairEntities.entityType, "threads")
            )
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
        to: z.string().email(),
        subject: z.string().min(1),
        body: z.string().min(1),
        cc: z.string().optional(),
        bcc: z.string().optional(),
        threadId: z.string().optional(),
        parentMessageId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const tenant = corsair.withTenant(userId);

      try {
        const raw = buildRawEmail(input.to, input.subject, input.body, input.cc, input.bcc, input.parentMessageId);
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
        to: z.string().email().optional(),
        subject: z.string().optional(),
        body: z.string().min(1),
        cc: z.string().optional(),
        bcc: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const tenant = corsair.withTenant(userId);

      try {
        const raw = buildRawEmail(input.to ?? "", input.subject ?? "", input.body, input.cc, input.bcc);
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
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const tenant = corsair.withTenant(userId);

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
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const tenant = corsair.withTenant(userId);

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

  setPriorityRules: protectedProcedure
    .input(z.object({ rules: z.string() }))
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
          console.error("Background priority sync failed after updating rules:", err);
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
    .input(z.object({ username: z.string() }))
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

  getContacts: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    try {
      const threads = await ctx.db
        .select({ data: corsairEntities.data })
        .from(corsairEntities)
        .innerJoin(corsairAccounts, eq(corsairEntities.accountId, corsairAccounts.id))
        .where(
          and(
            eq(corsairAccounts.tenantId, userId),
            eq(corsairEntities.entityType, "threads")
          )
        );

      const contactMap = new Map<string, { name: string; email: string; count: number }>();

      const getHeaderValue = (msg: any, name: string): string | undefined => {
        if (!msg) return undefined;
        if (msg[name.toLowerCase()]) return msg[name.toLowerCase()];
        const headers = msg.payload?.headers ?? [];
        return headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value;
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
});
