# Portfolio editor reliability handoff — 2026-09-05

## Checkpoint

- Branch: `fix-feat/portfolio-maker-reliability-and-new-presets`
- Worktree: `C:\Users\Alex\Desktop\Projects\gallurio`
- State: implementation and focused tests are complete; runtime/browser verification and final repository-wide validation remain.
- No commit or push was made.
- Preserve the user-owned untracked `docs/demo-scripts/` directory. It is unrelated to this work.

## Requested behavior and current status

1. **Preview header mutates and footer disappears after navigation** — implemented a preview routing/data fix. The preview page now loads a valid tenant-owned durable draft before building navigation, preserves `draftId` across preview links, and supplies the draft collection-popup metadata to the shared renderer. Unsaved preview data also overrides the render metadata through `PreviewDraftContext`. Browser verification is still required.
2. **Home/Gallery links route outside preview** — implemented for Navigation, Footer, and Button links. Preview Home/Gallery URLs are derived from the current preview location; Contact remains the modal action. Browser verification is still required.
3. **Image popup ignores configured layout and metadata** — implemented propagation of the selected preview layout and current metadata into the lightbox. Saving photo metadata from the Image inspector also updates the block's baked metadata immediately. Browser verification is still required for Sidebar and at least one other layout.
4. **Uploads should open photo details immediately** — implemented for single and multiple uploads in the media picker, edit-collection flow, create-collection flow, and collection picker. Successful uploads enter the full `ImageMetaWizard` instead of presenting an extra Add details/Skip prompt.
5. **Collection image edit opens alt-only UI** — replaced with the full metadata wizard.
6. **Too many nested collection modals** — implemented a single Photos & collections shell. Selecting a collection swaps the shell body to embedded Edit collection content; a Back button beside the title restores the manager. The photo metadata wizard is the only second modal layer.
7. **Busy upload zones remain interactive** — implemented `aria-disabled`, disabled file inputs, removed keyboard focus, and click/key/drop guards while an upload is active.
8. **Duplicate Image-block alt field** — the current inspector did not render a second editable Alt field. Tests now lock that behavior; the full Photo details section is the sole editor. Backward-compatible alt data reading remains.
9. **Dropping into PageBody scrolls the canvas to the top** — no explicit application scroll call was found. Legacy `ContainerAnchor` injection was removed because the invisible anchor block was the strongest application-side suspect. This item is not considered runtime-verified: reproduce it in the batched browser pass and instrument Puck drag/drop only if the jump persists.
10. **Horizontal container center alignment does not center on the y-axis** — fixed by mapping horizontal `contentHorizontalAlign` to `align-items` (the cross axis).
10.1. **Leaf blocks should default to hug and expose margins** — Heading, Text, and Button now use effective `fit-content` width, hide the width editor, expose per-side margins, and have a small default selectable margin. Image/gallery blocks retain their resizable width controls because intrinsic/crop layouts depend on them; confirm with the user before broadening the hug-only rule to those blocks.
10.2. **Use container margins instead of ContainerAnchor** — Container and Columns now expose per-side margins and receive an effective 8px bottom margin (Footer is exempt). The reconciler strips legacy anchor children and no longer injects anchors. The old block registration remains only for saved-document render compatibility. This is explicitly experimental and should be visually tested for the user to accept or request a revert.

## Main implementation locations

- `app/[locale]/portfolio-preview/page.tsx`
- `app/[locale]/portfolio-preview/_components/PreviewClient.tsx`
- `lib/page-builder/blocks/manualBlocks.tsx`
- `lib/page-builder/StyleToolkitField.tsx`
- `lib/page-builder/ImageBlockMetaSection.tsx`
- `lib/page-builder/containerAnchorReconciler.ts`
- `lib/page-builder/galleryPicker/MediaPicker.tsx`
- `lib/page-builder/galleryPicker/CollectionsManagerDialog.tsx`
- `lib/page-builder/galleryPicker/EditCollectionDialog.tsx`
- `lib/page-builder/galleryPicker/CreateCollectionDialog.tsx`
- `lib/page-builder/galleryPicker/CollectionPicker.tsx`
- `messages/{en,fil,id,ar,th}.json`

Each behavior change has a corresponding focused test in the neighboring `*.test.ts(x)` files.

## Validation completed

Focused Vitest command:

```powershell
pnpm vitest run --silent=true --reporter=dot "lib/page-builder/galleryPicker/MediaPicker.test.tsx" "lib/page-builder/galleryPicker/EditCollectionDialog.test.tsx" "lib/page-builder/galleryPicker/CreateCollectionDialog.test.tsx" "lib/page-builder/galleryPicker/CollectionsManagerDialog.test.tsx" "lib/page-builder/blocks/manualBlocks.test.tsx" "lib/page-builder/StyleToolkitField.test.tsx" "lib/page-builder/containerAnchorReconciler.test.ts" "lib/page-builder/editorConfig.test.ts" "app/[locale]/portfolio-preview/page.test.tsx" "app/[locale]/portfolio-preview/_components/PreviewClient.test.tsx"
```

Result: **10 test files, 738 tests passed**.

Affected-file ESLint completed with exit code 0. `git diff --check` completed with no whitespace errors (Git emitted only the repository's LF-to-CRLF working-copy warnings).

## Known validation blocker

`pnpm typecheck` currently fails before reaching project diagnostics because the active development output contains malformed/in-flight generated files:

- `.next/dev/types/routes.d.ts`: syntax errors around lines 150–184
- `.next/dev/types/validator.ts`: syntax errors around lines 791, 796, 824, and 829

This looks like a dev-server generation race/corruption, not a reported source diagnostic. Do not delete generated output while a dev server is writing it. At the next checkpoint, first determine whether a dev server is active; after it is stopped, safely clear only the affected generated `.next/dev/types` output if needed, then rerun `pnpm typecheck`.

## Recommended continuation order

1. Review `git status --short` and this diff before making additional edits. Do not include `docs/demo-scripts/`.
2. Resolve the generated `.next/dev/types` issue and rerun `pnpm typecheck`.
3. Perform **one batched 1280px authenticated Playwright/editor session** (per repository policy) covering all runtime-only assertions:
   - Preview Navigation, Footer, and Button Home/Gallery links remain in preview, preserve the selected draft, keep the header stable, and keep the footer visible.
   - Image lightbox shows the configured Sidebar layout and saved title/description/alt; verify one additional layout.
   - Single and multi-upload immediately open Photo details; the busy drop target cannot be clicked, keyed, or dropped into.
   - Photos & collections swaps to Edit collection in the same dialog, Back restores the list, and image edit opens full metadata as the only nested dialog.
   - Record `scrollTop` before and after dropping a block into PageBody. If it still jumps to zero, diagnose that concrete event before patching.
   - A Button in a horizontal Container is vertically centered, leaf margins leave a usable selection area, and the 8px container bottom margin leaves a reachable drop zone.
4. If browser findings require fixes, add focused regression tests first and rerun the consolidated focused suite.
5. Run final affected/full lint as appropriate, `pnpm typecheck`, and `git diff --check`. Do not commit or push unless the user explicitly requests it.

## Worktree inventory at checkpoint

Before adding this handoff, the diff contained 26 tracked files with 521 insertions and 416 deletions. All changes are unstaged. Run `git diff --stat` for the current count including this file.
