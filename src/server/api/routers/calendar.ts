import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { corsair } from "@/server/corsair";
import { corsairEntities, corsairAccounts, corsairIntegrations, corsairEvents } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
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
      const tenant = corsair.withTenant(userId);

      if (input.refresh) {
        try {
          // Trigger live getMany which updates the corsair_entities table automatically
          await tenant.googlecalendar.api.events.getMany({
            calendarId: input.calendarId,
            maxResults: 100,
          });
        } catch (err: any) {
          console.error("Failed to sync calendar events:", err);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to refresh calendar cache: ${err.message || err}`,
          });
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
        })
        .from(corsairEntities)
        .innerJoin(corsairAccounts, eq(corsairEntities.accountId, corsairAccounts.id))
        .innerJoin(corsairIntegrations, eq(corsairAccounts.integrationId, corsairIntegrations.id))
        .where(
          and(
            eq(corsairAccounts.tenantId, userId),
            eq(corsairIntegrations.name, "googlecalendar"),
            eq(corsairEntities.entityType, "events")
          )
        )
        .orderBy(desc(corsairEntities.updatedAt));

      // Auto-sync on first load if account exists but database is empty
      if (events.length === 0 && !input.refresh) {
        const hasAccount = await ctx.db
          .select({ id: corsairAccounts.id })
          .from(corsairAccounts)
          .innerJoin(corsairIntegrations, eq(corsairAccounts.integrationId, corsairIntegrations.id))
          .where(
            and(
              eq(corsairAccounts.tenantId, userId),
              eq(corsairIntegrations.name, "googlecalendar")
            )
          )
          .limit(1);

        if (hasAccount.length > 0) {
          try {
            console.log(`[Calendar Auto-sync] Populating Calendar events for user ${userId}...`);
            await tenant.googlecalendar.api.events.getMany({
              calendarId: input.calendarId,
              maxResults: 100,
            });

            // Query again
            events = await ctx.db
              .select({
                id: corsairEntities.id,
                entityId: corsairEntities.entityId,
                data: corsairEntities.data,
                updatedAt: corsairEntities.updatedAt,
              })
              .from(corsairEntities)
              .innerJoin(corsairAccounts, eq(corsairEntities.accountId, corsairAccounts.id))
              .innerJoin(corsairIntegrations, eq(corsairAccounts.integrationId, corsairIntegrations.id))
              .where(
                and(
                  eq(corsairAccounts.tenantId, userId),
                  eq(corsairIntegrations.name, "googlecalendar"),
                  eq(corsairEntities.entityType, "events")
                )
              )
              .orderBy(desc(corsairEntities.updatedAt));
          } catch (err: any) {
            console.error("[Calendar Auto-sync] Failed to auto-sync Calendar events:", err);
          }
        }
      }

      return events;
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
          eq(corsairIntegrations.name, "googlecalendar")
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
          eq(corsairIntegrations.name, "googlecalendar")
        )
      )
      .limit(1);

    const [acc] = account;
    if (acc) {
      const accountId = acc.id;

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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const tenant = corsair.withTenant(userId);

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
      const tenant = corsair.withTenant(userId);

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
      const tenant = corsair.withTenant(userId);

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
