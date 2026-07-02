# Portfolio builder stabilization — phased plan

## Context

`prompt.md` lists 17 UX bugs/enhancements spanning the whole portfolio builder
(editor controls, blocks, notifications, bookings, calendar, the guided tour,
SEO). The ask: investigate the real shared code paths first, then fix
everything in one branch organized into phases, without silently trimming
scope. This plan is the result of dispatching parallel `Explore` agents +
direct reads across every named subsystem (Puck block config, the
effective-default style toolkit, header/contact-form drawers, notifications,
bookings/calendar, the spotlight tour, uploads, publish flow) to pin down
exact files and root causes before writing a line of code.

**Research note on cost**: the 6 explore agents together cost ~470k tokens —
heavier than it should have been, because several agents were given 4-5
bundled sub-questions at "very thorough" breadth with full code-excerpt
reports. The execution phases below correct for this:
- One agent per phase, scoped to files already named in this plan — no
  re-discovery needed; agents receive file:line context inline, not a mandate
  to search.
- No "very thorough" exploration during implementation — the file is named,
  the agent reads it and fixes it.
- Agents report back diffs/results, not reproduced code excerpts.
- Where I can name the exact file myself (most of this plan), skip agent
  dispatch for fact-finding entirely — only delegate the actual edit+test
  work, or fan out when phases are genuinely independent and file-disjoint.
- Phases that touch the same file (noted below) run as one agent / one
  sequential pass, not parallel agents racing on the same file.

This is captured as a standing feedback memory after this plan is approved.

## Backlog addendum

- Time format parity: inquiry modal, edit booking modal, create booking modal,
  and public contact-form date/time pickers still ignore user's saved time
  format setting. Calendar candles already respect the setting, so these
  surfaces need one shared follow-up pass. Acceptance: all booking/contact
  date-time inputs and read views match the same user-selected time format the
  calendar uses.

## Phase ordering & shared-file conflicts

Grouped by file ownership so phases can run in parallel where safe, and
sequentially where they'd collide on the same file:

| Phase | Items | Shared files (run sequentially within a phase) |
|---|---|---|
| A | 1 | `page.tsx`, `gallery/page.tsx` (generateMetadata), `(public)/layout.tsx` |
| B | 2, 3, 4 | `HeaderPanelDialog.tsx`, `ContactPanelDialog.tsx`, `HeaderFormPreview.tsx`, `ContactDetailsBlock.tsx`, locale files |
| C | 5 | `app-sidebar.tsx`, `components/notifications/*`, `globals.css` |
| D | 6 | none (verification only) |
| E | 7 | `settings-user-profile.tsx` |
| F | 8, 9, 12, 15 | `manualBlocks.tsx`, `styleToolkit.ts`, `StyleToolkitField.tsx`, `editorConfig.tsx`, `CollectionPopupChrome.tsx`, `VideoBlock.tsx`, `sectionPresets.ts` |
| G | 10 | `PublishDialog.tsx`, `package.json` (new dep) |
| H | 11 | `fonts.ts`, `portfolio.ts`, `StyleToolkitField.tsx` (font dropdown only — after F lands) |
| I | 13 | `photoSpec.ts`, upload callers |
| J | 14 | Gallery page + `CollectionPopup.tsx` (Lightbox extraction) |
| K | 16 | `booking-calendar.tsx`, `calendar-helpers.ts` |
| L | 17 | `spotlightSteps.ts`, `SpotlightGuide.tsx` |

A, C, D, E, G, I, J, K, L are file-disjoint from each other and from B/F — safe
to run in parallel. B and F are each internally sequential (one agent per
phase, not parallel agents inside it). H runs after F (same
`StyleToolkitField.tsx`, different section, but safer sequenced).

---

## Phase A — Public page SEO/meta locale (item 1)

**Finding**: Public page URLs are already locale-prefix-free (`/w/[orgSlug]`
sits outside the `[locale]` segment, confirmed in `proxy.ts:139-141` — no
`/en/` is ever inserted into routing). The actual gaps:
- `generateMetadata` in `app/(public)/w/[orgSlug]/page.tsx` and
  `gallery/page.tsx` never sets `openGraph.locale`, even though
  `resolvePublicChromeLocale(workspace)` (already imported in `page.tsx` for
  the page body) is available and unused there.
