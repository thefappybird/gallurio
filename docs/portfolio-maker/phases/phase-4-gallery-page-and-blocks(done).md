# Phase 4 — Gallery page + gallery blocks

> Parent: `../master-plan.md`
> Branch: `feat/page-builder-gallery-page` cut from `dev` (post-Phase-3).
> Implements the second public-page route (`/w/[orgSlug]/gallery`) and three gallery-layout blocks.

---

## Context

Phase 3 shipped `GalleryGridBlock` as a Home-page composition primitive. Phase 4 builds the dedicated Gallery page that lives at `/w/[orgSlug]/gallery` and adds two more layout variants (Masonry, Carousel) plus a `FeaturedWork` block. The Gallery page is the second of three pages in the locked scope (Home + Gallery + Contact-modal).

Why a separate route instead of a section on Home: galleries get long, deserve their own URL for SEO, and let owners experiment with layout per collection independently of the landing pitch.

---

## Acceptance criteria

- `app/(public)/w/[orgSlug]/gallery/page.tsx` exists, renders `publicPage.data.gallery` through Puck, reuses the brand-kit wrapper and the published-only guard.
- Public navigation between Home and Gallery uses an in-shell header (added in this phase) with three links: Home, Gallery, Contact (Contact link is a button that triggers `window.__gallurioOpenContact?.()` — wiring lands in Phase 5).
- Three new blocks under `lib/page-builder/blocks/`: `GalleryMasonryBlock`, `GalleryCarouselBlock`, `FeaturedWorkBlock`.
- All gallery blocks:
  - Reference `GalleryCollection` by ID (server-scoped lookup by `workspaceId`).
  - Use `cloudinaryThumbnailUrl(publicId, { width, height, crop: "fill" })` for thumbnails — never raw `secure_url` in markup for grid/masonry/carousel item cells.
  - Apply `loading="lazy"` and `decoding="async"` to non-LCP images.
  - Render an empty state when collection has no items.
- Carousel and Masonry blocks are `"use client"` (Carousel needs scroll/interaction, Masonry needs measured layout); Grid stays server-rendered.
- Gallery page metadata: `title = workspace.name + " — Gallery"`, description from workspace tagline if `seoDescription` absent, canonical `/w/<slug>/gallery`.
- Tests:
  - Tenant isolation: workspace A's gallery never resolves workspace B's `GalleryItem`s, even via crafted props (Puck data can lie; renderer must re-validate `workspaceId`).
  - Each gallery block renders correctly with empty / partial / full data.
  - Header navigation renders three buttons with correct ARIA labels.
- `pnpm test --run page-builder/blocks/Gallery* page-builder/blocks/FeaturedWork public/w/gallery` passes.

---

## File map

```
app/(public)/w/[orgSlug]/
  gallery/
    page.tsx
    page.test.tsx
  _components/
    PortfolioHeader.tsx         # nav: Home, Gallery, Contact button
    PortfolioHeader.test.tsx

lib/page-builder/blocks/
  GalleryMasonryBlock.tsx
  GalleryMasonryBlock.test.tsx
  GalleryCarouselBlock.tsx
  GalleryCarouselBlock.test.tsx
  FeaturedWorkBlock.tsx
  FeaturedWorkBlock.test.tsx

lib/db/queries/gallery.ts            # listItemsForBlock({ workspaceId, collectionId, limit })
lib/db/queries/gallery.test.ts
```

---

## Query helper (tenant-safe)

```ts
// lib/db/queries/gallery.ts
export async function listItemsForBlock(opts: {
  workspaceId: string;
  collectionId: string | null;
  limit?: number;
}) {
  await connectMongoose();
  if (!opts.collectionId) return [];
  return GalleryItem.find({
    workspaceId: opts.workspaceId,
    collectionId: opts.collectionId,
  })
    .sort({ order: 1, createdAt: 1 })
    .limit(opts.limit ?? 24)
    .lean();
}
```

Every gallery block calls `listItemsForBlock({ workspaceId: getRenderWorkspaceId(), collectionId: props.collectionId, limit: props.maxItems })`. **Never** uses `props.workspaceId` even if present.

---

## Block specs

### `GalleryMasonryBlock`
- Client component (needs CSS columns or JS measured layout).
- Props: `collectionId`, `columns` (`2`/`3`/`4`), `gap` (`tight`/`normal`/`loose`), `showCaptions`, `maxItems`.
- Use CSS `column-count` for masonry — no JS measurement library. Keeps bundle small.

### `GalleryCarouselBlock`
- Client component (scroll snap + arrow buttons).
- Props: `collectionId`, `aspect` (`square`/`landscape`/`portrait`), `autoplay` (default false), `maxItems`.
- Uses native `scroll-snap-type: x mandatory` for keyboard + touch friendliness. No third-party carousel library.

### `FeaturedWorkBlock`
- Server component.
- Props: `heading`, `subheading?`, `itemIds: string[]` (max 3 GalleryItem IDs), `layout` (`row` | `stagger`).
- Re-validates each `itemId` belongs to the active workspace; drops any that don't.

---

## Header navigation

`PortfolioHeader.tsx` lives at the public route's layout level so it appears on both Home and Gallery. Three links:
- Home → `/w/<slug>`
- Gallery → `/w/<slug>/gallery`
- Contact → button with `onClick={() => window.__gallurioOpenContact?.()}` (no-op stub until Phase 5)

Styled with brand-kit CSS variables. Sticky on scroll. Closes a mobile slide-out menu when a link is tapped. Accessible: `<nav aria-label="Portfolio">`, focus-visible rings.

---

## Schema

No new collections. Reuse existing:
- `GalleryCollection` (workspaceId, name, slug, coverItemId, isPublic, order)
- `GalleryItem` (workspaceId, collectionId, cloudinaryPublicId, url, dimensions, altText, order)

If `isPublic` is `false`, the gallery block treats the collection as missing (renders empty state). Document this behavior in the block's JSDoc-free comment header line.

---

## Tests

- `gallery.test.ts`:
  - empty collection ID → empty array
  - cross-workspace collection ID → empty array
  - sort order respects `order` then `createdAt`
- `GalleryMasonryBlock.test.tsx` / `GalleryCarouselBlock.test.tsx`:
  - smoke + empty state
  - `maxItems` cap respected
- `FeaturedWorkBlock.test.tsx`:
  - filters out IDs from other workspaces
  - drops missing IDs without crashing
- `app/(public)/w/[orgSlug]/gallery/page.test.tsx`:
  - 404 for unpublished workspace
  - renders fallback if `data.gallery` is null
  - metadata fallbacks

---

## Verification

```bash
pnpm test --run page-builder/blocks/Gallery
pnpm test --run page-builder/blocks/FeaturedWork
pnpm test --run public/w/gallery
pnpm typecheck
pnpm dev
# Seed two GalleryCollections with items, point a workspace at one, visit /w/<slug>/gallery
# Verify: lazy-load works, mobile (375px) is scrollable, header sticky, no theme leak
```

---

## Out of scope

- Image upload UI for galleries — already exists via `/api/uploads/sign`; Phase 8 wizard wires it for first-run.
- Lightbox / image detail view — defer to v1.1 unless explicitly requested.
- Video items in galleries — defer.
- Editor wiring for the new blocks beyond registry inclusion (Phase 9 lights up the editor).

---

## Branch & merge

```
git checkout dev
git checkout -b feat/page-builder-gallery-page
```
