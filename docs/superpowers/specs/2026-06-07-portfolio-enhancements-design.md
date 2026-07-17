# Portfolio Enhancements Implementation Spec

## Context

Improve Gallurio portfolio inquiry, preview, gallery authoring, and email flows.

Keep existing architecture:

- Public portfolio route: `/w/[orgSlug]`
- Source of truth: `Workspace.publicPage`
- Composition: Puck
- Inquiry submission remains one server transaction creating:
  - inquiry
  - booking draft
  - client

Do not introduce parallel portfolio/page systems.

---

## Goals

Implement:

1. Better public inquiry data capture
2. Preview parity with unpublished local editor state
3. Cleaner gallery block responsibilities
4. Owner/client inquiry emails
5. Inquiry UI/status consistency
6. Required tests and locale updates

---

## Non-Goals

Do not implement:

- Localized client confirmation emails
- Interactive location picker inside editor preview
- New public-page collections
- Custom sender domains

Client confirmation email stays English-only.

---

# 1. Public Inquiry Form

## Required form changes

Update public contact modal/form:

- Add required `eventTitle`
- Replace plain phone field with shared intl phone input
- Replace plain location text input with shared `LocationPicker`
- Remove `guestCount`
- First tab CTA: `Continue`
- Final booking tab CTA: `Send inquiry`
- Make sure the locales used exist across the form, i see this raw i18n key in the form: 'publicPage.inquiryForm.sessionLabel'

Tabs remain:

- Tab 1: client details
- Tab 2: booking details

Validation must still switch to the first tab containing an error.

## Inquiry payload/model

Add `eventTitle`.

Remove `guestCount` from public inquiry path.

Persist structured location data compatible with booking location data.

Preferred shape, unless existing `LocationPicker`/booking model already defines another:

```ts
location: {
  label: string | null;
  address: string | null;
  placeId?: string | null;
  lat?: number | null;
  lng?: number | null;
}
```

Use existing picker output conventions. Do not invent a second incompatible location shape.

## Draft booking creation

On successful inquiry submission:

- booking title = submitted `eventTitle`
- booking client = submitted/matched client
- booking location = structured inquiry location
- inquiry source = `portfolio`

Do not flatten location into a guessed string before creating the booking.

---

# 2. Inquiry Inbox/UI

Update inquiry table:

- Add `event title` column
- Show portfolio inquiry source as `portfolio`
- Display `converted` as `booked` in user-facing inquiry UI

If changing the persisted enum from `converted` to `booked` is low-risk, do it.
Otherwise keep stored enum stable and translate at the UI boundary.

All visible copy for this flow should say `booked`.

---

# 3. Contact Styling

Add contact config field:

```ts
errorMessageColor
```

Behavior:

- Supports brand-token value or custom hex like existing contact colors
- Applies to public inquiry validation messages
- Applies to preview validation rendering
- Falls back to current safe/destructive styling when unset

Validation messages affected:

- client-side field errors
- server/root form errors shown inside form
- preview form error states

---

# 4. Logo Uploader

Keep existing limits:

- PNG, JPEG, WEBP only
- max 250 KB
- max 512x256

Change behavior:

- validation errors render inline below uploader
- upload/API/transport failures remain toast-based
- UI copy must clearly show file limits near uploader

---

# 5. Preview Parity

## Problem

Editor stores unpublished state in browser/local storage, but preview route reads DB-backed draft state. This causes stale previews.

## Required behavior

Preview mode must render the full browser-local draft state, including:

- zones
- contact config
- header config
- form locale
- theme/brand state

Implementation guidance:

- Pass serialized local draft payload to preview route
- Preview route prefers explicit local draft payload
- DB draft remains fallback when no local payload exists
- Keep route owner-only and noindex

Avoid sending unnecessary duplicated state.

---

# 6. Contact Preview

Replace placeholder contact preview with actual form structure.

Preview should render:

- same fields
- same tabs
- same button placement
- same labels
- same resolved colors/styles

Preview behavior:

- tab switching works
- submit/action buttons are disabled or inert
- location selector does not need full functionality
- no real submission happens

---

# 7. Preview Mode Editor Behavior

When entering preview mode from header/contact editing:

- close header/contact side editing views
- set active editor section to `home`
- hide header/contact edit-only tabs while preview is active

Remove sidebar footer buttons:

- `Done`
- `Cancel`

Reason: publish is the real commit action.

---

# 8. Gallery Block Restructure

## Gallery-only blocks

Make these blocks gallery-only:

- `GalleryGrid`
- `GalleryMasonry`
- `FeaturedWork`

Remove from them:

- heading props
- description props
- footer props
- surrounding text responsibilities

Authors should compose text manually with other blocks.

## Gallery bundle presets

Add composed gallery presets that insert:

- container/section
- heading block
- text block
- gallery block

Skip footer in this pass.

Implement as preset compositions, not a new data model.

## Carousel exception

`GalleryCarousel` keeps:

- `heading`
- `description`

But render them as foreground overlay content on the carousel imagery.

Remove carousel footer.

Treat carousel as hero/storytelling surface, not plain gallery with text around it.

## Human-readable preview names

Where gallery previews show raw IDs, replace with readable labels:

- collection name instead of `collectionId`
- best available item/gallery label instead of raw storage IDs

Use existing picker endpoint/name data where possible.

---

# 9. Email Flow

After successful inquiry submission, send two best-effort emails.

## Client confirmation email

Send English-only confirmation email to client.

Requirements:

- via Resend
- from Gallurio verified sender
- `reply-to` = portfolio owner email
- copy should feel like an acknowledgment from the business
- confirms receipt
- says owner will respond soon

## Owner action email

Send owner notification email.

Include:

- who inquired
- inquiry basics
- action button: `View Inquiry`

