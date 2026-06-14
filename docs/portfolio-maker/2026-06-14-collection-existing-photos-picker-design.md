# Collection "pick existing photos" + Edit Collection — Design Spec

Date: 2026-06-14
Branch: `fix/portfolio-maker` (enhancement on the open PR #24)
Status: Approved shape — pending spec review

## Goal

Let an owner build/grow a gallery collection from photos that already exist in the
workspace, not just by uploading new files. Add a shared "pick existing photos"
picker to the **create** flow, and introduce a real **Edit Collection** dialog
(rename, add photos, remove-from-collection, delete-image) reached by clicking a
collection in the manager.

## Decisions (locked)

- **Membership model: Copy.** Selecting an existing photo and adding it to a
  collection creates a *new* `GalleryItem` document that points at the **same**
  Cloudinary asset (`cloudinaryPublicId` / `url` reused; new per-collection
  `order`). One physical asset can be referenced by several `GalleryItem` docs.
- **All Photos de-duplicates by asset.** `listAllItemsPage` returns each unique
  `cloudinaryPublicId` once (newest doc per asset). This keeps the picker and the
  block-level MediaPicker clean now that copies exist.
- **Reference-counted Cloudinary destroy.** Any path that would destroy a
  Cloudinary asset must first confirm no other `GalleryItem` in the workspace
  references that `publicId`. DB docs still delete unconditionally.
- **Edit Collection scope:** rename + add (upload & pick-existing) + remove-from-
  collection + delete-image + **reorder (drag-and-drop)** + **cover-pick**.
- **Slug is stable on rename.** Rename updates `name` (display) only; `slug` is
  left unchanged so existing references/links don't break.

## Existing code this builds on

- `lib/page-builder/galleryPicker/CreateCollectionDialog.tsx` — create dialog;
  accumulates `images: LocalImage[]` then `POST /api/portfolio/gallery/collections
  { name, items }`.
- `lib/page-builder/galleryPicker/CollectionsManagerDialog.tsx` — "Photos &
  collections" manager. Lists collections, delete, "Add new collection". Clicking
  a collection currently does nothing.
- `lib/page-builder/galleryPicker/MediaPicker.tsx` — block-level picker
  (collections → photos drill-down, cursor pagination, multi-select). NOT
  modified; the new picker is a leaner, purpose-built sibling.
- `lib/page-builder/galleryPicker/usePickerData.ts` — loads `{ collections, items }`.
- `lib/db/queries/gallery.ts` — `listCollectionsForPicker`, `listCollectionItemsPage`,
  `listAllItemsPage`, `cloudinaryThumbnailUrl` via `toPickerItem`.
- `app/api/portfolio/gallery/collections/[id]/route.ts` — GET (paginated feed,
  `id="all"` virtual) + DELETE (hard-delete collection + assets).
- `app/api/portfolio/gallery/items/route.ts` — POST single item (`collectionId?`).
- Models: `GalleryItem { workspaceId, collectionId|null, cloudinaryPublicId, url,
  format, width, height, sizeBytes, caption, altText, order, tags }`,
  `GalleryCollection { workspaceId, name, slug, coverItemId, isPublic, order }`.

## Components

### `ExistingPhotosPicker.tsx` (new, shared)

A self-contained modal for choosing photos already in the workspace. Used by both
the create and edit dialogs.

Props:
```ts
{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // publicIds already present in the target collection — for skip/idempotency hints
  excludePublicIds?: string[];
  // selected existing photos handed back to the caller (caller decides how to persist)
  onAdd: (items: PickerItem[]) => void;
}
```

Behaviour (matches the requested layout exactly):
1. **Collections grid** — `4×2` grid (8 cells), **client-paginated** over the
   collections from `usePickerData`. **"All Photos" is pinned to the first cell of
   the first page** (page 1 = All Photos + 7 collections; later pages = 8). Each
   cell: cover thumbnail, name (truncate), photo count. Prev/next pager.
2. **Photos modal** — clicking a cell opens a nested, smaller modal:
   - Header row: collection title (truncate + ellipsis on overflow) with a **close
     button at the far right of the title row**.
   - `3×3` thumbnail grid, **cursor-paginated** via
     `GET /api/portfolio/gallery/collections/[id]?cursor=&limit=9`
     (`id="all"` for All Photos). "Load more" appends.
   - Thumbnails are multi-select toggles (selected badge; visible idle/hover/
     focus/selected states). Photos already in the target (`excludePublicIds`)
     render disabled with an "Added" marker.
   - Footer: "Add N photos" (disabled at 0) → `onAdd(selected)` → closes back to
     the collections grid / parent dialog.

States: loading, empty ("No photos here yet"), error + retry, populated. Mobile-
first at 375px (grids collapse columns gracefully; modals are `h-dvh` on mobile,
capped on `sm`).

### `CreateCollectionDialog.tsx` (modify)

- Add a **"Select existing photos"** button beside the drag-drop upload zone that
  opens `ExistingPhotosPicker`.
- `onAdd(items)` appends them to local `images[]` (deduped by `publicId` against
  what's already staged). They ride the existing create POST as copies — **no new
  backend for create**.
- Preview grid shows uploaded + picked items together, each removable pre-save.

### `EditCollectionDialog.tsx` (new)

Opened from `CollectionsManagerDialog` when a collection cell is clicked.

Sections (use steps/tabs if the mobile height gets tall, per the engineering bar):
- **Rename** — text input bound to the collection name; commit via `PATCH`. Empty
  name blocked with inline error; Save disabled while invalid/unchanged.
- **Add photos** — drag-drop upload (reuse the existing upload flow, posting to
  `POST /items` with this `collectionId`) **and** the "Select existing photos"
  button → `ExistingPhotosPicker`; `onAdd` calls the copy endpoint then refreshes.
- **Current photos** — grid of this collection's items
  (`GET /collections/[id]?cursor=`), multi-selectable, **drag-and-drop reorderable**.
  - Each thumbnail shows a **visible drag affordance** (grip handle, mirroring the
    existing `ReorderChip` pattern in `MediaPicker`) and supports a
    **keyboard-accessible** alternative (move-up / move-down controls or arrow-key
    reorder) — no hover-only / drag-only UX. Reorder persists via
    `POST /collections/[id]/items/reorder`.
  - Each thumbnail has a **"Set as cover"** affordance; the current cover shows a
    persistent badge (cover is signalled by more than color). Persists via the
    `PATCH /collections/[id]` `coverItemId` field.
  - A selection action bar exposes two bulk actions:
    - **Remove from collection** — `POST /collections/[id]/items/remove`.
    - **Delete image** — destructive; behind an `AlertDialog` confirm that warns
      the photo will be removed from **every** collection. `POST /items/delete`.
- Footer: Done. Optimistic updates for add/remove/reorder/cover; refetch on error.

### `CollectionsManagerDialog.tsx` (modify)

- Clicking a collection cell opens `EditCollectionDialog` for that collection
  (keep the existing delete button on the cell). `retry()` refreshes counts/covers
  after edits.

## Backend

### New / changed routes

1. **`POST /api/portfolio/gallery/collections/[id]/items/copy`** (new)
   - Body: `{ sourceItemIds: string[] }` (validated with Zod).
   - Owner-only; resolve each source `GalleryItem` **scoped to the workspace**
     (foreign/missing ids are ignored, not errors).
   - **Idempotent per collection:** skip any source whose `publicId` is already in
     the target collection. For the rest, insert new `GalleryItem` copies
     (`collectionId = [id]`, appended `order`, reuse `url`/`publicId`/dims/format/
     `sizeBytes`; `caption`/`altText` copied). Transactional.
   - If the collection has no cover yet, set `coverItemId` to the first inserted.
   - Response: `{ items: PickerItem[] }` (the created copies).

2. **`PATCH /api/portfolio/gallery/collections/[id]`** (new, same route file)
   - Body: `{ name?: string; coverItemId?: string }` (Zod; at least one present).
     Owner-only, workspace-scoped.
   - `name`: trim, non-empty → updates `name` only; `slug` unchanged.
   - `coverItemId`: must reference a `GalleryItem` in **this** collection and
     workspace, else 400; updates `coverItemId`.
   - Response: `{ id, name, coverItemId }`.

2a. **`POST /api/portfolio/gallery/collections/[id]/items/reorder`** (new)
   - Body: `{ orderedItemIds: string[] }` (Zod). Owner-only, workspace-scoped.
   - Reassigns `order` sequentially (index) to the provided items, scoped to
     `collectionId = [id]`; ids not in this collection/workspace are ignored.
     Transactional. The edit dialog loads the collection's items in full before
     entering reorder so the submitted list is complete (collections are
     user-curated and bounded; if a collection grows large this can move to a
     within-page reorder — noted, not built now).
   - Response: `{ ok: true }`.

3. **`POST /api/portfolio/gallery/collections/[id]/items/remove`** (new)
   - Body: `{ itemIds: string[] }`. Owner-only, workspace-scoped.
   - **Detach from this collection:** for each selected item belonging to `[id]`,
     if the asset has another `GalleryItem` (any collection or standalone), delete
     this membership doc; if it's the asset's **last remaining doc**, set
     `collectionId = null` instead (keep the photo in the library). **Never**
     destroys a Cloudinary asset. Transactional.
   - If a removed item was the collection's `coverItemId`, repoint cover to the
     newest remaining item (or null).
   - Response: `{ removed: number }`.

4. **`POST /api/portfolio/gallery/items/delete`** (new)
   - Body: `{ itemIds: string[] }`. Owner-only, workspace-scoped.
   - **Permanent, library-wide:** resolve the selected items' `publicId`s; delete
     **all** workspace `GalleryItem` docs sharing each `publicId` and **destroy**
     each Cloudinary asset (best-effort, post-commit, like collection delete).
   - Repoint any affected collection `coverItemId`s that pointed at a deleted doc.
   - Response: `{ deletedDocs: number, assetsDestroyed: number, assetsFailed: number }`.

5. **`DELETE /api/portfolio/gallery/collections/[id]`** (modify)
   - Before destroying each asset, **reference-count**: destroy on Cloudinary only
     if no `GalleryItem` outside this collection references that `publicId`. DB
     delete of the collection's items/collection is unchanged.

### Query layer (`lib/db/queries/gallery.ts`)

- **`listAllItemsPage` — de-dupe by `publicId`.** Return each asset once
  (newest doc per `publicId`), preserving stable cursor pagination
  (sort `createdAt DESC, _id DESC`; group/collapse by `publicId`). Keeps the
  existing response contract `{ items, nextCursor }`.
- Add helpers as needed: `countAssetRefs(workspaceId, publicId)`,
  `copyItemsIntoCollection(...)`, `detachItemsFromCollection(...)`,
  `deleteItemsByPublicId(...)`. Each is workspace-scoped.

### Validation & multi-tenancy

- Every new handler is owner-only via `requireOrg()` and filters by
  `workspaceId`; bodies validated with Zod, then trusted.
- Source/target ids are always re-resolved under `workspaceId` — a client can
  never copy, remove, or delete another workspace's items by id.
- Multi-doc writes (copy, remove, delete) run in Mongo transactions.

## Data-flow summaries

**Create + pick existing:** pick in `ExistingPhotosPicker` → `onAdd` appends to
`images[]` → existing `POST /collections { name, items }` creates copies.

**Edit + pick existing:** pick → `onAdd` → `POST /collections/[id]/items/copy` →
refresh current-photos grid + manager counts.

**Remove vs delete:** "Remove from collection" detaches (keeps in library);
"Delete image" wipes the asset everywhere (reference-counting is moot — it's the
explicit destroy path) behind a destructive confirm.

## Edge cases

- Re-adding a photo already in the collection → skipped server-side (idempotent);
  UI shows it as "Added"/disabled in the picker.
- Removing/deleting the cover photo → cover repointed (newest remaining) or null.
- Deleting an image used as a Hero/CTA background (a `collectionId:null` doc with
  the same `publicId`) → that doc is included in the library-wide delete; the
  block falls back to its empty state. (Acceptable: "delete image" means gone.)
- Empty workspace / empty collection → picker and grids show empty states.
- Concurrent edits → optimistic UI reconciles on refetch; server stays
  authoritative.

## Testing (project bar: every change ships tests)

Component (Vitest + Testing Library, `renderWithProviders`):
- `ExistingPhotosPicker` — All-Photos-first ordering, collections client-pagination,
  photos cursor-pagination ("Load more"), multi-select toggle, `excludePublicIds`
  disabled state, "Add N" callback payload, loading/empty/error states.
- `CreateCollectionDialog` — picked items merge into the create payload (deduped).
- `EditCollectionDialog` — rename validation + PATCH, add-from-existing calls copy,
  multi-select action bar, remove vs delete (delete behind confirm), **cover-pick**
  (badge + PATCH `coverItemId`), **reorder** (drag + keyboard move) persists the
  new order.
- `CollectionsManagerDialog` — clicking a collection opens the edit dialog.

API / data layer (in-memory Mongo, mock Cloudinary only):
- copy: creates copies, **per-collection idempotency**, **tenant isolation**
  (can't copy a foreign workspace's items), cover backfill.
- remove: detaches; last-doc → standalone (`collectionId:null`); no Cloudinary
  destroy; cover repoint.
- delete: removes all docs for a `publicId` + destroys asset; tenant isolation;
  cover repoint.
- collection DELETE: **reference-counted** destroy (asset kept when another doc
  references it).
- `listAllItemsPage`: de-dupes by `publicId`; cursor stays correct across pages.
- reorder: `orderedItemIds` reassigns `order` by index; foreign ids ignored;
  feed then returns items in the new order.
- cover-pick (PATCH `coverItemId`): accepts an item in the collection; rejects a
  foreign/other-collection item (400); **tenant isolation**.

## Done criteria

Implementation complete; tests added & passing; `pnpm typecheck` + `pnpm lint`
clean; editor chrome stays English-only (no locale files — RELEASE-CHECKLIST §4f);
mobile checked at 375px; optimistic add/remove; errors surfaced; new compound
queries confirmed against existing `GalleryItem` indexes (notably
`{workspaceId, cloudinaryPublicId}` lookups for reference-counting — add an index
if missing).

## Out of scope

Moving (vs copying) photos between collections, many-to-many membership model,
public-gallery changes beyond what the dedup naturally yields, cross-page drag
reorder for very large collections (reorder operates on the fully-loaded list).
