---
name: portfolio-blocks-and-design
description: How to author and modify Gallurio portfolio blocks in the shared Puck config and their "dynamic design" controls. Use this WHENEVER you add or change a portfolio block, touch a block's fields/defaultProps/render, or work on the per-block Content/Design/Layout controls (padding, gap, color, font size/weight, radius, alignment, column count, col/row span). Covers the defaultProps-as-source-of-truth principle (so controls show real defaults, not blanks), the Columns container-query grid + span model, and the rem-vs-px unit traps. Read before editing manualBlocks / editorConfig / StyleToolkitField / styleToolkit.
---

# Portfolio blocks & dynamic design

Shared Puck config in `lib/page-builder/` powers BOTH the editor and the public renderer —
a render change ships to live pages. Files:
- `blocks/manualBlocks.tsx` — block components, `*DefaultProps`, `render()`. (Columns,
  Container, Heading, Text, Image, Button, Spacer, Divider, Video, Gallery*, FeaturedWork,
  ContactDetails, preset blocks.)
- `editorConfig.tsx` — editor block config; `resolveFields` can HIDE fields from Puck's
  sidebar (e.g. Columns `columns`/`rows` are hidden there and driven from a Content-tab
  control instead).
- `StyleToolkitField.tsx` — the right-panel **Content / Design / Layout** tabs
  (`NumberInputRow`, color/font controls, `ColSpanRowSpanControls`, `CountControl`,
  `drawerOpenStore`). Controls read straight from Puck props.
- `styleToolkit.ts` — the `BlockStyle` type and `resolveBlockStyle()` mapping `_style` →
  CSS; `colSpan`/`rowSpan` → `grid-column/grid-row: span N`.

## Defaults: make `defaultProps` the source of truth
Controls in `StyleToolkitField` read the block's Puck props directly. If a block applies a
default via a **render-time fallback** (`prop ?? "1rem"`, `|| "crossfade"`, a hardcoded
style when unset) instead of declaring it in `*DefaultProps`, the rendered output looks
right but the matching **control shows blank** — the editor and the applied value drift.
Fix pattern: move the effective default into `*DefaultProps` and drop the render fallback
(output stays identical), so the control displays it. For already-saved pages, normalize on
load by deep-merging each block's props with its `defaultProps` (missing keys only — never
overwrite a user value), which surfaces defaults without changing rendered output.
Only surface defaults where a control already exists; don't add controls for structural
plumbing (`display`, `position`, `overflow`, internal `max-width`, aspect ratios).

## Unit traps
- Padding is stored as **rem strings** (`"1rem"`, `"1.5rem"`) in `_style`; the `gap` and
  spacing number inputs edit **px numbers**. Convert when wiring defaults into px controls
  (1rem = 16px). Color is tokens/hex per the control; typography sizes per their control.

## Columns block (the regression-prone one)
- `columnsDefaultProps`: `columns: 2`, padding `1rem/1.5rem/1rem/1.5rem`, gap fallback `1rem`.
- `render()` builds a CSS-container-query grid: base `grid-template-columns:1fr`, then
  `@container pf-cols (min-width:480px){…}` / `(min-width:720px){…}` widen it. **These
  `@container` rules only match if the `.pf-cols` element establishes a container
  (`container-type: inline-size` + `container-name: pf-cols`).** If the count "won't
  change," check that first.
- `colSpan`/`rowSpan` (a grid child of Columns) → `grid-column/grid-row: span N`
  (`styleToolkit.ts`). They need a real multi-track grid to be visible.

## Design rules (enforced)
- Semantic tokens only — never raw color utilities. Blocks consume `--pf-color-*` /
  `--pf-font-*` (see `portfolio-theme-brand-kit`).
- Controls use `--radius`; structural frames use `--radius-surface`.
- Every async surface ships loading/empty/error/populated; every control idle/hover/
  focus-visible/active/disabled.

## Verify
Block/render logic is unit-testable (props → expected CSS). Anything visual or
drag-dependent: verify in a browser via `portfolio-testing`.
