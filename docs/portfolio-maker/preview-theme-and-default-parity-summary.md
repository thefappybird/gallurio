# Portfolio editor: guide loading-gate, consistent skip modal, draft-continue, and canvas↔preview theme parity

Scope of this change set (branch `enhance/portfolio-maker-guide-templates`,
commits `c730ec5`, `5ab6d72`, `588b3eb`, `496f881`, `8c15354`, `a198b79`).

## Problems addressed

1. **Guide step-change flicker.** The spotlight tour cross-faded between steps to
   mask the one-frame window where a new step's anchor wasn't measured yet; the
   fade read as "flickery."
2. **Skip-guide warning inconsistent.** The skip confirmation didn't match the
   editor's save/discard dialogs, and the "Skip Guide" action sat on its own row
   rather than in the footer.
3. **"Continue where you left off" wrongly disabled.** It was gated solely on the
   local unsaved-edit buffer, which is cleared on save/publish — so a returning
   owner with an active draft but no unsaved edits couldn't resume.
4. **Preview/publish ignored the unsaved theme.** The Preview iframe applied the
   brand kit from the database only; theme changes the owner hadn't saved were
   invisible in Preview (wrong colors), while the canvas showed them.
5. **Block defaults not grounded → canvas ≠ preview.** Unset block colors fell
   back to `inherit`, which resolved to the app-shell color in the canvas but the
   brand foreground in preview/publish (the editor canvas intentionally isolates
   `color: var(--foreground)`). Design/Layout controls also rendered blank for
   theme-driven defaults, hiding the choices already in effect.

## Changes

### Guide loading gate (replaces the fade) — `SpotlightGuide.tsx`, `useElementRect.ts`
- `useElementRect` re-measures the anchor **synchronously on id change**, so a
  step whose anchor is already mounted repositions correctly in the same render —
  the original flicker is gone with no animation.
- For a step whose anchor is **not yet mounted** (e.g. a panel that opens a moment
  later), the card **holds frozen in place with a loading indicator**, then snaps
  to the repositioned card + cutout once the anchor appears (600 ms safety
  timeout). The loading gate keys off DOM **presence**, not pixel-perfect layout,
  so present-but-still-laying-out anchors reveal immediately.
- Position-freeze and the loading flag use render-phase state (loop-guarded);
  no ref reads during render.

### Skip warning + footer — `SpotlightGuide.tsx`
- The skip confirmation is hand-rolled to mirror the shared `AlertDialog` /
  `UnsavedChangesDialog` look (icon header, bordered footer, Back · Don't show
  again · Skip Guide). It stays in the tour's high-z portal because the base-ui
  Dialog is pinned to `z-50`, which would render behind the spotlight overlay.
- "Skip Guide" now lives in the footer beside Back (taking Back's slot on the
  first step).

### Draft continue — `EditorShell.tsx`
- `canContinue = hasRecoverableBuffer || initialActiveDraftId !== null` — enabled
  whenever an active draft exists, not just when an unsaved buffer is present.
  Disabled only on a true first visit.

### Preview theme parity (the unsaved brand kit) — `portfolio-preview/`
- New client component `PreviewBrandShell` reads the localStorage draft
  (`gallurio:portfolio-draft:<slug>`, version 2) and applies its `brandKit`'s
  resolved `--pf-*` CSS vars + utility className over the whole preview (header +
  body), falling back to the DB-resolved values when the draft is absent or
  **malformed** (a per-field shallow guard prevents `pf-theme-undefined`).
- `page.tsx`'s outer themed div is replaced by this shell. Result: Preview now
  reflects the unsaved theme, matching the canvas. (Publish already read the DB
  after save and was correct.)

### Block-default grounding — `manualBlocks.tsx`, `StyleToolkitField.tsx`, `brandColors.tsx`
- **Colors as theme tokens:** Text and Heading default to
  `_style.textColorToken: "foreground"` (resolves to `var(--pf-color-fg)`), so an
  unset text color renders **identically** in canvas, preview, and publish, and
  the color control shows the token selected. It stays theme-aware (a token, not
  a frozen hex). Concrete colors are stored only when the user picks a swatch.
- **Theme-coupled values shown, not frozen:** the corner-radius control now
  displays the theme's **effective** radius when the block's radius is unset
  (brand `sharp/subtle/rounded` → the 0/4/8 px preset), via the existing
  `BrandColorsContext` (extended with `brandRadius` + `useEffectiveBrandRadius`).
  This is **display-only** — the block prop is never written, so radius keeps
  following the brand theme.

