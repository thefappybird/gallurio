# Phase 4 — Booking ↔ Team Linkage + Backfill Migration

**Status:** not started
**Depends on:** Phase 2 (Team model exists), Phase 3 (`getTeamsForUser` exists)
**Unlocks:** Phase 5 (calendar reads `teamId`), Phase 6 (transactions denormalize `teamId`)

> See [README.md](./README.md) for context, locked decisions, and architecture summary.

## Goal

Every booking carries a `teamId`. Existing bookings get backfilled to the workspace's Main team. Member-visibility filtering layered on top of workspace filtering. `canEditBooking` predicate centralizes the "who can mutate this booking" rule.

## Files to create

### Migration

- `lib/db/migrations/2026-XX-bookings-team-backfill.ts`:
  1. For every workspace (Free included), ensure Main team exists (delegates to Phase 2's idempotent bootstrap helper).
  2. For every Booking with `teamId == null`, set `teamId = mainTeam._id`.
  3. Rebuild `Team.memberCount` from `TeamMembership` count for every team (backfills denormalized counter; safe because nothing has incremented yet outside the invite flow).
- `lib/db/migrations/run-2026-XX.ts` — driver script (idempotent, batched, logs counts, supports `--dry-run`).

### Predicate

- `lib/auth/canEditBooking.ts` — pure predicate `canEditBooking({ booking, ctx, teams }): boolean`. Encodes:
  - owner → always
  - lead of `booking.teamId` → yes
  - member of `booking.teamId` with `ctx.userId` in `booking.staffIds` → yes
  - else → no
- `lib/auth/canEditBooking.test.ts` — table-driven cases for every combination.

## Files to modify

- `lib/db/models/booking.ts`:
  - Add `teamId: ObjectId (ref Team, indexed)`. Optional in the schema for the duration of the migration window; the validator (next bullet) requires it for new writes.
  - Add compound indexes: `{ workspaceId: 1, teamId: 1, firstSessionStart: 1 }` and `{ workspaceId: 1, teamId: 1, status: 1, firstSessionStart: 1 }`. Drop superseded `{ workspaceId, firstSessionStart }` if redundant — verify with `explain("executionStats")` first.
- `lib/validators/booking.ts` — `bookingCreateSchema` requires `teamId`. Server action validates that (a) the team belongs to this workspace, (b) the calling user is allowed to write to that team (owner always; lead/member only if they belong to the team).
- `app/[locale]/(app)/bookings/_data/bookings-queries.ts`:
  - `listBookings` accepts a `teamIds?: ObjectId[]` filter. When caller is a non-owner, the server **always** restricts to their team memberships via `getTeamsForUser`.
  - `getBookingById` returns null if the booking's `teamId` is not in the caller's allowed teams (in addition to existing workspace check).
- `app/[locale]/(app)/bookings/_data/bookings-queries.test.ts` — add cases: member sees their teams only · member cannot fetch other-team booking by ID · owner sees everything.
- `app/api/bookings/route.ts` — POST/PATCH apply `canEditBooking`.

## Acceptance / verification

```bash
pnpm test --run bookings-queries
pnpm test --run canEditBooking
pnpm test --run booking
pnpm dev   # run migration script locally; check counts; verify owner + member views
```

Manual walkthrough:
- Create booking as owner → teamId required, populated.
- Member of Team A: list bookings → only Team A bookings appear. Fetch other-team booking by ID → 404.
- Lead of Team A: edit a teammate's booking → succeeds. Edit other-team booking → 403.

## Risks

- **Migration on prod**: must be one-shot, idempotent, batched. Use `--dry-run` flag and log per-workspace counts before mutating.
- **Index churn**: dropping the old single-column index could regress dashboard queries. Run `explain("executionStats")` on the three highest-traffic dashboard queries before/after.
