# Tables & calendars: CLS, booked date, server sort, edit indicator, end-time sync

Branch `fix/further-cls-bug-fixes`. Summary of what shipped and why; durable behaviour notes for future work.

## Booked date (bookings + inquiries)
- `Booking.bookedAt` / `Inquiry.bookedAt` (Date, default null) = the moment a booking first becomes non-draft.
- Stamped at the write sites, never by hooks:
  - `POST /api/bookings`
  - CSV import insert; the import update path stamps once while still null
  - `approveInquiryBookingAction`, which stamps both docs in its transaction
- `PATCH /api/bookings/[id]` 404s drafts, so it can't promote one. The import update lookup excludes drafts (`status: { $ne: "draft" }`), so a CSV row can't bypass the approve flow.
- Rows created before this change have `bookedAt: null`. They render "—" and sort after dated rows. Re-seed or backfill (`bookedAt = createdAt`) to populate dev data.
- Indexes:
  - `Booking { workspaceId, bookedAt: -1, _id: -1 }`
  - `Inquiry { workspaceId, bookedAt: -1, _id: -1 }`
  - `Inquiry { workspaceId, createdAt: -1, _id: -1 }`

## Server-side sort
- `lib/tables/sort.ts` holds `SORT_CONFIG` + `parseSort(table, sp)`. It is allowlist-only: an unknown key → the default, and an unknown dir → the key's natural direction.
- URL contract: `?sort=<key>&dir=asc|desc`. Header clicks reset `page=1`. Sort is always on (TanStack `manualSorting`, `enableSortingRemoval: false`).
- Bookings keys: `bookedAt` (**default desc**, so a new booking lands on top), `date`, `title`, `client`, `status`, `total`.
- Inquiries keys: `submitted` (**default desc**), `bookedAt`, `eventDate`, `status`, `client`, `eventTitle`, `eventType`, `source`.
- Queries sort `{ field, _id }` so skip/limit pages stay stable. Text keys use collation `{ locale: "en", strength: 2 }`.
- `total` sorts by raw `amount.total`, not the FX-converted display value (known limitation).
- Mobile (<lg, card lists): `MobileSortControl` (`components/app/table-sort.tsx`) drives the same params.
- Caching: lists are RSC renders keyed by search params, so sort/page variants inherit the router cache and the path-keyed `dirty-routes` / `invalidateFor` freshness. No extra cache layer.

## Table CLS: cookie-persisted page fit
- `useTableFitCookie` measures how many rows fit the viewport (lg+ only).
  - It skips the write when the page is scrolled or the table is empty.
  - It writes `gw_table_fit_<bookings|inquiries|clients>` only when the value changes.
- `lib/tables/page-fit.ts` resolves the page size:
  - `resolvePageSize(fit)` → `base = clamp(fit ?? 10, 10, 50)`, options `[base, ...[20,30,50] > base]`
  - `resolveLimit(rawLimit, fit)`
- Server pages read the cookie before `<Suspense>`, so the skeleton renders exactly `limit` rows. `TableSkeleton` no longer fills the viewport itself.
- First visit (no cookie): 10 rows for both skeleton and table. The fit applies from the next navigation.
- Pagination pins `limit` in the URL, so a later fit change can't shift what `?page=N` means mid-session.
- Clients moved from `loading.tsx` to an in-page Suspense fallback, so the skeleton can see `?limit`.
- Desktop tables fit 1280px with the sidebar open: cells truncate/nowrap so rows stay one line. Inquiries hides Source below `2xl` (still on cards).

## Calendar CLS
- The cause was found with a browser probe. Every container first painted at the CSS fallback `calc(100dvh-14rem)` (676px at 900px tall). It grew to the measured height later:
  - the SSR skeleton grew at hydration;
  - the client calendar grew on a deferred rAF that landed ~1s late on a busy main thread.
- Fixes:
  1. `useViewportRemainingHeight` measures synchronously in its layout effect (rAF only for resize events).
  2. Per-page fallbacks `BOOKINGS_CALENDAR_FALLBACK` / `INQUIRIES_CALENDAR_FALLBACK` on the Suspense skeleton, the `next/dynamic` loaders (`BookingCalendarLazy` / `InquiriesCalendarLazy`) and the calendar container.
- Result at 1280×900: constant height skeleton → calendar (712 bookings / 780 inquiries), no month-row shifts.

## Unconfirmed inline edits (booking detail modal)
- `EditableField`, `SessionCard` and `DraftSessionCard` report dirty state (`onDirtyChange`). The modal counts dirty editors.
- `DialogFooterBar` shows a `role="status"` line: "N change(s) isn't/aren't confirmed yet — press ✓ to keep or ✕ to discard."
- The ✓ uses the success tokens when it can commit.

## End time follows start time
- `syncEndTime(start, end)` in `lib/utils/time-format.ts`: if `end <= start`, it returns start + 1h, clamped to 23:59.
- Runs on start change and on end blur. Start is never adjusted.
- Applied in the booking wizard, detail-modal session + draft cards, the inquiry draft card and the public `ContactForm`.
- Native `min` on the end input was skipped (jsdom blanks out-of-range values; the blur snap enforces the floor).

## Verification
- Unit/integration tests per item (in-memory Mongo for queries/routes, incl. tenant isolation and `_id` tie-break paging).
- `tsc --noEmit` green.
- Playwright:
  - `e2e/calendar-cls-probe.spec.ts`
  - `e2e/cls-sort-booked-wave.spec.ts` (1280 + 375 sort control)
  - `e2e/contact-form-time-sync.spec.ts` (public form at 375/768/1280 × light/dark)

## Known gaps / follow-ups
- `/portfolio-preview?zone=contact` 500s, and this predates the branch. `contactButtonAppearance.ts` is `"use client"` but the server page calls `resolveSubmitAppearance()`. The 5-locale preview check in the contact spec is `fixme` until that is fixed.
- Inquiry rows with a Conflict badge are ~69px vs the 56px skeleton/fit metric (also predates the branch).
