# Enhance Inquiries Calendar — Design

Date: 2026-06-18
Branch: `fix/inquiries-calendar-modal`
Status: Approved decisions captured; pending user review of this spec.

## Goal

Improve the inquiries calendar + inquiry detail modal: clearer conflict signalling
via color, a New/Booked/Conflicted filter model, drag-to-reschedule for New
inquiries, tighter conversion/save gating, fewer API trips, optimistic table
updates, consistent row clickability, and unified read-only/in-form location
pickers. Also fix two bugs (missing `statusValues.approved` message, calendar↔modal
time mismatch).

## Locked decisions (from brainstorming)

1. Drag a New inquiry candle → **reschedule + persist** via a new server action,
   optimistic then revalidate. **Block the drop if the target date/time conflicts
   with a real Booking** (mirror the bookings calendar: toast + early return, no
   optimistic apply).
2. Calendar filters = **three independent toggle chips**: New, Booked, Conflicted.
   `Conflicted` narrows New inquiries to those overlapping a real Booking.
3. Candle status display = **compact label, no overflow** (never truncates to
   "Boo…"); color is never the sole signal (label + `aria-label` retained).
4. Contact form Apply/discard = **below the picker**, mirroring the bookings modal
   location field.
5. Booked dedupe = **Bookings only**. A booked/converted inquiry is represented by
   its Booking candle, never a separate inquiry candle.
6. Table = **whole row clickable + dedicated view (eye) icon** replacing the "…"
   menu.
7. Location scope = booking wizard location **moved into Event & Pricing step and
   made required** (Next gated), **check/X accept-discard on all in-form pickers**,
   **and the public contact form location is also required**.
8. Conflict color = a dedicated theme-aware semantic token **`--danger`** (defined
   per theme: `:root` and `.dark`), used by conflicted candles via `var(--danger)`.

## Current-state references (verified)

- Shared calendar: `app/[locale]/(app)/bookings/_components/booking-calendar.tsx`
  - `StatusPill()` (≈299–331) renders the red `TriangleAlertIcon` + status label.
  - `MonthBookingEvent` (≈334–427), `TimeBookingEvent` (≈429–498).
  - `groupEventsForMonth()` (≈750–827) overflow pills.
- Inquiries calendar wrapper (read-only today):
  `app/[locale]/(app)/inquiries/_components/inquiries-calendar-manager.tsx`
  - Filter state `showUnbooked` / `showBookedInquiries` (≈42–61), filter buttons
    (≈82–121). Does NOT pass DnD handlers (read-only).
- Inquiry candle builder: `lib/inquiries/inquiry-candles.ts`
  (`colorOverride` for unbooked = `var(--event-inquiry)`).
- Inquiry status values: `lib/inquiries/status.ts`
  (`new | booked | converted | archived`; `isBookedInquiryStatus`).
- Conflict computation (already Bookings-only):
  `lib/db/queries/inquiry-conflicts.ts` `computeInquiryConflicts()`.
- Calendar-internal overlap conflict ids:
  `app/[locale]/(app)/bookings/_components/_helpers/calendar-helpers.ts`
  `detectConflictIds()` / `overlappingShifts()`.
- Bookings DnD drop-block: `app/[locale]/(app)/bookings/_components/calendar-view.tsx`
  `handleAnyDrop()` (≈413–523), conflict check (≈491–514) via
  `/api/bookings/shifts-on-date` + `overlappingShifts()`; blocks with toast +
  early return.
- Inquiry detail modal: `app/[locale]/(app)/inquiries/_components/inquiry-detail-modal.tsx`
  and `inquiries/[id]/_components/{client-info-card,event-request-card,booking-draft-card,inquiry-actions}.tsx`.
- Inquiry server actions: `app/[locale]/(app)/inquiries/_actions.ts`
  (`approveInquiryBookingAction`, `saveDraftBookingFieldsAction`,
  `editInquirySessionsAction`, `updateInquiryPhoneAction`).
- Table + page client: `inquiries/_components/inquiry-table.tsx`,
  `inquiries/_components/inquiries-page-client.tsx` (optimistic `optimisticUpdates`
  map, currently conversion-only).
- Location pickers: `components/ui/location-picker.tsx`
  (`LocationDisplay` read-only text; `LocationReadOnly` view-in-map + nested modal;
  `LocationPicker`/`IntlLocationPicker` editable).
- Booking wizard steps:
  `bookings/_components/booking-wizard-steps/{event-pricing-step,sessions-location-step}.tsx`.
- Public contact form: `app/(public)/w/[orgSlug]/_components/ContactForm.tsx`.
- Colors: `app/globals.css` (`--destructive` per-theme; `--event-*` theme-invariant;
  `STATUS_COLOR_VAR` in `lib/bookings/status-style.ts`).
- Locale messages: `messages/{en,fil,ms,id}.json` (`app.inquiries.statusValues` =
  `new | archived | booked | converted`; no `approved`).

## Work breakdown

### A. Candle visuals (#0, #10)
- Add `--danger` token to `app/globals.css` in **both** `:root` and `.dark` (and any
  other theme blocks) so it resolves correctly across themes.
- Remove the `TriangleAlertIcon` conflict glyph from `StatusPill()`.
- Conflicted candles get `colorOverride: var(--danger)` (conflict wins over the base
  status color).
- Replace the bottom-right status text with a compact, width-clamped/abbreviated
  label that never truncates to "Boo…"; keep `aria-label` describing status (+
  conflict) so color is not the sole signal.

