# Perf audit: cached fetches / server state — score 5/10

No `@tanstack/react-query`, no SWR, no zustand/jotai in the codebase. Server state is handled ad hoc.

## What's working
- Primary list pages (`bookings/page.tsx`, `clients/page.tsx`, `inquiries/page.tsx`) are async Server Components doing direct Mongoose reads via `_data/*-queries.ts`, then passing serialized props to client components. No client-side waterfall on first load.
- `inquiries-page-client.tsx:100` has an explicit comment choosing `useMemo` over `useEffect`+`setState` to avoid the manual-fetch/derived-state anti-pattern — a deliberate, correct call.
- Socket.IO notifications (`components/notifications/NotificationProvider.tsx:66-133`) do incremental state merges (prepend/mark-read) on `notification:new|read|readAll` events, not full refetches — the right pattern, just not applied elsewhere.
- `lib/page-builder/galleryPicker/GalleryPickerCacheContext.tsx:20-33` — hand-rolled `useRef<Map<string, CachedPage[]>>` per-collection page cache. Closest thing to a query cache in the repo.

## Gaps
- **No cache-invalidation layer at all.** Mutations call `revalidatePath` (~43 files match `revalidatePath|revalidateTag|unstable_cache|export const revalidate|export const dynamic`, dominated by `revalidatePath`) then client code calls `router.refresh()` (~24 files). This re-runs the whole Server Component subtree rather than doing a targeted update. No `unstable_cache`, no `revalidateTag`, no `fetch(..., { cache })` found anywhere for CRM data — every list page is implicitly dynamic and hits Mongoose fresh on every request.
- **Manual `useEffect` + `fetch` + `useState` anti-pattern** in high-interaction surfaces that would benefit most from a query cache:
  - `app/[locale]/(app)/bookings/_components/calendar-view.tsx` — 8 separate `useEffect`+`fetch` sites (`/api/bookings/...`, `/api/clients?limit=1000`), each storing into local `useState`. Every interaction on this view re-fetches ranges from scratch, no dedup, no cache.
  - `app/[locale]/(app)/dashboard/_components/mini-booking-calendar.tsx:50,65` — `useEffect` + `fetch(/api/bookings/by-day?...)`.
  - `lib/page-builder/galleryPicker/usePickerData.ts:34,76,114` — custom hook fetching `/api/portfolio/gallery` in `useEffect`, state via `useState`.
  - Lower-stakes instances (form/dialog one-off fetches, not list views): `booking-detail-modal.tsx`, `booking-history-dialog.tsx`, `booking-wizard-modal.tsx`, `LayoutPicker.tsx`, `plan-form.tsx`, `subscribe/_panel.tsx`, `CollectionPopup.tsx`, `EditCollectionDialog.tsx`, `ImageMetaWizard.tsx`, `MediaPicker.tsx`, `ImageBlockMetaSection.tsx`, `StyleToolkitField.tsx`, `location-picker.tsx`, `ContactForm.tsx`, `PageViewBeacon.tsx`.

## Fix direction
Adopt `@tanstack/react-query` (or `unstable_cache` for the server side) for the calendar-view range fetches, the dashboard mini-calendar, and the gallery picker — these are the surfaces that actually refetch repeatedly. Leave the Server-Component-first list pages alone; they're already the correct pattern and don't need a client cache layer.