## Key decisions
- Color defaults are **tokens** (theme-aware) rather than concrete values; concrete
  only on explicit swatch pick (user's call).
- Radius (and other theme-coupled, token-less values) stay **unset/theme-coupled**;
  the control merely **displays** the theme's effective value (user's call).
- **Button colors were intentionally NOT materialized.** Button border/text color
  are computed per `buttonStyle` variant at render; writing a default token would
  change the solid/soft variants. Surfacing the button's effective per-variant
  defaults in the controls is a deferred follow-up.

## Verification
- Typecheck clean; ESLint 0 errors (2 pre-existing unused-var warnings in
  `manualBlocks.tsx`, not in changed lines).
- 262 tests pass across the 9 touched suites (SpotlightGuide, useElementRect,
  EditorShell, spotlightSteps, portfolio-preview ×3, styleToolkit, editorConfig,
  StyleToolkitField). New tests cover: the loading gate (present vs absent
  anchor), the synchronous re-measure, the Continue enablement, the
  PreviewBrandShell apply/fallback/malformed paths, `textColorToken:"foreground"`
  resolving to `var(--pf-color-fg)`, and the radius effective-default display.
- Whole-branch review (most-capable model): mergeable, no Critical/Important
  findings.
- Browser parity check (Playwright, 1280/768px): **PASS**. Preview applied the
  unsaved draft theme from localStorage (Luxury bg `#0e0e0e`, fg `#f3efe9`),
  matching the canvas rather than the DB (a brief DB-theme flash precedes the
  effect, as documented). The radius control showed the theme's effective preset
  (Romantic `subtle` → `S`, `aria-pressed`). The skip-confirm modal rendered with
  the icon header + Back / Don't show again / Skip Guide footer, and step
  transitions snapped cleanly with no persistent spinner.

## Follow-ups (non-blocking)
- ~~Surface the button's effective per-variant defaults in its controls~~ — done in
  Round 7 (below).
- DRY: `LOCAL_DRAFT_VERSION` duplicated in `PreviewBrandShell`/`PreviewClient`;
  the 3-entry brand-radius map duplicated in `brandColors.tsx`/`StyleToolkitField.tsx`
  (circular-import avoidance). Register in `REUSABLE_CODE.md` when extracted.

---

# Round 7 — effective-default display for ALL fields, button redesign, gallery/container fixes, and full preview parity

Continuation of the same branch (commits `b266625`..`200862c`). Round 6 grounded
colors and showed the *radius* effective default; Round 7 generalizes that
display pattern to every theme-coupled control, redesigns the Button block,
fixes a batch of editor bugs, and closes the canvas↔preview↔publish parity gap
for the header, collections popup, and contact form.

## Problems addressed
1. **Theme-driven defaults hidden in most controls.** Only radius/colour showed
   their effective value; font size/family, border width/colour, gap, min-height,
   align/justify, and container padding rendered blank, hiding the choice already
   in effect.
2. **Button controls inconsistent + frozen text colour.** Button text/heading/
   button-text colour are theme-decided but weren't shown; button controls were
   split across Design/Layout/Frame tabs with a duplicate radius.
3. **Container/Columns/gallery padding materialized.** Padding lived as filled
   strings in `defaultProps`, so it read as an explicit override rather than a
   theme default.
4. **Gallery blocks: stray Puck fields + bg-image.** PhotoGrid/Masonry/Highlights
   exposed top-level Puck `columns`/`gap` selects (instead of the style drawer
   every other block uses) and a background-image picker that doesn't apply.
5. **Contact Details block invisible on drop.** Its editor `render` used the shared
   `Preview` wrapper, which never attached Puck's `dragRef` → the block rendered
   unmeasured with its action toolbar off-screen.
6. **Editor nav row wrapped to 3 lines** on narrow widths.
7. **Preview ignored unsaved header / popup / contact config.** Preview read these
   from the DB only (Round 6 wired only the brand kit), so navbar edits, the
   collections popup (never rendered at all), and the contact form's active/inactive
   tab styling appeared only after publish.

