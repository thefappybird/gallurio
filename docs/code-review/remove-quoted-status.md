# Code Review — `update/bookings/remove-quoted-status` (commit `88cbd9a`)

**Reviewer:** strict adversarial pass
**Date:** 2026-06-05
**Scope:** 26 files, removal of the `"quoted"` booking status; flow becomes `inquiry → booked`.

---

## Verdict

**Ship with fixes.** The enum removal itself is mechanically complete and internally consistent — every compile-time reference to `"quoted"` is gone, typecheck and lint pass clean, and the 6 affected test suites (85 tests) are green. The dashboard funnel collapse (type → query → component → legend) is consistent end-to-end. **However**, this is a destructive enum change shipped with **no data-migration story and no graceful-fallback hardening for stray `quoted` documents that already exist in real databases.** Two render paths (`bookings-table.tsx`, `booking-calendar.tsx`) will degrade (invisible/keyed pill + a `MISSING_MESSAGE` console error) and, more seriously, any **save** of a legacy `quoted` booking will be **rejected by the Mongoose enum validator**. None of this is captured in `docs/RELEASE-CHECKLIST.md`. Fix the migration gap (P1) before merge; the rest are P2/nits.

---

## Findings

### P0 — Blockers

None. The change compiles, lints, and tests pass; there is no immediate crash on the happy path.

---

### P1 — Should fix before merge

#### P1-1 · No migration / backfill for existing `quoted` bookings; enum now rejects writes
**Files:** `lib/db/models/Booking.ts:3-8,31`, `lib/validators/booking.ts:4-8`, plus all read paths.

The Booking schema declares `status: { type: String, enum: BOOKING_STATUSES, ... }`. Mongoose `enum` validation runs on **write/validate**, not on read — so existing `status: "quoted"` documents still **read** fine, but the moment an owner edits *any* field on such a booking and the doc is `.save()`d / validated, Mongoose throws a `ValidatorError` ("`quoted` is not a valid enum value"). The user-facing symptom is an unexplained save failure on a pre-existing booking with no `quoted` field visible anywhere in the UI.

This is a real risk: the seed/onboarding fixtures previously created `quoted` bookings, and `dev`/staging DBs (and potentially any early real tenant) will contain them. The diff ships zero mitigation.

**Concrete fix (pick one, document in `docs/RELEASE-CHECKLIST.md` regardless):**
- **Backfill migration (recommended):** a one-shot script `db.bookings.updateMany({ status: "quoted" }, { $set: { status: "booked" } })` scoped per workspace, run before/at deploy. `booked` is the correct landing state — it matches how the prior funnel treated `quoted` (active) and how the seed/onboarding fixtures were re-pointed (`onboarding.ts:274`, `seed.ts:243` both `quoted → booked`).
- Add this to `docs/RELEASE-CHECKLIST.md` under a "data migrations" heading. Per CLAUDE.md's deferred-tasks rule, anything not reliably doable in dev (prod data backfill) belongs there. **It is currently missing entirely.**

#### P1-2 · Two render paths have no graceful fallback for an unknown status
**Files:** `app/[locale]/(app)/bookings/_components/bookings-table.tsx:148-157`, `app/[locale]/(app)/bookings/_components/booking-calendar.tsx:268-270`.

`StatusPill` (status-pill.tsx:28-30) was written defensively — it gates on `isKnown` and falls back to the raw string with no color. But the **table** and **calendar candle** render status directly:

```tsx
// bookings-table.tsx:154-156
style={{ backgroundColor: STATUS_COLOR_VAR[v] }}   // STATUS_COLOR_VAR["quoted"] === undefined → transparent
{tStatus(v)}                                        // missing i18n key → MISSING_MESSAGE
```
```tsx
// booking-calendar.tsx:268-270
style={{ backgroundColor: STATUS_COLOR[e.status] }} // undefined
{tStatus(e.status)}                                 // MISSING_MESSAGE
```

