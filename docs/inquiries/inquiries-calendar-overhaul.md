# Inquiries calendar overhaul (branch: fix/inquiries-calendar)

Single source of truth for this PR. Supersedes the earlier scratch docs
(`docs/superpowers/{plans,specs}/2026-06-18-enhance-inquiries-calendar*`), which
described the original calendar enhancement now folded in here.

## Problem
The inquiries calendar mishandled inquiry statuses and lacked the bookings
calendar's polish:
- Inquiry candles always showed a **"Booked"** status pill instead of their real
  status — `inquiry-candles.ts` hardcodes `status:"booked"`, and the candle pill's
  `labelOverride` only fired when `status !== "booked"`, so the override never ran.
- The status value `"new"` was the wrong word; it should read **"Inquiry"**
  everywhere, with **"Booked"** reserved for actual `Booking` documents.
- Past inquiries weren't surfaced as clearly-past, read-only candles.
- Inquiry drag had only an error toast (no loading/success), unlike the bookings
  calendar's `toast.promise`.

## Decisions (confirmed with the user)
- Stored status literal renamed `new` → `inquiry` (backend + display), dev DB is
  drop+reseed (no migration). `booked` / `converted` / `archived` unchanged.
- Past **inquiries AND past bookings** are shown on the inquiries calendar,
  dimmed with the existing top-right **"Past"** pill (not relocated).
- Converted/booked inquiries appear via their linked draft `Booking` as **"Booked"**
  candles — never as a duplicate inquiry candle.
- **Every** mutation on the inquiries page toasts success/failure.

## Changes by scope item

### 1. Status rename `new` → `inquiry` (commit `a22d723`)
Enum + fallbacks (`lib/inquiries/status.ts`), model default (`Inquiry.ts`),
submission/onboarding/seed, count key `new`→`inquiry` (`lib/db/queries/inquiries.ts`
+ consumers), dashboard metrics, reschedule guard (`_actions.ts`), status tabs
(`inquiries-page-client.tsx`), status badge, calendar overlay filter (`page.tsx`),
all four locales (`tabs.inquiry` / `statusValues.inquiry` / `calendar.filters.inquiry`),
and all affected tests. The unrelated booking client `mode:"new"` is untouched.

### 2. Calendar candle + past + read-only + toasts (commits `4bd0d11`, `6d318e9`)
- Inquiry candles render an **"Inquiry"** pill: dropped the never-firing
  `status !== "booked"` guard in `MonthBookingEvent`/`TimeBookingEvent`; label is
  localized via `statusValues.inquiry`. `kind:"inquiry"` is only set by
  `buildInquiryCalendarEvents`, so no real booking can show "Inquiry".
- Past items: `page.tsx` calendar fetch uses `includePast:true` (scoped to the
  inquiries calendar only); `inquiries-calendar-manager.tsx` passes `showPast`, so
  past candles dim + show the Past pill. `isInquiryCandleDraggable` gates drag on
  `ev.end >= now`, so past inquiry candles are non-draggable.
- Read-only modal for past inquiries: `areAllSessionsPast(sessions, tz)`
  (`lib/inquiries/session-past.ts`) → `readOnly` threaded through
  `page.tsx → inquiries-page-client → InquiryDetailModal`. When read-only,
  `InquiryActions` is hidden and `ClientInfoCard` / `BookingDraftCard` are
  non-editable (including Total/Deposit/Notes/Team inputs).
- Toasts: drag-reschedule uses `toast.promise(loading/success/error)` with
  optimistic move + revert and the in-flight guard intact; convert/archive/decline
  and inline saves (client info, booking draft, sessions) toast success/error.

### 3. Portfolio Contact block — WYSIWYG (commit `ee03f5c`, out-of-scope add-on)
`lib/page-builder/editorConfig.tsx` renders live Contact prop values
(email/phone/address/socials) in the editor canvas instead of a static placeholder;
`StyleToolkitField.tsx` switches the Contact bg-image control from the inline
all-uploads grid to the shared modal `SingleImageControl` used by other blocks.
(Not Playwright-verified — Puck is hard to drive in a browser, per the request.)

## Verification
- `pnpm typecheck` clean; `pnpm lint` clean (pre-existing warnings only).
- Unit/component tests: 499 passing across the affected suites (rename, candles,
  filters, detail modal, session-past, dashboard, page-builder, booking-draft-card).
- Playwright `e2e/inquiries-calendar.spec.ts` PASS at 375 / 768 / 1280: Inquiry
  pill on inquiry candles; Inquiry/Booked/Conflicted filters; a Booked candle;
  past inquiry dimmed + Past pill, opening a read-only modal (Inquiry badge, no
  actions). Seed adds two fixed past `inquiry` records (−7/−14 days) for this.

