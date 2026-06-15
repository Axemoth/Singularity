import { db } from "@/server/db";
import { corsairEntities, corsairAccounts, corsairEmbeddings } from "@/server/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { env } from "@/env";

interface GmailMessagePayload {
  id?: string;
  threadId?: string;
  subject?: string;
  from?: string;
  to?: string;
  body?: string;
  snippet?: string;
  internalDate?: string;
}

interface GmailThreadPayload {
  id?: string;
  snippet?: string;
  messages?: GmailMessagePayload[];
}

interface CalendarEventPayload {
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email?: string; displayName?: string }>;
}

// Helper function to retry fetches with exponential backoff on 429 errors
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delay = 2000): Promise<Response> {
  try {
    const response = await fetch(url, options);
    if (response.status === 429 && retries > 0) {
      console.warn(`[RateLimit] Hit 429 rate limit, retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2.5);
    }
    return response;
  } catch (err) {
    if (retries > 0) {
      console.warn(`[NetworkError] Fetch failed, retrying in ${delay}ms...`, err);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2.5);
    }
    throw err;
  }
}

// Helper function to query Gemini embedding models dynamically
async function fetchGeminiEmbedding(text: string, modelName: string, apiKey: string): Promise<number[] | null> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:embedContent?key=${apiKey}`;
    const response = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: `models/${modelName}`,
        content: {
          parts: [{ text }],
        },
        outputDimensionality: 768,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as { embedding?: { values?: number[] } };
      const vector = data.embedding?.values;
      if (vector && Array.isArray(vector)) {
        return vector;
      }
    } else {
      const errorText = await response.text();
      console.warn(`Gemini embedding with ${modelName} failed: ${errorText}`);
    }
  } catch (err) {
    console.warn(`Gemini embedding with ${modelName} encountered an error:`, err);
  }
  return null;
}

// Generate vector embedding for a given text using Gemini API with gemini-embedding-001 and OpenRouter fallbacks
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;
  
  if (apiKey) {
    // 1. Try Gemini Embedding 2
    console.log("[Embeddings] Trying gemini-embedding-2...");
    const vector2 = await fetchGeminiEmbedding(text, "gemini-embedding-2", apiKey);
    if (vector2) return vector2;

    // 2. Try Gemini Embedding 001 (gemini embedding 1)
    console.log("[Embeddings] Falling back to gemini-embedding-001...");
    const vector1 = await fetchGeminiEmbedding(text, "gemini-embedding-001", apiKey);
    if (vector1) return vector1;
  } else {
    console.warn("GOOGLE_GENERATIVE_AI_API_KEY is not defined, trying OpenRouter fallback.");
  }

  // 3. Fallback to OpenRouter (nvidia/llama-nemotron-embed-vl-1b-v2:free)
  const openRouterKey = env.OPENROUTER_API_KEY;
  if (!openRouterKey) {
    throw new Error("All embedding models (Gemini-2, Gemini-001) failed and OPENROUTER_API_KEY is missing.");
  }

  console.log("[Embeddings] Requesting fallback embedding from OpenRouter (nvidia/llama-nemotron-embed-vl-1b-v2:free)...");
  const fallbackUrl = "https://openrouter.ai/api/v1/embeddings";
  const fallbackResponse = await fetchWithRetry(fallbackUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openRouterKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "nvidia/llama-nemotron-embed-vl-1b-v2:free",
      input: text,
      dimensions: 768,
    }),
  });

  if (!fallbackResponse.ok) {
    const errorText = await fallbackResponse.text();
    throw new Error(`OpenRouter fallback embedding failed: ${errorText}`);
  }

  const fallbackData = (await fallbackResponse.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  
  const rawVector = fallbackData.data?.[0]?.embedding;
  if (!rawVector || !Array.isArray(rawVector)) {
    throw new Error("Invalid fallback embedding response format from OpenRouter");
  }

  // Ensure exactly 768 dimensions
  const finalVector = rawVector.slice(0, 768);
  while (finalVector.length < 768) {
    finalVector.push(0);
  }

  console.log(`[Embeddings] Fallback embedding successful. Generated vector of size ${finalVector.length}`);
  return finalVector;
}


