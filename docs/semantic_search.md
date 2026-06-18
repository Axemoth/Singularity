# Local Semantic Search

Singularity caches Gmail threads and Google Calendar events in Postgres, then builds vector embeddings so users can search their workspace with natural language.

## Storage

Source data is stored in `corsair_entities`.

Embeddings are stored in `corsair_embeddings`:

```sql
CREATE TABLE corsair_embeddings (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES corsair_entities(id) ON DELETE CASCADE,
  embedding VECTOR(768) NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

The vector column uses an HNSW cosine index for fast nearest-neighbor search.

## Embedding Pipeline

`syncEmbeddings(userId)` runs in the background after inbox/calendar loads and search requests.

For Gmail threads, it embeds sender, recipients, subject, snippets, and message bodies.

For Calendar events, it embeds title, description, location, start/end time, and attendees.

Embedding model fallback order:

1. Gemini embedding model
2. Gemini legacy embedding model
3. OpenRouter fallback embedding model

## Query Flow

`api.search.searchLocal` accepts:

- `query`
- `entityType`: `all`, `threads`, or `events`
- `limit`

The query text is embedded, then compared with cached vectors using pgvector cosine distance.

All searches are scoped to the authenticated user's tenant slots.

## UI Behavior

The search UI supports:

- `/` keyboard focus
- entity filters
- mixed email/event results
- selected result detail panes

The local search path is also used by the AI agent before falling back to live Corsair API tools.
