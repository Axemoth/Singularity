import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { corsairEntities, corsairAccounts, corsairIntegrations } from "@/server/db/schema";
import { eq, and, or, like, inArray } from "drizzle-orm";

export const dashboardRouter = createTRPCRouter({
  getMetrics: protectedProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
        emailFilter: z.string().optional(),
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
        const threads = await ctx.db
          .select({
            data: corsairEntities.data,
          })
          .from(corsairEntities)
          .where(
            and(
              eq(corsairEntities.entityType, "threads"),
              inArray(corsairEntities.accountId, gmailAccountIds)
            )
          );

        for (const t of threads) {
          const threadData = t.data as any;
          const messages = (threadData.messages ?? []) as any[];

          // Count sent messages in the thread that fall in the range
          for (const msg of messages) {
            const isSent = msg.labelIds?.includes("SENT");
            const internalDateMs = msg.internalDate ? Number(msg.internalDate) : null;
            if (isSent && internalDateMs) {
              const msgDate = new Date(internalDateMs);
              if (msgDate >= start && msgDate <= end) {
                sentCount++;
              }
            }
          }

          // Count unread threads where the first message has UNREAD and its date is in the range
          const firstMsg = messages[0];
          if (firstMsg) {
            const isUnread = firstMsg.labelIds?.includes("UNREAD");
            const internalDateMs = firstMsg.internalDate ? Number(firstMsg.internalDate) : null;
            if (isUnread && internalDateMs) {
              const threadDate = new Date(internalDateMs);
              if (threadDate >= start && threadDate <= end) {
                unreadCount++;
              }
            }
          }
        }
      }

      // 4. Fetch calendar events if Calendar is connected
      if (calendarAccountIds.length > 0) {
        const events = await ctx.db
          .select({
            id: corsairEntities.id,
            data: corsairEntities.data,
          })
          .from(corsairEntities)
          .where(
            and(
              eq(corsairEntities.entityType, "events"),
              inArray(corsairEntities.accountId, calendarAccountIds)
            )
          );

        for (const e of events) {
          const eventData = e.data as any;
          const startStr = eventData.start?.dateTime || eventData.start?.date;
          const endStr = eventData.end?.dateTime || eventData.end?.date;
          if (startStr) {
            const eventStart = new Date(startStr);
            if (eventStart >= start && eventStart <= end) {
              scheduledEvents.push({
                id: e.id,
                summary: eventData.summary ?? "No Title",
                start: startStr,
                end: endStr ?? startStr,
                location: eventData.location,
                description: eventData.description,
              });
            }
          }
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