- The document-level `<html lang="en">` is hardcoded in
  `app/(public)/layout.tsx:26` — this is the real "/en/ assumption". It's
  hardcoded because this is the route group's root layout (provides
  `<html>/<body>` for `not-found.tsx` too) and sits *above* `[orgSlug]`, so it
  has no access to the workspace/locale. The inner wrapper div in
  `app/(public)/w/[orgSlug]/layout.tsx:63` already sets `lang={locale}`
  correctly (per the existing public-page-language-isolation design) — this
  is a *document-root* gap, not a content gap.

**Fix**:
1. Add `openGraph.locale` (derived from `resolvePublicChromeLocale(workspace)`)
   to both `generateMetadata` functions.
2. For `<html lang>`: Next.js requires the route group's root layout to
   unconditionally render `<html>/<body>` (so `not-found.tsx` always has a
   shell) — it cannot read `orgSlug`. Lightest correct fix: a small client
   component mounted in `w/[orgSlug]/layout.tsx` that syncs
   `document.documentElement.lang = locale` on mount. Document this
   constraint inline so it isn't "fixed" again by accident later.

**Verify**: unit test `generateMetadata` returns the workspace's locale in
`openGraph.locale` for a non-English workspace; Playwright check of
`document.documentElement.lang` after load on a non-English-locale workspace.

---

## Phase B — Header/nav + contact-form drawer bugs (items 2, 3, 4)

### B1. Locale key bug (item 2)
`EditorShell.tsx:1872-1874` — the featured-work warning modal's Cancel button
calls `t("cancel")`, which doesn't exist in the `app.pageBuilder.editor`
namespace (sibling keys are `featuredPopupWarningTitle/Body/Proceed`). Add
`featuredPopupWarningCancel` to all 5 locale files and reference it.

### B2. Link text color bleeding into header text (item 2)
`HeaderFormPreview.tsx:109-110`:
```
const linkColor = resolveColor(header.linkColor, brandKit, brandKit.foregroundColor);
const brandTextColor = resolveColor(header.brandTextColor, brandKit, linkColor);
```
`brandTextColor`'s fallback is `linkColor` instead of its own independent
default — when `header.brandTextColor` is unset, the brand/logo text
inherits the nav link color. Fix: fall back to `brandKit.foregroundColor`
directly, same as `linkColor` does, so the two stay independent.

### B3. Active-link drawer reorganization (item 2)
`HeaderPanelDialog.tsx:501-573` (`sectionActiveStyle`) currently holds
scale/highlight/underline toggles + active link color + conditional
highlight/underline sub-controls, structurally separate from
`sectionLinks`/`sectionInactiveLinks` (lines 455-498). Move "active link text
color" and the whole active-style block to live alongside the Links drawer,
mirroring how inactive-link styling is organized — i.e. active-link controls
become a sibling/nested group under the same Links drawer instead of a
separate top-level section.

### B4. Floated/effective toggle bug (item 3)
`underline` (`HeaderPanelDialog.tsx` `toggleUnderline`, line 198) and
`subtle` (`ContactPanelDialog.tsx` `toggleSubtle`, line 267) both cycle
`undefined (effective) → false (explicit off) → undefined`. The reference
that works (`activeTabUnderline`/`toggleTabUnderline`, line 262) uses the
**identical** cycle and the **identical** `ToggleButton` component (the
filled/lighter className logic at `HeaderPanelDialog.tsx:118-122` is
byte-identical in both files) — so this is not a comparison-logic bug
visible from static code. Suspect a render-timing/stale-prop issue specific
to where the broken controls sit in their drawer (re-render not propagating
on click, or a memoization boundary), not the toggle math itself.
**This needs Playwright reproduction before a fix is written** — click each
control, screenshot before/after, compare DOM class output against the
working `activeTabUnderline` reference to isolate the actual divergence.

### B5. Contact form style inheritance regression (item 4)
`ContactDetailsBlock.tsx` resolves style via `resolveBlockStyle(_style)`
applied after hardcoded base styles (color, font, etc). Need to trace how
`_style` is threaded from the new contact-form drawer down to this block
post-refactor (likely a missing `_style` merge or a default object replacing
the inherited one when the session/details area moved into a drawer) — read
the drawer's prop-passing in `ContactPanelDialog.tsx` /
`editorConfig.tsx:683-768` against the pre-drawer version in git history to
find exactly what stopped being threaded through. Use the screenshot in
`prompt.md`'s context as the visual acceptance check (no more mismatched
light/default fallback on the session/details area).

