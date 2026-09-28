# Perf audit: virtualization — score 4/10

> **Status as of 1.5.0 (2026-09-28) — closed for this release.**
> - **Fixed (the headline gap):** `next/image` with `lib/storage/cfImageLoader.ts` now serves every portfolio image surface (Gallery Grid, Masonry, lightbox, popups), identically on canvas, preview and published page (`866314fe`, `711f4e3b`, PR #109). Masonry keeps a documented `<img>` fallback only for legacy images with no stored dimensions. Dev-mode results for `/w/seed-owner-demo/gallery`: mobile LCP 3,471 ms → 2,785 ms (−20%); DOM nodes 421 → 229.
> - **Fixed:** the immersive filmstrip, `CollectionPopup`, and the Split Index / Justified / Contact Sheet popup layouts are windowed with `@tanstack/react-virtual` (PR #109). `ContainerBackgroundSlideshow` mounts only the previous, active and next slides instead of every slide (`97f70cbf`, `05791232`, PR #110).
> - **Declined:** windowing the public gallery grid itself. The DOM is already ~229 nodes, and windowing would hide photos from crawlers.
> - **Regression to watch:** mobile gallery CLS went 0 → 0.016 after `next/image` tile sizing.
> - **Still open (outside this release's scope):** `inquiry-table.tsx` has no row ceiling of its own. It is safe today because the server pages it. Carried into `docs/modules/core-domain.md` → "Known gaps".

No `react-window`, no `react-virtual`/`@tanstack/react-virtual` anywhere in `package.json` or the codebase — no list in the app is windowed.

## What's working (mitigated by pagination, not virtualization)
- **Bookings / clients tables** — `bookings-table.tsx:292,446,473` and `clients-table.tsx:276,397,418` use `@tanstack/react-table` (headless, not virtualized) but are server-paginated (`lib/pagination`'s `PAGE_SIZE_OPTIONS`, `bookings/page.tsx:177` passes `{ page, limit }` for table view). Only the current page's rows are ever mounted, so unbounded growth doesn't hit the DOM directly.
- **Inquiries table** — `inquiry-table.tsx:102,211` is a plain unbounded `rows.map(...)` with no `.slice`/windowing of its own, but it's fed a page-sized array from the server layer (`inquiries/page.tsx:16` also imports `PAGE_SIZE_OPTIONS`) — safe today, but fragile: the component itself has no ceiling if it's ever handed a larger array.
- **`MediaPicker.tsx`** (editor's media browser, `:1030`) is cursor-paginated via `fetchFeed`, `useCallback` at line 229 — bounded per page, reasonable.

## Gaps
- **`lib/page-builder/blocks/GalleryGridBlock.tsx:207,226-229`** and **`GalleryMasonryBlock.tsx:234,263-266`** — the public-facing gallery blocks rendered on `/w/[orgSlug]` — do a fully unbounded `list.map(...)`. Every photo in the collection is mounted into the DOM with plain `<img loading="lazy">`, not `next/image` — no responsive `srcSet`, no blur placeholder, no `priority` hints. This is the one virtualization gap that's actually visitor-facing: it directly affects Core Web Vitals and SEO on real public portfolio pages, not just internal dashboard performance.

## Fix direction
Highest-value fix in the whole audit: switch `GalleryGridBlock`/`GalleryMasonryBlock` to `next/image` (for responsive sizing/blur/lazy done right) and add windowing or an incremental "load more" mount strategy for large collections, since these render on real visitor traffic and factor into Core Web Vitals.
