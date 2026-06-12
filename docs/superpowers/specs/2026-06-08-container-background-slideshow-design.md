# Container Background Slideshow — Design

**Date:** 2026-06-08
**Branch:** `feat/portfolio-enhancements`
**Status:** Approved design, pending spec review
**Depends on:** Spec #1 (`imagesField`), Spec #2 (baked `images[]` + `reconcileGalleryImages`)

## Context

**Sub-project #3 of 3** — the original ask: let a Container block's background
**alternate between multiple images with an animation**, so a "carousel" can live
behind a container's content (heading, buttons, etc.).

1. Unified media picker (spec #1 — done).
2. Gallery blocks → baked images (spec #2 — done).
3. **Container background slideshow** (this spec).

### Relevant facts (verified)

- `ContainerBlock` (`lib/page-builder/blocks/manualBlocks.tsx:536`) is
  **isomorphic / client-safe**: the editor renders the real component (live
  preview), and so do the presets (Hero/About/Services/CTA/Contact/Gallery*/
  FeaturedWork) — they all `render: ContainerBlock` with `editorContainerFields`
  (`editorConfig.tsx`).
- Today it renders a **single** background: `backgroundImagePublicId`
  (or legacy `_style.bgImagePublicId`) → one absolutely-positioned `<img>`, with
  an optional dark scrim (`overlayOpacity`, 0–100) and the content slot layered
  above via `z-index`.
- `cloudinaryUrl(publicId, 2000)` produces the background URL deterministically
  (no server data access needed to render).

### Cross-spec amendment

Spec #1 originally listed the **container background** among the single-image
call sites it re-points to `imageField`. **This spec supersedes that**: the
container background becomes a **multi-image** field (`imagesField`). Spec #1 is
amended to drop container-background from its scope (the Image block remains
#1's single-field consumer). Net: container background changes shape exactly
once, here.

## Decisions (locked)

- **Source:** `backgroundImages: GalleryImage[]` via spec #1's `imagesField`,
  reconciled exactly like spec #2's gallery blocks.
- **Controls on the Container block** (inherited by all presets):
  - `bgAnimation`: `"crossfade" | "kenburns" | "slide"`.
  - `bgSpeed`: `"slow" | "medium" | "fast"` ≈ 7s / 5s / 3s per image.
  - Both **visible only when `backgroundImages.length >= 2`**.
- **0–1 image** → static `<img>` (today's behavior, no JS). **2+** → client
  slideshow island.
- Reduced-motion → static first image. Pause when tab hidden.

## Data shape changes (Container + presets)

```ts
type GalleryImage = { id: string; publicId: string; alt?: string }; // from spec #2

type ContainerBlockProps = {
  _style?: BlockStyle;
  backgroundImages: GalleryImage[];          // replaces backgroundImagePublicId
  bgAnimation?: "crossfade" | "kenburns" | "slide"; // default "crossfade"
  bgSpeed?: "slow" | "medium" | "fast";      // default "medium"
  overlayOpacity?: number;                   // unchanged (0–100)
  minHeight?: ContainerHeight;
  alignX?: ContainerAlignX;
  alignY?: ContainerAlignY;
  content: Slot;
};
```

- **Remove** `backgroundImagePublicId` and the legacy `_style.bgImagePublicId`
  background path (dev-only; no saved data to honor).
- `SECTION_PRESETS` defaults that set a background move to `backgroundImages`
  (an array of 0 or 1 by default, matching current visuals).

## Rendering

`ContainerBlock` chooses by `backgroundImages.length`:

- **0 images:** no background (today's empty behavior).
- **1 image:** static absolutely-positioned `<img>` (current code path), scrim +
  content unchanged. No JS shipped.
- **2+ images:** render `<ContainerBackgroundSlideshow images={...}
  animation={bgAnimation} speed={bgSpeed} />` in the background layer; scrim and
  content render above it (same `z-index` structure as today).

### `ContainerBackgroundSlideshow` (client island)

`lib/page-builder/blocks/ContainerBackgroundSlideshow.tsx` (`"use client"`):

- Props: `images: { publicId: string }[]`, `animation`, `speed`.
- Resolves each `publicId` → `cloudinaryUrl(publicId, 2000)`; renders a stack of
  absolutely-positioned, `inset:0`, `object-fit:cover` layers.
- **Crossfade:** active layer `opacity:1`, others `0`, CSS opacity transition.
- **Ken Burns:** crossfade + a slow continuous `transform: scale()/translate()`
  on the active layer.
- **Slide:** layers translate horizontally to swap (carousel-behind-content).
- Advances on a timer derived from `speed` (slow 7s / medium 5s / fast 3s).
- **Pauses** via the Page Visibility API when the tab is hidden (no off-screen
  animation churn).
- **`prefers-reduced-motion: reduce`** → render only the first image, statically,
  no timer (honored via CSS media query and/or a matchMedia guard on the timer).
- Decorative: every layer `alt=""` + `aria-hidden="true"`; the slideshow has no
  interactive controls (it's a background, not a foreground carousel).

Container remains isomorphic — the editor canvas renders the real slideshow, so
the owner sees the actual animated result (WYSIWYG). (Reduced-motion users,
including in-editor, see the static first frame.)

## Editor fields (`editorContainerFields` in `editorConfig.tsx`)

- Replace the `backgroundImagePublicId` image field with `imagesField("Background
  images")` bound to `backgroundImages`.
- Add `bgAnimation` (select) + `bgSpeed` (select), gated via the existing
  `resolveFields`/`visible` mechanism so they only appear at `>= 2` images.
- `overlayOpacity`, `minHeight`, `alignX`, `alignY`, `content` unchanged.
- Update the production `containerFields` (`manualBlocks.tsx`) to match and the
  `editorConfig` parity test.

## Reconcile

`backgroundImages` is reconciled by the **same** `reconcileGalleryImages` walk
from spec #2 — extend the walker to also collect/refresh `backgroundImages[]` on
Container (and preset) blocks alongside gallery blocks' `images[]`. Same triggers
(editor-load in-memory, publish persisted), same prune/refresh/never-add rules.

## Testing

- **Field gating:** `bgAnimation`/`bgSpeed` hidden at 0–1 images, shown at ≥2.
- **Render branch:** 0 → no bg; 1 → static `<img>` (no island); 2+ → slideshow
  island with scrim + content correctly layered.
- **Animation modes:** crossfade / kenburns / slide each render their layer
  structure; speed maps to the expected interval.
- **Reduced-motion:** static first image, timer not started.
- **Tab-hidden:** advancing pauses when `document.hidden`.
- **Reconcile:** `backgroundImages` refreshed/pruned like gallery `images[]`;
  presets included.
- **Presets:** Hero/CTA inherit the fields and slideshow behavior.
- **Client-safety:** the slideshow island carries no server-only imports.

## Risks / notes

- **Animation performance:** prefer CSS transitions/transforms (GPU-friendly) over
  JS-driven per-frame updates; only opacity/transform animate. Ken Burns scale
  kept subtle to avoid blur/jank.
- **Layout stability:** background layers are absolutely positioned and don't
  affect content flow; `min-height` still governs section height as today.
- **Preset defaults:** verify each preset that previously set a single background
  still looks identical with a 1-element `backgroundImages`.

## Definition of done

- Container + presets use `backgroundImages[]`; `bgAnimation`/`bgSpeed` gated at
  ≥2; single/none path unchanged visually.
- `ContainerBackgroundSlideshow` island implemented with crossfade/kenburns/slide,
  reduced-motion + tab-hidden handling, decorative a11y.
- `editorConfig` + `manualBlocks` fields updated; parity test passing.
- `reconcileGalleryImages` extended to `backgroundImages`.
- Spec #1 amended (container-bg removed from its scope).
- Tests passing; `pnpm typecheck` + `pnpm lint` clean.
- Mobile checked at 375px; reduced-motion verified.
