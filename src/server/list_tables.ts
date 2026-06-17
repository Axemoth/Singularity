import 'dotenv/config';
import { db } from './db';
import { sql } from 'drizzle-orm';

async function run() {
  console.log("Listing tables...");
  const result = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  console.log("Tables:", JSON.stringify(result, null, 2));
}

run().catch(console.error).finally(() => process.exit(0));
