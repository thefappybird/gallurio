# Perf audit: dashboard module

Scope: `app/[locale]/(app)/dashboard/` — `page.tsx`, `loading.tsx`, `_components/*`, `_data/dashboard-metrics.ts`.

## What's working
- No `<table>` anywhere in the module — every list surface (today's events, activity feed,
  upcoming week, recent inquiries, top clients) is a plain `<ul>`, bounded server-side via
  Mongoose `.limit()` in `dashboard-metrics.ts` (`getTodaysEvents` limit 10, `getUpcomingWeek`
  default 6, `getRecentInquiries` default 5, `getActivityFeed` called with 20, `getTopClients`
  called with 5). `todays-events-list.tsx`/`activity-feed.tsx` additionally client-paginate via
  the shared `PagedList` (`pageSize = 5`).
- `loading.tsx` already carries a deliberate anti-CLS code comment ("Mirrors the real
  dashboard's card chrome... avoids the layout shift of a generic/mismatched skeleton") and one
  card (`BookingValueCollectionChart`, `h-64`) matches its real `CardContent` height exactly.
- Icon-only controls (heatmap nav, date filter, `SegmentedToggle`, `InfoHint`) carry translated
  `aria-label`s — except one file (see Gaps).
- No `<img>`/`alt` issues — every visual is a `lucide-react` SVG icon.

## Gaps
- **Skeleton dimension mismatches** in `loading.tsx` against several real cards: KPI icon
  hidden below `sm` in real content but always shown in skeleton (`kpi-strip.tsx:76`); tabs
  control fixed `h-9 w-32` vs real `SegmentedToggle`'s `min-h-11` full-width below `sm`; the
  data-driven cards (heatmap, team performance, revenue/top-clients row, mini-calendar, both
  `PagedList` rows) all use a fixed guessed height where the real content's height is either
  proportional to query-result length or fully variable (heatmap defers behind
  `next/dynamic({ssr:false})` so nothing renders until client hydration at all). `?tab=portfolio`
  cold-nav shows the bookings-shaped skeleton regardless (loading.tsx can't read searchParams).
- `mini-booking-calendar.tsx:50-80` — `useEffect` + `fetch('/api/bookings/by-day?...')` +
  `useState`, no request cancellation, no de-dupe. Re-fetches the same month/team on repeat
  navigation.
- All `recharts`-based charts (`revenue-trend-chart.tsx`, `booking-value-collection-chart.tsx`,
  `booking-event-type-trend-chart.tsx`, `portfolio-visitors-inquiries-chart.tsx`,
  `team-performance-cards.tsx`'s bar chart) are statically imported in `page.tsx`/
  `portfolio-dashboard.tsx` — no code-splitting.
- `event-type-donut.tsx` and `portfolio-views-chart.tsx` are statically-importable recharts
  components with no live consumer anywhere in the app outside their own test files —
  dead-code candidates, flagged not removed.
- Zero `memo()`/targeted `useMemo` anywhere in the module. Heaviest offenders:
  `booked-hours-heatmap.tsx` recomputes `allWeekStarts`/`cellByKey`/sizing math on every
  `ResizeObserver` tick; `mini-booking-calendar.tsx` rebuilds `counts`/`cells`/`weekdayLabels`
  every render; `booking-event-type-trend-chart.tsx`'s `data` array loses identity every render.
- `mini-booking-calendar.tsx:134,143,153,211` — 4 hardcoded English `aria-label` literals
  while the rest of the file correctly uses `t("app.dashboard....")`.
- Heading hierarchy: only 2 real heading elements exist on the whole page (`h1` greeting, one
  `h2` "Operations" divider) across ~15 cards/widgets — every `CardTitle` renders a plain `<div>`
  (`components/ui/card.tsx:36`), so a screen-reader heading-jump skips straight from the greeting
  to the bottom divider.

## Fix direction
Match the fixable skeleton dimensions (breakpoint-driven icon/tabs, min-height parity for
variable cards); add `AbortController` cancellation + de-dupe to the mini-calendar fetch (stay
off react-query — deliberately editor-only per `01-cached-fetches-server-state.md`); wrap the
recharts imports in `next/dynamic(..., { ssr: true })` (must stay `ssr:true` — `page.tsx` is a
Server Component, and `ssr:false` isn't legal from that boundary, would also reopen a CLS gap);
add an `as?` prop to `CardTitle` and use it at dashboard's ~15 call sites; wrap the identified
render-heavy computations in `useMemo`; localize the 4 stray `aria-label`s.
