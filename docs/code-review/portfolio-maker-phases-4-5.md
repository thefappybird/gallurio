# Code Review — Portfolio Maker Phases 4 & 5

**Date:** 2026-05-28
**Scope:** `dd54aba..HEAD` (8 commits) — public Gallery page + gallery blocks (Phase 4) and config-driven contact modal/form + i18n (Phase 5).
**Reviewer:** Senior code-review gate (pre-merge to `dev`).

## Files reviewed

- `app/(public)/w/[orgSlug]/gallery/page.tsx`, `layout.tsx`
- `app/(public)/w/[orgSlug]/_components/{ContactModal,ContactForm,ContactConfirmation,PortfolioHeader,buildContactLabels}.{tsx,ts}` + tests
- `lib/page-builder/blocks/{GalleryMasonryBlock,GalleryCarouselBlock,GalleryCarouselClient,FeaturedWorkBlock}.tsx` + tests
- `lib/page-builder/{config.ts,types.ts,contactTrigger.client.tsx,serverContext.tsx,__fixtures__/homeData.ts}`
- `lib/db/queries/gallery.ts` + test
- `lib/hooks/useGlobalContactTrigger.ts`
- `lib/validators/{inquiry,publicPage}.ts` + tests
- `lib/db/models/Workspace.ts`
- `messages/{en,fil,ms,id}.json`

**Verification run:** `pnpm typecheck` passes clean; full `pnpm test` passes (1102 tests, 100 files).

---

## Verdict: SHIP WITH FIXES

