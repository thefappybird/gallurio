# Theme Modal — Current Theme + Per-Theme Edit Mode

**Date:** 2026-06-10
**Status:** Design (approved for spec write)
**Area:** Portfolio builder — theme management modal (`BrandKitPicker` / `ThemeGrid` / `ThemeTile`)
**Builds on:** `docs/superpowers/specs/2026-06-09-theme-modal-unified-redesign-design.md`

## Problem

The unified theme grid (presets + saved themes) applies a full brand-kit snapshot
on click and previews instantly. But there is no representation of the owner's
**in-progress, unsaved** styling, and saved themes can only be created or deleted —
never edited in place. This makes iterative theming lossy: tweak a few colors, and
the only ways to keep them are to overwrite nothing (lose them on navigation) or to
delete-and-recreate a saved theme (new id, reordered list).

## Goals

1. Surface the owner's unsaved working styling as a first-class **"Current Theme"**
   tile that floats in the grid, so divergent edits are always visible and saveable.
2. Define exactly when the Current Theme is created, preserved, overridden, and
   discarded — with confirmations that prevent silent loss of work.
3. Add **edit mode** for saved themes: change a saved theme's colors, fonts, and
   **name** in place (same id, same order) with an unsaved-changes guard.
4. Enforce **case-insensitive name uniqueness** across the theme list, client and
   server, for both new saves and edit-mode renames.

## Non-goals

- No persistence of the Current Theme. It is **in-memory editor session state**;
  closing the modal or reloading the page ends its life (per the deletion rules
  below). No new Workspace/`publicPage` schema field.
- No reordering of saved themes (edit keeps id and position).
- No edit affordance for presets (presets are read-only).
- No change to `SAVED_THEMES_MAX = 24`, the embedded `savedThemes[]` storage, or
  the `deleteThemeAction` contract.

---

## Definitions

- **Working brand kit (`value`)** — the live `PortfolioBrandKit` applied to the
  portfolio preview, already owned by `BrandKitPicker` via `value`/`onChange`. This
  is the actual portfolio styling, persisted when the page is saved. Unchanged.
- **Real tile** — a preset (6) or a saved theme. Has a stable identity
  (`themeTiles.ts` `ThemeTileModel.key`; saved tiles also carry `savedThemeId`).
- **Current Theme** — an in-memory snapshot of an unsaved divergent working kit,
  rendered as a floating tile. At most one exists at a time.

---

## Design

### 1. Editor session state

New in-memory state, owned by `BrandKitPicker` (or a small `useThemeEditor` hook it
mounts). None of it is persisted.

```ts
type ThemeSelection =
  | { kind: "tile"; key: string }   // a preset or saved tile is active
  | { kind: "current" }             // the Current Theme tile is active
  | { kind: "none" };               // nothing matches (transient)

type EditSession = {
  id: string;                       // saved theme id being edited
  baseTheme: PortfolioSavedTheme;   // snapshot for diff + discard-revert
  baseWorkingKit: PortfolioBrandKit;// working kit at entry, for discard-revert
  draftKit: PortfolioBrandKit;
  draftName: string;
};

// component state
currentTheme: PortfolioBrandKit | null;   // the floating snapshot, or none
selection: ThemeSelection;
editing: EditSession | null;
modalOpenKit: PortfolioBrandKit;          // working kit captured when modal opened
```

`modalOpenKit` is captured once when the theme modal opens; it is the revert target
for "Discard" on modal close.

### 2. State machine

All transitions below assume **not** in edit mode unless stated; edit mode is
handled in §5 and takes precedence.

**Editing any base control (color / font / radius / button style):**

- **In edit mode** → mutate `editing.draftKit` only. Never touches `currentTheme`.
- **`selection.kind === "current"`** (or working kit equals `currentTheme`) →
  update `currentTheme = value`, keep `selection = current`. No warning. This is the
  owner continuing to refine their unsaved theme.
