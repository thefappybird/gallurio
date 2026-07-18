# Theme Modal — Unified Preset/Saved Redesign

**Date:** 2026-06-09
**Status:** Design (approved for spec write)
**Area:** Portfolio builder — theme management modal (`BrandKitPicker` / `ThemePanelDialog`)

## Problem

In the theme management modal, clicking a **preset** theme does not update the
preview's text and colors, while clicking a **saved** theme applies fonts and
colors instantly. The two lists are also visually and structurally separate, and
the "create theme" affordance is buried in a dedicated saved-themes section.

### Root cause

`themePreset` is a degenerate field. Selecting a preset only calls
`set("themePreset", preset)`, writing a single string. The `pf-theme-<preset>`
class it produces in `resolveBrandKit()` has **no CSS rules defined anywhere** —
all portfolio styling flows from CSS variables (`--pf-color-*`, `--pf-font-*`,
`--pf-radius`) derived from the brand kit's 5 colors + 2 fonts. Preset swatches
in `themePresetSwatches.ts` are hardcoded UI hints that are never applied.

Saved themes work because clicking one calls `onChange(theme.brandKit)` — a full
`PortfolioBrandKit` snapshot that overwrites all colors and fonts at once.

**The fix and the redesign share one mechanism:** give every preset a concrete
`PortfolioBrandKit` and route preset clicks through the same
`onChange(fullBrandKit)` path saved themes already use.

## Goals

1. Clicking any theme (preset or saved) applies a full brand-kit snapshot and
   previews instantly.
2. Unify presets and saved themes into a single grid of identical tiles.
3. Move search + "save current as theme" into a toolbar above the grid.
4. Cap the grid at 3×3 (9 tiles/page) with pagination beyond 9.
5. One tile format for all themes: `[thumbnail | title]` — a two-color swatch
   (primaryColor + accentColor) beside the theme title.

## Non-goals

- No data migration. Existing workspaces keep their stored `brandKit` untouched;
  presets only apply when explicitly clicked going forward.
- No removal of the per-color / per-font / radius / button-style editors.
- No change to `saveThemeAction` / `deleteThemeAction` server logic or the
  `savedThemes` schema (still embedded array, `SAVED_THEMES_MAX = 24`).
- No reordering/renaming of saved themes.

---

## Design

### 1. Preset definitions (concrete brand kits)

New constant, colocated with brand-kit types/presets:

```ts
export const THEME_PRESET_DEFINITIONS: Record<
  BrandKitThemePreset,
  { name: string; brandKit: PortfolioBrandKit }
>
```

Each `brandKit` is a complete `PortfolioBrandKit` — all 5 colors, both fonts
(`headingFont`/`bodyFont`), `radius`, `buttonStyle`, and a retained valid
`fontPair` (headingFont/bodyFont take precedence in `resolveBrandKit`, so the
legacy value is cosmetic). Starting values (hex/font picks tunable in
implementation):

| Preset | primary | secondary | accent | background | foreground | heading / body | radius / button |
|---|---|---|---|---|---|---|---|
| Minimal | #111111 | #f5f5f5 | #2f5d56 | #ffffff | #111111 | merriweather / merriweather | sharp / solid |
| Editorial | #161514 | #ece5db | #7e6a52 | #fbf9f6 | #161514 | playfair / inter | sharp / solid |
| Luxury | #f3efe9 | #1a1a1a | #c9a86a | #0e0e0e | #f3efe9 | cormorant / montserrat | sharp / outline |
| Bold | #101010 | #f0f0f0 | #1f3a5f | #ffffff | #101010 | montserrat / inter | sharp / solid |
| Romantic | #3a2b2b | #f3e6e2 | #9c6b6b | #fcf6f4 | #3a2b2b | cormorant / dm-sans | subtle / soft |
| Modern | #1a1a1a | #ebebe8 | #2f5d56 | #f7f7f5 | #1a1a1a | dm-serif / dm-sans | subtle / solid |

`themePreset` is set to the preset id when its tile is clicked (kept for
back-compat/metadata only). `themePresetSwatches.ts` is superseded by these
definitions and removed; any swatch-hint usage in the picker is replaced by the
tile thumbnail (below). The `BRAND_KIT_THEME_PRESETS` order
(minimal, editorial, luxury, bold, romantic, modern) drives preset display order.

### 2. Unified theme grid

A single tile component renders presets and saved themes identically:

```
[▮▮  Minimal     ]   [▮▮  Editorial   ]   [▮▮  Luxury      ]
[▮▮  Bold        ]   [▮▮  Romantic    ]   [▮▮  Modern      ]
[▮▮  My Wedding  ]   [▮▮  Studio Dark ]   [▮▮  Spring '26  ]
```

- **Tile format `[thumbnail | title]`:** horizontal — a small two-swatch
  thumbnail (left: `primaryColor`, right: `accentColor`) beside the theme title.
  Same look for every tile.