## Changes
### Effective-default display generalized — `StyleToolkitField.tsx`, `toolbarPrimitives.tsx`, `brandColors.tsx`
- Every in-scope control now takes an `effectiveValue`: it pre-fills/ highlights
  the theme's effective value as a **display-only** overlay (lighter ring /
  placeholder), the block `_style` prop stays **unset**, editing decouples just
  that field on that block, and clearing reverts. `DimensionInput`, `ColorSwatchRow`,
  and the shadow/icon rows were extended to carry it.
- Brand fonts were threaded through `BrandColorsContext` (`useEffectiveBrandFont`)
  with a shared `resolveEffectiveFonts` reused by `resolveBrandKit` + `EditorShell`.

### Text/Heading/Button text colour shown, not materialized — `manualBlocks.tsx`, `styleToolkit.ts`
- `textColorToken:"foreground"` was **de-materialized** from the Text/Heading
  `defaultProps`; the render grounds colour via an outer-div
  `color: colorTokenToVar(_style?.textColorToken) ?? var(--pf-color-fg)` placed
  before the `resolveBlockStyle` spread, so canvas == preview == publish without a
  written default.
- Shared `effectiveButtonTextToken(style)` (solid→background, soft/outline→
  buttonColorToken??primary, else→foreground) backs both the render fallback and
  the control — one source, can't drift.

### Button block redesign — `StyleToolkitField.tsx`, `manualBlocks.tsx`
- Consolidated onto the Design tab (colour, opacity [new], text colour, radius,
  style); removed the Frame section (border width/colour, shadow) and the duplicate
  Layout radius. Opacity applies to the fill, mirroring the header's
  `buildColorWithOpacity`. Dev-only data → old props are simply ignored on render.

