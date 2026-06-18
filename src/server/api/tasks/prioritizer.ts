import { db } from "@/server/db";
import { corsairEntities, corsairAccounts, emailPriorities, userSettings, user, corsairIntegrations } from "@/server/db/schema";
import { eq, and, isNull, or, like, desc, inArray } from "drizzle-orm";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";
import { env } from "@/env";
import { corsair } from "@/server/corsair";

function cleanAndParseJSON(text: string): any {
  let clean = text.trim();
  
  // Strip markdown code block wrapping if present
  if (clean.startsWith("```")) {
    const lines = clean.split("\n");
    if (lines[0]?.startsWith("```")) lines.shift();
    if (lines[lines.length - 1]?.startsWith("```")) lines.pop();
    clean = lines.join("\n").trim();
  }
  
  // Find first '{' and last '}'
  const firstBrace = clean.indexOf("{");
  const lastBrace = clean.lastIndexOf("}");
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    clean = clean.substring(firstBrace, lastBrace + 1);
  }
  
  return JSON.parse(clean);
}

function getMessageHeader(msg: any, name: string): string {
  if (!msg) return "";
  if (msg[name.toLowerCase()]) return msg[name.toLowerCase()];
  const headers = msg.payload?.headers ?? [];
  return headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

const deepseek = createOpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: env.DEEPSEEK_API_KEY ?? "",
});

const activeSyncs = new Set<string>();

// Rule-based fallback classifier in case DeepSeek is offline or rate-limited
function fallbackClassify(
  from: string,
  subject: string,
  snippet: string
): { priority: "urgent" | "normal" | "low"; reason: string } {
  const fromLower = from.toLowerCase();
  const subjectLower = subject.toLowerCase();
  const snippetLower = snippet.toLowerCase();

  // 1. Detect low priority indicators (newsletters, receipts, automated notifications)
  if (
    fromLower.includes("noreply") ||
    fromLower.includes("no-reply") ||
    fromLower.includes("do-not-reply") ||
    fromLower.includes("newsletter") ||
    fromLower.includes("promotions") ||
    fromLower.includes("notification") ||
    fromLower.includes("alerts@") ||
    fromLower.includes("info@") ||
    fromLower.includes("bounce") ||
    subjectLower.includes("receipt") ||
    subjectLower.includes("invoice") ||
    subjectLower.includes("newsletter") ||
    subjectLower.includes("digest") ||
    subjectLower.includes("weekly update") ||
    subjectLower.includes("daily update") ||
    snippetLower.includes("unsubscribe") ||
    snippetLower.includes("view in browser")
  ) {
    return { priority: "low", reason: "Automated (Fallback)" };
  }

  // 2. Detect urgent indicators (calendar invitations, direct action request triggers)
  if (
    subjectLower.includes("invitation:") ||
    subjectLower.includes("accepted:") ||
    subjectLower.includes("declined:") ||
    subjectLower.includes("urgent") ||
    subjectLower.includes("action required") ||
    snippetLower.includes("calendar invite")
  ) {
    return { priority: "urgent", reason: "Urgent keywords (Fallback)" };
  }

  // 3. Default to normal
  return { priority: "normal", reason: "" };
}

// Sender interaction score calculator
async function getSenderInteractionStats(userId: string, senderEmail: string) {
  try {
    const cleanEmail = senderEmail.toLowerCase().match(/<([^>]+)>/)?.[1] ?? senderEmail.toLowerCase().trim();
    if (!cleanEmail) return { sentCount: 0, receivedCount: 0, total: 0 };

    const userThreads = await db
      .select({ data: corsairEntities.data })
      .from(corsairEntities)
      .innerJoin(corsairAccounts, eq(corsairEntities.accountId, corsairAccounts.id))
      .where(
        and(
          or(
            eq(corsairAccounts.tenantId, userId),
            like(corsairAccounts.tenantId, `${userId}\\_%`)
          ),
          eq(corsairEntities.entityType, "threads")
        )
      )
      .limit(100);

    let sentCount = 0;
    let receivedCount = 0;

    for (const t of userThreads) {
      const threadData = t.data as any;
      const messages = threadData.messages ?? [];
      for (const m of messages) {
        const fromVal = (m.from ?? "").toLowerCase();
        const toVal = (m.to ?? "").toLowerCase();

        if (fromVal.includes(cleanEmail)) {
          receivedCount++;
        }
        if (toVal.includes(cleanEmail) && !fromVal.includes(cleanEmail)) {
          sentCount++;
        }
      }
    }

    return {
      sentCount,
      receivedCount,
      total: sentCount + receivedCount,
    };
  } catch (err) {
    console.error("[Prioritizer] Error calculating interaction stats:", err);
    return { sentCount: 0, receivedCount: 0, total: 0 };
  }
}

