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
- [ ] **B1 (item 2,17,18)** One-off read-only DB script → generate 4 template files from
      sarah-bell-photo drafts (title = theme name); delete 5 themed templates; keep scratch; update `index.ts`.
- [ ] **B2 (item 11)** Template-picker "current" badge only when canvas == template seed (snapshot
      seed on apply, compare; hide on divergence).
- [ ] **B3 (item 22)** Unify save snapshot + dirty-check serialization so post-save isn't "dirty";
      Publish no longer triggers discard guard. Verify discard still restores.
- [ ] **B4 (item 23)** Save commits a mid-edit pending name first, then saves; Enter submits (already).

## Phase C — Contact form / navbar styling + canvas parity
Files: `app/(public)/w/[orgSlug]/_components/{ContactForm,PortfolioHeader,contactButtonAppearance}.tsx`,
`ContactPanelDialog.tsx`, `HeaderPanelDialog.tsx`, `styleToolkit.ts`, `rootStyle.ts`,
`RootCanvasStyle.tsx`, `resolveBrandKit.ts`, `types.ts`. (effective-defaults skill)
- [ ] **C1 (item 14)** Fix tab color token→var via `colorTokenToVar`; audit other `--pf-color-${token}` builders.
- [ ] **C2 (item 10)** Float active-link underline (effective default, not hardcoded-on) + default theme color.
- [ ] **C3 (item 15)** Independent Subtle + Compact inactive-tab toggles in ContactPanelDialog; apply in ContactForm.
- [ ] **C4 (item 16)** New-dates button dotted outline floated; width/color controls update the dotted border.
- [ ] **C5 (item 24)** Navbar active-link style floats in preview mode.
- [ ] **C6 (item 12)** Canvas reflects floated root background theme value (Luxury banner) — materialize
      effective root bg for canvas; watch `CANVAS_COLOR_ISOLATION_CSS`.

## Phase D — i18n editor chrome
Files: `messages/{en,fil,ms,id,ar}.json`, `editorConfig.tsx`, `manualBlocks.tsx`, `sectionPresets.ts`,
`galleryPicker/CollectionsManagerDialog.tsx`, `EditorShell.tsx`.
- [ ] **D1 (item 19)** Translate Photos & Collections modal (`L` object → catalog).
- [ ] **D2 (item 20)** Locale-aware `editorConfig` factory: block labels, field labels, dropdown
      options, drawer categories; Puck built-ins where its API allows. All 5 locales.
- [ ] **D3 (item 21)** Replace hardcoded toasts (`EditorShell.tsx:741` etc.) with `t()`.
- [ ] **D4** Update RELEASE-CHECKLIST §4f / architecture skill: chrome no longer English-only.

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
