# Phase 4 — Team soft-delete + Booking ↔ Team linkage + member visibility

**Status:** ✅ implemented (branch `feat/teams-bookings/phases-4-6`)
**Depends on:** Phases 1–3 (Team/TeamMembership models, `getTeamsForUser`, member nav + `proxy.ts` guards, Main-team bootstrap)
**Unlocks:** Phase 5 (calendar reads `teamId`), Phase 6 (transactions denormalize `teamId`)

> See [README.md](./README.md) for context and locked decisions, and
> [phases-1-3-as-built-notes.md](./phases-1-3-as-built-notes.md) for how the shipped
> Teams system diverged from the original plan.

## Goal

Teams become **deactivatable** (never hard-deleted). Every booking carries a `teamId`,
backfilled to the workspace's Main team. Non-owner members see only their teams' bookings
and cannot edit; the whole booking API surface is team-scoped, not just the page.

---

## 4a — Team soft-delete (deactivation)

Teams are never hard-deleted once bookings/transactions reference them — removing the row
would break historical record-keeping. They are **deactivated** instead: the row, its
memberships, and all referencing bookings survive forever.

- **Model** ([lib/db/models/team.ts](../../lib/db/models/team.ts)): added
  `isActive: boolean` (default `true`) and `deactivatedAt: Date | null` (audit). New index
  `{ workspaceId, isActive }`. The unique `{ workspaceId, name }` index is intentionally
  **not** partial on `isActive` — a deactivated team's name stays reserved.
- **Actions** ([app/[locale]/(app)/teams/_actions.ts](<../../app/[locale]/(app)/teams/_actions.ts>)):
  `deleteTeamAction` was **removed**. New:
  - `deactivateTeamAction` — sets `isActive:false` + `deactivatedAt:now`; refuses the
    default/Main team (`CANNOT_DEACTIVATE_DEFAULT`); idempotent; never touches memberships
    or bookings (deactivation always succeeds regardless of referencing data).
  - `reactivateTeamAction` — sets `isActive:true` + `deactivatedAt:null`; refuses if the
    workspace is already at its active-team plan cap (`REACTIVATE_CAP_EXCEEDED`); idempotent.
- **Plan cap counts ACTIVE teams only** ([lib/auth/assertCanAddTeam.ts](../../lib/auth/assertCanAddTeam.ts)):
  both `assertCanAddTeam` and `createTeamWithCapEnforcement` count `{ workspaceId, isActive:true }`.
  Deactivated teams never block creating new ones.
- **Teams table UI** (`teams-table.tsx`, `team-dialogs.tsx`, `teams-page-client.tsx`):
  the delete dialog is replaced by `DeactivateDialog` / `ReactivateDialog`. A **"Show
  deactivated"** toggle (default off) reveals inactive teams, which render with an
  **`[Inactive]` pill** and a muted row; their only actions are Details + Reactivate.
  Active teams sort before inactive. `overCap`/`atCap` count active teams only.
- **i18n**: `teams.deleteDialog.*` → `teams.deactivateDialog.*` + `teams.reactivateDialog.*`;
  added `team.deactivate`/`team.reactivate`/`team.inactiveBadge`, `toolbar.showDeactivated`,
  `toasts.deactivated`/`reactivated`, `errors.cannotDeactivateDefault`/`reactivateCapExceeded`
  across all five catalogs.

---

## 4b — Booking ↔ Team linkage + member visibility

- **Model** ([lib/db/models/Booking.ts](../../lib/db/models/Booking.ts)): added
  `teamId: ObjectId (ref Team, nullable during the backfill window)`. New compound indexes
  `{ workspaceId, teamId, firstSessionStart }` and `{ workspaceId, teamId, status, firstSessionStart }`.
  Existing indexes were kept (dashboard reads rely on them); no standalone `teamId` index —
  every query is workspace-scoped, so the compound indexes back it.
- **Validator** ([lib/validators/booking.ts](../../lib/validators/booking.ts)):
  `bookingCreateSchema` now **requires** `teamId` (24-hex ObjectId).
