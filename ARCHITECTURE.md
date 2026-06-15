# Singularity — System Architecture

> Superhuman-style Gmail & Google Calendar Workflow App  
> Built with Next.js, PostgreSQL, Corsair, and AI

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Authentication Flow (Gmail-Only Login)](#2-authentication-flow-gmail-only-login)
3. [Multi-Account Model](#3-multi-account-model)
4. [Data Architecture](#4-data-architecture)
5. [Webhook Pipeline (Real-Time)](#5-webhook-pipeline-real-time)
6. [Cross-Account Features](#6-cross-account-features)
7. [AI Agent Integration (MCP Chat)](#7-ai-agent-integration-mcp-chat)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Current State vs Target State](#9-current-state-vs-target-state)
10. [Environment Variables Required](#10-environment-variables-required)

---

## 1. High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  Next.js App (Superhuman-style UI)                          │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌────────────────┐  │
│  │ Unified  │ │ Calendar │ │ Command │ │  AI Agent Chat │  │
│  │  Inbox   │ │   View   │ │ Palette │ │  (Corsair MCP) │  │
│  └────┬─────┘ └────┬─────┘ └────┬────┘ └───────┬────────┘  │
│       │             │            │               │           │
│       └─────────────┴────────────┴───────────────┘           │
│                          │                                   │
│                     tRPC / Server Actions                    │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────┴───────────────────────────────────┐
│                        BACKEND                                │
│                                                               │
│  ┌────────────┐    ┌──────────────────────────────────┐      │
│  │ Better Auth│    │           Corsair SDK             │      │
│  │ (Google    │    │  ┌────────┐  ┌──────────────┐    │      │
│  │  OAuth)    │    │  │ Gmail  │  │ Google Cal   │    │      │
│  └─────┬──────┘    │  │ Plugin │  │   Plugin     │    │      │
│        │           │  └────┬───┘  └──────┬───────┘    │      │
│        │           │       │             │            │      │
│        │           │  Webhook Handler (real-time)     │      │
│        │           └──────────────┬───────────────────┘      │
│        │                         │                           │
│  ┌─────┴─────────────────────────┴─────────────────────┐     │
│  │              PostgreSQL (Drizzle ORM)                │     │
│  │  ┌──────────┐ ┌────────────────┐ ┌──────────────┐   │     │
│  │  │  Users   │ │ Corsair Tables │ │  App Tables  │   │     │
│  │  │ Sessions │ │  (accounts,    │ │ (priorities, │   │     │
│  │  │ Accounts │ │   entities,    │ │  filters,    │   │     │
│  │  │          │ │   events)      │ │  settings)   │   │     │
│  │  └──────────┘ └────────────────┘ └──────────────┘   │     │
│  └─────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
                           │
                    ┌──────┴───────┐
                    │  Google APIs │
                    │  Gmail API   │
                    │  Calendar API│
                    └──────────────┘
```

---

## 2. Authentication Flow (Gmail-Only Login)

### Current State

- Better Auth is configured with **GitHub OAuth** only
- Email/password auth is enabled but not needed

### Target State

- Replace GitHub OAuth with **Google OAuth**
- Request Gmail + Calendar API scopes during login
- User's first Gmail account is automatically connected via Corsair

### Flow

```
User clicks "Sign in with Google"
        │
        ▼
Better Auth redirects to Google OAuth consent screen
  (Scopes: email, profile, gmail.readonly, gmail.send,
   gmail.modify, calendar.readonly, calendar.events)
        │
        ▼
Google redirects back with authorization code
        │
        ▼
Better Auth exchanges code for tokens,
creates/updates user record in `user` table,
stores OAuth tokens in `account` table
        │
        ▼
Post-login hook fires:
  1. Create Corsair tenant (tenantId = user.id)
  2. Connect Gmail account via corsair.withTenant(userId)
  3. Connect Google Calendar via corsair.withTenant(userId)
        │
        ▼
User lands on Unified Inbox (all emails loaded)
```

### Config Changes Required

**`src/server/better-auth/config.ts`** — Replace GitHub with Google:

```typescript
socialProviders: {
    google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        scope: [
            "openid", "email", "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/calendar.events"
        ],
    },
},
```

---

## 3. Multi-Account Model

### Concept

Each **user** in the app is a **Corsair tenant**. Each tenant can link **multiple Gmail/Calendar accounts**.

```
User (Better Auth)
  └── Tenant ID = user.id
        ├── Gmail Account 1 (primary — from login)
        │     ├── Gmail API access
        │     └── Google Calendar API access
        ├── Gmail Account 2 (added later via "Add Account")
        │     ├── Gmail API access
        │     └── Google Calendar API access
        └── Gmail Account 3 (added later)
              ├── Gmail API access
              └── Google Calendar API access
```

### How It Works

| Step | Action                         | Corsair Call                                                     |
| ---- | ------------------------------ | ---------------------------------------------------------------- |
| 1    | User logs in with Gmail        | Automatic — primary account created                              |
| 2    | User clicks "Add Account"      | Redirect to Google OAuth with new account                        |
| 3    | OAuth callback received        | `corsair.withTenant(userId).gmail.connect(tokens)`               |
| 4    | Fetch emails from Account 2    | `corsair.withTenant(userId).gmail.api.threads.list({accountId})` |
| 5    | Compare emails across accounts | Query `corsair_entities` table filtered by tenant                |

### Database Mapping

```
corsair_accounts table:
┌────────────┬───────────┬────────────────┐
│ tenant_id  │ account_id│ integration_id │
├────────────┼───────────┼────────────────┤
│ user_abc   │ acct_001  │ gmail          │  ← Primary Gmail
│ user_abc   │ acct_002  │ gmail          │  ← Second Gmail
│ user_abc   │ acct_003  │ gmail          │  ← Third Gmail
│ user_abc   │ acct_004  │ googlecalendar │  ← Primary Calendar
│ user_abc   │ acct_005  │ googlecalendar │  ← Second Calendar
└────────────┴───────────┴────────────────┘
```

Each account row stores encrypted OAuth credentials (encrypted with the KEK). Corsair automatically handles token refresh.

---

## 4. Data Architecture

### Tables Overview

```
┌─ Better Auth ──────────────────────────────────────┐
│  user            → Core user record                │
│  session         → Active sessions                 │
│  account         → OAuth provider accounts         │
│  verification    → Email verification tokens       │
└────────────────────────────────────────────────────┘

┌─ Corsair ──────────────────────────────────────────┐
│  corsair_integrations → Plugin definitions         │
│  corsair_accounts     → Per-tenant linked accounts │
│  corsair_entities     → Cached emails, events, etc │
│  corsair_events       → Webhook event log          │
└────────────────────────────────────────────────────┘

┌─ App-Specific (to be created) ─────────────────────┐
│  email_priorities → LLM-assigned priority levels   │
│  user_settings    → Per-user UI preferences        │
│  labels           → Custom label/folder mappings   │
│  shortcuts        → Custom keyboard shortcut maps  │
└────────────────────────────────────────────────────┘
```

### How Email Data Flows

```
Google Gmail API
      │
      ▼
Corsair Gmail Plugin (fetches / receives webhook)
      │
      ▼
corsair_entities table (cached locally)
  - entityType: "thread" | "message" | "draft"
  - data: full email JSON (subject, body, from, to, labels, etc.)
      │
      ▼
App queries Drizzle → renders in UI
```

This means **all emails flow through Corsair and get cached in your local Postgres**. This enables:

- Lightning-fast local search (no Gmail API round-trip)
- Cross-account queries (JOIN across entities by tenant)
- Offline-capable email reading

---

## 5. Webhook Pipeline (Real-Time)

### Current State

- Webhook route exists at `src/app/api/webhooks/route.ts`
- **tenantId is hardcoded to `'dev'`** — needs to be dynamic

### Target Architecture

```
Google Push Notification
  (new email / calendar event)
        │
        ▼
  Ngrok tunnel (dev) / Production URL
        │
        ▼
  POST /api/webhooks
        │
        ▼
  Extract tenantId from webhook headers/payload
        │
        ▼
  corsair.processWebhook(headers, body, { tenantId })
        │
        ▼
  Corsair stores event in corsair_events table
  and updates corsair_entities (cached data)
        │
        ▼
  Server-Sent Events / WebSocket push to frontend
        │
        ▼
  UI updates in real-time (new email appears, calendar refreshes)
```

### Webhook Route Fix (Dynamic Tenant)

The current hardcoded `tenantId: 'dev'` needs to be replaced with dynamic lookup based on the webhook payload. Corsair includes metadata in the webhook that maps back to the account, which maps to the tenant.

---

## 6. Cross-Account Features

### Unified Inbox

All emails from all connected Gmail accounts appear in a single, merged timeline, sorted by date. Each email shows which account it belongs to with a colored badge.

```
┌─────────────────────────────────────────────────┐
│  UNIFIED INBOX                                   │
│                                                  │
│  ● [work@gmail.com]  Meeting tomorrow — 2m ago  │
│  ● [personal@gmail.com] Your order... — 5m ago  │
│  ● [work@gmail.com]  Q3 Budget Review — 12m ago │
│  ● [side@gmail.com]  Invoice #4521 — 1h ago     │
└─────────────────────────────────────────────────┘
```

### Cross-Account Comparison

Side-by-side view to compare conversations across accounts:

- "Show me all emails from john@company.com across all my accounts"
- Thread merging: same conversation happening on different accounts
- Identify duplicate emails received on multiple accounts

### Unified Calendar

All calendars from all accounts merged into one view with color coding per account.

---

## 7. AI Agent Integration (MCP Chat)

### How the MCP Agent Works

```
User types in chat:
  "Send a calendar invite to friend@corsair.dev at 9 AM
   next Thursday. Send him an email too saying I look
   forward to our meeting."
        │
        ▼
  Mastra Agent (Gemini 2.5 Flash / Gemma 4 fallback)
        │
        ├── Tool: list_operations → discover APIs
        ├── Tool: get_schema → learn required args
        └── Tool: run_script → execute operations
              │
              ├── corsair.withTenant(userId)
              │     .googlecalendar.api.events.insert({
              │       summary: "Meeting",
              │       attendees: ["friend@corsair.dev"],
              │       start: "next Thursday 9 AM",
              │     })
              │
              └── corsair.withTenant(userId)
                    .gmail.api.messages.send({
                      to: "friend@corsair.dev",
                      subject: "Looking forward to our meeting",
                      body: "I look forward to our meeting."
                    })
        │
        ▼
  Agent responds: "Done! Calendar invite sent and email
  delivered to friend@corsair.dev."
```

### Integration in the App

The MCP agent chat will be a slide-out panel accessible from any page. The agent:

- Has full access to the user's Corsair tenant
- Can read, send, draft emails
- Can create, update, delete calendar events
- Can search across accounts
- Always scoped to the logged-in user's tenant ID

### Implemented Agent Chat Contract

Current implementation:

- `src/server/api/routers/agent.ts` exposes `agent.chat`.
- `agent.chat` accepts the user's message plus frontend context such as the current route, selected thread ID, selected event ID, and selected entity IDs.
- The backend still uses Mastra + Gemini + Corsair MCP tools, scoped to `ctx.session.user.id`.
- The response now includes assistant text plus structured frontend actions.
- `agent.confirmAction` executes approved Gmail-changing actions, currently archive and trash for selected thread IDs.
- `src/app/_components/agent/agent-panel.tsx` renders the global chat drawer and action cards.
- `src/app/(app)/layout.tsx` mounts the agent drawer globally for authenticated routes.

Recommended next architecture step:

- Persist conversations and tool runs in database tables.
- Add streaming events for tool progress.
- Replace broad action inference with first-party app tools such as `searchInbox`, `draftReply`, `findFreeSlots`, and `summarizeToday`.
- Feed selected inbox/calendar state into the panel once those screens are built.

---

## 8. Frontend Architecture

### Pages & Routes

```
/                           → Landing / Login page (Google OAuth)
/inbox                      → Unified Inbox (all accounts)
/inbox/[threadId]           → Email thread detail view
/compose                    → Compose new email (select account)
/calendar                   → Unified Calendar view
/calendar/[eventId]         → Event detail / edit
/settings                   → Account management, shortcuts, preferences
/settings/accounts          → Add/remove Gmail accounts
```

### Key UI Components

| Component         | Purpose                                                  |
| ----------------- | -------------------------------------------------------- |
| `UnifiedInbox`    | Merged email list from all accounts with priority badges |
| `ThreadView`      | Full email thread with reply/forward/archive actions     |
| `ComposeModal`    | Draft & send emails (select which account to send from)  |
| `CalendarView`    | Week/month view with all calendars merged                |
| `CommandPalette`  | Ctrl+K powered command bar for quick actions             |
| `AgentChat`       | Slide-out AI chat panel for natural language commands    |
| `AccountSwitcher` | Switch between / manage connected Gmail accounts         |
| `PriorityBadge`   | LLM-assigned priority indicator (urgent/normal/low)      |
| `SearchBar`       | Advanced search with filters (from, to, date, labels)    |

### Keyboard Shortcuts (Superhuman-style)

| Key       | Action                           |
| --------- | -------------------------------- |
| `j` / `k` | Navigate down / up in email list |
| `Enter`   | Open selected email thread       |
| `Escape`  | Go back to inbox                 |
| `c`       | Compose new email                |
| `r`       | Reply to current email           |
| `f`       | Forward current email            |
| `e`       | Archive current email            |
| `#`       | Delete / trash current email     |
| `/`       | Focus search bar                 |
| `Ctrl+K`  | Open command palette             |
| `g i`     | Go to inbox                      |
| `g c`     | Go to calendar                   |
| `g s`     | Go to settings                   |

---

## 9. Current State vs Target State

| Area              | Current State                     | Target State                               |
| ----------------- | --------------------------------- | ------------------------------------------ |
| **Auth**          | GitHub OAuth only                 | Google OAuth only (Gmail scopes)           |
| **Frontend**      | T3 boilerplate, single page       | Full Superhuman-style UI                   |
| **Gmail**         | Plugin installed, not wired to UI | Full inbox, compose, search, archive       |
| **Calendar**      | Plugin installed, not wired to UI | Full calendar view with event management   |
| **Multi-account** | Single hardcoded 'dev' tenant     | Dynamic tenant per user, multiple accounts |
| **Webhooks**      | Route exists, hardcoded tenant    | Dynamic tenant, real-time UI updates       |
| **AI Agent**      | Standalone script (`agent.ts`)    | Integrated chat panel in the app           |
| **Search**        | None                              | Corsair search API + local entity search   |
| **Keyboard**      | None                              | Full Superhuman-style shortcut system      |
| **Priority**      | None                              | LLM-powered email priority classification  |

---

## 10. Environment Variables Required

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/singularity"

# Better Auth
BETTER_AUTH_SECRET="your-secret-here"
BETTER_AUTH_URL="http://localhost:3000"

# Google OAuth (for Better Auth social login)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Corsair
CORSAIR_KEK="your-key-encryption-key"

# Google AI (for Gemini / Gemma agent)
GOOGLE_GENERATIVE_AI_API_KEY="your-gemini-api-key"

# Webhooks (optional, for local dev)
NGROK_URL="https://your-subdomain.ngrok.io"
```

### Google Cloud Console Setup Required

1. Create a Google Cloud project
2. Enable Gmail API and Google Calendar API
3. Create OAuth 2.0 Client ID (Web Application)
4. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Copy Client ID and Client Secret to `.env`
