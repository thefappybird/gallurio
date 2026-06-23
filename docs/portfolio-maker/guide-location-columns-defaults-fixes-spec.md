# Portfolio builder fixes: guide, contact location, Columns regression, default surfacing

Branch: `enhance/portfolio-maker-guide-templates`. Follow-up batch on top of the
guide/templates enhancements. Four independent scope items; item 4 is the large one.

Chrome (editor + guide) is English-only per RELEASE-CHECKLIST §4f — no locale files
change for guide copy. Public-facing strings (contact form) still update all 4 locales
if any copy changes (none expected here).

---

## Item 1 — Guide / spotlight tour fixes

**Files:** `app/[locale]/(app)/portfolio/_components/SpotlightGuide.tsx`,
`app/[locale]/(app)/portfolio/_components/spotlightSteps.ts`,
`app/[locale]/(app)/portfolio/_components/useElementRect.ts`,
`app/[locale]/(app)/portfolio/_components/EditorShell.tsx`,
`lib/page-builder/StyleToolkitField.tsx` (tab `data-tour-id`s).

Guide shows "N of 19"; user's "step N" == displayed number == array index N-1.

### 1a. "Try it" pill invisible + vague copy
- **Problem:** Pill (`SpotlightGuide.tsx` ~350-360) uses `border-[color:var(--accent)]`
  and `text-[color:var(--accent)]`; `--accent` has near-zero contrast against the
  popover background in both light and dark, so the pill is effectively invisible.
- **Root cause:** Pill colored with `--accent` (a low-contrast surface token) instead
  of a popover-foreground token.
- **Target:** Recolor pill to contrast on `bg-popover`: text/border use
  `text-foreground` + `border-border` (keep the pulsing `--accent` dot as the accent).
  Verify visible in both themes. Change copy from "Try it…" to
  **"Try it to continue to the next step"**.
- **Note:** The pill only appears on *gated* (interactive) steps. After 1b/1e below,
  step 2 and step 7 are no longer gated, so the pill remains relevant for the still-gated
  steps (e.g. step 8 "Open Navigation", step 12 "Open Contact"). Fix the pill styling for
  those.

### 1b. Step 2 ("Drag a block") — wrong target + should be non-interactive
- **Problem:** Cutout sits on the panel-toggle button, not the left components panel; the
  step is currently gated/interactive (requires a drag + shows the Try-it pill).
- **Target:** Anchor step 2 to the **full left blocks/components panel**
  (`data-tour-id="blocks-panel"` container, `EditorShell.tsx` ~168/1343), and use the same
  modal placement profile approved on step 3. **Make it a regular, non-gated step**
  (`gated: false`, no `passthrough`/drag requirement, plain Back/Next, no Try-it pill).
  Keep the copy informational about the components panel; the drag is no longer required to
  advance.

### 1c. Step 3 ("Block properties live here")
- **Problem:** Highlight should be the full right panel; placement is already good.
- **Target:** Anchor step 3 to the **full right properties panel**
  (`data-tour-id="properties-panel-body"`, `EditorShell.tsx` ~1355). Keep placement.

### 1d. Steps 4-6 flicker to viewport center
- **Problem:** Modal appears correctly for ~1 frame then jumps to center.
- **Root cause:** `useElementRect` sets rect to `null` when the Style-tab target is
  momentarily unmeasurable (re-render / `getBoundingClientRect()` returns 0s while the
  properties panel re-lays-out). `SpotlightGuide`'s tooltip position falls back to
  viewport-center when `rect` is null.
- **Target:** In `useElementRect`, **retain the last valid rect** rather than nulling on
  a transient zero/missing measurement; only clear when the anchor element is truly
  absent from the DOM. Confirm the Style tab buttons (`style-tab-content/-design/-layout`,
  `StyleToolkitField.tsx` ~184-188) are mounted (not unmounted) while inactive so the
  rect stays measurable. Steps 4-6 must stay pinned to their tab for the whole step.

