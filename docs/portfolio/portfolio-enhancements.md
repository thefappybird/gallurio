# Portfolio builder — enhancements & fixes

Scoped to the portfolio editor (`app/[locale]/(app)/portfolio/`), the shared Puck config
(`lib/page-builder/`), and the public pages (`app/(public)/w/[orgSlug]/`). Thirteen items plus
a guide follow-up (5b). Source request: `PORTFOLIO-ENHANCEMENTS.md`.

## Changes per item

1. **Debounce draft autosave (typing lag).** Puck emits an `onChange` per keystroke; persisting
   to `localStorage` on each made text blocks laggy. `EditorShell.handleChange` now calls a
   debounced persist (~350ms trailing, `useDebounce`), flushed at every commit point — zone
   switch / preview / save (`flushPendingSave`), `beforeunload`, and unmount — so the buffer is
   never stale and no keystrokes are lost. Config changes still persist synchronously.

2. **Container anchor crash (React #185).** Drafts saved before the `${containerId}--anchor` id
   convention carried a suffix-less anchor; `resolveContainerData` passed them through, so
   `EditorContainerAnchor` computed `parentId === id` and its selection-bounce effect re-selected
   the same anchor forever. Fix: the idempotency check in `editorConfig.tsx` now also requires the
   anchor id to be `${containerId}--anchor` (malformed drafts regenerate a correct anchor), plus a
   `parentId === id` bail in `EditorContainerAnchor` as defense-in-depth.

3. **Auto-select uploaded photo (except the Photos manager).** In `MediaPicker`/`CollectionPicker`,
   a successful upload now auto-selects the new item — single mode picks + closes, multi appends.
   The standalone Photos manager uses `CreateCollectionDialog`/`EditCollectionDialog` directly and
   never reaches this path, so the exclusion is architectural (no mode flag needed).

4. **Remove emoji feature.** Deleted `EmojiTextInput.tsx` (+test); removed the `EmojiButton`
   import/usages and orphaned refs from `StyleToolkitField.tsx` and the stale describe block.

5. **Page-wide language toggler + RTL orientation.** A globe control (`PortfolioLanguageControl`)
   beside the canvas viewport controls sets `publicPage.formLocale` (en/fil/ms/id/ar) for nav +
   contact + collections popup together; Arabic is re-enabled. An optional `formDir` override
   (revealed for RTL locales) threads through the draft/publish pipeline and applies `dir=` on the
   **public portfolio wrapper** (not `<html>`) via `resolveEffectiveDir`. The collections popup is
   localized via Puck `metadata.collectionPopupLabels` (`publicPage.collectionPopup.*`). The
   redundant contact-panel language selector was retired.

   5b. **Guide.** Added a `translate` tour step (anchored to `language-control`) just before the
   `theme` step, in all 5 locales. The drag-block step's interaction is now confined: a
   `passthrough` step with a `secondaryAnchorId` tiles perimeter blockers around the union of the
   two cutouts, so only the blocks panel and canvas stay clickable while the panel→canvas drag
   still works.

6. **Collections picker — min height + centered empty state.** The empty branch is wrapped in a
   `min-h` flex container that centers the message, so the picker holds ~one-tile height.

7. **Featured popup warning.** Opening the Collections Popup with no Featured Work block present
   shows a warning modal (those styles only apply to that block); with the block present it opens
   normally. Pure branch logic lives in `lib/page-builder/hasFeaturedWork.ts`.

8. **Image upload error on click.** The header logo uploader routed through `uploadImage`, which
   enforces the gallery photo `minShortSide` of 600px; logos (max 512×256) always failed
   `dimension_too_small` before any request. Switched to `uploadAsset` with logo-appropriate max
   constraints (no minimum), which returns a typed `{ error }` instead of throwing.

9–11. **Header link colors — active vs inactive.** `brandTextColor` now defaults to its own
   foreground token (no longer bleeds from `linkColor`); `activeLinkColor` moved into the Active
   Link Style drawer; `linkColor` moved into a new Inactive links drawer. Each control affects only
   its target in `PortfolioHeader`.

12. **Toggle active color.** Both the contact (`S/M/L`, Style) and header (Scale/Highlight/
    Underline) segmented toggles already render the identical neutral-charcoal active state
    (`bg-foreground text-background`) — verified in code and against the reported screenshots
    (neither was brand teal). No change required.

13. **Featured Work visible default.** `featuredWorkDefaultProps` gains `minHeight: "medium"` so a
    freshly added block has a visible surface out of the box.

## Key decisions
- Task 5 is **page-wide**, not per-surface (a code trace showed `formLocale` was already a single
  page-wide chrome locale); the control is a toolbar globe dropdown.
- RTL is **scoped to the public portfolio wrapper**, never `<html>` (preserves CRM/root isolation).
- `formDir` is an **additive optional** field → the local-draft `LOCAL_DRAFT_VERSION` was NOT
  bumped (a bump silently invalidates users' existing local buffers).
- Task 12 needed no code change; the divergence in the screenshots was not reproducible in current
  code.

## Verification
- `pnpm typecheck` clean; `pnpm lint` 0 errors. Targeted Vitest green across every touched area
  (PortfolioLanguageControl, portfolioDraft, localeForCountry, ContactPanel, blockContext,
  hasFeaturedWork, rtl, Workspace, CollectionPopup, SpotlightGuide, spotlightSteps, EditorShell,
  editorConfig, EditorContainerAnchor, HeaderPanelDialog). All 5 locale JSON files parse.
- Bugs #2 and #8 were reproduced in a live browser before fixing; each ships a regression test.
- Pre-existing repo state: one pre-existing `EditorShell` test failure (`BlockActionsToolbar`) is
  unrelated to this work; `lib/page-builder/RootCanvasStyle.*` carry unrelated pre-existing edits
  excluded from every commit here.

## Post-review fixes
A full code-review pass surfaced two functional fixes and three polish items, all addressed:
- **Featured Work detection (item 7)** was top-level-only, so the warning fired even when the
  block was present inside a preset/container. `hasFeaturedWorkInZones` now recurses into nested
  `content` slots.
- **Stale RTL override (item 5)**: `resolveEffectiveDir` now ignores an `ltr`/`rtl` override on
  non-RTL locales, so a leftover `formDir: "rtl"` can never flip a non-Arabic public page.
- `PortfolioLanguageControl` switched to a `menuitemradio` radio group (valid ARIA + a visible
  check for the current locale); the toolbar direction toggle reflects the effective direction.
- Pruned the orphaned `contactDialog` language keys left behind by removing the contact-panel
  language selector.
