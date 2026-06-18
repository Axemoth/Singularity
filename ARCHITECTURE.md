# Singularity Architecture

Singularity is a Next.js command center for Gmail and Google Calendar. It combines Better Auth, Postgres, Corsair integrations, tRPC, and an AI agent surface so users can triage mail, manage events, and delegate safe workflow steps from one product.

## Runtime Shape

```text
Browser
  -> Next.js app router
  -> tRPC routers
  -> Drizzle/Postgres application tables
  -> Corsair integration tables and MCP tools
  -> Gmail and Google Calendar APIs
```

The authenticated app shell exposes Inbox, Calendar, Settings, and the AI agent panel. Gmail and Calendar data is routed through server procedures so Zod validation, session checks, tenant scoping, and integration ownership checks are applied before external calls.

## Authentication

- Better Auth manages sessions with HTTP-only cookies.
- Google OAuth is the primary sign-in path.
- Google account connections are stored as integration accounts and scoped by the authenticated user.
- Server procedures derive the active user from the session and never trust a client-supplied user ID for ownership.

## Corsair Integration

- Corsair is used for Gmail, Calendar, webhook ingestion, and MCP tool access.
- Tenant routing is based on the authenticated user ID.
- Multi-account support is represented by integration records under the same user tenant.
- Webhooks are processed by `src/app/api/webhooks/route.ts`.
- Deployments can set `CORSAIR_WEBHOOK_SECRET` to require a matching `x-corsair-webhook-secret`, `x-webhook-secret`, or bearer token on webhook requests.

## Data Model

Postgres stores:

- Auth users, sessions, and accounts.
- Corsair integration accounts, entities, and events.
- Email priority metadata and search/indexing support.
- App settings and workflow state.

Entity queries are tenant-scoped and filtered by integration or entity type where required. Gmail thread mutations validate that requested thread IDs belong to the signed-in user before executing write actions.

## Gmail Workflow

The Gmail router validates:

- Pagination bounds and search strings.
- Thread IDs and label IDs.
- Email addresses, cc, bcc, subject, body, and parent message headers.
- Header safety to reject CR/LF injection in outbound messages and drafts.

The frontend renders messages in a sandboxed email renderer and keeps compose/send operations behind server procedures.

## Calendar Workflow

The Calendar router validates event titles, descriptions, locations, attendees, time bounds, and event IDs. The calendar UI converts local date/time picker values into offset-aware datetimes before submission, and the backend normalizes valid datetimes before calling Calendar operations.

## AI Agent

The agent router provides:

- Careful mode: draft/search/read-oriented behavior with backend write blocking for direct send or MCP write tools.
- Autonomous mode: write tools can execute when explicitly selected by the user.
- Confirmed actions: destructive Gmail thread operations are executed through a separate confirmation mutation with ownership checks.
- MCP wrapping: Corsair MCP tools are exposed through a guard that detects write-like operations and prevents duplicate fallback writes.

## Validation and Security Boundaries

- All public tRPC inputs use Zod schemas.
- Mutations require authenticated sessions.
- Gmail and Calendar write operations verify integration ownership.
- Outbound email headers are checked server-side for control characters.
- Corsair webhooks can be protected with `CORSAIR_WEBHOOK_SECRET`.
- Environment variables are validated through `src/env.js`.

## Evaluator Demo Path

1. Sign in with Google.
2. Connect Gmail and Calendar through Corsair.
3. Load unified inbox, search messages, open a thread, and create a draft.
4. Create or edit a calendar event and verify timezone-correct display.
5. Ask the agent to summarize/search first in careful mode.
6. Switch to autonomous mode only for an intentional write workflow.
7. Trigger a webhook with the configured secret.

See `docs/demo_checklist.md` for the detailed rubric-aligned checklist.
