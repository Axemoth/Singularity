# Frontend Progress & Future Phases Roadmap

This document outlines the completed frontend tasks in **Phase 1: Foundation** and provides the step-by-step roadmap for subsequent phases.

---

## ── Current Status ──

- **Phase 1: Foundation**: 🟩 **100% COMPLETE** (Ready for review)
- **Phase 2: Inbox & Email**: ⬜ _Not Started_
- **Phase 3: Compose & AI**: ⬜ _Not Started_
- **Phase 4: Calendar**: ⬜ _Not Started_
- **Phase 5: Power Features**: ⬜ _Not Started_

---

## ── Phase 1: Completed Work ──

The foundational styling, main layout, route protection, reusable UI components, and TypeScript models are fully implemented. The project builds and passes typechecks cleanly.

### 1. Design System & Theme

- **File**: [globals.css](file:///c:/Users/ASUS/Desktop/Axehuman/singularity/src/styles/globals.css)
- **Implemented**:
  - Implemented the Superhuman-inspired **"Carbon" dark & light themes** using Tailwind CSS v4's new `@theme` configuration.
  - Defined 5 levels of surface/elevation colors to establish structural hierarchy: base, raised, overlay, surface, and inset.
  - Implemented smooth animation transitions (`fadeIn`, `slideUp`, `scaleIn`, and pulse effects) along with glassmorphism layout classes.
  - Integrated theme switcher provider (`src/app/_components/theme-provider.tsx`) allowing automatic system detection and local storage persistence.

### 2. App Shell & Structure

- **Files**: [(app)/layout.tsx](<file:///c:/Users/ASUS/Desktop/Axehuman/singularity/src/app/(app)/layout.tsx>), [sidebar.tsx](file:///c:/Users/ASUS/Desktop/Axehuman/singularity/src/app/_components/ui/sidebar.tsx)
- **Implemented**:
  - Main dashboard wrapper with responsive layout and fixed sidebar structure.
  - Left-hand navigation sidebar featuring icons for Inbox, Calendar, and Settings.
  - Integrated custom action triggers (Compose button, profile dropdown menu, dark mode toggle).

### 3. Public Auth UI & Route Protection

- **Files**: [(auth)/login/page.tsx](<file:///c:/Users/ASUS/Desktop/Axehuman/singularity/src/app/(auth)/login/page.tsx>), [middleware.ts](file:///c:/Users/ASUS/Desktop/Axehuman/singularity/src/middleware.ts), [page.tsx](file:///c:/Users/ASUS/Desktop/Axehuman/singularity/src/app/page.tsx)
- **Implemented**:
  - **Login View**: High-fidelity animated landing page with gradient ambient glows, Google sign-in form, and brand header.
  - **Routing Guard**: Implemented Next.js middleware checking for user session cookies (`better-auth.session_token`). Automatically redirects unauthenticated traffic trying to reach `/inbox`, `/calendar`, or `/settings` back to `/login`.
  - **Auto-redirection**: Configured root `/` route to automatically evaluate authorization status and redirect the user directly to `/inbox` (if logged in) or `/login` (if logged out).

### 4. Reusable UI Components

- **Directory**: `src/app/_components/ui/`
- **Implemented**:
  - **Button**: Custom variant options (Primary, Secondary, Ghost, Danger) with keyboard shortcut markers and loading spinner states.
  - **Modal**: Slides up from bottom with backdrop blur, automatic focus trapping, and ESC-key dismiss.
  - **Avatar**: Initials avatar generator using deterministic HSL coloring depending on username.
  - **Badge**: Visual markers for labels, priorities, and mail accounts.
  - **Tooltip**: Hover overlays showing keyboard shortcut associations.
  - **SearchInput**: Focus animations with clear action button.

### 5. Type Systems

- **Directory**: `src/types/`
- **Implemented**:
  - **Email Types** (`email.ts`): Models matching Corsair Gmail API integration outputs including Accounts, Labels, Messages, and Thread priority ratings.
  - **Calendar Types** (`calendar.ts`): Models matching Corsair Google Calendar APIs including Calendar items, Attendees, and Scheduling events.

---

## ── Future Phases Roadmap ──

### Phase 2: Inbox & Email Lists

- **Objective**: Build the core split-pane email interface (like Superhuman) where users browse threads on the left and read selected threads on the right.
- **Component Checklist**:
  - [ ] `src/app/(app)/inbox/page.tsx`: Double-pane layout page.
  - [ ] `src/app/_components/inbox/email-list.tsx`: Scrollable list of threads with status badges (unread/important/labels) and multi-account indicators.
  - [ ] `src/app/_components/inbox/email-list-item.tsx`: Email line component supporting focus states and hover actions.
  - [ ] `src/app/_components/inbox/thread-view.tsx`: Thread viewer that expands message chains, rendering inline reply cards.
  - [ ] `src/app/_components/inbox/message-card.tsx`: Individual message body renderer (supporting rich text rendering, custom files, and attachments).

### Phase 3: Email Composition & AI Draft Detection

- **Objective**: Implement compose functionalities and integrate an AI agent that detects if an email is important and suggests saving it to Google drafts.
- **Component Checklist**:
  - [ ] `src/app/_components/compose/compose-modal.tsx`: Modal interface featuring autocompleting To/Cc/Bcc inputs, subject field, and formatting options.
  - [ ] `src/app/_components/compose/importance-banner.tsx`: A banner alerting the user when AI evaluates email importance, giving suggestions to "Save Draft" or "Send Immediately".
  - [ ] `src/server/api/routers/email.ts` (Backend/tRPC): The validation route analyzing content using Google Gemini 2.5 Flash to return draft recommendations.

### Phase 4: Google Calendar Integrations

- **Objective**: Render a calendar layout showing events aggregated across connected Google/Gmail calendars.
- **Component Checklist**:
  - [ ] `src/app/(app)/calendar/page.tsx`: Main calendar workspace.
  - [ ] `src/app/_components/calendar/calendar-view.tsx`: Interactive week/day grid layout matching modern productivity apps.
  - [ ] `src/app/_components/calendar/event-card.tsx`: Spanned cards indicating reservation timing, details, and color indicators based on linked account.
  - [ ] `src/app/_components/calendar/event-detail-modal.tsx`: Popup window allowing detail viewing, editing, deletion, or inviting additional attendees.

### Phase 5: Keyboard Navigation & Power Features

- **Objective**: Create a keyboard-first flow allowing full application controls via hotkeys and a global commands list.
- **Component Checklist**:
  - [ ] `src/app/_components/keyboard/keyboard-provider.tsx`: Context tracker trapping keybind actions (e.g., `j`/`k` for scrolling list items, `c` to compose, `r` to reply).
  - [ ] `src/app/_components/command-palette/command-palette.tsx` (`Ctrl+K`): Interactive popup dialog allowing users to search, open views, or execute actions instantly.
  - [ ] `src/app/_components/keyboard/shortcuts-help-modal.tsx` (`?`): Cheat-sheet overlay indexing all hotkeys.

---

## Agentic Chat Implementation

### Phase A: Global Chat Surface

- **Status**: Complete
- **Files**:
  - `src/app/_components/agent/agent-panel.tsx`
  - `src/app/(app)/layout.tsx`
- **Implemented**:
  - Added a global floating Agent Chat button to the authenticated app shell.
  - Built a slide-out chat drawer that works across Inbox, Calendar, and Settings routes.
  - Wired the panel to the existing `agent.chat` tRPC mutation.
  - Sends current frontend route context to the backend so the agent knows where the user is working.
  - Added local chat history, assistant/system/user message states, loading state, quick prompts, and Enter-to-send behavior.

### Phase B: Structured Actions & Confirmation

- **Status**: Complete
- **Files**:
  - `src/server/api/routers/agent.ts`
  - `src/app/_components/agent/agent-panel.tsx`
- **Implemented**:
  - Extended `agent.chat` to return structured action cards alongside assistant text.
  - Added frontend action handling for opening app routes, refreshing inbox/calendar cache, and showing draft previews.
  - Added approval-only backend execution for Gmail write actions through `agent.confirmAction`.
  - Confirmable actions currently support archiving and deleting selected Gmail threads when selected IDs are supplied by future inbox UI.
  - The agent panel clearly distinguishes safe session actions from Gmail-changing actions that require approval.

### Remaining Work

- **Streaming**: Replace the current mutation response with an `/api/agent/stream` route or tRPC subscription-style flow so tool progress can appear live.
- **Persistent Memory**: Add `agent_conversations`, `agent_messages`, and `agent_runs` tables so chat history, tool calls, and approvals survive reloads.
- **Inbox Context**: When the real inbox list is built, pass selected thread IDs and selected entity IDs into `AgentPanel`.
- **Compose Integration**: Connect `show_draft` actions to the future compose modal instead of rendering draft text as a system message.
- **Calendar Context**: Pass selected event IDs and visible date range into agent context for scheduling workflows.
- **Tool Audit UI**: Add a small activity feed showing which tools the agent used and which actions are pending approval.
- **Narrow App Tools**: Add first-party tools such as `searchInbox`, `draftReply`, `findFreeSlots`, and `summarizeToday` so the agent depends less on broad MCP script execution.