For a stray `quoted` doc (until the P1-1 backfill runs) this produces: (a) an **invisible pill** — `text-white` on a transparent background (`STATUS_COLOR_VAR["quoted"]` is `undefined`); and (b) a `MISSING_MESSAGE` `console.error` from next-intl, because `lib/i18n/request.ts` defines no custom `getMessageFallback`/`onError`, so the default fires `console.error` and renders the literal key path `app.bookings.statusValues.quoted` as the label. Not a crash, but a visible P0-class contrast bug (white-on-white pill) plus log noise.

Notably the codebase already knows this hazard: `booking-detail-modal.tsx:3341-3342` uses a `safeT` + `t.has()` guard specifically so "an unknown/empty status key never produces a MISSING_MESSAGE console error," and there are regression tests for exactly that (`booking-detail-modal.test.tsx:287`). The table and calendar paths were **not** given the same guard.

**Concrete fix:** if P1-1's backfill is guaranteed to run before any user sees these views, this is downgradable to P2. If you cannot guarantee that ordering (and you usually can't in a rolling deploy), apply the same `t.has()` guard + a `?? var(--muted)` color fallback in both spots, e.g.:
```tsx
const known = tStatus.has(v);
<span style={{ backgroundColor: STATUS_COLOR_VAR[v] ?? "var(--muted)" }}>
  {known ? tStatus(v) : v}
</span>
```

#### P1-3 · Stale doc reference still points at the old "draft-booking" vocabulary
**File:** `lib/validators/inquiry.ts:115`.

```ts
// Used in tests now; consumed by the Phase 6 inquiry → draft-booking flow.
```
The whole point of this branch (and the prior `f6d5557`) is that there is no `draft` booking. This comment was not updated when CLAUDE.md and the lifecycle doc were. Minor, but it's the kind of drift that re-introduces the dead vocabulary. **Fix:** reword to `inquiry → inquiry-status booking flow` (or drop the phase reference).

---

### P2 — Nice to fix

#### P2-1 · Inline `BookingStatus` unions duplicated instead of importing the canonical type
**Files:** `app/[locale]/(app)/bookings/_components/booking-calendar.tsx:44`, `app/[locale]/(app)/clients/_components/client-detail-modal.tsx:234`, `lib/db/seed.ts:74`.

Three places hand-maintain the literal union `"inquiry" | "booked" | "completed" | "cancelled"` instead of importing `BookingStatus` from `@/lib/validators/booking`. This diff had to hand-edit **all three** in lockstep to drop `quoted` — which is exactly the latent-drift cost of duplication. The canonical type is exported (`status-pill.tsx`, `status-style.ts`, `bookings-table.tsx` all import it correctly). **Fix:** replace the three inline unions with `import type { BookingStatus } from "@/lib/validators/booking"`. (Per CLAUDE.md "ask before drive-by refactor" — flagging, not silently changing.) `seed.ts` is a script and can't trivially import the validator's runtime array without bundling concerns, but the *type* import is free.

#### P2-2 · `quoted` still referenced in two historical docs (acceptable, but note it)
**Files:** `docs/code-review/bookings-enhancements.md:17,61` (references `--event-quoted` token that no longer exists), `docs/teams/phases-1-3-as-built-notes.md:17` (lists the old 5-value enum).

These are point-in-time as-built / review records, so leaving them is defensible, but `phases-1-3-as-built-notes.md:17` reads as current-state documentation of the enum and is now wrong. Consider a one-line "superseded by remove-quoted-status" note, or leave as historical record. Not blocking.

#### P2-3 · Migration risk not recorded in RELEASE-CHECKLIST
Covered under P1-1's fix, repeated here for the checklist owner: `docs/RELEASE-CHECKLIST.md` is the designated home for "not reliably doable in dev" tasks per CLAUDE.md. The `quoted → booked` backfill is precisely that and must be added.

---

### Nits