## Known / deferred (non-blocking)
- The candle's small status-**dot** still uses the booked color for inquiry candles
  (`CalendarEvent.status` is typed `BookingStatus`, so candles keep `status:"booked"`);
  the pill **text** correctly reads "Inquiry" and the candle background is the
  inquiry color. Cosmetic only.
- `readOnly` is derived from past-ness, so a past inquiry opened from the **table**
  view is also read-only (cannot be archived). Intentional per the "past →
  read-only" decision; revisit if archiving past inquiries is desired.

## Round 2 — enhancements (legend, optimistic DnD, contact WYSIWYG, skills)

### 4. Inquiry filter chips double as a legend (commit `ef15c59`)
The three filter chips (Inquiry / Booked / Conflicted) in
`inquiries-calendar-manager.tsx` previously hid their color swatch when the chip
was active (the swatch inherited `currentColor`). The swatch now **always** shows
its status color — slate `--event-inquiry`, teal `--event-booked`, red `--danger`
— matching the candle fills, so the toolbar reads as a legend (same idea as the
bookings `team-legend.tsx`). Tokens are the existing theme-invariant `--event-*`;
no new CSS.

### 5. Optimistic drag no longer snaps back (commit `ef15c59`)
Dragging an inquiry candle flashed the candle back to its source for ~500ms before
settling on the target. Root cause: the success path **deleted** the optimistic
`Map` override and then called `router.refresh()`, so `mergedEvents` fell back to
the stale server position until fresh data arrived. Fix mirrors the bookings
calendar's keep-and-resync: the override stays applied; a `useEffect([events])`
with a `prevEventsRef` clears the overrides only when the refreshed `events` prop
lands (same render → no intermediate stale frame). Error path still reverts to the
previous event. This pattern is now documented in the **optimistic-rendering**
skill so it doesn't regress.

### 6. Contact block — WYSIWYG enhancements (commit `99af0e1`)
`lib/page-builder/blocks/ContactDetailsBlock.tsx` + `StyleToolkitField.tsx` +
`styleToolkit.ts` + `editorConfig.tsx`, plus new
`blocks/SocialIconLink.tsx`:
- **Content tab — 1–2 column layout** for ALL fields (info rows + socials) via the
  reused `CountControl` (`min=1`, `max=2`); render switched from flex `<dl>` to a
  CSS grid (`contactGridTemplate`).
- **Design drawer — Labels / Inputs typography tabs**: 16 new per-target
  `BlockStyle` props (`label*` / `value*`) edited under a 2-tab segmented toggle,
  applied to each `<dt>` / `<dd>` via `buildContactLabelStyle` /
  `buildContactValueStyle`. This fixes typography only landing on one field — the
  hardcoded inline label/value styles that blocked the cascade are now defaults the
  controls override.
- **Icons drawer** (separate from typography + effects): icon size + icon color
  (`iconSize`, `iconColorToken`).
- **Socials → centered monochrome SVG icon links** (Instagram/Facebook/TikTok +
  globe for Website) that inherit the icon color control. On the **public site**
  each is a confirm-gated external link: `window.confirm` with a locale-aware
  "You're visiting an external site: {url}. Continue?" (added to
  `publicPage.chrome.socialLinkConfirm` in all 4 locales and threaded through the
  public/preview page `chrome`). In the editor the confirm prop is absent, so
  clicks are inert. URLs normalized to https via `normalizeSocialUrl`.
- Not Playwright-verified (Puck excluded per request); covered by unit tests for
  the pure helpers + the new editor controls.

### 7. New skills (commit `93846ad`)
Two repo-local skills capture the now-shared patterns so future agents don't
re-derive them:
- `.claude/skills/calendar-management/` — the shared `BookingCalendar` API,
  `CalendarEvent` shape, color/legend system, conflict detection, and how the
  bookings vs inquiries consumers differ.
- `.claude/skills/optimistic-rendering/` — the optimistic-UI shape for tables and
  calendars, the four concrete variants in the repo, and the
  delete-override-then-refresh snap-back anti-pattern (fixed in §5).

## Round 3 — portfolio editor + UI polish

(This branch grew past the inquiries calendar into adjacent portfolio-editor and
shared-UI work; all of it ships together here.)

### 8. Segmented-control toggles (commits `3a1309c`, `45814f9`)
The byte-identical bookings/inquiries table-vs-calendar toggle was extracted into one
shared `components/ui/segmented-toggle.tsx` (single pill: outer corners at `--radius`,
single `divide-x` inner dividers, active = brand; registered in `REUSABLE_CODE.md`).
The shared calendar toolbar's nav (`< today >`) and view switcher (month/week/day) were
restyled to the same pill — the Today button's doubled border was removed by letting the
container own the dividers (`divide-x`).

