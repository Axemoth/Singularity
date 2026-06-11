# Project Specification: Singularity (Superhuman-Style Gmail & Google Calendar Workflow App)

This document serves as the canonical reference for the project goals, requirements, technical stack, and architecture guidelines.

---

## 1. Project Goal
Build a high-performance, keyboard-driven, Superhuman-style client for managing email (Gmail) and calendar (Google Calendar) workflows. The app aims to solve the limitations of generic interfaces by allowing custom, optimized, and seamless workflows tailored to specific user needs, powered by the **Corsair** integration layer.

---

## 2. Technical Stack
- **Framework:** Next.js (TypeScript)
- **Database:** PostgreSQL (with Drizzle ORM)
- **Integration Layer:** Corsair SDK / App (with `@corsair-dev/mcp`, `@corsair-dev/gmail`, `@corsair-dev/googlecalendar`, etc.)
- **Styling:** Vanilla CSS / TailwindCSS (based on Tailwind v4 configurations already configured in the project)
- **Optional Tools:** Ngrok (for webhook routing and testing local endpoints)

---

## 3. Mandatory Requirements
- [ ] **Gmail Integration:** Deeply integrate Gmail via Corsair. Enable intuitive searching, drafting, sending, and receiving of emails.
- [ ] **Google Calendar Integration:** Deeply integrate Google Calendar via Corsair. Enable seamless scheduling, calendar invites, and event updates.
- [ ] **Dynamic Data:** No hardcoded Gmail or Calendar data is permitted. All data must be fetched and manipulated live via Corsair.
- [ ] **Meaningful Workflow Improvement:** A basic clone of Gmail is not sufficient. The app must include at least one significant, high-value workflow improvement (e.g., automated scheduling, unified inbox/calendar actions, or fast batch tasks).
- [ ] **Intentional AI Integration:** Artificial Intelligence features should enhance the user's workflow directly, rather than being added as a superficial feature.

---

## 4. Bonus Tasks & Advanced Features
- [ ] **Corsair MCP Agent Chat:** Add an interactive agent chat where users can execute complex operations using natural language.
  - *Example:* `"Send a calendar invite to friend@corsair.dev at 9 AM next Thursday. Send him an email too saying I look forward to our meeting."`
- [ ] **Real-time Webhooks:** Configure Corsair's built-in webhooks to receive incoming emails and calendar invites instantly, eliminating polling.
- [ ] **Keyboard-Driven Shortcuts:** Wire in keyboard shortcuts (keystrokes) for all common actions to create an ultra-fast Superhuman-like experience.
- [ ] **Priority Email Filtering:** Automatically scan incoming email subjects and bodies using a fast, cheap LLM to categorize and prioritize them.
- [ ] **Corsair Advanced Search UI:** Build a clean, powerful visual query builder around the Gmail advanced search API.
- [ ] **Vector Database & Local Search:** Add a pgvector extension (or local vector database) to PostgreSQL. Cache emails passing through Corsair and index them to allow lightning-fast local semantic searches in under a second.

---

## 5. Rules & Evaluation Criteria
- **No Placeholders:** All UI components must be fully interactive and functional.
- **Rich Aesthetics:** Ensure high-quality web design with premium typography, sleek dark mode transitions, and micro-animations.
- **Workflow Focus:** Prioritize productivity and efficiency over raw feature count.