// Few-shot override examples loader
async function getFewShotExamples(userId: string) {
  try {
    const manualExamples = await db
      .select({
        data: corsairEntities.data,
        priority: emailPriorities.priority,
        reason: emailPriorities.reason,
      })
      .from(emailPriorities)
      .innerJoin(corsairEntities, eq(emailPriorities.emailId, corsairEntities.id))
      .where(
        and(
          eq(emailPriorities.tenantId, userId),
          eq(emailPriorities.manuallyUpdated, true)
        )
      )
      .orderBy(desc(emailPriorities.updatedAt))
      .limit(5);

    if (manualExamples.length === 0) return "";

    let fewShotExamplesText = "\nCRITICAL USER PRIORITY CORRECTIONS (FEW-SHOT EXAMPLES):\n" +
      "The user has manually corrected these specific classifications. Strictly mimic their preference for similar emails:\n";

    for (const [idx, ex] of manualExamples.entries()) {
      const threadData = ex.data as any;
      const messages = threadData.messages ?? [];
      const firstMsg = messages[0] ?? {};
      fewShotExamplesText += `Example ${idx + 1}:
Sender: ${firstMsg.from ?? "Unknown"}
Subject: ${firstMsg.subject ?? threadData.snippet ?? "No Subject"}
Snippet: ${threadData.snippet ?? ""}
User Preferred Priority: ${ex.priority.toUpperCase()} (Reason: ${ex.reason ?? "Manual override"})\n---\n`;
    }

    return fewShotExamplesText + "\n";
  } catch (err) {
    console.error("[Prioritizer] Error fetching manual feedback examples:", err);
    return "";
  }
}

// Helper to classify a single email (for webhook trigger)
async function classifyEmail(
  from: string,
  subject: string,
  snippet: string,
  customRules?: string | null,
  username?: string | null,
  userEmail?: string | null,
  fewShotContext?: string,
  interactionContext?: string
): Promise<{ priority: "urgent" | "normal" | "low"; reason: string; detectedDeadline: string | null; isSpam: boolean }> {
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn("[Prioritizer] DEEPSEEK_API_KEY is missing, using local fallback.");
    const fb = fallbackClassify(from, subject, snippet);
    return { priority: fb.priority, reason: fb.reason, detectedDeadline: null, isSpam: false };
  }

  try {
    const prompt = `Classify the following email for prioritization in an inbox.
${username || userEmail ? `User Profile Context (to identify personally addressed emails):
${username ? `- User's Name: ${username}` : ""}
${userEmail ? `- User's Email: ${userEmail}` : ""}
` : ""}
${interactionContext ?? ""}
${fewShotContext ?? ""}
Sender: ${from}
Subject: ${subject}
Snippet/Body: ${snippet}

Categorize into:
- urgent: Needs immediate attention (personal messages, direct questions to the user, calendar invites, time-sensitive work, client requests, managers, or family).
- normal: Normal personal/work emails, notifications requiring action.
- low: Mass newsletters, automated receipts, spam, marketing, automated status updates.

${
  customRules
    ? `CRITICAL USER CUSTOM RULES / INSTRUCTIONS:
You MUST adapt/override the classifications above according to these custom rules specified by the user:
"${customRules}"

Apply these custom rules strictly. If an email matches the user's custom instructions, prioritize it accordingly.`
    : ""
}

