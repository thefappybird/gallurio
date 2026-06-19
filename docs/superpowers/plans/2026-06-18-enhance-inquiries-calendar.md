# Enhance Inquiries Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the inquiries calendar + inquiry detail modal: color-based conflict signalling, New/Booked/Conflicted filters, drag-to-reschedule for New inquiries, tighter conversion/save gating, fewer API trips, optimistic table updates, consistent row clickability, unified location pickers, and two bug fixes (missing `statusValues.approved`, calendar↔modal time mismatch).

**Architecture:** Extend the existing shared `booking-calendar.tsx` + inquiries wrapper rather than forking. Conflict is sourced from `computeInquiryConflicts` (Bookings-only) and surfaced as a candle `colorOverride` of `var(--danger)`. A new tenant-scoped server action persists reschedules with a server-side conflict block mirroring the bookings calendar. One canonical time formatter drives all session-time displays.

**Tech Stack:** Next.js 16 App Router, React 19.2, Tailwind v4 (semantic tokens), Mongoose 8, Zod, react-hook-form, react-big-calendar (+ DnD addon), next-intl, Vitest.

## Global Constraints

- Locales updated together every task that touches copy: `en`, `fil`, `ms`, `id`. No `th`.
- App shell: sharp corners only (no `rounded-*`); flat UI; semantic color tokens only (never raw color values); Merriweather.
- Mobile-first at 375px; every async surface ships loading/empty/error/populated; every control ships idle/hover/focus-visible/active/disabled; no hover-only UX; accessibility (semantic HTML, labels, keyboard, focus, color-not-sole-signal).
- Multi-tenant: never trust client `workspaceId`; every tenant read filters by `workspaceId`; every mutation by `_id` also filters by `workspaceId`; resolve scope via `ownerContext()`/`requireOrg()`.
- Server: validate at boundaries with Zod; never swallow errors; idempotent retry-prone mutations; Node runtime.
- Never name the auth provider in copy. Never mention AI tooling anywhere.
- Before "done": affected tests pass, `pnpm typecheck`, `pnpm lint`. Prefer `rtk vitest`/`rtk tsc`/`rtk lint`.
- Delegation: Opus plans/reviews; Sonnet implements; Haiku reads/searches. Sonnet/Opus do not read files directly — use Haiku readers / codebase-memory graph.

---

## File Structure

**Foundations**
- `app/globals.css` — add `--danger` token (per-theme), wire conflict red.
- `lib/utils/time-format.ts` — canonical session-time formatter (extend).
- `lib/inquiries/session-time.ts` (new) — shared helper to turn an inquiry session into a `{start,end}` for the canonical formatter.

**Calendar**
- `app/[locale]/(app)/bookings/_components/booking-calendar.tsx` — remove conflict icon, compact label, danger color, allow per-event drag gating.
- `app/[locale]/(app)/inquiries/_components/inquiries-calendar-manager.tsx` — 3 filters, DnD wiring for New only, optimistic reschedule.
- `app/[locale]/(app)/inquiries/page.tsx` — event sourcing dedupe (bookings-only for booked).
- `app/[locale]/(app)/bookings/_components/_helpers/calendar-helpers.ts` — conflict ids only New-vs-Booking.
- `lib/inquiries/inquiry-candles.ts` — candle conflict flag + draggable flag + canonical time.

**Reschedule**
- `app/[locale]/(app)/inquiries/_actions.ts` — `rescheduleInquirySessionAction`.
- `lib/db/queries/inquiry-conflicts.ts` — reuse conflict check for a single session.
- `app/[locale]/(app)/inquiries/__tests__/reschedule.test.ts` (new).

**Modal & table**
- `inquiries/[id]/_components/booking-draft-card.tsx` — dirty tracking, convert gating.
- `inquiries/[id]/_components/client-info-card.tsx` — phone edit icon far right.
- `inquiries/_components/inquiries-page-client.tsx` — optimistic map + close-without-change.
- `inquiries/_components/inquiry-table.tsx` — whole-row click + eye icon.

