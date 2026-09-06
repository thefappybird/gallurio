# Popup-columns handoff completion + RTL scope correction

## Part A — finish the popup-columns handoff

Source: `docs/portfolio/featured-work-popup-columns-handoff-2026-09-06.md`. All
runtime/inspector code is already written; only tests, comment cleanup, and
verification remain. Execute the handoff's "Remaining implementation/test
work" list items 1-8 exactly as specified there (packRows fixed-row test,
CollectionsPopupPanelDialog test, CollectionsPopupPreview test,
CollectionPopup integration test, stale comment fixes in ContactSheet/
SplitIndex/packRows, REUSABLE_CODE.md entry, then the focused vitest command,
typecheck, lint, `git diff --check`). Commit as its own checkpoint before
starting Part B — Part B edits some of the same files (CollectionPopup.tsx,
CollectionsPopupPreview.tsx) and must build on a green baseline, not race it.

## Part B — RTL must be scoped to contact form + featured-work popups only

### Current behavior (confirmed by reading the code)

- `app/(public)/layout.tsx` sets `dir` on `<html>` from
  `resolveEffectiveDir(workspace.publicPage?.formDir, locale)` — this mirrors
  the ENTIRE published page (every manual Puck block) whenever the owner picks
  an RTL portfolio language, not just the form/popup chrome.
- `app/(public)/w/[orgSlug]/layout.tsx` sets the same `dir` again on the page
  wrapper div (redundant with the above).
- `app/[locale]/portfolio-preview/page.tsx` sets `dir={effectiveDir}` on its
  outer wrapper, computed from `formLocale`/`formDir` query params (already
  correctly decoupled from the CRM locale) — but `ContactModal` and
  `CollectionPopup` both render through `DialogPrimitive.Portal` to
  `document.body`, which escapes that wrapper's `dir` entirely (same reason
  they already re-apply `brandVars` inline — see the comments on both
  components). Their content therefore never actually receives RTL, in canvas,
  preview, or published — explaining bug 2.2 (contact form flips because
  something else is happening — see below — but the popups never do).
- `app/[locale]/layout.tsx` sets `dir={isRtl(locale) ? "rtl" : "ltr"}` on
  `<html>` from the **CRM UI locale** (the `/[locale]/` route segment). The
  editor canvas (`EditorShell`'s Puck root, and the non-Puck contact/popup
  swatches) has no `dir` override of its own, so it inherits this — meaning
  canvas RTL-ness today tracks the owner's own CRM language, not the
  portfolio's `formLocale`. This is bug 2's root cause.
- `EditorShell.tsx`'s canvas-mode contact swatch (`ContactFormPreview`) gets
  its copy from `tPublicForm = useTranslations("publicPage.inquiryForm")`
  (`EditorShell.tsx:964`) — bound to the CRM locale via next-intl's request
  context, not to the live `formLocale` client state. Same for the canvas nav
  labels threaded into Puck's `metadata.workspace.chrome.nav`
  (`EditorShell.tsx:2957-2965`, via `tNav`). There is no existing client-side
  mechanism to render copy in an arbitrary, live-switchable `formLocale`
  independent of the CRM route locale — `createTranslator` from `next-intl`
  is already used elsewhere in this repo as a pure client-safe function
  (`lib/notifications/messages.test.ts`), and `lib/i18n/request.ts` already
  dynamically imports `messages/${locale}.json` — so the fix is a small new
  helper that does the same dynamic import + `createTranslator`, keyed by
  `formLocale` instead of the request locale.
- `Lightbox.tsx` (the full-size "image preview" nested inside the popups) also
  portals to `document.body`, and additionally **hardcodes physical
  direction**: `ChevronLeftIcon`/`ChevronRightIcon` for prev/next
  (`Lightbox.tsx:283`) and `ArrowLeft`/`ArrowRight` keyboard handling
  (`Lightbox.tsx:390-395`) never swap for RTL. `SplitIndex.tsx` and the other
  popup-layout bodies already use logical flex (`flexDirection: "row"`,
  documented at `SplitIndex.tsx:14-17`, deliberately not `"row-reverse"`) so
  they need no layout changes — they'll flip correctly once `dir` actually
  reaches them.

### Target behavior

1. **General manual-block content (Home/Gallery templates, Columns, Hero,
   arbitrary blocks) never mirrors for RTL** — in canvas, in the Preview tab,
   and on the published site. It always renders in its authored (LTR)
   structure regardless of `formLocale`/`formDir` and regardless of the
   owner's own CRM UI language. Owners who want an RTL-styled section build it
   manually (existing per-block Design controls) — this is a deliberate
   WYSIWYG guarantee: canvas, preview, and published must never disagree.
