# Portfolio maker — finalization fixes (25 items)

> **Checkpoint doc.** Each item has a checkbox; mark `[x]` the moment it lands + commits, so a
> crash mid-run can resume from the first unchecked box. Keep this in sync with reality.

## Context
The portfolio builder (Puck editor at `/portfolio`, public pages at `/w/[orgSlug]`) has a batch
of layout bugs, missing controls, stale templates, styling-default ("floating") gaps, a crash,
modal stacking issues, and i18n gaps. Source of truth is `Workspace.publicPage`; the same Puck
config renders editor canvas and public page.

**Locked decisions:** templates = 4 sarah-bell-photo DB drafts + scratch, title = theme name ·

**B1 resolved (2026-06-28 DB probe):** exactly 4 drafts on workspace `6a3dab1451fd45c5076275b0` →
draft "Bold"/preset `bold`, "Venue & Stylist"/`luxury`, "Event Photographer"/`editorial`,
"Wedding Photographer"/`minimal`. **Title = theme PRESET name** → labels `Bold`, `Luxury`,
`Editorial`, `Minimal`; ids `bold|luxury|editorial|minimal`. **Faithful fidelity:** extend
`PortfolioTemplate` type + `seedTemplateAction` + `applyTemplate` to ALSO seed `header` +
`collectionsPopup` (today they reset to defaults at `EditorShell.tsx:1070-1071`) so each template
matches its source draft's chrome. Playwright scope: modals + Puck canvas only (user does DnD).

full editor-chrome i18n · Columns "Overall Width" = Page fit | Full(100vw) · notifications = verify
only · active badge = template picker only · min-height custom = value + px/% · inactive tabs =
Subtle + Compact independent toggles · crash repro = 4-col, col3 GalleryLanding spanning 2 → flicker.

## Root causes (confirmed)
- **3/4/6:** `ColumnsBlock` (`lib/page-builder/blocks/manualBlocks.tsx` ~L544–609) keys its `<style>`
  by column **count** + shares global `.pf-cols` + one `containerName: "pf-cols"` → instances
  cross-contaminate; container-query breakpoint oscillates on colSpan resize → flicker → crash.
- **1:** editor-only `editorGridCols` inline override exists; no `editorGridRows`.
- **14:** `ContactForm.resolveTabColor` builds `var(--pf-color-${token})` → `--pf-color-background`
  but real var is `--pf-color-bg`. Use `colorTokenToVar` (`styleToolkit.ts`).
- **13:** Leaflet `z-index 400–1000` > dialog `z-50`; wrapper `overflow-hidden` ≠ stacking context.
- **22:** `savedSnapshot` and `isDirty` strings built from different shapes → always dirty after save.
- **25:** params + viewer-locale render already shipped (`b5642da`); screenshot = legacy fallback rows.

---

## Phase A — Columns/Container engine
Files: `lib/page-builder/blocks/manualBlocks.tsx`, `StyleToolkitField.tsx`, `toolbarPrimitives.tsx`,
`styleToolkit.ts`, `CountControl.tsx`, `blocks/EditorContainerAnchor.tsx`, `editorConfig.tsx`.
- [x] **A1 (item 6,3,4)** Per-instance unique scoping for Columns `<style>` (unique class +
      `containerName`); drop count-keyed/shared selectors. (334b5e8)
- [x] **A2 (item 1)** Add `editorGridRows` inline override so rows are WYSIWYG in canvas. (334b5e8, 7e0ee39)
- [x] **A3 (item 3,4)** Audit `EditorContainerAnchor` — no ResizeObserver, no feedback loop;
      documented with clarifying comment. (4ebd211)
- [x] **A4 (item 5)** Blur-clamping test added; clamping was already correct in CountControl. (7f35fa3)
- [x] **A5 (item 7)** Min-height control on Columns (DimensionInput px/%) + Container "Custom"
      option (minHeightValue + DimensionInput). (b7a83df)
- [x] **A6 (item 8)** Reset button (onReset prop) added to IconRow; wired on all Align/Justify
      IconRow calls in LayoutTabBody. (de35ce0)
- [x] **A7 (item 9)** "Overall Width" Page fit / Full (100vw full-bleed) on Columns. (4a2b3de)

