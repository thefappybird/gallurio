# Featured Work popup columns handoff — 2026-09-06

## Status

Implementation is partially complete and intentionally stopped at the user's request. Do not treat this work as verified. No tests, typecheck, lint, diff check, or browser run have been executed after the popup-column edits below.

The worktree already contained a large, related portfolio/media change set before this task. Preserve all existing edits and deletions; do not reset or replace overlapping files.

## User request

For every Featured Work popup layout except Immersive:

- Add a popup setting that controls the number of image columns.
- Make Contact Sheet, Justified, and Split Index honor that setting.
- Make the editor's Collections Popup preview show the same column count as the opened popup.
- Fix the current WYSIWYG mismatch where the preview suggests three columns but Contact Sheet opens with six and Justified chooses its row length from viewport width.
- The motivating case is a five-image collection that should form predictable rows rather than an automatic, visually sparse arrangement.

Immersive must not show or consume the control. The chosen value should remain stored while Immersive is selected so switching back restores it.

## Decisions made

- Persist the setting as `PortfolioCollectionsPopupConfig.popupColumns`.
- Supported values are integers 1 through 6.
- Unset or invalid legacy values resolve to `3`, matching the existing editor preview's apparent default.
- The inspector uses the shared `CountControl` with six quick-value buttons and a display-only effective default of 3. The control is hidden for Immersive.
- Contact Sheet uses an exact CSS grid column count.
- Split Index applies the count to its image index; the collection-details column remains separate.
- Justified interprets the value as the exact number of photos in each complete packed row. It continues preserving source aspect ratios and stretching complete rows to the available width. A final incomplete row remains at the target row height.
- The editor preview uses five placeholders and groups them using the same resolved column count.

## Skills and references already read

- `portfolio-editor-architecture`
- `portfolio-blocks-and-design`
- `portfolio-effective-defaults`
- `docs/AGENTS-INDEX.md`
- Relevant portions of `docs/modules/portfolio-and-media.md`
- Relevant `REUSABLE_CODE.md` entries

Important constraints: shared Puck/editor/public rendering must remain aligned; launch locales are `en`, `fil`, `id`, `ar`, and `th`; no browser run is needed because the user previously said they will do browser verification.

## Completed edits for this task

### Data contract and validation

- `lib/page-builder/types.ts`
  - Added `POPUP_COLUMN_OPTIONS`, `PopupColumns`, and `resolvePopupColumns()`.
  - Added optional `popupColumns` to `PortfolioCollectionsPopupConfig`.
- `lib/validators/publicPage.ts`
  - Added integer validation from 1 through 6.
- `lib/page-builder/blocks/popupLayouts/types.ts`
  - Added required resolved `popupColumns` to `PopupLayoutBodyProps`.

### Runtime layouts

- `lib/page-builder/blocks/CollectionPopup.tsx`
  - Resolves `popupConfig.popupColumns` once and includes it in shared body props.
- `lib/page-builder/blocks/popupLayouts/ContactSheet.tsx`
  - Replaced the six-column flex/min-width behavior with an exact grid using `repeat(popupColumns, minmax(0, 1fr))`.
  - Added `data-popup-columns` for focused assertions.
- `lib/page-builder/blocks/popupLayouts/SplitIndex.tsx`
  - Replaced hardcoded `columnCount: 2` with the resolved count.
  - Added `data-popup-columns`.
- `lib/page-builder/blocks/popupLayouts/Justified.tsx`
  - Passes the count to `packRows` as `itemsPerRow`.
  - Added `data-popup-columns`.
- `lib/page-builder/blocks/popupLayouts/packRows.ts`
  - Added optional `itemsPerRow` mode that chunks complete rows exactly and leaves the final incomplete row unstretched.
  - The original automatic target-height packer remains as the fallback when `itemsPerRow` is absent.

### Inspector and editor preview

- `app/[locale]/(app)/portfolio/_components/CollectionsPopupPanelDialog.tsx`
  - Added a localized Columns `CountControl` immediately after the Featured Work layout picker.
  - It is only rendered for non-Immersive layouts.
  - It displays 3 as an effective, unset default rather than materializing it into saved data.
- `lib/page-builder/CountControl.tsx`
  - Added optional `effectiveValue`, `ariaLabel`, and `inputAriaLabel` support.
  - Effective quick values use the lighter "following default" appearance; explicit values retain the filled appearance.
