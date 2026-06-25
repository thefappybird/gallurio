# Inquiries calendar overhaul (branch: fix/inquiries-calendar)

Single source of truth for this PR. Supersedes the earlier scratch docs
(`docs/superpowers/{plans,specs}/2026-06-18-enhance-inquiries-calendar*`), which
described the original calendar enhancement now folded in here.

## Problem
The inquiries calendar mishandled inquiry statuses and lacked the bookings
calendar's polish:
- Inquiry candles always showed a **"Booked"** status pill instead of their real
  status — `inquiry-candles.ts` hardcodes `status:"booked"`, and the candle pill's
  `labelOverride` only fired when `status !== "booked"`, so the override never ran.
- The status value `"new"` was the wrong word; it should read **"Inquiry"**
  everywhere, with **"Booked"** reserved for actual `Booking` documents.
- Past inquiries weren't surfaced as clearly-past, read-only candles.
- Inquiry drag had only an error toast (no loading/success), unlike the bookings
  calendar's `toast.promise`.

## Decisions (confirmed with the user)
- Stored status literal renamed `new` → `inquiry` (backend + display), dev DB is
  drop+reseed (no migration). `booked` / `converted` / `archived` unchanged.
- Past **inquiries AND past bookings** are shown on the inquiries calendar,
  dimmed with the existing top-right **"Past"** pill (not relocated).
- Converted/booked inquiries appear via their linked draft `Booking` as **"Booked"**
  candles — never as a duplicate inquiry candle.
- **Every** mutation on the inquiries page toasts success/failure.

## Changes by scope item

### 1. Status rename `new` → `inquiry` (commit `a22d723`)
Enum + fallbacks (`lib/inquiries/status.ts`), model default (`Inquiry.ts`),
submission/onboarding/seed, count key `new`→`inquiry` (`lib/db/queries/inquiries.ts`
+ consumers), dashboard metrics, reschedule guard (`_actions.ts`), status tabs
(`inquiries-page-client.tsx`), status badge, calendar overlay filter (`page.tsx`),
all four locales (`tabs.inquiry` / `statusValues.inquiry` / `calendar.filters.inquiry`),
and all affected tests. The unrelated booking client `mode:"new"` is untouched.

### 2. Calendar candle + past + read-only + toasts (commits `4bd0d11`, `6d318e9`)
- Inquiry candles render an **"Inquiry"** pill: dropped the never-firing
  `status !== "booked"` guard in `MonthBookingEvent`/`TimeBookingEvent`; label is
  localized via `statusValues.inquiry`. `kind:"inquiry"` is only set by
  `buildInquiryCalendarEvents`, so no real booking can show "Inquiry".
- Past items: `page.tsx` calendar fetch uses `includePast:true` (scoped to the
  inquiries calendar only); `inquiries-calendar-manager.tsx` passes `showPast`, so
  past candles dim + show the Past pill. `isInquiryCandleDraggable` gates drag on
  `ev.end >= now`, so past inquiry candles are non-draggable.
- Read-only modal for past inquiries: `areAllSessionsPast(sessions, tz)`
  (`lib/inquiries/session-past.ts`) → `readOnly` threaded through
  `page.tsx → inquiries-page-client → InquiryDetailModal`. When read-only,
  `InquiryActions` is hidden and `ClientInfoCard` / `BookingDraftCard` are
  non-editable (including Total/Deposit/Notes/Team inputs).
- Toasts: drag-reschedule uses `toast.promise(loading/success/error)` with
  optimistic move + revert and the in-flight guard intact; convert/archive/decline
  and inline saves (client info, booking draft, sessions) toast success/error.

### 3. Portfolio Contact block — WYSIWYG (commit `ee03f5c`, out-of-scope add-on)
`lib/page-builder/editorConfig.tsx` renders live Contact prop values
(email/phone/address/socials) in the editor canvas instead of a static placeholder;
`StyleToolkitField.tsx` switches the Contact bg-image control from the inline
all-uploads grid to the shared modal `SingleImageControl` used by other blocks.
(Not Playwright-verified — Puck is hard to drive in a browser, per the request.)

## Verification
- `pnpm typecheck` clean; `pnpm lint` clean (pre-existing warnings only).
- Unit/component tests: 499 passing across the affected suites (rename, candles,
  filters, detail modal, session-past, dashboard, page-builder, booking-draft-card).
- Playwright `e2e/inquiries-calendar.spec.ts` PASS at 375 / 768 / 1280: Inquiry
  pill on inquiry candles; Inquiry/Booked/Conflicted filters; a Booked candle;
  past inquiry dimmed + Past pill, opening a read-only modal (Inquiry badge, no
  actions). Seed adds two fixed past `inquiry` records (−7/−14 days) for this.

## Known / deferred (non-blocking)
- The candle's small status-**dot** still uses the booked color for inquiry candles
  (`CalendarEvent.status` is typed `BookingStatus`, so candles keep `status:"booked"`);
  the pill **text** correctly reads "Inquiry" and the candle background is the
  inquiry color. Cosmetic only.
- `readOnly` is derived from past-ness, so a past inquiry opened from the **table**
  view is also read-only (cannot be archived). Intentional per the "past →
  read-only" decision; revisit if archiving past inquiries is desired.
