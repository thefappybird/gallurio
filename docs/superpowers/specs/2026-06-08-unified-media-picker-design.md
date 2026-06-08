# Unified Media Picker — Design

**Date:** 2026-06-08
**Branch:** `feat/portfolio-enhancements`
**Status:** Approved design, pending spec review

## Context

This is **sub-project #1 of 3** in a larger portfolio-builder effort:

1. **Unified media picker** (this spec) — one modal picker for every image field.
2. **Data-model shift (Option A)** — gallery blocks move from a `collectionId`
   pointer to an explicit, ordered list of picked images with a resolved cache,
   so the editor renders real previews (WYSIWYG) and the live page reads only
   published, resolved data.
3. **Container background slideshow** — multi-image container background that
   cycles images with an owner-chosen animation (crossfade / Ken Burns / slide),
   speed control, and reduced-motion fallback.

The three have a hard dependency order: **picker → data model → slideshow**. They
ship as separate spec → plan → implement cycles on this one branch
(`feat/portfolio-enhancements`).

This document covers **only #1**. It deliberately does **not** migrate the
gallery blocks' data model (that is #2); it ships the picker, its field adapters,
the supporting endpoint, and re-points the existing *value-compatible* single-image
call sites.

### Today's picker stack (what exists)

- `usePickerData()` (`lib/page-builder/galleryPicker/usePickerData.ts`) — fetches
  `GET /api/portfolio/gallery` once per page session (module-level cache), returns
  `{ collections: PickerCollection[], items: PickerItem[] }`. `items` is a flat,
  `createdAt`-desc, capped list with **no `collectionId`** on each item.
- `SingleImagePicker` — picks ONE `publicId` from the flat `items` grid. Used by
  single-image fields (Image block, container background). Value: `string`.
- `FeaturedItemsPicker` — multi-select up to 3 from the flat list, with
  upload + drag-reorder. Value: `Array<{ id }>`.
- `CollectionPicker` — picks ONE `collectionId`, with a create-collection flow.
- Gallery blocks (Grid/Masonry/Carousel) store `collectionId` and fetch
  server-side at render; the editor shows a text-stub preview.
- `components/ui/dialog.tsx` exists (focus-trap + Escape) and is the modal base.
- `app/api/portfolio/gallery/collections/[id]/route.ts` currently exports **only
  DELETE**.
- Items with `collectionId: null` are **standalone** (legacy Hero/CTA backgrounds,
  Featured Work picks).

## Goals

- One picker component for every image field, single and multi.
- Collection-first browsing with pagination so it scales to hundreds of photos.
- WYSIWYG-friendly value shapes (render-ready from `publicId`, no server fetch to
  preview).
- No regressions: keep upload-while-building; keep all existing single-image call
  sites working without a data migration.

## Non-goals (deferred to #2 / #3)

- Migrating gallery blocks off `collectionId`.
- The publish/cache-rebuild pipeline for resolved image data.
- The container background slideshow and its animation fields.
- Retiring `FeaturedItemsPicker`'s call site (Featured Work block) — happens when
  #2 rewires Featured Work; until then it keeps working.

## Architecture (Approach A)

One self-contained modal owns the hard UX; two dumb Puck field adapters consume it.

### Components

| Unit | File | Responsibility | Depends on |
|---|---|---|---|
| `MediaPicker` | `lib/page-builder/galleryPicker/MediaPicker.tsx` | The modal. Collection grid → drill-in → 4×4 paginated photos, tap-to-toggle, bulk select, reorder strip, upload-into-collection, create-collection. Mode-agnostic. | `dialog.tsx`, `usePickerData`, new items endpoint, `uploadToCloudinary.client` |
| `imageField(label)` | adapter (picker barrel) | Single-mode Puck custom field. Sidebar: current thumbnail + "Choose photo". Opens `MediaPicker` with `mode="single"`. | `MediaPicker` |
| `imagesField(label, {max?})` | adapter (picker barrel) | Multi-mode Puck custom field. Sidebar: thumbnail strip + count + "Choose photos". Opens `MediaPicker` with `mode="multi"`. | `MediaPicker` |
| Collection items endpoint | `app/api/portfolio/gallery/collections/[id]/route.ts` (add `GET`) | Paginated, cursor-based, owner-only list of a collection's photos. | `requireOrg`, gallery query layer |

### `MediaPicker` props (contract)

```ts
type MediaPickerProps = {
  mode: "single" | "multi";
  /** single: publicId string (""=none). multi: ordered [{id, publicId}]. */
  value: string | Array<{ id: string; publicId: string }>;
  onChange: (next: string | Array<{ id: string; publicId: string }>) => void;
  /** multi only: hard cap on selections; drives "select all" behavior. */
  max?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};
```

Both modes render the **same** collection-first navigation. The only behavioral
difference is the selection cap: `single` ⇒ cap 1 (a new pick replaces the
current one and closes); `multi` ⇒ cap `max` (default: none / `PICKER_ITEMS_CAP`
safety bound).

## Data flow & value shapes

- **Single field value:** `string` — the Cloudinary `publicId` (`""` = none).
  Identical to today's `SingleImagePicker` contract, so the Image block and
  container background swap to `imageField` with **no data change**.
