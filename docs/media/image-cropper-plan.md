# Shared image cropper modal — implementation plan

Branch: `feat/image-cropper` (worktree `.claude/worktrees/image-cropper`, branched from `dev`).
Status: approved, not yet implemented.

## Context

Every image upload surface in the app today takes whatever file the user picks and ships it straight to Cloudflare Images. Each surface has its own idea of "correct" dimensions — encoded as `maxWidth`/`maxHeight`/`requireSquare` constraints that `uploadAsset` **accepts but silently ignores** (see the comment at `lib/storage/uploadAsset.client.ts:48-56`), plus a `minShortSide: 600` floor in `lib/page-builder/photoSpec.ts` that rejects files rather than fixing them. Net result: users get rejected for pixel dimensions they can't control, and images that pass still render wrong because their aspect ratio doesn't match the slot.

The fix: a shared crop modal that runs between file-pick and upload. The user frames the image at the required aspect; the crop output is guaranteed correct by construction. Validation collapses to file type + file size on the *input* file — the only thing a user can reasonably reason about. No dimension floors, no aspect checks, no silent-ignore constraints.

Decisions locked with the user:
- **Engine:** `react-easy-crop` (new dep). Handles pan / pinch-zoom / touch / aspect lock. We supply the canvas encode.
- **Gallery excluded:** bulk portfolio photo uploads (MediaPicker + collection dialogs) stay as-is — free aspect, no crop step. Cropper applies to the fixed-aspect single-image surfaces only.
- **Output:** always `image/webp` at quality 0.92. Alpha-safe, smaller than source, one code path.

## New files

### `lib/media/cropSpecs.ts`

Central table of per-surface crop specs. Today these constants are copy-pasted across four files (`LOGO_MAX_BYTES` / `LOGO_TYPES` / `SITE_ICON_*` appear in `settings/workspace/_business-form.tsx`, `settings/public-page/_form.tsx`, `portfolio/_components/HeaderPanelDialog.tsx`, `portfolio/_components/StoryPromptDialog.tsx` with subtly different values). Collapse to one module.

```ts
export type CropSpec = {
  /** width / height. null = free crop, user drags any rectangle. */
  aspect: number | null;
  /** Output pixel caps. null = uncapped (crop at native resolution). */
  maxWidth: number | null;
  maxHeight: number | null;
  /** Validated against the INPUT file before the modal opens. */
  maxBytes: number;
  acceptedTypes: readonly string[];
};
```

Specs (values taken from the existing call sites; aspect newly assigned):

| Key | aspect | maxWidth x maxHeight | maxBytes | notes |
|---|---|---|---|---|
| `avatar` | 1 | 512 x 512 | 10 MB | `settings/account/_panel.tsx` |
| `workspaceLogo` | 1 | 512 x 512 | 250 KB | `_business-form.tsx`, was `requireSquare` |
| `siteIcon` | 1 | 512 x 512 | 1 MB | favicon — square is mandatory |
| `headerLogo` | `null` | 1024 x 512 | 250 KB | wordmarks vary in aspect; free crop, capped px |
| `ogImage` | 1200/630 | 1200 x 630 | 10 MB | social card aspect is fixed by spec |

### `lib/media/cropImage.ts`

Canvas encode. ~50 lines, one exported function:

```ts
export async function cropToFile(
  src: File,
  area: { x: number; y: number; width: number; height: number }, // croppedAreaPixels
  spec: CropSpec,
  fileName: string,
): Promise<File>
```

Draws `src` into a canvas sized to `area`, downscaled to fit `spec.maxWidth`/`maxHeight` when non-null (preserve aspect, never upscale), then `canvas.toBlob(..., "image/webp", 0.92)` -> `new File([blob], name, { type: "image/webp" })`. Use `createImageBitmap(src)` for decode — no `<img>` + object-URL dance, and no leak to clean up.

### `components/ui/image-cropper-dialog.tsx`

The modal. Built on the existing `components/ui/dialog.tsx` primitives (`Dialog` / `DialogContent` / `DialogHeader` / `DialogTitle` / `DialogDescription` / `DialogFooter`).

Layout, per the requested structure:
- **Header** — title + description (description states the spec: aspect label and max output px, or "any shape" when `aspect` is null).
- **Body** — `<Cropper>` from `react-easy-crop` in a fixed-height (`h-[min(60vh,420px)]`) relative container, plus a zoom `<input type="range">` beneath it. Round crop shape for `aspect === 1` avatar/icon surfaces via the `cropShape="round"` prop.
- **Footer** — Cancel (left/secondary) + Upload (primary, brand teal). Upload shows a spinner and disables while encoding.

Props:

```ts
{
  file: File | null;      // non-null drives open state
  spec: CropSpec;
  title: string;
  description?: string;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
}
```