**Verify**: unit tests on `HeaderFormPreview`/`ContactDetailsBlock` (props →
CSS), editorConfig parity test, Playwright at 3 breakpoints exercising the
warning modal, nav drawer reorg, toggle clicks, and contact form drawer style
inheritance.

---

## Phase C — Notifications UX (item 5)

**Findings** (cheaper than expected — most of this already exists):
- Bell nudge toast **already exists**: `app-sidebar.tsx:92-200` (`bellNudge`
  animation + `showBellToast` inline toast beside the bell, 2s auto-hide,
  driven by `unreadCount` increasing).
- Reusable debounce hook **already exists**: `lib/hooks/useDebounce.ts`
  (`{debounced, flush}`, configurable delay).
- Highlight text color bug confirmed: `NotificationPopover.tsx` and
  `NotificationsListPage.tsx` use `text-foreground` (dark) on `bg-accent/30`
  or `bg-accent/40` — should be white/light per the task (the unused
  `--accent-foreground` token is also dark, so don't just swap to it — use an
  explicit light/white token consistent with the rest of the destructive/red
  highlight treatment).

**Fix**:
1. Swap highlight text color to white in `NotificationPopover.tsx` and
   `NotificationsListPage.tsx`.
2. Rework `app-sidebar.tsx`'s bell-nudge effect to **bundle**: on
   `notification:new`, start a 5s window via `useDebounce` (delay=5000) that
   accumulates a count instead of firing per-event; show one toast with the
   bundled count ("You have X new notifications") when the window closes;
   don't reset the window on each new arrival within it (use a ref-based
   counter + a single timer armed only on the *first* event of a burst, not
   `useDebounce`'s reset-on-every-call semantics directly — `useDebounce`
   resets the timer each call, which is the wrong primitive for "don't keep
   resetting"; use its `flush`/a plain `setTimeout` armed once instead).
3. Critical: nudge must fire **only** for live `notification:new` socket
   events, never for the initial unread-count fetch on page load — gate on a
   "socket has connected and this is a post-mount event" flag, not just
   `unreadCount` changing (mount populates `unreadCount` too).
4. Mirror the bundled text beside the notifications bell/page per the spec.
5. Fade-out timing: confirm/extend existing 2s auto-hide to whatever "fades
   after the intended display duration" requires (keep at ~2-3s, document the
   number — no spec'd exact value).

**Verify**: unit test the bundling window logic (fake timers: burst of N
events within 5s → one toast with count N, no resets); confirm no toast on
initial load; Playwright manual real-time check if feasible.

---

## Phase D — Bookings deposit validation (item 6)

**Finding**: already implemented. `lib/validators/booking.ts:109-111`
(`bookingCreateSchema`) and `:160-167` (`bookingPatchSchema`) both `.refine`
that `deposit === 0 || total > 0`, with message `"Cannot add a deposit
without setting a price"` wired through react-hook-form +
`event-pricing-step.tsx:186-188` for client-side display, plus the same
schema gating the server routes. CSV import (`bookingImportRowSchema`) also
covered.

