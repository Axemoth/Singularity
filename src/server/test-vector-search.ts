import "dotenv/config";
import { db, conn } from "./db";
import { corsairEntities, corsairAccounts, corsairIntegrations, corsairEmbeddings } from "./db/schema";
import { syncEmbeddings } from "./api/tasks/embeddings";
import { eq, sql } from "drizzle-orm";
import { generateEmbedding } from "./api/tasks/embeddings";

async function runTest() {
  const testTenantId = "test-tenant-vector-123";
  const integrationIdGmail = "test-int-gmail-123";
  const integrationIdCalendar = "test-int-cal-123";
  const accountIdGmail = "test-acc-gmail-123";
  const accountIdCalendar = "test-acc-cal-123";

  console.log("=== STARTING VECTOR SEARCH TEST ===");

  try {
    // 1. Setup integrations
    console.log("Setting up mock integrations...");
    await db.insert(corsairIntegrations).values([
      { id: integrationIdGmail, name: "gmail", config: {} },
      { id: integrationIdCalendar, name: "googlecalendar", config: {} }
    ]).onConflictDoNothing();

    // 2. Setup accounts
    console.log("Setting up mock accounts...");
    await db.insert(corsairAccounts).values([
      { id: accountIdGmail, tenantId: testTenantId, integrationId: integrationIdGmail, config: {} },
      { id: accountIdCalendar, tenantId: testTenantId, integrationId: integrationIdCalendar, config: {} }
    ]).onConflictDoNothing();

    // 3. Setup mock entities in corsair_entities
    console.log("Inserting mock emails & events...");
    
    // Mock Gmail thread (Chase bank statement)
    const threadId1 = "mock-thread-chase-001";
    await db.insert(corsairEntities).values({
      id: "entity-gmail-chase",
      accountId: accountIdGmail,
      entityId: threadId1,
      entityType: "threads",
      version: "1.0.0",
      data: {
        id: threadId1,
        snippet: "Your weekly Chase bank statement is ready.",
        messages: [
          {
            id: "msg-chase-1",
            threadId: threadId1,
            subject: "Weekly Bank Statement - Chase Checking Account",
            from: "statements@chase.com",
            to: "user@example.com",
            body: "Dear customer, your bank statement for account ending in 1234 is now available for download. Thank you for banking with Chase.",
            internalDate: new Date().toISOString()
          }
        ]
      }
    }).onConflictDoNothing();

    // Mock Gmail thread (SRMIST course registration)
    const threadId2 = "mock-thread-srmist-002";
    await db.insert(corsairEntities).values({
      id: "entity-gmail-srmist",
      accountId: accountIdGmail,
      entityId: threadId2,
      entityType: "threads",
      version: "1.0.0",
      data: {
        id: threadId2,
        snippet: "SRMIST Course registration announcement.",
        messages: [
          {
            id: "msg-srmist-1",
            threadId: threadId2,
            subject: "SRMIST Course Registration Odd Semester 2026",
            from: "registrar@srmist.edu.in",
            to: "user@example.com",
            body: "Please register for your classes for the upcoming odd semester. Registration opens on Monday at 9:00 AM.",
            internalDate: new Date().toISOString()
          }
        ]
      }
    }).onConflictDoNothing();

    // Mock Calendar event (Meeting with Dipti)
    const eventId1 = "mock-event-dipti-003";
    await db.insert(corsairEntities).values({
      id: "entity-calendar-dipti",
      accountId: accountIdCalendar,
      entityId: eventId1,
      entityType: "events",
      version: "1.0.0",
      data: {
        id: eventId1,
        summary: "Weekly Sync with Dipti Gorasia",
        description: "Review milestones, priorities, and roadmap updates for the AxHuman project.",
        location: "Google Meet",
        start: { dateTime: new Date().toISOString() },
        end: { dateTime: new Date().toISOString() },
        attendees: [
          { email: "dipti.gorasia@gmail.com", displayName: "Dipti Gorasia" }
        ]
      }
    }).onConflictDoNothing();

    // 4. Trigger syncEmbeddings
    console.log("Triggering syncEmbeddings background worker...");
    await syncEmbeddings(testTenantId);

    // 5. Verify embeddings are in the db
    const embeddedRows = await db
      .select()
      .from(corsairEmbeddings);
    
    console.log(`Embeddings table contains ${embeddedRows.length} rows.`);

    // 6. Test Semantic Search Query 1 (Chase Statement)
    console.log("\n--- Testing Search 1: 'bank statement from Chase' ---");
    const start1 = performance.now();
    const queryVector1 = await generateEmbedding("bank statement from Chase");
    const queryVector1Str = `[${queryVector1.join(",")}]`;
    
    const searchResults1 = await db
      .select({
        id: corsairEntities.id,
        entityType: corsairEntities.entityType,
        text: corsairEmbeddings.text,
        similarity: sql<number>`1 - (${corsairEmbeddings.embedding} <=> ${queryVector1Str}::vector)`.as('similarity')
      })
      .from(corsairEmbeddings)
      .innerJoin(corsairEntities, eq(corsairEmbeddings.entityId, corsairEntities.id))
      .orderBy(sql`${corsairEmbeddings.embedding} <=> ${queryVector1Str}::vector`)
      .limit(3);

    const end1 = performance.now();
    console.log(`Search 1 completed in ${(end1 - start1).toFixed(2)}ms`);
    console.log("Results:");
    searchResults1.forEach((r, idx) => {
      console.log(`${idx + 1}. [${r.entityType}] Similarity: ${r.similarity.toFixed(4)}`);
      console.log(`   Text Snippet: ${r.text.split("\n").slice(0, 3).join(" | ")}`);
    });

    // 7. Test Semantic Search Query 2 (Dipti sync)
    console.log("\n--- Testing Search 2: 'meeting with Dipti' ---");
    const start2 = performance.now();
    const queryVector2 = await generateEmbedding("meeting with Dipti");
    const queryVector2Str = `[${queryVector2.join(",")}]`;
    
    const searchResults2 = await db
      .select({
        id: corsairEntities.id,
        entityType: corsairEntities.entityType,
        text: corsairEmbeddings.text,
        similarity: sql<number>`1 - (${corsairEmbeddings.embedding} <=> ${queryVector2Str}::vector)`.as('similarity')
      })
      .from(corsairEmbeddings)
      .innerJoin(corsairEntities, eq(corsairEmbeddings.entityId, corsairEntities.id))
      .orderBy(sql`${corsairEmbeddings.embedding} <=> ${queryVector2Str}::vector`)
      .limit(3);

    const end2 = performance.now();
    console.log(`Search 2 completed in ${(end2 - start2).toFixed(2)}ms`);
    console.log("Results:");
    searchResults2.forEach((r, idx) => {
      console.log(`${idx + 1}. [${r.entityType}] Similarity: ${r.similarity.toFixed(4)}`);
      console.log(`   Text Snippet: ${r.text.split("\n").slice(0, 3).join(" | ")}`);
    });

  } catch (err) {
    console.error("Test failed with error:", err);
  } finally {
    // 8. Cleanup test rows
    console.log("\nCleaning up database test entries...");
    await db.delete(corsairEmbeddings).where(sql`true`);
    await db.delete(corsairEntities).where(
      sql`account_id IN (${accountIdGmail}, ${accountIdCalendar})`
    );
    await db.delete(corsairAccounts).where(eq(corsairAccounts.tenantId, testTenantId));
    await db.delete(corsairIntegrations).where(
      sql`id IN (${integrationIdGmail}, ${integrationIdCalendar})`
    );
    await conn.end();
    console.log("Cleanup complete. Exiting.");
  }
}

void runTest();
