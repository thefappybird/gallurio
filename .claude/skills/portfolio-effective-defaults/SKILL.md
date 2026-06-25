---
name: portfolio-effective-defaults
description: How Gallurio portfolio block style controls "float up" a field's current theme/system default so the user always sees what's in effect — the effective-default DISPLAY pattern (prop stays unset, decouples on edit) and the narrow cases where you instead MATERIALIZE or ground a value for canvas/preview/publish parity. Use this WHENEVER a Design/Layout/Content control renders blank or shows a hardcoded-looking value, when adding a new overridable style control, or when an unset block style renders differently in the editor canvas than in preview/publish. Read before editing StyleToolkitField / toolbarPrimitives / styleToolkit / manualBlocks defaults / brandColors.
---

# Portfolio effective-default display ("float up the defaults")

Every overridable block style control must SHOW its current effective value so the user
sees what's already in effect — never a blank field. There are two ways to achieve that;
pick the right one. This skill is the decision + the mechanism.

## The two mechanisms (pick deliberately)

### 1. Effective-default DISPLAY (the default choice)
The control pre-fills/highlights the field's current effective value as a **display-only
overlay**, while the block prop **stays UNSET**. Editing writes the real value to THAT
block's `_style` only (decoupling that one field on that one block from the theme);
clearing reverts to the effective display.
- Keeps the field **theme-coupled** — change the brand kit and an unset field follows.
- The control reads as "following theme," not "I set this."
- Saved data stays lean (no frozen defaults written into every block).