**Action**: verify in Playwright that the error actually surfaces clearly in
the booking wizard UI (the task says "Add proper validation and a clear
validation error" — confirm "clear" is met, not just "present"). If the UI
copy/placement is weak, polish it; otherwise this phase is a no-op
confirmation, not a rewrite.

---

## Phase E — Settings sidebar active state (item 7)

**Finding**: `settings-user-profile.tsx:76-93` already implements an active
state (`bg-brand/12` + `text-brand` vs `text-muted-foreground`), driven by
`page.slug === activeSlug`. This contradicts "currently has no active style"
— either already fixed, too visually subtle to register as "active" next to
the main app sidebar's treatment, or `activeSlug` isn't being passed
correctly for one of the settings sub-routes.

**Action**: verify in browser across all settings sub-pages (account,
customize, workspace, public-page, billing, teams, dev-plan). If active
state renders but reads as too subtle, bump contrast to match the main
`app-sidebar.tsx` pattern. If `activeSlug` fails to match for any route,
trace where it's computed/passed from the parent (`[[...catchall]]/page.tsx`)
and fix the slug derivation.

---

## Phase F — Block system: image, video, featured-work modal, bg opacity (items 8, 9, 12, 15)

All four touch `manualBlocks.tsx` / `styleToolkit.ts` / `StyleToolkitField.tsx`
— sequence sub-phases within one agent pass to avoid file collisions.

### F1. Image block redesign (item 8)
Current: `manualBlocks.tsx:209-275`, props `{imagePublicId, imageUrl, alt,
fit}`, no height/width sidebar fields, image rendered as `<img>` not
background. Closest existing pattern: **Container block** (`manualBlocks.tsx
:706-967`) — already supports `backgroundImages[]`, `minHeight` preset +
custom value, padding, and (per Phase F4) will support `bgImageOpacity`.
Redesign: make Image block a Container-like resizable box —
`backgroundImage` CSS (not `<img>`), explicit height/width controls, colSpan/
rowSpan support (reuse `ColSpanRowSpanControls` per
`portfolio-blocks-and-design`), remove the banner-color style field. Reuse
`resolveBlockStyle`'s existing `bgImagePublicId` CSS application
(`styleToolkit.ts:408-415`) rather than inventing a new background mechanism.

### F2. Featured Work modal transparency (item 9)
`CollectionPopupChrome.tsx:51,116` already fall back to `var(--pf-color-bg)`
when `config.backgroundColor` is unset — no missing-fallback bug in this
file. Likely causes to check empirically: `--pf-color-bg` not resolving in
the specific render context the modal mounts into (portal/z-index layering
issue), or `colorTokenToVar` returning an invalid token string for some
stored configs. Reproduce in the editor canvas AND public render before
patching — don't guess a fix blind.

### F3. Video block spacing + composite preset (item 12)
`VideoBlock.tsx:74-173` — `4rem 1.5rem` section padding, `aspectRatio: 16/9`
wrapper. Reduce default vertical padding/min-height so the block hugs its
content; users needing more framing can wrap it in a Container (already
possible, no new feature needed there). For the composite block (header +
description + video), follow the existing `SECTION_PRESETS` pattern
(`sectionPresets.ts`, registered in `editorConfig.tsx:104-129`) — every
existing preset (`HeroPreset`, `AboutPreset`, etc.) is a real `ContainerBlock`
under the hood with curated default slot content, which is what gives it the
**full Container style surface** (background/background-image incl. the new
F4 opacity control, padding, min-height, border, shadow, radius, colSpan/
rowSpan, overlay). The new video preset must follow the same pattern — built
on `ContainerBlock`, not a bespoke wrapper — so its Content/Design/Layout
tabs expose exactly the same style options as every other Container-based
preset, for consistency. Do not give it a narrower, video-specific style
surface.

### F4. Background image opacity (item 15)
No `bgImageOpacity` field exists today (`styleToolkit.ts` `BlockStyle` type,
~line 98). Existing analogous pattern: `overlayOpacity` (a separate scrim
`<div>` layered above the background image, below content —
`manualBlocks.tsx` Container render, ~line 865) — direct CSS
`background-image` opacity would fade content too, which is why the codebase
already avoids it. Add `bgImageOpacity?: number` (0-100, default 100) to
`BlockStyle`, apply it via the same layered-div technique (a dedicated
background-image div with `opacity: bgImageOpacity/100`, separate from any
content/text), wire a Layout-tab `NumberInputRow` that only appears once a
background image is set, on every block that currently supports
`backgroundImages`/`bgImagePublicId` (Container, GalleryGrid, GalleryMasonry,
FeaturedWork, and the redesigned Image block from F1).

**Verify**: block render unit tests (props → CSS) for all four; editorConfig
parity test; Playwright for Image block resize/colSpan, Featured Work modal
background in both canvas and live page, Video block spacing before/after,
background opacity slider on a Container with a background image.

---

## Phase G — Publish modal / QR / URL consolidation (item 10)

**Finding**: `PublishDialog.tsx:110-189` already shows a single URL display
+ copy button (no duplicate save-url/copy-link pair found in current code —
re-verify against the task's framing once in the file, scope may be smaller
than described). No QR library installed (`package.json` has none of
`qrcode`/`react-qr-code`).

**Fix**: add a small QR-generation dependency (`qrcode`, canvas/SVG output,
no server roundtrip needed — generate client-side from the same canonical
published URL already computed in `PublishDialog.tsx`), render it next to
the single URL display, add a download action (PNG/SVG via the lib's
built-in export, not a `.url` file). If a duplicate URL display does turn up
on inspection, collapse it into the one canonical surface.

**Verify**: unit test QR payload equals the published URL; Playwright
download-and-inspect the generated file exists with correct content-type.

---

## Phase H — Google Fonts support (item 11)

**Finding**: current fonts are 8 hardcoded entries loaded via
`next/font/local` (`fonts.ts:17-26`, `portfolio.ts:1-130`), self-hosted woff2
files, exposed as `--font-*` CSS vars consumed by both editor canvas and
public render (`portfolioFontVariables`). `next/font/google` can't serve
this use case directly — it requires build-time-static font names, but font
choice is per-workspace runtime data.

**Fix (per user decision: both curated + free-text, same mechanism)**: load
Google Fonts dynamically via the Google Fonts CSS2 API (`<link
href="https://fonts.googleapis.com/css2?family=...">`, injected per-workspace
in both the editor canvas wrapper and the public layout — same place
`portfolioFontVariables`/brand-kit CSS vars are already applied) rather than
`next/font/google`. Add:
- A curated shortlist (~15-30 names) for the existing font dropdown
  (`StyleToolkitField.tsx` ~line 1020-1048), alongside the 8 self-hosted
  fonts.
- A free-text input for any other Google Fonts family name.
- Both resolve to the same dynamic `<link>` injection + a CSS variable
  pointing at the chosen family, so canvas/preview/publish parity holds the
  same way it does for the self-hosted fonts today.

**Verify**: unit test the link-tag/CSS-var generation for a curated pick and
a free-text pick; Playwright canvas-vs-public-page font parity check.

---

## Phase I — Portfolio upload limit (item 13)

**Finding**: shared `uploadImage()`/`uploadAsset()` helpers
(`lib/storage/uploadAsset.client.ts`, `uploadImage.client.ts`) take a
constraints object per call site. Gallery photo limit is 10MB
(`lib/page-builder/photoSpec.ts:13`, `maxBytes: 10 * 1024 * 1024`) and is
**shared with user/team avatar uploads** — raising this constant directly
would silently raise avatar limits too. Site icon (1MB,
`settings/public-page/_form.tsx:26`) and header logo (250KB,
`HeaderPanelDialog.tsx:26`) are separate, portfolio-only constants.

**Fix**: raise only the portfolio-gallery-photo path to 15MB without
touching the shared avatar usage — either split `photoSpec.ts` into a
portfolio-specific spec (15MB) and a separate avatar spec (unchanged 10MB),
or add a `maxBytes` override parameter at the portfolio call sites that
currently default to the shared spec. Leave site-icon/logo limits untouched
(task only asks about "picture upload limit" for portfolio-page uploads,
i.e. gallery photos).

**Verify**: unit test the portfolio gallery upload path accepts up to 15MB
and rejects above it; unit test avatar upload path still caps at 10MB
(regression guard for the "don't break shared flows" requirement).

---

## Phase J — Gallery fullscreen/lightbox reuse (item 14)

**Finding**: a reusable `Lightbox` component already exists in
`CollectionPopup.tsx:184-246`, currently only wired up inside the Featured
Work modal flow (`CollectionPopup` → `FeaturedCollectionsClient` →
`FeaturedWorkBlock`). The public Gallery page
(`app/(public)/w/[orgSlug]/gallery/page.tsx` + `GalleryGridBlock`/
`GalleryCarouselClient`) has no click-to-fullscreen handler at all.

**Fix**: extract `Lightbox` out of `CollectionPopup.tsx` into a shared
location (e.g. `lib/page-builder/blocks/Lightbox.tsx`) so both the Featured
Work modal and the Gallery page import the same component, then wire image
click handlers in the Gallery grid/carousel/masonry blocks to open it for
non-video items (video tiles keep their existing behavior, unaffected).

**Verify**: Playwright — click a Gallery image, confirm the same lightbox
opens as Featured Work's; click a video tile, confirm no regression.

---

## Phase K — Calendar timezone consistency (item 16) — highest risk

**Finding**: "candles" = calendar event tiles (confirmed terminology, used
identically in `booking-calendar.tsx` and `lib/inquiries/inquiry-candles.ts`
for both real bookings and inquiry sessions — they already share one render
component and one `FALLBACK_TZ` ("Asia/Manila") sourced consistently from
`workspace.timezone` across bookings page, inquiries page, and inquiry
submission). The public `ContactForm.tsx` date/time inputs are plain
`type="date"`/`type="time"` — timezone-naive literal strings, not real `Date`
objects, so there's no browser-tz leakage there (an initial hypothesis from
research that didn't hold up on closer reading).

**Actual suspected root cause**: `booking-calendar.tsx` uses
`react-big-calendar`'s `dateFnsLocalizer` (`format`/`parse`/`startOfWeek`/
`getDay` from `date-fns`, all operating on the *local* runtime/browser
timezone via native `Date` getters) to position events on the grid, while
`formatTimeRange(..., ev.workspaceTz)` formats the *displayed label text* in
the workspace timezone. If a viewer's browser timezone differs from the
workspace's configured timezone, an event's grid cell (day/hour) can land in
the wrong place while its label text still shows the correct workspace-local
time — a real positional/label mismatch, shared by both booking and inquiry
candles since they render through the same component.