- `app/[locale]/(app)/portfolio/_components/CollectionsPopupPreview.tsx`
  - Resolves the same popup-column setting.
  - Contact Sheet, Justified, and Split Index swatches now use that count.
  - Changed the decorative sample to five images so 3 columns visibly preview as 3 + 2.
  - Added `data-popup-preview-columns`.

### Localization

Added `collectionsDialog.popupColumnsLabel` and `popupColumnsHint` to:

- `messages/en.json`
- `messages/fil.json`
- `messages/id.json`
- `messages/ar.json`
- `messages/th.json`

Also changed each locale's Split Index description so it no longer promises a hardcoded two-column index.

### Tests already edited but not run

- `lib/page-builder/types.test.ts`
  - Covers the new config field and resolver default/range behavior.
- `lib/validators/publicPage.test.ts`
  - Covers accepted/rejected column values and preserves the field in the full-config round-trip test.
- `lib/page-builder/CountControl.test.tsx`
  - Covers display-only effective count behavior and writing only after click.
- `lib/page-builder/blocks/popupLayouts/popupLayouts.test.tsx`
  - Added `popupColumns: 3` to shared props.
  - Added Contact Sheet, Justified marker, and Split Index column assertions.

## Remaining implementation/test work

1. Add `packRows.test.ts` coverage for fixed rows. Suggested assertion for 8 images with `itemsPerRow: 3`: row membership is `[0,1,2]`, `[3,4,5]`, `[6,7]`; the first two fill container width and the last stays at target height.
2. Add `CollectionsPopupPanelDialog.test.tsx` coverage:
   - Unset Contact Sheet shows the Columns group with 3 effective/pressed.
   - Clicking 5 emits `{ ...config, popupColumns: 5 }`.
   - Immersive hides the Columns group while retaining the value in the passed config.
3. Add `CollectionsPopupPreview.test.tsx` coverage for at least Contact Sheet and the other two layouts using `data-popup-preview-columns` and the expected grid/row grouping.
4. Add a `CollectionPopup.test.tsx` integration assertion that `popupConfig: { popupLayout: "contact-sheet", popupColumns: 4 }` reaches the rendered list as `data-popup-columns="4"`. Layout-level tests cover the three individual renderers; this pins the config-to-body wiring.
5. Consider updating `REUSABLE_CODE.md` to document `popupColumns`, `resolvePopupColumns`, and `CountControl.effectiveValue` once the implementation is confirmed.
6. Review comments in `ContactSheet.tsx`, `SplitIndex.tsx`, and `packRows.ts`; several older comments still describe six/two/automatic columns and should be corrected.
7. Run focused tests first:

   ```powershell
   pnpm exec vitest run lib/page-builder/types.test.ts lib/validators/publicPage.test.ts lib/page-builder/CountControl.test.tsx lib/page-builder/blocks/popupLayouts/packRows.test.ts lib/page-builder/blocks/popupLayouts/popupLayouts.test.tsx lib/page-builder/blocks/CollectionPopup.test.tsx "app/[locale]/(app)/portfolio/_components/CollectionsPopupPanelDialog.test.tsx" "app/[locale]/(app)/portfolio/_components/CollectionsPopupPreview.test.tsx"
   ```

8. Then run `pnpm typecheck`, focused ESLint on touched files, `pnpm lint`, and `git diff --check`.
9. Do not run Playwright/browser verification; the user will do that themselves.

## Likely issues to check immediately

- `PopupLayoutBodyProps.popupColumns` is now required. Search for every direct object literal or renderer call that creates this type and add a resolved value where needed.
- Confirm `CountControl`'s new `role="group"`/effective-state behavior does not change existing Auto semantics. Existing call sites do not pass `effectiveValue`, so they should remain unchanged.
- Confirm Zod's parsed `popupColumns` type remains assignable wherever `PortfolioCollectionsPopupConfigInput` is used.
- Confirm the translated JSON remains valid UTF-8 and all five locale trees have parity.
- The Justified preview uses decorative width weights, while the real layout derives widths from actual image aspect ratios. The column topology will match exactly, but equal-aspect source photos will still render at equal widths. This preserves images without artificial cropping. If the user expects forced editorial width variation even for equal-aspect photos, that is a separate visual behavior decision and should not be guessed.

## Pre-task validation baseline

Before this popup-column task began, the preceding Immersive collection-metadata work had passed:

- 64 focused tests
- `pnpm typecheck`
- Full lint with 0 errors and existing warnings only
- `git diff --check`

Those results do not validate the partial popup-column edits documented here.
