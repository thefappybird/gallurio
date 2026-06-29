# Portfolio Maker — Enhancements & Fixes (13 tasks)

## Context
`PORTFOLIO-ENHANCEMENTS.md` lists 13 scoped fixes/enhancements for the portfolio builder
(editor at `app/[locale]/(app)/portfolio/`, shared Puck config at `lib/page-builder/`,
public pages at `app/(public)/w/[orgSlug]/`). These are a mix of perf bugs (laggy autosave),
crashes (container anchor React #185, upload error), UX fixes (auto-select uploads, modal
min-height), and styling/control corrections (header link colors, toggle colors, Featured
Work defaults), plus one new feature (per-surface language toggler + RTL orientation).

The user also asked to **refresh the `portfolio-*` skills** for any drift surfaced during
this work, before/as we implement.

Decisions locked with the user:
- **Task 5**: per-surface language toggler (popup, nav, contact) translates that surface's
  built-in/system copy AND auto-applies RTL when an RTL language (Arabic) is picked; a
  per-surface RTL/LTR override toggle appears in that surface's Setup section (baseline LTR,
  initialised to the language's natural direction, overridable).
- **Task 7 "Featured popup"** = the existing **Collections Popup** tab/panel
  (`CollectionsPopupPanelDialog`) — the lightbox the Featured Work block opens. No separate
  "Featured" panel exists.
- **Task 12**: standardize both toggles on the **neutral charcoal** look (not brand teal).
- **Task 3**: single-image controls auto-select AND close the picker on upload; multi keeps
  the picker open; the standalone Photos manager (gallery mode) keeps current no-auto-select.

---

## Tasks

### 1. Debounce draft autosave (typing lag)
- **File:** `app/[locale]/(app)/portfolio/_components/EditorShell.tsx`
- `handleChange()` (~L671-684) calls `persistLocalDraft()` (~L583-603) synchronously on every
  Puck `onChange` → a `localStorage` write per keystroke.
- **Fix:** wrap the persist call with the existing **`useDebounce`** hook
  (`lib/hooks/useDebounce.ts`, returns `{ debounced, flush }`), ~350ms trailing. **Flush** on
  blur, on zone switch (reuse the existing `flushPendingSave()` L665-669 pattern), and on the
  existing `beforeunload` handler (L655-662) / unmount. Review the L651-652 `useEffect` that
  also persists — route it through the same debounce so it doesn't bypass it.
- **Verify:** typing in a Text block stays smooth; draft still saves after pause + on blur +
  on zone switch + on reload.

### 2. Container anchor crash (React #185) — REPRODUCE FIRST
- **Files:** `lib/page-builder/blocks/EditorContainerAnchor.tsx` (selection-bounce effect
  L62-74), `lib/page-builder/editorConfig.tsx` (`resolveContainerData` L259-289, anchor id
  `${parent}--anchor` L278; ContainerAnchor registration L980-999).
- React #185 = "maximum update depth exceeded" → a setState/dispatch loop. Prime suspect is
  the bounce `useEffect` dispatching `setUi` to the parent selector; the documented "no loop"
  guard appears to fail for draft-restored containers (likely a selector that resolves back to
  the anchor, or stale/duplicate anchor ids from saved data).
- **Approach:** this is a debugging task — **reproduce in Playwright first** (restore a
  draft-saved container, click its anchor) per `systematic-debugging`. Confirm the loop source
  before patching. Likely fix: guard the bounce (skip dispatch when the resolved parent
  selector is missing OR already equals the current selection) and/or harden
  `resolveContainerData` so a draft can never carry a mismatched/duplicate anchor.
- **Verify:** clicking a draft-restored container anchor AND a freshly placed one selects the
  parent without crashing; no console loop.

### 3. Auto-select uploaded photo in all uploaders except Photos modal
- **Files:** `lib/page-builder/galleryPicker/MediaPicker.tsx` (`handleFiles` ~L348-424;
  `pickSingle` L230, `toggleMulti` L236), `MediaField.tsx` (Single/Multi controls),
  `CollectionPicker.tsx` (inline upload L68-118), `CreateCollectionDialog.tsx` (~L89),
  `EditCollectionDialog.tsx` (~L204).
- **Fix:** after a successful upload, set the new item as selected — in MediaPicker **single**
  mode auto-pick + close; **multi** mode add to selection (stay open). Gate by mode/context so
  the **standalone Photos manager (gallery mode) is excluded**. Apply the same
  "select-the-just-uploaded" to the collection dialogs' upload paths.
- **Verify:** uploading a banner background / block image immediately uses it (no extra click);
  Photos manager upload still does NOT auto-select.

### 4. Remove emoji feature
- **Delete:** `lib/page-builder/EmojiTextInput.tsx` + `EmojiTextInput.test.tsx`.
- **Edit:** `lib/page-builder/StyleToolkitField.tsx` — remove import (L19), the three
  `EmojiButton` usages (L408/430/448), and the now-orphan refs (`headingRef` L391,
  `textRef` L392, `buttonLabelRef` L393) **only if** they're unused after removal (verify;
  the inputs themselves stay).