## Phase B — Templates & drafts
Files: `lib/page-builder/templates/*`, `TemplatePickerDialog.tsx`, `EditorShell.tsx`,
`_draftActions.ts`, `lib/db/models/PortfolioDraft`.
- [x] **B1 (item 2,17,18)** One-off read-only DB script → generate 4 template files from
      sarah-bell-photo drafts (title = theme name); delete 5 themed templates; keep scratch; update `index.ts`. (b79af8d)
- [x] **B2 (item 11)** Template-picker "current" badge only when canvas == template seed (snapshot
      seed on apply, compare; hide on divergence). (16c81c6)
- [x] **B3 (item 22)** Unify save snapshot + dirty-check serialization so post-save isn't "dirty";
      Publish no longer triggers discard guard. Verify discard still restores. (d598ad9, 16c81c6)
- [x] **B4 (item 23)** Save commits a mid-edit pending name first, then saves; Enter submits (already). (d598ad9)

## Phase C — Contact form / navbar styling + canvas parity
Files: `app/(public)/w/[orgSlug]/_components/{ContactForm,PortfolioHeader,contactButtonAppearance}.tsx`,
`ContactPanelDialog.tsx`, `HeaderPanelDialog.tsx`, `styleToolkit.ts`, `rootStyle.ts`,
`RootCanvasStyle.tsx`, `resolveBrandKit.ts`, `types.ts`. (effective-defaults skill)
- [x] **C1 (item 14)** Fix tab color token→var via `colorTokenToVar`; audit other `--pf-color-${token}` builders. (1e8b582)
- [x] **C2 (item 10)** Float active-link underline (effective default, not hardcoded-on) + default theme color. (2bfe9e4)
- [x] **C3 (item 15)** Independent Subtle + Compact inactive-tab toggles in ContactPanelDialog; apply in ContactForm. (7c8c5b3)
- [x] **C4 (item 16)** New-dates button dotted outline floated; width/color controls update the dotted border. (6de5f90)
- [x] **C5 (item 24)** Navbar active-link style floats in preview mode. (b4e871f — verify only, auto after C2)
- [x] **C6 (item 12)** Canvas reflects floated root background theme value (Luxury banner) — materialize
      effective root bg for canvas; watch `CANVAS_COLOR_ISOLATION_CSS`. (bfbcbf2)

## Phase D — i18n editor chrome
Files: `messages/{en,fil,ms,id,ar}.json`, `editorConfig.tsx`, `manualBlocks.tsx`, `sectionPresets.ts`,
`galleryPicker/CollectionsManagerDialog.tsx`, `EditorShell.tsx`.
- [x] **D1 (item 19)** Translate Photos & Collections modal (`L` object → catalog). (D1 commit from prior session)
- [x] **D2 (item 20)** Locale-aware `editorConfig` factory: block labels, field labels, dropdown
      options, drawer categories; 91 keys × 5 locales. (a305426)
- [x] **D3 (item 21)** Replace hardcoded toast `"Draft saved."` with `t("savedToast")`. (ed80934)
- [x] **D4** Update RELEASE-CHECKLIST §4f / architecture skill: chrome no longer English-only. (this commit)

## Phase E — Modal stacking
File: `app/globals.css`.
- [x] **E1 (item 13)** `.leaflet-container { position: relative; isolation: isolate; }`; verify map
      under all dialogs (Drafts/Template/Publish/Photos); no regression to calendar/tour layers.

## Phase F — Notifications verify
Files: `lib/notifications/*`, `app/api/bookings/[id]/route.ts`.
- [x] **F1 (item 25)** Verified: `sendNotification` always sets `params`; `NotificationPopover.tsx:43-47`
      re-renders title/body from `params` via the VIEWER's `useTranslations`, so new notifications already
      render in viewer locale. Baked `locale:"en"` is only a legacy/email fallback. No code change (verify-only).

---

## Sequencing
A first (unblocks engine) → B + C in parallel (disjoint but watch `EditorShell.tsx`,
`StyleToolkitField.tsx`/`styleToolkit.ts`) → D (depends on A block structure; owns `EditorShell` toasts
after B) → E, F anytime. Sonnet executors per phase, disjoint file ownership, serialize shared-file
edits. Commit per item.

