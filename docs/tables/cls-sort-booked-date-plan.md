# CLS fixes, booked date + server sort, unconfirmed-edit indicator, end-time sync (items 3–8)

## Context
Branch `fix/further-cls-bug-fixes`. User reported six issues: calendar grows ~1s after the skeleton (#3); booking modal's per-field ✓/✕ editors give no footer cue that a change still needs confirming (#4); table skeleton fills the viewport, but the table then renders `limit` rows, so the layout shifts (#5); start/end time pairs don't keep end ≥ start (#6); bookings/inquiries tables need a **Booked date** column (#7), sorted server-side, with bookings defaulting to booked-date desc so a newly created booking shows up at the top (#8).

Decisions locked with user:
- #5: **cookie-persisted fit**. The default page size and the smallest option equal `clamp(fit, 10, 50)`. Options = `[base, …[20,30,50] > base]`.
- #7/#8 inquiries: default sort stays **submitted desc**. The Booked column can be sorted by clicking it.
- #8 bookings: **every column sorts on the server**. Caching: table lists are RSC renders driven by searchParams, so sort uses the same `?page/limit` path. It inherits the existing router-cache, `dirty-routes` and `invalidateFor` freshness (path-keyed, so every sort/page variant is covered). No new cache layer is added.

On approval, copy this plan to `docs/tables/cls-sort-booked-date-plan.md` (crash recovery). Fold it into one summary doc before the PR.

---

## #7/#8 Booked date + server sort (backend first; UI depends on it)
**Model**
- `lib/db/models/Booking.ts`: add `bookedAt?: Date`. Index `{ workspaceId: 1, bookedAt: -1, _id: -1 }`.
- `lib/db/models/Inquiry.ts`: add `bookedAt?: Date`. Index `{ workspaceId: 1, bookedAt: -1 }`.
- Rule: `bookedAt` = the moment the booking first becomes non-draft. Set it explicitly at each write site (findOneAndUpdate bypasses save hooks):
  - Direct create, `app/api/bookings/route.ts`, plus import, `app/api/bookings/import/route.ts`: `bookedAt = now` when status ≠ draft.
  - `approveInquiryBookingAction` (`inquiries/_actions.ts` ~366–600): set `Booking.bookedAt` and `Inquiry.bookedAt` = now in the existing transaction.
  - Any other draft→booked transition (PATCH `app/api/bookings/[id]/route.ts`): set it if unset.
  - Inquiry draft creation (`lib/server/inquirySubmission.ts`): leave it unset.
- `lib/db/seed.ts`: populate `bookedAt` for seeded non-draft bookings and booked inquiries. Re-seed dev (hard cutover is safe per project memory).

**Queries**
- New `lib/tables/sort.ts`: per-table allowlists plus `parseSort(sp, table)` → `{ key, dir }`. An invalid value falls back to the default.
  - Bookings: `bookedAt` (default desc) · `date`→`firstSessionStart` · `title` · `client`→`clientName` · `status` · `total`→`amount.total`.
  - Inquiries: `submitted`→`createdAt` (default desc) · `bookedAt` · `eventDate` · `status` · `client` · `eventTitle` · `eventType` · `source` (the executor confirms the real field names in `Inquiry.ts`).
- `listBookings` (`bookings/_data/bookings-queries.ts:120`) and `listInquiries` (`lib/db/queries/inquiries.ts:49`) take `sort` and apply `{ [field]: dir, _id: dir }`. The `_id` tie-break keeps skip/limit pages stable.
- Text sorts (title/client) use `.collation({ locale: "en", strength: 2 })`. They sort in memory within one workspace's filtered set, which is acceptable; only `bookedAt` gets a new index. Calendar callers (no pagination) keep `firstSessionStart: 1`.
- Rows DTO: add `bookedAt` (ISO | null) to `BookingRow` and to the inquiry row.

**UI** (`bookings-table.tsx`, `inquiry-table.tsx`)
- Add a **Booked** column, formatted date in workspace tz; "—" when null. Locale key `col.booked` in all 5 locales.
- TanStack `manualSorting: true`. Drop `getSortedRowModel` and the per-page `sortingFn`. Sorting state comes from `?sort&dir`. Header click → `router.push` with new sort, `page=1`, in `startTransition`. That reuses the existing pending skeleton.
- `enableSortingRemoval: false` (sort is always on). The first click on a date column sorts desc; on a text column, asc.
- Inquiry table gets the same sortable-header markup as bookings (`aria-sort`, button trigger; copy the pattern at `bookings-table.tsx:400–425`).
- Mobile (<lg, card list, no headers): add a compact "Sort by" Select + direction toggle above the cards that drives the same params.
- Skeleton column constants: bookings 6→7 (`bookings/page.tsx:68`, `bookings-page-client.tsx:13`); inquiries +1.

## #5 Table CLS: cookie-persisted fit
- New `lib/tables/page-fit.ts` (pure):
  - `resolvePageSize(fit?: number)` → `{ base, options }`, with `base = clamp(fit ?? 10, 10, 50)` and options = `[base, ...[20,30,50].filter(o => o > base)]`.
  - `resolveLimit(spLimit, fit)` → spLimit if it is in options, else `base`.
  - Reuse `calculateTableSkeletonRows` (`components/app/table-skeleton.tsx:24`).
- Cookie `gw_table_fit_<bookings|inquiries|clients>` (non-sensitive integer, `SameSite=Lax`, 1y). Server pages read it with `await cookies()`.
- Server pages:
  - `bookings/page.tsx`, `inquiries/page.tsx`: resolve `limit` before the `<Suspense>`. The fallback `TableSkeleton rows={limit}`.
  - `clients/page.tsx`: move `clients/loading.tsx` into an in-page Suspense fallback, because loading.tsx can't see `?limit`. Then do the same as bookings/inquiries.
  - Replace the `PAGE_SIZE_OPTIONS.includes` clamps (`bookings/page.tsx:171`, `inquiries/page.tsx:139`, `clients/page.tsx:53`) with `resolveLimit`. Pass `options` to `PageSizeSelect` (it already accepts `options`).
- `TableSkeleton`: render exactly `rows`. Remove the viewport-fill override (lines 90–98) and stop using `useViewportRemainingHeight` there.
- New client hook `useTableFitCookie(table, rowHeight)`, mounted in each page client around the real table:
  - At lg+ only, measure via `useViewportRemainingHeight` (it already reserves the pagination footer), using the real header and row heights.
  - Write the cookie only when the value changes. The new fit applies on the next navigation, so it never triggers a refetch.
- First visit (no cookie): skeleton and table are both 10 → no shift. Residual, accepted: if total < limit, the skeleton is taller than the table (same as today).
- Update `lib/pagination.test.ts`, `clients/loading.test.tsx`, `page.suspense.test.tsx` and `REUSABLE_CODE.md` (register page-fit, sort, useTableFitCookie).

## #3 Calendar CLS: diagnose, then fix
Static read: `CalendarSkeleton` and `BookingCalendar` share the `h-[calc(100dvh-14rem)]` fallback, then switch to `useViewportRemainingHeight` (`hooks/use-viewport-remaining-height.ts`). The sequence is a double skeleton: page Suspense fallback (`BookingsHeaderSkeleton` + skeleton) → `BookingCalendarLazy` `ssr:false` loading skeleton → calendar. The ~1s grow means a late re-measure: something above or after the container changes `top` or trailing siblings without resizing the observed node or parent.

The cause can't be found statically, so a runtime probe goes first:
1. Orchestrator Playwright probe at 1280, bookings and inquiries calendar. Record each rAF for 3s: container height and `top`, header height, visible trailing siblings, plus `layout-shift` PerformanceObserver entries with their sources.
2. Fix the identified cause. Likely options: make the header skeleton match the real header's height; re-measure when the element that moves the container appears; or replace JS measurement with a CSS flex chain (`flex-1 min-h-0` down from a fixed-height app shell) if the shell allows it.
- Acceptance: skeleton→calendar height delta 0 and no layout-shift entry attributed to the calendar, on both pages.

## #4 Unconfirmed-edit indicator + green ✓
- `editable-field.tsx`:
  - Add `onDirtyChange?(editKey, dirty)`, reported from an effect as `editing && isDirty`.
  - ✓ button (lines 415–424): when `canCommit`, style it `bg-[var(--success-bg)] text-[var(--success-text)] ring-1 ring-[var(--success-border)]`. Disabled keeps the current ghost styling.
- `booking-detail-modal.tsx`:
  - `SessionCard` ✓ (~3255) and unlocked draft-session confirm: same green styling and dirty reporting.
  - Track `dirtyEditorKeys: Set<string>`, the same pattern as `openFieldKeys` (~687).
  - `DialogFooterBar` (~3945) takes `unconfirmedCount` and renders a `role="status"` line in the `saveError` slot (warning tokens): "{count, plural, one {# change} other {# changes}} not confirmed. Press ✓ to keep or ✕ to discard." Only dirty editors count; an open but unchanged editor doesn't.
  - Also render the footer slot when `hasPending` is false.
- Inquiry modal (`BookingDraftCard`) has no per-field ✓/✕; it uses Save/Discard, so it's out of scope.
- Locale key `app.bookings.detail.unconfirmedEdits` in 5 locales.

## #6 End time follows start time
- Pure helper (put it in `lib/utils/time-format.ts` or a new `lib/utils/session-time.ts`; check `REUSABLE_CODE.md` first): `syncEndTime(start, end)` → if `end <= start`, return `min(start + 60min, "23:59")`; else `end`.
- Applies to:
  - Start change → `end = syncEndTime(start, end)`.
  - End blur → if `end <= start`, snap to `syncEndTime` (blur, not change, so segment-typing isn't hijacked).
  - End input gets `min={start}`.
  - No reverse adjustment of start.
- Sites:
  - `booking-wizard-steps/sessions-location-step.tsx` (RHF; via register `onChange`/`setValue`)
  - `booking-detail-modal.tsx` SessionCard + draft sessions
  - `inquiries/[id]/_components/booking-draft-card.tsx` `handleSessionChange`
  - `app/(public)/w/[orgSlug]/_components/ContactForm.tsx` (public; preview reuses it)

---

## Execution
Tasks run strictly in order. tdd-guard is on: one guarded implementer at a time in this worktree. Roster boundary: backend = models/queries/actions/routes/seed/page.tsx data resolution; frontend = components/hooks/locales. Each agent runs scoped `pnpm test --run <fragment>` + eslint, then commits a checkpoint per task.
1. Backend: bookedAt + indexes + write sites + seed; `lib/tables/sort.ts`; sort in list queries; `lib/tables/page-fit.ts`; server pages resolve sort/limit/options from cookie.
2. Frontend: booked column, manual server sort, mobile sort control, TableSkeleton exact rows, `useTableFitCookie`, PageSizeSelect options, locales.
3. Frontend: #4 indicator + green ✓.
4. Frontend: #6 `syncEndTime` across the 4 sites.
5. Orchestrator: #3 calendar probe → frontend fix.
6. Orchestrator: `tsc --noEmit` (alone) → batched Playwright → `senior-reviewer` → fixes.

## Verification
- **Unit/integration** (in-memory Mongo):
  - `parseSort`, `resolvePageSize`/`resolveLimit`, `syncEndTime` edge cases (23:30→23:59, equal times).
  - `listBookings`/`listInquiries` sort per key + `_id` tie-break + tenant isolation (another workspace's rows never appear).
  - bookedAt set on create/import/approve/PATCH draft→booked, not set on inquiry draft.
  - EditableField `onDirtyChange` + green class.
  - Footer indicator count.
  - Header click pushes `?sort&dir&page=1`.
  - Time sync in wizard / ContactForm / draft card.
- **Typecheck:** `tsc --noEmit` (watch `?.` on optional subdocs in tests).
- **Playwright** (orchestrator only, 2 runs, one login each):
  1. 1280 in-app run:
     - Calendar CLS probe on bookings + inquiries (height delta 0).
     - Bookings table: Booked column, default booked-desc, sort across pages, page-size options from cookie, skeleton→table delta 0 on reload.
     - Create a booking → appears at top.
     - Modal: dirty field → green ✓ + footer line; confirm clears it.
     - Wizard time sync.
     - Also cover the 375/768 card sort control on bookings.
  2. Public ContactForm time sync at 375/768/1280 × 5 locales × light/dark (rendered strings, `ar` RTL geometry).
