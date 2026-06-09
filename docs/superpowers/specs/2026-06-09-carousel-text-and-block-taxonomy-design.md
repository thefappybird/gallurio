# Carousel Text Controls + Block Taxonomy — Design

**Date:** 2026-06-09
**Branch:** `feat/portfolio-enhancements`
**Status:** Approved design, pending spec review

## Context

A follow-up batch to the three portfolio sub-projects (unified media picker →
gallery baked images → container background slideshow). Two themes:

1. **Carousel text controls** — the Gallery Carousel renders a floating
   heading + description overlay, but the text-color picker does nothing, there
   is no padding control for the overlay text, and there is no highlight
   (highlighter) effect. Fix the color bug and add Text Padding + a marker-band
   highlight.
2. **Block taxonomy** — rename the preset and manual gallery/featured blocks to
   cleaner labels, and move the standalone Gallery Carousel into the Preset
   blocks group.

Scope is **carousel-only** for the text controls. The manual Grid / Masonry /
Highlights blocks have no text inputs, and the gallery *presets* compose
standalone Heading + Text blocks that already expose these controls — so they
need nothing here.

## Goals

- Make the carousel heading + description honor the picked text color.
- Give the carousel overlay an owner-controlled Text Padding (X / Y).
- Add a marker-band highlight to the carousel heading and description,
  configurable **independently** (separate toggle + color each).
- Rename gallery/featured blocks to the agreed labels.
- Move Gallery Carousel into the Preset blocks group (recategorize only).

## Non-goals

- Threading bold / italic / underline / align into carousel text (not requested;
  heading alignment is already driven by the float-horizontal control).
- Adding any of these controls to the Grid / Masonry / Highlights blocks (no text
  inputs) or to the gallery preset sections (they use Heading/Text blocks that
  already have the controls).
- Wrapping the carousel in a Container "section preset" — it stays a standalone
  block, merely shown under Preset blocks.
- Any data migration or change to the reconcile pipeline (no image keys touched).

## Architecture

The carousel text path is: `GalleryCarouselBlock.tsx` (isomorphic) renders an
absolutely-positioned overlay wrapper that contains `GalleryHeader`
(`GalleryText.tsx`). The toolkit (`StyleToolkitField.tsx`) edits the block's
props and `_style`. Taxonomy lives in `blockCategories.ts` (category → key
arrays), `sectionPresets.ts` (preset labels), and the individual manual block
files (manual labels). Both the editor (`editorConfig.tsx`) and production
(`config.ts`) configs import labels and category key-arrays from those single
sources.

### Units

| Unit | File | Change |
|---|---|---|
| `GalleryHeader` | `lib/page-builder/blocks/GalleryText.tsx` | New optional props: `textColorToken`, `headingHighlight`, `headingHighlightToken`, `descriptionHighlight`, `descriptionHighlightToken`. Resolve text color from token; wrap heading/description in `<mark>` band when its highlight is on. |
| `GalleryCarouselBlock` | `lib/page-builder/blocks/GalleryCarouselBlock.tsx` | New props `textPaddingX`, `textPaddingY` (CssLength), `headingHighlight`, `headingHighlightToken`, `descriptionHighlight`, `descriptionHighlightToken`. Apply padding to the overlay wrapper; thread `_style.textColorToken` + highlight props into `GalleryHeader`. Add defaults to the shared config. |
| `StyleToolkitField` | `lib/page-builder/StyleToolkitField.tsx` | Carousel-only "Text" group (Design tab): Text Padding X/Y `DimensionInput`s, Heading highlight (toggle + `ColorSwatchRow`), Description highlight (toggle + `ColorSwatchRow`). |
| Taxonomy keys | `lib/page-builder/blockCategories.ts` | Move `"GalleryCarousel"` from `MANUAL_BLOCK_KEYS` to `PRESET_BLOCK_KEYS`. |
| Preset labels | `lib/page-builder/blocks/sectionPresets.ts` | Rename 3 preset labels. |
| Manual labels | `GalleryGridBlock.tsx`, `GalleryMasonryBlock.tsx`, `FeaturedWorkBlock.tsx` | Rename 3 manual labels. |

## Detail — carousel text

### 1. Text color (bug fix)

`GalleryHeader` currently computes `textColor = overlay ? var(--pf-color-bg) :
var(--pf-color-fg)` and ignores the toolkit picker. Add an optional
`textColorToken?: StyleColorToken` prop and resolve:

```
color = textColorToken ? (colorTokenToVar(textColorToken) ?? <default>) : <default>
```

where `<default>` is the existing overlay/non-overlay value. `GalleryCarouselBlock`
passes `_style?.textColorToken`. The picker already renders in the Design tab
(carousel is excluded from `GALLERY_NO_TEXT_BLOCKS`); this only wires the value
through. Applies to both heading and description.

### 2. Text Padding

New carousel props `textPaddingX` / `textPaddingY` (`CssLength`, default
`"1.5rem"`). The overlay content wrapper's hardcoded `padding: "1.5rem"` becomes
`paddingLeft/Right = textPaddingX`, `paddingTop/Bottom = textPaddingY` (each
falling back to `"1.5rem"`). Toolkit: two `DimensionInput`s, "Text padding —
Horizontal (X)" / "Vertical (Y)".