**Fix approach**: construct the `Date` objects fed to `react-big-calendar`
so their local-timezone getters (`getDate`/`getHours`/etc, which the library
and `date-fns` localizer read) already reflect the *workspace* wall-clock
time, reusing the existing `dateToTzWallClock`/`isoDateInTz` helpers in
`calendar-helpers.ts` rather than passing true UTC instants straight through.
This is the standard react-big-calendar timezone workaround pattern.

**This is the riskiest phase** — calendar/booking data correctness, touches
shared rendering used by both real bookings and inquiries. Do not ship
without: (1) a unit test asserting grid day/hour placement matches workspace
tz for a workspace/browser-tz mismatch fixture, (2) a Playwright check with
`TZ` env or browser context locale forced to something other than the
workspace's configured timezone, confirming the candle lands on the correct
day/hour and the label matches.

---

## Phase L — Guide/spotlight tour fixes (item 17)

**Step reorder** — current tail of `SPOTLIGHT_STEPS`
(`spotlightSteps.ts:169-229`) is `photos(15) → translate(16) → theme(17) →
preview-device(18) → publish(19) → save-drafts(20)`. Requested result:
`preview-device(15) → translate(16) → photos(17) → theme(18) →
save-drafts(19) → publish(20)`. This is a pure array reorder of those 6
step objects — no copy changes, no gating-logic changes (`guideStepPanel`/
`NAV_STEPS`/`CONTACT_STEPS` are id-based, unaffected by array order).

