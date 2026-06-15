import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { env } from '@/env';
import { MastraProvider } from '@corsair-dev/mcp';
import { corsair } from './corsair';

const deepseek = createOpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: env.DEEPSEEK_API_KEY ?? '',
});

const provider = new MastraProvider();
const tools = await provider.build({ corsair });

const models = [
    (deepseek as any).chat('deepseek-v4-pro', {
        extraBody: {
            thinking: { type: 'enabled' },
            reasoning_effort: 'high',
        },
    }),
    google('gemini-2.5-flash'),
    google('gemini-2.5-flash-lite'),
    google('gemma-4-31b-it'),
    google('gemma-4-26b-a4b-it'),
];

let response;

for (const model of models) {
    try {
        const modelName = model?.modelId || 'deepseek-v4-pro';
        console.log(`Attempting execution using model: ${modelName}...`);
        
        const agent = new Agent({
            id: 'corsair-agent',
            name: 'corsair-agent',
            model: model,
            instructions:
                'You have access to Corsair tools. Use list_operations to discover available APIs, get_schema to understand required arguments, and run_script to execute them. Since this is a multi-tenant setup, always scope your calls to the tenant "dev" by calling `corsair.withTenant("dev")`. For example, to list Gmail threads, run: const res = await corsair.withTenant("dev").gmail.api.threads.list({}); return res;',
            tools: Object.fromEntries(tools.map((t: any) => [t.id, t])),
        });

        response = await agent.generate(
            'Fetch my latest Gmail threads for the tenant "dev". Remember to scope the call using: corsair.withTenant("dev").gmail.api.threads.list({});',
        );
        break;
    } catch (err: any) {
        const modelName = model?.modelId || 'deepseek-v4-pro';
        console.warn(`Model ${modelName} failed:`, err.message || err);
    }
}

if (!response) {
    console.error('All models failed to generate a response.');
    process.exit(1);
}

console.log(response.text);