**Location pickers**
- `components/ui/location-picker.tsx` — check/X accept-discard; read-only parity.
- `app/[locale]/(app)/bookings/_components/booking-detail-modal.tsx` — use read-only display (#11).
- `bookings/_components/booking-wizard-steps/{event-pricing-step,sessions-location-step}.tsx` — move location, required gate.
- `app/(public)/w/[orgSlug]/_components/ContactForm.tsx` — required location + apply below.

**Bug + i18n**
- `lib/inquiries/status.ts` + `inquiry-status-badge.tsx` — safe status-label fallback (#13).
- `messages/{en,fil,ms,id}.json` — all new/changed keys.

---

## Phase 0 — Foundations

### Task 1: Add theme-aware `--danger` token (shared red)

**Files:**
- Modify: `app/globals.css` (`:root` ≈56–111, `.dark` ≈115–150, `--event-*` ≈98–101)
- Modify: `lib/bookings/status-style.ts:8-12`

**Interfaces:**
- Produces: CSS var `--danger`; export `CONFLICT_COLOR_VAR = "var(--danger)"` from `status-style.ts`.

- [ ] **Step 1:** In `app/globals.css`, add `--danger: oklch(0.60 0.18 25);` to `:root` and the same line to `.dark` (and any other theme block). Repoint `--event-cancelled` to the same value (`--event-cancelled: var(--danger);`) so the red is shared.
- [ ] **Step 2:** In `lib/bookings/status-style.ts`, add `export const CONFLICT_COLOR_VAR = "var(--danger)";`.
- [ ] **Step 3:** `rtk tsc` — expect pass.
- [ ] **Step 4:** Commit: `style: add shared --danger token for conflict color`.

### Task 2: Canonical session-time formatter (#14)

**Files:**
- Modify: `lib/utils/time-format.ts` (has `formatTimeRange`, `useTimeFormat`, `DEFAULT_TIME_MODE`)
- Create: `lib/inquiries/session-time.ts`
- Test: `lib/inquiries/__tests__/session-time.test.ts`

**Interfaces:**
- Produces:
  - `formatSessionTimeRange(session: { startDate: string; startTime: string; endTime: string }, mode: TimeMode, tz: string): string` in `session-time.ts` — formats wall-clock requested times in workspace tz, identical output to the bookings surfaces.
  - Re-uses existing `formatTimeRange(start: Date, end: Date, mode, tz)`.

- [ ] **Step 1: Write failing test** `lib/inquiries/__tests__/session-time.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatSessionTimeRange } from "../session-time";

describe("formatSessionTimeRange", () => {
  it("formats wall-clock session times consistently in 24h", () => {
    const s = { startDate: "2026-07-01", startTime: "09:30", endTime: "11:00" };
    expect(formatSessionTimeRange(s, "24h", "Asia/Manila")).toBe("09:30 – 11:00");
  });
  it("formats in 12h with am/pm", () => {
    const s = { startDate: "2026-07-01", startTime: "14:05", endTime: "15:00" };
    expect(formatSessionTimeRange(s, "12h", "Asia/Manila")).toMatch(/2:05/);
  });
});
```

- [ ] **Step 2:** `rtk vitest --run session-time` — expect FAIL (module missing).
- [ ] **Step 3:** Implement `lib/inquiries/session-time.ts`. Build a tz-correct `Date` for start/end from the wall-clock `startDate`+`startTime`/`endTime` (do NOT double-convert; treat the stored strings as workspace-local wall clock), then delegate to the same number/`Intl` formatting `formatTimeRange` uses. Reuse helpers from `time-format.ts` (export an internal `formatRangeFromParts` there if cleaner) so calendar and modal share one code path.
- [ ] **Step 4:** `rtk vitest --run session-time` — expect PASS.
- [ ] **Step 5:** Commit: `feat: canonical session-time formatter`.

---

## Phase 1 — Calendar visuals & data

### Task 3: Color-based conflict + compact label (#0, #10)

**Files:**
- Modify: `app/[locale]/(app)/bookings/_components/booking-calendar.tsx` (`StatusPill` ≈299–331; `MonthBookingEvent` ≈419–424; `TimeBookingEvent` ≈488–494)
- Modify: `lib/inquiries/inquiry-candles.ts` (`colorOverride` logic ≈40–53)

**Interfaces:**
- Consumes: `CONFLICT_COLOR_VAR` (Task 1). Candle event already carries `hasConflict?: boolean`.
- Produces: candles set `colorOverride: var(--danger)` when conflicted; `StatusPill` no longer renders an icon.

- [ ] **Step 1:** In `StatusPill`, remove the `TriangleAlertIcon` import usage and the `hasConflict` icon branch (≈324–327). Keep the status dot + label.
- [ ] **Step 2:** Constrain the status label so it never truncates to "Boo…": apply `truncate`-free compact styling — e.g. shrink to `text-[9px]`, `max-w` removed / `whitespace-nowrap`, and abbreviate only if needed; ensure the pill container does not clip the word. Keep an `aria-label` on the candle conveying status + conflict (color is not the sole signal).
- [ ] **Step 3:** In the candle background color resolution (where `STATUS_COLOR[...]` is applied for month + time events), when the event `hasConflict` is true use `CONFLICT_COLOR_VAR` instead of the status color.
- [ ] **Step 4:** In `inquiry-candles.ts`, ensure conflicted New inquiries get `colorOverride: CONFLICT_COLOR_VAR`; non-conflicted unbooked keep `var(--event-inquiry)`.
- [ ] **Step 5:** `rtk tsc` + `rtk lint` — expect pass.
- [ ] **Step 6:** Commit: `feat: color-based calendar conflict, drop conflict icon, compact status label`.

### Task 4: Event sourcing dedupe + conflict scope (#2, #2.2, #12)

**Files:**
- Modify: `app/[locale]/(app)/inquiries/page.tsx` (event assembly ≈115–184)
- Modify: `app/[locale]/(app)/bookings/_components/_helpers/calendar-helpers.ts` (`detectConflictIds` ≈90–104)

**Interfaces:**
- Produces: calendar `events` = New inquiry candles + all active Booking candles only (no booked/converted inquiry candles). `hasConflict` on inquiry candles comes from `computeInquiryConflicts` (Bookings-only).

- [ ] **Step 1:** In `page.tsx`, confirm/adjust the inquiry candle source to include only `status === "new"` inquiries (booked/converted are represented by their Booking). Remove any path that would also emit a candle for booked inquiries.
- [ ] **Step 2:** Pass the `computeInquiryConflicts` result into the inquiry candle builder so each New candle carries `hasConflict`.
- [ ] **Step 3:** In `detectConflictIds`, ensure two inquiry (`kind === "inquiry"`) events overlapping each other are NOT flagged; only an inquiry overlapping a Booking (`kind !== "inquiry"`) counts. Booking-vs-booking conflict behavior is unchanged.
- [ ] **Step 4:** `rtk tsc` — expect pass.
- [ ] **Step 5:** Commit: `feat: dedupe booked inquiries to bookings; conflict only vs real bookings`.

### Task 5: New/Booked/Conflicted filters (#1)

**Files:**
- Modify: `app/[locale]/(app)/inquiries/_components/inquiries-calendar-manager.tsx` (filter state ≈42–61, toolbar ≈82–121)
- Modify: `messages/{en,fil,ms,id}.json` (calendar filter labels)

**Interfaces:**
- Produces: three independent toggle booleans `showNew`, `showBooked`, `showConflicted`; `filteredEvents` applies them.

- [ ] **Step 1:** Replace `showUnbooked`/`showBookedInquiries` with `showNew`, `showBooked`, `showConflicted` (all default true).
- [ ] **Step 2:** Rebuild `filteredEvents`: New = inquiry candles with status `new`; Booked = Booking candles; Conflicted = New inquiry candles where `hasConflict`. An event shows if it matches any enabled chip. (Conflicted is a narrowing chip over New — when only Conflicted is on, show only conflicted New candles.)
- [ ] **Step 3:** Render three toggle chips with colored dots: New = `var(--event-inquiry)`, Booked = `var(--event-booked)`, Conflicted = `var(--danger)`. Sharp corners, semantic tokens, full interaction states, `aria-pressed`.
- [ ] **Step 4:** Add locale keys `app.inquiries.calendar.filters.{new,booked,conflicted}` to all four message files.
- [ ] **Step 5:** `rtk tsc` + `rtk lint` — expect pass.
- [ ] **Step 6:** Commit: `feat: New/Booked/Conflicted calendar filters`.

---

## Phase 2 — Drag-to-reschedule (#3)

### Task 6: `rescheduleInquirySessionAction` server action + tests

**Files:**
- Modify: `app/[locale]/(app)/inquiries/_actions.ts`
- Modify: `lib/db/queries/inquiry-conflicts.ts` (export a single-session conflict check if not present)
- Test: `app/[locale]/(app)/inquiries/__tests__/reschedule.test.ts`

**Interfaces:**
- Produces:
  - `rescheduleInquirySessionAction(input: { inquiryId: string; sessionIndex: number; startDate: string; startTime: string; endTime: string }): Promise<{ ok: true } | { error: string }>`.
  - Helper `sessionConflictsWithBookings(workspaceId, tz, session): Promise<boolean>` in `inquiry-conflicts.ts`.

- [ ] **Step 1: Write failing tests** covering: (a) happy path updates the session and revalidates; (b) conflict with a real Booking returns `{ error }` and does NOT persist; (c) non-`new` inquiry (booked/converted) is rejected; (d) tenant isolation — an inquiry in another workspace is not mutated; (e) idempotency — same payload twice yields the same stored state. Use in-memory Mongo, do not mock Mongoose. Mock `ownerContext()` to supply `{ workspaceId, isOwner: true }`.

```ts
// sketch — fill with project test harness helpers
it("rejects reschedule onto a conflicting real booking", async () => {
  const res = await rescheduleInquirySessionAction({ inquiryId, sessionIndex: 0, startDate, startTime, endTime: clashEnd });
  expect(res).toEqual({ error: expect.any(String) });
  // assert DB session unchanged
});
it("rejects rescheduling a non-new inquiry", async () => { /* status booked -> error */ });
it("does not touch inquiries in another workspace", async () => { /* foreign workspaceId -> error, no mutation */ });
```

- [ ] **Step 2:** `rtk vitest --run reschedule` — expect FAIL.
- [ ] **Step 3:** Implement the action: `ownerContext()` gate; Zod-validate input (bound `sessionIndex`, validate date/time strings); load inquiry by `{ _id: inquiryId, workspaceId }`; reject if not found or status !== `new`; build the target session; call `sessionConflictsWithBookings` (Bookings-only, workspace tz) and return `{ error }` if it conflicts; else `updateOne({ _id, workspaceId }, { $set: { "sessions.$[i]...": ... } })`; `revalidatePath("/inquiries")`; return `{ ok: true }`. Never swallow errors — wrap external calls and surface a logged, typed error.
- [ ] **Step 4:** `rtk vitest --run reschedule` — expect PASS.
- [ ] **Step 5:** Confirm a `{ workspaceId, ... }` index backs the conflict query/date-range read (check `Inquiry`/`Booking` schema indexes; add one if missing, `workspaceId` first).
- [ ] **Step 6:** Commit: `feat: rescheduleInquirySessionAction with conflict block + tenant isolation`.

### Task 7: Wire DnD for New inquiries only (#3)

**Files:**
- Modify: `app/[locale]/(app)/bookings/_components/booking-calendar.tsx` (DnD config ≈95–120, `draggableAccessor`)
- Modify: `app/[locale]/(app)/inquiries/_components/inquiries-calendar-manager.tsx`
- Modify: `messages/{en,fil,ms,id}.json` (reschedule + conflict-block toasts)

**Interfaces:**
- Consumes: `rescheduleInquirySessionAction` (Task 6).
- Produces: inquiries calendar passes `onEventDrop`/`onEventResize` + a `draggableAccessor` that returns true only for `kind === "inquiry" && status === "new"`.

- [ ] **Step 1:** In `booking-calendar.tsx`, expose/forward a `draggableAccessor` prop to `DnDCalendar` so callers can gate which events drag. Default keeps current behavior.
- [ ] **Step 2:** In `inquiries-calendar-manager.tsx`, pass `draggableAccessor={(ev) => ev.kind === "inquiry" && ev.status === "new"}` and add `onEventDrop`/`onEventResize` handlers.
- [ ] **Step 3:** Handler mirrors bookings `handleAnyDrop`: optimistically move the candle in local state, call `rescheduleInquirySessionAction`; on `{ error }` revert and toast (`conflictBlockDnd`); on success keep + `router.refresh()` only if needed. Booking candles stay non-draggable.
- [ ] **Step 4:** Add toast locale keys to all four files.
- [ ] **Step 5:** `rtk tsc` + `rtk lint` — expect pass.
- [ ] **Step 6:** Commit: `feat: drag-to-reschedule New inquiries with conflict block`.

---

## Phase 3 — Modal & table

### Task 8: Conversion + save gating (#4)

**Files:**
- Modify: `inquiries/[id]/_components/booking-draft-card.tsx` (state ≈73–91; buttons ≈354–365)
- Modify: `app/[locale]/(app)/inquiries/_actions.ts` (`approveInquiryBookingAction` ≈50–73)

**Interfaces:**
- Consumes: `detail.hasConflict`.
- Produces: convert button `disabled` when conflicted or not owner or saving; save button `disabled` until dirty; server guard rejects conversion while conflicted.

- [ ] **Step 1:** Add real dirty tracking: capture initial `{ total, deposit, notes, teamId, sessions }` snapshot; compute `isDirty` by comparing current editor state to the snapshot. Save button `disabled={!isDirty || saving || approving}`.
- [ ] **Step 2:** Convert button `disabled={hasConflict || saving || approving}`. When `hasConflict`, show inline helper text explaining conversion is blocked until the conflict is resolved.
- [ ] **Step 3:** In `approveInquiryBookingAction`, after loading the inquiry, recompute conflict (Bookings-only) and return `{ error }` if still conflicted — never convert a conflicted inquiry.
- [ ] **Step 4:** Update/extend `_actions` tests: conversion blocked while conflicted. `rtk vitest --run inquir` for affected files.
- [ ] **Step 5:** `rtk tsc` + `rtk lint` — expect pass.
- [ ] **Step 6:** Commit: `feat: gate convert on conflict and save on dirty state`.

### Task 9: Phone edit icon far right (#5)

**Files:**
- Modify: `inquiries/[id]/_components/client-info-card.tsx` (phone field ≈64–105)
- Modify: `messages/{en,fil,ms,id}.json` (aria label for edit phone if needed)

- [ ] **Step 1:** Restructure the phone `<dd>` to a flex row with the number on the left and an icon button (`PencilIcon`/equivalent already used in repo) pushed to the far right (`ml-auto`). Keep edit/save/cancel inline-edit behavior.
- [ ] **Step 2:** Icon button: `aria-label` from messages, sharp corners, idle/hover/focus-visible/active/disabled states; hidden when `locked`.
- [ ] **Step 3:** `rtk tsc` + `rtk lint` — expect pass.
- [ ] **Step 4:** Commit: `feat: move inquiry phone edit to far-right icon button`.

### Task 10: Refetch minimization + optimistic table (#6, #7)

**Files:**
- Modify: `inquiries/_components/inquiries-page-client.tsx` (optimistic map ≈82–94; close handler ≈327–330)
- Modify: `inquiries/[id]/_components/booking-draft-card.tsx` (success callbacks)
- Modify: `inquiries/[id]/_components/client-info-card.tsx` (phone success callback)

**Interfaces:**
- Produces: `applyOptimistic(inquiryId, patch)` covering `{ status?, phone?, total?, deposit?, notes? }`; close path refreshes only when a change occurred.

- [ ] **Step 1:** Generalize `optimisticUpdates` to a patch map (not status-only). Add an `onInquiryChanged(inquiryId, patch)` callback threaded into the modal.
- [ ] **Step 2:** Convert/save/phone success handlers call `onInquiryChanged` with the patch (optimistic), then trigger a single revalidate. Reschedule already revalidates `/inquiries`.
- [ ] **Step 3:** Track a `hasChanges` ref in the page client; modal `onClose` refreshes only if `hasChanges` — close-without-changes does NOT `router.refresh()` or refetch (just strips the URL param). Reset the flag after refresh.
- [ ] **Step 4:** `localRows` applies the patch map over server rows so the table reflects modal edits immediately and reconciles on revalidate.
- [ ] **Step 5:** `rtk tsc` + `rtk lint` — expect pass.
- [ ] **Step 6:** Commit: `feat: optimistic table updates; skip refetch on no-change modal close`.

### Task 11: Whole-row click + view eye icon (#8, #9)

**Files:**
- Modify: `inquiries/_components/inquiry-table.tsx` (desktop row ≈149–209; actions cell ≈181–208)
- Modify: `messages/{en,fil,ms,id}.json` (`table.actions.view` already exists; add `aria` if needed)

- [ ] **Step 1:** Make the desktop `<tr>` open the modal for the whole row: add `onClick`/`role="button"`/`tabIndex=0`/keyboard `Enter`/`Space` navigation to `buildInquiryModalPath(row.id)`, with focus-visible styling. Keep the client cell link for affordance or replace with row-level nav.
- [ ] **Step 2:** Actions cell keeps `stopPropagation`; replace the `DropdownMenu` (View-only) with a single view (eye) icon `Button` linking to the modal path. Full interaction states + `aria-label`. Remove now-unused `DropdownMenu*` / `MoreHorizontalIcon` imports.
- [ ] **Step 3:** Verify mobile card behavior still opens the modal and its actions still `preventDefault`.
- [ ] **Step 4:** `rtk tsc` + `rtk lint` — expect pass.
- [ ] **Step 5:** Commit: `feat: whole-row clickable inquiries table with view icon`.

---

## Phase 4 — Location pickers

### Task 12: check/X accept-discard in editable LocationPicker (#15.2)

**Files:**
- Modify: `components/ui/location-picker.tsx` (editable branch ≈374–519)
- Modify: `messages/{en,fil,ms,id}.json` (apply/discard aria labels)

**Interfaces:**
- Produces: editable picker exposes an accept (check) and discard (X) control pair; `onChange` only fires on accept (commit); discard reverts to the last committed value. A `committed`/`dirty` notion the wizard can read for gating.

- [ ] **Step 1:** Add check (commit) + X (discard) controls to the editable picker, positioned consistently (below the map). Commit calls `handleCommit`; discard reverts editing state to the last committed value.
- [ ] **Step 2:** Ensure a single, consistent placement for both the empty-origin and editing-existing cases (remove the inline-beside-input-only special case so behavior is uniform across forms).
- [ ] **Step 3:** Expose whether the current value is committed (for required gating) via an `onCommittedChange?(committed: boolean)` or by only emitting `onChange` on commit (preferred — uncommitted edits do not propagate).
- [ ] **Step 4:** Add aria-label locale keys for apply/discard in all four files.
- [ ] **Step 5:** `rtk tsc` + `rtk lint` — expect pass.
- [ ] **Step 6:** Commit: `feat: accept/discard controls on editable location picker`.

### Task 13: Booking detail read-only location parity (#11)

**Files:**
- Modify: `app/[locale]/(app)/bookings/_components/booking-detail-modal.tsx` (read-only location ≈2062–2069)
- Reference: `inquiries/[id]/_components/event-request-card.tsx` (LocationDisplay + read-only LocationMap usage)

- [ ] **Step 1:** Replace `LocationReadOnly` (view-in-map button + nested modal) with the inquiry-modal pattern: `LocationDisplay` for the address text + a disabled, read-only embedded `LocationMap` when coords exist. Match the inquiry card's markup/props.
- [ ] **Step 2:** Remove the now-unused nested location modal wiring in the booking detail modal if nothing else uses it.
- [ ] **Step 3:** `rtk tsc` + `rtk lint` — expect pass.
- [ ] **Step 4:** Commit: `feat: booking detail uses read-only inquiry-style location display`.

### Task 14: Move location to Event & Pricing step + required (#15.1, #15.2)

**Files:**
- Modify: `bookings/_components/booking-wizard-steps/event-pricing-step.tsx`
- Modify: `bookings/_components/booking-wizard-steps/sessions-location-step.tsx` → becomes sessions-only
- Modify: wizard container that controls Next-enabled state (the parent of the steps)
- Modify: `messages/{en,fil,ms,id}.json` (step labels, location-required validation message)

- [ ] **Step 1:** Move the `LocationPicker` block from `sessions-location-step.tsx` into `event-pricing-step.tsx` (keep title/type/team/total/deposit/currency). Rename the sessions step copy/keys to sessions-only.
- [ ] **Step 2:** Make location required: the Event & Pricing step's Next button is disabled until a committed location exists (a non-empty committed `LocationValue`). Mid-edit (uncommitted) does not satisfy the requirement. Show a required-field validation message.
- [ ] **Step 3:** Update any step ordering / progress labels and the wizard's per-step validity gate accordingly.
- [ ] **Step 4:** Add/adjust locale keys in all four files.
- [ ] **Step 5:** `rtk tsc` + `rtk lint` — expect pass.
- [ ] **Step 6:** Commit: `feat: move location into Event & Pricing step, required to proceed`.

### Task 15: Public contact form — required location + apply below (#16)

**Files:**
- Modify: `app/(public)/w/[orgSlug]/_components/ContactForm.tsx` (location panel ≈507–539; submit gating ≈573–582)
- Modify: `messages/{en,fil,ms,id}.json` (required validation)

- [ ] **Step 1:** Ensure the location picker renders its Apply/discard below the picker (mirroring the bookings modal location field) — using the uniform placement from Task 12 — not above the locations tab.
- [ ] **Step 2:** Make location required: submit is disabled (and/or validation error shown) until a committed location exists. Wire into the existing react-hook-form `location` field validation.
- [ ] **Step 3:** Verify at 375px the picker, apply/discard, and submit gating render correctly in preview and live modes (Playwright: resize to 375px, exercise empty/error/populated).
- [ ] **Step 4:** Add/adjust locale keys in all four files.
- [ ] **Step 5:** `rtk tsc` + `rtk lint` — expect pass.
- [ ] **Step 6:** Commit: `feat: required + correctly-placed location picker in public contact form`.

---

## Phase 5 — Bug fix, i18n consolidation, verification

### Task 16: Fix `statusValues.approved` MISSING_MESSAGE (#13)

**Files:**
- Modify: `lib/inquiries/status.ts` (`getInquiryStatusLabelKey` ≈19–24)
- Modify: `inquiries/[id]/_components/inquiry-status-badge.tsx` (label lookup ≈20–24)
- Possibly modify: whichever caller passes an `approved` status (trace at runtime)

- [ ] **Step 1:** Trace the source: grep for any place that builds `statusValues.${status}` or passes a status string of `approved` (booking→inquiry sync, notifications, seed data, legacy records). Use Haiku readers / codebase-memory `search_code`.
- [ ] **Step 2:** Fix the source to use a valid inquiry status key (`new|booked|converted|archived`). If `approved` is a legacy value, map it to `booked`.
- [ ] **Step 3:** Add a safe fallback in `getInquiryStatusLabelKey` so an unknown status returns a known key (e.g. `new`) instead of producing a missing-message lookup — guarantees no MISSING_MESSAGE at runtime.
- [ ] **Step 4:** Add a unit test asserting an unknown status maps to a valid key. `rtk vitest --run status`.
- [ ] **Step 5:** `rtk tsc` + `rtk lint` — expect pass.
- [ ] **Step 6:** Commit: `fix: resolve statusValues.approved MISSING_MESSAGE with safe status-label fallback`.

### Task 17: Locale consolidation sweep

**Files:**
- Modify: `messages/{en,fil,ms,id}.json`

- [ ] **Step 1:** Confirm every key added across Tasks 5,7,8,9,11,12,14,15,16 exists in all four locales with correct translations (no `th`). Keep ICU formatting valid.
- [ ] **Step 2:** Verify no mojibake / encoding issues; UTF-8 preserved.
- [ ] **Step 3:** `rtk tsc` (catches missing message types if typed) — expect pass.
- [ ] **Step 4:** Commit: `i18n: consolidate inquiries-calendar keys across en/fil/ms/id`.

### Task 18: Final verification

- [ ] **Step 1:** `rtk vitest` over affected files (reschedule, status, session-time, inquiries actions) — all pass.
- [ ] **Step 2:** `rtk tsc` — pass.
- [ ] **Step 3:** `rtk lint` — pass.
- [ ] **Step 4:** Playwright at 375px: inquiries calendar (filters, drag a New inquiry, conflict block toast, color), inquiry modal (convert disabled when conflicted, save disabled when clean, phone icon, time matches calendar), inquiries table (whole-row click + eye icon), booking detail location read-only, booking wizard required location, public contact form required location + apply placement. Verify loading/empty/error/populated + idle/hover/focus/active/disabled.
- [ ] **Step 5:** Update `REUSABLE_CODE.md` for any new shared module (`session-time.ts`, location picker accept/discard, `CONFLICT_COLOR_VAR`).
- [ ] **Step 6:** Commit: `chore: finalize enhance-inquiries-calendar; docs + reusable catalog`.

---

## Self-Review

**Spec coverage:** #0→T1,T3 · #1→T5 · #2/#2.2→T4 · #3→T6,T7 · #4→T8 · #5→T9 · #6→T10 · #7→T10 · #8→T11 · #9→T11 · #10→T3 · #11→T13 · #12→T4 · #13→T16 · #14→T2,(applied across surfaces in T3/modal/table/contact form) · #15→T12,T14 (+ contact form required T15) · #16→T15. Danger token → T1. All covered.

**Time-sync surfaces (#14):** formatter (T2) is consumed by calendar candles (T3), inquiry modal + table (must be updated to call `formatSessionTimeRange` — fold into T10/T11 where those components render session time; bookings modals are the reference and already correct), and the contact form (T15 renders the requested session preview). Reviewer: confirm each session-time render site routes through `formatSessionTimeRange`.

**Type consistency:** `CONFLICT_COLOR_VAR` (T1) used in T3. `formatSessionTimeRange` signature stable T2→consumers. `rescheduleInquirySessionAction` input shape stable T6→T7. `onInquiryChanged(inquiryId, patch)` stable T10→callers.

**Placeholders:** none — every task has concrete files, interfaces, and commands; server-action test code sketched with explicit cases to fill against the project harness.