- **Verify:** no emoji UI in Heading/Text/Button controls; typecheck + grep clean (no `Emoji`
  refs left); StyleToolkitField tests pass.

### 5. Language toggler + RTL orientation (per-surface)
- **Existing pattern:** contact form already has `formLocale` (`ContactPanelDialog.tsx` L23/34-35/
  326-341; `FORM_LOCALES = ["","en","fil","ms","id"]`), tracked in `EditorShell` (state L398,
  persisted L591, passed L1607).
- **Generalize:**
  - Add `"ar"` (RTL) to the selectable locales.
  - Add an equivalent locale selector to **CollectionsPopupPanelDialog** and **HeaderPanelDialog**
    (their Setup sections); store each as a config field (`PortfolioCollectionsPopupConfig`,
    `PortfolioHeaderConfig` in `lib/page-builder/types.ts`), mirroring `formLocale`.
  - When the chosen locale is RTL (Arabic), **reveal a per-surface RTL/LTR override toggle** in
    that surface's Setup section; default it to the locale's natural direction (RTL for Arabic),
    user-overridable; baseline (no RTL locale) = LTR.
  - Apply `dir`/`lang` to each surface's **public** render wrapper
    (`PortfolioHeader.tsx`, the collections popup, `ContactForm.tsx`), and render that surface's
    **built-in/system strings** in the chosen locale (use next-intl messages already keyed for
    these surfaces; user-authored content is untouched).
- **Note:** respects the public-page language-isolation memory by scoping direction/locale to
  each public surface wrapper, not the whole CRM. Update that memory after landing.
- **Verify (Playwright, 375/768/1280):** each surface's built-in copy switches language;
  selecting Arabic flips that surface to RTL with logical spacing intact; the override toggle
  forces LTR; non-RTL locales never show the toggle.

### 6. Collections modal — min height + centered empty message
- **File:** `lib/page-builder/galleryPicker/CollectionPicker.tsx` (empty branch ~L195-242).
- **Fix:** wrap the list/empty region in a `min-h-[…]` (≈ one collection tile, ~180px) flex
  container that centers the empty message. Check `EditCollectionDialog` (~L281) for the same
  collapse if trivially adjacent.
- **Verify:** empty collections picker holds a stable ~one-tile height, message centered;
  populated state unchanged.

### 7. Featured (Collections) popup — warn when no Featured Work block
- **Files:** `EditorShell.tsx` (`openCollectionsPopup()` ~L1057-1064, section trigger ~L1364),
  detect a `FeaturedWork` block in current page data via `zoneDataRef`/zone content
  (`content.some(b => b.type === "FeaturedWork")` across Home/Gallery).
- **Fix:** when opening the Collections Popup panel with no Featured Work block present, show a
  warning modal: *"These styles only apply if you're using the Featured Work block."* With the
  block present, open normally. Localize copy in all 5 locales.
- **Verify:** no Featured Work block → warning shows; add the block → no warning.

### 8. Image upload errors immediately on click — REPRODUCE FIRST
- **File:** `lib/storage/uploadImage.client.ts` (`getFileDimensions` L20-34, `validatePhotoFile`
  L40-41, direct-upload fetch L48-54) + the upload click handlers in the pickers.
- Symptom: a synchronous error before any network request. **Reproduce first** (click upload in
  a block image control) to capture the actual throw; explore agents couldn't pin it statically.
- **Fix:** root-cause the pre-request throw (candidate: a synchronous access in the click/file
  handler, or `getFileDimensions` rejecting on object-URL handling) and guard it; surface real
  failures as user-facing errors, never a raw crash. Coordinate with #3 (same upload path).
- **Verify:** uploading an image succeeds end-to-end; induced failure shows a graceful error.

### 9–11. Header link color controls — separate active vs inactive
- **Files:** `HeaderPanelDialog.tsx` (Links section L465-514: `linkColor` L491-497,
  `brandTextColor` L499-505, `activeLinkColor` L507-513; Active Link Style section L516-580),
  `lib/page-builder/types.ts` (`PortfolioHeaderConfig` L155-204), `PortfolioHeader.tsx`
  (resolves L136-138; **bleed bug** L137 `brandTextColor` defaults to `linkColor`).
- **Fix:**
  - **9 (bleed):** make `brandTextColor` default to its own foreground token, not `linkColor`,
    so header text is independent of link color.
  - **10:** move the `activeLinkColor` control into the **Active Link Style** drawer (L516+).
  - **11:** add an **Inactive links** drawer and move `linkColor` into it.
  - Keep each control wired to only its target in `PortfolioHeader` render.
- **Verify:** changing link color leaves header text unchanged; active-link color lives in the
  active drawer and affects only active links; inactive color in the inactive drawer affects
  only inactive links.

### 12. Toggle buttons — consistent active color (neutral charcoal)
- **Files:** the segmented toggles in `ContactPanelDialog.tsx` (Tab size / Style) and
  `HeaderPanelDialog.tsx` (Active Link Style: Scale/Highlight/Underline); shared primitive in
  `components/ui/segmented-toggle.tsx` / toolbar primitives.
