# Phase 6 — Transaction team attribution

**Status:** planned (not started)
**Depends on:** Phase 4 (`Booking.teamId`)
**Unlocks:** —

> See [README.md](./README.md) and [phases-1-3-as-built-notes.md](./phases-1-3-as-built-notes.md).

## Goal

Attribute each transaction to the team that worked the related booking. Denormalize `teamId`
at write time; surface it where transactions show; survive team rename/deactivate.

## Scope

- **Model** (`lib/db/models/Transaction.ts`): add `teamId: ObjectId | null` (denormalized,
  never populated). Add index `{ workspaceId, teamId, paidAt: -1 }`.
- **Write sites** (`lib/db/clientTransactions.ts`): `recordBookingForClient` and
  `reassignBookingBetweenClients` already hold the booking — set `teamId = booking.teamId` at
  create. Optionally carry `teamId` into the `Client.transactions[]` summary entries.
- **Surface (locked):** there is **no global transactions table** today, and we are **not**
  adding one. Show the team (color dot + name) in the **client-detail transaction list**, and
  add a `teamId` group option to the dashboard's transaction metrics
  (`dashboard/_components/transactions-by-method-bar.tsx`, `dashboard/_data/dashboard-metrics.ts`).
  No new transactions route/page.
- **No orphans by design:** because teams are soft-deleted (Phase 4), a transaction's `teamId`
  **always resolves** to a real Team row — historical attribution never breaks. When that team
  is deactivated, render its name with an `[inactive]` pill (same treatment as the
  calendar/picker), not a "deleted" placeholder. Denormalizing `teamId` (storing the id, reading
  the live Team's current name/color) is what lets a future **team rename** reflect automatically.
- **Migration** (`lib/db/migrations/2026-XX-transactions-team-backfill.ts`): for each Transaction
  with a `bookingId` and null `teamId`, set `teamId = booking.teamId`; idempotent, `--dry-run`,
  batched (mirror `2026-05-bookings-team-backfill.ts`).

## Tests

- Write-time denormalization (`recordBookingForClient` / `reassignBookingBetweenClients` stamp
  `teamId` from the booking).
- Backfill idempotency.
- A transaction whose team is deactivated renders name + `[inactive]` pill (never null/"deleted").
- Tenant + team isolation for any new transaction query.

## Verification

```bash
pnpm typecheck && pnpm lint
pnpm test --run transaction clientTransactions dashboard-metrics
pnpm tsx lib/db/migrations/2026-XX-transactions-team-backfill.ts --dry-run
```