- **CSV import help note vs. import validation:** the help note in all four active locales now reads `"inquiry, booked, completed, cancelled"` and `public/sample-bookings-import.csv` was repointed `quoted → booked`. Good. Worth a one-line confirmation that the CSV **import** validator (`app/api/bookings/import/route.ts`) validates `status` against `BOOKING_STATUSES` (it should, via the shared Zod schema) so an uploaded legacy CSV row with `quoted` is now rejected with a validation error rather than silently coerced — that's the correct behavior, just verify it's the *intended* one. (Not re-reviewed in depth; flagged for the author.)
- **`getActivityFeed` / `activity-timeline.tsx:192`** maps arbitrary status values through `tStatus` for historical activity entries. If an activity log recorded a `quoted` transition in the past, the same MISSING_MESSAGE concern as P1-2 applies to the timeline. Low likelihood (depends on whether status-change activities are logged), but in the same family — worth a glance.
- `booking-calendar.test.tsx` dropped the `quoted: "#2563eb"` row from its local `STATUS_COLOR_TEST` map. The map is a hand-rolled test double rather than the real `STATUS_COLOR_VAR`; fine for this test, but it's another copy of the status set that can drift.

---

## What's good

- **Mechanical completeness is high.** Every compile-time `"quoted"` reference (model enum, validator enum, two color/order maps, the dashboard pipeline type/query/props/legend, the `--event-quoted` CSS token, the status-pill `KNOWN` map, two inline unions, seed + onboarding fixtures, sample CSV, all five locale catalogs) was removed in one coherent commit. Grep confirms no *runtime* `quoted` survivors — remaining hits are unrelated CSV-parsing terminology ("quoted fields") and historical docs.
- **Dashboard funnel collapse is internally consistent:** `PipelineCounts` type → `getPipelineCounts` query → `PipelineFunnel` props → `labels` object in `page.tsx` → `grid-cols-3 → grid-cols-2` legend all match. `getKpiSnapshot` (`["booked","quoted"]` → `"booked"`) and `getUpcomingWeek` (`["booked","quoted","inquiry"]` → `["booked","inquiry"]`) are consistent with the new enum.
- **i18n is in lockstep:** all four active locales (`en/fil/ms/id`) removed the same two keys (`pipeline.quoted`, `statusValues.quoted`) and updated the CSV `status.note`. JSON remains valid (typecheck + tests load them). No locale left out of step.
- **`StatusPill` already had the right defensive pattern** (`isKnown` gate) — it's the one render path that *won't* break on a stray status.
- **Docs now match code:** the lifecycle doc, CLAUDE.md conversion model, and blueprint were rewritten to `inquiry → booked`, and crucially they no longer claim a fictional `$ne: "draft"` default filter. The actual filter (`bookings-queries.ts:52`) is `status: { $ne: "cancelled" }`, and the updated docs correctly say "default booking lists hide only `cancelled`." That alignment was verified against source.

---

## Migration-risk answer (review question #2)

**(a) Does the Mongoose enum now reject reads/writes of legacy `quoted` docs?**
- **Reads:** No. Mongoose `enum` is a *validator*; it runs on `validate()`/`save()`, not on `find()`/`lean()`. Existing `quoted` documents load without error.
- **Writes:** **Yes.** Any `.save()` or validated update of a legacy `quoted` booking now fails with a `ValidatorError`. So an owner who opens an old `quoted` booking and edits one field gets an opaque save failure.

**(b) Will the UI crash or render blank on a stray `quoted` doc?**
- **No hard crash.** But:
  - `StatusPill` → graceful (renders raw `"quoted"` text, no color dot). Fine.
  - `bookings-table.tsx:154-156` and `booking-calendar.tsx:268-270` → **degraded**: pill background is `undefined` (transparent → `text-white` invisible) and `tStatus("quoted")` hits a missing key, firing a `MISSING_MESSAGE` `console.error` and rendering the literal key path `app.bookings.statusValues.quoted` as the label (no custom `getMessageFallback` in `lib/i18n/request.ts`).
- **Dashboard:** funnel/KPIs simply *omit* `quoted` docs from their counts (they were never `inquiry`/`booked`), so numbers are silently under-reported but nothing crashes.

