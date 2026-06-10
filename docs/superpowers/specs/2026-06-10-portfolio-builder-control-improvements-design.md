# Portfolio Builder Control Improvements — Design

Date: 2026-06-10
Branch: `feat/portfolio-enhancements`

Five independent improvements to the Puck-based portfolio builder editor controls. All are editor/renderer changes; none alter the public data contract beyond additive, backward-compatible fields.

## Context (current state)

- Block editor controls live in a custom Puck field, `StyleToolkitField.tsx`, which renders three tabs — **Content / Design / Layout** — driven by `usePuck()` `selectedItem`.
- The carousel heading↔description gap is hardcoded `margin: "0.5rem auto 0"` in `GalleryHeader` (`blocks/GalleryText.tsx`), shared by Carousel, Gallery Grid, Gallery Masonry.
- The "Masonry" section preset label is a hardcoded TS string in `blocks/sectionPresets.ts`; editor chrome is English-only (not localized).
- Padding controls (X/Y + Advanced four-side) currently render in the **Design** tab; margins/gap render in **Layout**.
- The editor Puck config has `root: { fields: {} }` and intentionally **no** `root.render` — a comment at `editorConfig.tsx:815` documents that adding `root.render` breaks Puck drag-and-drop position tracking. Production (`config.ts`) does have a flex-col root render.
- Gallery section presets (`GalleryGridPreset`, `GalleryMasonryPreset`, `FeaturedWorkPreset`) are Container instances with prefilled content slots, registered as distinct Puck component types. They are missing from `CONTAINER_TYPES` and `FLEX_CONTAINER_BLOCKS`, so the panel never shows banner (bg color) or padding controls for them. The carousel is a standalone leaf `<section>`, not a container.

## Scope

### 1. Carousel heading↔description gap control

- Add `headingGap?: number` (px) to `GalleryCarouselProps` in both `blocks/GalleryCarouselBlock.tsx` (production) and `editorConfig.tsx` (editor). Default `8` (= current `0.5rem`).
- `GalleryHeader` gains an optional `gap?: number` prop; the hardcoded `margin: "0.5rem auto 0"` is driven by it (falls back to `8`px when unset). Only the carousel passes `gap`; Grid/Masonry keep the default — no visual change for them.
- Surface the control in the **carousel's Layout tab**. `GalleryLayoutControls` (in `LayoutTabBody`) already edits non-`_style` gallery props (columns/gap/maxItems) via `usePuck` dispatch; add a "Heading–description gap" numeric input there, rendered only when the selected block type is `GalleryCarousel`.

### 2. Rename "Masonry" preset → "Gallery Masonry"

- `blocks/sectionPresets.ts`: `GalleryMasonryPreset.label = "Gallery Masonry"` (title case, matches "Gallery Grid" / "Gallery Carousel").
- The editor preset config reads `SECTION_PRESETS.GalleryMasonryPreset.label`, so the change propagates automatically. No other hardcoded "Masonry" preset string.
- The standalone `GalleryMasonry` block label stays `"Masonry"` (scope: preset label only).
- Not localized → pure TS string change.

### 3. Root page styling (Design + Layout tabs)

Root-level styling editable when no section is selected.

- New `rootStyleField` bound to Puck `root.fields._rootStyle`, reusing the existing `DesignTab` / `LayoutTabBody` tab components, trimmed to **two tabs only** (Design, Layout — no Content tab).
  - **Design:** background color token + background-color opacity. (No background image — explicitly out of scope.)
  - **Layout:** Padding X/Y + Margin X/Y.
- **Production** (`config.ts` root render, which already exists): apply background color (with opacity), padding, and margin to the outer page wrapper.
- **Editor live preview without `root.render`:** an editor-only effect reads `root.props._rootStyle` via `usePuck` and applies bg color / padding / margin as inline styles (or CSS vars) onto the **existing** Puck canvas container element. No DOM re-parenting, no wrapper, no `root.render` — this is what avoids the previously-observed DnD breakage. We only style the element Puck already renders.

### 4. Move padding controls from Design → Layout

- Relocate the Padding control block (X/Y + Advanced four-side) out of `DesignTab` and into `LayoutTabBody`, **above** the existing Gap/Spacing controls, for every block currently showing it (`FLEX_CONTAINER_BLOCKS`).
- Same underlying `_style` fields (`paddingTop/Right/Bottom/Left`) → zero data migration; purely a relocation of where the control renders.

### 5. Gallery section presets — full Container parity

- Add `GalleryGridPreset`, `GalleryMasonryPreset`, `FeaturedWorkPreset` to:
  - `CONTAINER_TYPES` — unlocks the banner background-color (and the rest of the Content-tab container treatment).
  - `FLEX_CONTAINER_BLOCKS` — unlocks padding (now in the Layout tab per #4).
- They are already Container-based with editable content slots; they were simply absent from these type sets. The carousel stays excluded (leaf `<section>`).

## Data model / compatibility

- `headingGap` (carousel) and `_rootStyle` (root) are additive and optional; existing saved `publicPage` data renders unchanged via defaults.
- No migration. No change to `Workspace.publicPage` shape beyond additive Puck props.

## Testing

- Carousel: `headingGap` default + applied gap; `GalleryHeader` honors `gap` prop and defaults when unset.
- Preset label resolves to "Gallery Masonry".
- Root: `_rootStyle` serializes; production wrapper renders bg color (with opacity) + padding + margin.
- Padding control renders under **Layout**, not Design, for container/preset blocks.
- Gallery presets (`GalleryGridPreset`, `GalleryMasonryPreset`, `FeaturedWorkPreset`) now expose banner + padding controls.
- `pnpm typecheck` and `pnpm lint` pass.

## Non-goals

- Root background image / animation (explicitly removed from scope).
- Localizing editor chrome (remains English-only).
- Any change to standalone gallery block (`GalleryGrid` / `GalleryMasonry` / `GalleryCarousel`) labels or to carousel container-ness.
- Horizontal/section-gap semantics for root spacing — root spacing is plain Margin X/Y.

## Locales

No new translatable strings (editor chrome is English-only; root styling is structural). No changes across en/fil/ms/id/th.

## Mobile (375px)

Verify root padding/margin and carousel heading gap behave at small width.
