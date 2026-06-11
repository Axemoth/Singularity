import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { corsair } from "@/server/corsair";
import { corsairEntities, corsairAccounts, corsairIntegrations, emailPriorities } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Helper to construct a base64url encoded MIME email
function buildRawEmail(to: string, subject: string, body: string) {
  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/html; charset=utf-8`,
    `MIME-Version: 1.0`,
    ``,
    body,
  ];
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
          await tenant.gmail.api.threads.list({});
        } catch (err: any) {
          console.error("Failed to resync Gmail threads:", err);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to refresh Gmail cache: ${err.message || err}`,
          });
        }
      }

      // Query cached threads from the local database
      const threads = await ctx.db
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

      return threads;
    }),

  getThread: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const tenant = corsair.withTenant(userId);

      try {
        const thread = await tenant.gmail.api.threads.get({ id: input.id });
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const tenant = corsair.withTenant(userId);

      try {
        const raw = buildRawEmail(input.to, input.subject, input.body);
        const res = await tenant.gmail.api.messages.send({ raw });
        return res;
      } catch (err: any) {
        console.error("Failed to send email via Corsair:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to send email: ${err.message || err}`,
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
});
