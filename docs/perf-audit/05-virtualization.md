# Perf audit: virtualization — score 4/10

No `react-window`, no `react-virtual`/`@tanstack/react-virtual` anywhere in `package.json` or the codebase — no list in the app is windowed.

## What's working (mitigated by pagination, not virtualization)
- **Bookings / clients tables** — `bookings-table.tsx:292,446,473` and `clients-table.tsx:276,397,418` use `@tanstack/react-table` (headless, not virtualized) but are server-paginated (`lib/pagination`'s `PAGE_SIZE_OPTIONS`, `bookings/page.tsx:177` passes `{ page, limit }` for table view). Only the current page's rows are ever mounted, so unbounded growth doesn't hit the DOM directly.
- **Inquiries table** — `inquiry-table.tsx:102,211` is a plain unbounded `rows.map(...)` with no `.slice`/windowing of its own, but it's fed a page-sized array from the server layer (`inquiries/page.tsx:16` also imports `PAGE_SIZE_OPTIONS`) — safe today, but fragile: the component itself has no ceiling if it's ever handed a larger array.
- **`MediaPicker.tsx`** (editor's media browser, `:1030`) is cursor-paginated via `fetchFeed`, `useCallback` at line 229 — bounded per page, reasonable.

## Gaps
- **`lib/page-builder/blocks/GalleryGridBlock.tsx:207,226-229`** and **`GalleryMasonryBlock.tsx:234,263-266`** — the public-facing gallery blocks rendered on `/w/[orgSlug]` — do a fully unbounded `list.map(...)`. Every photo in the collection is mounted into the DOM with plain `<img loading="lazy">`, not `next/image` — no responsive `srcSet`, no blur placeholder, no `priority` hints. This is the one virtualization gap that's actually visitor-facing: it directly affects Core Web Vitals and SEO on real public portfolio pages, not just internal dashboard performance.

## Fix direction
Highest-value fix in the whole audit: switch `GalleryGridBlock`/`GalleryMasonryBlock` to `next/image` (for responsive sizing/blur/lazy done right) and add windowing or an incremental "load more" mount strategy for large collections, since these render on real visitor traffic and factor into Core Web Vitals.