- **`selection.kind === "tile"` and `currentTheme === null`** → silently create
  `currentTheme = value`, set `selection = current`. (First divergence; nothing to
  lose.)
- **`selection.kind === "tile"` and `currentTheme !== null`** → the owner is
  "building on" a *different* loaded theme, which would overwrite their existing
  unsaved Current Theme. Show the **override confirm dialog** (§6a):
  - **Continue** → `currentTheme = value`, `selection = current`.
  - **Cancel** → revert the edit (restore working kit to the active tile's brand
    kit; the editor control snaps back).
- **`selection.kind === "none"` and `currentTheme === null`** → create
  `currentTheme = value`, `selection = current`.

**Clicking a real tile** → `value = tile.brandKit`, `selection = { tile, key }`.
`currentTheme` is **preserved** (condition 2.2 — loading a different theme does not
erase the Current Theme yet). The tile becomes selected; the Current Theme tile
remains in the grid, unselected.

**Clicking the Current Theme tile** → `value = currentTheme`,
`selection = current`. No warning.

### 3. Current Theme lifecycle — creation & deletion

**Created** the moment the working kit first diverges from every real tile (per §2).

**Deleted (becomes non-existent) in exactly three cases:**

1. **Saved (2.1)** — the owner saves the Current Theme as a named theme (via the
   toolbar save popover). On success it becomes a normal saved tile; `currentTheme`
   is cleared and `selection` points at the new saved tile.
2. **Overridden (2.2)** — the owner builds on a *different* loaded theme and
   confirms the override dialog; the old snapshot is replaced by the new one (still a
   single Current Theme, with new contents).
3. **Modal close (amendment)** — closing the theme modal ends the session. If a
   Current Theme exists at close, show the **unsaved-changes guard** (§6b) first.

The Current Theme tile has **no manual delete/clear** control — those three rules are
the only exits.

### 4. Grid layout & pagination

- Real themes (6 presets + saved) paginate at **8 per page when a Current Theme
  exists, otherwise 9.** Encoded in `themeTiles.ts` as
  `realPerPage = currentTheme ? 8 : 9`.
- The Current Theme tile is **pinned to the last cell of every page**: `ThemeGrid`
  renders `[...pageRealTiles, currentTile]`. On a non-full single page it lands in
  the first empty cell (7 reals → cell 8); on a full page it lands in cell 9; on
  overflow pages it follows that page's last real tile.
- Search filtering applies to real tiles only; the Current Theme tile is always
  shown (pinned) regardless of the query, so the owner never loses sight of unsaved
  work. Pagination math uses the filtered real-tile count with `realPerPage`.
- Page reset on query change and page step-back on last-item delete remain as in the
  prior spec.

Examples (Current Theme present):

```
Page 1 (10 real themes):        Page 2:
[T1][T2][T3]                    [T9 ][T10][CUR]
[T4][T5][T6]                    [   ][   ][   ]
[T7][T8][CUR]
```

### 5. Edit mode (saved themes only)

**Entry.** Every saved-theme tile shows a small square **edit** (pencil) button in
its top-right corner — **always visible, low-emphasis**, emphasized on hover/focus,
keyboard-focusable, tappable at 375px (complies with the no-hover-only rule).
Presets and the Current Theme tile show no edit button. Clicking it:

- Captures `editing = { id, baseTheme, baseWorkingKit: value, draftKit:
  baseTheme.brandKit, draftName: baseTheme.name }`.
- Applies `draftKit` to the working kit so the live preview shows the theme being
  edited; marks that tile with an "editing" ring.
- The theme **name becomes editable** (an input rendered in the toolbar/edit bar
  while editing).

**While editing.** The base controls below the grid mutate `editing.draftKit`; the
name input mutates `editing.draftName`. The live preview reflects the draft.

**Diff.**
`hasDiff = !brandKitsEqualForSelection(draftKit, baseTheme.brandKit) || draftName.trim() !== baseTheme.name`.
(`brandKitsEqualForSelection` already compares the 5 colors, resolved fonts, radius,
and button style; name is compared separately, trimmed.)

