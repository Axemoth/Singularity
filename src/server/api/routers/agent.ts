import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { Agent } from "@mastra/core/agent";
import { google } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { env } from "@/env";
import { MastraProvider } from "@corsair-dev/mcp";
import { corsair } from "@/server/corsair";
import { createTool } from "@mastra/core/tools";
import { buildRawEmail } from "./gmail";
import { TRPCError } from "@trpc/server";
import { corsairEntities, corsairAccounts, corsairIntegrations } from "@/server/db/schema";
import { eq, and, or, like, inArray } from "drizzle-orm";

const deepseek = createOpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: env.DEEPSEEK_API_KEY ?? "",
});

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const agentContextSchema = z
  .object({
    route: z.string().optional(),
    selectedThreadId: z.string().optional(),
    selectedEventId: z.string().optional(),
    selectedEntityIds: z.array(z.string()).optional(),
    targetEmail: z.string().optional(),
  })
  .optional();

const agentActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("open_route"),
    label: z.string(),
    href: z.string(),
  }),
  z.object({
    type: z.literal("refresh_inbox"),
    label: z.string(),
  }),
  z.object({
    type: z.literal("refresh_calendar"),
    label: z.string(),
  }),
  z.object({
    type: z.literal("show_draft"),
    label: z.string(),
    payload: z.object({
      to: z.string().optional(),
      subject: z.string().optional(),
      body: z.string(),
    }),
  }),
  z.object({
    type: z.literal("confirm_archive_threads"),
    label: z.string(),
    threadIds: z.array(z.string().trim().min(1)).min(1).max(50),
  }),
  z.object({
    type: z.literal("confirm_delete_threads"),
    label: z.string(),
    threadIds: z.array(z.string().trim().min(1)).min(1).max(50),
  }),
]);

type AgentContext = z.infer<typeof agentContextSchema>;
type AgentAction = z.infer<typeof agentActionSchema>;

