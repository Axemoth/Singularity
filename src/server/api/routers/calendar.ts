import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { corsair } from "@/server/corsair";
import { corsairEntities, corsairAccounts, corsairIntegrations, corsairEvents } from "@/server/db/schema";
import { eq, and, desc, or, like } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { syncEmbeddings } from "@/server/api/tasks/embeddings";

const calendarDateTimeSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "Expected a valid datetime.",
  })
  .transform((value) => new Date(value).toISOString());

export const calendarRouter = createTRPCRouter({
  listEvents: protectedProcedure
    .input(
      z.object({
        calendarId: z.string().optional().default("primary"),
        refresh: z.boolean().optional().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Query all connected calendar accounts for this user
      const accounts = await ctx.db
        .select({
          id: corsairAccounts.id,
          tenantId: corsairAccounts.tenantId,
          emailAddress: corsairAccounts.emailAddress,
        })
        .from(corsairAccounts)
        .innerJoin(corsairIntegrations, eq(corsairAccounts.integrationId, corsairIntegrations.id))
        .where(
          and(
            or(
              eq(corsairAccounts.tenantId, userId),
              like(corsairAccounts.tenantId, `${userId}\\_%`)
            ),
            eq(corsairIntegrations.name, "googlecalendar")
          )
        );

      if (input.refresh) {
        for (const account of accounts) {
          const tenant = corsair.withTenant(account.tenantId);
          try {
            // Trigger live getMany which updates the corsair_entities table automatically
            await tenant.googlecalendar.api.events.getMany({
              calendarId: input.calendarId,
              maxResults: 100,
            });
          } catch (err: any) {
            console.error(`Failed to sync calendar events for ${account.emailAddress}:`, err);
          }
        }
      }

      // Trigger background embeddings sync asynchronously
      void syncEmbeddings(userId).catch((err) => {
        console.error("Background embeddings sync failed for Calendar:", err);
      });

      // Query cached events from the local database
      let events = await ctx.db
        .select({
          id: corsairEntities.id,
          entityId: corsairEntities.entityId,
          data: corsairEntities.data,
          updatedAt: corsairEntities.updatedAt,
          accountId: corsairEntities.accountId,
          emailAddress: corsairAccounts.emailAddress,
        })
        .from(corsairEntities)
        .innerJoin(corsairAccounts, eq(corsairEntities.accountId, corsairAccounts.id))
        .innerJoin(corsairIntegrations, eq(corsairAccounts.integrationId, corsairIntegrations.id))
        .where(
          and(
            or(
              eq(corsairAccounts.tenantId, userId),
              like(corsairAccounts.tenantId, `${userId}\\_%`)
            ),
            eq(corsairIntegrations.name, "googlecalendar"),
            eq(corsairEntities.entityType, "events")
          )
        )
        .orderBy(desc(corsairEntities.updatedAt));

      // Auto-sync on first load if account exists but database has no events for this specific account
      let didSyncAny = false;
      for (const account of accounts) {
        const hasEvents = events.some((e) => e.accountId === account.id);
        if (!hasEvents && !input.refresh) {
          didSyncAny = true;
          const tenant = corsair.withTenant(account.tenantId);
          try {
            console.log(`[Calendar Auto-sync] Populating Calendar events for account ${account.emailAddress}...`);
            await tenant.googlecalendar.api.events.getMany({
              calendarId: input.calendarId,
              maxResults: 100,
            });
          } catch (err: any) {
            console.error(`[Calendar Auto-sync] Failed to auto-sync Calendar events for ${account.emailAddress}:`, err);
          }
        }
      }

      if (didSyncAny) {
        // Query again to include newly populated events
        events = await ctx.db
          .select({
            id: corsairEntities.id,
            entityId: corsairEntities.entityId,
            data: corsairEntities.data,
            updatedAt: corsairEntities.updatedAt,
            accountId: corsairEntities.accountId,
            emailAddress: corsairAccounts.emailAddress,
          })
          .from(corsairEntities)
          .innerJoin(corsairAccounts, eq(corsairEntities.accountId, corsairAccounts.id))
          .innerJoin(corsairIntegrations, eq(corsairAccounts.integrationId, corsairIntegrations.id))
          .where(
            and(
              or(
                eq(corsairAccounts.tenantId, userId),
                like(corsairAccounts.tenantId, `${userId}\\_%`)
              ),
              eq(corsairIntegrations.name, "googlecalendar"),
              eq(corsairEntities.entityType, "events")
            )
          )
          .orderBy(desc(corsairEntities.updatedAt));
      }

      return events.filter((e) => (e.data as any)?.status !== "cancelled");
    }),

  syncCalendar: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Query all connected calendar accounts for this user
    const accounts = await ctx.db
      .select({
        id: corsairAccounts.id,
        tenantId: corsairAccounts.tenantId,
        emailAddress: corsairAccounts.emailAddress,
      })
      .from(corsairAccounts)
      .innerJoin(corsairIntegrations, eq(corsairAccounts.integrationId, corsairIntegrations.id))
      .where(
        and(
          or(
            eq(corsairAccounts.tenantId, userId),
            like(corsairAccounts.tenantId, `${userId}\\_%`)
          ),
          eq(corsairIntegrations.name, "googlecalendar")
        )
      );

    console.log(`[Calendar Manual Sync] Syncing ${accounts.length} accounts for user ${userId}...`);

    for (const account of accounts) {
      const tenant = corsair.withTenant(account.tenantId);
      try {
        console.log(`[Calendar Manual Sync] Syncing account ${account.emailAddress}...`);
        await tenant.googlecalendar.api.events.getMany({
          calendarId: "primary",
          maxResults: 100,
        });
      } catch (err: any) {
        console.error(`Failed to sync calendar events for ${account.emailAddress}:`, err);
      }
    }

    // Trigger background embeddings sync asynchronously
    void syncEmbeddings(userId).catch((err) => {
      console.error("Background embeddings sync failed for Calendar after manual sync:", err);
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
      .innerJoin(corsairIntegrations, eq(corsairAccounts.integrationId, corsairIntegrations.id))
      .where(
        and(
          or(
            eq(corsairAccounts.tenantId, userId),
            like(corsairAccounts.tenantId, `${userId}\\_%`)
          ),
          eq(corsairIntegrations.name, "googlecalendar")
        )
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
              like(corsairAccounts.tenantId, `${userId}\\_%`)
            )
          )
        )
        .limit(1);

      if (account) {
        const accountId = account.id;

        // Delete dependent corsair entities
        await ctx.db.delete(corsairEntities).where(eq(corsairEntities.accountId, accountId));

        // Delete integration events
        await ctx.db.delete(corsairEvents).where(eq(corsairEvents.accountId, accountId));

        // Delete the account
        await ctx.db.delete(corsairAccounts).where(eq(corsairAccounts.id, accountId));

        return { success: true };
      }
      return { success: false };
    }),

  createEvent: protectedProcedure
    .input(
      z.object({
        calendarId: z.string().optional().default("primary"),
        summary: z.string().min(1).max(500).trim(),
        description: z.string().max(5000).trim().optional(),
        location: z.string().max(1000).trim().optional(),
        start: calendarDateTimeSchema,
        end: calendarDateTimeSchema,
        attendees: z.array(z.string().email().max(320).trim()).optional(),
        fromEmail: z.string().email().max(320).trim().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      
      // Cross-field datetime validation: end must be after start
      if (new Date(input.end) <= new Date(input.start)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "End time must be after start time.",
        });
      }

      // Resolve tenantId based on preferred email or fallback to primary account
      const preferredEmail = input.fromEmail;
      const accounts = await ctx.db
        .select({ tenantId: corsairAccounts.tenantId, emailAddress: corsairAccounts.emailAddress })
        .from(corsairAccounts)
        .innerJoin(corsairIntegrations, eq(corsairAccounts.integrationId, corsairIntegrations.id))
        .where(
          and(
            or(
              eq(corsairAccounts.tenantId, userId),
              like(corsairAccounts.tenantId, `${userId}\\_%`)
            ),
            eq(corsairIntegrations.name, "googlecalendar")
          )
        );

      let tenantId = userId;
      const fallbackAccount = accounts[0];
      if (fallbackAccount) {
        const matched = preferredEmail ? accounts.find(a => a.emailAddress?.toLowerCase() === preferredEmail.toLowerCase()) : null;
        tenantId = matched ? matched.tenantId : fallbackAccount.tenantId;
      }

      const tenant = corsair.withTenant(tenantId);

      try {
        const res = await tenant.googlecalendar.api.events.create({
          calendarId: input.calendarId,
          event: {
            summary: input.summary,
            description: input.description,
            location: input.location,
            start: {
              dateTime: input.start,
            },
            end: {
              dateTime: input.end,
            },
            attendees: input.attendees?.map((email) => ({ email })),
          },
        });
        return res;
      } catch (err: any) {
        console.error("Failed to create calendar event:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to create event: ${err.message || err}`,
        });
      }
    }),

  updateEvent: protectedProcedure
    .input(
      z.object({
        calendarId: z.string().optional().default("primary"),
        id: z.string().trim().min(1), // event entity ID
        summary: z.string().min(1).max(500).trim(),
        description: z.string().max(5000).trim().optional(),
        location: z.string().max(1000).trim().optional(),
        start: calendarDateTimeSchema,
        end: calendarDateTimeSchema,
        attendees: z.array(z.string().email().max(320).trim()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Cross-field datetime validation: end must be after start
      if (new Date(input.end) <= new Date(input.start)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "End time must be after start time.",
        });
      }

      // Securely look up the event entity ensuring it belongs to the current user
      const [eventAccount] = await ctx.db
        .select({ tenantId: corsairAccounts.tenantId })
        .from(corsairEntities)
        .innerJoin(corsairAccounts, eq(corsairEntities.accountId, corsairAccounts.id))
        .innerJoin(corsairIntegrations, eq(corsairAccounts.integrationId, corsairIntegrations.id))
        .where(
          and(
            eq(corsairEntities.entityId, input.id),
            eq(corsairEntities.entityType, "events"),
            eq(corsairIntegrations.name, "googlecalendar"),
            or(
              eq(corsairAccounts.tenantId, userId),
              like(corsairAccounts.tenantId, `${userId}\\_%`)
            )
          )
        )
        .limit(1);

      if (!eventAccount) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Calendar event not found or you do not have permission to access it.",
        });
      }

      const tenantId = eventAccount.tenantId;
      const tenant = corsair.withTenant(tenantId);

      try {
        const res = await tenant.googlecalendar.api.events.update({
          calendarId: input.calendarId,
          id: input.id,
          event: {
            summary: input.summary,
            description: input.description,
            location: input.location,
            start: {
              dateTime: input.start,
            },
            end: {
              dateTime: input.end,
            },
            attendees: input.attendees?.map((email) => ({ email })),
          },
        });
        return res;
      } catch (err: any) {
        console.error("Failed to update calendar event:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to update event: ${err.message || err}`,
        });
      }
    }),

  deleteEvent: protectedProcedure
    .input(
      z.object({
        calendarId: z.string().optional().default("primary"),
        id: z.string().trim().min(1), // event entity ID
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Securely look up the event entity ensuring it belongs to the current user
      const [eventAccount] = await ctx.db
        .select({ tenantId: corsairAccounts.tenantId })
        .from(corsairEntities)
        .innerJoin(corsairAccounts, eq(corsairEntities.accountId, corsairAccounts.id))
        .innerJoin(corsairIntegrations, eq(corsairAccounts.integrationId, corsairIntegrations.id))
        .where(
          and(
            eq(corsairEntities.entityId, input.id),
            eq(corsairEntities.entityType, "events"),
            eq(corsairIntegrations.name, "googlecalendar"),
            or(
              eq(corsairAccounts.tenantId, userId),
              like(corsairAccounts.tenantId, `${userId}\\_%`)
            )
          )
        )
        .limit(1);

      if (!eventAccount) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Calendar event not found or you do not have permission to access it.",
        });
      }

      const tenantId = eventAccount.tenantId;
      const tenant = corsair.withTenant(tenantId);

      try {
        const res = await tenant.googlecalendar.api.events.delete({
          calendarId: input.calendarId,
          id: input.id,
        });
        // Delete from local cache
        await ctx.db.delete(corsairEntities).where(
          and(
            eq(corsairEntities.entityId, input.id),
            eq(corsairEntities.entityType, "events")
          )
        );
        return res;
      } catch (err: any) {
        console.error("Failed to delete calendar event:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to delete event: ${err.message || err}`,
        });
      }
    }),
});
