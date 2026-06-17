import { db } from "@/server/db";
import { corsairEntities, corsairAccounts, emailPriorities, userSettings } from "@/server/db/schema";
import { eq, and, isNull, or, like } from "drizzle-orm";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { env } from "@/env";

const deepseek = createOpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: env.DEEPSEEK_API_KEY ?? "",
});

const activeSyncs = new Set<string>();

// Helper to classify a single email (for webhook trigger)
async function classifyEmail(
  from: string,
  subject: string,
  snippet: string,
  customRules?: string | null
): Promise<{ priority: "urgent" | "normal" | "low"; reason: string }> {
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn("[Prioritizer] DEEPSEEK_API_KEY is missing, using default priority.");
    return { priority: "normal", reason: "AI API Key missing" };
  }

  try {
    const prompt = `Classify the following email for prioritization in an inbox.
Sender: ${from}
Subject: ${subject}
Snippet/Body: ${snippet}

${
  customRules
    ? `CRITICAL USER INSTRUCTIONS:
The user has specified custom instructions/rules for what emails are priority (urgent/normal):
"${customRules}"

Categorize this email strictly based on the user's instructions. If the email matches the criteria, mark it as 'urgent' or 'normal'. If it does not match, or is generic newsletters, receipts, or spam, mark it as 'low'. Be very strict.`
    : `Categorize into:
- urgent: Needs immediate attention (personal messages, direct questions, calendar invites, time-sensitive, client requests, managers).
- normal: Normal personal/work emails, notifications requiring action.
- low: Mass newsletters, automated receipts, spam, marketing, automated status updates.`
}`;

    const { object } = await generateObject({
      model: (deepseek as any).chat("deepseek-v4-pro"),
      schema: z.object({
        priority: z.enum(["urgent", "normal", "low"]),
        reason: z.string().describe("Brief explanation why this priority was chosen (max 10 words)."),
      }),
      prompt,
    });

    return {
      priority: object.priority,
      reason: object.reason,
    };
  } catch (err) {
    console.error("[Prioritizer] LLM classification error:", err);
    return { priority: "normal", reason: "LLM classification failed" };
  }
}

// Helper to classify multiple emails in a batch (for fast sync)
async function classifyEmailsBatch(
  emails: Array<{ id: string; from: string; subject: string; snippet: string }>,
  customRules?: string | null
): Promise<Array<{ id: string; priority: "urgent" | "normal" | "low"; reason: string }>> {
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn("[Prioritizer] DEEPSEEK_API_KEY is missing, returning default priorities.");
    return emails.map((e) => ({ id: e.id, priority: "normal", reason: "AI API Key missing" }));
  }

  try {
    const emailsListFormatted = emails
      .map(
        (e, idx) =>
          `Email ${idx + 1}:
ID: ${e.id}
From: ${e.from}
Subject: ${e.subject}
Snippet: ${e.snippet}`
      )
      .join("\n\n---\n\n");

    const prompt = `You are a highly accurate email inbox prioritizer assistant. Your job is to classify each of the following emails into a priority category ('urgent', 'normal', or 'low') and explain why in a short sentence (max 10 words).

${
  customRules
    ? `CRITICAL USER INSTRUCTIONS:
The user has specified custom instructions/rules for identifying priority (urgent/normal) emails:
"${customRules}"

You MUST strictly follow the user's custom instructions.
If an email matches the user's criteria, mark it as 'urgent' or 'normal' as appropriate.
If it does NOT match, or if it is a general newsletter, marketing email, automated status update, or receipt, mark it as 'low'. Be very strict.`
    : `Standard Categorization Rules:
- 'urgent': Critical personal messages, direct questions, calendar invites, time-sensitive work, client requests, managers, or family.
- 'normal': Work-related emails requiring action, standard personal communication.
- 'low': Newsletters, automated status updates, notifications (e.g. GitHub notifications, Jira logs), receipts, spam, marketing.`
}

Here are the emails to classify:

${emailsListFormatted}