SPAM CLASSIFICATION SAFETY INSTRUCTIONS:
- Set 'isSpam' to true ONLY if the email is a highly obvious, unsolicited, malicious, or phishing message.
- Standard receipts, transaction confirmations, clean newsletters, work status updates, or notifications MUST NEVER be marked as spam (mark them as 'low' priority instead).
- If there is any doubt whatsoever, set 'isSpam' to false. Do not send important emails to spam!`;

    const { text } = await generateText({
      model: (deepseek as any).chat("deepseek-v4-pro"),
      prompt: prompt + `\n\nIMPORTANT: You must return a raw JSON object matching this schema, without any markdown formatting or wrapper backticks:
{
  "priority": "urgent" | "normal" | "low",
  "reason": "Brief explanation why this priority was chosen (max 10 words).",
  "detectedDeadline": "ISO 8601 datetime format (YYYY-MM-DDTHH:mm:ssZ) if a specific deadline is mentioned in the email, null otherwise.",
  "isSpam": true | false
}`,
    });

    const parsed = cleanAndParseJSON(text);

    return {
      priority: parsed.priority || "normal",
      reason: parsed.reason || "",
      detectedDeadline: parsed.detectedDeadline || null,
      isSpam: !!parsed.isSpam,
    };
  } catch (err) {
    console.error("[Prioritizer] LLM classification error, using local fallback:", err);
    const fb = fallbackClassify(from, subject, snippet);
    return { priority: fb.priority, reason: fb.reason, detectedDeadline: null, isSpam: false };
  }
}

// Helper to classify multiple emails in a batch (for fast sync)
async function classifyEmailsBatch(
  emails: Array<{ id: string; from: string; subject: string; snippet: string }>,
  customRules?: string | null,
  username?: string | null,
  userEmail?: string | null,
  fewShotContext?: string,
  interactionContexts?: Record<string, string>
): Promise<Array<{ id: string; priority: "urgent" | "normal" | "low"; reason: string; detectedDeadline: string | null; isSpam: boolean }>> {
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn("[Prioritizer] DEEPSEEK_API_KEY is missing, using local fallback.");
    return emails.map((e) => {
      const fb = fallbackClassify(e.from, e.subject, e.snippet);
      return { id: e.id, priority: fb.priority, reason: fb.reason, detectedDeadline: null, isSpam: false };
    });
  }

  try {
    const emailsListFormatted = emails
      .map(
        (e, idx) =>
          `Email ${idx + 1}:
ID: ${e.id}
From: ${e.from}
Subject: ${e.subject}
Snippet: ${e.snippet}
${interactionContexts?.[e.id] ?? ""}`
      )
      .join("\n\n---\n\n");

    const prompt = `You are a highly accurate email inbox prioritizer assistant. Your job is to classify each of the following emails into a priority category ('urgent', 'normal', or 'low') and explain why in a short sentence (max 10 words).

${username || userEmail ? `User Profile Context (to identify personally addressed emails):
${username ? `- User's Name: ${username}` : ""}
${userEmail ? `- User's Email: ${userEmail}` : ""}
` : ""}
${fewShotContext ?? ""}

Standard Categorization Rules:
- 'urgent': Critical personal messages, direct questions to the user, calendar invites, time-sensitive work, client requests, managers, or family.
- 'normal': Work-related emails requiring action, standard personal communication.
- 'low': Newsletters, automated status updates, notifications (e.g. GitHub notifications, Jira logs), receipts, spam, marketing.

${
  customRules
    ? `CRITICAL USER CUSTOM RULES / INSTRUCTIONS:
You MUST adapt/override the standard categorization rules above according to these custom rules specified by the user:
"${customRules}"

Apply these custom rules strictly. If an email matches the user's custom instructions, prioritize it accordingly.`
    : ""
}

SPAM CLASSIFICATION SAFETY INSTRUCTIONS:
- Set 'isSpam' to true ONLY if the email is a highly obvious, unsolicited, malicious, or phishing message.
- Standard receipts, transaction confirmations, clean newsletters, work status updates, or notifications MUST NEVER be marked as spam (mark them as 'low' priority instead).
- If there is any doubt whatsoever, set 'isSpam' to false. Do not send important emails to spam!

Here are the emails to classify:

${emailsListFormatted}

Return a list of classifications matching the exact IDs provided.`;

    const { text } = await generateText({
      model: (deepseek as any).chat("deepseek-v4-pro"),
      prompt: prompt + `\n\nIMPORTANT: You must return a raw JSON object matching this schema, without any markdown formatting or wrapper backticks:
{
  "classifications": [
    {
      "id": "exact email ID string",
      "priority": "urgent" | "normal" | "low",
      "reason": "Brief description of why this category was chosen (max 10 words)",
      "detectedDeadline": "ISO 8601 string or null",
      "isSpam": true | false
    }
  ]
}`,
    });

    const parsed = cleanAndParseJSON(text);
    return parsed.classifications || [];
  } catch (err) {
    console.error("[Prioritizer] Error in classifyEmailsBatch, using local fallback:", err);
    return emails.map((e) => {
      const fb = fallbackClassify(e.from, e.subject, e.snippet);
      return { id: e.id, priority: fb.priority, reason: fb.reason, detectedDeadline: null, isSpam: false };
    });
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
    const from = getMessageHeader(message, "from");
    const subject = getMessageHeader(message, "subject");
    const snippet = message.snippet ?? message.body ?? "";

    const baseUserId = tenantId.includes("_") ? tenantId.split("_")[0]! : tenantId;

    // Fetch custom priority rules, username, and user email context
    const [settings] = await db
      .select({ 
        priorityInstructions: userSettings.priorityInstructions,
        username: userSettings.username
      })
      .from(userSettings)
      .where(eq(userSettings.userId, baseUserId))
      .limit(1);

    const [dbUser] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, baseUserId))
      .limit(1);
    
    const customRules = settings?.priorityInstructions;
    const username = settings?.username;
    const userEmail = dbUser?.email;

    // Fetch manual few-shot context
    const fewShotContext = await getFewShotExamples(baseUserId);

    // Fetch interaction stats for the sender
    const stats = await getSenderInteractionStats(baseUserId, from);
    const interactionContext = `Sender Relationship Context:
- Emails sent to this sender: ${stats.sentCount}
- Emails received from this sender: ${stats.receivedCount}
- Average Communication Frequency: ${stats.total > 20 ? 'HIGH' : stats.total > 5 ? 'MEDIUM' : 'LOW'}`;

    // Programmatic safety safeguards
    const cleanFrom = from.toLowerCase().match(/<([^>]+)>/)?.[1] ?? from.toLowerCase().trim();
    const cleanUserEmail = userEmail?.toLowerCase() ?? "";
    const userDomain = cleanUserEmail.split("@")[1];
    const senderDomain = cleanFrom.split("@")[1];
    const hasHistory = stats.total > 0;
    const isSameDomain = !!(userDomain && senderDomain && userDomain === senderDomain);

    const classification = await classifyEmail(
      from,
      subject,
      snippet,
      customRules,
      username,
      userEmail,
      fewShotContext,
      interactionContext
    );

    let isSpam = classification.isSpam;
    if (hasHistory || isSameDomain) {
      isSpam = false;
    }

    // Move to spam in Gmail if detected
    if (isSpam) {
      try {
        console.log(`[Prioritizer] Thread ${entityId} classified as SPAM. Moving to spam folder...`);
        const tenant = corsair.withTenant(tenantId);
        await tenant.gmail.api.threads.modify({
          id: entityId,
          addLabelIds: ["SPAM"],
          removeLabelIds: ["INBOX"],
        });
      } catch (apiErr) {
        console.error(`[Prioritizer] Failed to move thread ${entityId} to spam in Gmail:`, apiErr);
      }
    }

    // Check if entry already exists in email_priorities
    const [existing] = await db
      .select({ id: emailPriorities.id })
      .from(emailPriorities)
      .where(eq(emailPriorities.emailId, entity.id))
      .limit(1);

    const detectedDeadlineDate = classification.detectedDeadline ? new Date(classification.detectedDeadline) : null;
    const parsedDeadline = detectedDeadlineDate && !isNaN(detectedDeadlineDate.getTime()) ? detectedDeadlineDate : null;

    if (existing) {
      await db
        .update(emailPriorities)
        .set({
          priority: isSpam ? "low" : classification.priority,
          reason: isSpam ? "Filtered as Spam" : classification.reason,
          detectedDeadline: parsedDeadline,
          isSpam: isSpam,
          updatedAt: new Date(),
        })
        .where(eq(emailPriorities.id, existing.id));
    } else {
      await db.insert(emailPriorities).values({
        id: crypto.randomUUID(),
        tenantId: baseUserId,
        emailId: entity.id,
        priority: isSpam ? "low" : classification.priority,
        reason: isSpam ? "Filtered as Spam" : classification.reason,
        detectedDeadline: parsedDeadline,
        isSpam: isSpam,
      });
    }

    console.log(`[Prioritizer] Successfully prioritized webhook email: ${isSpam ? "low (spam)" : classification.priority}`);
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
    console.log(`[Prioritizer] Running priority sync for user: ${userId}`);

    // Learn user workspace habits in the background
    void learnUserHabits(userId).catch((err) => {
      console.error("Failed to learn user habits:", err);
    });

    // 1. Auto-elevate deadlines occurring within the next 12 hours
    const now = new Date();
    const twelveHoursFromNow = new Date(now.getTime() + 12 * 60 * 60 * 1000);

    const approachingDeadlines = await db
      .select({
        id: emailPriorities.id,
        detectedDeadline: emailPriorities.detectedDeadline,
        priority: emailPriorities.priority,
      })
      .from(emailPriorities)
      .where(
        and(
          eq(emailPriorities.tenantId, userId),
          or(
            eq(emailPriorities.priority, "normal"),
            eq(emailPriorities.priority, "low")
          ),
          eq(emailPriorities.manuallyUpdated, false) // don't override manual adjustments
        )
      );

    const filtered = approachingDeadlines.filter((ep) => {
      if (!ep.detectedDeadline) return false;
      const dl = new Date(ep.detectedDeadline);
      return dl > now && dl <= twelveHoursFromNow;
    });

    for (const ep of filtered) {
      const timeLeftMin = Math.round(
        (new Date(ep.detectedDeadline!).getTime() - now.getTime()) / 60000
      );
      const timeLeftStr =
        timeLeftMin >= 60
          ? `${Math.round(timeLeftMin / 60)}h`
          : `${timeLeftMin}m`;

      await db
        .update(emailPriorities)
        .set({
          priority: "urgent",
          reason: `Approaching deadline (${timeLeftStr} left)`,
          updatedAt: new Date(),
        })
        .where(eq(emailPriorities.id, ep.id));
      console.log(`[Prioritizer] Auto-elevated thread ${ep.id} due to deadline in ${timeLeftStr}`);
    }

    // 2. Fetch custom rules, username, and user email context
    const [settings] = await db
      .select({ 
        priorityInstructions: userSettings.priorityInstructions,
        username: userSettings.username
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    const [dbUser] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    const customRules = settings?.priorityInstructions;
    const username = settings?.username;
    const userEmail = dbUser?.email;

    // Fetch manual corrections examples for context
    const fewShotContext = await getFewShotExamples(userId);

    // Fetch unprioritized threads
    const unprioritized = await db
      .select({
        id: corsairEntities.id,
        entityId: corsairEntities.entityId,
        data: corsairEntities.data,
        accountId: corsairEntities.accountId,
        tenantId: corsairAccounts.tenantId,
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
      
      const interactionContexts: Record<string, string> = {};
      const emails = [];

      for (const thread of batch) {
        const threadData = thread.data as any;
        const messages = threadData.messages ?? [];
        const firstMessage = messages[0] ?? {};
        const fromEmail = getMessageHeader(firstMessage, "from");
        
        const stats = await getSenderInteractionStats(userId, fromEmail);
        const statsStr = `Sender Relationship Context:
- Emails sent to this sender: ${stats.sentCount}
- Emails received from this sender: ${stats.receivedCount}
- Average Communication Frequency: ${stats.total > 20 ? 'HIGH' : stats.total > 5 ? 'MEDIUM' : 'LOW'}`;
        
        interactionContexts[thread.id] = statsStr;

        emails.push({
          id: thread.id,
          from: fromEmail,
          subject: getMessageHeader(firstMessage, "subject") || threadData.snippet || "No Subject",
          snippet: threadData.snippet ?? "",
        });
      }

      console.log(`[Prioritizer] Classifying batch of ${emails.length} emails...`);
      const results = await classifyEmailsBatch(
        emails,
        customRules,
        username,
        userEmail,
        fewShotContext,
        interactionContexts
      );

      for (const res of results) {
        try {
          const matchedThread = batch.find((t) => t.id === res.id);
          if (!matchedThread) continue;

          // Safe guards check
          const threadData = matchedThread.data as any;
          const messages = threadData.messages ?? [];
          const firstMessage = messages[0] ?? {};
          const fromEmail = firstMessage.from ?? "";

          const stats = await getSenderInteractionStats(userId, fromEmail);
          const cleanFrom = fromEmail.toLowerCase().match(/<([^>]+)>/)?.[1] ?? fromEmail.toLowerCase().trim();
          const cleanUserEmail = userEmail?.toLowerCase() ?? "";
          const userDomain = cleanUserEmail.split("@")[1];
          const senderDomain = cleanFrom.split("@")[1];
          const hasHistory = stats.total > 0;
          const isSameDomain = !!(userDomain && senderDomain && userDomain === senderDomain);

          let isSpam = res.isSpam;
          if (hasHistory || isSameDomain) {
            isSpam = false;
          }

          // Move to spam in Gmail if detected
          if (isSpam) {
            try {
              console.log(`[Prioritizer] Batch thread ${matchedThread.entityId} classified as SPAM. Moving to spam folder...`);
              const tenant = corsair.withTenant(matchedThread.tenantId);
              await tenant.gmail.api.threads.modify({
                id: matchedThread.entityId,
                addLabelIds: ["SPAM"],
                removeLabelIds: ["INBOX"],
              });
            } catch (apiErr) {
              console.error(`[Prioritizer] Failed to move batch thread ${matchedThread.entityId} to spam in Gmail:`, apiErr);
            }
          }

          const detectedDeadlineDate = res.detectedDeadline ? new Date(res.detectedDeadline) : null;
          const parsedDeadline = detectedDeadlineDate && !isNaN(detectedDeadlineDate.getTime()) ? detectedDeadlineDate : null;

          await db.insert(emailPriorities).values({
            id: crypto.randomUUID(),
            tenantId: userId,
            emailId: res.id,
            priority: isSpam ? "low" : res.priority,
            reason: isSpam ? "Filtered as Spam" : res.reason,
            detectedDeadline: parsedDeadline,
            isSpam: isSpam,
          });

          console.log(`[Prioritizer] Thread ${res.id} priority set to: ${isSpam ? 'low (spam)' : res.priority}`);
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

// Function to analyze the user's sent/received messages and learn their workspace habits
export async function learnUserHabits(userId: string): Promise<string> {
  try {
    const [dbUser] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    const userEmail = dbUser?.email?.toLowerCase();

    const userThreads = await db
      .select({ data: corsairEntities.data })
      .from(corsairEntities)
      .innerJoin(corsairAccounts, eq(corsairEntities.accountId, corsairAccounts.id))
      .where(
        and(
          or(
            eq(corsairAccounts.tenantId, userId),
            like(corsairAccounts.tenantId, `${userId}\\_%`)
          ),
          eq(corsairEntities.entityType, "threads")
        )
      )
      .limit(50); // Scan up to 50 threads

    if (userThreads.length === 0) {
      return "No emails found to learn habits.";
    }

    let totalRepliesLength = 0;
    let repliesCount = 0;
    
    // Greeting styles
    let greetingCasual = 0;
    let greetingFormal = 0;
    let greetingDirect = 0;

    // Sign-off styles
    let signoffAppreciative = 0;
    let signoffProfessional = 0;
    let signoffCasual = 0;
    let signoffDirect = 0;

    // Punctuation for tone
    let sentEmailsCount = 0;
    let totalExclamations = 0;
    let totalQuestions = 0;

    // Formatting preference
    let bulletFormatCount = 0;

    // Day of week
    const dayCounts = new Array(7).fill(0);
    const hourCounts = new Array(24).fill(0);
    const recipientCounts: Record<string, number> = {};

    // Response delays
    const replyDelaysMs: number[] = [];

    for (const t of userThreads) {
      const threadData = t.data as any;
      const messages = (threadData.messages ?? []) as any[];
      
      // Sort messages in thread chronologically to calculate response delay
      const sortedMessages = [...messages].sort((a, b) => {
        const aTime = a.internalDate ? Number(a.internalDate) : 0;
        const bTime = b.internalDate ? Number(b.internalDate) : 0;
        return aTime - bTime;
      });

      for (let i = 0; i < sortedMessages.length; i++) {
        const m = sortedMessages[i]!;
        const fromVal = (m.from ?? "").toLowerCase();
        const toVal = (m.to ?? "").toLowerCase();
        
        const cleanFrom = fromVal.match(/<([^>]+)>/)?.[1] ?? fromVal.trim();
        const cleanTo = toVal.match(/<([^>]+)>/)?.[1] ?? toVal.trim();
        
        const isFromUser = userEmail && cleanFrom === userEmail;

        const msgDate = m.internalDate ? new Date(Number(m.internalDate)) : null;
        if (msgDate && !isNaN(msgDate.getTime())) {
          const hour = msgDate.getHours();
          hourCounts[hour]++;
          const day = msgDate.getDay();
          dayCounts[day]++;
        }

        if (cleanTo && cleanTo.includes("@") && cleanTo !== userEmail) {
          recipientCounts[cleanTo] = (recipientCounts[cleanTo] ?? 0) + 1;
        }

        const bodyText = m.snippet ?? m.body ?? "";

        // Analyze user sent messages for writing habits
        if (isFromUser && bodyText.length > 0) {
          sentEmailsCount++;
          totalRepliesLength += bodyText.length;
          repliesCount++;

          const trimmedBody = bodyText.trim();

          // 1. Analyze Greeting Style
          if (/^(dear)\b/i.test(trimmedBody)) {
            greetingFormal++;
          } else if (/^(hi|hello|hey|g'day|morning|afternoon)\b/i.test(trimmedBody)) {
            greetingCasual++;
          } else {
            greetingDirect++;
          }

          // 2. Analyze Sign-off Style
          const lastChunk = trimmedBody.slice(-100);
          if (/sincerely|regards|respectfully|best wishes/i.test(lastChunk)) {
            signoffProfessional++;
          } else if (/thanks|thank you|appreciate|thx/i.test(lastChunk)) {
            signoffAppreciative++;
          } else if (/cheers|best|warmly|talk soon/i.test(lastChunk)) {
            signoffCasual++;
          } else {
            signoffDirect++;
          }

          // 3. Tone checks
          totalExclamations += (bodyText.match(/!/g) || []).length;
          totalQuestions += (bodyText.match(/\?/g) || []).length;

          // 4. Formatting Preference
          if (
            bodyText.includes("\n- ") || 
            bodyText.includes("\n* ") || 
            bodyText.includes("\n1. ") || 
            bodyText.includes("<li>")
          ) {
            bulletFormatCount++;
          }
        }

        // 5. Calculate Response Delay (if message i is from others, and message i+1 is from user)
        if (i < sortedMessages.length - 1) {
          const nextMsg = sortedMessages[i + 1]!;
          const nextFromVal = (nextMsg.from ?? "").toLowerCase();
          const nextCleanFrom = nextFromVal.match(/<([^>]+)>/)?.[1] ?? nextFromVal.trim();
          const nextIsFromUser = userEmail && nextCleanFrom === userEmail;

          if (!isFromUser && nextIsFromUser) {
            const currentMs = m.internalDate ? Number(m.internalDate) : 0;
            const nextMs = nextMsg.internalDate ? Number(nextMsg.internalDate) : 0;
            if (currentMs > 0 && nextMs > 0 && nextMs >= currentMs) {
              const diff = nextMs - currentMs;
              // Ignore replies taking more than 7 days (usually a different conversation context)
              if (diff < 7 * 24 * 60 * 60 * 1000) {
                replyDelaysMs.push(diff);
              }
            }
          }
        }
      }
    }

    // Determine writing style preference
    const avgLen = repliesCount > 0 ? Math.round(totalRepliesLength / repliesCount) : 0;
    const stylePreference = avgLen > 300 ? "Detailed & Comprehensive" : avgLen > 100 ? "Moderate & Direct" : "Highly Concise & Brief";

    // Determine Greeting Style
    let greetingStyle = "Direct (No Greeting)";
    if (greetingCasual >= greetingFormal && greetingCasual > greetingDirect) {
      greetingStyle = "Casual (Hi/Hello)";
    } else if (greetingFormal > greetingCasual && greetingFormal > greetingDirect) {
      greetingStyle = "Formal (Dear)";
    }

    // Determine Sign-off Style
    let signoffStyle = "Direct/None";
    const maxSignoff = Math.max(signoffAppreciative, signoffProfessional, signoffCasual, signoffDirect);
    if (maxSignoff > 0) {
      if (maxSignoff === signoffAppreciative) signoffStyle = "Appreciative (Thanks)";
      else if (maxSignoff === signoffProfessional) signoffStyle = "Professional (Regards)";
      else if (maxSignoff === signoffCasual) signoffStyle = "Casual (Cheers)";
    }

    // Determine Formatting Preference
    const formatPreference = (sentEmailsCount > 0 && (bulletFormatCount / sentEmailsCount) > 0.2)
      ? "Bulleted/Structured lists"
      : "Block paragraphs";

    // Determine Tone
    let tonePreference = "Neutral & Professional";
    if (sentEmailsCount > 0) {
      const avgExclamations = totalExclamations / sentEmailsCount;
      const avgQuestions = totalQuestions / sentEmailsCount;
      if (avgExclamations > 0.5) tonePreference = "Enthusiastic & Friendly";
      else if (avgQuestions > 1.0) tonePreference = "Inquisitive & Follow-up oriented";
    }

    // Peak active hour
    let peakHour = 9;
    let maxHourCount = 0;
    for (let h = 0; h < 24; h++) {
      if (hourCounts[h] > maxHourCount) {
        maxHourCount = hourCounts[h];
        peakHour = h;
      }
    }
    const peakHourStart = peakHour;
    const peakHourEnd = (peakHour + 4) % 24;
    const peakHoursStr = `${String(peakHourStart).padStart(2, "0")}:00 - ${String(peakHourEnd).padStart(2, "0")}:00`;

    // Peak active days
    let weekdayCount = 0;
    let weekendCount = 0;
    for (let d = 0; d < 7; d++) {
      if (d === 0 || d === 6) {
        weekendCount += dayCounts[d];
      } else {
        weekdayCount += dayCounts[d];
      }
    }
    const totalDayCount = weekdayCount + weekendCount;
    const peakDaysStr = (totalDayCount > 0 && (weekendCount / totalDayCount) > 0.2)
      ? "Active Weekends (Sat-Sun)"
      : "Weekday Focused (Mon-Fri)";

    // Primary Collaborators
    const sortedRecipients = Object.entries(recipientCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([email]) => email);

    // Reply speed
    let replySpeedStr = "Same day / Under 24h";
    if (replyDelaysMs.length > 0) {
      const avgDelayMs = replyDelaysMs.reduce((a, b) => a + b, 0) / replyDelaysMs.length;
      if (avgDelayMs < 15 * 60 * 1000) {
        replySpeedStr = "Under 15 minutes";
      } else if (avgDelayMs < 60 * 60 * 1000) {
        replySpeedStr = "Under 1 hour";
      } else if (avgDelayMs < 4 * 60 * 60 * 1000) {
        replySpeedStr = "Within 1-4 hours";
      } else if (avgDelayMs < 24 * 60 * 60 * 1000) {
        replySpeedStr = "Same day / Under 24h";
      } else {
        replySpeedStr = "Next business day / 24h+";
      }
    }

    // Calendar habits query
    let calendarDurationStr = "30 minutes (Default)";
    let calendarPeakTimeStr = "Morning (Default)";

    try {
      const calendarEvents = await db
        .select({ data: corsairEntities.data })
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
        .limit(50);

      if (calendarEvents.length > 0) {
        let totalDurationMin = 0;
        let validDurationCount = 0;
        
        let calMorningCount = 0;
        let calAfternoonCount = 0;
        let calEveningCount = 0;

        for (const e of calendarEvents) {
          const eventData = e.data as any;
          const startStr = eventData.start?.dateTime ?? eventData.start?.date;
          const endStr = eventData.end?.dateTime ?? eventData.end?.date;

          if (startStr && endStr) {
            const startTime = new Date(startStr);
            const endTime = new Date(endStr);
            
            if (!isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
              const diffMin = (endTime.getTime() - startTime.getTime()) / 60000;
              // Filter out all-day events (diffMin >= 1440) or invalid durations
              if (diffMin > 0 && diffMin < 1440) {
                totalDurationMin += diffMin;
                validDurationCount++;
              }

              const startHour = startTime.getHours();
              if (startHour >= 9 && startHour < 12) {
                calMorningCount++;
              } else if (startHour >= 12 && startHour < 17) {
                calAfternoonCount++;
              } else if (startHour >= 17 && startHour < 21) {
                calEveningCount++;
              }
            }
          }
        }

        if (validDurationCount > 0) {
          const avgDuration = totalDurationMin / validDurationCount;
          if (avgDuration < 25) {
            calendarDurationStr = "15-20 minutes";
          } else if (avgDuration < 40) {
            calendarDurationStr = "30 minutes";
          } else if (avgDuration < 55) {
            calendarDurationStr = "45 minutes";
          } else if (avgDuration < 75) {
            calendarDurationStr = "60 minutes";
          } else {
            calendarDurationStr = `${Math.round(avgDuration / 10) * 10} minutes`;
          }
        } else {
          calendarDurationStr = "30 minutes";
        }

        const maxCalTime = Math.max(calMorningCount, calAfternoonCount, calEveningCount);
        if (maxCalTime > 0) {
          if (maxCalTime === calMorningCount) calendarPeakTimeStr = "Morning (9 AM - 12 PM)";
          else if (maxCalTime === calAfternoonCount) calendarPeakTimeStr = "Afternoon (12 PM - 5 PM)";
          else calendarPeakTimeStr = "Evening (5 PM - 9 PM)";
        } else {
          calendarPeakTimeStr = "Morning (9 AM - 12 PM)";
        }
      } else {
        calendarDurationStr = "No Calendar Sync";
        calendarPeakTimeStr = "No Calendar Sync";
      }
    } catch (calErr) {
      console.error("[Prioritizer] Error calculating calendar habits:", calErr);
      calendarDurationStr = "No Calendar Sync";
      calendarPeakTimeStr = "No Calendar Sync";
    }

    const habitsList = [
      `Writing Style: ${stylePreference} (Average email length: ${avgLen} chars)`,
      `Email Tone: ${tonePreference}`,
      `Greeting Style: ${greetingStyle}`,
      `Sign-off Style: ${signoffStyle}`,
      `Formatting Preference: ${formatPreference}`,
      `Peak Active Hours: ${peakHoursStr}`,
      `Peak Activity Days: ${peakDaysStr}`,
      sortedRecipients.length > 0 ? `Primary Collaborators: ${sortedRecipients.join(", ")}` : null,
      `Average Reply Speed: ${replySpeedStr}`,
      `Preferred Meeting Duration: ${calendarDurationStr}`,
      `Peak Meeting Time: ${calendarPeakTimeStr}`,
      `AI Auto-adaptation: Enabled & Learning`
    ].filter(Boolean).join("\n");

    await db
      .update(userSettings)
      .set({ learntHabits: habitsList, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId));

    console.log(`[Prioritizer] Successfully updated learned habits for user ${userId}:\n${habitsList}`);
    return habitsList;
  } catch (err) {
    console.error("[Prioritizer] Error in learnUserHabits:", err);
    return "Error learning habits.";
  }
}

export function isSyncingPriorities(userId: string): boolean {
  return activeSyncs.has(userId);
}