**Exit.** Any exit attempt — closing the modal, clicking a different tile/preset,
clicking the Current Theme tile, or an explicit "exit edit" control — is guarded:

- `hasDiff === false` (or the owner already saved) → exit silently; the exit action
  proceeds.
- `hasDiff === true` → **unsaved-changes dialog** (§6b, edit variant):
  - **Discard** → restore `value = editing.baseWorkingKit` and leave the saved theme
    unchanged; clear `editing`; then let the original exit action proceed.
  - **Save & close** → run `updateThemeAction(id, draftKit, draftName)`; on success
    clear `editing`, set the working kit to the saved result, select that tile, then
    let the original exit action proceed. On validation failure (e.g. duplicate
    name) the dialog stays open with the inline error.

After a successful save, the edited theme is the selected tile and the live working
kit; `hasDiff` resets so further exits are silent.

### 6. Dialogs

All dialogs are accessible: focus-trapped, Esc cancels, semantic roles, labelled
buttons, color is not the sole signal. Mobile-first at 375px.

**6a. Override confirm (condition 2.2).** Title: *Override current theme?* Body:
*Building on "{themeName}" will replace your unsaved Current Theme.* Buttons:
**Cancel** (default/safe) / **Continue**. Cancel reverts the triggering edit.

**6b. Unsaved-changes guard.** Two trigger contexts, same shape:

- **Edit-mode exit** — buttons **Discard** / **Save & close** (Save & close runs
  `updateThemeAction`, inline error on failure).
- **Modal close with a Current Theme** — buttons **Discard** / **Save & close**.
  - **Discard** → revert the working kit to `modalOpenKit` (throw away the tweaks),
    drop `currentTheme`, then close.
  - **Save & close** → open the existing **save-as-theme popover** to collect a
    name (with the uniqueness check). When the save succeeds the modal closes; if the
    owner cancels the popover, the modal stays open.

If both an edit session and a Current Theme are unsaved at modal close, resolve the
**edit-mode** guard first (it owns the working kit), then evaluate the Current Theme
guard.

### 7. Name uniqueness (#4)

Case-insensitive, trimmed uniqueness across `savedThemes[].name`, enforced **client
and server**:

- **Client** — before any `saveThemeAction` / `updateThemeAction` round-trip, compare
  the trimmed lowercased name against the existing names (excluding the theme's own
  id in edit mode). On collision, show inline error *"a theme already exists with
  this name"* and block submission.
- **Server** — both `saveThemeAction` and `updateThemeAction` re-check authoritatively
  against the workspace's current `savedThemes` (excluding self for updates) and
  return error `theme_name_exists` on collision. `saveThemeAction` has no uniqueness
  check today; this adds one.

### 8. Server actions (`_actions.ts`)

**New `updateThemeAction(id, brandKit, name)`** — owner-only, workspace-scoped:

- Validate `id` (1–64 chars), `name` (`saveThemeNameSchema`), `brandKit`
  (`brandKitSchema`).
- Resolve workspace from the Clerk session/org (never trust client `workspaceId`).
- Reject `owner_only` for non-owners.
- Case-insensitive name-uniqueness within `savedThemes`, **excluding the element
  whose `id` matches** → `theme_name_exists` on collision.
- Update the matched array element in place with a positional filter:
  `updateOne({ _id: workspaceId, "publicPage.savedThemes.id": id }, { $set: { "publicPage.savedThemes.$.brandKit": kit, "publicPage.savedThemes.$.name": name } })`.
  If no element matches (deleted concurrently) → `theme_not_found`.
- Returns `{ ok: true; theme: PortfolioSavedTheme }` or `{ error: string }`,
  mirroring `saveThemeAction`'s result shape.

**`saveThemeAction`** — add the case-insensitive uniqueness check before the capped
`$push`; return `theme_name_exists` on collision. Cap behavior unchanged.

`deleteThemeAction` unchanged.

### 9. Component changes

