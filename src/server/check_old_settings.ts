import postgres from 'postgres';

const SOURCE_URL = "postgresql://neondb_owner:npg_ungErD5fx2pG@ep-sweet-recipe-atc46tr9-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function main() {
  console.log("Connecting to Old Source Database...");
  const conn = postgres(SOURCE_URL);
  
  try {
    console.log("Querying 'user_settings' table directly...");
    const settings = await conn`SELECT * FROM user_settings`;
    console.log("=== Old User Settings ===");
    console.log(JSON.stringify(settings, null, 2));

    console.log("Querying 'user' table directly...");
    const users = await conn`SELECT * FROM "user"`;
    console.log("=== Old Users ===");
    console.log(JSON.stringify(users, null, 2));
  } catch (err: any) {
    console.error("Failed to query old database:", err.message || err);
  } finally {
    await conn.end();
  }
}

main().catch(console.error).finally(() => process.exit(0));
