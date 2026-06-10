# Featured Work — Collections Redesign — Design

**Date:** 2026-06-09
**Branch:** `feat/portfolio-enhancements`
**Status:** Approved design, pending spec review
**Depends on:** Spec #1 (`MediaPicker` / paginated collection-items endpoint), Spec #2 (baked block data + `reconcileGalleryImages`), Spec #3 (container background slideshow — independent, no shared code)

## Context

**Sub-project #4 of the portfolio-builder effort.** The first three specs converted
single-pointer image fields to baked, render-ready data:

1. Unified media picker (`MediaPicker`, `imageField`/`imagesField`, paginated
   collection-items endpoint) — done.
2. Gallery blocks → baked `images[]` + `reconcileGalleryImages` — done.
3. Container background slideshow — done/independent.
4. **Featured Work → collections grid + public collection popup** (this spec).

Spec #2 explicitly **deferred** Featured Work: _"Featured Work + `FeaturedItemsPicker`
are a later separate spec."_ This is that spec. It also retires `FeaturedItemsPicker`,
the last call site spec #1 left intact.

### What Featured Work is today (verified)

- `FeaturedWorkBlock` (`lib/page-builder/blocks/FeaturedWorkBlock.tsx`) is an
  **async server component**. It stores `itemIds: Array<{ id }>` (**hard-capped at 3**,
  `MAX_FEATURED = 3`) and fetches the photos at render via `getItemsByIds`
  (`lib/db/queries/gallery.ts`), tenant-scoped through `getRenderWorkspaceFrom(puck)`.
- It renders a CSS grid of up to 3 figures (`row` or `stagger` layout), each a
  single image with an optional caption. No collection concept, no interactivity.
- The editor field is a raw Puck `array` of `{ id }` text rows
  (`itemIds`, label _"Gallery item IDs (max 3)"_) — not even wired to a picker in
  the block config; `FeaturedItemsPicker` (the real UI, capped at 3, with upload +
  drag-reorder) is the multi-select picker spec #1 kept alive.
- The editor sections row (`EditorShell.tsx`) renders tabs from
  `EDITOR_SECTIONS = ["home", "gallery", "header", "contact"]`. `home`/`gallery`
  are Puck zones; `header`/`contact` open config **dialog panels**
  (`openHeader()` / `openContact()`) backed by `publicPage.header` /
  `publicPage.contact` configs (persisted via `updateHeaderConfigAction` /
  `updateContactConfigAction`, owner-only, revalidating `/w/<slug>`).
- The paginated collection-items endpoint from spec #1 already exists and is
  **owner-only**: `GET /api/portfolio/gallery/collections/[id]` →
  `{ items: PickerItem[]; nextCursor }`, with an `id="all"` sentinel and
  `?newest=<n>` (`listCollectionItemsPage` / `listAllItemsPage` /
  `listCollectionNewest`).

## The ask

Redesign Featured Work into a **collections showcase**:

- The block holds **any number of collections** (remove the 3-item cap; the unit
  is now a *collection*, not an individual photo).
- Each collection renders as a **cover thumbnail with the collection title beneath it**,
  laid out in a grid.
- **Clicking a collection opens a popup modal** (`max-h: 90vh`, `min-w: 90vw`,
  `max-w: 900px`) with a **sticky title header**, a **floating close button**
  (top-right), and a scrollable body.
- The body is a **paginated** flex grid of the collection's images — **6 per row**,
  wrapping (`flex-wrap`, not a rigid CSS grid), next row continues left-to-right.
- **Clicking an image** opens a **second (nested) lightbox modal on top** showing
  the image at full dimensions.
- A new **"Collections Popup" editor tab** (right of the Gallery tab) lets the owner
  style the popup: **border, background color, modal roundedness** — kept simple.

## Decisions (locked)

