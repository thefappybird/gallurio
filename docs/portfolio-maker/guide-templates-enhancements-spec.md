# Portfolio Maker — Guide, Discard & Templates Enhancements

Spec for the current session's PR work. Items 0–6 from the user. Implementation
is gated on the user refining/approving this file.

## Step number ↔ code mapping

The tour shows `welcome` as **step 1**, so **user "step N" = `SPOTLIGHT_STEPS` index N−1**
(`app/[locale]/(app)/portfolio/_components/spotlightSteps.ts`). Confirmed mapping:

| User step | id | anchorId | gated? |
|---|---|---|---|
| 1 | welcome | — | no |
| 2 | blocks-panel-toggle | blocks-panel | yes |
| 3 | drag-block | canvas | yes |
| 4 | select-block | canvas | yes |
| 5 | properties-panel | properties-panel (the **toggle button**) | no |
| 6 | style-tab-content | style-tab-content | no |
| 7 | style-tab-design | style-tab-design | no |
| 8 | style-tab-layout | style-tab-layout | no |
| 9 | section-tabs | section-tabs | no |
| 10 | header-tab | header-tab | yes |
| 11 | logo-uploader | logo-uploader | no |
| 12 | header-nav-style | header-nav-style | no |
| 13 | contact-tab | contact-tab | yes |
| 14 | contact-form-preview | contact-form-preview | no |
| 15 | photos | photos | no |
| 16 | theme | theme | no |
| 17 | preview-device | preview-toggle | no |
| 18 | publish | publish | no |
| 19 | save-drafts | save-changes | no |

Relevant components: `SpotlightGuide.tsx` (overlay/positioning/buttons),
`useElementRect.ts` (anchor lookup via `[data-tour-id]`), `EditorShell.tsx`
(anchors + gate state), `HeaderPanelDialog.tsx` (header/nav sub-tabs).

---

## Item 0 — Actionable steps must not be "Next-able"

**Now:** every step renders a Next button; gated steps also auto-advance.
**Target:** on **actionable (gated)** steps the Next button is **hidden while the
gate is unsatisfied**, and **shown once the gate is satisfied** (you can also keep
the existing auto-advance on the unsatisfied→satisfied transition). This single
rule also fixes "Back into a completed gated step leaves you stuck" — arriving
with the gate already satisfied (e.g. block still on canvas) shows Next again.

**Decision:** actionable (gated, Next hidden until done) = **drag-block (3),
Navigation/header (10), contact (13)**. Steps 2 (blocks-panel) and 4
(select-block) are removed (Items 1 & 2), so after renumber the actionable steps
are drag-block + Navigation + Contact.

Files: `SpotlightGuide.tsx` (TooltipCard button logic), `spotlightSteps.ts`.

## Item 1 — Step 2 (blocks panel) appears skipped; jumps to step 3

**Decision:** panels are open by default, so the blocks-panel-toggle step is
pointless. **Remove the `blocks-panel-toggle` step entirely** (drop it from
`SPOTLIGHT_STEPS` and from the `gateSatisfied` switch).

## Item 2 — Step 4 (select-block) should not exist

Dropping a block already auto-selects it and opens the right (properties) panel,
so "Click a block to select it" is redundant. **Remove the `select-block` step.**
Adjust gate logic (drop `select-block` from `gateSatisfied`) and renumber.

Files: `spotlightSteps.ts`, `EditorShell.tsx` (gate switch), tests.

## Item 3 — Steps mis-anchored / mis-copied

- **Step 3 (drag-block):** tooltip sits on top of the left panel instead of to
  the right of it; highlight shadow doesn't fit. Re-anchor so the guide card sits
  beside the canvas drop area; tighten the cutout to the real target.
- **Step 5 (properties-panel):** anchored to the sidebar **toggle button**;
  should anchor to the **right properties panel** itself. Also Back doesn't work
  here (covered by Item 0's gate rule + Item 4's Back fix).
- **Step 10 (header-tab):** doesn't point at the nav tab; copy says "Customize
  your header" / "header settings" but the tab is labelled **Navigation**.
  Re-anchor to the Navigation tab; rewrite copy to "Navigation".