### 3. Highlight — marker band, separate per text

New carousel props: `headingHighlight` (bool, default `false`),
`headingHighlightToken` (color token), `descriptionHighlight` (bool, default
`false`), `descriptionHighlightToken`. In `GalleryHeader`, when a text's
highlight is on, wrap its content in a `<mark>` with:

- `background: colorTokenToVar(token)` (chosen from the existing token swatches)
- `box-decoration-break: clone` + `-webkit-box-decoration-break: clone` so a
  multi-line band hugs each line rather than drawing one box
- small inline padding (`0.1em 0.3em`) and a slight `border-radius`
- `color` inherited from the resolved text color

When off, render the plain text node (no `<mark>`). Heading and description are
independent. `box-decoration-break` is widely supported with the `-webkit-`
prefix; the fallback (a single rectangular band) is still acceptable.

## Detail — toolkit controls

A carousel-only **"Text"** group in the Design tab, beside the existing
text-color picker: Text Padding X/Y, then **Heading highlight** (toggle +
`ColorSwatchRow`) and **Description highlight** (toggle + `ColorSwatchRow`).
Gated on `isCarousel`, mirroring the existing carousel-specific controls
(aspect, autoplay, float X/Y). All idle/hover/focus-visible/active states per the
existing primitives; English-only chrome (the field panel has no `IntlProvider`).

## Detail — renames

| Block | File | Old | New |
|---|---|---|---|
| `GalleryGridPreset` | sectionPresets.ts | Gallery grid section | **Gallery Grid** |
| `GalleryMasonryPreset` | sectionPresets.ts | Gallery masonry section | **Masonry** |
| `FeaturedWorkPreset` | sectionPresets.ts | Featured work section | **Featured Work** |
| `GalleryGrid` (manual) | GalleryGridBlock.tsx | Gallery Grid | **Photo Grid** |
| `GalleryMasonry` (manual) | GalleryMasonryBlock.tsx | Gallery Masonry | **Masonry** |
| `FeaturedWork` (manual) | FeaturedWorkBlock.tsx | Featured Work | **Highlights** |

"Masonry" intentionally appears in both the Preset and Manual groups (different
blocks). Labels are imported by both configs, so each is a single-source edit.

## Detail — carousel recategorization

Move `"GalleryCarousel"` from `MANUAL_BLOCK_KEYS` to `PRESET_BLOCK_KEYS` in
`blockCategories.ts`. Both `editorConfig.tsx` and `config.ts` consume these
arrays, so the move is single-source. The block stays standalone (no Container
wrapper); only its picker category changes. Label stays "Gallery Carousel". The
`editorConfig.test.ts` parity test still passes — the same component is
registered in both configs; only its category group differs.

## Data shapes

- Text color: reuses existing `_style.textColorToken` (`StyleColorToken`). No new
  field.
- New carousel props (block props, like aspect/autoplay/float):
  `textPaddingX?: string`, `textPaddingY?: string`,
  `headingHighlight?: boolean`, `headingHighlightToken?: StyleColorToken`,
  `descriptionHighlight?: boolean`, `descriptionHighlightToken?: StyleColorToken`.
- Defaults live in the shared carousel config so editor/production `defaultProps`
  stay in parity. All optional → existing saved pages render unchanged
  (highlights off, padding `1.5rem`, color falls back to current default).
- No image keys added → `reconcileGalleryImages` and the publish pipeline are
  untouched.

## Testing

- **`GalleryText` / `GalleryHeader`:** text color uses the provided token
  (and falls back when unset); heading band present when `headingHighlight` on,
  absent when off; description band independent of heading; band uses the chosen
  color token; plain text node when off.
- **`GalleryCarouselBlock`:** threads `_style.textColorToken` + highlight props
  to `GalleryHeader`; applies `textPaddingX/Y` to the overlay wrapper (and the
  `1.5rem` fallback when unset).
- **`StyleToolkitField`:** for a carousel block, the Text Padding inputs and both
  highlight toggle+color rows render and round-trip via `onChange`; they do not
  render for non-carousel blocks.
- **Renames:** preset labels (sectionPresets test) and manual labels (block
  tests) assert the new strings.
- **`blockCategories`:** `GalleryCarousel` is in `PRESET_BLOCK_KEYS`, not
  `MANUAL_BLOCK_KEYS`.
- **Parity:** `editorConfig.test.ts` stays green (component registration +
  defaultProps + field-key parity for the carousel's new props).

## Definition of done

- Carousel text color honored; Text Padding X/Y + independent heading/description
  highlight implemented with all control states.
- Six labels renamed; Gallery Carousel recategorized to Preset blocks.
- Tests above passing; `pnpm typecheck` + `pnpm lint` clean; `pnpm next build`
  succeeds (client-bundle hygiene for the isomorphic carousel path).
- Mobile checked at 375px (toolkit panel + overlay).
- No locale files (editor chrome is English-only); confirm no public-facing
  strings added.
