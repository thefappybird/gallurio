# Code Review — Teams Phases 4 + 5 (pre-merge)

**Scope:** `git diff dev...HEAD`, commits `fdf2b6d` (phase 4 — team soft-delete + booking↔team linkage + member visibility) and `ba81714` (phase 5 — calendar team scoping). Doc-only commit `2f7c0ca` ignored.

**Reviewer stance:** strict senior-staff pre-merge gate, isolation-first.

---

## Resolution (post-review)

All required + recommended findings fixed in the follow-up commit:
- **C1 (fixed)** — `getBookingsByDay` now casts team ids to `ObjectId` before the aggregation `$match` ([dashboard-metrics.ts](<../../app/[locale]/(app)/dashboard/_data/dashboard-metrics.ts>)).
- **M2 (fixed)** — added `getBookingsByDay` team-scope tests: string-scope count, empty-array fail-closed, cross-workspace exclusion.
- **M1 (fixed)** — PATCH `[id]` now team-scopes the `existing` lookup for non-owners → uniform 404 for cross-team ids (matches GET); regression test added.
- **L1 (fixed)** — `INACTIVE_TEAM_COLOR` darkened to `#4b5563` for clearer separation from the slate palette color.
- **L2/L3/L4** — acknowledged, no change (pre-existing / non-runtime / by-design).

Post-fix: `pnpm typecheck` clean, `pnpm build` ✓, all affected suites green.

---

## Verdict: SHIP WITH FIXES (fixes applied — see Resolution above)

The core design is sound and the isolation story is, with one exception, correct and fail-closed. Permission logic (`canEditBooking` / `canWriteBookingForTeam`), the find-based read scoping (`listBookings`, `getBookingById`, export, shifts-on-date, activity), POST/PATCH authorization, the soft-delete invariants, indexes, transactions, and i18n coverage across all five locales are all well-implemented and well-tested.

There is **one Critical correctness bug** that must be fixed before merge: the team-scoped calendar dot counts query (`getBookingsByDay`) passes **string** team IDs into a MongoDB **aggregation** `$match`, which does not auto-cast to `ObjectId`. The result is that every non-owner (staff) sees an **empty** month-dot calendar — a silent, fail-closed functional regression that no test covers. It is not a data leak, but it breaks the member calendar experience that Phase 5 set out to deliver.

Everything else is Medium/Low/Nit.

---

## Critical

### C1 — `getBookingsByDay` aggregation never matches when team-scoped (members see no calendar dots)

**File:** `app/[locale]/(app)/dashboard/_data/dashboard-metrics.ts:210-212`
**Route:** `app/api/bookings/by-day/route.ts:18-23`

`resolveBookingTeamScope()` returns `string[]` (`lib/auth/bookingTeamScope.ts:24`). `by-day/route.ts` passes that straight into `getBookingsByDay(..., scope)`, which injects it into an **aggregation** `$match`:

```ts
if (teamIds !== undefined) {
  matchStage.teamId = { $in: teamIds };   // teamIds are strings
}
const rows = await Booking.aggregate([{ $match: matchStage }, ...]);
```

`Booking.teamId` is `Schema.Types.ObjectId` (`lib/db/models/Booking.ts:27`). Unlike query helpers (`find`/`findOne`/`countDocuments`/`exists`), **Mongoose does NOT cast values inside aggregation-pipeline `$match` stages.** A `{ $in: ["<24-hex>"] }` of strings therefore matches **zero** ObjectId-typed documents.

Verified empirically against the real model + in-memory Mongo:
- `getBookingsByDay(wid, d)` (owner / no scope) → count **1** ✓
- `getBookingsByDay(wid, d, [String(team)])` (member scope) → count **0** ✗ (should be 1)

Impact: every non-owner's month calendar shows **no day-dots at all**, regardless of how many bookings their teams own. Fail-closed (no leak), but a real Phase-5 regression. The find-based paths (`listBookings`, etc.) are unaffected because `listBookings` runs `toTeamObjectIds()` first and `find` auto-casts anyway.