### B. Filters (#1)
- Replace the two toggles in `inquiries-calendar-manager.tsx` with three independent
  toggle chips: **New**, **Booked**, **Conflicted**, each with a colored dot
  (New = inquiry color, Booked = booked color, Conflicted = `var(--danger)`).
- Filter logic: New = New inquiry candles; Booked = Booking candles; Conflicted =
  New inquiry candles flagged conflicted. Chips are independent (any combination).

### C. Event sourcing & dedupe (#2, #2.2, #12)
- Calendar data = New inquiry candles (status `new`) + all active Booking candles.
- Booked/converted inquiries are NOT drawn as inquiry candles (represented by their
  Booking) — dedupe at the source assembly in `inquiries/page.tsx`.
- Conflict only against real Bookings: keep `computeInquiryConflicts` (Bookings-only)
  as the source of truth for `hasConflict`; ensure the calendar's `detectConflictIds`
  does not flag New-vs-New inquiry overlaps as conflicts (only New-vs-Booking).

### D. Drag-to-reschedule for New inquiries (#3)
- In the inquiries calendar, enable DnD **only** for `kind === "inquiry"` &&
  status `new`; Booking candles remain non-draggable.
- New server action `rescheduleInquirySessionAction(inquiryId, sessionIndex, newStart, newEnd)`:
  - `ownerContext()`/role gate; tenant scope by `workspaceId`; never trust client
    `workspaceId`.
  - Zod-validate inputs; mutation filters by `{ _id, workspaceId }`.
  - Reject if the inquiry is booked/converted (only New is reschedulable).
  - **Conflict block:** recompute against real Bookings; if the target conflicts,
    return a typed error and do not persist (UI shows toast, reverts) — mirror
    `handleAnyDrop()`.
  - Idempotent; never swallow errors; revalidate `/inquiries`.
- UI: optimistic move on drop; on conflict/error, revert and toast.

### E. Conversion / save gating (#4)
- Disable "Convert to booking" when `hasConflict` (UI) **and** add a server guard in
  `approveInquiryBookingAction` rejecting conversion while conflicted.
- "Save edits" disabled until the draft is genuinely dirty: compare current editor
  state to initial props (total/deposit/notes/teamId/sessions). No dirty → disabled.

### F. Phone edit (#5)
- In `client-info-card.tsx`, move the phone edit trigger to the far right of the
  card as an icon button (pencil), with idle/hover/focus-visible/active/disabled
  states and an `aria-label`.

### G. Refetch minimization + optimistic table (#6, #7)
- Modal close with no changes performs no refetch/revalidate (only strips the URL
  param). Track a "changed" flag set by any successful mutation; only then refresh.
- Extend `optimisticUpdates` in `inquiries-page-client.tsx` beyond conversion to
  cover status, phone, and draft edits so the table reflects modal changes
  immediately; reconcile on revalidate.

### H. Table row + actions (#8, #9)
- Make the entire desktop row open the modal (row-level navigation), preserving the
  actions cell's `stopPropagation`. Keep mobile card behavior.
- Replace the "…" `DropdownMenu` (View-only) with a direct view (eye) icon button
  linking to the modal path; full interaction states + `aria-label`.

### I. Location pickers (#11, #15, #16)
- **#11:** Booking detail modal uses the inquiry-modal read-only display
  (`LocationDisplay` + embedded read-only `LocationMap`) instead of `LocationReadOnly`
  (view-in-map button + nested modal).
- **#15.1:** Move the editable `LocationPicker` from `sessions-location-step.tsx`
  into `event-pricing-step.tsx` (step keeps its event + pricing fields; sessions step
  becomes sessions-only). Update step labels/keys accordingly.
- **#15.2:** Location is required in the wizard — Next disabled until a location is
  applied (committed, not mid-edit). Add **check (apply) / X (discard)** controls to
  all in-form editable pickers (wizard, contact form, booking detail edit).
- **#16 + contact form:** Public contact form location is **required**; Apply/discard
  renders **below the picker**, mirroring the bookings modal location field; submit
  gated on a committed location.

### J. Bugs (#13, #14)
- **#13:** Trace the runtime `app.inquiries.statusValues.approved` lookup (no
  `approved` status exists) and fix the source to a valid key; add a safe fallback in
  the status-label helper so an unknown status never throws MISSING_MESSAGE.
- **#14:** Make the calendar candle time use the same wall-clock source/formatter as
  the inquiry modal (requested local session times) so the two always match;
  eliminate the tz double-conversion causing the offset.

## Cross-cutting / Done criteria
- Tests: new `rescheduleInquirySessionAction` (happy path, conflict block, non-New
  rejection, tenant isolation, idempotency); conversion conflict guard; dirty-state
  gating; status-label fallback; time-format parity helper.
- i18n: update all four locales (`en`, `fil`, `ms`, `id`) together — new filter
  labels, view action, reschedule/conflict toasts, location-required validation,
  any `statusValues` fix. No `th`.
- Mobile: verify at 375px (filters, table rows, modal, location pickers, contact
  form) across loading/empty/error/populated and idle/hover/focus/active/disabled.
- Optimistic UI for reschedule and table updates; errors surfaced via toast, never
  swallowed.
- Indexes: confirm a `{ workspaceId, ... }` index backs the reschedule conflict
  query shape and date-range reads.

## Out of scope
- Booking calendar behavior beyond reusing its drop-block pattern and the #11
  read-only location change.
- In-app quote negotiation; any new inquiry status values.