### 1e. Step 7 ("Switch between pages") — wrong span + should be non-interactive
- **Problem:** Cutout covers only the Navigation/first tab; copy names only Home/Gallery.
- **Target:** Anchor step 7 to span **the five page tabs Home -> Contact Form**
  (Home, Gallery, Collections Popup, Navigation, Contact Form — excluding Preview). Either
  add a wrapper `data-tour-id="section-tabs"` around those five tabs in
  `EditorShell.tsx` (navCluster ~1109-1173) or compute a union rect. Copy ->
  **"Switch between the different parts of your portfolio website."** Keep it a **regular,
  non-gated step** (plain Back/Next, no Try-it pill) — confirm `gated` is false.

### 1f. Step 8 ("Open Navigation") not anchored -> gate unsatisfiable
- **Problem:** Modal isn't pointing at the Navigation tab, so the gated "open header"
  step can't be completed.
- **Root cause:** `data-tour-id="header-tab"` is assigned dynamically in `navCluster()`
  (~1124) and is not landing on the rendered Navigation button (likely tab-key/label
  mismatch after the tab rework).
- **Target:** Ensure `header-tab` resolves to the actual **Navigation tab button** so the
  cutout lands on it and clicking it satisfies the gate (`gateSatisfied` switch
  `EditorShell.tsx` ~1016-1031, `headerOpen`). Verify Next unlocks after clicking it.

### Item 1 acceptance
- Try-it pill visible in light + dark; copy updated (still-gated steps only).
- Step 2 highlights the full LEFT panel, step-3 placement, and is non-gated (plain Next, no
  Try-it/drag requirement).
- Step 3 highlights the full RIGHT panel.
- Steps 4-6 remain anchored to their Style tab (no center flicker) for the full step.
- Step 7 highlights all five page tabs; copy updated; non-gated (plain Next).
- Step 8 highlights Navigation and its gate can be satisfied by clicking it.
- Playwright: walk the tour start->finish at tablet 768px + desktop 1280px (editor is a
  desktop-only surface; 375px skipped per task scope); assert each cutout
  target and the gate transitions.

---

## Item 2 — Public contact form location selector renders as a black bar

**Files:** `app/(public)/w/[orgSlug]/_components/ContactForm.tsx` (embedded `<style>`),
shared `components/ui/location-picker.tsx` (read-only reference; do not regress bookings).

- **Problem:** In the contact modal's "Location & notes" tab the search input renders as
  a malformed dark/black bar instead of the normal search field seen in the bookings
  location selector.
- **Root cause:** Both selectors share `LocationPicker`. The `Input` has
  `bg-transparent dark:bg-input/30`. The `.pf-contact-form` scoped CSS
  (`ContactForm.tsx` ~287-326) overrides `color` and `border-color` but **not
  `background-color`**, so inside the editor's dark (`html.dark`) context the input
  paints `dark:bg-input/30` (a dark fill) -> black bar.
- **Target:** Add a scoped override in `.pf-contact-form .pf-contact-location` for the
  input/`[data-slot=input]` background (and any compact-mode layout) so the field uses a
  transparent/brand-surface background with a visible border and placeholder, matching the
  bookings selector's search row (icon inside, placeholder visible, clear + confirm
  buttons aligned). Do not change the shared component (bookings must stay correct).