### Container/Columns padding → effective — `manualBlocks.tsx`, `StyleToolkitField.tsx`
- Padding de-materialized from `containerDefaultProps`/`columnsDefaultProps`; render
  fallbacks (`CONTAINER_EFFECTIVE_PAD` 1.5rem; `COLUMNS_EFFECTIVE_PAD` 1rem/1.5rem)
  reproduce byte-identical output, asserted by `renderToStaticMarkup` tests. Curated
  preset sections keep their explicit padding (it's intentional design).

### Gallery blocks — `manualBlocks.tsx`, `editorConfig.tsx`, `StyleToolkitField.tsx`
- `columns`/`gap` moved from top-level Puck selects to `_style.galleryColumns/
  galleryGap` drawer overrides (effective 3 / "normal"); the background-image picker
  is suppressed for the 3 gallery container blocks (banner **Color** kept); shadow
  shows effective "none".

### Bug fixes
- **ContactDetails dragRef** — the shared `Preview` wrapper now attaches
  `ref={puck?.dragRef}` to its root `<section>` so Puck measures the block (it's the
  only block using `Preview`).
- **Nav row** — the cluster is `flex-nowrap` + `overflow-x-auto` with `shrink-0`
  children, so it scrolls instead of wrapping; tour anchors preserved.

### Preview parity — `app/[locale]/portfolio-preview/`
- `PreviewBrandShell` now parses the draft `header`/`contact`/`collectionsPopup`
  configs (new `PreviewDraftContext`); new `PreviewHeaderShell` + `PreviewPopupShell`
  and the updated `PreviewContactCard` render them with the **production** components
  (`PortfolioHeader`, `CollectionPopupChrome`, `ContactForm`) — no forks — so navbar
  edits, the popup (previously absent in preview), and the contact form's
  active/inactive tab styling all show pre-publish, falling back to DB when the draft
  is absent/malformed.
- The collections popup renders as a dedicated `zone=popup` surface (not an always-on
  sample spliced onto every page). `previewZoneFor(activeSection, activeZone)` maps
  the active editor section to the preview `zone` param so the iframe **and** the
  open-in-new-tab link land on what the owner is viewing (popup/contact/page) —
  closing a reachability gap where `zone=popup` was otherwise unreachable.

## Key decisions
- One uniform **effective-default DISPLAY** mechanism (mirror of Round 6's
  `RadiusButtons.effectiveValue`): show the effective value, keep the prop unset,
  write `_style` only on explicit edit. Codified as the new
  `.claude/skills/portfolio-effective-defaults` skill (the float-up vs.
  materialize/ground decision), with the existing portfolio skills reconciled.
- **Ground in the render, don't materialize into `defaultProps`** when a concrete
  `var(--pf-*)` fallback restores parity — keeps the prop theme-coupled.

## Verification
- `pnpm typecheck` clean; `pnpm lint` 0 errors (82 pre-existing warnings, none in
  changed lines).
- Touched page-builder + preview suites green (incl. the new `previewZoneFor`,
  effective-default, padding-parity, and Preview*Shell tests).
- Whole-branch review (most-capable model): MERGEABLE, 0 Critical / 0 Important
  after fixes. Two review findings fixed: a UTF-8 BOM injected into 7 files
  (stripped), and the popup preview reworked from an always-on sample to the
  dedicated `zone=popup` surface.
- Browser verification deferred to the owner per request (no Playwright run this
  round).

## Round 7 follow-up fixes (commits `c4289f1`, `8449d59`, `ef86ba6`)

Three issues reported after the owner exercised the preview and editor:

- **Preview navbar links dropped the draft theme.** Clicking the navbar **Gallery**
  link inside the preview iframe reverted to the published/DB theme (wrong
  foreground) and lost the navbar/contact/popup styling. Root cause: `PortfolioHeader`
  hardcoded the Gallery href to `/w/${slug}/gallery` (the published route) with no
  override, while Home already had a `homeHref` override the preview uses. Added a
  `galleryHref?` prop threaded through `PreviewHeaderShell` and set from the preview
  page to `/[locale]/portfolio-preview?zone=gallery`, so navigating between Home and
  Gallery stays on the draft-aware preview route (which re-applies the unsaved draft).
- **Root page canvas controls rendered blank.** The Puck `root` style panel
  (`RootStyleField`) now floats its effective defaults like the block controls do:
  the background-color swatch shows the theme **background** token as the effective
  value when unset, opacity shows `100`, and padding/margin show their `0` default —
  all display-only (the `_rootStyle` prop stays unset; `resolveRootStyle` and rendering
  are untouched, so parity holds).
- **Empty containers weren't droppable at page root.** An auto-height container
  collapses to ~3rem of padding when empty, so the root drop zone had no targetable
  band and dragging an empty container only nested it into a taller sibling. Applied a
  5rem **editor-only** min-height (gated on `puck.isEditing`) so empty containers keep
  a grabbable footprint and the root canvas keeps a drop band between siblings; the
  published page is unchanged. (This is a dnd-kit targeting mitigation — owner to
  confirm the drag-to-root gesture in a browser.)

Each shipped with tests (PortfolioHeader gallery-href override; RootStyleField
effective-default display; ContainerBlock editor-only min-height incl. production
guard); `tsc`/`lint` clean.

### Second wave (commits `f9dde61`, `63d8774`, `03bd088`)
- **Renamed the editor "Collections Popup" → "Featured Popup"** (the active-section
  title, the nav tab, and the panel heading/aria; internal `collectionsPopup` keys
  untouched).
- **Contact form now opens from the navbar in preview.** The navbar Contact button
  calls `window.__gallurioOpenContact?.()`, which is registered by `ContactModal`
  via `useGlobalContactTrigger`. That modal is mounted in the *public* layout, but
  the preview route is a separate tree that never mounted it — so the opener was
  undefined and the click was a no-op (the popup has its own trigger, hence it
  worked). A new `PreviewContactModal` mounts `ContactModal` + `ContactTriggerDelegate`
  in the preview (home/gallery zones), fed by the draft contact config + draft brand
  vars via `PreviewDraftContext`.
- **Empty-container action controls.** The container drop zone was first stretched
  to fill via `flexGrow` (fixed the small-strip droppable area), but that left Puck's
  internal empty-zone model at its 128px default, so the copy/delete action-bar
  overlay landed inconsistently on empty containers. Reworked to feed a per-size
  editor px height into Puck's **native `minEmptyHeight`**, so the empty-zone model
  matches the visible area and the overlay tracks an empty container like any other
  block. Editor renders container heights in px (to feed `minEmptyHeight`); the
  public page keeps vh heights + a content-sized slot (unchanged).

### Third wave — side-panel unification + contact styling (commits `2e75140`, `ad7c933`, `0f1b3a3`, `d5daead`, `4b88274`, `18b4357`, `fcf0c11`, `538d7a1`)

The three non-Puck-block side panels (Navigation, Contact, Featured Popup) each carried
their OWN `ColorSwatchRow` + `resolveSwatchHex(brandKit)` copy instead of the shared
brand-aware control — the root of several reported issues. Plus three concrete contact
rendering bugs.

- **Swatch shows white but applies black (background/foreground).** `resolveContactColor`
  built `var(--pf-color-${token})`, yielding the non-existent `--pf-color-background` /
  `--pf-color-foreground` (real vars: `--pf-color-bg` / `--pf-color-fg`), so those tokens
  fell back to a wrong color while the swatch showed the right hex. Fixed to reuse
  `colorTokenToVar`; the duplicate copy in `ContactFormPreview` was removed. (Bug was on the
  published page too.)
- **Contact active/inactive tab styling missing in the editor canvas.** `ContactFormPreview`
  rendered `<ContactForm>` without the contact config, so `getActiveTabExtraStyle(undefined)`
  produced empty styles. Now passes `contactConfig`, matching the published page.
- **Error-message color** now defaults to Gallurio's CRM error color `#e7000b` (the app
  `--destructive`, exported as `CRM_ERROR_COLOR`) instead of `accent`, and appears as a
  selectable swatch on the contact error-color control (via a new additive `extraSwatches`
  prop on the shared `ColorSwatchRow`).