Deep link must land owner on target inquiry after auth.

Use either:

- `/inquiries?[query]`
- `/inquiries/[id]`

Pick whichever route supports direct open/modal behavior best.

If direct inquiry modal/detail opening is required, implement route support explicitly.

## Auth redirect

Use Clerk redirect mechanics so sign-in returns owner to intended inquiry URL.

Do not redirect owner to dashboard first.

## Email failure behavior

Email delivery is best-effort.

Rules:

- Inquiry/client/booking transaction must still succeed if email fails
- Email failure must not roll back inquiry transaction
- Missing `RESEND_API_KEY` must be logged/resulted as explicit skipped delivery
- Cover success, skipped, and failed branches in tests

---

# 10. Consistency Fixes

Also implement:

- active-link opacity affects only active background/highlight, not text color
- portfolio inquiry source displays as `portfolio`, not `direct`
- carousel footer removed
- user-facing inquiry status copy says `booked`
- related docs/tests updated where this flow is described

---

# 11. Expected Files

Likely affected surfaces.

## Public inquiry

- `app/(public)/w/[orgSlug]/_components/ContactForm.tsx`
- `app/(public)/w/[orgSlug]/_components/ContactModal.tsx`
- `app/api/inquiries/route.ts`
- `lib/server/inquirySubmission.ts`
- `lib/validators/inquiry.ts`
- `lib/db/models/Inquiry.ts`
- `lib/db/models/Booking.ts`
- `lib/email/inquiryNotification.ts`
- `lib/email/send.ts`
- add client confirmation email module if needed

## Inquiry inbox

- `app/[locale]/(app)/inquiries/page.tsx`
- `app/[locale]/(app)/inquiries/_components/inquiry-table.tsx`
- status badge/copy components

## Portfolio editor/preview

- `app/[locale]/(app)/portfolio/_components/EditorShell.tsx`
- `app/[locale]/portfolio-preview/page.tsx`
- `app/[locale]/(app)/portfolio/_components/ContactFormPreview.tsx`
- `app/[locale]/(app)/portfolio/_components/ContactPanelDialog.tsx`
- `app/[locale]/(app)/portfolio/_components/HeaderPanelDialog.tsx`
- `lib/validators/publicPage.ts`

## Gallery authoring

- `lib/page-builder/editorConfig.tsx`
- `lib/page-builder/config.ts`
- `lib/page-builder/blockCategories.ts`
- `lib/page-builder/blocks/GalleryGridBlock.tsx`
- `lib/page-builder/blocks/GalleryMasonryBlock.tsx`
- `lib/page-builder/blocks/GalleryCarouselBlock.tsx`
- `lib/page-builder/blocks/FeaturedWorkBlock.tsx`
- `lib/page-builder/blocks/sectionPresets.ts`
- `lib/page-builder/templates/*`
- `lib/page-builder/seedPortfolio.ts`

## Locales

Maintain app/editor/public copy parity for:

- `en`
- `fil`
- `ms`
- `id`

Client confirmation email is English-only.

---

# 12. Testing Requirements

Use test-first implementation where practical.

## Inquiry validator/submission tests

Cover:

- `eventTitle` required
- `eventTitle` persisted
- `guestCount` removed from public inquiry payload
- structured location parses/persists
- draft booking title uses `eventTitle`
- phone normalization/validation matches expected server payload
- source becomes `portfolio`

## Email tests

Cover:

- owner notification best-effort send
- client confirmation best-effort send
- missing API key produces explicit skipped result/log
- delivery failure does not fail inquiry submission
- owner email deep link includes correct post-auth destination

## Preview/editor tests

Cover:

- preview route prefers local draft payload over DB state
- contact preview renders actual form structure
- entering preview exits header/contact panel editing
- active editor section returns to `home`
- edit-only header/contact tabs hidden during preview
- removed `Done`/`Cancel` buttons no longer render

## Gallery tests

Cover:

- grid/masonry/featured render without text props
- carousel renders foreground overlay text
- carousel footer removed
- bundle presets create intended block composition
- previews show readable collection/gallery names, not raw IDs

## Locale tests

Update locale parity tests for new keys.

---

# 13. Required Verification

Before completion, run:

```bash
pnpm typecheck
pnpm lint
```

Run affected tests.

Run build before merge unless explicitly deferred.

If this repo uses `rtk-ai/rtk`, prefer token-efficient commands where applicable, for example:

```bash
rtk git diff
rtk pnpm typecheck
rtk pnpm lint
rtk pnpm test
```

Use the repo's actual available `rtk` commands. Do not assume unsupported aliases.

---

# 14. Acceptance Criteria

Done when:

- Inquiry form captures `eventTitle`
- Inquiry form uses intl phone input
- Inquiry form uses structured location picker data
- `guestCount` is removed from public inquiry flow
- Draft booking title uses `eventTitle`
- Inquiry table shows event title
- Portfolio inquiry source displays as `portfolio`
- User-facing inquiry status says `booked`
- Preview reflects full local draft state
- Contact preview uses real form shape with inert actions
- Preview mode exits header/contact editing and returns to `home`
- Header/contact sidebars no longer show fake `Done`/`Cancel` actions
- `errorMessageColor` controls validation error color
- Logo uploader shows inline validation errors
- Gallery grid/masonry/featured are gallery-only
- Gallery bundle presets exist
- Carousel text overlays imagery
- Carousel footer is removed
- Client confirmation email sends best-effort
- Owner action email sends best-effort
- Owner email deep link survives auth and lands on intended inquiry
- Required tests pass
- Typecheck passes
- Lint passes

---

# 15. Documentation Follow-Up

Update `docs/booking-inquiry-lifecycle.md` to match shipped behavior for:

- inquiry status wording
- email count
- booking title expectations
- portfolio inquiry source
