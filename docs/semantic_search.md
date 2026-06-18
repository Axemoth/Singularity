# Local Semantic Vector Search Documentation

This document describes the design, database schema, background pipeline, and UI integration of the local semantic search feature in Singularity.

---

## 💡 Overview

Singularity maintains a local cache of Gmail threads and Google Calendar events using **Corsair**. To allow instant, natural language search across this data (in under 1 second) without hitting third-party Google APIs, we employ a local vector search database utilizing:
1. **PostgreSQL pgvector extension** for vector storage and cosine similarity operators.
2. **HNSW index** for high-performance approximate nearest neighbor search.
3. **Gemini & OpenRouter embeddings models** to encode texts into 768-dimension vectors.
4. **tRPC Search Router** to bridge frontend query inputs to vector database queries.

---

## 🗄️ Database Architecture

We use two primary tables to support semantic search.

### 1. `corsair_entities`
Stores the raw JSON payloads synced from Corsair.
```sql
CREATE TABLE corsair_entities (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    account_id TEXT NOT NULL REFERENCES corsair_accounts(id),
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL, -- 'threads' | 'events'
    version TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'
);
```

### 2. `corsair_embeddings`
Stores the generated text blocks, vector embeddings, and links back to the source entity.
```sql
CREATE TABLE corsair_embeddings (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL REFERENCES corsair_entities(id) ON DELETE CASCADE,
    embedding VECTOR(768) NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cosine Distance HNSW Index
CREATE INDEX embedding_cosine_idx 
ON corsair_embeddings 
USING hnsw (embedding vector_cosine_ops);
```

---

## ⚙️ Background Embedding Sync Pipeline

When users load the dashboard or thread lists, a background task `syncEmbeddings(userId)` is triggered asynchronously:
1. **Find Unindexed Entities:** Queries `corsair_entities` where `corsair_embeddings.id` is null.
2. **Compile Text Blocks:**
   * **For Gmail Threads:** Compiles thread subject, sender name, recipient list, and all message bodies/snippets:
     ```
     Thread ID: <id>
     Subject: <subject>
     From: <from>
     To: <to>
     Messages:
     From: <msg.from> | To: <msg.to> | Body: <body>
     ```
   * **For Calendar Events:** Compiles event summary, description, location, dates/times, and attendees list:
     ```
     Event: <summary>
     Description: <description>
     Location: <location>
     Time: <start> to <end>
     Attendees: <email1>, <email2>
     ```
3. **Generate 768-dim Vector:**
   * Primary: `gemini-embedding-2` (Gemini API)
   * Fallback: `gemini-embedding-001` (Gemini API)
   * Third-tier Fallback: `nvidia/llama-nemotron-embed-vl-1b-v2:free` (OpenRouter API)
4. **Insert into Database:** Stores the text block and embedding array. A 300ms throttle delay is enforced to avoid Google API rate limits.

---

## 🔍 Semantic Search Querying

Frontend inputs are routed through the `api.search.searchLocal` tRPC query.
1. The natural language search term is converted to a 768-dimension vector.
2. We query `corsair_embeddings` using Drizzle SQL:
   ```typescript
   const results = await ctx.db
     .select({
       id: corsairEntities.id,
       entityId: corsairEntities.entityId,
       entityType: corsairEntities.entityType,
       data: corsairEntities.data,
       text: corsairEmbeddings.text,
       similarity: sql<number>`1 - (${corsairEmbeddings.embedding} <=> ${queryEmbeddingStr}::vector)`.as('similarity'),
       updatedAt: corsairEntities.updatedAt,
       emailAddress: corsairAccounts.emailAddress,
     })
     .from(corsairEmbeddings)
     .innerJoin(corsairEntities, eq(corsairEmbeddings.entityId, corsairEntities.id))
     .innerJoin(corsairAccounts, eq(corsairEntities.accountId, corsairAccounts.id))
     .where(and(...conditions))
     .orderBy(sql`${corsairEmbeddings.embedding} <=> ${queryEmbeddingStr}::vector`)
     .limit(limit);
   ```
3. **Similarity Score Calculation:**
   The cosine distance operator `<=>` returns a value from `0` (identical) to `2` (opposite). We subtract it from `1` to get a similarity score between `1.0` (100% match) and `-1.0`.

---

## 🎨 UI Integration

*   **Keyboard Focus:** Pressing `/` instantly focuses the search bar input. Pressing `Escape` clears the query.
*   **Search Filters Dropdown:** Toggles a glassmorphic option list allowing search targeting on "All Content", "Emails Only", or "Calendar Only" (modifying `entityType` parameter).
*   **Highlight Cards:** Thread results show Gmail icons, and Event results show Calendar icons. Cards display a dynamic colored similarity percentage badge (Green $\ge 85\%$, Cyan $\ge 70\%$, Grey otherwise).
*   **Detail Panes:** Clicking a thread result opens the normal email thread detail. Clicking an event result renders the custom `EventDetail` right pane with calendar details, locations, and attendee grids.
