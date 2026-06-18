import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { corsairEntities, corsairAccounts, corsairIntegrations } from "@/server/db/schema";
import { eq, and, or, like, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const dashboardDateSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "Expected a valid datetime.",
  })
  .transform((value) => new Date(value).toISOString());

export const dashboardRouter = createTRPCRouter({
  getMetrics: protectedProcedure
    .input(
      z.object({
        startDate: dashboardDateSchema,
        endDate: dashboardDateSchema,
        emailFilter: z.string().max(320).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const start = new Date(input.startDate);
      const end = new Date(input.endDate);

      // 1. Fetch connected Gmail accounts
      const gmailAccountsQuery = ctx.db
        .select({ id: corsairAccounts.id, emailAddress: corsairAccounts.emailAddress })
        .from(corsairAccounts)
        .innerJoin(corsairIntegrations, eq(corsairAccounts.integrationId, corsairIntegrations.id))
        .where(
          and(
            or(
              eq(corsairAccounts.tenantId, userId),
              like(corsairAccounts.tenantId, `${userId}\\_%`)
            ),
            eq(corsairIntegrations.name, "gmail")
          )
        );

      let gmailAccounts = await gmailAccountsQuery;
      if (input.emailFilter && input.emailFilter !== "all") {
        gmailAccounts = gmailAccounts.filter(acc => acc.emailAddress === input.emailFilter);
      }

      // 2. Fetch connected Calendar accounts
      const calendarAccountsQuery = ctx.db
        .select({ id: corsairAccounts.id, emailAddress: corsairAccounts.emailAddress })
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

      let calendarAccounts = await calendarAccountsQuery;
      if (input.emailFilter && input.emailFilter !== "all") {
        calendarAccounts = calendarAccounts.filter(acc => acc.emailAddress === input.emailFilter);
      }

      const gmailAccountIds = gmailAccounts.map((a) => a.id);
      const calendarAccountIds = calendarAccounts.map((a) => a.id);

      let sentCount = 0;
      let unreadCount = 0;
      const scheduledEvents: Array<{
        id: string;
        summary: string;
        start: string;
        end: string;
        location?: string;
        description?: string;
      }> = [];

      // 3. Fetch threads (emails) if Gmail is connected
      if (gmailAccountIds.length > 0) {
        // Query sent messages count in database
        const sentResult = await ctx.db.execute(sql`
          SELECT COUNT(*) AS count
          FROM corsair_entities,
               jsonb_array_elements(data->'messages') AS msg
          WHERE entity_type = 'threads'
            AND account_id IN (${sql.join(gmailAccountIds.map(id => sql`${id}`), sql`, `)})
            AND msg->'labelIds' ? 'SENT'
            AND (msg->>'internalDate')::bigint >= ${start.getTime()}
            AND (msg->>'internalDate')::bigint <= ${end.getTime()}
        `);
        sentCount = Number((sentResult[0] as any)?.count ?? 0);

        // Query unread threads count in database
        const unreadResult = await ctx.db.execute(sql`
          SELECT COUNT(*) AS count
          FROM corsair_entities
          WHERE entity_type = 'threads'
            AND account_id IN (${sql.join(gmailAccountIds.map(id => sql`${id}`), sql`, `)})
            AND data->'messages'->0->'labelIds' ? 'UNREAD'
            AND (data->'messages'->0->>'internalDate')::bigint >= ${start.getTime()}
            AND (data->'messages'->0->>'internalDate')::bigint <= ${end.getTime()}
        `);
        unreadCount = Number((unreadResult[0] as any)?.count ?? 0);
      }

      // 4. Fetch calendar events if Calendar is connected
      if (calendarAccountIds.length > 0) {
        const eventsResult = await ctx.db.execute(sql`
          SELECT 
            id,
            jsonb_build_object(
              'summary', data->>'summary',
              'location', data->>'location',
              'description', data->>'description',
              'start', data->'start',
              'end', data->'end'
            ) AS event_data
          FROM corsair_entities
          WHERE entity_type = 'events'
            AND account_id IN (${sql.join(calendarAccountIds.map(id => sql`${id}`), sql`, `)})
            AND COALESCE(data->'start'->>'dateTime', data->'start'->>'date') IS NOT NULL
            AND (
              CASE 
                WHEN (data->'start'->>'dateTime') IS NOT NULL THEN (data->'start'->>'dateTime')::timestamptz
                ELSE (data->'start'->>'date')::timestamptz
              END
            ) >= ${start.toISOString()}::timestamptz
            AND (
              CASE 
                WHEN (data->'start'->>'dateTime') IS NOT NULL THEN (data->'start'->>'dateTime')::timestamptz
                ELSE (data->'start'->>'date')::timestamptz
              END
            ) <= ${end.toISOString()}::timestamptz
        `);

        for (const row of eventsResult) {
          const eId = (row as any).id;
          const eventData = (row as any).event_data;
          const startStr = eventData.start?.dateTime || eventData.start?.date;
          const endStr = eventData.end?.dateTime || eventData.end?.date;
          scheduledEvents.push({
            id: eId,
            summary: eventData.summary ?? "No Title",
            start: startStr,
            end: endStr ?? startStr,
            location: eventData.location || undefined,
            description: eventData.description || undefined,
          });
        }

        // Sort events by start date chronologically
        scheduledEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      }

      return {
        sentCount,
        unreadCount,
        scheduledEvents,
      };
    }),
});
