# Perf audit: dashboard module

Scope: `app/[locale]/(app)/dashboard/` — `page.tsx`, `loading.tsx`, `_components/*`, `_data/dashboard-metrics.ts`.

> **Status: closed on `fix/shared-performance-fixes`.** Fixed: skeleton breakpoint mismatches
> (KPI icon, tabs control), `min-h-*` parity for data-driven cards, `CardTitle`'s new
> polymorphic `as` prop applied at ~20 dashboard call sites, mini-calendar `AbortController` +
> per-month/team cache + localized `aria-label`s, `useMemo` on the heatmap/mini-calendar/trend-
> chart render-heavy computations. **Not actually fixed despite an earlier claim:** the
> recharts `next/dynamic(...)` wrapping in `page.tsx`/`portfolio-dashboard.tsx` does not
> code-split, because both call sites are Server Components — Next only splits a dynamic import
> made from a Client Component boundary. Re-flagged below as still open.

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

## Still open (found during this branch's own review)
- **recharts code-splitting is unresolved.** `next/dynamic(...)` was added around the 5 chart
  components in `page.tsx`/`portfolio-dashboard.tsx`, but both call sites are Server Components,
  and Next only code-splits a dynamic import made from a Client Component boundary (bundled
  Next docs: "When a Server Component dynamically imports a Client Component, automatic code
  splitting is currently not supported"). The wrapper is a no-op — the chart chunks still ship
  in the same client bundle as before. Real fix needs the `dynamic()` call moved into a
  `"use client"` wrapper module per chart, following the existing
  `booked-hours-heatmap-client.tsx` pattern, with the `loading:` fallback sized to match each
  real card (the current shared fallback defaults to `min-h-48`, shorter than some real cards —
  would itself reopen a small CLS gap if the split ever did take effect through a client
  boundary, so size it per-card when this gets redone).
- **Heading hierarchy fix over-corrected in one place**: the 5 cards inside the "Operations"
  section (`mini-booking-calendar.tsx`, `quick-add.tsx`, `todays-events-list.tsx`,
  `upcoming-week-list.tsx`, `activity-feed.tsx`) got `as="h2"`, making them heading-level peers
  of the "Operations" `<h2>` divider itself rather than its children — should be `as="h3"`.
  Separately, `booked-hours-heatmap.tsx`, `collection-coverage-card.tsx`, and
  `portfolio-dashboard.tsx` wrap their `CardTitle` in a `<span>`, which isn't valid (a heading
  isn't phrasing content) — wrapper should be a `<div>`.

## Fix direction
Match the fixable skeleton dimensions (breakpoint-driven icon/tabs, min-height parity for
variable cards) — done; add `AbortController` cancellation + de-dupe to the mini-calendar fetch
(stay off react-query — deliberately editor-only per `01-cached-fetches-server-state.md`) —
done; add an `as?` prop to `CardTitle` and use it at dashboard's ~20 call sites — done, with the
"Still open" heading-level fix above still pending; wrap the identified render-heavy
computations in `useMemo` — done; localize the 4 stray `aria-label`s — done. recharts
code-splitting needs redoing per "Still open" above.
