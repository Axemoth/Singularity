import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { corsair } from "@/server/corsair";
import { corsairEntities, corsairAccounts, corsairIntegrations, corsairEvents } from "@/server/db/schema";
import { eq, and, desc, or, like } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { syncEmbeddings } from "@/server/api/tasks/embeddings";

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
              like(corsairAccounts.tenantId, `${userId}_%`)
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
              like(corsairAccounts.tenantId, `${userId}_%`)
            ),
            eq(corsairIntegrations.name, "googlecalendar"),
            eq(corsairEntities.entityType, "events")
          )
        )
        .orderBy(desc(corsairEntities.updatedAt));

      // Auto-sync on first load if account exists but database is empty
      if (events.length === 0 && !input.refresh && accounts.length > 0) {
        for (const account of accounts) {
          const tenant = corsair.withTenant(account.tenantId);
          try {
            console.log(`[Calendar Auto-sync] Populating Calendar events for user ${userId}, account ${account.emailAddress}...`);
            await tenant.googlecalendar.api.events.getMany({
              calendarId: input.calendarId,
              maxResults: 100,
            });
          } catch (err: any) {
            console.error(`[Calendar Auto-sync] Failed to auto-sync Calendar events for ${account.emailAddress}:`, err);
          }
        }

        // Query again
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
                like(corsairAccounts.tenantId, `${userId}_%`)
              ),
              eq(corsairIntegrations.name, "googlecalendar"),
              eq(corsairEntities.entityType, "events")
            )
          )
          .orderBy(desc(corsairEntities.updatedAt));
      }

      return events;
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
            like(corsairAccounts.tenantId, `${userId}_%`)
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
    .input(z.object({ accountId: z.string() }))
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
              like(corsairAccounts.tenantId, `${userId}_%`)
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
        summary: z.string().min(1),
        description: z.string().optional(),
        location: z.string().optional(),
        start: z.string(), // ISO String or datetime format
        end: z.string(), // ISO String or datetime format
        attendees: z.array(z.string().email()).optional(),
        fromEmail: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      
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
              like(corsairAccounts.tenantId, `${userId}_%`)
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
        id: z.string(), // event entity ID
        summary: z.string().min(1),
        description: z.string().optional(),
        location: z.string().optional(),
        start: z.string(),
        end: z.string(),
        attendees: z.array(z.string().email()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Look up event entity's account
      const [eventEntity] = await ctx.db
        .select({ accountId: corsairEntities.accountId })
        .from(corsairEntities)
        .where(eq(corsairEntities.entityId, input.id))
        .limit(1);

      let tenantId = userId;
      if (eventEntity) {
        const [acc] = await ctx.db
          .select({ tenantId: corsairAccounts.tenantId })
          .from(corsairAccounts)
          .where(eq(corsairAccounts.id, eventEntity.accountId))
          .limit(1);
        if (acc) tenantId = acc.tenantId;
      }

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
        id: z.string(), // event entity ID
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Look up event entity's account
      const [eventEntity] = await ctx.db
        .select({ accountId: corsairEntities.accountId })
        .from(corsairEntities)
        .where(eq(corsairEntities.entityId, input.id))
        .limit(1);

      let tenantId = userId;
      if (eventEntity) {
        const [acc] = await ctx.db
          .select({ tenantId: corsairAccounts.tenantId })
          .from(corsairAccounts)
          .where(eq(corsairAccounts.id, eventEntity.accountId))
          .limit(1);
        if (acc) tenantId = acc.tenantId;
      }

      const tenant = corsair.withTenant(tenantId);

      try {
        await tenant.googlecalendar.api.events.delete({
          calendarId: input.calendarId,
          id: input.id,
        });
        return { success: true };
      } catch (err: any) {
        console.error("Failed to delete calendar event:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to delete event: ${err.message || err}`,
        });
      }
    }),
});
