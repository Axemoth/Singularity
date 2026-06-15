import "dotenv/config";
import { db, conn } from "@/server/db";
import { corsairEntities } from "@/server/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const types = await db
      .select({
        entityType: corsairEntities.entityType,
        count: sql<number>`count(*)`
      })
      .from(corsairEntities)
      .groupBy(corsairEntities.entityType);
    console.log("=== ENTITY TYPES ===");
    console.log(types);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await conn.end();
  }
}

void main();