- **Block value:** `collections: Array<{ id; name; coverPublicId; itemCount }>` baked
  into Puck props (spec #2 pattern). `id` = durable `GalleryCollection` id; `name` +
  `coverPublicId` + `itemCount` = reconcilable cache so the block renders
  **WYSIWYG client-side** with no server fetch. **No cap.**
- **Picker:** a new **`collections` mode** on spec #1's `MediaPicker` (it is already
  collection-first). Picking toggles whole collections, ordered, reorderable.
  `FeaturedItemsPicker` is **retired**.
- **Block becomes isomorphic / client-safe** (like spec #2's gallery blocks): tiles
  render purely from baked covers; `getItemsByIds` is no longer used by this block.
- **Popup images are fetched lazily, paginated** — **never baked** (collections can
  hold hundreds of photos). New **public** slug-scoped endpoint mirrors spec #1's
  owner endpoint shape.
- **Popup styling** lives in a new `publicPage.collectionsPopup` config (border /
  background / radius), edited from a new tab, persisted/validated/revalidated
  exactly like `header`/`contact`.
- **Reconcile:** extend the spec #2 walk to also refresh/prune Featured Work
  `collections[]` (name + cover) on editor-load (in-memory) and publish (persisted).
- **No migration.** Dev-only; re-seed the default template's Featured Work block to
  the new shape. The old `itemIds`/`layout`/`MAX_FEATURED` path is removed.

## Non-goals

- Editing collection *contents* from this block (that is the Photos / Collections
  Manager — `CollectionsManagerDialog`).
- Per-collection custom styling (one shared popup style for the workspace).
- Baking popup images, infinite-scroll virtualization, or a public search inside the
  popup (paginated "load more" is sufficient for MVP).
- Touching Grid/Masonry/Carousel (spec #2 owns those).

## Data shape changes

```ts
// Baked collection reference — written by the picker, refreshed by reconcile.
type FeaturedCollectionRef = {
  id: string;            // durable GalleryCollection id
  name: string;          // cache: collection name (reconcile-refreshed)
  coverPublicId: string; // cache: Cloudinary publicId of the cover (reconcile-refreshed)
  itemCount: number;     // cache: public photo count, shown beside the title (reconcile-refreshed)
};

type FeaturedWorkProps = {
  _style?: BlockStyle;
  collections: FeaturedCollectionRef[]; // replaces itemIds; no cap
  columns: 2 | 3 | 4;                    // tile grid columns (replaces `layout`)
  // `layout: "row" | "stagger"` and `itemIds`/MAX_FEATURED are removed (dev-only).
};
```

- `name`/`coverPublicId`/`itemCount` are optional/stale only between a fresh pick and
  the next reconcile (editor-load or publish) — same provenance contract as spec #2's
  `alt`. `itemCount` counts **public** items (`isPublic: true`) so the tile label
  matches what the popup will actually show.
- `coverPublicId` provenance: the collection's `coverImageId`'s publicId, or its
  newest item's publicId if no explicit cover (resolved during reconcile/pick).

### Popup style config (new)

```ts
type PortfolioCollectionsPopupConfig = {
  backgroundColor?: string;          // token name or hex (matches header/contact convention)
  borderColor?: string;              // token or hex
  borderWidth?: number;              // px, 0 = none
  radius?: BrandKitRadius | "";      // reuse the shared radius scale
};
```

Stored at `publicPage.collectionsPopup`; defaults give today's flat, sharp look
(no border, surface background, `radius: ""`).

## Rendering — the block (client-safe)

`FeaturedWorkBlock` stops being async. It maps `collections[]` → tiles:

- Each tile: cover `<img>` (`cloudinaryThumbnailUrl(coverPublicId, { width, height,
  crop: "fill" })`) + the **collection title and photo count beneath** the thumbnail
  (e.g. "Weddings · 24 photos"; the count is pluralized chrome text).
- Grid: `columns` columns; **collapses to 1 column < 640px** (existing mobile rule).
- **Empty state** when `collections` is empty (reuse the existing
  `labels.featuredEmpty` chrome string).
- Imported as the **real component** in both `config.ts` (public `<Render>`) and
  `editorConfig.tsx` (editor canvas) — so the editor shows real tiles (WYSIWYG),
  not a stub.
- Each tile is a button that opens the popup island for that collection id.

### `CollectionPopup` (public client island)

`lib/page-builder/blocks/CollectionPopup.tsx` (`"use client"`), built on
`components/ui/dialog.tsx` (focus-trap + Escape, portals above page chrome):

- **Trigger:** the block renders tiles; clicking one sets the active collection and
  opens the popup. One popup instance per block (keyed by active collection id).
- **Shell:** `max-h: 90vh`, `min-w: 90vw`, `max-w: 900px`, centered; styled from the
  `collectionsPopup` config (background / border / radius). The block passes the
  resolved config down (public render reads `publicPage.collectionsPopup`; editor
  passes the in-editor config so the preview matches).
- **Sticky header:** collection title, `position: sticky; top: 0`, above the
  scroll area.
- **Floating close button:** absolutely positioned top-right, `aria-label="Close"`,
  visible idle/hover/focus-visible states, always reachable while scrolling.
- **Scrollable body:** `overflow-y: auto` within the max height. Images in a
  **`flex flex-wrap`** row where each item is `flex: 0 0 calc(100%/6 ...)` so **6
  per row**, wrapping to the next line; gracefully reflows to fewer columns on
  mobile (≈2–3 at 375px). Not a rigid grid (per the ask).
- **Pagination:** fetches the active collection's images from the public endpoint
  (`?cursor=&limit=`), appending pages via a **"Load more"** control (or sentinel)
  until `nextCursor === null`. Async states: loading / error+Retry / empty /
  populated; "load more" has its own pending state.
- **Image lightbox (nested):** clicking an image opens a **second dialog stacked on
  top** showing the image at full dimensions (`object-fit: contain`, capped to
  viewport), with its own close + Escape; closing it returns focus to the popup.
  Focus management: opening the lightbox traps focus there; the underlying popup
  stays mounted.
- Decorative covers use real `alt` (caption/altText) where available; the lightbox
  image carries the same alt.

The block + popup are isomorphic: the editor canvas renders the real popup so the
owner can click a tile and see the actual modal styled by their config.

## Picker — `MediaPicker` collections mode

Add `mode: "collections"` to `MediaPicker` (spec #1):

- Renders the existing **collection-first grid**, but tiles **toggle the collection
  itself** (ordered multi-select) instead of drilling into photos.
- Value: `Array<{ id; name; coverPublicId; itemCount }>` (render-ready, matching the
  block). `usePickerData`'s `PickerCollection` already carries `name`/`coverUrl`/
  `itemCount` — derive `coverPublicId` from the cover and pass `itemCount` straight
  through at pick time; reconcile keeps both current.
- Selection affordances reuse spec #1's patterns: order badge, top reorder strip
  (drag, visible grip — no hover-only UX), `role="listbox"`/`aria-selected`,
  focus-visible rings, selection not by color alone. **No cap** (bounded only by the
  `PICKER_ITEMS_CAP` safety bound).
- Keep "create collection" + upload-into-collection from spec #1; uploading does not
  auto-select a *collection* (it adds a photo to one).

New adapter `collectionsField(label)` (picker barrel) — the single-purpose Puck
custom field for Featured Work's `collections`. Sidebar: cover strip + count +
"Choose collections". `FeaturedItemsPicker` and its test are **deleted**; the raw
`itemIds` array field is removed from the block config.

## Backend — public collection-images endpoint

The existing items endpoint is **owner-only** (`requireOrg`). The popup runs for
**anonymous public visitors**, so add a public, slug-scoped, paginated read:

`GET /api/public/w/[orgSlug]/collections/[id]?cursor=<c>&limit=<n>`

- Resolves `orgSlug -> workspaceId` via `findPublishedWorkspaceBySlug` (publish-gated;
  unpublished/unknown slug ⇒ 404). **`workspaceId` is never client-supplied.**
- Filters `{ workspaceId, collectionId: id, isPublic: true }`, ordered by the
  existing `{ workspaceId, collectionId, order }` index; **cursor pagination** on
  `(order, _id)`. Response `{ items: PublicCollectionImage[]; nextCursor }` where each
  item carries `{ id, publicId, alt }` (URLs derived client-side from `publicId`,
  including the full-size lightbox transform).
- `id` validated with `isValidObjectId` ⇒ 400; `limit` clamped (e.g. ≤ 50, default
  24 = four 6-wide rows). `runtime = "nodejs"`.
- Reuses a shared query helper alongside spec #1's `listCollectionItemsPage`
  (factor the tenant-scoped paginated read so owner + public share one code path,
  differing only in auth/`isPublic` filter and id resolution).

**Editor preview** uses the existing **owner** endpoint
(`/api/portfolio/gallery/collections/[id]`) so the in-canvas popup works without a
published slug. The block passes the popup island a `fetchPage(cursor)` resolver:
owner endpoint in the editor, public slug endpoint on the live page. Both return the
same `{ items, nextCursor }` contract.

## Editor — the "Collections Popup" tab

- Extend `EditorSection` and the tabs row so a new **`collectionsPopup`** entry
  renders **immediately right of `gallery`**. Like `header`/`contact`, it opens a
  **config dialog panel** (`openCollectionsPopup()`), not a Puck zone.
- The panel edits border color/width, background color, and radius via the existing
  style primitives (token-or-hex inputs + the `BRAND_KIT_RADII` select, matching the
  contact/header panels). Mirror the dialog scaffolding of `ContactPanelDialog` /
  `HeaderPanelDialog` (a new `CollectionsPopupPanelDialog`), including a small **live
  preview** of the popup chrome so styling is WYSIWYG.
- Persist via a new owner-only `updateCollectionsPopupConfigAction` →
  `$set: { "publicPage.collectionsPopup": parsed }`, validated by
  `portfolioCollectionsPopupConfigSchema` (Zod), `revalidatePath('/w/<slug>')`.
- Threaded through `EditorShell` like the other configs: `initialCollectionsPopup`
  prop, local state, browser-draft inclusion (`PortfolioBrowserDraft`), and the
  publish/save flow.
- Editor chrome strings are **English-only** (the Puck field panel is not wrapped in
  `IntlProvider`) — no new public-facing locale strings; confirm none are added.

## Reconcile — collections cache

Extend spec #2's `reconcileGalleryImages` walk (or a sibling `reconcileFeatured
Collections` invoked in the same pass) to also handle Featured Work blocks:

1. Walk the Puck tree; collect every Featured Work block's `collections[]` ids.
2. **One batched query**: `GalleryCollection.find({ workspaceId, _id: { $in: ids } })`
   selecting `name`, `coverImageId` (+ a batched newest-item lookup for collections
   with no explicit cover, and a batched `isPublic` count per collection) — no N+1.
3. Rebuild each block's `collections[]`: for each stored id still owned by the
   workspace, emit `{ id, name, coverPublicId, itemCount }` (refreshing renamed/
   re-covered collections and the public count); **drop** ids that no longer exist.
   Preserve order; **never add**.
4. Tenant-safe: `$in` is always scoped by `workspaceId`, so foreign ids prune.

Same triggers as spec #2: **editor load** (in-memory, not persisted) and **publish**
(persisted, then `publishedAt` + revalidate).

## Testing

- **Block (isomorphic):** renders N tiles (cover + title + pluralized count) at
  `columns`; no cap;
  collapses to 1 column < 640px; empty `collections[]` → empty state; client-safe
  (no Mongo import in the client bundle); clicking a tile opens the popup.
- **`CollectionPopup`:** dimensions (`90vh`/`90vw`/`900px`); sticky header; floating
  close (idle/hover/focus); body scrolls within max height; 6-per-row flex wrap;
  pagination "load more" until `nextCursor === null`; all async states; nested
  lightbox opens on image click, shows full size, Escape/close returns focus to the
  popup; styling reflects the config; reflows at 375px.
- **Picker (`collections` mode):** toggles whole collections; ordered multi-select;
  reorder; no cap; value round-trips `{ id, name, coverPublicId, itemCount }`;
  `collectionsField` adapter clears-to-empty and opens/closes the modal.
- **Public endpoint:** slug→workspace resolution; **404 on unpublished/unknown
  slug**; **tenant isolation** (cannot read another workspace's collection); only
  `isPublic` items; cursor pagination + `nextCursor`; invalid id ⇒ 400; limit
  clamping; `nodejs` runtime.
- **Popup config:** `updateCollectionsPopupConfigAction` owner-only (403 member/none);
  Zod validation; persists to `publicPage.collectionsPopup`; revalidates; editor
  panel round-trips and preview reflects values.
- **Reconcile:** refreshes name/cover/itemCount (public count); prunes deleted/foreign
  ids; preserves order;
  never adds; single batched query (no N+1); applied in-memory on editor load (no
  write on GET) and persisted on publish.
- **Cleanup:** `FeaturedItemsPicker` removed (no dangling import/test); `itemIds`/
  `layout`/`MAX_FEATURED` gone; `editorConfig` parity test updated; default seed uses
  the new shape; `getItemsByIds` consumer check (retire if unused elsewhere).

## Risks / notes

- **Public read surface:** this adds the first *public* gallery read endpoint —
  audit it hard for tenant isolation and publish-gating (404 before any item read),
  mirroring the public page's `findPublishedWorkspaceBySlug` discipline. No
  client-supplied `workspaceId`, ever.
- **Stacked dialogs / focus & z-index:** the lightbox sits above the popup, which
  sits above page chrome. Verify `dialog.tsx` portals to `document.body`, stacks
  predictably, and restores focus down the chain (lightbox → popup → trigger tile).
- **Editor vs public fetch divergence:** the `fetchPage` resolver indirection is the
  one place editor and live differ — keep the response contract identical and cover
  both in tests.
- **Cover resolution:** collections without an explicit `coverImageId` fall back to
  newest item; an empty collection has no cover — render a neutral placeholder tile
  (still clickable → popup shows the empty state).
- **Client bundle hygiene:** the now-client-safe block + popup must not transitively
  import server-only modules (Mongo / `node:async_hooks`).
- **`maxItems`/cap removal:** no cap means very large Featured Work grids are
  possible; tile rendering is cheap (covers only), and popup images stay paginated,
  so this is acceptable.

## Definition of done

- Featured Work stores/renders `collections[]` (cover + title + public count, no cap);
  async
  server-fetch path removed; block client-safe and WYSIWYG in the editor.
- `MediaPicker` `collections` mode + `collectionsField` implemented;
  `FeaturedItemsPicker` retired; raw `itemIds` field removed.
- `CollectionPopup` island: sticky header, floating close, scroll, 6-wide flex wrap,
  paginated load-more, nested full-size lightbox — all states + a11y + 375px.
- Public slug-scoped paginated collection-images endpoint (publish-gated,
  tenant-isolated, `isPublic` only) + shared paginated query helper.
- "Collections Popup" editor tab + `CollectionsPopupPanelDialog` +
  `publicPage.collectionsPopup` config + `updateCollectionsPopupConfigAction` +
  Zod schema, threaded through `EditorShell`/draft/publish.
- `reconcileGalleryImages` extended to Featured Work `collections[]` (editor-load
  in-memory, publish persisted); batched, tenant-safe.
- Default seed updated to the new shape; `editorConfig` parity test passing.
- Tests above passing; `pnpm typecheck` + `pnpm lint` clean.
- Mobile checked at 375px (block tiles, popup, lightbox); editor chrome English-only;
  no new public locale strings; indexes confirmed for the public query.
