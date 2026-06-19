# Singularity 🌌

> A Superhuman-style Gmail & Google Calendar command center built with Next.js, PostgreSQL, and Corsair. Manage multiple email accounts, triage your inbox with AI-powered priorities, draft replies with an intelligent copilot, and navigate your schedule from one keyboard-driven workspace.

---

## 🌟 Features

### Corsair Integration

- **Multi-Tenant OAuth**: Connect up to 3 Gmail and 3 Google Calendar accounts (premium). Each connection is scoped to a unique tenant slot using a `userId_timestamp` grouping algorithm that prevents account overwrites.
- **Encrypted Token Storage**: All OAuth tokens are encrypted at rest using Corsair's KEK (Key Encryption Key) architecture. Tokens are never stored in plaintext.
- **Real-Time Webhooks**: Gmail Pub/Sub webhook integration with automatic tenant resolution from the `emailAddress` field in the payload. New emails trigger instant AI classification.
- **MCP Tool Bridge**: The AI agent accesses Gmail and Calendar APIs through Corsair's MCP (Model Context Protocol) provider, enabling `list_operations`, `get_schema`, and `run_script` tool calls.

### Gmail Workflow

- **Unified Inbox**: Tabbed inbox with Inbox, Sent, Drafts, Priority (urgent/normal/low), and spam filtering. Threaded conversation view with full message bodies.
- **Compose & Reply**: Rich email composition with CC/BCC, signature injection, thread replies with `In-Reply-To` / `References` headers, and multi-account `fromEmail` routing.
- **Archive & Delete**: Single and bulk operations via the AI agent with ownership verification against tenant IDs.
- **AI Priority Classification**: Every incoming email is classified as urgent/normal/low using DeepSeek v4 Pro with:
  - Custom user-defined priority rules
  - Few-shot learning from manual corrections
  - Sender interaction frequency analysis
  - Programmatic spam safeguards (same-domain, history checks)
  - Deadline detection with auto-escalation (12-hour window)
  - Rule-based fallback classifier when LLM is unavailable

### Calendar Workflow

- **Event CRUD**: Create, read, update, and delete calendar events with proper datetime validation (`calendarDateTimeSchema` with `.refine()` for ISO 8601 and cross-field `end > start` checks).
- **RSVP Support**: Respond to event invitations (accepted/declined/tentative) directly from the app.
- **Multi-Account Sync**: Separate tenant routing for Calendar accounts, with automatic pairing to existing Gmail tenant slots when possible.

### Productivity UX

- **Dashboard**: Date-range metrics dashboard showing email volume, calendar event counts, and per-account breakdowns with email filtering.
- **Semantic Vector Search**: Sub-second natural language search across all cached emails and calendar events using PostgreSQL `pgvector` with HNSW indexing. Embedding pipeline: Gemini Embedding 2 -> Gemini Embedding 001 -> OpenRouter Llama Nemotron (fallback chain).
- **Bulk Email Broadcasting**: Upload a CSV of recipients, draft a template with `{name}` / `{email}` variables, and broadcast personalized emails with rate limiting.
- **Theme System**: Light/dark mode with persistent preference and a polished glassmorphic UI.
- **Premium Tiers**: Free (1 account, 20 copilot requests/day) vs Premium (3 accounts, unlimited) via Dodo Payments integration with webhook-driven status management.

### AI Copilot & MCP

- **Mastra Agent**: Full agentic workflow powered by `@mastra/core` with tool calling, multi-step reasoning, and context-aware responses.
- **Model Fallback Chain**: DeepSeek v4 Pro (reasoning) -> Gemini 2.5 Flash -> Gemini 2.5 Flash Lite. Write-tool deduplication prevents duplicate actions on model fallback.
- **DeepThink Mode**: Toggle between reasoning-enabled (shows chain of thought in a collapsible UI section) and speed mode.
- **Careful vs Autonomous**: In Careful mode, the agent creates drafts for review. In Autonomous mode, it executes send/create actions directly when instructions are clear.
- **Custom Tools**:
  - `send_email`: First-party tool with proper MIME encoding
  - `create_draft`: Saves to Gmail drafts
  - `search_local`: Semantic vector search (fire-and-forget embedding sync)
  - `search_contacts`: Contact resolution from cached email headers
