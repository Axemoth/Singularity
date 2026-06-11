import 'dotenv/config';
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { MastraProvider } from '@corsair-dev/mcp';
import { corsair } from './corsair';

async function run() {
  console.log('Initializing Mastra Provider...');
  const provider = new MastraProvider();
  const tools = await provider.build({ corsair });
  console.log('Mastra Provider built successfully with', tools.length, 'tools.');

  const model = google('gemini-2.5-flash-lite');
  console.log('Using model: gemini-2.5-flash-lite');

  const agent = new Agent({
    id: 'corsair-agent',
    name: 'corsair-agent',
    model: model,
    instructions: 'You are a helpful assistant with access to Corsair tools.',
    tools: Object.fromEntries(tools.map((t: any) => [t.id, t])),
  });

  console.log('Sending message to agent...');
  const response = await agent.generate('Hello! Who are you?');
  console.log('Agent Response:', response.text);
  process.exit(0);
}

run().catch(err => {
  console.error('Agent failed:', err);
  process.exit(1);
});