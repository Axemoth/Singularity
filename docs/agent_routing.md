# AI Co-Pilot & Agent routing Documentation

This document describes how the AI agent routes requests, switching between Careful and Autonomous modes, and how the DeepThink reasoning engine is integrated and rendered.

---

## ⚙️ AI Agent Operation Modes

Users can configure the AI agent's behavior via the Settings page. This modifies the agent's system instructions and tool constraints.

### 1. Careful Mode (Review Drafts)
*   **Default Behavior:** Safety-first mode.
*   **Mechanism:** Intercepts write operations (sending emails, updating calendar events).
*   **Gmail Actions:** The agent is restricted from using the direct send tool. If the user asks the agent to send an email, it will compose it and save it as a **Draft** in the user's Gmail instead, notifying the user that it is ready for review.
*   **Calendar Actions:** Intercepts event creations and prompts the user to review the date/time draft in the chat before scheduling.

### 2. Autonomous Mode (Autopilot)
*   **Behavior:** Direct action execution.
*   **Mechanism:** The agent is fully authorized to call write-tools (`send_email`, `create_event`) directly if the user's instruction is clear. If details (like date, time, or recipient) are missing or ambiguous, it will ask clarifying questions in the chat.

---

## 🧠 DeepThink Reasoning Engine

Singularity supports DeepThink, allowing the AI to "think" and output reasoning steps before returning a final answer.

### 1. Model Switching
The agent workspace dynamically loads the correct model based on the DeepThink toggle state in the UI (`reasoningEnabled` parameter):
*   **DeepThink Enabled (Toggle On):** Loads `deepseek-v4-pro` with thinking/reasoning enabled. This model performs deep planning before answering, showing a `<think>` block in the logs.
*   **DeepThink Disabled (Toggle Off):** Loads `deepseek-v4-flash`, providing ultra-fast, direct responses.

### 2. Reasoning Extraction Logic
The Vercel AI SDK exposes a high-level `response.reasoning` property. However, due to API structure differences, it returns an empty array `[]` (which evaluates as truthy in JavaScript), resulting in blank thinking logs.

To fix this, we implement a fallback extractor in the chat endpoint to pull raw reasoning contents:
```typescript
let reasoningText = "";
if (response.reasoning && typeof response.reasoning === "string") {
  reasoningText = response.reasoning;
} else if (response.steps && response.steps[0]) {
  const choice = response.steps[0].response?.body?.choices?.[0];
  if (choice?.message?.reasoning_content) {
    reasoningText = choice.message.reasoning_content;
  }
}
```
This reasoning text is then enclosed in `<think>...</think>` tags and passed to the frontend to render an expandable "Thinking..." block in the chat.

---

## 🛠️ Unified Multi-Tenant Routing

Because premium users can connect multiple Gmail and Google Calendar accounts, the agent may need to interact with different tenant slots.

1. **MCP Client Setup:** During a chat session, the agent retrieves all tenant IDs for the user and initializes separate Mastra MCP tool definitions for each connected account.
2. **Dynamic Script Execution:** The generic `run_script` tool wrapper receives code snippets from the model. It inspects the code:
   * If the code references `googlecalendar`, it routes it to the specific tenant ID housing the Google Calendar connection.
   * If the code references `gmail`, it routes it to the tenant ID housing the Gmail connection.
3. **Write Protection:** It checks the code for mutations (`.insert()`, `.create()`, `.delete()`). If mutating functions are found, it checks if the user is in Careful Mode, enforcing draft creations instead of execution.