- **User Habit Learning**: Analyzes sent email patterns (greeting style, sign-off, reply length, response time, active hours) and injects learned preferences into the agent's system prompt.
- **Interactive Action Cards**: Agent responses include clickable action cards (archive, delete, open route, draft preview, bulk broadcast confirmation).

---

## 🏗️ Architecture

```
singularity/
├── src/
│   ├── app/
│   │   ├── (app)/              # Authenticated pages
│   │   │   ├── inbox/          # Gmail inbox with priority tabs
│   │   │   ├── calendar/       # Google Calendar view
│   │   │   ├── dashboard/      # Metrics dashboard
│   │   │   └── settings/       # Integrations, premium, preferences
│   │   ├── (admin)/            # Admin panel
│   │   ├── api/
│   │   │   ├── connect/        # OAuth initiation + callback
│   │   │   ├── webhooks/       # Corsair webhook processing
│   │   │   └── trpc/           # tRPC HTTP handler
│   │   └── _components/
│   │       ├── agent/          # AI copilot panel, compose panel
│   │       ├── ui/             # Shared UI components
│   │       └── landing/        # Landing page
│   ├── server/
│   │   ├── api/
│   │   │   ├── routers/        # tRPC routers (gmail, calendar, agent, dashboard, search, admin)
│   │   │   └── tasks/          # Background tasks (embeddings, prioritizer)
│   │   ├── db/
│   │   │   ├── schema.ts       # Drizzle schema with indexes & constraints
│   │   │   └── index.ts        # Database connection
│   │   ├── corsair.ts          # Corsair instance config
│   │   ├── better-auth/        # Auth configuration
│   │   └── subscription.ts     # Premium verification via Dodo Payments
│   └── env.js                  # Zod-validated environment schema
├── drizzle/                    # Migration files
├── docs/                       # Technical documentation
└── .env.example                # All required environment variables
```

---

## 🛠️ Tech Stack

| Layer        | Technology                                    |
| ------------ | --------------------------------------------- |
| Framework    | Next.js 15 (App Router, Turbopack)            |
| Language     | TypeScript                                    |
| Styling      | Tailwind CSS v4                               |
| Database     | PostgreSQL + pgvector (HNSW)                  |
| ORM          | Drizzle ORM                                   |
| Auth         | Better Auth (Google OAuth)                    |
| API          | tRPC v11                                      |
| Integrations | Corsair (Gmail + Google Calendar plugins)     |
| AI Agent     | Mastra Core + Corsair MCP Provider            |
| LLMs         | DeepSeek v4 Pro/Flash, Gemini 2.5 Flash/Lite  |
| Embeddings   | Gemini Embedding 2/001, OpenRouter (fallback) |
| Payments     | Dodo Payments                                 |
| Deployment   | Vercel / Docker / Azure Container Apps        |

---

## 🚀 Setup

### Prerequisites

