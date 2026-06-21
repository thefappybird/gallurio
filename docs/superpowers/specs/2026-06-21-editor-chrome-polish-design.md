# Editor Chrome Polish — Design Spec (Batches 3 + 4)

- **Branch:** `enhance/portfolio-public-pages`
- **Date:** 2026-06-21
- **Scope:** Bundled Batch 3 (#3) + Batch 4 (#6, #18, #19, #20) of the portfolio-enhancements effort.
- **Surface:** Portfolio editor chrome — `app/[locale]/(app)/portfolio/_components/` plus shared editor primitives under `lib/page-builder/`.
- **Chrome is English-only** (RELEASE-CHECKLIST §4f) — no locale-file changes in this batch.

File/line references are accurate as of branch HEAD and may drift as edits land. They are starting points, not contracts.

---

## Goals

1. The contact and nav editing drawers look and stack like Puck's own block-design drawer — sleek, flush, no jarring gapped dividers — and stay that way (shared component, not three copies).
2. The "Save your changes?" modal lets the user name/rename the draft inline and shows validation errors in red directly above Save, with the API gated on a valid name.
3. Discarding unsaved changes during a publish attempt cleanly aborts the whole flow (no orphaned publish modal).
4. "Open in new tab" shows a real, working preview of the current draft (saved *or* unsaved) — never an error page — by reusing the same route the in-app Preview tab already uses.

## Non-Goals

- Tab-bar (`TabHeader`) extraction — logged as a future extraction candidate, not done here.
- Brand-kit / theme parity work for preview beyond what the in-app Preview tab already does.
- In-preview navigation between Home/Gallery/Contact (the navigable full-site preview was explicitly deferred — minimal reuse only).
- Any change to publish semantics, draft persistence shape, or tenant scoping.

---

## A. `#3` — Shared editor drawer + flush stacking

### Problem
Three places render a near-identical collapsible "design drawer" section with their own copy of the markup, and they have already drifted:

- `lib/page-builder/StyleToolkitField.tsx` (Puck block panel) — the **reference** look: drawer wrapper `border border-border`, header `px-3 py-2 text-xs font-medium uppercase tracking-wide`, open body `border-t border-border p-3`.
- `app/[locale]/(app)/portfolio/_components/ContactPanelDialog.tsx` — local `DesignDrawer` (~lines 287–312): heavier `text-xs font-semibold uppercase tracking-widest`, body `p-4`, panel title `text-sm font-semibold`.
- `app/[locale]/(app)/portfolio/_components/HeaderPanelDialog.tsx` — local `DesignDrawer` (~lines 241–266): same heavier styling.

Beyond per-section styling, the contact/nav panels **stack** their sections with `gap-4` between fully-bordered boxes, producing gaps + doubled borders — the "jarring divider" the user called out. Puck stacks its drawers flush so adjacent borders collapse into a single hairline.

### Approach
Extract one shared, sleek drawer primitive and converge all three call sites on it.

- **New `lib/page-builder/EditorDrawerSection.tsx`:**
  - `EditorDrawerSection` — props `{ title: string; defaultOpen?: boolean; children: ReactNode }`. A single collapsible section. Header: `min-h-11 w-full px-3 text-xs font-medium uppercase tracking-wide text-foreground hover:bg-accent` with a chevron affordance and `aria-expanded`. Open body: `flex flex-col gap-3 p-3`. The section itself carries **no outer box border** — the group draws the frame.
  - `EditorDrawerGroup` — wraps a list of sections: one outer `border border-border` and a single hairline `border-t border-border` between adjacent sections (think `divide-y` semantics), **no inter-section `gap`**. This yields Puck's continuous, flush look.
- **Refactor the three call sites** to render `EditorDrawerGroup` + `EditorDrawerSection`, deleting the local `DesignDrawer` / inline drawer wrappers.
- **Flatten nested accordions** in the contact/nav panels (groups-within-groups, e.g. ContactPanelDialog ~440–656) into the single flush list so dividers stay uniform.
- **Tighten the panel chrome** for full parity, not just the sections: panel body `p-4 → p-3`; panel title `text-sm font-semibold → text-sm font-medium`.
- **Register** `EditorDrawerSection` / `EditorDrawerGroup` in `REUSABLE_CODE.md`.
- **Extraction candidate (not now):** the duplicated tab bar (`TabHeader` in StyleToolkitField vs the inline tab bars in the panels) — add to the "Extraction candidates" section of `REUSABLE_CODE.md`.

### Verification
- During implementation, eyeball the contact/nav panels side-by-side with a live Puck block panel to confirm divider/spacing/typography actually match.

---

## B. `#20` + `#18` — Save modal: inline title input + error above Save

These two items both target the same dialog and ship together.

### Current
- The "save modal" is `UnsavedChangesDialog` ("Save your changes?"), built on `AlertDialog` (`components/ui/alert-dialog.tsx`). Structure ~lines 21–55: header (title + description) then a footer with three buttons — **Keep editing**, **Discard**, **Save**.
- It has **no** title input and **no** error display today.
- `draftName`, `setDraftName`, `nameError`, `setNameError`, and the pure `validateDraftName()` (EditorShell ~496–504, checks empty + duplicate-vs-`drafts`) already exist but are **not** passed into the dialog.
- Draft name is currently editable only via `DraftNameEditor` in the header.

### Approach
- **New props on `UnsavedChangesDialog`:** `draftName: string`, `onDraftNameChange: (next: string) => void`, `nameError: string | null`.
- **Title input (#20):** render a labeled `Input` (`components/ui/input.tsx`, which auto-styles `aria-invalid`) between the description and the footer. `value={draftName}`, `onChange → onDraftNameChange`, `aria-invalid={!!nameError}`, accessible label "Draft name".
- **Error above Save (#18):** when `nameError` is set, render it as `<p role="alert" className="text-xs text-destructive">` immediately above the footer/Save button (consistent with `DraftNameEditor` / `TemplatePickerDialog` error styling).
- **Gate the API:** Save remains blocked / no-ops while `nameError !== null` (folds into the existing `handleSaveChanges` early-return + disabled state). Editing the title in the dialog runs `validateDraftName` and updates `nameError` live.
- **Build it generic (reuse by Batch 5).** The same dialog is reused by Batch 5's theme save-guard, so build it parameterized rather than draft-specific. Keep the prop shape neutral — e.g. `name` / `onNameChange` / `nameError` / `onSave` / `onDiscard` / `onKeepEditing`, plus optional `title` and `nameLabel` — so one consumer can pass draft-name + `validateDraftName` + the draft duplicate set, and another can pass theme-name + theme-name validation + the existing-theme-names set. Do not hardcode "draft" copy into the component; pass it in. See `2026-06-21-theme-color-logo-design.md` → "Dependency on Batch 3+4".

---

## C. `#19` — Discard aborts the publish flow

### Current
- Publish modal: `PublishDialog` (`components/ui/dialog`), open state `publishOpen` / `setPublishOpen` (EditorShell ~283).
- Guarded actions queue into `pendingAction` (~308). The unsaved-changes `onDiscard` handler (EditorShell ~1286–1291) clears the draft from localStorage, captures `pendingAction`, nulls it, and **runs it** — so if the queued action was "open publish", Discard ends up opening/leaving the publish modal. The publish modal is never closed by Discard.

### Approach
- Change `onDiscard` so it **aborts**: close the unsaved-changes dialog, call `setPublishOpen(false)`, and clear `pendingAction` **without running it**. Result: Discard throws away unsaved edits and cancels the publish attempt, returning the user to the editor with both dialogs closed.

---

## D. `#6` — Open-in-new-tab shows the real draft preview

### Current
- The in-app **Preview tab works well**: it is an `<iframe src="/portfolio-preview?zone=…&v=nonce">` (EditorShell ~881, ~1206). The route `app/[locale]/portfolio-preview/page.tsx` is owner-gated (`requireOrg()` + `role === "owner"`), `metadata.robots` noindex, `dynamic = "force-dynamic"`. For home/gallery it renders `PreviewClient` (client `@measured/puck` `<Render>`) reading the **live localStorage draft** (key `gallurio:portfolio-draft:${slug}`, includes unsaved edits); contact/header render from the saved draft config.
- The **open-in-new-tab** button uses a *different*, broken path: `handleOpenPublicPreview` (EditorShell ~900–920) calls `createPreviewSnapshotAction` (writes a 2h-TTL `PreviewSnapshot` doc) then opens `/w/${slug}?preview=${token}`. The public route only swaps `data.home` from the snapshot and otherwise renders the **published** workspace — so on an unpublished draft it shows an error page.

### Approach (minimal reuse — the in-app preview, full-screen)
- Re-point the open-in-new-tab button to open the **existing working preview route**: `window.open('/portfolio-preview', '_blank', 'noopener,noreferrer')` (locale-prefixed to match `previewBasePath`), defaulting to the Home zone. This gives full parity with the Preview tab the user already likes, works on unpublished drafts, needs no snapshot, and needs no disable/hide state.
- **Retire the snapshot path only if unused:** if nothing else references `createPreviewSnapshotAction` / `findPreviewSnapshot` / `?preview=` after the re-point, remove them; if anything else still depends on them, leave them in place (out of scope to chase).
- **No in-preview navigation** between zones (deferred). The new tab mirrors the single-zone in-app preview.

---

## Testing

All Vitest + Testing Library via `test-utils/render.tsx`. Chrome is English-only — no locale parity tests.

- **A (#3):** new `EditorDrawerSection` / `EditorDrawerGroup` render tests — renders title, toggles open/closed (`aria-expanded`), shows children, and a `Group` of two sections renders exactly one divider between them (flush, no gap). Keep existing `ContactPanelDialog` / `HeaderPanelDialog` tests green after refactor.
- **B (#18/#20):** `UnsavedChangesDialog` tests — renders the title `Input` seeded with `draftName`; typing fires `onDraftNameChange`; when `nameError` is set, an `role="alert"` `text-destructive` message renders above Save and Save is disabled. EditorShell test: opening the save flow with a duplicate name surfaces the error in the modal and does **not** call the save action.
- **C (#19):** EditorShell test — with the publish flow queued and unsaved changes, clicking **Discard** closes both the unsaved-changes dialog and the publish modal (`publishOpen` false) and does not run the queued publish action.
- **D (#6):** EditorShell test — the open-in-new-tab control invokes `window.open` with a `/portfolio-preview` URL (mock `window.open`), and no longer calls `createPreviewSnapshotAction`.

## Pre-merge gates

- Affected tests pass; `pnpm typecheck` (`rtk tsc`); `pnpm lint` (`rtk lint`).
- 375px check: contact/nav panels and the save/publish dialogs render correctly (panels stay `w-[360px]`; dialog fits mobile).
- Encoding safety: no BOM / mojibake introduced (scan touched files).

---

## Acceptance Criteria

- Contact and nav drawers use the shared `EditorDrawerSection`/`EditorDrawerGroup`; sections stack flush with a single hairline divider (no gapped boxes); typography/padding match Puck's block panel; component registered in `REUSABLE_CODE.md`.
- "Save your changes?" modal contains a draft-title input; editing it validates live; a duplicate/empty name shows a red error above Save and blocks the save API call.
- Clicking **Discard** during a publish attempt closes both dialogs and aborts the publish.
- "Open in new tab" opens `/portfolio-preview` and shows the current draft (saved or unsaved) for published *and* unpublished drafts — no error page; snapshot path removed if unused.
- Tests pass; typecheck and lint clean; 375px verified.

---

## Affected files (index)

| Item | Files |
| --- | --- |
| #3 | `lib/page-builder/EditorDrawerSection.tsx` (new), `lib/page-builder/StyleToolkitField.tsx`, `app/[locale]/(app)/portfolio/_components/ContactPanelDialog.tsx`, `app/[locale]/(app)/portfolio/_components/HeaderPanelDialog.tsx`, `REUSABLE_CODE.md` |
| #18/#20 | `app/[locale]/(app)/portfolio/_components/UnsavedChangesDialog.tsx`, `EditorShell.tsx` |
| #19 | `EditorShell.tsx` (onDiscard ~1286–1291) |
| #6 | `EditorShell.tsx` (handleOpenPublicPreview ~900–975); possibly `_draftActions.ts` (retire snapshot if unused) |
