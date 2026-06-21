# Strict Code Review — Portfolio Editor Batches 3–6

- **Branch:** `enhance/portfolio-public-pages`
- **Range reviewed:** `6fa2cf9..HEAD` (source only; `docs/` spec commits ignored)
- **Specs checked:** editor-chrome-polish (B3+4), theme-color-logo (B5), onboarding-spotlight-guide (B6)
- **Date:** 2026-06-21

## Verdict: **Ship with fixes** → all Should-fix resolved in `de2c180`

> **Resolution (post-review, commit `de2c180`):** All three Should-fix items addressed —
> (1) #9 header color swatch now debounced via `useDebounce` in `ColorSwatchRow` (live local value + 120ms commit + flush on blur; preset clicks stay immediate);
> (2) logo copy (`logoHelp`/`logoRequirements`/`logoErrors.type`) localized in `fil`/`ms`/`id` (were English placeholders);
> (3) `en.json` trailing newline restored. No Must-fix items were found. Nits left as noted (CollectionsPopupPanelDialog drawer extraction is a logged future candidate).

The work is well-built and faithful to the three specs. Typecheck clean, lint clean (0 errors; warnings all pre-existing), and 186 affected tests pass. The snapshot retirement (#6) is fully clean, the generic `UnsavedChangesDialog` is genuinely reused by the theme add-new guard (#10), the shared drawer is reused in all 3 spec'd panels (#3), and the logo uploader is correctly raster-only (no SVG). There are no Must-fix correctness or security blockers. The Should-fix items are one real spec deviation (#9 header swatch not debounced) and i18n copy drift on the logo strings.

---

## Findings

### Must-fix
_None._ No correctness regressions, no tenancy/security regressions, no dangling references.

### Should-fix

1. **#9 — Header color swatch is NOT debounced (spec deviation).**
   `app/[locale]/(app)/portfolio/_components/HeaderPanelDialog.tsx:113-119` — `ColorSwatchRow` uses a native `<input type="color">` whose `onChange` fires on every drag tick straight to `onToggle → set() → onHeaderChange`. `useDebounce` is **not imported** here. The Batch 5 spec (#9) explicitly lists "`HeaderPanelDialog.tsx` color swatch rows (~489–676) → `onHeaderChange`" as a debounce target. The shared `ColorPicker` path (BrandKitPicker) was correctly debounced, but the header swatch path was missed.
   - **Severity reduced** because header config is separate state (not Puck history), so the "one history entry per drag" symptom doesn't apply to the header; impact is a flood of re-renders + localStorage writes during a drag, not history pollution.
   - **Recommendation:** wrap the header swatch commit in `useDebounce` (or thread the native input through the shared `ColorPicker` popover the BrandKitPicker uses), flushing on blur/close. If intentionally descoped, note it in the spec/PR rather than leaving a silent gap.

2. **i18n — logo copy drift across locales.**
   `messages/en.json` updated `logoHelp`, `logoRequirements`, and `logoErrors.type` (now includes "SVG is not supported") for #11, but `fil/ms/id` were left with the **old English** placeholders (e.g. `"PNG, JPG, or WebP. Max 512 x 256 px and 250 KB."` and a type error with no SVG mention). These strings live in the localized `app.pageBuilder.editor.headerDialog` namespace, so non-en owners now see stale/inconsistent guidance and miss the SVG-rejection hint. (The 5 *theme* keys were correctly added to all 4 locales.)
   - **Recommendation:** mirror the three updated logo strings into `fil/ms/id` (translated, or at least the corrected English) so the SVG guidance and the tightened limits copy are consistent. Per project i18n rule, locale files update together.

3. **`messages/en.json` lost its trailing newline.**
   The diff ends with `\ No newline at end of file`. Minor, but it dirties future diffs. Re-add the trailing newline.

### Nits

4. **Stale doc comment in `spotlightSteps.ts:7-12`.** The header comment names gate ids `"open-header"` / `"open-contact"`, but the actual gating keys on step **id** (`"header-tab"`, `"contact-tab"`) in `EditorShell.tsx:942-959` and on the `gated` boolean in `SpotlightGuide`. Code is consistent; only the comment is wrong. Update the comment to avoid misleading future maintainers.

5. **Gated step + missing anchor can block interaction (edge case, not currently reachable).** `SpotlightGuide.tsx:505-508` passes `rect={null}` to `DimWithCutout` whenever the anchor is missing; the `null` branch (`SpotlightGuide.tsx:233-236`) renders a full-screen `pointer-events-auto` scrim. For a **gated** step that means the user cannot reach the real editor to satisfy the gate — they'd rely on the always-present "Skip this step"/Esc escape (so not *trapped*, just can't complete the gesture). In practice the gated anchors (`blocks-panel`, `canvas`, `header-tab`, `contact-tab`) are always present on desktop; `canvas` is absent only if the guide reaches drag-block while in preview/side-panel. Consider: when `gated && !hasMeaningfulRect`, drop the full-screen blocker (let clicks through) so the user can still act.

6. **Tour anchors that only exist on one tab.** Steps `logo-uploader` (Setup tab) and `header-nav-style` (Design tab) both live in `HeaderPanelDialog`, but only one tab renders at a time; likewise `style-tab-*` anchors exist only when a block is selected. These are passive steps so they recenter gracefully (verified), but the tour won't actually highlight 6.1/6.2/style-tabs unless the user happens to be on the right tab. Acceptable for v1 per spec ("recenter or skip"), but worth a live eyeball.

7. **`CollectionsPopupPanelDialog` still has a local `DesignDrawer`.** Out of scope for #3 (spec only lists StyleToolkit/Contact/Header), but it's now the lone holdout. Worth adding to the extraction follow-up so the convergence finishes.

---

## Verification basis

**Confirmed statically (high confidence):**
- **#6 snapshot retirement is clean:** no `createPreviewSnapshotAction` / `findPreviewSnapshot` / `PreviewSnapshot` / `?preview=` references remain in `app`/`lib`/`components` (only spec docs + a test name string). `lib/db/models/PreviewSnapshot.ts` deleted, removed from `models/index.ts`, and `findPreviewSnapshot` dropped from `publicPage.ts`. Public route `app/(public)/w/[orgSlug]/page.tsx` renders solely from the published workspace with no preview-token branch — still tenant-scoped via `findPublishedWorkspaceBySlug(orgSlug)`. Open-in-new-tab now does `window.open(previewBasePath, …)` (`EditorShell.tsx:1067`).
- **#19 discard aborts publish:** `onDiscard` (`EditorShell.tsx:1414-1418`) clears localStorage, nulls `pendingAction` **without running it**, and calls `setPublishOpen(false)`. Covered by a passing test.
- **#18/#20 generic save modal:** `UnsavedChangesDialog` is parameterized (`name/onNameChange/nameError/title/nameLabel/body`), renders `role="alert"` error above Save, disables Save on error. Reused by both the draft flow (`EditorShell.tsx:1399`) and the theme add-new guard (`ThemePanelDialog.tsx:160`) — genuinely one component, no parallel copy.
- **#3 shared drawer:** `EditorDrawerGroup`/`EditorDrawerSection` used by StyleToolkitField, ContactPanelDialog, HeaderPanelDialog; registered in `REUSABLE_CODE.md`; TabHeader logged as extraction candidate C-11.
- **#10 theme flow:** `useThemeEditor` add-new guard validates with the correct `excludeId` (edit mode) vs draft mode, surfaces `duplicate` and keeps the modal open, and only overwrites a saved theme via the explicit edit (pencil) path — fork-on-edit means color/font changes create a new unsaved variant (`changeControl` sets `currentTheme`), so presets/saved themes are not silently overwritten. No path observed that loses a theme or overwrites unintentionally.
- **#11 logo raster-only:** `accept="image/png,image/jpeg,image/webp"`, client validation rejects non-`LOGO_TYPES` with a type error that now says SVG unsupported (en), inline `role="alert"` error, prominent requirements line. No SVG/XSS vector introduced.
- **#9 ColorPicker debounce:** spectrum drag → `emitDebounced` (120ms trailing); hex input/presets → `emitImmediate` (flush + commit); unmount flushes pending. Benefits BrandKitPicker automatically. (Header swatch is the gap — see Should-fix 1.)
- **Tenancy/security:** all draft actions still gate on `requireOrg()` + `role==="owner"` and filter every read/mutation by `workspaceId`; no client-supplied `workspaceId`. Public route unchanged in scoping. No secrets/tokens introduced.
- **Encoding:** no BOM on any touched file; no mojibake observed in the locale edits.
- **Gates:** `pnpm typecheck` clean; `pnpm lint` 0 errors; 186 affected tests pass (`EditorShell`, `SpotlightGuide`, `UnsavedChangesDialog`, `TemplatePickerDialog`, `EditorDrawerSection`, `useThemeEditor`, `useDebounce`, `color-picker`, `ThemeGrid`, `ThemeTile`, `HeaderPanelDialog`, `themeTiles`).

**Needs a live run (Playwright/manual) — not verifiable statically:**
- **Spotlight guide interactivity (#5):** dim+cutout pointer pass-through on gated steps, tooltip on-screen positioning at 375px, focus landing on the card + Esc→skip, z-index above the header/contact panels the tour opens (9990/9991 vs dialog z-50 looks correct in code), and that drag→select→tab gating advances on real Puck events. The missing-anchor gated-step edge (Nit 5) and one-tab-only anchors (Nit 6) specifically need eyeballing.
- **Theme modal (#10/#10.1):** the `[name | ✕ | Save]` inline row, add-new tile always-last, and the add-new guard opening/duplicate-error/discard/keep-editing paths render correctly at 375px.
- **#3 visual parity:** that the contact/header drawers actually match Puck's block panel divider/spacing/typography side-by-side (spec's stated verification step).
- **#9:** confirm a header color drag still feels live and (after the fix) commits once.

---

## Per-item adherence

| Item | Spec'd | Implemented | Notes |
|---|---|---|---|
| #3 shared drawer | One `EditorDrawerSection`/`Group`, flush stacking, reused in 3 panels, registered | Yes — group draws border + `divide-y`, section borderless; used by StyleToolkit/Contact/Header; in REUSABLE_CODE | CollectionsPopup still has local DesignDrawer (out of scope; Nit 7). Visual parity needs live check. |
| #18/#20 save modal | Generic name input + `role=alert` error above Save, API gated | Yes — parameterized, error above Save, Save disabled on error | Reused by theme guard. Solid. |
| #19 discard aborts publish | Close both dialogs, clear pending without running | Yes (`EditorShell.tsx:1414-1418`) | Test-covered. |
| #6 open-in-new-tab | Re-point to `/portfolio-preview`, retire snapshot if unused | Yes — `window.open(previewBasePath)`; snapshot fully removed | No dangling refs; public route intact. |
| #9 color debounce | Debounce all 3 swatch paths (~120ms), flush on close | Partial — ColorPicker (BrandKit) done; **header swatch missed** | Should-fix 1. |
| #10/#10.1 theme flow | One editable surface, always-on add tile, `[name|✕|Save]`, fork-on-edit, add-new guard via reused modal | Yes — add tile always rendered, ✕ discards/reverts, fork-on-edit, guard reuses `UnsavedChangesDialog` with duplicate-keep-open | No unintended overwrite/loss path found. |
| #11 logo clarity | Raster-only, prominent limits, inline validation errors, reject SVG | Yes — accept excludes SVG, inline `role=alert`, tightened copy, type error names SVG | i18n drift on non-en (Should-fix 2). |
| #5 spotlight guide | Portal overlay above dialogs, cutout, tooltip (progress/Back/Next/Skip/don't-show), gated steps interactive + Skip-this-step, graceful missing-anchor | Yes — 17-step list, gates via Puck state/panel flips, Esc→skip, focus mgmt, z-index 9990/9991 | Gated+missing-anchor blocks interaction (Nit 5, not currently reachable); stale comment (Nit 4). Live run advised. |
| #4 sequencing | guide → entry; brand-new → template-welcome, returning → entry; dismissed skips to entry | Yes — `openEntryAfterGuide` keys on `!hasRecoverableBuffer && drafts.length===0`; entry/welcome gated behind guide when not dismissed | Brand-new vs returning detection consistent across mount + post-guide. Test-covered. |

---

## Step-count note
The spec lists a "14-stop" tour; `spotlightSteps.ts` ships 17 steps (it expands 4.1/4.2/4.3, 6.1/6.2, 7.1 into discrete entries, which the spec's own table also enumerates). The progress indicator reads "N of 17" — internally consistent and matches the enumerated table, just not the "14" headline number. Cosmetic only.
