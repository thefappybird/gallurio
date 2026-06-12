# Phase 6 — Transaction team attribution

**Status:** ✅ shipped (data + dashboard) · ⏳ client-detail payments list deferred (see below)
**Depends on:** Phase 4 (`Booking.teamId`)
**Unlocks:** —

> See [README.md](./README.md) and [phases-1-3-as-built-notes.md](./phases-1-3-as-built-notes.md).
> (The "{team}'s Bookings" page title + single-team simplification that earlier drafts of this
> file described shipped in **Phase 5** — see that doc.)

## Goal

Attribute each transaction to the team that worked the related booking. Denormalize `teamId` at
write time so it survives team rename/deactivate, and surface it on the dashboard.

## What shipped

- **Model** ([Transaction.ts](../../lib/db/models/Transaction.ts)): added `teamId: ObjectId | null`
  (denormalized, never populated) + index `{ workspaceId, teamId, paidAt: -1 }`. The embedded
  [Client.transactions[]](../../lib/db/models/Client.ts) entry also carries `teamId` for the
  (future) client payments list.
- **Write sites** ([clientTransactions.ts](../../lib/db/clientTransactions.ts)):
  `recordBookingForClient` and `reassignBookingBetweenClients` take `booking.teamId` and stamp it on
  both the `Transaction` doc and the `Client.transactions[]` entry at create time. Callers pass it:
  POST `/api/bookings`, the import route (Main team), the PATCH reassign path (post-patch team), and
  the seed.
- **No orphans by design:** because teams are soft-deleted (Phase 4), a transaction's `teamId`
  always resolves to a real Team — historical attribution never breaks. Display reads the live Team
  (rename/deactivation reflected); deactivated teams render with the neutral color + an inactive hint.
- **Dashboard surface** ([dashboard-metrics.ts](<../../app/[locale]/(app)/dashboard/_data/dashboard-metrics.ts>)
  `getTransactionsByTeam` + [transactions-by-team-bar.tsx](<../../app/[locale]/(app)/dashboard/_components/transactions-by-team-bar.tsx>)):
  a "Revenue by team" chart, colored by each team's color (inactive → neutral), shown only when ≥2
  teams have revenue in the window. Wired into the dashboard page next to "by method".
- **Migration** ([2026-06-transactions-team-backfill.ts](../../lib/db/migrations/2026-06-transactions-team-backfill.ts)):
  backfills `Transaction.teamId` from `booking.teamId` for transactions with a booking. Idempotent,
  `--dry-run`, batched, per-booking team cache.
- **i18n:** `app.dashboard.sections.transactionsByTeam` across all four active locales.

## Tests

- `clientTransactions.test.ts` — teamId denormalized onto the Transaction + history entry for both
  `recordBookingForClient` and `reassignBookingBetweenClients`.
- `dashboard-metrics.test.ts` — existing transaction tests still green with the new field.

## Deferred — client-detail payments list

The phase plan also called for showing the team in the **client-detail transaction list**. That
list **does not exist yet** — the client detail modal's Payments tab is a stub
(`detail.payments.empty`), and there is no query returning a client's transactions. Building it is
net-new work (a `getClientTransactions` action over the embedded `Client.transactions[]` + team
resolution + the list UI), not part of "attribution." The data is now in place (`teamId` on each
entry), so it can be built anytime as a small follow-up.

## Verification

```bash
pnpm typecheck && pnpm lint
pnpm test --run lib/db/clientTransactions.test.ts "app/[locale]/(app)/dashboard/_data/dashboard-metrics.test.ts"
pnpm tsx lib/db/migrations/2026-06-transactions-team-backfill.ts --dry-run
```