Return a list of classifications matching the exact IDs provided.`;

    const { object } = await generateObject({
      model: (deepseek as any).chat("deepseek-v4-pro"),
      schema: z.object({
        classifications: z.array(
          z.object({
            id: z.string().describe("The exact ID of the email as provided in the input list"),
            priority: z.enum(["urgent", "normal", "low"]),
            reason: z.string().describe("Brief description of why this category was chosen (max 10 words)"),
          })
        ),
      }),
      prompt,
    });

    return object.classifications;
  } catch (err) {
    console.error("[Prioritizer] Error in classifyEmailsBatch:", err);
    return emails.map((e) => ({ id: e.id, priority: "normal", reason: "LLM batch failed" }));
  }
}

// Function triggered by the Corsair webhook
export async function classifyAndSaveEmail(tenantId: string, entityId: string, message: any) {
  try {
    console.log(`[Prioritizer] Webhook trigger classification for tenant: ${tenantId}, entityId: ${entityId}`);
    
    // Find the corsair_entity in the database first to get the auto-generated entity ID
    const [entity] = await db
      .select({ id: corsairEntities.id })
      .from(corsairEntities)
      .where(
        and(
          eq(corsairEntities.entityId, entityId),
          eq(corsairEntities.entityType, "threads")
        )
      )
      .limit(1);

    if (!entity) {
      console.warn(`[Prioritizer] Thread entity not found in db for entityId: ${entityId}, skipping classification.`);
      return;
    }

    // Extract headers safely from message
    const from = message.from ?? "";
    const subject = message.subject ?? "";
    const snippet = message.snippet ?? message.body ?? "";

    const baseUserId = tenantId.includes("_") ? tenantId.split("_")[0]! : tenantId;

    // Fetch custom priority rules
    const [settings] = await db
      .select({ priorityInstructions: userSettings.priorityInstructions })
      .from(userSettings)
      .where(eq(userSettings.userId, baseUserId))
      .limit(1);
    
    const customRules = settings?.priorityInstructions;

    const classification = await classifyEmail(from, subject, snippet, customRules);

    // Check if entry already exists in email_priorities
    const [existing] = await db
      .select({ id: emailPriorities.id })
      .from(emailPriorities)
      .where(eq(emailPriorities.emailId, entity.id))
      .limit(1);

    if (existing) {
      await db
        .update(emailPriorities)
        .set({
          priority: classification.priority,
          reason: classification.reason,
          updatedAt: new Date(),
        })
        .where(eq(emailPriorities.id, existing.id));
    } else {
      await db.insert(emailPriorities).values({
        id: crypto.randomUUID(),
        tenantId: baseUserId,
        emailId: entity.id,
        priority: classification.priority,
        reason: classification.reason,
      });
    }

    console.log(`[Prioritizer] Successfully prioritized webhook email: ${classification.priority}`);
  } catch (err) {
    console.error("[Prioritizer] Error in classifyAndSaveEmail:", err);
  }
}

// Function to synchronize all unprioritized emails in the database in batches
export async function syncPriorities(userId: string): Promise<void> {
  if (activeSyncs.has(userId)) {
    console.log(`[Prioritizer] Priority sync already in progress for user: ${userId}, skipping.`);
    return;
  }
  activeSyncs.add(userId);

  try {
    console.log(`[Prioritizer] Checking for unprioritized threads for user: ${userId}`);

    // Fetch custom priority rules
    const [settings] = await db
      .select({ priorityInstructions: userSettings.priorityInstructions })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    const customRules = settings?.priorityInstructions;

    const unprioritized = await db
      .select({
        id: corsairEntities.id,
        entityId: corsairEntities.entityId,
        data: corsairEntities.data,
      })
      .from(corsairEntities)
      .innerJoin(corsairAccounts, eq(corsairEntities.accountId, corsairAccounts.id))
      .leftJoin(emailPriorities, eq(corsairEntities.id, emailPriorities.emailId))
      .where(
        and(
          or(
            eq(corsairAccounts.tenantId, userId),
            like(corsairAccounts.tenantId, `${userId}\\_%`)
          ),
          eq(corsairEntities.entityType, "threads"),
          isNull(emailPriorities.id)
        )
      );

    if (unprioritized.length === 0) {
      console.log(`[Prioritizer] All threads are already prioritized for user: ${userId}`);
      return;
    }

    console.log(`[Prioritizer] Found ${unprioritized.length} unprioritized threads. Starting priority sync...`);

    // Process in batches of 10 to speed up execution significantly and avoid API rate limits
    const batchSize = 10;
    for (let i = 0; i < unprioritized.length; i += batchSize) {
      const batch = unprioritized.slice(i, i + batchSize);
      const emails = batch.map((thread) => {
        const threadData = thread.data as any;
        const messages = threadData.messages ?? [];
        const firstMessage = messages[0] ?? {};
        return {
          id: thread.id,
          from: firstMessage.from ?? "",
          subject: firstMessage.subject ?? threadData.snippet ?? "No Subject",
          snippet: threadData.snippet ?? "",
        };
      });

      console.log(`[Prioritizer] Classifying batch of ${emails.length} emails...`);
      const results = await classifyEmailsBatch(emails, customRules);

      for (const res of results) {
        try {
          const matchedThread = batch.find((t) => t.id === res.id);
          if (!matchedThread) continue;

          await db.insert(emailPriorities).values({
            id: crypto.randomUUID(),
            tenantId: userId,
            emailId: res.id,
            priority: res.priority,
            reason: res.reason,
          });

          console.log(`[Prioritizer] Thread ${res.id} priority set to: ${res.priority}`);
        } catch (err) {
          console.error(`[Prioritizer] Failed to save priority for thread ${res.id}:`, err);
        }
      }

      // Small delay between batches to respect rate limits
      if (i + batchSize < unprioritized.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log(`[Prioritizer] Priority sync complete for user: ${userId}`);
  } catch (err) {
    console.error(`[Prioritizer] Error in syncPriorities:`, err);
  } finally {
    activeSyncs.delete(userId);
  }
}
