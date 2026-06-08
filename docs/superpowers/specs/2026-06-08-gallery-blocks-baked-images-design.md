# Gallery Blocks — Baked Images Data Model (Option A) — Design

**Date:** 2026-06-08
**Branch:** `feat/portfolio-enhancements`
**Status:** Approved design, pending spec review
**Depends on:** Spec #1 — Unified Media Picker (`imagesField` / `{ id, publicId }` value shape)

## Context

**Sub-project #2 of 3** in the portfolio-builder effort:

1. Unified media picker (spec #1 — done).
2. **Gallery blocks → baked images data model** (this spec).
3. Container background slideshow (spec #3 — later).

Today the gallery blocks (Grid / Masonry / Carousel) store a `collectionId` and
fetch their photos **server-side at render** via `listItemsForBlock`. Two
consequences this sub-project removes:

- The editor can only show a **text-stub preview** (the real block is an async
  server component that can't run in the client `<Puck>` canvas).
- The live page does a **DB fetch per gallery block** at render.

We replace the pointer with explicit, baked image data so blocks render purely
from their own props — enabling true WYSIWYG editor previews and fetch-free live
rendering.

### Pipeline facts (verified)

- `Workspace.publicPage.data.{home,gallery}` holds raw Puck data. **There is no
  separate published snapshot** — draft and live read the same field;
  `publicPage.publishedAt` is a flag.
- Draft↔live boundary is **cache-based**: `savePortfolioDraftAction`
  (`app/[locale]/(app)/portfolio/_actions.ts`) does *not* revalidate;
  `publishPortfolioAction` sets `publishedAt`/`lastPublishedAt` and calls
  `revalidatePath('/w/<slug>')` + `/gallery` + sitemap.
- Editor loads draft via `page.tsx` → `toPlain()` → `<EditorShell initialData>`.
- Public render: `app/(public)/w/[orgSlug]/page.tsx` →
  `findPublishedWorkspaceBySlug` (filters `publishedAt != null`) → `<Render
  data={homeData} config={puckConfig}>` inside `runWithRenderWorkspace(...)`.
- Blocks read tenant context via `getRenderWorkspaceFrom(puck)`
  (`lib/page-builder/serverContext.tsx`) — `workspaceId` is **never** from Puck
  props.
- `listItemsForBlock` (`lib/db/queries/gallery.ts`) resolves
  `{ workspaceId, collectionId, isPublic: true }` → ordered items.
- A migration pattern exists (`lib/db/migrations/`), but **we are still in dev —
  no production portfolios to protect — so no migration is required.**

## Decisions (locked)

- **Storage:** bake `images: Array<{ id, publicId, alt }>` into each block's Puck
  props (written by spec #1's `imagesField`). `id` = durable `GalleryItem` id;
  `publicId` + `alt` = reconcilable cache.
- **Reconcile** runs on **editor load (in-memory, not persisted)** and on
  **publish (persisted)**. Not on every save.
- **Scope:** Grid, Masonry, Carousel. Featured Work + `FeaturedItemsPicker` are a
  later separate spec.
- **No migration script.** Re-seed the default template to the new shape; dev-only.

## Goals

- Gallery blocks render from their own props — WYSIWYG in the editor, no DB fetch
  live.
- Block data stays correct as photos change: reconcile refreshes/prunes at the
  right moments.
- Retire the server-fetch + Preview-stub split for these three blocks.

## Non-goals

- Featured Work conversion (later spec).
- Container background (single image; handled by spec #1's `imageField`).
- A true published snapshot / draft isolation overhaul (out of scope; the existing
  cache-based boundary is unchanged).
- Production data migration.

## Data shape changes

For Grid, Masonry, Carousel — **remove** `collectionId` and `maxItems`; **add**
`images`:

`alt` provenance: spec #1's `imagesField` writes `{ id, publicId }` at pick time;
**reconcile populates/refreshes `alt`** (`altText || caption || ""`). So `alt` is
optional/empty between a fresh pick and the next reconcile (editor-load or
publish), which is acceptable — it is filled before the data goes live.

```ts
type GalleryImage = { id: string; publicId: string; alt?: string };

// Grid
type GalleryGridProps   = { _style?; images: GalleryImage[]; columns: 2|3|4; gap: "tight"|"normal"|"loose" };
// Masonry
type GalleryMasonryProps= { _style?; images: GalleryImage[]; columns: 2|3|4; gap: "tight"|"normal"|"loose" };
// Carousel
type GalleryCarouselProps = {
  _style?; images: GalleryImage[];
  heading: string; description: string;
  aspect: "square"|"landscape"|"portrait";
  floatX: "left"|"center"|"right"; floatY: "top"|"center"|"bottom";
  autoplay: boolean;
  // overlayAlign legacy mapping may be dropped (dev-only, no saved data to honor)
};
```

`maxItems` is obsolete (array length is the count). `columns`/`gap`/`aspect`/
`autoplay`/`floatX`/`floatY`/`heading`/`description` remain as presentation.

## Blocks become isomorphic (client-safe)

Because `publicId` → thumbnail URL is deterministic (`cloudinaryThumbnailUrl`),
the blocks no longer need server data access to render. Each block:

- Maps `images[]` → render (Grid/Masonry: thumb grid; Carousel: maps to
  `CarouselSlide[]` and feeds the existing `GalleryCarouselClient`).
- Renders empty-state when `images` is empty.
- Is imported as the **real component** in both `config.ts` (production `<Render>`)
  and `editorConfig.tsx` (editor canvas). The editor's `Preview`/
  `GalleryCollectionPreview` stubs and `collectionField()` for these blocks are
  **removed**; `imagesField` replaces them.

Net cleanup: the three blocks stop being async server components; the editor/
server-block duplication for them disappears. `getRenderWorkspaceFrom` /
`listItemsForBlock` are no longer used by these blocks (keep `listItemsForBlock`
only if another consumer remains; otherwise retire).

## Reconcile — the cache rebuild

`reconcileGalleryImages(workspaceId, puckData)` (server helper, gallery query
layer or a new `lib/page-builder/reconcile.ts`):

1. Walk the Puck data tree; collect every gallery block's `images[]` and their
   `id`s across all blocks.
2. **One batched query**: `GalleryItem.find({ workspaceId, _id: { $in: allIds } })`
   selecting `cloudinaryPublicId`, `altText`, `caption` (no N+1).
3. Rebuild each block's `images[]`: for each stored `id`, if the item still
   exists, emit `{ id, publicId: cloudinaryPublicId, alt: altText || caption || "" }`
   (refreshes a changed publicId/alt); if it no longer exists, **drop it**.
   Order is preserved from the stored array. **Never adds** ids (explicit picks).
4. Return the new Puck data (pure transform over the fetched map).

Triggers:

- **Editor load** (`page.tsx`): call reconcile on `home`/`gallery` data
  in-memory before `toPlain()` → Puck shows current state; **not persisted** (no
  surprise write on open). The owner's next save persists it.
- **Publish** (`publishPortfolioAction`): reconcile `home` + `gallery`, persist
  the reconciled data, then set `publishedAt` + revalidate. Guarantees live
  renders fresh, fetch-free data.

Tenant safety: `workspaceId` is the caller's session workspace; the `$in` query is
always scoped by `workspaceId`, so foreign ids resolve to nothing and are pruned.

## Editor & render wiring

- `editorConfig.tsx`: `galleryGrid`/`galleryMasonry`/`galleryCarousel` configs use
  `imagesField` (+ keep presentation fields), `render` = the real block, drop the
  `resolveFields` stub plumbing tied to `collectionId`/`maxItems`. Update the
  inlined `*DefaultProps` (now `images: []`) and the parity test.
- `config.ts` (production): import the real (now client-safe) blocks; remove the
  async/server-only handling for these three.
- Default seed/template (`seedDefaultPortfolio` / `sectionPresets` if they
  reference these blocks): new shape with `images: []`.

## Testing

- **Reconcile:** refreshes changed publicId/alt; prunes deleted ids; preserves
  order; never adds; batched (assert single query / no N+1); tenant isolation
  (foreign id pruned); empty/no-gallery-block data is a no-op.
- **Blocks (isomorphic):** Grid/Masonry render N images with columns/gap; Carousel
  maps images→slides and drives `GalleryCarouselClient`; empty `images[]` →
  empty state; render is client-safe (no Mongo import in the client bundle).
- **Editor configs:** `imagesField` round-trips ordered `images[]`; parity test
  passes with new defaults; removed `collectionId`/`maxItems` no longer present.
- **Publish action:** persists reconciled `images[]`; still sets `publishedAt` +
  revalidates; owner-only.
- **Editor load:** reconcile applied in-memory; not persisted (assert no write on
  GET).

## Risks / notes

- **Re-seed dev data:** existing dev drafts with `collectionId` blocks will render
  empty (no `images[]`); re-create or re-seed them. Acceptable (dev-only).
- **Client bundle hygiene:** ensure the now-client-safe blocks don't transitively
  import server-only modules (Mongo / `node:async_hooks`) — the whole point is to
  drop that graph for these three. Guard with the existing client/server import
  discipline.
- **`listItemsForBlock` retirement:** confirm no remaining consumer before
  deleting; otherwise leave it but unused by these blocks.

## Definition of done

- Three blocks store/render `images[]`; async server-fetch path removed for them.
- `reconcileGalleryImages` implemented; wired into editor load (in-memory) and
  publish (persisted).
- `editorConfig` + `config.ts` use the real client-safe blocks with `imagesField`;
  parity test updated and passing.
- Default seed updated.
- Tests above passing; `pnpm typecheck` + `pnpm lint` clean.
- Mobile checked at 375px (editor previews + live).
- No new public-facing locale strings (editor chrome English-only); confirm.
