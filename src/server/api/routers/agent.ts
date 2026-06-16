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
    threadIds: z.array(z.string()),
  }),
  z.object({
    type: z.literal("confirm_delete_threads"),
    label: z.string(),
    threadIds: z.array(z.string()),
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

      try {
        const { userSettings } = await import("@/server/db/schema");
        const { eq } = await import("drizzle-orm");

        const [settings] = await ctx.db
          .select({ modelMode: userSettings.modelMode })
          .from(userSettings)
          .where(eq(userSettings.userId, userId))
          .limit(1);
        const modelMode = settings?.modelMode ?? "careful";

        let didExecuteWriteTool = false;
        const provider = new MastraProvider();
        const toolsList = await provider.build({ corsair: corsair.withTenant(userId) });

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
          }),
          execute: async ({ to, subject, body }) => {
            console.log(`[send_email tool] Sending email to ${to} via tenant ${userId}...`);
            didExecuteWriteTool = true;
            const tenant = corsair.withTenant(userId);
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
          }),
          execute: async ({ to, subject, body }) => {
            console.log(`[create_draft tool] Creating draft for ${to} via tenant ${userId}...`);
            didExecuteWriteTool = true;
            const tenant = corsair.withTenant(userId);
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
              const { sql, eq, and } = await import("drizzle-orm");

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
                    eq(corsairAccounts.tenantId, userId)
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
2. Clarifying Questions & Proactive MCQs: If there is ANY ambiguity, or if you need clarification (e.g., when given abstract requests like "schedule zoom event at 18 june" without time/location, or "email John" without subject/body), do NOT guess and do NOT ask open-ended questions. Instead, immediately propose specific options (e.g., times, location options, template tones, or subjects) as multiple-choice buttons at the end of your response so the user can select them with a single click. Proactively organize multiple missing parameters into structured options. This applies even in Autonomous mode!
3. Multi-choice Options Format: When asking clarifying options, format each choice exactly as '[Option: Option Text]' on a new line at the very end of your response.
   Example:
   "I see you want to schedule a Zoom event on June 18. What time would you prefer?"
   [Option: June 18 at 10:00 AM]
   [Option: June 18 at 2:00 PM]
   [Option: June 18 at 4:30 PM]
   [Option: Specify custom time]
4. Semantic Email Search: When the user asks to search emails or calendar events (e.g. 'find flight bookings from last month', 'show invoices from AWS', or 'unread emails from boss'), always use 'search_local' first. 
   - Parse the search results returned (which contain sender, subject, snippet, and epoch ms timestamps).
   - In your thinking, filter and sort these results to match the user's constraints (e.g. filtering out items that are not from AWS or not within the last month).
   - Format the results beautifully in your response using markdown: use bold headers for subjects, italics for senders and dates (convert epoch ms to readable dates like 'June 12, 2026'), and use blockquotes (e.g. '> snippet...') for the content snippet to display them like rich cards in the chat UI.
5. Tool Confirmations: After successfully calling 'send_email' or 'create_draft', you MUST always output an explicit, friendly confirmation message to the user confirming the action was successful (e.g. 'I have successfully sent the email to [recipient] with the subject "[subject]".' or 'I have saved your draft for [recipient] with the subject "[subject]".'). Do NOT output an empty response.`;
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
      const tenant = corsair.withTenant(userId);

      try {
        if (input.type === "confirm_archive_threads") {
          await Promise.all(
            input.threadIds.map((id) =>
              tenant.gmail.api.threads.modify({
                id,
                removeLabelIds: ["INBOX"],
              }),
            ),
          );

          return {
            success: true,
            message:
              input.threadIds.length === 1
                ? "Archived the selected thread."
                : `Archived ${input.threadIds.length} selected threads.`,
          };
        }

        if (input.type === "confirm_delete_threads") {
          await Promise.all(
            input.threadIds.map((id) => tenant.gmail.api.threads.trash({ id })),
          );

          return {
            success: true,
            message:
              input.threadIds.length === 1
                ? "Moved the selected thread to trash."
                : `Moved ${input.threadIds.length} selected threads to trash.`,
          };
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