- **Acceptance:** Contact form location search renders as a normal field in light + dark
  editor context and in published preview; bookings selector unchanged; verified at tablet
  768px + desktop 1280px via Playwright (idle/focus/typing states). (Contact form is public
  surface; 375px is a nice-to-have but out of this task's tablet+desktop scope.)

---

## Item 3 — Columns block regression (stuck at 2 columns; col/row span no-op)

**Files:** `lib/page-builder/blocks/manualBlocks.tsx` (ColumnsBlock render + config),
`lib/page-builder/editorConfig.tsx` (`resolveFields`, columns config),
`lib/page-builder/StyleToolkitField.tsx` (column-count Content control,
`ColSpanRowSpanControls`), `lib/page-builder/styleToolkit.ts` (span -> grid CSS).

- **Problem:** Changing the column count does nothing (stays 2); col-span / row-span
  controls have no visible effect.
- **Likely roots (reproduce first with systematic-debugging, do not guess-fix):**
  1. Recent commits (`f310e1a1`, `eb9802b`, `a9d0296`) hid `columns`/`rows` from the Puck
     sidebar via `resolveFields` (`editorConfig.tsx` ~769-773) and moved column-count into
     a Content-tab `CountControl` (`StyleToolkitField.tsx`). Verify that control renders
     and actually calls `setProp("columns", v)` and that the value reaches `ColumnsBlock`.
  2. Grid now renders base `grid-template-columns:1fr` and only widens via
     `@container pf-cols (min-width:480px/720px)` rules (`manualBlocks.tsx` ~542-575). If
     the `.pf-cols` element lacks `container-type: inline-size` (or `container-name`),
     the `@container` queries never match -> column count + `grid-column/grid-row: span N`
     (`styleToolkit.ts` ~316-317) never take effect -> appears stuck.
- **Target:** Restore working column-count changes (1-6) and functional col/row span.
  Confirm the container-query context is correctly established (or fall back to a direct
  `grid-template-columns: repeat(cols, …)` if container queries aren't viable in the Puck
  iframe). Keep the configurable gap/padding behavior intact.
- **Acceptance:** Column count 1-6 visibly changes the grid in editor + published output;
  a child's col-span/row-span visibly spans cells; gap/padding still configurable.
  Reproduction documented; regression test added (unit test on the render/grid-rule
  builder + Playwright check that changing count re-lays-out).

---

## Item 4 — Surface every block's default styling into its controls

**User intent (verbatim):** every default a block renders with — "font color, bg color,
font size, font weight, header style, … literally every design that comes to every block
by default" — must float up to its control as the **pre-filled, editable selected value**,
for **all blocks**, including **existing saved pages on load**. Surfacing must not change
any rendered output (current rendered look is authoritative). No DB write until the user
saves a page.

**Files:** `lib/page-builder/blocks/manualBlocks.tsx` (every `*DefaultProps` + render),
`lib/page-builder/styleToolkit.ts` (`BlockStyle`, `resolveBlockStyle`),
`lib/page-builder/StyleToolkitField.tsx` (controls; add/show where a design default
exists but no control surfaces it), `lib/page-builder/editorConfig.tsx` (`resolveFields`),
plus the page-load normalization (`normalizePublicPageData` and the editor load path).

### Mechanism (single source of truth)
1. **Make `defaultProps` authoritative.** For each block, move every *design* default that
   currently lives as a render-time fallback (`prop ?? "x"`, `|| x`, hardcoded style applied
   when unset) into the block's `*DefaultProps` (content props and/or `_style`), and remove
   the now-redundant fallback from `render`/`resolveBlockStyle`. Render output must be
   byte-for-byte equivalent (defaults equal the old fallbacks). Controls read Puck props
   directly, so the value then appears pre-filled automatically.
2. **Load-time normalization (existing pages).** In the editor load path, deep-merge each
   saved block's props with its block's `defaultProps` (fill **missing keys only**, never
   overwrite a user value) so old blocks surface defaults in their controls. Pure in-memory;
   persisted only when the user saves. Must not alter rendered output.
3. **Unit consistency.** Normalize stored representation to what each control edits:
   spacing/padding/gap as px numbers (convert legacy `"1rem"` strings on read), color as the
   existing token/hex the control uses, typography sizes as the control's unit. Where a
   default is a clamp/responsive expression (e.g. Heading fluid size), surface the resolved
   base value the control can represent, and document the lossy edge in a `ponytail:` note.

### Scope boundary (LOCKED)
**Rule: surface defaults ONLY where a control already exists.** Do NOT add new controls in
this PR. For every property that already has a control, make that control display the
block's real default as a pre-filled, editable value (via `defaultProps` + normalization).
Properties whose defaults render but have NO control today stay exactly as they are
(hardcoded) — they are explicitly out of scope here.

**OUT of scope (no new inputs):** structural plumbing (`display:grid/flex`,
`flex-direction`, `position:relative`, `overflow:hidden`, z-index stacking, internal
`max-width:80rem` content clamps, empty-state/iframe aspect ratios) AND control-less design
hardcodes (Heading fluid `fontSize`/`fontWeight 700`/`lineHeight 1.2`, Button
`letterSpacing 0.04em` and size-derived `min-height/min-width`, Text `lineHeight 1.7` /
`whiteSpace`). Leave all of these hardcoded; the rendered look is authoritative.

This narrows item 4 to: wire existing-control defaults into `defaultProps`, remove the
matching render fallbacks (output unchanged), and add load-time normalization — nothing
that introduces new UI.

### Per-block worklist (LOCKED — only properties whose control already exists)
Each row: wire the render default into the block's `*DefaultProps`, drop the matching
render fallback (output unchanged), and rely on normalization to surface it on old pages.
Verify the named control pre-fills for a new AND an existing block.

| Block(s) | Property | Render default | Existing control |
|----------|----------|----------------|------------------|
| Columns | gap | `1rem` -> px 16 | Layout tab gap (NumberInputRow) |
| Container, GalleryGrid, GalleryMasonry, FeaturedWork, all presets | bgAnimation | `crossfade` | Content tab select |
| Container, GalleryGrid, GalleryMasonry, FeaturedWork, all presets | bgSpeed | `medium` | Content tab select |
| Container | padding (outer `1.5rem` duplicated vs `_style`) | reconcile to `_style` only | Layout tab padding controls |
| Button | buttonStyle | dynamic default -> add to defaultProps | Layout tab buttonStyle toggle |

**Sweep, don't assume the table is exhaustive:** during implementation, for every block
diff each control against its render default and fix any *other* "control exists but shows
blank" cases the same way. Anything without an existing control is OUT (see Scope boundary).

**Explicitly OUT (control-less hardcodes, leave as-is):** Image/Divider/Video wrapper
padding, Divider border color, Video typography & aspect ratios, Heading fluid size/weight/
line-height, Button letter-spacing & size-derived min sizes, Text line-height/whiteSpace.
**Already surfaced (no work):** Spacer height, Divider thickness, ContactDetails toggles,
overlayOpacity, minHeight, alignment, gallery columns/gap.

### Item 4 acceptance
- For every IN-scope property, the control shows the block's default as a pre-filled,
  editable value on a freshly-added block.
- Existing saved pages: opening a previously-saved portfolio shows the same pre-filled
  defaults in controls without changing the rendered page.
- No rendered-output change for any existing block (visual diff / snapshot equivalence).
- Legacy unit strings (`"1rem"`) read correctly into px controls.
- Borderline items resolved per spec-review decisions; OUT-of-scope plumbing untouched.
- Tests: per-block unit tests asserting `defaultProps`-driven render == previous
  fallback render; normalization merge fills missing keys only (never overwrites);
  Playwright spot-check that controls are pre-filled for a new block and an existing one.

---

## Sequencing & ownership
- Items 1, 2, 3 are independent -> parallel Sonnet subagents, disjoint file ownership
  (1: guide files; 2: ContactForm.tsx; 3: Columns in manualBlocks/editorConfig/
  StyleToolkitField/styleToolkit).
- Item 4 overlaps item 3's files (`manualBlocks.tsx`, `styleToolkit.ts`,
  `StyleToolkitField.tsx`) -> runs **after** item 3 merges, as its own sequenced pass
  (per-block tasks can fan out once the mechanism + normalization land).
- Each item: tests added; `pnpm typecheck` + `pnpm lint` + relevant tests pass; UI items
  verified via Playwright CLI at tablet 768px + desktop 1280px before done.

## Done criteria (whole batch)
Implementation complete; tests added & passing; typecheck + lint pass; locales updated
(public copy only, none expected); tablet 768px + desktop 1280px checked; errors surfaced; no rendered-output
regressions for item 4; guide walkthrough verified end-to-end.
