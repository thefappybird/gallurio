# Phase 6 — Transaction History Team Attribution

**Status:** not started
**Depends on:** Phase 4 (`Booking.teamId`)
**Unlocks:** —

> See [README.md](./README.md) for context, locked decisions, and architecture summary.

## Goal

Transactions list shows which team worked the related booking. History survives team renames and deletes by denormalizing `teamId` (and optionally `teamName`) at write time.

## Files to create

- `lib/db/migrations/2026-XX-transactions-team-backfill.ts` — one-shot: for every Transaction with `bookingId` and `teamId == null`, set `teamId = booking.teamId`. Idempotent. Supports `--dry-run`.

## Files to modify

- `lib/db/models/transaction.ts` — add `teamId: ObjectId | null` (denormalized at write time from `booking.teamId`). Add index `{ workspaceId: 1, teamId: 1, paidAt: -1 }`. Keep `teamId` denormalized (not derived via populate) so transaction history survives team renames/deletes.
- Anywhere a Transaction is created (search for `Transaction.create` / `new Transaction`): set `teamId = booking.teamId` at write time.
- `app/[locale]/(app)/dashboard/_components/transactions-by-method-bar.tsx` and the transactions list UI — add a Team column (and team-color dot). Lead-only filter for "my team's transactions".

## Acceptance / verification

```bash
pnpm test --run transaction
pnpm dev   # verify UI; verify lead sees their team's transactions only
```

## Risks

- If a team is deleted, transactions still reference its `teamId`. Show a "Deleted team" badge in the UI — do **not** null the field; that loses history.