- **Step 11 (logo-uploader):** anchors fine but reads as actionable ("Upload your
  logo") when it's passive — reword so it's clearly informational, not a task.
- **Step 12 (header-nav-style):** doesn't point at the Navigation **Design** tab.
  Re-anchor. Additionally add a **new step before it** describing the Navigation
  **Setup** tab. So Navigation gets: Setup step → Design step.
- **Step 13 (contact-tab):** highlight is off — fix cutout/anchor.
- **Step 14 (contact-form-preview):** copy is wrong — we **cannot hide fields,
  only restyle them**. Replace with two steps: a **Setup** tab step and a
  **Design** tab step for the contact panel (mirrors Navigation).
- **Steps 15–17 (photos, theme, preview-device):** highlights are off — fix
  cutouts/anchors.

Anchoring fixes will be verified visually with Playwright (incl. 375px) during
implementation, since "off"/"doesn't fit" are visual judgements.

Files: `spotlightSteps.ts` (copy, placement, new steps), `EditorShell.tsx` /
`HeaderPanelDialog.tsx` (anchor placement + sub-tab `data-tour-id`s),
`SpotlightGuide.tsx` (cutout padding/positioning if the shadow fit is structural).

## Item 4 — Remove all "Skip this step" buttons; Back must work

- Remove the per-step **"Skip this step"** button entirely (currently shown on
  gated steps). "Don't show again" / overall exit stays.
- Ensure **Back** is present and functional on every step except step 1, and
  never bounces forward (handled by Item 0's "show Next once gate satisfied"
  rule, so a gated step reached via Back is escapable).

Files: `SpotlightGuide.tsx`, tests.

---

## Item 5 — Discard saved changes must actually scrap the draft edits

**Now:** `onDiscard` only does `localStorage.removeItem(draftKey)` then runs the
pending action — the canvas keeps the unsaved edits, so it behaves like "Keep
editing". (`EditorShell.tsx` ~1455.)

**Target:** Discard drops the in-memory/unsaved edits and reloads clean data,
then runs the pending action. Two cases:

- **5.1 — Discarding a brand-new, never-saved draft** (`activeDraftId === null`):
  remove this unsaved draft from local history, **fetch the next available draft**
  (`listDraftsAction` → newest, then `getDraftAction`), load it into the canvas,
  and clear the unsaved buffer.
- **5.2 — Discarding edits on a previously-saved draft** (`activeDraftId !== null`):
  **refetch that draft from the DB** (`getDraftAction(activeDraftId)`) and reload
  its saved data into the canvas, discarding the dirty edits.
- **5.3 — Loading indicators** while fetching in both cases (the discard button /
  canvas shows a spinner; reuse the existing `loading`/`saving` pattern).

**Decision (5.1 no-draft fallback):** if no other draft exists, load an **empty
scratch canvas** (empty Home/Gallery zones) and clear the unsaved buffer.

Files: `EditorShell.tsx` (onDiscard handler, load-into-canvas path, loading
state), `_draftActions.ts` (reuse existing actions), `UnsavedChangesDialog.tsx`
(spinner wiring), tests.

---

## Item 6 — Rebuild templates from user-authored saved layouts

**Decision (from user):** the user will **build the layouts themselves in the
editor and save them to the DB**; we then read that saved Puck JSON and convert
each into a template. Media kept as saved.

**Mechanism:**
1. User saves layouts (Home + Gallery zones) under a workspace they name.
2. We read the saved `PortfolioDraft.data` (`{ home, gallery }`) /
   `Workspace.publicPage` JSON from Mongo for that workspace.
3. Sanitize (strip workspace-specific ids as needed; keep structure + preset
   blocks + columns/containers per the user's constraint) and register as a
   `PortfolioTemplate` in `lib/page-builder/templates/`.

Constraint from user: templates should use **columns + containers (manual
blocks)** and the **preset blocks** — not ad-hoc one-off heroes.

**Blocked on user action:** waiting for the saved layouts + the workspace org
slug/name to read from. Parked until then.

Files: `lib/page-builder/templates/*` (new/updated template definitions + index),
a small read step against Mongo (no schema changes expected).

---

## Resolved decisions

- **Q1 (Item 0):** Actionable steps = drag-block, Navigation, Contact.
- **Q2 (Item 1):** Remove the blocks-panel step (panels open by default).
- **Q3 (Item 5.1):** No-draft fallback = empty scratch canvas.

## Done criteria (per CLAUDE.md)

Implementation complete; tests added/passing (guide nav/gating, discard cases,
tenant-scoped draft reads); `pnpm lint` + `pnpm typecheck` pass; locales
(en/fil/ms/id) updated for any changed guide copy; mobile checked at 375px via
Playwright; loading/empty/error states present for the discard fetch; errors
surfaced; Playwright run-through of the full tour + discard flow.
