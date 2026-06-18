import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { corsairEmbeddings, corsairEntities, corsairAccounts } from "@/server/db/schema";
import { sql, eq, and, or, like } from "drizzle-orm";
import { generateEmbedding, syncEmbeddings } from "@/server/api/tasks/embeddings";

export const searchRouter = createTRPCRouter({
  searchLocal: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(500).trim(),
        entityType: z.enum(["all", "threads", "events"]).optional().default("all"),
        limit: z.number().min(1).max(50).optional().default(15),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { query, entityType, limit } = input;

      if (!query.trim()) {
        return [];
      }

      try {
        // Trigger background embedding sync to make sure we index recent cache entries
        void syncEmbeddings(userId).catch((err) => {
          console.error("[SearchRouter] Background embedding sync failed:", err);
        });

        // 1. Generate query embedding
        const queryEmbedding = await generateEmbedding(query);
        const queryEmbeddingStr = `[${queryEmbedding.join(",")}]`;

        // 2. Build where clause
        const conditions = [
          or(
            eq(corsairAccounts.tenantId, userId),
            like(corsairAccounts.tenantId, `${userId}\\_%`)
          )
        ];

        if (entityType === "threads") {
          conditions.push(eq(corsairEntities.entityType, "threads"));
        } else if (entityType === "events") {
          conditions.push(eq(corsairEntities.entityType, "events"));
        } else {
          // "all" - only include threads and events
          conditions.push(
            or(
              eq(corsairEntities.entityType, "threads"),
              eq(corsairEntities.entityType, "events")
            )
          );
        }

        // 3. Query the database
        const results = await ctx.db
          .select({
            id: corsairEntities.id,
            entityId: corsairEntities.entityId,
            entityType: corsairEntities.entityType,
            data: corsairEntities.data,
            text: corsairEmbeddings.text,
            similarity: sql<number>`1 - (${corsairEmbeddings.embedding} <=> ${queryEmbeddingStr}::vector)`.as('similarity'),
            updatedAt: corsairEntities.updatedAt,
            emailAddress: corsairAccounts.emailAddress,
          })
          .from(corsairEmbeddings)
          .innerJoin(corsairEntities, eq(corsairEmbeddings.entityId, corsairEntities.id))
          .innerJoin(corsairAccounts, eq(corsairEntities.accountId, corsairAccounts.id))
          .where(and(...conditions))
          .orderBy(sql`${corsairEmbeddings.embedding} <=> ${queryEmbeddingStr}::vector`)
          .limit(limit);

        // 4. Format outputs
        return results.map(r => {
          if (r.entityType === "threads") {
            const threadData = r.data as any;
            const messages = threadData?.messages ?? [];
            const firstMessage = messages[0] ?? {};
            const subject = firstMessage.subject ?? threadData?.snippet ?? "No Subject";
            const from = firstMessage.from ?? "";
            const date = firstMessage.internalDate ?? r.updatedAt.getTime().toString();
            return {
              id: r.id,
              entityId: r.entityId,
              entityType: r.entityType as "threads" | "events",
              similarity: r.similarity,
              updatedAt: r.updatedAt,
              emailAddress: r.emailAddress,
              details: {
                subject,
                snippet: threadData?.snippet ?? "",
                from,
                date,
                isUnread: firstMessage.labelIds?.includes("UNREAD") ?? false,
              }
            };
          } else {
            const eventData = r.data as any;
            return {
              id: r.id,
              entityId: r.entityId,
              entityType: r.entityType as "threads" | "events",
              similarity: r.similarity,
              updatedAt: r.updatedAt,
              emailAddress: r.emailAddress,
              details: {
                summary: eventData.summary ?? "No Title",
                description: eventData.description ?? "",
                location: eventData.location ?? "",
                start: eventData.start?.dateTime ?? eventData.start?.date ?? "",
                end: eventData.end?.dateTime ?? eventData.end?.date ?? "",
                attendees: eventData.attendees ?? [],
              }
            };
          }
        });
      } catch (err) {
        console.error("Local search query failed:", err);
        throw new Error("Failed to execute local semantic search.");
      }
    })
});