2. **Contact form** (the public contact modal, its preview-tab equivalent, and
   the canvas swatch) always follows the portfolio's own `formLocale`/
   `formDir` — never the CRM UI locale.
3. **Featured-work popups** (Contact Sheet / Justified / Split Index /
   Immersive) and the nested image Lightbox follow the same rule as #2, in
   canvas, preview, and published.
4. Navigation block real-time RTL mirroring in canvas (item 1.1 in the
   request) is explicitly OUT OF SCOPE for this pass — the user flagged it as
   a "nice to have", not a requirement. Leave nav exactly as-is; it inherits
   whatever the general-content rule above produces (i.e., stays LTR-structured,
   same as every other block).

### Implementation

**B1 — stop mirroring general content**
- `app/(public)/layout.tsx`: `<html>` keeps `lang={locale}` (SEO/pronunciation)
  but `dir` is always `"ltr"`; drop the `resolveEffectiveDir` call here.
- `app/(public)/w/[orgSlug]/layout.tsx`: drop `dir={effectiveDir}` from the
  wrapper div (and the now-unused `resolveEffectiveDir`/`storedDir` lines).
- `app/[locale]/portfolio-preview/page.tsx`: outer wrapper `dir` becomes a
  fixed `"ltr"`; keep computing `effectiveDir` (still needed for the
  contact/popup zones below) but stop applying it at the wrapper level.
- `EditorShell.tsx`: add `dir="ltr"` to the `gallurio-editor` canvas root div
  (~line 2893) so canvas general blocks stop inheriting the CRM's own
  `<html dir>` when the owner's CRM language is Arabic.

**B2 — new client-side "formLocale translator" helper**
- Add `lib/i18n/loadFormLocaleMessages.ts` (or similar): given a `formLocale`
  and a list of namespaces, dynamically `import(`@/messages/${formLocale}.json`)`
  and return `createTranslator({ locale: formLocale, messages, namespace })`
  per namespace, mirroring `lib/i18n/request.ts`'s existing dynamic-import
  pattern. Client component, cache per-locale import (module-level Map) to
  avoid re-fetching the same JSON on every keystroke/render.
- `EditorShell.tsx`: replace the CRM-locale-bound `tPublicForm`/`tLocationPicker`
  feeding `contactLabels` (line ~2508) with this helper keyed on `formLocale`,
  so the canvas contact swatch always matches the portfolio language. (Leave
  `tNav`/canvas nav labels on the CRM locale per B-4/out-of-scope above —
  no behavior change there.)

**B3 — thread dir through the two portaled dialogs + Lightbox**
- `ContactModal.tsx`: accept a `dir` prop, set it on the
  `DialogPrimitive.Popup` (same spot that already re-applies `brandVars` for
  the identical "Portal escapes the wrapper" reason). Published layout passes
  `resolveEffectiveDir(formDir, locale)`; preview's `PreviewContactModal`/
  `PreviewContactCard` pass the already-computed `effectiveDir`.
- `ContactFormPreview.tsx` (canvas swatch): accept and apply the same `dir`,
  computed from live `formLocale`/`formDir` state in `EditorShell`.
- `CollectionPopup.tsx`: accept a `dir` prop, apply to `DialogPrimitive.Popup`
  (`shellStyle`'s element) — same portal-escape reasoning already documented
  for `brandVars`. Thread from `CollectionPopupChrome`'s caller in the public
  page, `PreviewPopupShell`, and `CollectionsPopupPreview` (canvas swatch —
  also needs its locale/dir source switched from `useTranslations` to the new
  B2 helper for any real copy it displays, and `formDir`/`formLocale` state
  from `EditorShell`).
- `Lightbox.tsx`: accept and apply `dir` the same way, AND make the prev/next
  icon (`Lightbox.tsx:283`) and arrow-key handling (`Lightbox.tsx:390-395`)
  direction-aware (swap Left/Right meaning when `dir === "rtl"`, matching
  standard RTL carousel conventions).

### Verification

- Unit/component tests updated alongside each file above (dir prop threading,
  formLocale-driven labels, Lightbox RTL key/icon swap).
- `pnpm typecheck`, targeted `eslint`, then full `pnpm lint` — orchestrator
  only, one at a time, after each engineer reports green.
- One batched Playwright pass at the end (per the rationing rule): public
  surfaces (published contact form + popup + lightbox) at 375/768/1280 ×
  5 locales × light/dark, confirming (a) `ar` formLocale flips ONLY the
  contact form/popup/lightbox and general blocks stay LTR, and (b) an `ar`
  CRM UI locale with an `en` portfolio `formLocale` leaves the canvas
  contact/popup swatches in English/LTR. Editor-internal canvas checks stay
  at 1280px only.
