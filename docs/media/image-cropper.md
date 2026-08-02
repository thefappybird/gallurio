# Shared image cropper

Status: shipped on `feat/image-cropper`.

## Why

Every image upload surface used to send whatever file the user picked straight to
Cloudflare Images. Each surface carried its own idea of "correct" dimensions, encoded as
`maxWidth` / `maxHeight` / `requireSquare` constraints that `uploadAsset` **accepted but
silently ignored**. Users got rejected for pixel dimensions they could not control, and
images that passed still rendered wrong because their aspect ratio did not match the slot.

A crop modal now runs between file-pick and upload. The user frames the image at the
required aspect, so the output is correct by construction. Validation collapses to file
type + file size on the *input* file — the only things a user can reasonably reason about.

## Shape

| File | Role |
|---|---|
| `lib/media/cropSpecs.ts` | The per-surface spec table + `aspectLabel()`. Replaces `LOGO_*` / `SITE_ICON_*` constants that had been copy-pasted into four components with values that had drifted apart. |
| `lib/media/cropImage.ts` | `cropToFile()` — `createImageBitmap` → canvas → `image/webp` @ 0.92. Plus `webpName()`. |
| `components/ui/image-cropper-dialog.tsx` | The modal, built on `react-easy-crop` and the repo's `Dialog` primitives. |
| `lib/media/useImageCropper.tsx` | Promise-based hook — `requestCrop(file)` resolves `ok` / `cancelled` / `error`. |

### Specs

| Key | aspect | round | max px | max bytes | Surface |
|---|---|---|---|---|---|
| `avatar` | 1:1 | yes | 512×512 | 10 MB | Settings → Account |
| `workspaceLogo` | 1:1 | no | 512×512 | 250 KB | Settings → Workspace (invoice logo) |
| `siteIcon` | 1:1 | no | 512×512 | 1 MB | Favicon — square is mandatory |
| `headerLogo` | free | no | 1024×512 | 250 KB | Portfolio header / public-page logo |
| `ogImage` | 1.9:1 | no | 1200×630 | 10 MB | Social card — aspect fixed by spec |

### Call sites

`settings/account/_panel.tsx` (avatar) · `settings/workspace/_business-form.tsx` (logo) ·
`settings/public-page/_form.tsx` (logo, site icon, OG image) ·
`portfolio/_components/HeaderPanelDialog.tsx` (header logo) ·
`portfolio/_components/StoryPromptDialog.tsx` (logo, site icon).

Each site kept its existing `uploadImage` / `uploadAsset` call — only the file handed in
changed, plus a short gate for the cancel and validation-error paths.

## Decisions worth remembering

- **Output is always `image/webp` at 0.92.** Alpha-safe, smaller than source, one code path.
- **SVG bypasses the modal.** The workspace logo accepts SVG; it is vector, there is nothing
  to crop, and canvas cannot reliably rasterize it. Type and size are still validated first.
- **Gallery is excluded.** Bulk portfolio photo uploads (`MediaPicker`, the collection
  dialogs, `DemoImagePicker`) stay free-aspect with no crop step. `photoSpec.ts`'s
  `minShortSide` floor still gates that path and the `/api/portfolio/gallery/items` route.
- **`react-easy-crop` has no free-rectangle mode.** For the `aspect: null` spec
  (`headerLogo`) the dialog locks the frame to the image's own aspect ratio, read from
  `onMediaLoaded`. The default frame is therefore the whole image — nothing is cropped away
  unless the user zooms or pans. Wordmarks of any proportion survive intact.
- **The crop surface is `dir="ltr"` even in Arabic.** Mirroring it would invert drag
  direction. The dialog's header and footer follow document direction as normal.

## Cleanup this change made

`AssetValidationConstraints` lost `maxWidth`, `maxHeight` and `requireSquare` — the cropper
now guarantees what they claimed to. The `dimensions_too_large` member of
`AssetValidationError` was left in place: it was already unreachable before this change and
several call-site error maps still reference it.

## Verification

- 193 unit/component tests green (`cropImage`, `useImageCropper`, `image-cropper-dialog`,
  the five rewritten call-site suites, `uploadAsset.client`, locale parity + encoding).
- `tsc --noEmit` clean.
- `e2e/image-cropper.spec.ts` drives a real browser: the avatar 1:1 round crop at 375 / 768 /
  1280, keyboard zoom, cancel-then-re-pick-the-same-file, the SVG bypass, free-aspect vs
  locked-aspect hints, Arabic RTL chrome over an LTR crop surface, and proof that the blob
  reaching the uploader is `image/webp` and smaller than the source.

## Known, not fixed here

`settings/workspace` and `settings/public-page` each render two inputs with
`id="logoFile"` — a duplicate DOM id that predates this change and makes `<label for>`
ambiguous. The e2e spec disambiguates on the `accept` attribute instead.

## Out of scope

Rotate/flip controls, re-cropping an already-uploaded image, per-photo crop in the gallery
grid.
