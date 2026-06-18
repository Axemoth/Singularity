# AI Agent And MCP Routing

This document describes how Singularity routes AI requests across Gmail, Google Calendar, and local search while keeping write actions safe.

## Modes

### Careful Mode

Careful mode is the default review-first mode.

- `send_email` is not exposed to the model in the tool list.
- Direct email sending is also blocked at tool execution time as a backend guardrail.
- MCP `run_script` calls are inspected for write operations such as `.create(`, `.update(`, `.delete(`, `.patch(`, `.post(`, and `.send(`.
- If a script write is attempted in Careful mode, the backend rejects it with `FORBIDDEN`.
- `create_draft` remains available so the agent can prepare email drafts for review.

This means safety is enforced by backend code, not only by prompt instructions.

### Autonomous Mode

Autonomous mode allows direct writes when the user gives a clear instruction.

- `send_email` is exposed.
- MCP write scripts may execute.
- Ambiguous requests must still be clarified with option buttons before execution.
- Once any write tool runs, fallback model retries are stopped to avoid duplicate sends or duplicate calendar changes.

## Tenant Routing

Premium users can connect multiple Gmail and Google Calendar accounts. The agent resolves active tenant IDs from the authenticated user's connected accounts.

- Gmail tools use the selected Gmail tenant, or the first connected Gmail account.
- Calendar tools use the selected calendar tenant, or the first connected Calendar account.
- If Gmail and Calendar live in different tenant slots, the backend builds separate MCP tool lists and routes `run_script` calls to the right tenant.
- User-selected account context is passed as `targetEmail`.

## First-Party Tools

The agent includes first-party tools for the most important workflows:

- `send_email`: sends a MIME email through Gmail. Only available in Autonomous mode.
- `create_draft`: creates a Gmail draft for review.
- `search_local`: searches cached Gmail threads and Calendar events through pgvector.
- `search_contacts`: resolves names from cached email headers.

## MCP Tool Handling

Corsair MCP tools are still available for advanced operations. The wrapper adds:

- tenant routing for Gmail vs Calendar scripts
- write-operation detection
- Careful-mode blocking
- duplicate-write fallback prevention

## Frontend Actions

The agent can return structured action cards for UI-only or approval-based actions:

- open route
- refresh inbox
- refresh calendar
- show draft
- confirm archive threads
- confirm delete threads

Approval actions verify thread ownership on the backend before executing.
