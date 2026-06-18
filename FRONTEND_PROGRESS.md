# Frontend Progress

This document tracks the current product surface for the Gmail and Google Calendar command center.

## Current Status

- Phase 1: Foundation - complete
- Phase 2: Inbox and Email - core workflow complete
- Phase 3: Compose and AI - core workflow complete
- Phase 4: Calendar - core workflow complete
- Phase 5: Power Features - partially complete

## Implemented Product Surface

### Foundation

- Authenticated app shell with sidebar navigation, settings, profile controls, and theme support.
- Reusable UI primitives for buttons, modals, avatars, badges, tooltips, and search inputs.
- Type models for Gmail, Calendar, account, and agent workflows.

### Inbox and Email

- Unified inbox route at `src/app/(app)/inbox/page.tsx`.
- Thread list with read state, account context, search, refresh, and selection behavior.
- Thread detail panel with message rendering through a sandboxed email renderer.
- Gmail tRPC router with Zod validation for bounded search, labels, pagination, thread IDs, recipients, and safe email headers.

### Compose and AI

- Compose modal with recipient, cc, bcc, subject, and body controls.
- Draft creation and send flows backed by the Gmail router.
- AI agent panel available from the authenticated app shell.
- Agent write actions are split between draft-first actions, explicit confirmations, and autonomous mode.

### Calendar

- Calendar route at `src/app/(app)/calendar/page.tsx`.
- Event listing, create/edit flow, attendee inputs, and integration-aware event operations.
- Local date/time input is converted with the browser timezone offset before submission, reducing timezone drift between UI and backend.

### Power Features

- Cross-route AI assistant context from the current route.
- Agent action cards for navigation, refresh, draft preview, and confirmed thread operations.
- Corsair MCP tool wrapping with tenant-aware routing and careful-mode write blocking.

## Remaining Polish

- Broaden keyboard shortcuts and command palette coverage.
- Add more empty/loading/error states for edge cases such as expired integrations.
- Add end-to-end tests around the evaluator demo path.
