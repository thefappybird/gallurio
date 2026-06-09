# Carousel Heading / Description Drawers — Design

**Date:** 2026-06-09
**Branch:** `feat/portfolio-enhancements`
**Status:** Approved design

## Context

A follow-up to the carousel text controls shipped earlier on this branch (the
shared `CarouselTextControls`: one Typography section + Text Padding + per-target
highlight toggles). The owner wants the carousel's heading and description styled
**independently**, organised into two collapsible drawers, with richer highlight
options.

This **supersedes** the shared carousel typography from
`2026-06-09-carousel-text-and-block-taxonomy-design.md`. The shared controls are
unreleased (same branch, not yet merged to `dev`), so no data migration is
needed — old keys simply stop being written by the carousel UI.

## Goals

- Split the carousel's text styling into two **collapsible drawers** under the
  Design tab — **Heading** and **Description** — collapsed by default.
- Each target gets its own bold / italic / underline, alignment, text color,
  font family, sizing, and highlight band — fully independent.
- **Heading** sizing reuses the Heading block's `h1`–`h6` level buttons (sets the
  rendered tag + size). **Description** sizing uses a px font-size input.
- Extend the highlight band with **shape** (Sharp / Subtle / Rounded) and **size**
  (S / M / L), independently per target.
- Move **Text Padding** (X/Y) to the **Layout** tab as a single shared control
  (it pads the shared overlay box, not individual text).

## Non-goals

- No new Puck **block props** — all new state lives on `_style` (`BlockStyle`), so
  the editor/production `defaultProps` parity test is untouched.
- No changes to Grid / Masonry / Featured blocks (`GalleryHeader` is carousel-only
  now).
- No data migration; no reconcile / image-pipeline changes.

## Architecture

The text path stays: `GalleryCarouselBlock.tsx` (isomorphic) renders an
absolutely-positioned overlay wrapper containing `GalleryHeader`
(`GalleryText.tsx`). The toolkit (`StyleToolkitField.tsx`) edits `_style`.

`GalleryHeader` is consumed **only** by `GalleryCarouselBlock`, so its props are
converted to two per-target style groups. The carousel maps `_style.heading*` /
`_style.description*` into those groups; old shared keys are no longer read by the
header (the section root's `resolveBlockStyle` still tolerates them for any legacy
draft, but the new UI never writes them).

### Units

| Unit | File | Change |
|---|---|---|
| `BlockStyle` types | `lib/page-builder/styleToolkit.ts` | New `HeadingLevel`, `HighlightShape` (+`HIGHLIGHT_SHAPES`), `HighlightSize` (+`HIGHLIGHT_SIZES`); ~19 new optional per-target `_style` keys. |
| `GalleryHeader` | `lib/page-builder/blocks/GalleryText.tsx` | Replace flat props with `headingStyle` / `descriptionStyle` groups; render heading at its chosen `h1`–`h6` tag/size; per-element color/B/I/U/align/font; `band(token, shape, size)`. |
| `GalleryCarouselBlock` | `lib/page-builder/blocks/GalleryCarouselBlock.tsx` | Thread `_style.heading*` / `_style.description*` into the two groups; float-derived `align` is the per-target default. |
| `StyleToolkitField` | `lib/page-builder/StyleToolkitField.tsx` | New `Drawer` (collapsible) + `ChoiceRow` (text button group) + `CarouselTargetControls`; Design tab shows two drawers for the carousel (no shared Typography); Text Padding moves to the Layout tab. |

## Detail — data model (`styleToolkit.ts`)

```ts
export type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
export const HIGHLIGHT_SHAPES = ["sharp", "subtle", "rounded"] as const;
export type HighlightShape = (typeof HIGHLIGHT_SHAPES)[number];
export const HIGHLIGHT_SIZES = ["sm", "md", "lg"] as const;
export type HighlightSize = (typeof HIGHLIGHT_SIZES)[number];
```

New optional `BlockStyle` keys (all optional → old drafts unaffected):

- Heading: `headingBold`, `headingItalic`, `headingUnderline`, `headingAlign`
  (`TextAlign`), `headingColorToken`, `headingFontFamily` (`PortfolioFontKey`),
  `headingLevel` (`HeadingLevel`), `headingHighlightShape`, `headingHighlightSize`.
- Description: `descriptionBold`, `descriptionItalic`, `descriptionUnderline`,
  `descriptionAlign`, `descriptionColorToken`, `descriptionFontFamily`,
  `descriptionFontSize` (px number), `descriptionHighlightShape`,
  `descriptionHighlightSize`.

Reused as-is: `headingHighlight(+Token)`, `descriptionHighlight(+Token)`,
`textPaddingX`, `textPaddingY`. `resolveBlockStyle` is **unchanged** (per-target
keys are consumed only by `GalleryHeader`).

## Detail — `GalleryHeader`

Two groups; the heading group adds `level`, the description group adds `fontSize`:

```ts
type GalleryTextTargetStyle = {
  bold?, italic?, underline?: boolean;
  align?: TextAlign;
  colorToken?: StyleColorToken | string;
  fontFamily?: PortfolioFontKey;
  highlight?: boolean;
  highlightToken?: StyleColorToken | string;
  highlightShape?: HighlightShape;
  highlightSize?: HighlightSize;
};
// headingStyle: GalleryTextTargetStyle & { level?: HeadingLevel }
// descriptionStyle: GalleryTextTargetStyle & { fontSize?: number }
```

- Top-level `align` (default `"center"`) is the fallback for both targets; the
  carousel passes the float-derived horizontal. Each target's own `align`
  overrides — applied as `text-align` on that element (heading and description can
  differ). The description's `maxWidth` / block margin derive from its own align.
- Heading renders as `headingStyle.level ?? "h2"`, sized from a local
  `HEADING_LEVEL_SIZE` map that **mirrors** `HeadingBlock`'s `HEADING_SIZE`
  (`h1:3rem … h6:0.875rem`). This replaces the prior responsive `clamp()` with the
  builder-consistent fixed scale (owner picks a smaller level for mobile).
- `colorToken` → text color (falls back to the overlay/non-overlay default);
  `bold`/`italic`/`underline` → per element; `fontFamily` → `fontFamilyValue(...)`
  with the existing `--pf-font-heading`/`--pf-font-body` fallback.
- Band: `band(token, shape, size)` with
  `border-radius` = {sharp:`0`, subtle:`0.15em`, rounded:`0.6em`},
  `padding` = {sm:`0.05em 0.2em`, md:`0.1em 0.3em`, lg:`0.2em 0.45em`}, keeping
  `box-decoration-break: clone` (+ `-webkit-`). Defaults (`subtle`/`md`) match the
  current band exactly. Overlay text-shadow is dropped when that text is
  highlighted (unchanged behavior).

## Detail — toolkit UI (`StyleToolkitField.tsx`)

- `Drawer({title, children})` — bordered, header button with chevron,
  `aria-expanded`, `useState(false)` → **collapsed by default**; accessible name =
  title.
- `ChoiceRow({label, value, options, onChange})` — a labelled row of text toggle
  buttons (Sharp/Subtle/Rounded, S/M/L), matching the existing aspect/columns
  button-group styling and states.
- `CarouselTargetControls({target, s, set})` — one component, `target` =
  `"heading" | "description"`, reads/writes the matching `_style` keys. Contents:
  B/I/U + align (`ToolbarToggle` row) · Text color (`ColorSwatchRow`) · Font
  (`select` + reset) · **heading:** `HeadingLevelButtons` / **description:**
  `NumberInputRow` "Font size" · Highlight (`HighlightToggle`; when on:
  `ColorSwatchRow` + Shape `ChoiceRow` + Size `ChoiceRow`). Shape/Size show the
  default (`subtle`/`md`) as active until changed.
- **Design tab:** `showTypography` now excludes the carousel; for the carousel,
  render `<Drawer "Heading">` + `<Drawer "Description">` in place of the shared
  Typography section. The old `CarouselTextControls` is removed.
- **Layout tab:** for the carousel, a single shared **Text padding** section
  (`CarouselTextPadding`: two `DimensionInput`s bound to `textPaddingX/Y`) renders
  after the gallery layout controls (and in the standalone/no-Puck path too, for
  tests).

English-only chrome (no `IntlProvider` in the field panel). All controls ship
idle/hover/focus-visible/active/disabled states via the shared primitives.

## Testing

- **`GalleryHeader`:** overlay default color when unset; heading vs description
  color independent; B/I/U applied only to the targeted element; chosen level
  renders that tag + size (`h1` → `<h1>` at `3rem`); custom description font-size;
  heading/description align independently; heading-only / description-only band;
  band honors shape + size (`rounded` → `0.6em`, `lg` → `0.2em 0.45em`); no
  `<mark>` when off.
- **`GalleryCarouselBlock`:** threads `headingColorToken` to the heading and
  `descriptionColorToken` to the description independently; `headingLevel` changes
  the tag; `descriptionFontSize` applies; `headingAlign` aligns the heading;
  highlight shape/size reach the band; Text Padding still drives the overlay inset.
- **`StyleToolkitField`:** carousel Design tab shows Heading + Description drawer
  buttons and **not** "Typography"; drawers collapsed by default (inner controls
  hidden until expanded); expanding Heading reveals B/I/U + Level + highlight;
  expanding Description reveals Font size; Shape/Size rows appear once a highlight
  is on and round-trip via `onChange`; Layout tab shows Text padding for the
  carousel; non-carousel blocks keep the shared Typography section.
- **Parity:** `editorConfig.test.ts` stays green (no new block props/fields).

## Definition of done

- Two collapsible Heading/Description drawers with independent B/I/U, align,
  color, font, sizing (level vs font-size), and shape/size highlight bands;
  Text Padding on the Layout tab.
- Tests above passing; `pnpm typecheck` + `pnpm lint` clean; `pnpm next build`
  succeeds (client-bundle hygiene for the isomorphic carousel path).
- Mobile checked at 375px (drawer panel + overlay).
- No locale files (editor chrome is English-only); no public-facing strings added.
