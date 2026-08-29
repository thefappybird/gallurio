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

## Defaults: never show a blank control — "float up" the effective value
Controls in `StyleToolkitField` read the block's Puck props directly. If a block applies a
default via a **render-time fallback** (`prop ?? "1rem"`, `|| "crossfade"`, a hardcoded
style when unset) instead of surfacing it, the rendered output looks right but the matching
**control shows blank** — the editor and the applied value drift.
**Preferred fix — effective-default DISPLAY (prop stays unset):** show the field's effective
value in the control as a display-only overlay while leaving the prop unset, so it keeps
following the theme and only decouples when the user edits. Reserve MATERIALIZING the value
into `*DefaultProps` (or grounding it in the render) for the narrow cases where an unset
field would resolve differently in the canvas than in preview/publish (the `inherit` trap).
This whole decision + the per-field effective sources + the parity rule live in
**`portfolio-effective-defaults`** — read it before wiring any default into a control.
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

## Section presets & the grouped drawer
Presets are registered in `blocks/sectionPresets.ts` (the registry: group, i18n keys,
dependencies, defaultProps) with compositions one file per group under `blocks/presets/`.
Derive from the registry — never hand-list preset keys again. Durable rules, the frozen
component keys, and the contrast contract live in `docs/modules/portfolio-and-media.md`.

Puck behaviours that cost real debugging time:
- **A category with no `defaultExpanded` renders EXPANDED.** Setting it `true` on one group
  is not enough — set it explicitly on every group, or all 11 come up open. A unit assertion
  of `not.toBe(true)` passes on `undefined` and will not catch this; assert `toBe(false)`.
- **Each drawer item renders twice** — the draggable plus a `Drawer-draggableBg` ghost — so
  every `_DrawerItem*` selector matches 2x per item. Count distinct names in e2e.
- **The left side bar is not rendered at 375px at all.** The editor is a desktop surface;
  browser-verify the drawer at 768/1280 only.
- Category titles are uppercased in CSS and `innerText` reflects it — compare
  case-insensitively.
- Puck auto-creates an **"Other"** category for any registered component listed in no
  category (currently just the internal `ContainerAnchor`).

A section's `_style.textColorToken` cascades to unstyled nested Heading/Text via the
`--pf-block-text-color` custom property `resolveBlockStyle` publishes — so a contrast band
sets the token once on the section instead of on every child. Buttons do NOT read it.

## Container anchor invariant (crash trap)
A `Container` gets an injected `ContainerAnchor` child (id `${containerId}--anchor`) via
`resolveContainerData` in `editorConfig.tsx`. **The anchor id MUST carry the `--anchor`
suffix.** `EditorContainerAnchor` derives `parentId = id.replace(/--anchor$/,"")` and bounces
Puck selection from itself to the parent; if `parentId === id` (no suffix), the bounce
re-selects the same anchor every render → React error #185 (infinite setState). Drafts saved
before this convention carried a suffix-less anchor, so `resolveContainerData`'s idempotency
check must verify the id, not just "an anchor leads the slot + child count matches" — else the
malformed anchor passes through and crashes on click. (Guarded both in `resolveContainerData`
and with a `parentId === id` bail in `EditorContainerAnchor`.)

## Design rules (enforced)
- Semantic tokens only — never raw color utilities. Blocks consume `--pf-color-*` /
  `--pf-font-*` (see `portfolio-theme-brand-kit`).
- Controls use `--radius`; structural frames use `--radius-surface`.
- Every async surface ships loading/empty/error/populated; every control idle/hover/
  focus-visible/active/disabled.

## Verify
Block/render logic is unit-testable (props → expected CSS). Anything visual or
drag-dependent: verify in a browser via `portfolio-testing`.