**Recommendation:** Ship a `quoted → booked` backfill (`updateMany`) and run it as part of the deploy, **and** record it in `docs/RELEASE-CHECKLIST.md`. As a belt-and-suspenders measure for rolling deploys, harden the two unguarded render paths (P1-2) with a `t.has()` label fallback and a `?? var(--muted)` color fallback — matching the pattern already established in `booking-detail-modal.tsx`. With the backfill in place the harden is optional; without a guaranteed pre-render backfill it is required.

---

## Verification (run by reviewer, not taken on faith)

| Check | Command | Result |
|---|---|---|
| Typecheck | `pnpm typecheck` | **PASS** (clean, no errors) |
| Lint | `pnpm lint` | **PASS** — 0 errors, 14 pre-existing warnings (all unrelated to this diff: TanStack table hook, unused vars in settings/seed/test files) |
| Tests | `pnpm test --run dashboard-metrics pipeline-funnel todays-events-list bookings-queries booking-calendar status-pill` | **PASS** — 6 files, 85 tests |
| Grep `quoted` (repo, ex-node_modules) | — | No runtime survivors; only CSV-terminology + historical docs |

**Test-quality note (review question #5):** the test edits are *mostly* genuine retargeting, not assertion-deletion-to-go-green — e.g. `getPipelineCounts` now asserts the exact new shape `{ inquiries: 2, booked: 1 }`, and `getKpiSnapshot` asserts `activeBookingsThisMonth === 1` after dropping the `quoted` seed. **However, coverage gaps remain:**
- **No test asserts the enum no longer contains `quoted`** / that an invalid status is rejected by the validator or schema. Add a regression test: `expect(BOOKING_STATUSES).not.toContain("quoted")` and a Zod/Mongoose `safeParse`/`validate` rejection for `status: "quoted"`.
- **The `inquiry → booked` transition itself is not covered anywhere** — but that flow isn't implemented yet (`inquiry.ts:115` calls it the "Phase 6" flow; no code creates a booking from an inquiry today), so this is a pre-existing gap, not a regression introduced here. Worth a note in the inquiry-flow ticket, not a blocker for this enum removal.

---

## Resolution (applied)

All actionable findings were fixed in a follow-up commit on this branch:

- **P1-1 (migration)** — Added a **`## Data migrations`** entry to `docs/RELEASE-CHECKLIST.md` with a one-time `db.bookings.updateMany({ status: "quoted" }, { $set: { status: "inquiry" } })` backfill. Target chosen is **`inquiry`** (not `booked`) — a `quoted` record was an *unconfirmed* deal, so demoting it to an active lead is safer than fabricating a confirmed booking. Pending owner confirmation of the target.
- **P1-2 (unguarded render paths)** — `bookings-table.tsx` and `booking-calendar.tsx` now fall back to `var(--muted)` for an unknown status colour and to the raw status string (via a `t.has(...)` guard) for the label, mirroring the existing defensive pattern in `booking-detail-modal.tsx` / `status-pill.tsx`. A stray `quoted` doc during a rolling deploy degrades gracefully instead of rendering blank / logging `MISSING_MESSAGE`.
- **P1-3 (stale comment)** — `lib/validators/inquiry.ts` comment updated from the "Phase 6 / draft-booking flow" wording to "inquiry → booking flow (creates a Booking with status: `inquiry`)".
- **P2-1 (type duplication)** — `booking-calendar.tsx`, `client-detail-modal.tsx`, and `seed.ts` now import the canonical `BookingStatus` type from `@/lib/validators/booking` instead of re-declaring the union literal.
- **Coverage gap** — Added a regression block to `lib/validators/booking.test.ts`: asserts `BOOKING_STATUSES` excludes `"quoted"`, deep-equals `["inquiry","booked","completed","cancelled"]`, and that the create/patch schemas reject `status: "quoted"`.

**Post-fix verification:** `pnpm typecheck` clean · `pnpm test` (touched areas) **139 passed / 8 files** · `pnpm lint` **0 errors**.
