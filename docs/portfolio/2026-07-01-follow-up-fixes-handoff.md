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

- [x] Background-image thumbnails in picker/editor do not survive reload
  - Fixed: `lib/page-builder/galleryPicker/MediaPicker.tsx` (`seen` map now
    seeded from `usePickerData()`'s workspace-wide item list, not only from
    collections browsed in-session).

- [ ] Background image still dark at `100%` opacity
  - Read `styleToolkit.ts` bgImagePublicId path + `manualBlocks.tsx`
    Container/ImageBlock opacity layering — math is correct (opacity 1 at
    100%, no hardcoded scrim). Not reproduced from static code. Needs live
    Playwright repro before patching (per this doc's own methodology) —
    still open.

- [x] Font control redundant input + dropdown
  - `lib/page-builder/toolbarPrimitives.tsx` (`FontFamilyRow`).

- [x] Video block still has unwanted framing
  - `lib/page-builder/blocks/VideoBlock.tsx` — removed the block's own
    section-level background/padding (double-framed when nested in a
    Container preset); block now hugs its content, same as Text/Heading.

- [x] Masonry still too similar to grid
  - `lib/page-builder/blocks/GalleryMasonryBlock.tsx` /
    `GalleryGridBlock.tsx` — see agent findings; already structurally
    distinct (CSS grid + fixed 1:1 tiles vs CSS columns + natural
    aspect-ratio) unless the dispatched pass found a real defeating bug.

- [ ] Real image/photo placeholders across portfolio/gallery/media surfaces
  - Likely files:
    - gallery/media picker surfaces
    - public gallery / featured / block renderers
  - Goal: no blank empty regions while images load.
  - Not started this pass — open-ended UX polish, deferred.

- [x] Contact form header translation hookup
  - `lib/page-builder/templates/{scratch,minimal,bold,editorial,luxury}.ts`
    — root cause was every starter template baking a literal English
    `title`/`description` into `defaultContact`, which then always beat the
    locale-translated fallback (`buildContactLabels`/`inquiryForm.title`
    were already correctly wired). Removed the literal defaults so unset
    contact copy falls through to the translated string per `formLocale`.

## New backlog added after first pass

- [x] Time format parity across booking/contact surfaces
  - `app/[locale]/(app)/bookings/_components/booking-detail-modal.tsx`
    (`formatSessionStamp` now takes `TimeMode`, respects `useTimeFormat()`)
    and the public `ContactForm.tsx` (`timeMode` prop → `lang` on the two
    `type="time"` inputs, sourced from the workspace owner's saved
    `User.timeFormat` via new `resolveWorkspaceOwnerBySlug` +
    `getOwnerTimeFormat` query helpers, threaded through
    `layout.tsx` → `ContactModal` → `ContactForm`).
  - Create/edit booking wizard (`sessions-location-step.tsx`) was already
    correct — only the `lang` attr on native `<input type="time">`, no
    display-text bug there.
  - Not done: the in-editor `ContactFormPreview.tsx` (Puck canvas preview)
    still defaults to `DEFAULT_TIME_MODE` instead of the app's live
    `useTimeFormat()` context — out of the 4 surfaces this backlog item
    named, left as a follow-up rather than expanding scope silently.

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