**Fix (pick one):**
1. Cast at the boundary in `getBookingsByDay` before building the `$match`:
   ```ts
   import { Types } from "mongoose";
   if (teamIds !== undefined) {
     matchStage.teamId = {
       $in: teamIds
         .filter((id) => Types.ObjectId.isValid(id))
         .map((id) => new Types.ObjectId(id)),
     };
   }
   ```
   (Mirror the existing `toTeamObjectIds` helper in `bookings-queries.ts:9` — consider exporting and reusing it so there's one cast site.)
2. Or change the signature to accept `Types.ObjectId[]` and cast in the route.

**Test debt (mandatory per CLAUDE.md):** `dashboard-metrics.test.ts`'s `getBookingsByDay` block (line ~293) has **no** `teamIds` case. Add: (a) string-scope returns the right count, (b) empty `[]` returns nothing (fail-closed), (c) cross-team exclusion. Any of these would have caught C1.

---

## High

_None._ The isolation surface that matters for security (reads/writes by `_id`, list, export, activity, shifts) is correctly scoped and tested. C1 is the only correctness defect with user-facing impact and it is fail-closed.

---

## Medium

### M1 — PATCH leaks booking existence across teams via 403-vs-404 oracle

**File:** `app/api/bookings/[id]/route.ts:84-116`

The PATCH ownership lookup is workspace-scoped only:
```ts
const existing = await Booking.findOne({ _id: id, workspaceId: ctx.workspace._id });
if (!existing) return 404;
// ...team check later → 403 if not lead of booking's team
```
A non-owner who PATCHes a booking belonging to **another team in the same workspace** gets **403** (exists-but-forbidden), while a non-existent id gets **404**. This lets a member enumerate which booking IDs exist in the workspace even for teams they can't see. GET handles this correctly (team-scoped query → uniform 404). PATCH should match.

Low real-world severity (IDs are random ObjectIds, not enumerable), but it's an avoidable cross-team information oracle and inconsistent with GET. **Fix:** resolve the team scope first (as GET does) and fold `teamId: { $in: scope }` into the `existing` lookup for non-owners, returning 404 uniformly; keep the `canEditBooking` check for the active/lead nuance. The existing PATCH permission tests still pass under this change.

### M2 — `getBookingsByDay` has no tenant-isolation test for the new param

**File:** `app/[locale]/(app)/dashboard/_data/dashboard-metrics.test.ts:293-306`

Beyond C1's functional gap, the mandatory "org A can't see org B" + team-scope assertions are absent for this aggregation. Add them alongside the C1 fix.

---

## Low / Nit

### L1 — `INACTIVE_TEAM_COLOR` vs palette slate are visually close
**File:** `lib/teams/team-colors.ts:18` (`#6b7280`) and palette `#8a8b94`. Both are mid-greys; on a dense month calendar an inactive-team candle and a slate-team candle may be hard to tell apart. Not a contrast/a11y failure (text is white on both, and the legend labels them), but consider nudging the inactive color further (darker/desaturated) for clearer separation. Inline hex on calendar candles is an accepted exception to the semantic-token rule (candles render user-chosen team colors), so no token violation here.

### L2 — Pre-existing hardcoded English string in the wizard (not introduced here)
**File:** `app/[locale]/(app)/bookings/_components/booking-wizard-steps/event-step.tsx:419-421` — `"Couldn't verify conflicts — try again before continuing."` is not localized. The diff confirms this predates Phase 4/5; flagging only so it isn't lost. Out of scope to fix in this branch without confirmation.

### L3 — Migration `updateOne({ _id })` omits `workspaceId`
**File:** `lib/db/migrations/2026-05-bookings-team-backfill.ts:72`. Acceptable: one-time admin migration, `_id` comes from a cursor over the same documents, idempotent, `--dry-run` supported. Not a tenant-data runtime path. No change required; noted for completeness.

### L4 — `teamColorMap` only carries active teams by design
**File:** `app/[locale]/(app)/bookings/page.tsx:98-100` + `booking-calendar.tsx:785-789`. Inactive teams intentionally fall through to `INACTIVE_TEAM_COLOR`. Correct and matches the legend, which renders a single "Inactive team" swatch when any inactive team is present. No issue — confirming the intent reads as designed.

---

## Things checked and found correct (no action)

- **Team write authorization, POST** (`app/api/bookings/route.ts:34-55`): resolves team in-workspace → 404 if missing, 400 if inactive, 403 if caller not writable; owner short-circuits memberships. Inside a transaction. Well tested (`route.test.ts`).
- **Team edit authorization, PATCH** (`[id]/route.ts:96-116`): owner short-circuit; non-owner needs lead-of-active-team via `canEditBooking`. `teamId` is **not** in `bookingPatchSchema` (`.strict()`), so team reassignment via PATCH is impossible — good, no re-validation gap. Tested.
- **GET / activity / export / shifts-on-date**: all team-scope via `resolveBookingTeamScope` and use **find-family** helpers (auto-cast), so the C1 string issue does NOT affect them. Activity guards with `Booking.exists(scopedFilter)` before returning logs. Import is owner-only (`import/route.ts:37-39`) and pins to the default team.
- **Fail-closed empty scope**: `resolveBookingTeamScope` returns `[]` (not `undefined`) for a member with no teams; `listBookings`/`getBookingById` honor `{ $in: [] }` → matches nothing. Tested explicitly.
- **`?team` validation** (`page.tsx:92-93`): only accepted if present in the caller's `teamOptions`, else falls back to `"all"`. A member can't select a team they can't see. `teamIds:[activeTeam]` is always a subset of their visibility scope.
- **`colorMode`** (`page.tsx:97`): `"team"` only in the all-teams overlay; single-team selection reverts to status colors. Sensible.
- **Soft-delete invariants** (`teams/_actions.ts`): Main/default can't be deactivated (`isDefault` guard); reactivate re-checks the active-team cap; both idempotent and don't touch memberships/bookings; name stays reserved (unique index is intentionally NOT partial on `isActive`, `team.ts:40-44`). `team.test.ts` + `_actions.test.ts` cover these.
- **Indexes**: `Booking` adds `{workspaceId,teamId,firstSessionStart}` and `{workspaceId,teamId,status,firstSessionStart}` backing the scoped list/calendar reads (`Booking.ts:71-72`). `Team` has `{workspaceId,isActive}` backing the active-count cap query (`team.ts:44`). All start with `workspaceId`.
- **No swallowed errors**: import logs+collects per-row failures and still rethrows unknowns at the action layer; actions rethrow non-handled errors (`createTeamAction` line 91, `renameTeamAction` line 116).
- **i18n**: all 25 new keys (teamPicker, calendar legend, wizard team label/placeholder, teams deactivate/reactivate dialogs, badges, errors, toasts, showDeactivated) verified present in **all five** locales (en/fil/ms/id/th); stale `deleteDialog`/`team.delete`/`cannotDeleteDefault`/`toasts.deleted` keys removed from every locale.
- **UI/a11y**: team-picker has `aria-label`; legend uses `role="group"` + `aria-label` and `aria-hidden` swatches; deactivate/reactivate dialogs are real `<Dialog>`s with title/description and disabled-while-pending; teams-table dims inactive rows + adds an Inactive badge and restricts the inactive-team menu to Details+Reactivate; showDeactivated `Switch` has paired `<Label>`. Sharp corners and semantic tokens throughout; the only inline hex are team-color candles (sanctioned).
- **Create gating**: wizard `canCreate` derives from writable (active + lead/owner) teams; submit + step-nav both require `teamId` in create mode; single-writable-team renders a static label with the default pre-filled. Members with no lead team can't open the create flow.
- **Seed/backfill**: seed creates a Main team and stamps `teamId` on every seeded booking; migration is idempotent with `--dry-run`.

---

## Required before merge
1. **Fix C1** (cast team IDs to `ObjectId` before the `getBookingsByDay` aggregation `$match`) and add the missing `teamIds` tests (M2).
2. **Recommended:** fix M1 (uniform 404 on PATCH for cross-team ids) — low effort, closes the existence oracle and aligns PATCH with GET.
