# Code Review — Portfolio Maker Editor & Block Enhancements

Branch: `feat/portfolio-maker/phases-6-9` (working-tree changes, 46 files).
Method: 4 parallel strict reviewers (CLAUDE.md/security, block/config bugs, editor/themes UI, fonts/schema/i18n), findings consolidated and confidence-scored. Only real, high-signal issues are listed. All confirmed issues were **fixed** (see Resolution).

## Findings & resolutions

1. **Saved-theme delete had no rollback** — `ThemePanelDialog.handleDeleteTheme` optimistically removed the theme and, on server error, kept it removed (only a toast). Violates CLAUDE.md: "On failure: roll back local state AND surface the error inline — never both silently revert and stay quiet."
   - **Fixed**: snapshot `savedThemes` before the optimistic remove; restore it on `error`. (`ThemePanelDialog.tsx`)

2. **`saveThemeAction` cap was a read-then-write (TOCTOU)** — two concurrent saves could both pass the `< SAVED_THEMES_MAX` check; a raw `$push` also bypasses the schema's array-length validator. Violates CLAUDE.md "Mutations are idempotent where retries can happen."
   - **Fixed**: single atomic guarded `$push` (`{ "publicPage.savedThemes.<MAX-1>": { $exists: false } }`), `matchedCount === 0` → at-cap. (`_actions.ts`)

3. **`overrides.header` dropped Puck's sidebar-toggle buttons** — switching from `headerActions` to the full `header` override discarded `children`, where Puck renders the Components/Properties panel toggles. Owners could no longer collapse/restore the side panels.
   - **Fixed**: `EditCanvasControls` now renders left/right sidebar toggles (via `usePuck` → `setUi` `leftSideBarVisible`/`rightSideBarVisible`) flanking the device toggle. (`EditorShell.tsx`)

4. **Disabled-button `cursor-not-allowed` was dead CSS** — the Button base had `disabled:pointer-events-none` alongside `disabled:cursor-not-allowed`; `pointer-events:none` suppresses the cursor, so the not-allowed cursor never showed. This directly defeated the requested "all buttons show disabled styling."
   - **Fixed**: replaced `disabled:pointer-events-none` with `aria-disabled:pointer-events-none` (native `disabled` already blocks clicks), so the not-allowed cursor renders on disabled buttons. (`components/ui/button.tsx`)

5. **Vimeo URL parsing rejected valid short IDs** — `parseVideoEmbed` required `\d{6,}`, dropping older 5-digit Vimeo IDs to the empty state.
   - **Fixed**: match `\d+` (still scoped to `vimeo.com/`). Test updated to assert short IDs embed. (`VideoBlock.tsx`, `VideoBlock.test.tsx`)

6. **Raw `bg-white` on editor chrome** — the new preview device-frame used `bg-white`, violating "semantic color tokens only" and breaking dark mode.
   - **Fixed**: dropped the redundant frame color; iframe uses `bg-background`. (`EditorShell.tsx`)

7. **Merriweather font preloaded on public pages** — the relocated Merriweather `localFont` omitted `preload: false` (unlike the other 7 curated families), so its woff2 preloaded on every page carrying `portfolioFontVariables`, including public portfolios that don't use it.
   - **Fixed**: added `preload: false`. (`lib/fonts/portfolio.ts`)

8. **Stale schema comment** — `Workspace.country` still claimed it "drives the locale of the public page"; locale is now owner-chosen via `formLocale`.
   - **Fixed**: comment updated. (`lib/db/models/Workspace.ts`)

## Considered, not actioned (false positives / pre-existing)

- `ColumnsBlock`/`ContainerBlock` calling `Content({style})` would crash if rendered with the default `content: []` outside Puck — but in production Puck always injects a `SlotComponent`, and the unit tests pass a stub. Contract is correct; no change.
- `GalleryGridBlock` uses an inline `connectDB()` + `GalleryItem.find()` rather than `listItemsForBlock` like the other gallery blocks — **pre-existing** divergence, untouched by this work.
- `resolvePublicChromeLocale` keeps an unused `country` field in its param type — harmless; signature left intact to avoid churn at call sites (comment clarified instead).

## Gate status (post-fix)

- `pnpm typecheck` — passes.
- `pnpm vitest run` (portfolio + validators + UI) — 712 passing.
- `pnpm build` — passes.
- `pnpm lint` — passes (0 errors). The 2 pre-existing `react-hooks/set-state-in-effect` errors in `TemplatePickerDialog.tsx` and `PortfolioGuideOverlay.tsx` were also fixed here by switching from a reset-in-`useEffect` to the documented "adjust state during render on prop change" pattern.