### 2. MATERIALIZE / ground (only when parity forces it)
Write a concrete value so the rendered output is identical across the editor canvas,
preview, and the published page. Use this ONLY when an unset field would resolve
DIFFERENTLY in the canvas than in preview/publish (the `inherit` trap below). Prefer
grounding in the **render** (a concrete `var(--pf-*)` fallback on the block's element)
over writing into `defaultProps`, so the control can still use mechanism 1.

> Evolution note: an earlier rule (see `portfolio-blocks-and-design`) said "move the
> effective default into `*DefaultProps` and drop the render fallback." That MATERIALIZES
> the value — the control then reads as explicitly-set (filled) and the field stops
> following the theme. The current preference is mechanism 1 (display-only) for everything,
> and mechanism 2 only for genuine parity cases, grounded in the render not the props.

## The parity invariant (why mechanism 2 ever exists)
canvas == preview == publish for every field. Most fields resolve to the same `var(--pf-*)`
in all three contexts, so display-only (mechanism 1) is enough. The ONE exception is
anything that resolves via CSS `inherit`: the editor canvas isolates its text color
(`RootCanvasStyle` injects `[data-puck-preview] { color: var(--foreground) }` — the
APP-SHELL foreground), while preview/publish wrappers set `color: var(--pf-color-fg)` (the
BRAND foreground). So an unset, inherit-driven color renders app-shell grey in the canvas
but brand fg on the live page.
- **Fix it in the block render, not by materializing:** put a concrete fallback on the
  block's own element, e.g. `color: colorTokenToVar(_style?.textColorToken) ?? "var(--pf-color-fg)"`
  placed BEFORE the `...resolveBlockStyle(_style)` spread (the spread overwrites with the
  same value when the token IS set). `--pf-color-fg` IS defined on the editor canvas wrapper
  (EditorShell applies `style={cssVars}` from `resolveBrandKit`), so it resolves to brand fg
  everywhere. Then the control uses mechanism 1 (`effectiveValue="foreground"`).
- Do NOT change `RootCanvasStyle`; ground the individual field. Do NOT reach for `inherit`
  as a block style fallback for anything you also expose a control for.

## Wiring a control to show an effective value
Reusable controls take an optional `effectiveValue` (mirror `RadiusButtons.effectiveValue`,
the reference). Active-state logic:
`value === explicit ? filled : (value === undefined && effective === v ? lighter : idle)`.
- Visual convention: **explicit/edited** = filled (`ring-2`, `bg-foreground text-background`);
  **effective-but-unset** = lighter "following theme" (`ring-1 ... opacity-70`,
  `border-foreground`, a placeholder, or `opacity-60`). The user must be able to tell a theme
  default from a value they set.
- Controls with the prop today: `RadiusButtons`, `NumberInputRow`, `IconRow` (shows
  `"none"`), `ColorSwatchRow` (`effectiveValue?: StyleColorToken | string` → lighter ring),
  `DimensionInput` (padding), the font-family dropdown (pre-selects the effective font).
- Never write the effective value into the prop implicitly — editing/clearing writes/clears
  the REAL `_style` (or block prop) exactly as before.

## Effective sources (`brandColors.tsx` `BrandColorsContext`)
The context carries brand colors + `brandRadius` + `headingFont`/`bodyFont`. Hooks:
`useBrandColors()`, `useEffectiveBrandRadius()` (sharp0/subtle4/rounded8),
`useEffectiveBrandFont("heading"|"body")`. The provider is populated in `EditorShell` from
`resolveBrandKit` + `resolveEffectiveFonts(brandKit)` (the latter handles legacy `fontPair`
kits so the editor display can't drift from what renders). To add a new effective brand
value, extend THIS context the same way — do not invent a parallel provider. The exposed
font NAME must equal the dropdown option value or pre-selection silently fails.

### Per-field effective cheat-sheet
- radius → `useEffectiveBrandRadius()` · font family → `useEffectiveBrandFont(kind)` ·
  font size → `16` (browser default; no brand font-size) · border width → `0` ·
  border color → `"foreground"` (resolveBlockStyle falls back to `var(--pf-color-fg)`) ·
  gap → `16`px · shadow → `"none"` · min-height → block default.
- text color (Text/Heading) → `"foreground"`, grounded by a render fallback to
  `var(--pf-color-fg)` on the outer element (NOT materialized into defaultProps).
- button text color → `effectiveButtonTextToken(style)` in `styleToolkit.ts`
  (solid→`background`, soft|outline→`buttonColorToken ?? "primary"`, else→`foreground`) —
  shared by BOTH the render fallback and the control so they can't drift.
- button opacity → `100` · padding (Container/Columns/presets/galleries) → per-block render
  fallback (Container `1.5rem`; Columns `1rem`/`1.5rem`), display-only, de-materialized.

## When NOT to float
- Only surface defaults where a control already EXISTS. Don't add controls for structural
  plumbing (`display`/`position`/`overflow`/aspect-ratio/internal `max-width`).
- Content fields (text/label/images) already show their value AS content — the display-only
  treatment is for THEME/SYSTEM style defaults only.
- Some "blanks" are intentional: Heading `fontSize` is hidden because heading size is driven
  by `HEADING_SIZE[level]`, not `_style.fontSize`. Not a gap.

## Workflow to float a field
1. Confirm a control exists and renders blank (or materialized-as-filled).
2. Find the effective source (brand hook / per-block constant / existing render fallback).
3. If an unset value would break canvas/preview/publish parity (inherit-style resolution),
   ground it with a concrete `var(--pf-*)` fallback in the block render first.
4. De-materialize any value hardcoded in `*DefaultProps` (editor defaultProps import the same
   `*DefaultProps` objects, so this keeps `editorConfig.test.ts` parity green automatically).
5. Pass `effectiveValue` to the control.
6. Test (unit, props → CSS / control state): unset → effective shown active/lighter; explicit
   → that value wins and reads filled; edit → setter called with the real value; clear →
   reverts to effective; rendered CSS UNCHANGED (parity). Run the editorConfig parity test.

## Files
- `StyleToolkitField.tsx` (controls + per-block gating sets), `toolbarPrimitives.tsx`
  (`ColorSwatchRow`/`NumberInputRow`/`DimensionInput`/`IconRow`/`RadiusButtons`),
  `styleToolkit.ts` (`BlockStyle`, `resolveBlockStyle`, `colorTokenToVar`,
  `effectiveButtonTextToken`), `blocks/manualBlocks.tsx` + gallery block files (renders +
  `*DefaultProps`), `brandColors.tsx` (effective hooks). See `portfolio-blocks-and-design`
  for the block/Puck-config mechanics and `portfolio-theme-brand-kit` for the `--pf-*` vars.