- **Multi field value:** `Array<{ id: string; publicId: string }>`, array order =
  display order. `id` is the `GalleryItem` id (for cache reconciliation in #2);
  `publicId` makes it render-ready (thumbnails are URL-derived) with no server
  fetch — this is what makes WYSIWYG previews possible in #2.
- **Browsing data:** collection list comes from the cached `usePickerData()`.
  A collection's photos are fetched lazily on drill-in via the new paginated
  endpoint, so we never load hundreds of items up front.

### Virtual "All photos" collection

A virtual entry pinned at the top of the collection grid lists **all** workspace
photos, newest-first, paginated — covering standalone (`collectionId: null`)
photos so nothing is orphaned, and giving a fast path for "I just uploaded it."
Backed by the existing flat `listItemsForPicker` logic, made paginated.

### Bulk selection ("Select all in collection")

- Multi mode only. With a `max` set and the collection larger than `max`, selects
  the **newest `max`** photos (newest-first). Without a `max`, selects all
  (bounded by `PICKER_ITEMS_CAP` safety).
- "Select all on page" toggles just the currently loaded page (respecting `max`).

## Modal UX — states, A11y, mobile

- **Async states (every level):** loading (spinner), error (message + Retry),
  empty-collection, empty-workspace ("No photos yet — upload below"), populated.
  Upload zone: idle / drag-active / uploading.
- **Selection affordances:** tap toggles; selected photos show an order badge;
  a top **reorder strip** (drag, reusing the `FeaturedItemsPicker` grip pattern)
  reorders/removes. Bulk actions: "Select all on page", "Select all in
  collection". Single mode: picking replaces and closes.
- **Navigation:** collection grid ⇄ collection photos with a clear Back control
  and a breadcrumb/title; "Create collection" affordance in the collection grid.
- **Accessibility:** dialog focus-trap + Escape (from `dialog.tsx`);
  `role="listbox"`/`role="option"` + `aria-selected`; photos keyboard-togglable;
  visible `focus-visible` rings; drag has a visible grip (no hover-only UX);
  selection state never conveyed by color alone (badge + ring). Plain English
  strings — the Puck field panel is **not** wrapped in an `IntlProvider`.
- **Mobile (375px):** full-screen modal; grid drops to a comfortable column count
  (≈2–3); sticky bottom action bar with selection count + Done. Collection-first
  nav avoids one giant scroll.

## Backend — collection items endpoint

`GET /api/portfolio/gallery/collections/[id]/items?cursor=<c>&limit=16`

- Owner-only via `requireOrg` (403 for member/none).
- `workspaceId` from the Clerk session — never from the client.
- Filter `{ workspaceId, collectionId: id }`, ordered by the existing
  `{ workspaceId, collectionId, order }` compound index.
- **Cursor pagination** on `(order, _id)`; response
  `{ items: PickerItem[]; nextCursor: string | null }`. `limit` clamped (e.g. ≤ 50,
  default 16 = one 4×4 page).
- Validates `id` with `isValidObjectId` ⇒ 400 on bad input.
- `runtime = "nodejs"`.
- The virtual "All photos" feed reuses the same handler shape without the
  `collectionId` filter (paginated `listItemsForPicker`), via a dedicated path or
  an `id="all"` sentinel — decided at plan time.

New query helper (gallery query layer): a paginated
`listCollectionItemsPage({ workspaceId, collectionId, cursor, limit })` returning
`{ items, nextCursor }`, plus a paginated variant of the flat feed for "All
photos".

## What this sub-project changes at call sites

- **Re-points (value-compatible, no migration):** Image block and container
  background `_style.bgImagePublicId` / `backgroundImagePublicId` move from
  `SingleImagePicker` to `imageField`.
- **Adds:** `imagesField` (used by #2's gallery blocks; introduced here with
  tests but its block call sites land in #2).
- **Leaves intact for now:** `FeaturedItemsPicker` (Featured Work) and
  `CollectionPicker` (gallery blocks) keep working until #2 rewires them.
- `usePickerData` / `PickerItem` / `PickerCollection` types extended additively
  (no breaking changes).

## Testing

- **`MediaPicker`:** single vs multi selection; cap enforcement (single=1,
  multi=`max`); reorder; "select all on page"; "select all in collection" with a
  `max` (newest-`max`); pagination "load more"; upload-into-collection happy path
  + rejects (type/size/dimension); create-collection; all async states (loading/
  error/empty/populated); "All photos" virtual collection.
- **Endpoint:** owner-only (403 member/none); **tenant isolation** (cannot read
  another workspace's collection items); cursor pagination correctness +
  `nextCursor`; invalid id ⇒ 400; limit clamping.
- **Adapters:** value round-trips (single `string`; multi ordered array);
  clear-to-empty; opening/closing the modal.
- **Query layer:** paginated helpers return correct order + cursor; respect
  `workspaceId`.

## Risks / notes

- **Modal inside Puck:** the field panel has no `IntlProvider` (English strings)
  and the dialog must portal above Puck's chrome — verify `dialog.tsx` portals to
  `document.body` and z-indexes above the editor at plan/implement time.
- **`PICKER_ITEMS_CAP`:** keep as the safety bound for "All photos" and unbounded
  bulk select; surface a console warning when capping (matches existing behavior).
- **Display order vs bulk-select order:** collection photos display in collection
  `order`; bulk "select all in collection" caps by **newest-first**. This is an
  intentional, documented divergence (owner wants "the latest N").

## Definition of done (this sub-project)

- `MediaPicker` + `imageField` + `imagesField` implemented with all states.
- Collection items endpoint + paginated query helpers implemented.
- Image block + container background re-pointed to `imageField`.
- Tests above passing; `pnpm typecheck` + `pnpm lint` clean.
- Mobile checked at 375px.
- No locale files needed (editor chrome is English-only by design); confirm no
  public-facing strings were added.
