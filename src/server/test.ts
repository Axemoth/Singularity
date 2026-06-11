import 'dotenv/config';
import { db } from './db';
import { corsairEntities, corsairAccounts } from './db/schema';
import { sql } from 'drizzle-orm';
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { MastraProvider } from '@corsair-dev/mcp';
import { corsair } from './corsair';

async function verifyDatabase() {
  console.log('1. Verifying Database Connection...');
  const counts = await db.select({
    type: corsairEntities.entityType,
    count: sql`count(*)`
  })
  .from(corsairEntities)
  .groupBy(corsairEntities.entityType);
  
  console.log('   -> Cached Entities in DB:', counts);

  const accounts = await db.select().from(corsairAccounts);
  console.log('   -> Connected Corsair Accounts:', accounts.length);
}

async function verifyAgent() {
  console.log('2. Verifying Mastra AI Agent Initialization...');
  const provider = new MastraProvider();
  const tools = await provider.build({ corsair });
  console.log('   -> AI Tools built:', tools.length);

  const model = google('gemini-2.5-flash-lite');
  const agent = new Agent({
    id: 'verification-agent',
    name: 'verification-agent',
    model: model,
    instructions: 'You are a verification assistant.',
    tools: Object.fromEntries(tools.map((t: any) => [t.id, t])),
  });

  const response = await agent.generate('Hello!');
  console.log('   -> Agent Test Output:', response.text);
}

async function run() {
  await verifyDatabase();
  console.log();
  await verifyAgent();
  console.log('\nAll verification checks complete!');
  process.exit(0);
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});