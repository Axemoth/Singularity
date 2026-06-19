# Multi-Account Integrations And Tenant Slots

Singularity uses Corsair tenant IDs to isolate OAuth credentials and cached integration data.

## Account Limits

- Free users can connect 1 Gmail account and 1 Google Calendar account.
- Premium users can connect up to 3 Gmail accounts and 3 Google Calendar accounts.

## Tenant Slot Model

Corsair stores credentials by `tenantId`. To avoid overwriting credentials, each connected account is assigned a tenant slot.

Tenant IDs follow this pattern:

- first slot: `userId`
- additional slots: `userId_timestamp`

Gmail and Calendar accounts can share a slot when that slot has room for the other integration. This keeps related Google accounts paired where possible.

## Slot Allocation

When connecting an account in `src/app/api/connect/route.ts`:

1. Load all existing Corsair accounts for the authenticated user.
2. Group them by tenant slot.
3. Reuse a tenant slot that does not already contain the requested integration.
4. Allocate a new `userId_timestamp` slot when all existing slots already contain that integration.
5. Enforce the free/premium account limit before creating the OAuth URL.

Example:

| Step | Action             | Result                            |
| ---- | ------------------ | --------------------------------- |
| 1    | Connect Gmail A    | `userId` has Gmail                |
| 2    | Connect Calendar A | `userId` has Gmail + Calendar     |
| 3    | Connect Gmail B    | `userId_...` has Gmail            |
| 4    | Connect Calendar B | `userId_...` has Gmail + Calendar |

## Query Scoping

Routers query all tenant slots owned by the current user:

```ts
or(
  eq(corsairAccounts.tenantId, userId),
  like(corsairAccounts.tenantId, `${userId}\\_%`),
);
```

Write mutations additionally verify:

- entity ownership
- entity type, such as `threads` or `events`
- integration type, such as `gmail` or `googlecalendar`

This prevents a known external Gmail thread ID or Calendar event ID from being used against another user's account.

## Disconnect

Disconnect deletes:

- app-specific derived data linked to the account
- cached Corsair entities
- the Corsair account row

The operation is scoped to accounts owned by the authenticated user.