- **Write permission** ([lib/auth/canEditBooking.ts](../../lib/auth/canEditBooking.ts), new):
  a pure, dependency-free module:
  - `canWriteBookingForTeam(ctx, team)` — owner always; otherwise lead of that team **while
    it is active**. Plain members are view-only (the `staffIds`-based member-edit path is a
    documented **dormant future hook**, not wired in MVP per Decision 1).
  - `canEditBooking(ctx, booking, team)` — owners may edit any booking (incl. one whose team
    was since deactivated, so they can reassign); non-owners need to be a lead of the
    booking's still-active team.
- **Read scope** ([lib/auth/bookingTeamScope.ts](../../lib/auth/bookingTeamScope.ts), new):
  `resolveBookingTeamScope(ctx)` → `undefined` for owners (no restriction), or the caller's
  team-id list for non-owners (empty array ⇒ matches nothing, fail-closed).
- **Queries** ([bookings-queries.ts](<../../app/[locale]/(app)/bookings/_data/bookings-queries.ts>)):
  `listBookings` gained a `teamIds?` filter; `getBookingById` gained an `allowedTeamIds?`
  guard. `undefined` = no restriction; an array (incl. empty) restricts via `$in`.
- **Whole booking API surface is team-scoped** (because `proxy.ts` only `auth.protect()`s
  `/api/*` — it does **not** apply member route-blocking there, so each route must scope
  itself):
  - `POST /api/bookings` — requires `teamId`; rejects an unknown team (404), a **deactivated**
    team (400, no new work on dead teams), or a caller who may not write to it (403); persists `teamId`.
  - `GET /api/bookings/[id]` — team-scoped read (member can't fetch another team's booking → 404).
  - `PATCH /api/bookings/[id]` — applies `canEditBooking` (owners skip; members 403; leads of
    active team allowed).
  - `export`, `by-day`, `shifts-on-date`, `[id]/activity` — all team-scoped for non-owners.
  - `import` — **owner-only** (403 otherwise); imported bookings default to the Main team.
- **Page** ([bookings/page.tsx](<../../app/[locale]/(app)/bookings/page.tsx>)): resolves the
  visibility scope and passes `teamIds` to `listBookings` / `allowedTeamIds` to `getBookingById`.
  Create is **owner-only in Phase 4** (the server already permits leads; the in-wizard team
  picker and lead/member create UX land in Phase 5). New bookings default to the Main team —
  threaded through the wizard's create POST as `teamId`; the New Booking + Import buttons are
  hidden for non-owners.
- **Migration** ([lib/db/migrations/2026-05-bookings-team-backfill.ts](../../lib/db/migrations/2026-05-bookings-team-backfill.ts)):
  sets `teamId = workspace Main team` for every booking with a null `teamId`. Idempotent,
  batched cursor, per-workspace Main-team cache, `--dry-run`. (`seed.ts` now also stamps the
  Main team on seeded bookings.)

## Tests

- `canEditBooking.test.ts` — full owner/lead/member × active/inactive truth table.
- `bookings-queries.test.ts` — `teamIds` scoping, empty-array fail-closed, `getBookingById`
  `allowedTeamIds` guard, combined with workspace isolation.
- `route.test.ts` — POST persists teamId; 404 unknown team; 400 deactivated team; 403 member;
  201 lead.
- `[id]/route.test.ts` — GET team-scoped read; PATCH member-forbidden / lead-allowed /
  lead-blocked-once-deactivated.
- `_actions.test.ts` — deactivate (keeps row + memberships), refuse default, reactivate,
  reactivate-cap-exceeded, tenant isolation.
- `assertCanAddTeam.test.ts` — deactivated teams excluded from the cap.
- `team.test.ts` — `isActive`/`deactivatedAt` defaults.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test --run lib/auth/canEditBooking.test.ts lib/auth/assertCanAddTeam.test.ts \
  lib/db/models/team.test.ts lib/validators/booking.test.ts \
  "app/[locale]/(app)/teams" "app/[locale]/(app)/bookings/_data" "app/api/bookings"
# Migration (against a prod snapshot first):
pnpm tsx lib/db/migrations/2026-05-bookings-team-backfill.ts --dry-run
```

## Decisions (locked, see README)

1. **Members are view-only in MVP** — owners/leads write; members view. `staffIds` left
   unused; `canEditBooking` documents the member-edit path as a dormant hook.
2. **Teams are soft-deleted (deactivate), never hard-deleted.** The Main/default team can
   never be deactivated.
3. New bookings target an **active** team only; existing bookings may reference a
   since-deactivated team and keep it.
