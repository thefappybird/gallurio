# Perf audit: code splitting — score 3/10 (weakest area)

> **Status as of 1.5.0 (2026-09-28) — closed for this release.**
> - **Fixed, editor:** the Puck editor now mounts through `EditorShellLoader` (`next/dynamic`, `ssr: false`) (`db2eeadf`, `1d30a3c6`, PR #109). This takes Puck out of the SSR/hydration path but does **not** reduce first-load bytes: `/portfolio` transferred JS went from 2,439,875 B to 2,482,899 B (dev mode). The package is `@puckeditor/core` 0.23 since PR #106.
> - **Fixed, public portfolio:** the lightbox-trigger, featured-collections and masonry-clone islands are split per block behind `next/dynamic`, with SSR kept (`f11e615b`, PR #109). `Lightbox` and `CollectionPopup`, with their layout variants and `@tanstack/react-virtual`, now load on first open and are warmed on pointerenter/focus (`cd2baff0`, PR #110).
> - **Fixed, marketing first load (PR #110):** each marketing page's RSC payload used to carry the full 195 KB message catalog. Marketing now ships an ~8 KB subset (`lib/i18n/clientMessages.ts`, `430e722d`). The 260 KB logo SVG became an 8.9 KB PNG (`53278b02`). The ambient background dropped `motion` (`d68078a0`), and the themed screenshot is picked with CSS (`c2d7cc22`). The home page is now static (ISR, 60 s) with a per-visitor price (`8ec3a57b`). Dev-mode results: `/` HTML 312 KB → 174 KB; `/pricing` HTML 213 KB → 58 KB; mobile Lighthouse LCP 10,979 ms → 7,818 ms, TBT 4,368 ms → 2,563 ms.
> - **Fixed, tooling:** `pnpm analyze` (Turbopack-native `next experimental-analyze`) and `scripts/perf/analyze-summary.mjs` give per-route gzip ceilings (`a2fc593c`, PR #108). The recipe lives in `docs/modules/hosting-ops.md`.
> - **Declined:** `optimizePackageImports` was measured at −0.8 KB on `/portfolio` (noise) and reverted.
> - **Still open (outside this release's scope):** `recharts` on the dashboard, `react-big-calendar` in `booking-calendar.tsx`, and splitting `imageModal`/`popupLayouts` per configured layout (the next public-page lever). Carried into `docs/modules/core-domain.md` and `docs/modules/portfolio-and-media.md` → "Known gaps".

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
