# Phase 3 — First six blocks

> Parent: `../master-plan.md`
> Branch: `feat/page-builder-core-blocks` cut from `dev` (post-Phase-2).
> Implements: Hero, About, GalleryGrid, ServicesList, CTABanner, ContactCard.

---

## Context

Phase 2 stood up the public renderer with an empty Puck registry; visitors see only the "Coming soon" fallback. Phase 3 ships the six blocks that compose the Home page. These are the **lowest-risk** subset of the master plan's block catalogue — no calendar interactions, no Cloudinary uploads, no client-only complexity beyond standard responsive layout. Gallery-specific blocks (Masonry, Carousel, FeaturedWork) and the Contact modal come in Phases 4 and 5.

Every block:

1. Is a default-server component. Client interactivity is opt-in through dedicated `"use client"` sub-components when justified (e.g. the GalleryGrid item lightbox in Phase 4 — but the grid block itself stays server).
2. Reads brand-kit values via `useBrandKit` (client) or `resolveBrandKit` (server). Never hardcodes colors, radii, or fonts.
3. Lives in its own file under `lib/page-builder/blocks/` with a colocated Zod props schema and unit test.
4. Exports a `register<Name>Block(config)` function — the Puck registry is built by composing these registrations in `lib/page-builder/config.ts`.
5. Renders at 375px without overflow (mobile-first verification).
6. Provides a `defaultProps` export the templates (Phase 8) will consume.

---

## Acceptance criteria

- Six block files exist under `lib/page-builder/blocks/`, each with a colocated `.test.tsx`.
- `puckConfig.components` contains all six entries, each with a Puck `fields` definition keyed by the same Zod-validated props.
- Each block:
  - Renders without crashing given its `defaultProps`.
  - Applies brand-kit colors and radius via CSS variables — verified by snapshotting the rendered `style` attribute under two brand kits.
  - Honors `text-pf-foreground` / `bg-pf-bg` / accent semantics (no raw color literals in JSX).
- Two CTA-bearing blocks (Hero, CTABanner) expose a `ctaAction: "open-contact" | "scroll-to-section"` prop. `"open-contact"` calls `window.__gallurioOpenContact?.()` (no-op until Phase 5 wires the modal).
- A new `lib/page-builder/blockShapes.test.ts` integration test renders a fixture Puck document containing all six blocks and asserts that `<Render data={fixture} config={puckConfig} />` returns valid HTML without warnings.
- `pnpm test --run page-builder/blocks` passes.
- Visiting `/w/<seed-slug>` after seeding `publicPage.data.home` with the fixture renders all six blocks correctly at 375px and 1440px.

---

## Block specs

### `HeroBlock`
- Props: `headline`, `subhead?`, `backgroundImagePublicId?`, `backgroundImageUrl?`, `backgroundOverlayOpacity` (0–100), `primaryCtaLabel`, `primaryCtaAction` (`open-contact` | `scroll-to-section`), `primaryCtaTarget?` (section id), `secondaryCtaLabel?`, `secondaryCtaAction?`, `alignment` (`left` | `center`), `height` (`tall` | `medium` | `short`).
- Renders: full-bleed background image (uses `cloudinaryThumbnailUrl(publicId, { width: 2000, crop: "fill" })`), overlay, stacked headline + subhead + two CTAs.
- Background image is optional; falls back to `accentColor` gradient.

### `AboutBlock`
- Props: `heading`, `body` (markdown-ish plain text with line breaks), `imagePublicId?`, `imageUrl?`, `imagePosition` (`left` | `right`), `credentials?: Array<{ label: string; value: string }>` (max 6).
- Two-column on desktop, stacked on mobile.