## Verification
Per-item unit tests (`pnpm test --run <fragment>`). User tests the flicker/crash repro manually.
Browser check editor+preview+published at 375/768/1280 (editor 768+1280). Before done: affected
tests + `pnpm typecheck` + `pnpm lint`; all 5 locales updated.

## Done log
- Phase A complete (2026-06-28): A1 334b5e8, A2 7e0ee39 + 334b5e8, A3 4ebd211, A4 7f35fa3, A5 b7a83df, A6 de35ce0, A7 4a2b3de. typecheck + lint clean; 278 tests passing across 4 test files.
- Phase B complete (2026-06-28): B1 b79af8d, B2 16c81c6, B3 d598ad9 + 16c81c6, B4 d598ad9. typecheck + lint clean; 56 tests passing in EditorShell.test (1 pre-existing fail at port 3000).
- Phase C complete (2026-06-28): C1 1e8b582, C2 2bfe9e4, C3 7c8c5b3, C4 6de5f90, C5 b4e871f, C6 bfbcbf2. typecheck + lint clean on changed files.
- Phase D complete (2026-06-28): D1 a662ad3, D2 a305426 + ed80934, D3 ed80934, D4 dfebf00. Locale-aware editorConfig
  factory; 91 puckConfig + 17 photosDialog keys ×5 locales; toasts localized. Puck 0.20 built-ins (drawer "Add",
  drag tooltips, Props/Outline headers) have no public i18n API — left English, noted in RELEASE-CHECKLIST §4f.
- Phase E + F complete (2026-06-28): E1 + F1 c35fa1b. Leaflet stacking isolation; notification viewer-locale verified
  (no code change — `params` + viewer `useTranslations` already handle it).
- Verification (2026-06-28): `pnpm typecheck` clean; `eslint` 0 errors on all 31 changed source files; Playwright
  confirmed template picker renders Bold/Luxury/Editorial/Minimal + scratch (stale templates gone) + canvas renders.
  Full vitest sweep re-run pre-PR. Crash repro (4-col, col3 span 2) left for manual browser check per plan.

---

