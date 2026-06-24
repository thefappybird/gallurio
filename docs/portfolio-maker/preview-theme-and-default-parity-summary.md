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
- Surface the button's effective per-variant defaults in its controls (deferred).
- DRY: `LOCAL_DRAFT_VERSION` duplicated in `PreviewBrandShell`/`PreviewClient`;
  the 3-entry brand-radius map duplicated in `brandColors.tsx`/`StyleToolkitField.tsx`
  (circular-import avoidance). Register in `REUSABLE_CODE.md` when extracted.
