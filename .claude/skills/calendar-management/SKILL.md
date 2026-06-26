---
name: calendar-management
description: How Gallurio's bookings AND inquiries calendars work — they share ONE react-big-calendar component (booking-calendar.tsx) plus a thin per-page manager. Use this WHENEVER you touch either calendar: candle rendering, the CalendarEvent shape, status/team colors and the filter/legend chips, conflict detection, drag-to-reschedule, past/overnight handling, or adding a new calendar surface. Read it before editing booking-calendar.tsx, calendar-view.tsx, inquiries-calendar-manager.tsx, or anything under bookings/_components/_helpers. Pairs with optimistic-rendering for the drag optimistic flow.
---

# Calendar management (bookings + inquiries)

Both calendars render through ONE shared component. Don't fork it — extend it and
gate per-consumer with props. The two pages look alike because they ARE the same
calendar with different event sources and different reschedule actions.

```
booking-calendar.tsx ............ shared <BookingCalendar> (react-big-calendar wrapper)
  ├─ calendar-view.tsx .......... bookings consumer  (events = real Booking sessions)
  └─ inquiries-calendar-manager.tsx  inquiries consumer (events = buildInquiryCalendarEvents)
```

## The shared component — `BookingCalendar`
`app/[locale]/(app)/bookings/_components/booking-calendar.tsx`. A consumer feeds it
events + callbacks; the component owns month/week/day views, the candle renderers, and
drag wiring. Props a consumer must satisfy:
- `events: CalendarEvent[]` — the candles to draw (already optimistic-merged by the consumer).
- `onSelectEvent` / `onSelectSlot` — open detail / create.
- `onEventDrop` / `onEventResize` — drag-to-reschedule (the consumer applies the optimistic
  move + server action; see **optimistic-rendering**).
- `showPast?` — when true, past candles render dimmed (opacity) + strikethrough + a top-right
  **`PastPill`**; when false they're hidden.
- `pendingIds?: Set<string>` — dims candles whose mutation is in flight.
- `colorMode?: "status" | "team"` + `teamColorMap?` — how `eventColor()` picks the fill.
- `draggableAccessor?: (e) => boolean` — gate which candles can be dragged.
- `toolbarTrailing?: ReactNode` — slot for the legend / filter chips (team-legend, inquiry filters).
- `messages` — next-intl strings for the rbc toolbar (today/prev/next/day/week/month/…).

Candle renderers live here too: `MonthBookingEvent` (3-line pill: title / client / time) and
`TimeBookingEvent` (week/day, left stripe). Both draw a bottom-right **`StatusPill`** (color
dot + label) and a top-right `PastPill`. `groupEventsForMonth()` collapses same-day events
into an overflow pill and detects bleed-in for multi-day sessions.

## `CalendarEvent` (the candle shape)
Defined in `booking-calendar.tsx`. One candle = one day-occurrence of one session.
- `id` convention: `` `${bookingId}_s${sessionIndex}_${YYYY-MM-DD}` `` — unique per day.
- `kind?: "inquiry" | "booking"` — **undefined/"booking" = real booking; "inquiry" = inquiry candle.**
  Only `buildInquiryCalendarEvents` sets `kind:"inquiry"`, so a real booking can never render
  inquiry chrome and vice-versa.
- `colorOverride?` — inquiry candles set this (slate / conflict-red); `eventColor()` honors it first.
- `status: BookingStatus` (`booked|completed|cancelled`) — drives the status color/dot for bookings.
  NOTE: inquiry candles still carry `status:"booked"` for typing, but their **pill label** is
  localized to "Inquiry" and their **fill** comes from `colorOverride` — the small status DOT is a
  known cosmetic follow-up.
- `hasConflict?` — set client-side by conflict detection; forces the fill to conflict-red.
- `sessionStartAt/EndAt`, `rangeStart/End`, `sessionDayCount`, `sessionPastDayCount` — full session
  boundaries vs this day's slice.
- `isEveningHead` / `isMorningContinuation` — overnight sessions are split into an evening half
  (→ 23:59:59.999) and a morning half (00:00 →). Drag rejects overnight reshuffles.
- `teamId`, `workspaceTz`, `inquiryId` (inquiry only).

## Color + legend system
- Tokens: `app/globals.css` `--event-inquiry` (slate), `--event-booked` (teal),
  `--event-completed` (green), `--event-cancelled`/`--danger` (red). **Theme-invariant by
  design** so the calendar vocabulary reads the same in light/dark.
- Mapping: `lib/bookings/status-style.ts` — `STATUS_COLOR_VAR` + `CONFLICT_COLOR_VAR`.
- Resolution: `eventColor()` in booking-calendar.tsx — `colorOverride` → team color (team mode)
  → status color. Conflicts always override to red.
- Legends are just the filter chips with an **always-on color swatch** matching the candle fill.
  Bookings: `team-legend.tsx` (per-team swatches). Inquiries: the three chips in
  inquiries-calendar-manager.tsx (Inquiry=slate, Booked=teal, Conflicted=red). The swatch must
  show its color regardless of active state — don't tie the swatch background to `currentColor`,
  or the active chip loses its legend color.

## Conflict detection
`app/[locale]/(app)/bookings/_components/_helpers/calendar-helpers.ts` → `detectConflictIds()`.
Half-open intervals `[start,end)` (adjacent boundaries don't conflict); skips same-`bookingId`
pairs and inquiry-vs-inquiry pairs (an inquiry only conflicts with a real booking). Each
consumer runs it in an `eventsWithConflicts` useMemo over its visible events and stamps
`hasConflict`. Server-side guard for reschedules: `lib/db/queries/inquiry-conflicts.ts`
→ `sessionConflictsWithBookings()`.

## The two consumers differ in exactly three places
1. **Event source.** Bookings: `events` prop = real Booking sessions. Inquiries:
   `buildInquiryCalendarEvents()` (`lib/inquiries/inquiry-candles.ts`) — booked inquiries are
   dropped (they surface via their linked draft Booking as a real "Booked" candle), conflict →
   red, else slate.
2. **Draggable gating.** Bookings: everything draggable. Inquiries: `draggableAccessor` uses
   `isInquiryCandleDraggable` (kind inquiry + `colorOverride` defined + `end >= now`) so booked
   and past candles can't be dragged.
3. **Reschedule action.** Bookings: `patchBookingSessions` → `PATCH /api/bookings/:id` (client
   already conflict-checked). Inquiries: `rescheduleInquirySessionAction` (inquiries/_actions.ts)
   — does a **server-side** conflict check and atomically syncs the Inquiry + its draft Booking
   in a transaction.

The optimistic state handling around those actions is the part that's easy to get wrong —
see **optimistic-rendering** (the inquiries calendar had a snap-back bug from clearing the
override before the refresh landed).

## Verify
Conflict/grouping/candle-building logic is pure → unit-test it (events → expected
ids/colors/splits). Anything visual or drag-dependent: drive it with the Playwright CLI
(see portfolio-testing for the storageState/auth recipe), at 375/768/1280. The seed
(`lib/db/seed.ts`) provides today inquiries, a today booking, and two fixed past inquiries
(−7/−14 days) for the past/read-only paths.