## Follow-up batch (2026-06-28/29) — post-PR-45 review findings
User forks resolved: #2 skipped; #5 = editable slug in Publish dialog reusing the existing checker, keep `/w/slug`
routing (display `slug.gallurio.com`); #6 = detailed SEO audit + proposed fields, implement after approval; no template revert.
Two message-batches folded together; fanned out to disjoint Sonnet executors, controller committed serially.
- [x] **G1 (#7)** Theme modal one width (`sm:w-full sm:max-w-2xl`) + "Add new theme" seeds a visible editable tile
      (`startNewTheme(value)` ⇒ `hasUnsavedCurrent`). (c1824be)
- [x] **G2 (#8)** Edit-mode close → discard guard: existing `attemptClose`→`requestExit`→`UnsavedEditDialog` wiring
      verified + test added. (c1824be) — **left for user visual check** (repro may be a no-diff/X-close path).
- [x] **G3 (#1)** Contact active tab forced `opacity:1` + grounded `--pf-color-fg` so it reads full/white under Subtle. (547febe)
- [x] **G4 (#3)** Active-tab styles in preview — fixed behaviorally via G3/item4 (shared component; preview==public). (547febe)
- [x] **G5 (#4)** "Use this template" always-dirty — `applyTemplate` re-baselines `savedSnapshot` like `applyDraft`. (53bc5ea)
- [x] **G6 (#5)** Editable slug in Publish dialog: `updatePortfolioSlugAction` (owner-only, tenant-scoped, E11000→taken)
      + `useSlugAvailability`/`SlugStatusIndicator`, displayed `slug.gallurio.com`, routing unchanged. (53bc5ea, b1d22fd)
- [x] **G7 (#9 + item2)** Columns canvas↔public parity: `align-items:stretch` (siblings fill tall cell) + full-bleed
      gated on `isEditing` (100% in canvas, 100vw public). (8cae664)
- [x] **item1** Properties-panel overflow — `flex-wrap` on IconRow/min-height rows; reset buttons no longer clipped. (9915026)
- [x] **item4** Float contact defaults: inactive tab text→`foreground`, add-session button→`outline`, active underline→ON. (547febe)
- [x] **item5** Float featured-popup defaults: background→`--pf-color-bg` (fixed bogus `--pf-color-surface`), title
      font-size→16, close-button corner→`rounded`. (5d97f46)
- [x] **item3** Re-port updated `sarah-bell-photo` drafts → 4 templates, tenant-neutral (empty images, no asset ids). (cdb012a)
- [x] **G8 (#6)** SEO IMPLEMENTED (option-1: structural fixes + P0 fields + rich educational settings). Data layer
      `publicPage.seo`{ogImageUrl,ogImageAssetId,galleryDescription,noindex} + `GalleryImage` dims (c6d0cc4); env-aware
      public URL `portfolioPublicUrl` dev `/w/slug` | prod `slug.{NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN}` (402f585); gallery CLS
      dims+aspect-ratio (c1e10f8); rich educational settings UI + OG upload + noindex toggle + 5 locales (e9fc5ce); metadataBase
      + OG/Twitter/canonical/noindex + favicon-fix in generateMetadata (e9fc5ce); JSON-LD LocalBusiness/WebSite/ImageGallery/
      BreadcrumbList + `safeJsonLd` escaping (2661d60); `app/sitemap.ts` + `app/robots.ts` + `listPublishedWorkspaceSlugs` (f38122c).
- [x] **C2/C3 DEFERRED per owner (2026-06-29):** public page stays hardcoded `<html lang="en">`, fully isolated from CRM
      language; RTL chrome flip + per-tenant public language are a FUTURE spec. Do NOT add public-page i18n/lang/dir.
      See memory `project_public_page_language_isolation`.
- [x] **G9** Locales: publishDialog slug keys ×5 + 12 SEO settings keys ×5 (parity verified). Playwright pass **waived by user** (self-verifying).

### Done log (follow-up)
- 2026-06-29: 8 parallel agents (theme-modal, EditorShell, contact, columns, properties, popup, templates, SEO).
  All `pnpm typecheck` clean; `eslint` 0 errors / 95 warnings (baseline; 2 new harmless unused-disable directives).
  Per-track targeted vitest green (brand-kit 118, contact 60, popup 57, columns 166, properties 111, templates 79, EditorShell suite).
  Browser/Playwright verification waived by user — user self-verifies #8 close-guard, popup close-button corner, and the visual diffs.
- 2026-06-29 (SEO wave): landed in c6d0cc4 402f585 c1e10f8 e9fc5ce 2661d60 f38122c. `pnpm typecheck` clean; `eslint` 0 errors;
  all-5-locale parity (12 SEO keys); targeted vitest green (settings action 66, settings form 9, jsonLd 9, sitemap/robots 9,
  gallery CLS 47, page metadata 35). NOTE: SETTINGS + GALLERY agents self-committed (`git commit -am`-style) and swept some
  tracked files across commits — history slightly mixed but the tree is coherent and HEAD builds.
- **Security pass (security-auditor, 2026-06-29):** 1 HIGH fixed — stored-XSS in `safeJsonLd` (only escaped exact `</script>`;
  whitespace/solidus end-tag variants leaked owner-name into a live `<script>`) → `/<\/script/gi` + 3 regression tests (71ccdf3).
  Settings/slug actions, OG upload, sitemap, metadata audited CLEAN (owner-only, workspaceId-scoped, Zod-validated, ownership-verified).
  Open follow-ups (low): derive `ogImageUrl` server-side from the verified assetId (vs storing client URL); add `verifyImageOwnership`
  for `siteIconAssetId` (pre-existing gap); add sparse index `{ "publicPage.publishedAt": 1 }` before tenant count grows.
- **Deferred / future:** public-page language + RTL chrome (C2/C3, per owner); P1/P2 SEO fields (twitter handle, business
  category, serviceArea, priceRange, GSC token, keywords, per-page title overrides) — not built; add sparse index on
  `publicPage.publishedAt` before tenant count grows (backs the sitemap query).