**Step 2 targeting bug** — `drag-block` step already anchors `blocks-panel`
+ secondary `canvas` (`EditorShell.tsx:1368,1376`, both real DOM containers,
not missing). The dim/cutout union logic for passthrough+secondary-anchor
steps (`SpotlightGuide.tsx` `DimWithCutout`, ~lines 169-331) punches holes for
both regions — but `blocks-panel` + `canvas` together cover nearly the
entire editor body width, which may be why it visually reads as "highlights
the full page" rather than "just the components panel and canvas" as
intended-but-too-broad, OR there's a genuine layout/sizing bug making one of
those containers report a larger-than-expected rect (e.g. in the
`SandboxEditorGuide` dual-shell layout specifically, vs. the real editor).
**Needs Playwright reproduction** (open the guide, inspect the actual
rendered cutout rects at step 2) before concluding which of the two it is —
this is a visual/runtime issue, not resolvable from static code alone per
the `portfolio-guide` skill's own guidance.

**Verify**: unit test for the reordered step array (ids in the new
sequence); Playwright walking the guide to step 2, screenshotting the
cutout/dim region against the blocks-panel/canvas bounding boxes.

---

## Overall verification (after all phases land)

- `pnpm test --run` per touched file as each phase completes (not full
  sweep); full `pnpm test` once before opening the PR.
- `pnpm lint` / typecheck.
- All 5 locales updated together for any new/changed copy (items 2, 5).
- Playwright at 3 breakpoints (375/768/1280) for every UI-touching phase,
  per the repo's Done criteria — this plan calls out per-phase where
  Playwright is required vs. where unit tests suffice.
- Consolidate any scratch notes from this work into at most one
  `docs/portfolio/` doc before the PR, per docs-hygiene rules.
- Open one PR with a `- [ ]` checklist mirroring these phases; call out Phase
  F (block redesign) and Phase K (calendar timezone) explicitly as the
  highest-blast-radius shared-path changes in the PR description.
