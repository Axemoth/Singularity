# Multi-Account Integrations & Tenant Slots Documentation

This document describes how Singularity handles authentication, connects multiple Google accounts for premium subscribers, and organizes them under unified tenant slots.

---

## 🔒 Subscription Connection Limits

*   **Free Users:** Limited to **1 connected account** per integration type (1 Gmail, 1 Google Calendar).
*   **Premium Users:** Allowed up to **3 connected accounts** per integration type.

---

## ⚠️ The Overwrite Problem

In Corsair (the integrations layer), a single `tenantId` acts as a unique key for OAuth credentials. An integration instance (e.g., `gmail`) under a specific `tenantId` can only store one active set of tokens. 

Previously, when a user initiated a connection, the redirect endpoint aggressively resolved the connection tenant ID to the first connected tenant ID it found. Because of this:
1. When a user connected their first Gmail account, it used `tenantId = userId`.
2. When the user tried to connect a *second* Gmail account, the system resolved the tenant ID to the existing `tenantId = userId`.
3. Corsair received the OAuth tokens for the second Gmail account and associated them with `userId`, **completely overwriting** the first account's credentials.

---

## 💡 The Solution: Vacant Slot Grouping

To allow multiple accounts to coexist while maintaining pairing between Gmail and Google Calendar where possible, we implemented a vacant slot grouping system in `src/app/api/connect/route.ts`:

1. **Fetch All Accounts:** We query all local connections associated with the user:
   ```typescript
   const userAccounts = await db
       .select({ 
           tenantId: corsairAccounts.tenantId,
           integrationName: corsairIntegrations.name
       })
       .from(corsairAccounts)
       .innerJoin(corsairIntegrations, eq(corsairAccounts.integrationId, corsairIntegrations.id))
       .where(
           or(
               eq(corsairAccounts.tenantId, session.user.id),
               like(corsairAccounts.tenantId, `${session.user.id}\\_%`)
           )
       );
   ```
2. **Map Connections:** We group the connected integration names by their respective `tenantId`.
3. **Resolve vacant slots:**
   * If we are connecting **Gmail**, we check if any existing tenant slot *does not* have a Gmail account connected yet. If a slot only has Calendar connected, we reuse that slot to group them.
   * If we are connecting **Calendar**, we check if any existing tenant slot *does not* have Calendar connected yet. If a slot only has Gmail connected, we reuse that slot to group them.
4. **Allocate new slots:** If all existing slots are occupied by the target integration, we generate a new unique slot ID:
   ```typescript
   uniqueTenantId = `${session.user.id}_${Date.now()}`;
   ```

### Example Mapping Progression:
*   **Step 1:** User connects first Gmail account.
    *   *Result:* Allocated `userId` slot. (Gmail: connected, Calendar: vacant).
*   **Step 2:** User connects first Calendar account.
    *   *Result:* Slot `userId` has vacant Calendar slot. Reuses `userId`. (Gmail: connected, Calendar: connected).
*   **Step 3:** User connects second Gmail account.
    *   *Result:* Slot `userId` already has Gmail. Allocates new slot `userId_178...`. (Gmail: connected, Calendar: vacant).
*   **Step 4:** User connects second Calendar account.
    *   *Result:* Slot `userId_178...` has vacant Calendar slot. Reuses `userId_178...`. (Gmail: connected, Calendar: connected).

---

## 📊 Querying Across Multiple Slots

To present a unified interface in the Dashboard and Inbox, all backend tRPC endpoints query data across **all slots** belonging to the user by using wildcard `LIKE` queries:

```typescript
// Querying threads/events across all tenant slots
.where(
  and(
    or(
      eq(corsairAccounts.tenantId, userId),
      like(corsairAccounts.tenantId, `${userId}\\_%`)
    ),
    eq(corsairIntegrations.name, "gmail")
  )
)
```
This ensures that the unified Inbox displays threads from all connected Gmail accounts, and the calendar displays events from all connected Google Calendar accounts seamlessly.
