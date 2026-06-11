import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { Agent } from "@mastra/core/agent";
import { google } from "@ai-sdk/google";
import { MastraProvider } from "@corsair-dev/mcp";
import { corsair } from "@/server/corsair";
import { TRPCError } from "@trpc/server";

// Cache Mastra tools globally to avoid rebuilding them on every request
let cachedTools: any[] | null = null;

async function getAgentTools() {
  if (!cachedTools) {
    const provider = new MastraProvider();
    cachedTools = await provider.build({ corsair });
  }
  return cachedTools;
}

export const agentRouter = createTRPCRouter({
  chat: protectedProcedure
    .input(
      z.object({
        message: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      try {
        const toolsList = await getAgentTools();

        // Scope the LLM agent instructions to the user's logged-in tenant ID
        const instructions = `You have access to Corsair tools. Use list_operations to discover available APIs, get_schema to understand required arguments, and run_script to execute them. Since this is a multi-tenant setup, always scope your calls to the tenant "${userId}" by calling \`corsair.withTenant("${userId}")\`. For example, to list Gmail threads, run: const res = await corsair.withTenant("${userId}").gmail.api.threads.list({}); return res;`;

        const model = google("gemini-2.5-flash-lite");

        const agent = new Agent({
          id: `singularity-agent-${userId}`,
          name: "Singularity Workflow Agent",
          model: model,
          instructions: instructions,
          tools: Object.fromEntries(toolsList.map((t) => [t.id, t])),
        });

        const response = await agent.generate(input.message);

        return { text: response.text };
      } catch (err: any) {
        console.error("Agent chat failed:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Agent execution failed: ${err.message || err}`,
        });
      }
    }),
});