function buildContextPrompt(context: AgentContext) {
  if (!context) return "";

  return [
    context.route ? `Current frontend route: ${context.route}` : null,
    context.selectedThreadId
      ? `Selected Gmail thread: ${context.selectedThreadId}`
      : null,
    context.selectedEventId
      ? `Selected calendar event: ${context.selectedEventId}`
      : null,
    context.selectedEntityIds?.length
      ? `Selected entities: ${context.selectedEntityIds.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function inferFrontendActions(
  message: string,
  context: AgentContext,
): AgentAction[] {
  const normalized = message.toLowerCase();
  const actions: AgentAction[] = [];
  const selectedIds = context?.selectedEntityIds ?? [];

  if (/\b(inbox|email|mail)\b/.test(normalized)) {
    actions.push({
      type: "open_route",
      label: "Open inbox",
      href: "/inbox",
    });
  }

  if (/\b(calendar|schedule|meeting|event)\b/.test(normalized)) {
    actions.push({
      type: "open_route",
      label: "Open calendar",
      href: "/calendar",
    });
  }

  if (/\b(refresh|sync|reload|update)\b/.test(normalized)) {
    if (context?.route?.includes("calendar")) {
      actions.push({ type: "refresh_calendar", label: "Refresh calendar" });
    } else {
      actions.push({ type: "refresh_inbox", label: "Refresh inbox" });
    }
  }

  if (selectedIds.length > 0 && /\barchive\b/.test(normalized)) {
    actions.push({
      type: "confirm_archive_threads",
      label:
        selectedIds.length === 1
          ? "Archive selected thread"
          : `Archive ${selectedIds.length} selected threads`,
      threadIds: selectedIds,
    });
  }

  if (selectedIds.length > 0 && /\b(delete|trash|remove)\b/.test(normalized)) {
    actions.push({
      type: "confirm_delete_threads",
      label:
        selectedIds.length === 1
          ? "Delete selected thread"
          : `Delete ${selectedIds.length} selected threads`,
      threadIds: selectedIds,
    });
  }

  if (/\b(draft|reply|compose|write)\b/.test(normalized)) {
    actions.push({
      type: "show_draft",
      label: "Open draft preview",
      payload: {
        subject: "Draft from agent request",
        body: "I can turn this into a compose modal once the compose workflow is built. For now, use the assistant response above as the draft source.",
      },
    });
  }

  return actions.slice(0, 4);
}

export const agentRouter = createTRPCRouter({
  chat: protectedProcedure
    .input(
      z.object({
        message: z.string().min(1),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant", "system"]),
              content: z.string(),
              reasoning: z.string().optional(),
            }),
          )
          .optional(),
        context: agentContextSchema,
        reasoningEnabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const userEmail = ctx.session.user.email;

      try {
        const { userSettings, corsairAccounts, corsairIntegrations, copilotUsage } = await import("@/server/db/schema");
        const { eq, and, or, like, sql } = await import("drizzle-orm");
        const { isPremiumUser } = await import("@/server/subscription");

        // 1. Enforce daily rate limit of 20 requests for Free tier users
        const isPremium = await isPremiumUser(userEmail);
        if (!isPremium) {
          const d = new Date();
          const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

          const [usage] = await ctx.db
            .select()
            .from(copilotUsage)
            .where(eq(copilotUsage.userId, userId))
            .limit(1);

          if (!usage) {
            await ctx.db.insert(copilotUsage).values({
              userId,
              requestCount: 1,
              lastRequestDate: todayStr,
              updatedAt: new Date(),
            });
          } else if (usage.lastRequestDate !== todayStr) {
            await ctx.db
              .update(copilotUsage)
              .set({
                requestCount: 1,
                lastRequestDate: todayStr,
                updatedAt: new Date(),
              })
              .where(eq(copilotUsage.userId, userId));
          } else {
            if (usage.requestCount >= 20) {
              throw new TRPCError({
                code: "FORBIDDEN",
                message: "Daily Copilot limit reached. Free tier is limited to 20 requests per day. Upgrade to Premium for unlimited Copilot requests.",
              });
            }
            await ctx.db
              .update(copilotUsage)
              .set({
                requestCount: usage.requestCount + 1,
                updatedAt: new Date(),
              })
              .where(eq(copilotUsage.userId, userId));
          }
        }

        const [settings] = await ctx.db
          .select({ modelMode: userSettings.modelMode })
          .from(userSettings)
          .where(eq(userSettings.userId, userId))
          .limit(1);
        const modelMode = settings?.modelMode ?? "careful";

        // Query all connected Gmail accounts for this user
        const gmailAccounts = await ctx.db
          .select({
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
              eq(corsairIntegrations.name, "gmail")
            )
          )
          .orderBy(corsairAccounts.createdAt);

        const primaryGmailTenantId = gmailAccounts[0]?.tenantId ?? userId;
        let activeGmailTenantId = primaryGmailTenantId;
        if (input.context?.targetEmail) {
          const matched = gmailAccounts.find(
            (a) => a.emailAddress?.toLowerCase() === input.context?.targetEmail?.toLowerCase()
          );
          if (matched) {
            activeGmailTenantId = matched.tenantId;
          }
        }

        let didExecuteWriteTool = false;
        const provider = new MastraProvider();
        const toolsList = await provider.build({ corsair: corsair.withTenant(activeGmailTenantId) });

        const wrappedMcpTools = Object.fromEntries(
          toolsList.map((t) => {
            const originalExecute = t.execute;
            return [
              t.id,
              {
                ...t,
                execute: async (args: any, context: any) => {
                  const idLower = t.id.toLowerCase();
                  const isWriteOp = 
                    idLower.includes("insert") || 
                    idLower.includes("create") || 
                    idLower.includes("delete") || 
                    idLower.includes("update") || 
                    idLower.includes("send") || 
                    idLower.includes("patch") || 
                    idLower.includes("post");
                  if (isWriteOp) {
                    console.log(`[mcp tool] Detected write operation for tool: ${t.id}, flagging to prevent fallback retry.`);
                    didExecuteWriteTool = true;
                  }
                  return originalExecute ? originalExecute(args, context) : undefined;
                }
              }
            ];
          })
        );

        const sendEmailTool = createTool({
          id: "send_email",
          description: "Send an email to a recipient with a subject and body using Gmail.",
          inputSchema: z.object({
            to: z.string().email().describe("Recipient email address"),
            subject: z.string().describe("Subject line of the email"),
            body: z.string().describe("Body content of the email (HTML or plain text)"),
            fromEmail: z.string().optional().describe("Sender email address (choose one of the user's connected emails)"),
          }),
          execute: async ({ to, subject, body, fromEmail }) => {
            console.log(`[send_email tool] Sending email to ${to} via tenant ${userId}...`);
            didExecuteWriteTool = true;
            
            let targetTenantId = activeGmailTenantId;
            if (fromEmail) {
              const matched = gmailAccounts.find(a => a.emailAddress?.toLowerCase() === fromEmail.toLowerCase());
              if (matched) targetTenantId = matched.tenantId;
            }

            const tenant = corsair.withTenant(targetTenantId);
            const raw = buildRawEmail(to, subject, body);
            const res = await tenant.gmail.api.messages.send({ raw });
            return res;
          },
        });

        const createDraftTool = createTool({
          id: "create_draft",
          description: "Create a draft email in Gmail with recipient, subject, and body.",
          inputSchema: z.object({
            to: z.string().email().optional().describe("Recipient email address"),
            subject: z.string().optional().describe("Subject line of the email"),
            body: z.string().describe("Body content of the email (HTML or plain text)"),
            fromEmail: z.string().optional().describe("Sender email address (choose one of the user's connected emails)"),
          }),
          execute: async ({ to, subject, body, fromEmail }) => {
            console.log(`[create_draft tool] Creating draft for ${to} via tenant ${userId}...`);
            didExecuteWriteTool = true;

            let targetTenantId = activeGmailTenantId;
            if (fromEmail) {
              const matched = gmailAccounts.find(a => a.emailAddress?.toLowerCase() === fromEmail.toLowerCase());
              if (matched) targetTenantId = matched.tenantId;
            }

            const tenant = corsair.withTenant(targetTenantId);
            const raw = buildRawEmail(to ?? "", subject ?? "", body);
            const res = await tenant.gmail.api.drafts.create({
              draft: {
                message: { raw },
              },
            });
            return res;
          },
        });

        const searchLocalTool = createTool({
          id: "search_local",
          description: "Search local cached emails and calendar events semantically using vector search. Fast (<1s) and works entirely offline.",
          inputSchema: z.object({
            query: z.string().describe("The search query in natural language (e.g., 'SRMIST emails' or 'meeting next week')"),
          }),
          execute: async ({ query }) => {
            console.log(`[search_local tool] Semantic search for: "${query}" via tenant ${userId}...`);
            
            try {
              // 1. Trigger syncEmbeddings to ensure any newly cached items are embedded
              const { syncEmbeddings } = await import("@/server/api/tasks/embeddings");
              await syncEmbeddings(userId).catch((err) => {
                console.error("[search_local] Background embedding sync failed:", err);
              });

              // 2. Generate the embedding for the query
              const { generateEmbedding } = await import("@/server/api/tasks/embeddings");
              const queryEmbedding = await generateEmbedding(query);
              const queryEmbeddingStr = `[${queryEmbedding.join(",")}]`;
              
              // 2. Perform vector search in postgres
              const { corsairEmbeddings, corsairEntities, corsairAccounts } = await import("@/server/db/schema");
              const { sql, eq, and, or, like } = await import("drizzle-orm");

              // We select the top 5 most similar matches, order by cosine distance
              const results = await ctx.db
                .select({
                  id: corsairEntities.id,
                  entityId: corsairEntities.entityId,
                  entityType: corsairEntities.entityType,
                  data: corsairEntities.data,
                  text: corsairEmbeddings.text,
                  similarity: sql<number>`1 - (${corsairEmbeddings.embedding} <=> ${queryEmbeddingStr}::vector)`.as('similarity'),
                })
                .from(corsairEmbeddings)
                .innerJoin(corsairEntities, eq(corsairEmbeddings.entityId, corsairEntities.id))
                .innerJoin(corsairAccounts, eq(corsairEntities.accountId, corsairAccounts.id))
                .where(
                  and(
                    or(
                      eq(corsairAccounts.tenantId, userId),
                      like(corsairAccounts.tenantId, `${userId}\\_%`)
                    )
                  )
                )
                .orderBy(sql`${corsairEmbeddings.embedding} <=> ${queryEmbeddingStr}::vector`)
                .limit(5);

              interface SearchGmailMessagePayload {
                subject?: string;
                from?: string;
                to?: string;
                body?: string;
                snippet?: string;
                internalDate?: string;
              }

              interface SearchGmailThreadPayload {
                snippet?: string;
                messages?: SearchGmailMessagePayload[];
              }

              interface SearchCalendarEventPayload {
                summary?: string;
                description?: string;
                location?: string;
                start?: { dateTime?: string; date?: string };
                end?: { dateTime?: string; date?: string };
              }

              return results.map(r => {
                if (r.entityType === "threads") {
                  const threadData = r.data as SearchGmailThreadPayload;
                  return {
                    id: r.id,
                    entityId: r.entityId,
                    entityType: r.entityType,
                    similarity: r.similarity,
                    details: {
                      subject: threadData.messages?.[0]?.subject ?? threadData.snippet ?? "No Subject",
                      snippet: threadData.snippet ?? "",
                      from: threadData.messages?.[0]?.from ?? "",
                      date: threadData.messages?.[0]?.internalDate ?? "",
                    }
                  };
                } else {
                  const eventData = r.data as SearchCalendarEventPayload;
                  return {
                    id: r.id,
                    entityId: r.entityId,
                    entityType: r.entityType,
                    similarity: r.similarity,
                    details: {
                      summary: eventData.summary ?? "",
                      description: eventData.description ?? "",
                      location: eventData.location ?? "",
                      start: eventData.start?.dateTime ?? eventData.start?.date ?? "",
                      end: eventData.end?.dateTime ?? eventData.end?.date ?? "",
                    }
                  };
                }
              });
            } catch (err: unknown) {
              const errMsg = err instanceof Error ? err.message : String(err);
              console.error("Local semantic search failed:", err);
              return { error: `Failed to search: ${errMsg}` };
            }
          },
        });

        const searchContactsTool = createTool({
          id: "search_contacts",
          description: "Search for contacts (name and email) in the local cache to resolve email addresses.",
          inputSchema: z.object({
            query: z.string().describe("The name or part of the email address to search for (e.g., 'Dipti')"),
          }),
          execute: async ({ query }) => {
            console.log(`[search_contacts tool] Searching contacts for query: "${query}" via tenant ${userId}...`);
            try {
              const { corsairEntities, corsairAccounts } = await import("@/server/db/schema");
              const { eq, and, or, like } = await import("drizzle-orm");

              const threads = await ctx.db
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
                );

              const contactMap = new Map<string, { name: string; email: string; count: number }>();

              const getHeaderValue = (msg: any, name: string): string | undefined => {
                if (!msg) return undefined;
                if (msg[name.toLowerCase()]) return msg[name.toLowerCase()];
                const headers = msg.payload?.headers ?? [];
                return headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value;
              };

              const processHeader = (headerValue: string) => {
                if (!headerValue) return;
                const parts = headerValue.split(",");
                for (const part of parts) {
                  const trimmed = part.trim();
                  if (!trimmed) continue;
                  
                  let name = "";
                  let email = "";
                  const match = trimmed.match(/^(.*?)\s*<(.*?)>$/);
                  if (match) {
                    name = match[1]?.replace(/^["']|["']$/g, "").trim() ?? "";
                    email = match[2]?.trim().toLowerCase() ?? "";
                  } else if (trimmed.includes("@")) {
                    email = trimmed.toLowerCase();
                    name = trimmed.split("@")[0] ?? "";
                  }

                  if (email && email.includes("@")) {
                    const existing = contactMap.get(email);
                    if (existing) {
                      existing.count += 1;
                      if (name && !existing.name) {
                        existing.name = name;
                      }
                    } else {
                      contactMap.set(email, { name, email, count: 1 });
                    }
                  }
                }
              };

              for (const t of threads) {
                const threadData = t.data as any;
                const messages = threadData?.messages ?? [];
                for (const msg of messages) {
                  const fromVal = getHeaderValue(msg, "from");
                  if (fromVal) processHeader(fromVal);
                  
                  const toVal = getHeaderValue(msg, "to");
                  if (toVal) processHeader(toVal);
                }
              }

              const normalizedQuery = query.toLowerCase();
              const results = Array.from(contactMap.values())
                .filter(
                  (c) =>
                    c.name.toLowerCase().includes(normalizedQuery) ||
                    c.email.toLowerCase().includes(normalizedQuery)
                )
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

              return results;
            } catch (err: any) {
              console.error("Failed to search contacts:", err);
              return { error: `Failed to search contacts: ${err.message || err}` };
            }
          },
        });

        const targetEmailInstruction = input.context?.targetEmail
          ? `\n\nCRITICAL CONTEXT: The user is currently targeting the email account: "${input.context.targetEmail}". Any Gmail thread lists, email searches, compose templates, or draft creations must target this account. Use "${input.context.targetEmail}" as 'fromEmail' parameter when calling send_email or create_draft.`
          : "";

        // System instructions (completely static to maximize DeepSeek/Gemini prompt caching)
        const instructions = `You have access to Corsair tools. Use list_operations to discover available APIs, get_schema to understand required arguments, and run_script to execute them.
The 'corsair' variable is already pre-scoped to your active tenant, so you must NOT call '.withTenant()' yourself. Simply run operations directly on 'corsair', e.g. const res = await corsair.gmail.api.threads.list({}); return res;

For searching your email history or calendar events, ALWAYS use the 'search_local' tool first. It performs a semantic vector search across cached local data in under 1 second without making slow third-party API calls.
If 'search_local' returns empty or misses what you are looking for, fall back to the live Gmail/Calendar API tool (via \`run_script\`) to fetch threads/events directly. Doing so automatically saves/caches the results locally in Corsair, indexing them for subsequent searches.
For sending emails, ALWAYS use the first-party 'send_email' tool instead of attempting to build raw MIME messages via run_script. This tool automatically formats and base64url-encodes the message properly.
For saving drafts, ALWAYS use the first-party 'create_draft' tool.

CRITICAL INTERACTION INSTRUCTIONS:
1. Model Behavior Mode: You are currently running in **${modelMode === "careful" ? "CAREFUL (REVIEW)" : "AUTONOMOUS (AUTOPILOT)"}** mode.
   ${
     modelMode === "careful"
       ? `For sending emails: Even if the user says "send it" or "send email", do NOT call the "send_email" tool directly. Instead, you MUST create a draft using the "create_draft" tool first, and then tell the user you've saved it as a draft for their review. Alternatively, ask the user to confirm the action before calling send_email. You are in "Careful / Review Mode" by default.
For calendar events: Do not execute write script actions directly. Proactively ask the user for confirmation first.`
       : `For sending emails: If the user gives a clear instruction to send (e.g. "send this email" or "send it"), you can call the "send_email" tool directly to execute the action immediately.
For calendar events: If the instructions are clear, you can execute the write script actions directly without asking for an extra confirmation button.
HOWEVER, if the instructions are vague, incomplete, or ambiguous (e.g. "schedule a meeting" without time, or "email John" without body/subject), you MUST still stop and ask clarifying questions using multiple-choice options. You are in "Autonomous Mode".`
   }
2. Resolving Names in Local Cache First: When the user specifies a contact name (e.g., "Dipti", "John", "Sarah") without an email address, you MUST immediately call the 'search_contacts' tool with the name as the query. Try to locate their email address in the contacts cache first. If found, proceed using that email address directly. Do NOT ask the user for their email address unless no matches are found in the cache or multiple different people share the same name.
3. Clarifying Questions & Proactive MCQs: If there is ANY ambiguity, or if you need clarification (e.g., when given abstract requests like "schedule zoom event at 18 june" without time/location, or "email John" without subject/body), do NOT guess and do NOT ask open-ended questions. Instead, immediately propose specific options (e.g., times, location options, template tones, or subjects) as multiple-choice buttons at the end of your response so the user can select them with a single click. Proactively organize multiple missing parameters into structured options. This applies even in Autonomous mode!
4. Multi-choice Options Format: When asking clarifying options, proposing next steps, or asking for confirmation/actions, you MUST format each choice exactly as '[Option: Option Text]' on a new line at the very end of your response. Never use numbered lists or bullet lists for these choices - always format them as '[Option: Option Text]'. Always include a custom option (e.g. '[Option: Specify custom time]' or '[Option: Specify custom recipient]') so the user can enter a custom text response.
   Example:
   "I see you want to schedule a Zoom event on June 18. What time would you prefer?"
   [Option: June 18 at 10:00 AM]
   [Option: June 18 at 2:00 PM]
   [Option: June 18 at 4:30 PM]
   [Option: Specify custom time]
5. Semantic Email Search: When the user asks to search emails or calendar events (e.g. 'find flight bookings from last month', 'show invoices from AWS', or 'unread emails from boss'), always use 'search_local' first. 
   - Parse the search results returned (which contain sender, subject, snippet, and epoch ms timestamps).
   - In your thinking, filter and sort these results to match the user's constraints (e.g. filtering out items that are not from AWS or not within the last month).
   - Format the results beautifully in your response using markdown: use bold headers for subjects, italics for senders and dates (convert epoch ms to readable dates like 'June 12, 2026'), and use blockquotes (e.g. '> snippet...') for the content snippet to display them like rich cards in the chat UI.
6. Proposing Email Drafts for Review: Whenever you propose, suggest, or write an email draft for the user to review (instead of sending it immediately), you MUST format the draft details inside a special block at the very end of your response:
   ---DRAFT_START---
   To: <recipient email>
   Cc: <cc email, if any>
   Bcc: <bcc email, if any>
   Subject: <email subject>
   Body:
   <email body>
   ---DRAFT_END---
   Always keep conversational text outside of this block (preferably before it). This block allows the frontend to render the draft as an interactive, editable review card in the chat.
7. Tool Confirmations: After successfully calling 'send_email' or 'create_draft', you MUST always output an explicit, friendly confirmation message to the user confirming the action was successful (e.g. 'I have successfully sent the email to [recipient] with the subject "[subject]".' or 'I have saved your draft for [recipient] with the subject "[subject]".'). Do NOT output an empty response.${targetEmailInstruction}`;
        const contextPrompt = buildContextPrompt(input.context);

        const historyMessages = (input.history ?? []).map((msg) => {
          if (msg.role === "assistant" && msg.reasoning) {
            return {
              role: "assistant" as const,
              content: [
                { type: "reasoning" as const, reasoning: msg.reasoning },
                { type: "text" as const, text: msg.content },
              ],
            };
          }
          return {
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content,
          };
        });

        const promptMsg = {
          role: "user" as const,
          content: contextPrompt
            ? `${contextPrompt}\n\nUser request: ${input.message}`
            : input.message,
        };

        const messagesList = [...historyMessages, promptMsg];

        const models = input.reasoningEnabled
          ? [
              (deepseek as any).chat("deepseek-v4-pro", {
                extraBody: {
                  thinking: { type: "enabled" },
                  reasoning_effort: "high",
                },
              }),
              google("gemini-2.5-flash"),
              google("gemini-2.5-flash-lite"),
            ]
          : [
              (deepseek as any).chat("deepseek-v4-flash"),
              google("gemini-2.5-flash"),
              google("gemini-2.5-flash-lite"),
              (deepseek as any).chat("deepseek-v4-pro", {
                extraBody: {
                  thinking: { type: "enabled" },
                  reasoning_effort: "high",
                },
              }),
            ];

        let response;
        let lastError: unknown = null;

        for (const model of models) {
          try {
            const modelName = typeof model === "string" ? model : (model?.modelId || "deepseek-v4-pro");
            console.log(`Attempting execution in live chat using model: ${modelName}...`);
             const agent = new Agent({
              id: "singularity-workflow-agent",
              name: "Singularity Workflow Agent",
              model: model,
              instructions: instructions,
              tools: {
                ...wrappedMcpTools,
                send_email: sendEmailTool,
                create_draft: createDraftTool,
                search_local: searchLocalTool,
                search_contacts: searchContactsTool,
              },
            });

            // Set up a 2-minute timeout for the generation to avoid hanging
            const generatePromise = agent.generate(messagesList as any);

            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Model execution timed out after 2 minutes.")), 120000)
            );

            response = await Promise.race([generatePromise, timeoutPromise]);
            break;
          } catch (err: unknown) {
            const modelName = typeof model === "string" ? model : (model?.modelId || "deepseek-v4-pro");
            console.warn(`Live chat model ${modelName} failed:`, err);
            lastError = err;
            
            // Abort fallback retry if a write action has already been performed 
            // to avoid duplicates (e.g. sending emails twice, creating multiple events).
            if (didExecuteWriteTool) {
              console.warn("Write tool was already executed by the failed model. Aborting fallback loop to prevent duplicate actions.");
              break;
            }
          }
        }

        if (!response) {
          throw lastError || new Error("All fallback models failed to generate a response.");
        }

        // Check if send_email or create_draft tools were executed
        const toolCalls = response.toolCalls ?? (response as any).steps?.flatMap((s: any) => s.toolCalls ?? []) ?? [];
        const sentEmail = toolCalls.some((tc: any) => tc.toolName === "send_email");
        const createdDraft = toolCalls.some((tc: any) => tc.toolName === "create_draft");

        return {
          text: response.text,
          reasoning: (response as any).reasoning || null,
          actions: inferFrontendActions(input.message, input.context),
          sentEmail,
          createdDraft,
        };
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        console.error("Agent chat failed:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Agent execution failed: ${message}`,
        });
      }
    }),

  confirmAction: protectedProcedure
    .input(agentActionSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      try {
        if (input.type === "confirm_archive_threads" || input.type === "confirm_delete_threads") {
          const requestedThreadIds = Array.from(new Set(input.threadIds));

          // Look up all thread accounts for the requested thread IDs ensuring user ownership
          const threadAccounts = await ctx.db
            .select({
              entityId: corsairEntities.entityId,
              tenantId: corsairAccounts.tenantId,
            })
            .from(corsairEntities)
            .innerJoin(corsairAccounts, eq(corsairEntities.accountId, corsairAccounts.id))
            .innerJoin(corsairIntegrations, eq(corsairAccounts.integrationId, corsairIntegrations.id))
            .where(
              and(
                inArray(corsairEntities.entityId, requestedThreadIds),
                eq(corsairEntities.entityType, "threads"),
                eq(corsairIntegrations.name, "gmail"),
                or(
                  eq(corsairAccounts.tenantId, userId),
                  like(corsairAccounts.tenantId, `${userId}\\_%`)
                )
              )
            );

          const foundThreadIds = new Set(threadAccounts.map((thread) => thread.entityId));
          const missingThreadIds = requestedThreadIds.filter((id) => !foundThreadIds.has(id));

          if (missingThreadIds.length > 0) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "One or more threads were not found or you do not have permission to access them.",
            });
          }

          // Group thread IDs by tenantId
          const tenantThreadsMap = new Map<string, string[]>();
          for (const ta of threadAccounts) {
            if (!ta.entityId || !ta.tenantId) continue;
            const list = tenantThreadsMap.get(ta.tenantId) ?? [];
            list.push(ta.entityId);
            tenantThreadsMap.set(ta.tenantId, list);
          }

          if (input.type === "confirm_archive_threads") {
            await Promise.all(
              Array.from(tenantThreadsMap.entries()).map(async ([tid, ids]) => {
                const tenant = corsair.withTenant(tid);
                return Promise.all(
                  ids.map((id) =>
                    tenant.gmail.api.threads.modify({
                      id,
                      removeLabelIds: ["INBOX"],
                    })
                  )
                );
              })
            );

            return {
              success: true,
              message:
                threadAccounts.length === 1
                  ? "Archived the selected thread."
                  : `Archived ${threadAccounts.length} selected threads.`,
            };
          }

          if (input.type === "confirm_delete_threads") {
            await Promise.all(
              Array.from(tenantThreadsMap.entries()).map(async ([tid, ids]) => {
                const tenant = corsair.withTenant(tid);
                return Promise.all(ids.map((id) => tenant.gmail.api.threads.trash({ id })));
              })
            );

            return {
              success: true,
              message:
                threadAccounts.length === 1
                  ? "Moved the selected thread to trash."
                  : `Moved ${threadAccounts.length} selected threads to trash.`,
            };
          }
        }

        return {
          success: false,
          message: "This action does not require backend confirmation.",
        };
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        console.error("Agent action confirmation failed:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Agent action failed: ${message}`,
        });
      }
    }),
});