- **`lib/page-builder/brandKitPicker/themeTiles.ts`** — add `realPerPage` helper /
  parameter so pagination reserves a cell for the Current Theme; add a `buildPageTiles`
  helper that appends the pinned current tile to a page's real tiles. Extend
  `ThemeTileModel` with `variant: "preset" | "saved" | "current"`.
- **`ThemeTile.tsx`** — render `variant`; add the always-visible low-emphasis square
  **edit** button (saved variant only) with `aria-label` + `onEdit`; "current" variant
  gets a dashed border + unsaved treatment and no edit/delete; "editing" ring prop.
  Title keeps ellipsis truncation **and** a `title` attribute exposing the full name
  on hover (per owner note).
- **`ThemeGrid.tsx`** — own the state machine (§2), pinned current tile (§4), edit
  mode entry/exit (§5), override confirm (§6a), unsaved-changes guard (§6b), client
  uniqueness check (§7); thread `onUpdateTheme` through.
- **`SaveThemePopover.tsx`** — add client-side uniqueness check + the
  `theme_name_exists` inline message; reused by the modal-close "Save & close" path.
- **`BrandKitPicker.tsx`** — capture `modalOpenKit`, mount the state, accept an
  `onUpdateTheme` prop, route base-control edits through the state machine instead of
  mutating `value` directly when in edit mode / managing the Current Theme.
- **Theme panel dialog** (the modal host) — call into the guard before close so
  closing surfaces §6b when a Current Theme or edit diff exists.

### 10. Locales (en / fil / ms / id)

New keys under `app.pageBuilder.brandKit` (th is phased out):
`currentTheme`, `currentThemeBadge`, `editTheme` (aria-label), `editThemeName`
(input placeholder), `overrideCurrentTitle`, `overrideCurrentBody` (ICU `{name}`),
`continueAction`, `cancelAction`, `unsavedChangesTitle`, `unsavedChangesBody`,
`discardAction`, `saveAndCloseAction`, `themeNameExists`.

---

## Testing

- **`themeTiles`** — `realPerPage` is 8 with a Current Theme, 9 without; pinned
  current tile lands in the correct cell for 6/7/8/10 real-theme counts across pages;
  search filters reals only while the current tile stays pinned.
- **State machine** — silent create on first divergence; override confirm fires only
  when a Current Theme exists and a different tile is loaded; Cancel reverts the edit;
  clicking a real tile preserves the Current Theme; clicking the Current Theme tile
  reselects without warning.
- **Edit mode** — entry snapshots base + working kit; draft edits don't touch
  `currentTheme`; `hasDiff` true on kit or name change; any exit with a diff opens the
  guard; Discard reverts theme + working kit; Save & close calls `updateThemeAction`
  and resets diff; presets/current tile expose no edit button.
- **Modal close** — guard appears when a Current Theme exists; Discard reverts the
  working kit to `modalOpenKit`; Save & close routes to the save popover and only
  closes on a successful save; edit guard resolves before the current-theme guard.
- **Uniqueness** — client blocks duplicate (case-insensitive) before round-trip;
  `saveThemeAction` and `updateThemeAction` return `theme_name_exists`; update
  excludes self so a theme may keep its own name.
- **`updateThemeAction` tenant isolation** — a workspace cannot update another
  workspace's theme by id; non-owner gets `owner_only`; `theme_not_found` when the id
  is absent; positional `$set` preserves id and array order.
- **Locale parity** — all new keys present and non-empty across en/fil/ms/id with
  correct ICU placeholders.

## Done criteria

- Current Theme tile renders per §4; the three deletion rules and override/guard
  dialogs behave per §2–§6; edit mode updates saved themes in place with
  discard-revert; name uniqueness enforced client + server.
- Tests added and passing; `pnpm typecheck` and `pnpm lint` pass.
- Locales en/fil/ms/id updated together.
- Verified at 375px (tiles, edit button, dialogs, save popover all tap-reachable).
- No schema change; existing brand kits and saved themes unaffected.
