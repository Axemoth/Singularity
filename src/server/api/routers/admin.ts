import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "@/server/api/trpc";
import { user, copilotUsage, corsairAccounts, corsairIntegrations } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { isPremiumUser } from "@/server/subscription";

function getBaseUserId(tenantId: string): string {
  return tenantId.split("_")[0]!;
}

export const adminRouter = createTRPCRouter({
  getMetrics: adminProcedure.query(async ({ ctx }) => {
    // 1. Get total users
    const [totalUsersCount] = await ctx.db
      .select({
        count: ctx.db.$count(user),
      })
      .from(user);

    // 2. Get total manual premium override users
    const [premiumOverrideCount] = await ctx.db
      .select({
        count: ctx.db.$count(user, eq(user.premiumOverride, true)),
      })
      .from(user);

    // 3. Get total copilot request usage count today
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const [copilotUsageToday] = await ctx.db
      .select({
        sum: ctx.db.$count(copilotUsage, eq(copilotUsage.lastRequestDate, todayStr)),
      })
      .from(copilotUsage);

    // 4. Get active connections count
    const [activeConnections] = await ctx.db
      .select({
        count: ctx.db.$count(corsairAccounts),
      })
      .from(corsairAccounts);

    return {
      totalUsers: totalUsersCount?.count ?? 0,
      premiumOverrides: premiumOverrideCount?.count ?? 0,
      copilotUsageToday: copilotUsageToday?.sum ?? 0,
      activeConnections: activeConnections?.count ?? 0,
    };
  }),

  listUsers: adminProcedure.query(async ({ ctx }) => {
    // Fetch all users
    const usersList = await ctx.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        premiumOverride: user.premiumOverride,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(desc(user.createdAt));

    // Fetch all connected accounts
    const allAccounts = await ctx.db
      .select({
        tenantId: corsairAccounts.tenantId,
        emailAddress: corsairAccounts.emailAddress,
        integrationName: corsairIntegrations.name,
      })
      .from(corsairAccounts)
      .innerJoin(corsairIntegrations, eq(corsairAccounts.integrationId, corsairIntegrations.id));

    // Fetch all copilot usage
    const allUsage = await ctx.db
      .select({
        userId: copilotUsage.userId,
        requestCount: copilotUsage.requestCount,
        lastRequestDate: copilotUsage.lastRequestDate,
      })
      .from(copilotUsage);

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    // Map everything together
    const mapped = usersList.map((u) => {
      const userAccounts = allAccounts.filter((acc) => getBaseUserId(acc.tenantId) === u.id);
      
      const gmailAccounts = userAccounts
        .filter((acc) => acc.integrationName === "gmail")
        .map((acc) => acc.emailAddress ?? "Connected");

      const calendarAccounts = userAccounts
        .filter((acc) => acc.integrationName === "googlecalendar")
        .map((acc) => acc.emailAddress ?? "Connected");

      const usageRec = allUsage.find((us) => us.userId === u.id);
      const copilotUsageToday = usageRec && usageRec.lastRequestDate === todayStr ? usageRec.requestCount : 0;

      return {
        ...u,
        gmailAccounts,
        calendarAccounts,
        copilotUsageToday,
      };
    });

    return mapped;
  }),

  updateUserPremium: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        premiumOverride: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(user)
        .set({ premiumOverride: input.premiumOverride })
        .where(eq(user.id, input.userId));

      return { success: true };
    }),
});
