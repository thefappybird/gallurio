# Portfolio follow-up fixes handoff

Last updated: 2026-07-01

Purpose: fast inheritance doc for next agent. This is a polish/correctness pass on top of current Gallurio branch + open PR. Keep fixes minimal. Reuse existing systems. Shared Puck config still powers editor + public render, so block/render edits affect live pages too.

## Status summary

### Completed in first pass

- [x] Foreground-selected fill parity for floated editor toggles
  - `app/[locale]/(app)/portfolio/_components/HeaderPanelDialog.tsx`
  - `app/[locale]/(app)/portfolio/_components/ContactPanelDialog.tsx`
  - `app/[locale]/(app)/portfolio/_components/HeaderPanelDialog.test.tsx`
  - `app/[locale]/(app)/portfolio/_components/ContactPanelDialog.test.tsx`
  - Done:
    - effective default toggle buttons in Navigation and Contact Form no longer dim themselves
    - floated/effective selected states now use same off-white selected fill as adjacent segmented controls

- [x] Publish dialog simplification + QR rework
  - `app/[locale]/(app)/portfolio/_components/PublishDialog.tsx`
  - `app/[locale]/(app)/portfolio/_components/PublishDialog.test.tsx`
  - Done:
    - single slug input surface
    - save/reset icon controls only when slug changed
    - debounced unsaved-slug detection
    - copy action from same surface
    - QR moved into toggleable drawer
    - QR layout vertical + centered
    - full read-only URL shown below validation/status area
    - full URL updates live while typing
    - QR payload follows live URL
    - long custom-domain/full-URL text now stays inside modal via clipped input row + horizontal scroll on full URL text
  - Verified:
    - `pnpm vitest "app/[locale]/(app)/portfolio/_components/PublishDialog.test.tsx"`

- [x] Inquiry booking-detail notes must stay read-only
  - `app/[locale]/(app)/bookings/_components/booking-detail-modal.tsx`
  - `app/[locale]/(app)/bookings/_components/booking-detail-modal.test.tsx`
  - Done: notes editor now receives `readOnly` in inquiry booking-detail flow, so edit control no longer appears there.

- [x] Arabic direction control removed
  - `app/[locale]/(app)/portfolio/_components/PortfolioLanguageControl.tsx`
  - `app/[locale]/(app)/portfolio/_components/PortfolioLanguageControl.test.tsx`
  - `app/[locale]/(app)/portfolio/_components/EditorShell.tsx`
  - Done:
    - removed RTL/LTR toggle UI
    - Arabic selection now forces RTL from editor state path
    - language control now also appears in non-Puck canvas tabs via shared preview controls cluster

- [x] Translation button/control on non-Puck tabs
  - `app/[locale]/(app)/portfolio/_components/EditorShell.tsx`
  - Done: same language control now present for Featured / Navigation / Contact Form side-panel views, not only Puck canvas tabs.

- [x] Notification badge text color
  - `components/app/app-sidebar.tsx`
  - `components/app/app-sidebar.test.tsx`
  - Done: destructive badge keeps white text on red background.

- [x] New-notification popup near bell
  - `components/app/app-sidebar.tsx`
  - `components/app/app-sidebar.test.tsx`
  - Done:
    - popup rendered beside bell
    - LTR opens to right of bell
    - RTL opens to left of bell

- [x] Public contact form date/time picker icon color parity
  - `app/(public)/w/[orgSlug]/_components/ContactForm.tsx`
  - `app/(public)/w/[orgSlug]/_components/ContactForm.test.tsx`
  - Done: public contact-form date/time picker icons now follow text color styling.

## Remaining task backlog

- [ ] Background-image thumbnails in picker/editor do not survive reload
  - Likely files:
    - `lib/page-builder/galleryPicker/MediaField.tsx`
    - `lib/page-builder/galleryPicker/usePickerData.ts`
    - block files that persist selected background images
  - Goal: find cache/data-shape mismatch causing selected background images to render `?` after reload.

- [ ] Background image still dark at `100%` opacity
  - Likely shared cause with style toolkit / block background layering.
  - Check for scrim, color-mix, duplicate opacity layer, preview/public mismatch.

- [ ] Font control redundant input + dropdown
  - Likely files:
    - `lib/page-builder/StyleToolkitField.tsx`
    - `lib/page-builder/toolbarPrimitives.tsx`
    - `lib/page-builder/styleToolkit.ts`
  - Goal: one input surface only. Dropdown becomes input.

- [ ] Video block still has unwanted framing
  - Likely file:
    - `lib/page-builder/blocks/VideoBlock.tsx`
  - Goal: no extra padding/margin around embedded video.

- [ ] Masonry still too similar to grid
  - Likely files:
    - `lib/page-builder/blocks/GalleryGridBlock.tsx`
    - `lib/page-builder/blocks/GalleryMasonryBlock.tsx`
  - Goal: masonry visibly distinct while preserving current block model.

- [ ] Real image/photo placeholders across portfolio/gallery/media surfaces
  - Likely files:
    - gallery/media picker surfaces
    - public gallery / featured / block renderers
  - Goal: no blank empty regions while images load.

- [ ] Contact form header translation hookup
  - Likely files:
    - `app/[locale]/(app)/portfolio/_components/ContactFormPreview.tsx`
    - related contact-form preview/public render path
  - Goal: missing translated header copy wired correctly across locales.

## New backlog added after first pass

- [ ] Time format parity across booking/contact surfaces
  - User-added backlog item.
  - Surfaces:
    - inquiry booking detail
    - edit booking modal
    - create booking modal
    - public contact form date picker / time picker
  - Constraint: calendar candles already use user's saved time format. These modal/public surfaces must match that same setting.

## Verification already run in first pass

- `pnpm vitest "app/[locale]/(app)/portfolio/_components/HeaderPanelDialog.test.tsx"`
- `pnpm vitest "app/[locale]/(app)/portfolio/_components/ContactFormPreview.test.tsx"`
- `pnpm vitest --root C:/Users/Alex/Desktop/Projects/gallurio "app/(public)/w/[orgSlug]/_components/ContactForm.test.tsx"`
- `pnpm vitest "app/[locale]/(app)/portfolio/_components/PublishDialog.test.tsx"`
- `pnpm vitest "app/[locale]/(app)/bookings/_components/booking-detail-modal.test.tsx"`
- `pnpm vitest "components/app/app-sidebar.test.tsx"`
- `pnpm typecheck`
- `pnpm lint`

## Next-agent guidance

- Start with active-style bug + time-format backlog if continuing same UX batch.
- For active-style bug, inspect both editor control effective-state UI and public/rendered style logic together; current failure looks shared, not isolated.
- Keep locale changes in sync where copy changes are needed: `en`, `fil`, `ms`, `id`, `ar`.
- Preserve effective-default behavior unless bug truly requires grounding explicit values.
