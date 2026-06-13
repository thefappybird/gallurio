# Portfolio Maker — Bug Fixes Spec

- **Branch:** `fix/portfolio-maker`
- **Date:** 2026-06-13
- **Scope:** 12 portfolio-maker editor/public-page bug fixes
- **Codebase-memory project:** `D-Portfolio-Projects-gallurio-.claude-worktrees-fix-portfolio-maker`

File/line references are accurate as of branch point off `dev` (`8409b0a`) and may drift as fixes land. Primary surface is `app/[locale]/(app)/portfolio/_components/`.

---

## Decisions locked with product (2026-06-13)

1. **Templates (#3):** Click *selects/highlights* a template; a separate **Apply / "Use template"** button commits it. No warning modal, no apply-on-click.
2. **Standout buttons (#7, #10):** Save changes and Preview each get their **own distinct color**, both styled to stand out like Publish but neither using Publish's primary.
3. **Public 500 (#12):** No deployed site; reproduced via `pnpm build && pnpm start`. Worked before the WorkOS + organizations-in-Mongo migration. Treated as a regression from that migration — **reproduce-first, then fix root cause**.

---

## Affected files index

| Area | File |
| --- | --- |
| Editor shell (orchestrator) | `app/[locale]/(app)/portfolio/_components/EditorShell.tsx` |
| Drafts list/modal | `app/[locale]/(app)/portfolio/_components/DraftsDialog.tsx` |
| Draft title field | `app/[locale]/(app)/portfolio/_components/DraftNameEditor.tsx` |
| Unsaved-changes modal | `app/[locale]/(app)/portfolio/_components/UnsavedChangesDialog.tsx` |
| Template picker | `app/[locale]/(app)/portfolio/_components/TemplatePickerDialog.tsx` |
| Collections popup panel | `app/[locale]/(app)/portfolio/_components/CollectionsPopupPanelDialog.tsx` |
| Collections popup preview | `app/[locale]/(app)/portfolio/_components/CollectionsPopupPreview.tsx` |
| Entry dialog (start from scratch) | `app/[locale]/(app)/portfolio/_components/PortfolioEntryDialog.tsx` |
| Publish dialog (style reference) | `app/[locale]/(app)/portfolio/_components/PublishDialog.tsx` |
| Server actions | `app/[locale]/(app)/portfolio/_actions.ts` |
| Button variants | `components/ui/button.tsx` |
| Main app sidebar | `components/app/app-sidebar.tsx` |
| Sidebar primitive (mobile sheet) | `components/ui/sidebar.tsx` |
| Public portfolio render | `app/(public)/w/[orgSlug]/layout.tsx`, `page.tsx`, `gallery/page.tsx` |
| Middleware | `proxy.ts` |
| Public query | `lib/db/queries/publicPage.ts` |

---

## Items

### 1. Start-from-scratch should clear the canvas immediately
- **Current:** Starting from scratch (`onStartScratch` → `applyTemplate`, EditorShell ~702-731 via `setPuckSeed()` remount) does not visibly wipe the canvas until the user switches section tabs.
- **Desired:** The canvas reflects the cleared/seeded state immediately, no tab switch required.
- **Approach:** Trace why the Puck remount (`puckSeed` key change) doesn't repaint the *currently visible* zone. Likely the active section is not reset / the visible zone reads stale data until a section change forces a re-render. On apply, reset the active section and force the canvas to re-render against the new seed in the same tick.
- **Acceptance:** After start-from-scratch, the visible canvas shows the new empty/template state with no tab change. Covered by an EditorShell test that asserts canvas content updates after the action without a section switch.

### 2. Icon buttons for Apply and Delete in drafts list
- **Current:** Text buttons (`DraftsDialog` ~107-125).
- **Desired:** Icon buttons — Apply (e.g. `Check`/`CheckCircle2`), Delete (`Trash2`) — each with `aria-label` + tooltip/visible label for a11y. Ships idle/hover/focus-visible/active/disabled states. Delete still routes through the existing confirm `AlertDialog`.
- **Locale:** Move action labels to `aria-label`/tooltip strings; update all 4 locales.
- **Acceptance:** Apply/Delete render as labeled icon controls, keyboard-operable, with confirm flow intact.

### 3. Template switching → select then Apply (no warning, no apply-on-click)
- **Current:** `TemplatePickerDialog` click sets `pending` (~78) and opens a destructive **warning** `AlertDialog` (~141-164); confirm calls `onConfirm(id)` → `applyTemplate`. The old apply-on-click intent is broken.
- **Desired:** Clicking a template only **selects/highlights** it (clear selected state). A dedicated **Apply / "Use template"** button in the dialog footer commits it (`onConfirm(pendingId)` → `applyTemplate`). Remove the switch-warning `AlertDialog` entirely.
- **Approach:** Keep `pending` as selection state; render selected styling on the chosen thumbnail; remove nested warning dialog; add footer Apply button disabled until a template is selected.
- **Locale:** Add `apply`/`useTemplate` strings; remove now-unused warning strings (4 locales).
- **Acceptance:** Clicking a template highlights without applying; Apply commits; no warning modal appears.

### 4. Prompt to save when clicking "Add new draft"
- **Current:** `DraftsDialog` Add-new (~138-140) → `onAddNew` → opens template picker directly; unsaved edits silently abandoned.
- **Desired:** If there are unsaved changes, route Add-new through the save guard (`guardThenRun`) so the "Save your changes?" flow runs first; if clean, proceed directly.
- **Dependency:** Must satisfy #11 — validation runs *before* the modal opens.
- **Acceptance:** With dirty state, Add-new triggers the save prompt (post-validation); with clean state, it opens the picker immediately.

### 5. Fixed-width draft title with ellipsis; smaller error text
- **Current:** `DraftNameEditor` display span `truncate text-sm font-medium`; input hardcoded `w-44`; error `text-xs text-destructive` (~87-91). When the error string is longer than the title, the title field leaves dead space.
- **Desired:** Title display has a **fixed width** with ellipsis truncation so it reads `New Draft lorem ipsum do…[edit btn]` with the edit button tight to the truncated text. Error message rendered in a **smaller** type size beneath.
- **Approach:** Apply a fixed/max width (e.g. `max-w-[12rem]`) + `truncate` to the title element with `title={name}` for the full value; tighten the edit-button gap; reduce error to a smaller token (e.g. `text-[11px]`/`text-2xs`).
- **Acceptance:** Long titles ellipsize; edit button hugs the title; error text is visibly smaller; verified at 375px.

### 6. On small screens, move the draft title above the Puck page
- **Current:** `DraftNameEditor` lives in the header's right `toolsCluster` (EditorShell ~834-838); on narrow screens it gets smushed against the right edge.
- **Desired:** Below a small breakpoint, the draft title renders as its own full-width row **above** the Puck canvas; on larger screens it stays in the header.
- **Approach:** Conditionally place `DraftNameEditor` in a responsive container — header slot on `sm+`, dedicated row above the canvas on `<sm` (Tailwind responsive utilities; avoid duplicate-mount state bugs).
- **Acceptance:** At 375px the title sits on its own row above the canvas, not crushed in the header; desktop layout unchanged.

### 7. Make "Save changes" stand out; never call the API on a validation error
- **Current (style):** `variant="outline"` (EditorShell ~851-860) — subtle. Publish uses `variant="default"` (primary).
- **Current (bug):** `handleSaveChanges` (~452-489) calls `createDraftAction`/`updateDraftAction` **unconditionally**; `saveDisabled = !isDirty && activeDraftId !== null` ignores `nameError`. A known-invalid name still fires the API.
- **Desired:** Save changes uses a **distinct standout color** (its own, not Publish's primary — see #10 for Preview's separate color). The save handler short-circuits when a validation error is present (or the name fails sync validation) — no API call.
- **Approach:** Add an early guard in `handleSaveChanges` returning before any action call when `nameError` is set / name invalid; fold `nameError` into the disabled/blocked state; restyle the button (distinct variant/token).
- **Acceptance:** With a duplicate/invalid name, clicking Save performs **no** network call and surfaces the error; button is visually prominent and distinct from Publish.

### 8. Collections popup preview not showing on canvas
- **Current:** When the Collections Popup tab is open, EditorShell (~1001-1009) renders a split layout with `CollectionsPopupPreview` beside `CollectionsPopupPanelDialog`. Reported: the preview does not appear on the canvas when the tab is checked.
- **Desired:** Selecting the Collections Popup tab shows its live preview on the canvas area.
- **Approach (diagnose-first):** Confirm whether (a) the tab actually sets `collectionsPopupOpen`/`openCollectionsPopup`, (b) `CollectionsPopupPreview` returns null due to config/brand-kit gating, or (c) the Puck canvas still occupies the area instead of the split layout. There is an existing expectation in `EditorShell.test.tsx` ("renders the collections popup preview when the popup tab is open") — reconcile test vs. runtime. Fix the broken link so the preview renders and updates on `onChange`.
- **Acceptance:** Opening the Collections Popup tab shows the preview; editing config updates it live. Test passes against real behavior.

### 9. Close the main sidebar on link click (small/medium screens)
- **Current:** `app-sidebar.tsx` nav items render `<Link>` (~110); the mobile sheet (`components/ui/sidebar.tsx` ~182-205, `openMobile`/`setOpenMobile`) stays open after navigation. The **main** app sidebar only (not the Puck sidebar).
- **Desired:** On small/medium screens, clicking a nav link closes the main sidebar.
- **Approach:** Wire nav `<Link>` `onClick` to `setOpenMobile(false)` via `useSidebar()` when in the mobile/sheet state. Desktop unaffected.
- **Acceptance:** At small/medium widths, tapping a nav link navigates and closes the sidebar; desktop behavior unchanged.

### 10. Preview button: inline beside Contact Form + standout color
- **Current:** Preview button (EditorShell ~816-824) sits in `navCluster` (`flex flex-wrap … gap-2`, ~786) and wraps onto its own line; `variant="outline"`.
- **Desired:** Preview renders **inline** with the Contact Form control / section tabs (no orphan line) and uses a **standout color distinct from both Publish and the Save-changes color** (per "separate colors each").
- **Approach:** Adjust the `navCluster` grouping/flex so the Preview toggle stays inline with the tab group at relevant breakpoints; restyle to a distinct variant/token.
- **Acceptance:** Preview sits inline beside the Contact Form control; visually prominent; color differs from Publish and from Save changes. Verified at 375px (acceptable wrap behavior defined, not an orphan line).

### 11. Validate before opening any "Save your changes?" modal
- **Current:** `guardThenRun` (~492-498) opens `UnsavedChangesDialog` (~1083-1100); validation runs **inside** the modal (`onSave` → `handleSaveChanges`). Users hit the modal, then must back out to fix the name.
- **Desired:** Every action that would open the save modal first runs name validation; if invalid, surface `nameError`, focus the title editor, and **do not open** the modal.
- **Approach:** Add a sync validation gate at the top of `guardThenRun` (and any other entry points: apply draft, apply template, nav clicks, Add-new from #4). Only open the modal when the name is valid.
- **Acceptance:** With an invalid name, no save modal opens; the title error is shown and focused. With a valid name, the modal opens as before.

### 12. Public portfolio returns 500 (regression from WorkOS/org migration)
- **Symptom:** `/w/[orgSlug]` returns HTTP 500 for visitors under `pnpm build && pnpm start`, even when published. Worked before the WorkOS AuthKit + organizations-in-Mongo migration.
- **Evidence gathered:**
  - `proxy.ts:48` includes `"/w/(.*)"` in `UNAUTHENTICATED_PATHS`; `proxy.ts:133` `NextResponse.next()`s `/w/` before authkit **and** before next-intl. So auth gating is **not** the cause, and **intl middleware is deliberately skipped** for `/w/` (comment proxy.ts:130-131: running intl would rewrite to `/[locale]/w/…` and 404).
  - **No auth imports** anywhere under `app/(public)` (`getAuthUser`/`withAuth`/`ensureUser`/`requireOrg`/`@workos`) — public-render-calls-auth theory **disproven**.
  - `lib/db/queries/publicPage.ts` was **not** changed by the WorkOS merge.
  - `proxy.ts` **was** rewritten in `67c2297` (Clerk→WorkOS); the explicit `/w/` intl-skip is part of that rewrite.
- **Lead hypothesis:** The public pages call `getTranslations({ locale, namespace })` but, because intl middleware is skipped for `/w/`, the next-intl request context (locale/messages) is never established and no `setRequestLocale(locale)` is called — throwing under `build && start`. This is consistent with the regression timing (proxy rewrite in the migration).
- **Secondary hypotheses (rank after stack capture):** Puck `<Render>` throwing on a block/config mismatch (no error boundary in `app/(public)`); a `publicPage`/`branding` field dereference; locale resolution from `workspace.country`.
- **Plan (reproduce-first):**
  1. Reproduce: `pnpm build && pnpm start`, request `/w/<published-slug>`, **capture the server stack trace** (this branches the fix).
  2. Add an `app/(public)/error.tsx` (and consider `global-error.tsx`) so the failure surfaces and is contained instead of a bare 500.
  3. Fix per the captured stack — if next-intl: initialize the request locale for the public route (`setRequestLocale(locale)` in layout + both pages, and/or wrap public chrome in `NextIntlClientProvider` with the resolved messages); if Puck/field: guard/normalize the offending data.
  4. Regression test: a public-render test that asserts `/w/[orgSlug]` renders for an unauthenticated request with a published workspace and does not throw.
- **Acceptance:** Published `/w/[orgSlug]` (Home + Gallery + Contact) renders 200 for an unauthenticated visitor under `pnpm build && pnpm start`; root cause documented; regression test green; `error.tsx` boundary present.

---

## Cross-cutting requirements

- **Locales:** Update `en`, `fil`, `ms`, `id` together for every new/changed string (#2, #3, and any new control labels). No `th`.
- **Mobile-first 375px:** #5, #6, #9, #10 verified at 375px; every touched async surface keeps loading/empty/error/populated states; controls keep idle/hover/focus-visible/active/disabled.
- **A11y:** Icon buttons (#2) labeled; title field (#5) keeps accessible name; focus management on validation (#7, #11); sidebar close (#9) keyboard-operable.
- **Tenant safety:** No change to `workspaceId` scoping; public query stays `orgSlug → workspaceId` (#12).
- **No optimistic API on invalid state:** #7 and #11 must block the network call before it fires.

## Testing strategy

- Component/interaction tests in `EditorShell.test.tsx` and per-dialog tests for: start-from-scratch repaint (#1), template select-then-apply (#3), save-prompt-on-add-new (#4), save blocked on invalid name (#7), validate-before-modal (#11), collections preview render (#8).
- Sidebar close-on-nav test for mobile (#9).
- Public render regression test for `/w/[orgSlug]` (#12) using in-memory Mongo with a published workspace; no external service mocking beyond what already exists.
- Pre-merge gates: affected tests, `pnpm typecheck`, `pnpm lint`, locale consolidation, 375px check.

## Out of scope

- Any redesign of the Puck block set or template content.
- Quote/negotiation flows, billing, inquiry lifecycle changes.
- Reintroducing the template switch-warning (explicitly removed in #3).
- A deployed-environment investigation for #12 (no deployed site exists yet).

## Open questions / risks

- #12 root cause is a **hypothesis** until the stack trace is captured; the fix branch (next-intl vs. Puck vs. data) is decided at reproduce time. Mitigated by adding the `error.tsx` boundary regardless.
- #6/#10 responsive reflow must avoid double-mounting stateful editors (title editor, Preview toggle) across breakpoints.
- #8 may be a test-vs-runtime divergence; confirm the existing test reflects real behavior before changing code.

## Next step

After review/approval of this spec, proceed to the **implementation plan** (writing-plans) — one ordered, test-first plan covering items 1–12 with checkpoints.
