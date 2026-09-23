# Perf audit: code splitting — score 3/10 (weakest area)

## What's working
- `components/ui/location-picker.tsx:18` — `dynamic(() => import("./location-map"), { ssr: false })` correctly isolates `react-leaflet` from SSR and the main bundle.
- A few small, local components are also dynamic-imported (`booking-detail-modal.tsx`, `event-request-card.tsx`, `booked-hours-heatmap-client.tsx`) — not significant bundle weight either way, but the pattern is applied correctly where it is used.

## Gaps
- Only 5 total `next/dynamic`/`dynamic(` usages in the entire codebase, and none of them cover the actually-heavy libraries:
  - **`recharts`** — statically imported at the top of `app/[locale]/(app)/dashboard/_components/revenue-trend-chart.tsx` and 6 sibling chart files (`portfolio-views-chart.tsx`, `event-type-donut.tsx`, `booking-value-collection-chart.tsx`, etc.). All ship in the dashboard route bundle unconditionally.
  - **`react-big-calendar`** — statically imported in `app/[locale]/(app)/bookings/_components/booking-calendar.tsx:13,17`.
  - **`@measured/puck`** — the entire Puck editor is statically imported in `app/[locale]/(app)/portfolio/_components/EditorShell.tsx:6`, so the portfolio route's client bundle always includes the full drag-and-drop editor even before the user interacts with it. **This gets worse, not better:** `action/portfolio-puck-upgrade` moves us to `@puckeditor/core@0.23.0`, which is 1.29 MB -> 2.65 MB unpacked and pulls in `@tiptap/*`, `@tanstack/react-virtual` and `happy-dom` as runtime dependencies (see `07-puck-upgrade.md`). None of it reaches the public portfolio pages, which import only `Render` from `/rsc` — but all of it reaches `/portfolio`. Rename the package reference here once that branch merges.
  - `@react-pdf/renderer` is statically imported in `app/api/bookings/[id]/invoice/route.ts` and the receipt route — not a real issue since these are Route Handlers (server-only execution), noted for completeness only.
- `next.config.ts` has no bundle analyzer, no `optimizePackageImports`, no manual webpack chunking config — no tooling in place to even measure bundle regressions going forward.

## Fix direction
`dynamic(..., { ssr: false })` the Puck editor mount, the `react-big-calendar` component, and the dashboard's recharts-based chart components. Add `optimizePackageImports` for `recharts`, `react-leaflet`, and `@measured/puck` (`@puckeditor/core` after the upgrade lands) at minimum. The Puck mount is now the highest-value item on this list, since the 0.23 upgrade roughly doubles it. Consider adding a bundle analyzer to `next.config.ts` so future regressions are visible.