- [Node.js v20+](https://nodejs.org)
- [pnpm v10+](https://pnpm.io)
- PostgreSQL with `pgvector` extension ([Neon](https://neon.tech) recommended)

### 1. Clone & Install

```bash
git clone https://github.com/Axemoth/Singularity.git
cd singularity
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Fill in your `.env`:

| Variable                       | Description                                               | Required         |
| ------------------------------ | --------------------------------------------------------- | ---------------- |
| `BETTER_AUTH_SECRET`           | Random 32-char string for session signing                 | Yes (production) |
| `GOOGLE_CLIENT_ID`             | Google Cloud OAuth client ID                              | Yes              |
| `GOOGLE_CLIENT_SECRET`         | Google Cloud OAuth client secret                          | Yes              |
| `DATABASE_URL`                 | PostgreSQL connection string                              | Yes              |
| `CORSAIR_KEK`                  | 32-byte hex key for token encryption                      | Yes              |
| `CORSAIR_WEBHOOK_SECRET`       | Optional shared secret for Corsair webhook authentication | Recommended      |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API key (embeddings + models)                      | Yes              |
| `OPENROUTER_API_KEY`           | OpenRouter API key (embedding fallback)                   | Yes              |
| `DEEPSEEK_API_KEY`             | DeepSeek API key (AI copilot)                             | Optional         |
| `DODO_PAYMENTS_API_KEY`        | Dodo Payments API key                                     | Yes              |
| `DODO_PAYMENTS_WEBHOOK_SECRET` | Webhook signature verification                            | Recommended      |
| `APP_URL`                      | App base URL (`http://localhost:3000`)                    | Yes              |

### 3. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) -> APIs & Services -> Credentials
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add Authorized JavaScript origins: `http://localhost:3000`
4. Add Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (Better Auth)
   - `http://localhost:3000/api/connect/callback` (Corsair OAuth)
5. Enable the **Gmail API** and **Google Calendar API** in the API Library
6. Configure the OAuth consent screen with the following scopes:
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.compose`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`

### 4. Database Setup

```bash
pnpm db:push        # Push schema to database
pnpm db:studio      # (Optional) Open Drizzle Studio
```

### 5. Run

```bash
pnpm dev             # Starts on http://localhost:3000
```

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import in [Vercel](https://vercel.com)
3. Add all `.env` variables to project settings
4. Deploy
5. Update Google Cloud Console with your Vercel URL in authorized origins and redirect URIs

### Docker / Azure

```bash
docker build -t singularity:latest .
docker run -p 3000:3000 --env-file .env singularity:latest
```

For Azure Container Apps, push the image to ACR and deploy targeting port `3000`.

---

## Documentation

Detailed technical documentation is available in the [`docs/`](docs/) directory:

| Document                                                         | Description                                                                                        |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [Semantic Search](docs/semantic_search.md)                       | Vector embedding pipeline, HNSW index configuration, similarity ranking, and search UI integration |
| [Multi-Account Integrations](docs/multi_account_integrations.md) | OAuth connection flow, tenant slot pairing algorithm, premium account limits                       |
| [AI Agent & Routing](docs/agent_routing.md)                      | Careful vs Autonomous modes, DeepThink reasoning, model fallback chain, MCP tool architecture      |
| [Demo Checklist](docs/demo_checklist.md)                         | Setup, security checks, and rubric-aligned demo path for evaluators                                |

---

## Security

- **OAuth tokens** encrypted at rest via Corsair KEK
- **Session auth** via Better Auth with secure HTTP-only cookies + CSRF state validation
- **Input validation** on all tRPC procedures using Zod schemas (email format, UUID, bounded strings, datetime validation)
- **Ownership verification** on every mutation: tenantId checked against authenticated userId
- **Webhook authentication** for Corsair webhooks with optional `CORSAIR_WEBHOOK_SECRET`
- **Env validation** at build time via `@t3-oss/env-nextjs`
- **Database constraints**: unique indexes prevent duplicate entities and priority records

---

## Scripts

| Command             | Description                     |
| ------------------- | ------------------------------- |
| `pnpm dev`          | Start dev server with Turbopack |
| `pnpm build`        | Production build                |
| `pnpm check`        | Lint + type check               |
| `pnpm db:push`      | Push schema to database         |
| `pnpm db:generate`  | Generate migration files        |
| `pnpm db:migrate`   | Run migrations                  |
| `pnpm db:studio`    | Open Drizzle Studio             |
| `pnpm format:check` | Check formatting                |
| `pnpm format:write` | Fix formatting                  |

---

## License

Private. All rights reserved.