- **Unify + float.** Navigation, Contact, and Featured Popup now use the shared
  `toolbarPrimitives.ColorSwatchRow` (brand colors from `useBrandColors()`, so swatch DISPLAY
  == APPLIED color) and float every control's effective default (`effectiveValue` derived
  from each field's public-render fallback — display-only; props stay unset until edited).
- **Featured Popup design synced.** Its custom `DesignDrawer` accordion was replaced with the
  shared `EditorDrawerSection`/`EditorDrawerGroup` (Popup / Title styles / Button styles), so
  it matches the Navigation/Contact panels and the Puck blocks.

Spec + decisions are recorded here (the standalone spec doc was folded in). Public render
output is unchanged; editor chrome stays English-only (the panels' localized swatch labels
were dropped for the shared English labels). 68 tests across the touched suites; `tsc`/`lint`
clean.

### Fourth wave — tab-size placement + "Move out" block action (commits `01fce99`, `0ad4827`, `78721cf`)

- **Contact tab font size moved up a level.** It sat inside the Inactive-tabs sub-section but
  applies to ALL tabs, so it now lives at the Tabs-section level, above both the active and
  inactive sub-sections.
- **"Move out" block action (deterministic un-nest).** Dragging an EMPTY container out of a
  parent container to the page root was unreliable — Puck/dnd-kit drops into the deepest zone
  under the cursor, so nested containers outrank the root canvas, and a thin empty container
  leaves almost no root area to target (a content-filled, tall container drags out fine). Rather
  than keep tuning the drag, added a **"Move out"** button to the block action bar (Puck
  `actionBar` override, `MoveOutActionBar`) that dispatches a Puck `move` action relocating any
  nested block to the page root zone (`"root:default-zone"`). The move logic is a pure, unit-
  tested helper `moveBlockToRootAction(indexes, itemId)`; the button only shows for nested
  blocks. Works for empty or filled blocks; no precise dragging needed. (Runtime Puck UI —
  owner verifies the button in a browser.)

### Fifth wave — custom always-visible block-actions toolbar (commits `d6d990b`…`5cbe5d0`, `b080ad4`)

The "Move out" button (fourth wave) never appeared, and Puck's own floating action bar shows
inconsistently for containers — both because Puck's overlay visibility is internal state
(`dragFinished && (hover||selected)`) we can't control, and because the first attempt gated on
`appState.indexes` which is undefined on the public `usePuck().appState`. Replaced the Puck-bar
dependency with our OWN canvas toolbar that's always visible whenever a block is selected:

- `BlockActionsToolbar` (`createUsePuck` selectors — no bare `usePuck()`, so no Puck perf
  warning) reads the selected block from the PUBLIC `appState.ui.itemSelector` (`{index, zone}`),
  anchors to the block's `[data-puck-component]` element via a small rAF rect hook, and portals a
  fixed toolbar to `document.body` at the block's top-right. Buttons: block label · Move up · Move
  down · Move out (nested only) · Duplicate · Delete — all driven by a pure, unit-tested helper
  `selectedBlockActions(itemSelector, rootContentLength)`.
- Puck's own flaky action bar is suppressed via the `actionBar` override (`SuppressedActionBar`
  renders an empty bar) so there is a single, reliable toolbar.

Owner verifies the toolbar in a browser (runtime UI); the action logic + wiring are unit-tested
(71 tests across the touched suites), `tsc`/`lint` clean.
