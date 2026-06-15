import "dotenv/config";
import { db, conn } from "@/server/db";
import { corsairEntities } from "@/server/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  try {
    const thread = await db.query.corsairEntities.findFirst({
      where: eq(corsairEntities.entityType, "threads")
    });
    console.log("=== THREAD ENTITY ===");
    if (thread) {
      console.log("ID:", thread.id);
      console.log("entityId:", thread.entityId);
      console.log("version:", thread.version);
      console.log("data:", JSON.stringify(thread.data, null, 2).slice(0, 2000));
    } else {
      console.log("No thread entity found in database.");
    }
  } catch (err) {
    console.error("Error checking thread:", err);
  } finally {
    await conn.end();
  }
}

void main();