### 9. Contact block refinements (commits `0b5d670`, `b800058`, `22602ac`, `1d97640`, `45814f9`)
- **Effective-default display ("float up"):** the Labels/Inputs/Icons color controls now
  show their theme defaults (`foreground`/`accent`/`accent`) instead of blank, display-only
  (prop stays unset) per the `portfolio-effective-defaults` skill.
- **Social inputs** relabeled to handles ("Instagram username" …) with focus-only
  placeholders (`FloatingLabelInput` gains an optional `placeholder`); the editor canvas now
  routes social hrefs through `normalizeSocialUrl`, so a pasted full URL no longer doubles
  into `instagram.com/https://…` — canvas == publish.
- **Social icons** follow the Inputs alignment control, defaulting to centered.
- **Columns control** shows only `[1] [2]` (new `CountControl` `hideInput` prop — the trailing
  number field is dropped for the 1–2-only contact columns).

### 10. `DimensionInput` rem→px display (commit `53032cc`)
Padding controls showed the rem number under a px label (`1.5rem` → "1.5px"); a
`toDisplayNumber` helper converts rem→px for display ("24px"), fixing Container/Columns
effective padding everywhere. Display-only — the written `_style` value is unchanged.

### 11. Editor canvas + draft flow (commits `0f50ce6`, `98af2f7`)
- **Root droppable floor + tail:** `[data-puck-dropzone="root:default-zone"]` gets
  `min-height: 100dvh; padding-bottom: 10rem` (editor-only, in `RootCanvasStyle`), a
  root-zone-only selector that can't match nested Container/Columns slots. Droppable area =
  `max(100dvh, content) + 10rem`.
- **Single load cycle on discard→apply:** `pendingAction` now carries a `reseeds` flag; a
  discard followed by a re-seeding action (apply template / switch draft) skips the redundant
  intermediate canvas restore and its `seedNonce` bump, collapsing two `<Puck>` remounts into
  one (one spinner, no silent pre-load behind the templates modal).

### 12. Container "collapsing anchor" — sibling container drops (commits `4cd54f7`, `4f39009`, `b08cf9d`)
Puck 0.20.2 won't let a 2nd Container drop into an empty parent Container as a **sibling** — it
nests inside the first child (a dnd collision-detection limitation; a throwaway upgrade spike
confirmed `@puckeditor/core` 0.22's reworked engine does **not** fix it either). The known
manual workaround is that a container already holding a non-container child accepts sibling
drops. We auto-provide that: an invisible `ContainerAnchor` is kept as the container's first
slot child (`resolveData` ensures presence), and `EditorContainerAnchor` self-sizes at render
from the parent's live child count (full footprint when empty → 4px bridge when it holds one
container → 0 otherwise) and bounces click-selection to the parent. Renders `null` on the
public page. **See the known limitation below — this ships with an accepted defect.**

### 13. Sidebar + MobileBanner (commit `9ca6823`)
Sidebar nav reordered to **Dashboard → Inquiries → Bookings → …**; the MobileBanner's
anchor-rendered `Button` gets `nativeButton={false}` to clear a Base UI accessibility warning.

## Round 3 — known limitations
- **Container anchor causes a load-time stack overflow (accepted, non-blocking).** The anchor
  is injected via the Container's `resolveData`; Puck 0.20.2's `walkAppState`/`resolveAllData`
  applies `resolveData` **while walking slots**, so a slot-mutating `resolveData` re-feeds the
  walker and overflows the stack once on canvas mount/refresh (`RangeError: Maximum call stack
  size exceeded`, surfaced as an unhandled promise rejection). It does not block editing in
  local/built use and is accepted for now. The proper fix is to move anchor maintenance out of
  `resolveData` (e.g. into `EditorShell` `onChange`, post-processing emitted data) or to migrate
  to `@puckeditor/core` 0.21+ (adds a `resolveData`-on-move trigger and a reworked walker).
- **Anchor polish deferred:** publish/save stripping of anchors (they render `null` on public
  but persist in draft data), and full keyboard/outline selection suppression on the anchor.

## Verification (Round 2 + 3)
- `pnpm typecheck` clean; `pnpm lint` clean (pre-existing warnings only).
- Unit/component tests green across the touched suites (page-builder incl. ContactDetails /
  StyleToolkitField / toolbarPrimitives / CountControl / segmented-toggle / containerAnchor,
  inquiries, bookings, sidebar nav).
- The portfolio editor was driven **manually in a browser** (Puck is intentionally not
  Playwright-driven): sibling container drops, anchor self-size/collapse, click-selects-parent,
  the single load cycle, and the 100dvh/+10rem droppable were all confirmed by hand. The
  container-anchor load-time stack overflow above is known and accepted.