### `lib/media/useImageCropper.tsx`

Promise-based hook so each call site changes by one line instead of growing pending-file state:

```ts
const { cropDialog, requestCrop } = useImageCropper(CROP_SPECS.avatar, { title, description });
// in the file input handler:
const cropped = await requestCrop(file);   // resolves null on cancel
if (!cropped) return;
await uploadImage(cropped, { subfolder: "avatars" });
```

`requestCrop` stores the file + resolver in state and renders `cropDialog`; Cancel resolves `null`, Upload resolves the cropped `File`.

**Bypass rule:** `requestCrop` returns the input file unchanged, without opening the modal, when `file.type === "image/svg+xml"` (workspace logo accepts SVG — vector, nothing to crop, canvas can't reliably rasterize it). Type/size validation still runs first and returns a typed error rather than opening the modal.

## Call sites to update

Each keeps its existing `uploadImage` / `uploadAsset` call — only the file handed in changes.

- `app/[locale]/(app)/settings/account/_panel.tsx` — avatar (`handleFile`, ~line 101)
- `app/[locale]/(app)/settings/workspace/_business-form.tsx` — workspace logo (~line 112)
- `app/[locale]/(app)/settings/public-page/_form.tsx` — three: logo (~203), site icon (~249), OG image (~304)
- `app/[locale]/(app)/portfolio/_components/HeaderPanelDialog.tsx` — header logo (~206)
- `app/[locale]/(app)/portfolio/_components/StoryPromptDialog.tsx` — logo (~320), site icon (~353)

**Not touched** (gallery, free aspect, bulk): `lib/page-builder/galleryPicker/MediaPicker.tsx`, `EditCollectionDialog.tsx`, `CreateCollectionDialog.tsx`, `portfolio/_components/DemoImagePicker.tsx`.

## Cleanup this change creates

- `uploadAsset`'s `maxWidth` / `maxHeight` / `requireSquare` fields become dead once the five cropper call sites stop passing them — the cropper now guarantees what they claimed to. Remove the three fields from `AssetValidationConstraints` and delete the stale "accepted but unused" comment at `lib/storage/uploadAsset.client.ts:48-56`.
- Leave `photoSpec.ts`'s `minShortSide` / `validatePhotoDimensions` / `validatePhotoMeta` alone — they still gate the untouched gallery path and the `/api/portfolio/gallery/items` route.

## i18n

New keys under `common.imageCropper` in all five locales (`en`, `fil`, `id`, `ar`, `th`): `title`, `zoom`, `cancel`, `upload`, `uploading`, `hintFixed` (ICU with an aspect label), `hintFree`, plus error strings `typeNotAccepted` / `fileTooLarge`. RTL: the cropper canvas itself must not flip — set `dir="ltr"` on the crop container so drag direction stays natural in Arabic; the header/footer follow document direction and use logical `ms-*`/`me-*` utilities.

## Tests

- `lib/media/cropImage.test.ts` — cap enforcement (downscale to `maxWidth`, preserve aspect, never upscale a small crop), `null` caps leave native size, output MIME is `image/webp`. Mock `createImageBitmap` + `canvas.toBlob` under happy-dom.
- `lib/media/useImageCropper.test.tsx` — resolves `null` on cancel, resolves a `File` on confirm, SVG bypasses the modal entirely, oversized file returns an error without opening.
- `components/ui/image-cropper-dialog.test.tsx` — renders header/cropper/footer, Upload disabled while encoding.

## Verification

1. `pnpm add react-easy-crop`
2. `pnpm test --run cropImage useImageCropper image-cropper` then `pnpm exec eslint` on touched files.
3. Orchestrator-only, one at a time: `tsc --noEmit` (the TS worker in a full `next build` crashes on this box).
4. Playwright at 375 / 768 / 1280:
   - Settings -> Account: pick a wide photo for the avatar -> modal opens with a round 1:1 crop -> drag + zoom -> Upload -> avatar renders square and uncropped-looking. Confirm pinch-zoom works at 375px.
   - Settings -> Workspace: pick an SVG logo -> uploads directly, no modal.
   - Settings -> Public page: OG image -> 1.91:1 locked crop.
   - Portfolio -> Header panel: logo -> free-aspect crop, output capped at 1024x512.
   - Gallery picker: drop 3 photos -> no modal, all three upload as before (regression check).
   - Cancel path: modal closes, no upload fires, same file re-selectable.
   - Arabic locale: modal header/buttons RTL, crop drag direction still natural.
5. Confirm in DevTools Network that the uploaded blob is `image/webp` and smaller than the source.

## Out of scope

Rotate/flip controls, re-cropping an already-uploaded image, and per-photo crop in the gallery grid. Add if asked.