- **Fix:** unify the active/selected state of both on the **neutral charcoal** style
  (foreground bg + contrasting text token), so they match pixel-for-pixel. Prefer routing both
  through one shared toggle primitive if they currently diverge inline.
- **Verify:** both toggles show identical active color across 375/768/1280.

### 13. Featured Work — visible default styles
- **File:** `lib/page-builder/blocks/FeaturedWorkBlock.tsx` (`featuredWorkDefaultProps`
  L57-62; render `hasBg` L140, surface L152-153).
- **Fix:** add sensible defaults so a freshly added block has a visible surface — e.g.
  `minHeight: "medium"` (and a non-transparent default background already falls back to
  `--pf-color-bg`; set an explicit sensible default if the fallback is invisible on the page
  bg). Honor the effective-defaults pattern (don't materialize values that should stay unset
  unless needed for parity).
- **Verify:** a freshly dropped Featured Work block renders with a visible, non-transparent
  surface in canvas, preview, and publish.

---

## Skill refresh (user request)
After the relevant tasks land, update the `portfolio-*` skills for drift introduced/discovered:
- `portfolio-drafts` — note the debounced local autosave (task 1).
- `portfolio-blocks-and-design` / `portfolio-effective-defaults` — FeaturedWork defaults (13),
  header link-color drawers (9-11), removed emoji input (4).
- `portfolio-theme-brand-kit` — per-surface language/RTL + override toggle (5), charcoal toggle
  standard (12).
- `portfolio-editor-architecture` — record the container-anchor crash fix gotcha (2) and the
  new per-surface Setup sections (5).
Keep edits surgical and accurate; only document what actually changed.

## Execution strategy (file-ownership batching + commit checkpoints)
**All Playwright testing AND any browser-runtime fixes are deferred to the final wave** (user
directive). That includes #2 (container crash) and #8 (upload error) — both need a live repro,
so their fix lands in Wave E, not earlier. The static-implementation waves below ship code +
**Vitest unit/component tests** + `pnpm typecheck` + `pnpm lint` only; per-task "Verify" lines
above are acceptance criteria checked in Wave E.

Serialize tasks that share a file; parallelize disjoint ones (per delegation memo). Shared hot
files: `EditorShell.tsx` (1, 5, 7), `HeaderPanelDialog.tsx` (5, 9-11, 12),
`ContactPanelDialog.tsx` (5, 12), `types.ts` (5, 9-11), `CollectionsPopupPanelDialog.tsx` (5, 7).

- **Wave A (independent, parallel):** 4 (emoji removal), 6 (modal min-h), 13 (FeaturedWork
  defaults), 3 (auto-select upload — static part).
- **Wave B (header cluster, serial on HeaderPanelDialog/types):** 9-11 → 12.
- **Wave C (contact + popup + shell locale/RTL, serial):** 5 (contact + popup + nav locale +
  per-surface RTL/override) → 7 (Featured/Collections-popup warning).
- **Wave D:** 1 (debounce autosave) — serial on `EditorShell.tsx` after 5/7.
- **Wave E (browser, LAST — all Playwright + runtime fixes):** reproduce + fix 2 (anchor crash)
  and 8 (upload error); then Playwright (CLI, storageState) verification of every UI task at
  375/768/1280 (editor-only panels 768+1280): autosave smoothness (1), anchor no-crash (2),
  auto-select upload (3/8), language/RTL per surface (5), empty modal height (6), Featured
  warning (7), header link color separation (9-11), toggle parity (12), FeaturedWork visible
  default (13). Fix any findings here.
- **Wave F:** skill refresh + docs consolidation.

Each static wave: ship tests (data/component/handler as applicable), `pnpm typecheck` + `pnpm
lint`, all 5 locales updated together where copy is added.

### Commit checkpoints (guard against crashes)
First action at kickoff: copy this plan to repo `plan.md` and commit it. Then commit a small,
buildable checkpoint after **each completed task** (not one batch at the end), e.g.:
`c1` plan.md · `c2` task 4 · `c3` task 6 · `c4` task 13 · `c5` task 3 · `c6` tasks 9-11 ·
`c7` task 12 · `c8` task 5 · `c9` task 7 · `c10` task 1 · `c11` task 2 · `c12` task 8 ·
`c13` Playwright fixes · `c14` skill refresh + docs. Each checkpoint must pass typecheck+lint
(and its targeted tests) before committing. Branch is already `feat/portfolio-enhancements`.

## Verification (end-to-end)
- Targeted Vitest per touched area during dev (`pnpm test --run <fragment>`); full sweep at
  pre-merge.
- Playwright run is the entire Wave E (deferred per directive) — covers every UI task at the
  required breakpoints and is where #2/#8 are reproduced and fixed.
- `pnpm typecheck` + `pnpm lint` green at every checkpoint; indexes N/A (no new queries).
- Consolidate task docs into ONE `docs/portfolio/portfolio-enhancements.md` summary; delete
  scratch (including `plan.md`); update the public-page language-isolation memory.