const activeEmbedSyncs = new Set<string>();

// Background sync function for untranslated entities
export async function syncEmbeddings(userId: string): Promise<void> {
  if (activeEmbedSyncs.has(userId)) {
    console.log(`[EmbeddingsSync] Embedding sync already in progress for user: ${userId}, skipping.`);
    return;
  }
  activeEmbedSyncs.add(userId);

  try {
    console.log(`[EmbeddingsSync] Starting embedding sync for user: ${userId}`);

    // Query all entities that belong to the user's accounts but do not have an embedding
    const unindexed = await db
      .select({
        id: corsairEntities.id,
        entityId: corsairEntities.entityId,
        entityType: corsairEntities.entityType,
        data: corsairEntities.data,
      })
      .from(corsairEntities)
      .innerJoin(corsairAccounts, eq(corsairEntities.accountId, corsairAccounts.id))
      .leftJoin(corsairEmbeddings, eq(corsairEntities.id, corsairEmbeddings.entityId))
      .where(
        and(
          eq(corsairAccounts.tenantId, userId),
          isNull(corsairEmbeddings.id)
        )
      );

    if (unindexed.length === 0) {
      console.log(`[EmbeddingsSync] All entities are already indexed for user: ${userId}`);
      return;
    }

    console.log(`[EmbeddingsSync] Found ${unindexed.length} unindexed entities. Generating embeddings...`);

    for (const entity of unindexed) {
      try {
        let textToEmbed = "";

        if (entity.entityType === "threads") {
          const threadData = entity.data as GmailThreadPayload;
          const messages = threadData.messages ?? [];
          const firstMessage = messages[0] ?? {};
          const subject = firstMessage.subject ?? threadData.snippet ?? "No Subject";
          const from = firstMessage.from ?? "";
          const to = firstMessage.to ?? "";

          const messagesText = messages
            .map(
              (m) =>
                `From: ${m.from ?? ""}\nTo: ${m.to ?? ""}\nSubject: ${m.subject ?? ""}\nBody: ${m.body ?? m.snippet ?? ""}`
            )
            .join("\n---\n");

          textToEmbed = `Thread ID: ${entity.entityId}\nSubject: ${subject}\nFrom: ${from}\nTo: ${to}\nMessages:\n${messagesText}`;
        } else if (entity.entityType === "events") {
          const eventData = entity.data as CalendarEventPayload;
          const summary = eventData.summary ?? "No Summary";
          const description = eventData.description ?? "";
          const location = eventData.location ?? "";
          const start = eventData.start?.dateTime ?? eventData.start?.date ?? "";
          const end = eventData.end?.dateTime ?? eventData.end?.date ?? "";
          const attendeesText = (eventData.attendees ?? [])
            .map((a) => a.email)
            .filter((email): email is string => typeof email === "string")
            .join(", ");

          textToEmbed = `Event: ${summary}\nDescription: ${description}\nLocation: ${location}\nTime: ${start} to ${end}\nAttendees: ${attendeesText}`;
        } else {
          // Skip other entity types (like labels, calendars, etc.)
          continue;
        }

        if (!textToEmbed.trim()) continue;

        // Generate the vector embedding
        const embedding = await generateEmbedding(textToEmbed);

        // Store in db
        await db.insert(corsairEmbeddings).values({
          id: crypto.randomUUID(),
          entityId: entity.id,
          embedding: embedding,
          text: textToEmbed,
        });

        console.log(`[EmbeddingsSync] Successfully embedded entity ${entity.id} (${entity.entityType})`);

        // Proactive throttle delay (300ms) - optimized for 100 Requests Per Minute (RPM) limit
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (err) {
        console.error(`[EmbeddingsSync] Failed to embed entity ${entity.id}:`, err);
      }
    }

    console.log(`[EmbeddingsSync] Embedding sync complete for user: ${userId}`);
  } catch (err) {
    console.error(`[EmbeddingsSync] Error in syncEmbeddings task:`, err);
  } finally {
    activeEmbedSyncs.delete(userId);
  }
}