- **Order:** 6 presets first, saved themes after, flowing into one paginated
  sequence.
- **Selected state:** a tile shows a selected ring when its full brand kit
  deep-equals the current working brand kit (compare the styling fields: 5
  colors, headingFont, bodyFont, radius, buttonStyle — ignore the `themePreset`
  label). Once the owner tweaks any editor below, no tile is highlighted.
- **Apply:** `onClick` → `onChange(definition.brandKit)` for presets,
  `onChange(theme.brandKit)` for saved — identical full-snapshot path. Instant
  preview. This is the bug fix.
- **Delete:** presets render no delete control. Saved themes render a
  low-emphasis trash control that is **always visible** (no hover-only),
  focus-visible, and tappable at 375px, with an `aria-label`. It triggers the
  existing `deleteThemeAction` (keep current confirm behavior; add a confirm if
  none exists).

The per-color, per-font, radius, and button-style editors remain **below the
grid**, unchanged, for tweaking from a chosen base.

### 3. Toolbar (search + save-as icon)

A single toolbar row directly above the grid:

- **Left — search input:** live-filters the unified list by title
  (case-insensitive, matches preset names and saved-theme names). Pagination
  recomputes on the filtered set. Empty-result state shows a short "No themes
  match" message.
- **Right — save icon button:** a save/disk icon with an accessible label +
  tooltip ("Save current as theme"). Clicking opens a small popover anchored to
  the icon containing a name input + confirm button. Enter saves, Esc/outside
  click cancels. On confirm → existing `saveThemeAction` with the current working
  brand kit. Disabled/blocked when the name is empty or `savedThemes` is at
  `SAVED_THEMES_MAX`; the limit state surfaces a short message.

### 4. Pagination

- 9 tiles per page (3×3). Prev/next controls + a page indicator
  (e.g. "1 / 2") render only when the filtered list exceeds 9.
- Changing the search query resets to page 1.
- Deleting the last tile on a page steps back a page if the current page becomes
  empty.

### 5. Layout (top → bottom in the modal)

1. Dialog title.
2. Toolbar: search (left) + save icon (right).
3. 3×3 unified theme grid + pagination controls.
4. Color editors (5).
5. Font editors (heading/body).
6. Radius / button-style controls (unchanged).
7. Footer: Cancel / Done.

### Mobile (375px)

- 3-column grid holds (~100px tiles); thumbnail stays fixed-size, title
  truncates with ellipsis.
- Toolbar stays single-row (search flexes, save icon fixed).
- All controls (tile, delete, pagination, save popover) are tap-reachable;
  no hover-only behavior.

---

## Files touched (anticipated)

- `lib/page-builder/types.ts` — add `THEME_PRESET_DEFINITIONS`; keep
  `BRAND_KIT_THEME_PRESETS`, `PortfolioBrandKit`, `DEFAULT_BRAND_KIT`.
- `lib/page-builder/brandKitPicker/themePresetSwatches.ts` — removed (superseded).
- `lib/page-builder/brandKitPicker/BrandKitPicker.tsx` — unified grid, tile
  component, toolbar (search + save popover), pagination, deep-equal selection;
  preset click routes through `onChange(fullBrandKit)`.
- `app/[locale]/(app)/portfolio/_components/ThemePanelDialog.tsx` — layout
  adjustments if the toolbar/grid restructure requires it.
- Locale message files: `en`, `fil`, `id`, `th` — search placeholder, save
  tooltip/label, pagination labels, empty/limit messages, 6 preset display names.
- `resolveBrandKit.ts` — unchanged (mechanism reused as-is).
- Server actions / Workspace schema — unchanged.

## Testing

- `THEME_PRESET_DEFINITIONS`: every preset has all 5 colors + both fonts +
  radius + buttonStyle; ids match `BRAND_KIT_THEME_PRESETS`.
- **Regression:** clicking a preset tile calls `onChange` with the full brand kit
  (not just `themePreset`), so colors/fonts change immediately.
- Tile renders the two swatches (primary, accent) + title for both presets and
  saved themes; presets render no delete control, saved themes do.
- Selected-ring logic: highlights on exact brand-kit match, clears after a tweak.
- Search filters across presets + saved; pagination math (9/page, page reset on
  query change, page step-back on last-item delete).
- Save popover → `saveThemeAction`; delete → `deleteThemeAction`; both still
  enforce tenant isolation (workspace-scoped) — unchanged behavior covered.
- Locale keys present and non-empty for `en`, `fil`, `id`, `th`.

## Done criteria

- Preset click previews instantly (bug fixed); unified grid, toolbar, save-icon
  popover, and pagination implemented per above.
- Tests added and passing; `pnpm typecheck` and `pnpm lint` pass.
- Locales `en/fil/ms/id` updated together.
- Verified at 375px.
- No data migration required; existing brand kits unaffected.
