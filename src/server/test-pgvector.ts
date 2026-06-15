import 'dotenv/config';
import { db } from './db';
import { sql } from 'drizzle-orm';

async function run() {
  console.log("Checking pgvector support...");
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log("SUCCESS! pgvector extension is enabled.");
  } catch (err: any) {
    console.error("ERROR: pgvector is not supported or failed to enable:", err.message || err);
  }
}

run().catch(console.error).finally(() => process.exit(0));
