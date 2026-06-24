---
name: portfolio-theme-brand-kit
description: How Gallurio portfolio theming / brand kits work — the 5 brand colors, fonts, radius, button style, theme presets, the in-editor Theme panel, and the --pf-* CSS variables blocks consume. Use this WHENEVER you touch portfolio colors/fonts/theme, the Theme panel, saved themes, the public page's brand styling, or how a block reads brand tokens. Covers where the brand kit is defined, how it's persisted, how it becomes CSS variables on the public page, and the rule that brand styling is scoped to the public subtree only.
---

# Portfolio theme & brand kit

## The model (`lib/page-builder/types.ts`)
- `PortfolioBrandKit`: `themePreset` (minimal | editorial | luxury | bold | romantic | modern),
  independent `headingFont` / `bodyFont` (`PortfolioFontKey`, e.g. `merriweather`, `playfair`;
  `fontPair` is legacy), **5 colors** (`primaryColor`, `secondaryColor`, `accentColor`,
  `backgroundColor`, `foregroundColor` — hex), `radius` (sharp | subtle | rounded),
  `buttonStyle` (solid | outline | soft).
- `DEFAULT_BRAND_KIT`: Gallurio teal accent (`#2f5d56`), sharp radius, Merriweather fonts.
- `PortfolioSavedTheme` (`{ id, name, brandKit }`) — named presets.

## Persistence
- Live brand kit: `Workspace.publicPage.brandKit`. Saved presets:
  `Workspace.publicPage.savedThemes` (array, max 24, embedded). Loaded server-side and passed
  to the editor as `initialBrandKit` / `initialSavedThemes` (`app/[locale]/(app)/portfolio/page.tsx`).

## Theme panel (`app/[locale]/(app)/portfolio/_components/ThemePanelDialog.tsx`)
- `ThemePanelDialog` hosts `BrandKitPicker` (colors/fonts/radius/button). Changes are kept in
  local state + localStorage, then persisted via `onSaved()` → `publicPage.brandKit`.
- Saved themes via `saveThemeAction` / `updateThemeAction` / `deleteThemeAction`.

## Brand kit → CSS variables (`lib/page-builder/resolveBrandKit.ts`)
- `resolveBrandKit(brandKit)` (server-safe) returns a `ResolvedBrandKit` whose `cssVars` map
  emits: `--pf-color-primary`, `--pf-color-secondary`, `--pf-color-accent`, `--pf-color-bg`,
  `--pf-color-fg`, `--pf-radius`, `--pf-font-heading`, `--pf-font-body`.
- These are applied **inline on the public-page wrapper** in
  `app/(public)/w/[orgSlug]/layout.tsx` (a `<div style={{ ...cssVars, color: "var(--pf-color-fg)",
  fontFamily: "var(--pf-font-body)" }} class={`pf-theme-${preset} pf-button-${style}`}>`).
- **Blocks consume tokens via these vars** (e.g. `var(--pf-color-accent)`, `var(--pf-color-bg)`),
  usually with a hex fallback in inline styles. When adding a themed block, read the `--pf-*`
  vars — don't hardcode brand colors.

## The isolation rule
Brand CSS vars are scoped to the public portfolio subtree (`app/(public)/w/[orgSlug]/...`)
ONLY. They must never bleed into the authenticated app chrome (`app/[locale]/(app)/...`),
which uses the app's own semantic tokens. Public portfolios may override brand styling only
inside this wrapper; no per-block brand override beyond the kit. (See the app design rules:
app chrome = Plus Jakarta Sans + semantic tokens; Merriweather is a portfolio brand-font option.)

## Effective brand values in the editor controls
The same brand kit also feeds the editor's style controls so they can show a field's
current theme value as a display-only default. `brandColors.tsx`'s `BrandColorsContext`
carries the brand colors + `brandRadius` + `headingFont`/`bodyFont` (populated in
`EditorShell` from `resolveBrandKit` + `resolveEffectiveFonts`); hooks
`useEffectiveBrandRadius()` / `useEffectiveBrandFont(kind)` / `useBrandColors()` read it.
To make a new brand value show up as an effective default in a control, extend THIS context
(not a parallel provider). See `portfolio-effective-defaults` for the float-up pattern.

## Editing checklist
- Add a color/font option → extend `PortfolioBrandKit` + the picker + `resolveBrandKit`'s
  `cssVars` together, and ensure blocks reference the new `--pf-*` var.
- If the option should pre-fill its editor control as a theme default, also extend
  `BrandColorsContext` + its effective hook (see `portfolio-effective-defaults`).
- Keep public-page changes locale-correct (public chrome uses workspace-country locale).