### `GalleryGridBlock`
- Props: `collectionId` (string ID of a `GalleryCollection`), `columns` (`2` | `3` | `4`), `gap` (`tight` | `normal` | `loose`), `showCaptions` (boolean), `maxItems` (default 12).
- Server component: queries `GalleryItem`s where `{ workspaceId, collectionId }` and renders thumbnails via `cloudinaryThumbnailUrl`.
- **Tenant safety**: takes `workspaceId` from a server-only context (provided by the renderer) — block props from Puck must never override `workspaceId`.
- Renders an empty-state placeholder if no items match or `collectionId` is missing.

### `ServicesListBlock`
- Props: `heading`, `items: Array<{ title: string; description?: string; priceFrom?: string; icon?: string }>` (max 8). All embedded, no separate `Service` model.
- 1 column on mobile, 2 on tablet, 3 on desktop.

### `CTABannerBlock`
- Props: `headline`, `subhead?`, `ctaLabel`, `ctaAction` (`open-contact` | `scroll-to-section`), `ctaTarget?`, `background` (`accent` | `surface` | `image`), `backgroundImagePublicId?`.

### `ContactCardBlock`
- Props: `heading`, `description?`, `showEmail`, `showPhone`, `showAddress`, `showSocials`, `inlineCtaLabel?`. All actual contact values come from the workspace (`branding`, `country`, etc.) at render time, not from block props.

---

## File map

```
lib/page-builder/blocks/
  HeroBlock.tsx
  HeroBlock.test.tsx
  AboutBlock.tsx
  AboutBlock.test.tsx
  GalleryGridBlock.tsx
  GalleryGridBlock.test.tsx
  ServicesListBlock.tsx
  ServicesListBlock.test.tsx
  CTABannerBlock.tsx
  CTABannerBlock.test.tsx
  ContactCardBlock.tsx
  ContactCardBlock.test.tsx

lib/page-builder/config.ts            # populate components: { Hero, About, ... }
lib/page-builder/blockShapes.test.ts  # integration test rendering a fixture
lib/page-builder/__fixtures__/homeData.ts
```

---

## Server context for tenant-scoped blocks

Because `GalleryGridBlock` queries `GalleryItem` by `workspaceId`, the renderer must pass the active workspace ID into the Puck render tree. Add a server-only context provider:

```ts
// lib/page-builder/serverContext.tsx
import { cache } from "react";
export const getRenderWorkspaceId = cache(() => {
  // populated by app/(public)/w/[orgSlug]/page.tsx before <Render />
});
```

Or simpler: pass `workspaceId` via a top-level wrapper component that uses React Context, and let server blocks call a server-only `getRenderWorkspaceId()` from request-scoped storage. **Use the simpler React `cache()` pattern unless it causes issues** — per the simplicity principle in CLAUDE.md.

Document the chosen approach in `lib/page-builder/serverContext.tsx`.

---

## Tests

For each block:
- "renders with default props" — smoke
- "applies brand-kit CSS variables" — assert wrapper `style` includes `--pf-color-accent`
- "handles missing optional props" — no crashes when image/credentials/etc. omitted

For `GalleryGridBlock` specifically:
- queries are workspace-scoped (use `mongodb-memory-server`)
- cross-workspace `collectionId` returns empty state instead of leaking
- empty state rendered when collection has no items

Integration test (`blockShapes.test.ts`):
- Render fixture Puck data through `<Render />`
- Assert all six block markers present in output

---

## Verification

```bash
pnpm test --run page-builder/blocks
pnpm test --run page-builder/blockShapes
pnpm typecheck
pnpm dev
# Manually seed publicPage.data.home with fixture, visit /w/<slug>, verify at 375px and 1440px
```

---

## Out of scope

- Gallery-specific layouts (Masonry, Carousel, FeaturedWork) — Phase 4.
- Lightbox / lazy-load tuning — Phase 4 if needed.
- Editor UI (the "open contact" CTA is a no-op until Phase 5 wires the modal hook).
- Testimonials block — deferred (not in MVP block catalogue trim).

---

## Branch & merge

```
git checkout dev
git checkout -b feat/page-builder-core-blocks
```
