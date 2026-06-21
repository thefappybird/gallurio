# Theme Modal Flow + Color Debounce + Logo Clarity — Design Spec (Batch 5)

- **Branch:** `enhance/portfolio-public-pages`
- **Date:** 2026-06-21
- **Scope:** Batch 5 — #10/#10.1 (theme modal flow), #9 (debounce color swatch), #11 (logo uploader clarity).
- **Surface:** `lib/page-builder/brandKitPicker/*`, `app/[locale]/(app)/portfolio/_components/ThemePanelDialog.tsx`, the color input components, and the header logo uploader in `HeaderPanelDialog.tsx`.
- **Chrome is English-only** — no locale-file changes.
- **Depends on Batch 3+4 spec** (`2026-06-21-editor-chrome-polish-design.md`): the theme save-guard reuses the generic save-changes modal built there. See "Dependency" below.

File/line references are accurate as of branch HEAD and may drift.

---

## Context: what already exists

The theme/brand modal redesign from the earlier `2026-06-09`/`2026-06-10` plans is already in the code (NOT part of this branch's Batch 1/2). Current state (verified):
- `ThemePanelDialog.tsx` — one fixed-width dialog (`sm:max-w-2xl`), footer = Cancel + Apply.
- `BrandKitPicker.tsx` — a single always-editable surface: unified theme grid (`ThemeGrid`) + 2 font selectors + 5 color swatches, all visible together.
- `useThemeEditor.ts` — controller with `currentTheme` (unsaved new draft), `editing` (EditSession when editing a saved theme), `editDiff` (dirty flag), `hasUnsavedCurrent`, `selection`, override-confirm guard, `ConfirmDialog`/`UnsavedEditDialog`.
- `ThemeTile.tsx` — saved tiles have a pencil (edit) affordance; the current/edited tile renders an inline name row `[swatch] [name input] [save icon]` with **no cancel** and the error below.
- Color/font changes route through `changeControl()`: in edit mode they mutate `draftKit`; otherwise they set `currentTheme` (a new unsaved draft).

So #10 is a **refinement of the existing modal**, not a ground-up redesign.

---

## `#10 / #10.1` — Theme modal flow

### Goals
A single, predictable theme-editing surface with an explicit, always-available way to start a new theme, a non-destructive name/save row, and a consistent unsaved-changes guard.

### Required behavior
1. **One modal, always editable.** Keep the current single surface (grid + fonts + colors) as the default. No separate narrow "view" vs wide "edit" modes.
2. **"Add new theme" tile shown at all times** as the **last grid cell** (after presets + saved themes, on the last page). It is always present, not conditional on whether a current theme exists.
3. **Inline current-theme name row → `[ name | ✕ | Save ]`** (#10.1). Add an **✕** (cancel) control between the name input and Save:
   - **✕** discards the current unsaved draft (or cancels an in-progress edit) and reverts the canvas to the last applied theme.
   - **Save** persists as today (name required + unique); in edit-mode it overwrites the saved theme, in draft-mode it saves a new named theme.
4. **Fork-on-edit.** Changing a color or font forks the active theme into a **new unsaved variant** from current — it never silently overwrites a saved or preset theme. Editing an existing saved theme remains an explicit action via its pencil affordance (which sets `editing`).
5. **Unsaved-changes guard on "Add new theme".** Clicking "Add new theme" while there is **any unsaved theme state** — a new unsaved draft (`hasUnsavedCurrent`) **or** a dirty edit of a saved theme (`editing && editDiff`) — opens the **reused save-changes modal** (see Dependency) offering **Save / Discard / Keep editing**:
   - **Save** → run theme-name validation. If valid & unique: persist the theme (save-as-new for a draft, overwrite for an edit), then start the fresh new theme. If it is a **duplicate name**: show the red duplicate-name error **above Save inside that same modal** and keep it open so the user can enter a different name and Save again.
   - **Discard** → drop the unsaved draft / revert the edit, then start the new theme.
   - **Keep editing** → close the prompt, stay on the current theme.
   - If there is **no** unsaved theme state, "Add new theme" starts a blank new theme immediately (no prompt).

### Dependency on Batch 3+4 (save modal)
The Batch 3+4 spec adds a draft-title `Input` + inline `text-destructive` error-above-Save to `UnsavedChangesDialog` ("Save your changes?"). To reuse it here, that dialog must be built **generic/parameterized** rather than draft-specific:
- Props in the shape: `{ name, onNameChange, nameError, onSave, onDiscard, onKeepEditing, title?, nameLabel? }` (exact names at implementation time).
- The portfolio-draft flow passes draft-name + `validateDraftName` + draft duplicate set; the theme flow passes theme-name + theme-name validation + the existing-theme-names set (`themeNames.ts`) + `saveCurrentTheme`/`saveAndExitEdit`.
- Batch 4 lands this generic shape; Batch 5 consumes it. This dependency is noted in both specs.

---

## `#9` — Debounce color swatch

### Problem
The color inputs emit `onChange` on every `react-colorful` drag tick:
- `components/ui/color-picker.tsx:84` (`HexColorPicker onChange={emit}`).
- `lib/page-builder/brandKitPicker/BrandKitPicker.tsx:245` (`onChange={(hex) => set(key, hex)}` → `changeControl` → Puck/brand-kit state).
- `app/[locale]/(app)/portfolio/_components/HeaderPanelDialog.tsx` color swatch rows (~489–676) → `onHeaderChange`.

Each tick lands in committed state — a flood of re-renders and (now that undo/redo #25 shipped) a flood of Puck history entries per single color drag.

### Approach
- **Add a small `useDebounce` hook** under `lib/hooks/` (none exists today) — a trailing debounce that returns a stable debounced callback (and cleans up its timer on unmount).
- **Keep the swatch visually live**: the picker holds immediate local state for the visible color, so dragging feels instant.
- **Debounce the commit** (~120 ms trailing) to the durable state (Puck dispatch / brand-kit `changeControl` / `onHeaderChange`) so a continuous drag coalesces into **one** committed value and **one** history entry. On popover close / blur, flush the pending value so nothing is lost.
- Apply at the lowest sensible layer so all three call sites benefit (prefer wrapping inside the shared `ColorPicker` component, falling back to per-call-site wrapping where the value path differs).

---

## `#11` — Logo uploader clarity (raster-only)

### Decision
Keep the logo uploader **raster-only** — PNG / JPEG / WEBP. **Do not accept SVG**: there is no SVG sanitizer anywhere in the repo, the logo renders on public pages, and unsanitized SVG is an XSS vector. "Encourage SVG" is reinterpreted as **clearer guidance + better error surfacing**, not accepting SVG.

### Current
`HeaderPanelDialog.tsx`: `LOGO_TYPES = png/jpeg/webp` (line 29), `accept` (line 463); limits `LOGO_MAX_BYTES = 250 KB` (line 26), `512×256` (lines 27–28); client-side validation `uploadLogo()` (~290–318) returns `logoErrors.type/size/dimensions`; help copy `logoHelp`/`logoRequirements` (lines 409/456).

### Approach
- **Prominent limits** near the uploader: show "PNG, JPEG or WEBP · max 250 KB · up to 512×256" clearly (tighten `logoRequirements`/`logoHelp` copy).
- **Inline validation errors**: render type/size/dimension failures inline below the uploader (`role="alert"`, `text-destructive`), in addition to the existing toast for upload/transport failures. (Validation failures = inline; network/Cloudinary failures = toast.)
- No type/limit changes; no server/Cloudinary changes.

---

## Testing

Vitest + Testing Library. Chrome English-only — no locale parity tests.

- **#9:** `useDebounce` unit test — N rapid calls within the window produce a single trailing invocation with the last value; timer cleared on unmount; flush-on-close delivers the pending value. A color-picker test asserting a simulated drag commits once (not per tick).
- **#10/#10.1:**
  - "Add new theme" tile is always rendered (last cell), including when a saved theme is active.
  - Inline name row renders `[name][✕][Save]`; ✕ discards the unsaved draft and reverts; Save with a unique name persists.
  - Color/font change with no active edit creates a new unsaved variant (`hasUnsavedCurrent` true), leaving saved themes untouched.
  - Clicking "Add new theme" with an unsaved draft opens the save-changes modal; Save with a duplicate name keeps the modal open with the red error; Discard proceeds; Keep editing stays.
  - Clicking "Add new theme" while editing a saved theme with a dirty diff (`editing && editDiff`) also opens the guard.
- **#11:** limits copy renders near the uploader; type/size/dimension validation errors render inline (`role="alert"`); SVG is rejected with the type error.

## Pre-merge gates
- Affected tests pass; `pnpm typecheck` (`rtk tsc`); `pnpm lint` (`rtk lint`).
- 375px: theme modal (grid/fonts/colors, add-new tile, name row) and logo uploader render correctly.
- Encoding safety: no BOM/mojibake in touched files.

---

## Acceptance Criteria
- Theme modal stays a single editable surface; "Add new theme" is always available as the last grid cell.
- Current-theme name row is `[name | ✕ | Save]`; ✕ cancels/reverts, Save persists with a unique name.
- Editing a color/font forks a new unsaved variant; saved/preset themes are never silently overwritten.
- "Add new theme" with any unsaved theme state (new draft or dirty saved-theme edit) prompts Save/Discard/Keep-editing via the reused save-changes modal; duplicate name keeps that modal open with the inline error; otherwise it proceeds.
- Color swatches feel live but commit debounced — one history entry per drag.
- Logo uploader stays PNG/JPEG/WEBP, shows limits prominently, and renders validation errors inline.
- Tests pass; typecheck + lint clean; 375px verified.

---

## Affected files (index)

| Item | Files |
| --- | --- |
| #10/#10.1 | `lib/page-builder/brandKitPicker/ThemeGrid.tsx`, `ThemeTile.tsx`, `useThemeEditor.ts`, `BrandKitPicker.tsx`, `app/[locale]/(app)/portfolio/_components/ThemePanelDialog.tsx`, `themeNames.ts`; reuse of `UnsavedChangesDialog.tsx` (generic shape from Batch 4) |
| #9 | new `lib/hooks/useDebounce.ts`, `components/ui/color-picker.tsx`, `lib/page-builder/brandKitPicker/BrandKitPicker.tsx`, `HeaderPanelDialog.tsx` |
| #11 | `app/[locale]/(app)/portfolio/_components/HeaderPanelDialog.tsx`, `messages/en.json` only if a chrome string is touched (English chrome — no 4-locale change) |