Multi-tenant isolation is genuinely strong — the data layer re-validates `workspaceId` from server render context on every path, private/foreign collections render empty, and that behavior is covered by mandatory isolation tests. Brand-kit `--pf-*` scoping is respected throughout the public subtree. The blocking item is one real correctness bug in `FeaturedWorkBlock` where the Puck editor field shape does not match what the component consumes, so the block will be permanently empty in production despite passing tests. Fix that (High #1) plus the i18n gap (High #2) before merge; the rest can follow.

**Findings:** Critical 0 · High 2 · Medium 4 · Low/Nits 5

---

## High

### H1 — `FeaturedWorkBlock` array field shape mismatch → block always empty in production
**File:** `lib/page-builder/blocks/FeaturedWorkBlock.tsx:168-177` (field config) vs `:31-50` (consumer); `lib/db/queries/gallery.ts:96-98`.

The Puck field is declared as an `array` with `arrayFields: { id: { type: "text" } }`. Puck stores `array` fields as an array of **objects** — i.e. `itemIds` round-trips through the editor/DB as `Array<{ id: string }>`. But the component treats `itemIds` as a flat `string[]` and passes it straight to `getItemsByIds`, whose validity filter is `typeof id === "string" && Types.ObjectId.isValid(id)` (`gallery.ts:97`). Every entry is an object, so **all** ids are dropped and the block renders "No featured photos selected yet." forever once an owner actually selects images in the editor.

The block's own comment (`:175-176`) acknowledges the gap — *"Stored as string[]; Puck array fields hold objects, so we expose a single text field per row and map at the edges. See getArrayItemLabel."* — but no edge-mapping (`getArrayItemLabel` or a prop transform) exists anywhere in the diff or in `config.ts`.

**Why tests miss it:** `FeaturedWorkBlock.test.tsx` and the fixture (`homeData.ts:71-77`, `itemIds: []`) call the component with a hand-built `string[]`, bypassing Puck's object wrapping. The populated editor path is never exercised.

**Why it matters:** A headline gallery block silently never works for tenants. Contrast `ServicesListBlock` (`homeData.ts:84-91`) which correctly stores/consumes `Array<{title,description,priceFrom}>` objects.

**Fix (pick one):**
- Map at the boundary: in `FeaturedWorkBlock`, normalize `const ids = (Array.isArray(itemIds) ? itemIds : []).map(x => typeof x === "string" ? x : x?.id).filter(Boolean)`. Update the `FeaturedWorkProps` type and tests to assert the object-array shape Puck actually produces.
- Or change the field to a plain repeatable text input that yields `string[]` if Puck supports it for your version — but verify the stored shape, don't assume.
Add a test that feeds the **exact** shape Puck persists (`itemIds: [{ id }]`) and asserts images render.

### H2 — New gallery-block UI strings are hardcoded English, not localized
**Files:** `GalleryMasonryBlock.tsx:59,63,75,79,144` (empty/error states); `GalleryCarouselBlock.tsx:46,50,62,66` (empty/error states); `GalleryCarouselClient.tsx:133` ("Swipe or use the arrows to browse"), `:145` (`aria-label` "Previous/Next image"); `PortfolioHeader.tsx:57` (`aria-label="Portfolio"`).

CLAUDE.md is explicit: *"All active locales update together. A feature with English-only strings is unfinished."* The contact modal/form correctly resolve every string through `publicPage.inquiryForm`/`publicPage.nav` (verified consistent across all 4 active catalogs), but the Phase 4 gallery blocks bake English directly into JSX — including user-visible empty states and screen-reader `aria-label`s. On a `fil`/`id`/`ms` portfolio these render English.

The established pattern is in place to follow: server blocks read pre-resolved strings off the render context (`serverContext.tsx` already carries `chrome`). The carousel/caption strings and aria-labels should be threaded the same way (extend the `chrome` payload or pass labels as props from the page boundary).

**Why it matters:** Breaks the i18n contract for the public portfolio, which deliberately renders in the *workspace's* locale; SEA-market tenants ship mixed-language pages.

**Fix:** Add `publicPage.chrome.gallery*` keys (empty/error/swipe-hint/prev/next/nav-label) to all 5 catalogs and resolve them at the page/layout boundary, passing into the blocks via the render context — never hardcode in the block JSX.

---

## Medium

### M1 — Fixed column count is not responsive; cramped at 375px
**Files:** `FeaturedWorkBlock.tsx:107` (`gridTemplateColumns: repeat(${items.length}, 1fr)`); `GalleryMasonryBlock.tsx:95` (`columnCount: columns`).

Both force their full column count at every viewport. `FeaturedWork` with 3 items renders three side-by-side columns even at 375px (≈110px each minus gaps — unusably small portraits). `GalleryMasonry` honors the configured 3–4 columns on mobile too. CLAUDE.md mandates building/verifying at 375px first; `GalleryGridBlock` shares this trait but is pre-existing/out of scope.

**Why it matters:** Mobile-first is non-negotiable here, and the public portfolio is the primary conversion surface — most traffic is mobile.

**Fix:** Use a responsive clamp — e.g. a media query in an embedded `<style>` (the components already use that technique in `ContactModal`/`PortfolioHeader`) dropping FeaturedWork to 1 column and masonry to 1–2 columns below `640px`. Inline `style` alone cannot express breakpoints.

### M2 — Public interactive controls lack paired `:focus-visible`/`:hover` feedback
**Files:** `GalleryCarouselClient.tsx:142-168` (prev/next buttons), `PortfolioHeader.tsx:149-214` (links + contact button + hamburger), `ContactModal.tsx:103-122` (close), `ContactForm.tsx` (add/remove-session buttons, submit).

All of these are styled with inline `style={{}}`, which cannot express `:hover`/`:focus-visible`/`:active`. CLAUDE.md requires every interactive control to ship idle/hover/focus-visible(paired)/active/disabled, and never `hover:` without `focus-visible:`. Keyboard users get the browser default outline only (and some buttons may suppress it via `outline:none` on the modal popup). Touch tap-state is also absent.

**Why it matters:** Accessibility ("part of done, not a follow-up") and the four-states rule. The carousel buttons in particular are the only way to advance for keyboard users.

**Fix:** Move the interactive control styles into the existing embedded `<style>` blocks (or a CSS module) with explicit `:hover`, `:focus-visible`, and `:active` rules using `--pf-*` tokens. At minimum guarantee a visible focus ring on every control.

### M3 — Submit-time validation errors on the inactive tab are invisible
**File:** `ContactForm.tsx:172-187`, field errors at `:311,341,418`.

The form has two tabs (client / booking). If the user submits from Tab 1 while Tab 2 fields (`sessions`, `description`, `eventType`) are invalid, `react-hook-form` sets the errors but they live in the hidden `TabsPanel`. The user sees no inline error and only the generic root error fires on a *server* failure — not on client validation failure, where `onSubmit` never runs. The result is a submit button that appears to do nothing.

**Why it matters:** Recoverable error state is one of the four required async states; a dead-feeling submit is a conversion killer on the primary inquiry path.

**Fix:** On invalid submit, switch the active tab to the first tab containing an error (drive `Tabs` `value` from state and inspect `errors`), or surface a summary near the submit button listing which tab needs attention. Add a test covering "submit with a Tab 2 error while Tab 1 is active."

### M4 — Touch targets under the 44px minimum
**Files:** `ContactModal.tsx:106-107` (close button 40×40), `ContactForm.tsx:284` (remove-session 32px min-height), `:354` (add-session 40px), `PortfolioHeader.tsx` close glyph uses 40px in some spots.

CLAUDE.md sets ≥44px for tappable controls. The modal close (40px) and the remove-session button (32px) are below that; the remove-session control is especially small for a touch target sitting next to other tappable inputs.

**Why it matters:** Touch ergonomics on the 375px-first surface; the close button is a primary affordance.

**Fix:** Bump close to 44×44 and the session add/remove controls to ≥44px min-height (icon-only remove can keep a compact visual but needs a 44px hit area via padding).

---

## Low / Nits

### L1 — `inquirySessionSchema` "today" uses server local time
`lib/validators/inquiry.ts:28-34,60` — `todayIso()` is computed from server local time, while time-of-day is later converted with the workspace timezone in `inquirySessionsToBookingSessions`. A booking at 00:00–02:00 workspace-local near the date boundary could be rejected/accepted off-by-one relative to the tenant's calendar. Low impact (date floor only) but worth a note; consider deriving "today" in the workspace tz when the API wires this up in Phase 6.

### L2 — Masonry thumbnail forced to 2× tall aspect
`GalleryMasonryBlock.tsx:100-104` requests `height: thumbWidth * 2` with `crop: "limit"`. `limit` preserves aspect so this is only an upper bound, but the intent reads oddly; a short comment ("height cap only; limit preserves aspect") would prevent a future "why 2×?" question.

### L3 — Carousel autoplay has no pause-on-hover/focus
`GalleryCarouselClient.tsx:62-76` — autoplay (when enabled) does not pause on pointer hover or keyboard focus within the track, which is a common WCAG 2.2.2 expectation for moving content. It does correctly respect `prefers-reduced-motion`. Consider pausing on `mouseenter`/`focusin`.

### L4 — `console.error` in blocks is fine, but consider structured context
`GalleryMasonryBlock.tsx:74`, `GalleryCarouselBlock.tsx:61`, `FeaturedWorkBlock.tsx:47` — errors are logged (not swallowed — good, satisfies the no-silent-catch rule) and degrade to empty state. Minor: include `workspaceId`/`collectionId` in the log payload to make production triage possible.

### L5 — `nav aria-label="Portfolio"` duplicates with H2
Covered under H2 but flagged separately for completeness: the landmark label should be localized like the rest of the nav.

---

## What's done well

- **Multi-tenant isolation is exemplary.** `gallery.ts` resolves the collection under `{ _id, workspaceId, isPublic: true }` before fetching items, and `getItemsByIds` filters by `workspaceId` with order preservation. Both have dedicated tenant-isolation tests (`gallery.test.ts:75-99,181-195`), and each block re-derives `workspaceId` from `getRenderWorkspace()` — never from Puck props. The AsyncLocalStorage render context (`serverContext.tsx`) is the right call over a module singleton.
- **Index-backed queries.** `listItemsForBlock`'s `{ workspaceId, collectionId }` + `sort({ order, createdAt })` is backed by the existing `{ workspaceId: 1, collectionId: 1, order: 1 }` compound index.
- **Projections everywhere.** `ITEM_PROJECTION` ships only the seven fields the UI renders; `findPublishedWorkspaceBySlug` selects a narrow field set and is wrapped in React `cache()` so layout + page + metadata dedupe to one round-trip.
- **Validators are thorough.** `inquirySubmissionSchema` has honeypot, date horizon bounds, session min/max, guest-count preprocessing, and UTM capture; `eventTypes` reuse `EVENT_TYPES` from the booking validator (no enum drift — verified all 6 keys match). `buttonColor`/`buttonStyle` are enum-constrained, so the `--pf-color-${buttonColor}` CSS-var interpolation cannot be injected.
- **i18n on the contact surface is complete and consistent** — all 5 catalogs carry identical `publicPage.nav` and `publicPage.inquiryForm` key sets (incl. nested `preferred` and `eventTypes`).
- **Honeypot + a11y on the form** — offscreen `aria-hidden` honeypot off the tab order, labelled inputs, `role="alert"` errors, `aria-live` region for the submit error.
- **Global contact trigger is clean** — single document-level click delegate + a `__gallurioOpenContact` opener with correct unmount cleanup that won't clobber a remount.

---

## Resolution (2026-05-28, post-review fixes)

All High and Medium findings were addressed in this branch before merge; the cheap nits were also fixed.

- **H1 — fixed.** `FeaturedWorkBlock` now normalizes `itemIds` via `normalizeItemIds`, accepting both Puck's stored `{ id }[]` shape and a plain `string[]`. Type widened to `FeaturedWorkItemId[]`; the misleading comment was corrected. New tests feed the exact `[{ id }]` shape and a malformed-object case.
- **H2 — fixed.** All gallery-block strings (empty/no-collection/unavailable/error/featured-empty), the carousel hint + prev/next `aria-label`s, and the `<nav>` landmark are now localized. Added `publicPage.chrome.gallery.*` and `publicPage.nav.navLandmark` to all 5 catalogs; the page boundary resolves them into the render context (`getGalleryChromeLabels()` with English fallbacks), and the carousel server block threads them into its client island. The header landmark comes from `nav.navLandmark`.
- **M1 — fixed.** `FeaturedWorkBlock` collapses to a single column below 640px; `GalleryMasonryBlock` caps to 2 columns below 640px and 1 below 400px (scoped `<style>` with `!important` overriding the inline desktop value).
- **M2 — fixed.** Carousel arrows, header links/contact/hamburger, and the modal close + form buttons now have explicit `:focus-visible` outlines (and `:hover` where relevant) via scoped `<style>` classes using `--pf-*` tokens.
- **M3 — fixed.** The contact form's `Tabs` is now controlled; an invalid submit calls `onInvalid`, which switches to the first tab containing an error so booking-tab validation errors are no longer hidden. Covered by a new test.
- **M4 — fixed.** Modal close (44×44), session add/remove (≥44px), already-compliant header controls verified.
- **L2/L3/L4 — fixed.** Masonry height-cap comment clarified; carousel autoplay now pauses on hover/focus (WCAG 2.2.2) in addition to respecting reduced motion; block `console.error` calls now include `workspaceId`/`collectionId` context.
- **L1 — deferred to Phase 6** (the API boundary): `inquirySessionSchema`'s "today" floor is server-local; deriving it in the workspace timezone belongs with the Phase 6 endpoint that knows the tenant tz. Noted there.

Verification after fixes: `pnpm typecheck` clean, `pnpm lint` 0 errors, affected suites green (64 tests across the touched files).
