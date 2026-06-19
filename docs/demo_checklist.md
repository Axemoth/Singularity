# Demo Checklist

Use this checklist before recording or presenting the project.

## Setup

1. Copy `.env.example` to `.env`.
2. Fill Google OAuth, Corsair, database, AI, and Dodo values.
3. Set `APP_URL` to the demo URL.
4. Set `CORSAIR_WEBHOOK_SECRET` and send it as `x-corsair-webhook-secret` for Corsair webhook requests.
5. Run `pnpm install`.
6. Run `pnpm db:push`.
7. Run `pnpm typecheck`.
8. Run `pnpm dev`.

## Demo Flow

1. Sign in with Google.
2. Connect Gmail.
3. Connect Google Calendar.
4. Open Inbox and sync messages.
5. Show priority tabs, unread counts, archive, delete, and reply.
6. Open Calendar and create an event.
7. Use dashboard metrics.
8. Search across email and calendar.
9. Open the agent.
10. In Careful mode, ask it to send an email and confirm it creates a draft instead.
11. In Autonomous mode, ask for a clear direct action and show execution.
12. Show multi-account selector if premium accounts are connected.

## Rubric Evidence

| Rubric Area            | Evidence                                                         |
| ---------------------- | ---------------------------------------------------------------- |
| Corsair Integration    | OAuth connect routes, webhook route, tenant-scoped Corsair calls |
| Gmail Workflow         | Inbox, compose, reply, drafts, archive, delete, priority         |
| Calendar Workflow      | List/day/week/month views, create/delete events, sync            |
| Productivity UX        | Keyboard shortcuts, dashboard, search, command-style agent       |
| AI and MCP Usage       | Mastra agent, Corsair MCP tools, local search, safety modes      |
| Engineering Quality    | Zod validation, ownership checks, typecheck, docs                |
| Demo and Documentation | README, architecture doc, docs folder, this checklist            |
