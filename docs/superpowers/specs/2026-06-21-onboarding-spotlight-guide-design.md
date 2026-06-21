# Onboarding: First-Load Template Modal + Spotlight Guide — Design Spec (Batch 6)

- **Branch:** `enhance/portfolio-public-pages`
- **Date:** 2026-06-21
- **Scope:** Batch 6 — #4 (first-load template modal for brand-new users) + #5 (spotlight guide engine, replacing the readme overlay).
- **Surface:** `app/[locale]/(app)/portfolio/_components/*` (EditorShell + entry/guide components), a new spotlight engine, `data-tour-id` anchors across the editor chrome, and the existing `Workspace.publicPage.guideDismissedAt` persistence.
- **Chrome is English-only** — no locale-file changes.

This is the largest batch. The two items are tightly coupled because the guide gates the first-load entry sequence.

File/line references are accurate as of branch HEAD and may drift.

---

## Context: what exists today

- **Entry flow:** `PortfolioEntryDialog` (non-dismissible chooser: Continue / Load existing / Start from scratch) auto-opens on load; for a brand-new user only "Start from scratch" is live → opens `TemplatePickerDialog` (6 templates). Server seeds a default template by `workspace.businessType` (`seedDefaultPortfolio()`).
- **"Guide" today:** `PortfolioGuideOverlay.tsx` — a **6-step modal readme** (Build/Style/Photos/Theme/Preview/Publish) that shows text only; it highlights nothing. Opens on load when `guideDismissedAt === null`; reopenable via a "Guide" button; "Don't show again" → `dismissPortfolioGuideAction()` sets `Workspace.publicPage.guideDismissedAt`.
- **No tour engine** exists (no joyride/driver.js/shepherd; nothing element-anchored).
- **Anchors:** most chrome buttons lack stable identifiers; a spotlight needs `data-tour-id` attributes added.
- **New-vs-returning signal at mount:** `initialDrafts` (length), `initialActiveDraftId`, `hasRecoverableBuffer`, and the seeded `publicPage` are all available in EditorShell.

**Decision:** the spotlight guide (#5) **replaces** `PortfolioGuideOverlay` entirely. It reuses the same dismissal flag (`guideDismissedAt`), action, and "Guide" reopen button.

---

## #5 — Spotlight guide engine

### Overlay mechanics
- A new `SpotlightGuide` component renders a **portal overlay above the dialogs**. It dims the viewport and cuts out a **hole around the active target's bounding rect** (computed from `getBoundingClientRect`, re-measured on scroll/resize via observers). A **tooltip card** is positioned near the target showing: step title, body copy, progress ("3 of 14"), **Back / Next**, **Skip**, and a **"Don't show again"** affordance on Skip/Finish.
- **Targets are referenced by `data-tour-id`.** The engine queries `[data-tour-id="<id>"]`; a step whose anchor is missing or hidden (e.g. a panel collapsed on mobile) is gracefully **skipped or recentered**, never blocking.
- **Step model:** `{ id, anchorId?, title, body, placement?, gate? }`. `gate` is absent for passive steps and one of a small set of conditions for action-gated steps (below).

### Passive vs action-gated steps
- **Passive step:** plain **Back / Next**. The dim overlay blocks interaction with the rest of the editor.
- **Action-gated step:** advances when a **real event** fires, AND keeps a visible **"Skip this step"** (→ Next) escape so no one is trapped. For gated steps the **highlighted target is interactive** — pointer events pass through the cutout to the real editor so the user can actually drag/click/open it. Copy is framed as a prompt ("Try it: …").
- **Gate detection (no polling hacks):**
  - **drag-block** (step 2): subscribe to **Puck state** via the shared `usePuckStore` selector; the active zone's content count increasing by ≥1 means a block was dropped.
  - **select-block** (step 3): `usePuckStore` `selectedItem` (or appState selection) becomes non-null.
  - **open-tab: layout|design|content** (steps 4.1–4.3): read the `StyleToolkitField` active-tab state.
  - **open-panel: header|contact** (steps 6, 7): the EditorShell `headerOpen` / `contactOpen` (or `activeSection`) state flips.
  - Each gate also accepts the manual **Next** as an equivalent advance.

### Persistence, reopen, mobile
- **Persistence:** reuse `Workspace.publicPage.guideDismissedAt` + `dismissPortfolioGuideAction()`. "Don't show again" sets it; otherwise the guide will run again next load. (Optional, low-cost: a localStorage `gallurio:portfolio-tour-step:${slug}` to resume mid-tour within a session — not required for v1.)
- **Reopen:** the existing **Guide** button restarts the tour at step 0.
- **375px:** the tooltip repositions to stay on-screen; panel-toggle / side-panel steps adapt (the side panels are collapsed on mobile — those steps recenter their copy or skip the highlight).

### Anchors to add (`data-tour-id`)
Add stable `data-tour-id` to: blocks-panel toggle, properties-panel toggle, the Puck canvas wrapper, Home/Gallery section tabs, Header-settings tab, Contact tab, Photos button, Theme button, Preview toggle, device toggle, Publish button, Save-changes button, Drafts button. Style tabs (Layout/Design/Content) get `data-tour-id` inside `StyleToolkitField`. The just-dropped block can be targeted via Puck's selected-item DOM node.

### Step list (v1)

| # | anchor (`data-tour-id`) | gate | copy (draft) |
|---|---|---|---|
| 0 | — (center) | — | "Welcome — here's a quick, hands-on tour." |
| 1 | blocks-panel-toggle | open-panel *(or Next)* | "Open the blocks panel." |
| 2 | blocks-panel + canvas | **drag-block** | "Try it: drag a block onto your page." |
| 3 | the new block | **select-block** | "Now click the block to select it." |
| 4 | properties-panel | auto (post-select) | "Selecting a block opens its properties here." |
| 4.1 | style-tab-layout | open Layout *(or Next)* | "Layout: size, spacing, and position." |
| 4.2 | style-tab-design | open Design *(or Next)* | "Design: colors, borders, corners." |
| 4.3 | style-tab-content | open Content *(or Next)* | "Content: the block's text and media." |
| 5 | section-tabs | — | "Switch between your Home and Gallery pages." |
| 6 | header-tab | **open header panel** *(or Next)* | "Customize your header here." |
| 6.1 | logo-uploader | — | "Upload your logo (PNG/JPEG/WEBP)." |
| 6.2 | header-nav/style | — | "Set your navigation links and header style." |
| 7 | contact-tab | **open contact panel** *(or Next)* | "Your inquiry form lives here." |
| 7.1 | contact-form-preview | — | "Choose fields and styling — the form layout itself is fixed." |
| 8 | photos-button | — | "Upload and organize your photo collections." |
| 9 | theme-button | — | "Pick your colors and fonts." |
| 10 | preview-toggle + device-toggle | — | "Preview your site at any screen size." |
| 10.1 | publish-button | — | "When you're happy, publish to go live." |
| 11 | save-changes + drafts | — | "Save drafts and switch versions anytime. Reopen this tour via **Guide**." |

Copy is editor chrome (English-only). Steps 6.1/6.2 and 7.1 only highlight after their panel is open (they follow the gated open-panel step).

---

## #4 — First-load template modal + sequencing

### Required sequencing
```
On editor load:
  guideDismissedAt == null ? run SpotlightGuide ──(finish OR skip)──▶ entry
                           : ───────────────────────────────────────▶ entry   (guide skipped)
entry:
  brand-new user (no drafts, no published page, no recoverable buffer)
        ─▶ TEMPLATE-FIRST WELCOME modal  (pick a template to start)
  returning user
        ─▶ normal entry flow (PortfolioEntryDialog: Continue / Load existing)
```
- The guide always precedes entry when not dismissed; the template-welcome / entry flow only opens **after** the guide finishes or is skipped.
- "Don't show again" users skip straight to entry (brand-new → template-welcome; returning → normal flow).

### Template-first welcome modal
- Reframe the template selection as a **welcoming "Pick a template to start" modal** for brand-new users (reuse `TemplatePickerDialog`'s grid + apply path; new framing/copy, e.g. a welcome heading). Selecting a template applies it via the existing `applyTemplate` and drops the user onto the canvas with an unsaved new draft (current behavior).
- Returning users keep the existing `PortfolioEntryDialog` chooser unchanged.
- The brand-new welcome modal should still allow "start from scratch / blank" as an option (parity with today's start-from-scratch).

---

## Testing

Vitest + Testing Library; the gated interactions are driven via the mocked Puck state already used in `EditorShell.test.tsx`. English-only — no locale parity tests.

- **Engine:** `SpotlightGuide` renders the active step's copy + progress; Next/Back navigate; Skip closes and (when chosen) calls `dismissPortfolioGuideAction`; a missing anchor recenters/skips without throwing.
- **Gating:** a `drag-block` step advances when the mocked Puck content count increases; `select-block` advances when `selectedItem` is set; tab steps advance when the active tab changes; panel steps advance when `headerOpen`/`contactOpen` flips; the "Skip this step" fallback advances a gated step without the event.
- **Sequencing (#4):** with `guideDismissedAt == null`, the guide renders first and the template-welcome / entry flow does NOT render until the guide finishes/skips; brand-new → template-welcome modal; returning → `PortfolioEntryDialog`; with `guideDismissedAt` set, the guide is skipped and entry shows immediately.
- **Replacement:** `PortfolioGuideOverlay` is removed and no longer referenced; the Guide button now opens `SpotlightGuide`.
- **375px:** the tooltip stays on-screen; panel-collapsed steps recenter/skip.

## Pre-merge gates
- Affected tests pass; `pnpm typecheck` (`rtk tsc`); `pnpm lint` (`rtk lint`).
- 375px verified for the tour + template-welcome modal.
- Encoding safety: no BOM/mojibake in touched files.

---

## Acceptance Criteria
- The readme `PortfolioGuideOverlay` is replaced by an element-anchored `SpotlightGuide` with a dim+cutout overlay and a tooltip card (progress, Back/Next/Skip, Don't-show-again).
- The tour runs the 14-stop step list, including the action-gated drag → select → Layout/Design/Content tab steps and the gated open-header / open-contact steps, each with a working Skip-this-step fallback.
- The guide runs on load unless dismissed; after it finishes/skips, brand-new users get the template-first welcome modal and returning users get the normal entry flow.
- Persistence/reopen reuse `guideDismissedAt` + the Guide button.
- `data-tour-id` anchors are added to the listed chrome elements.
- Tests pass; typecheck + lint clean; 375px verified.

---

## Open risks / notes
- **Gated steps need real interactivity through the cutout** — verify pointer-events pass-through doesn't let stray clicks dismiss the tour; the dim area should swallow clicks while the hole forwards them.
- **Puck DOM targeting** for the just-dropped/selected block relies on Puck's selected-item node; if no stable node is exposed, fall back to anchoring the properties panel instead of the in-canvas block.
- **Tour vs. dialogs z-index:** the spotlight sits above existing `z-50` dialogs; confirm the header/contact panels (which the tour opens) render with the tour still visible above them.

---

## Affected files (index)

| Item | Files |
| --- | --- |
| #5 engine | new `app/[locale]/(app)/portfolio/_components/SpotlightGuide.tsx` (+ step definitions + a small `useElementRect`/observer hook), `EditorShell.tsx` (mount, gate wiring via `usePuckStore`, Guide button), `lib/page-builder/StyleToolkitField.tsx` (tab `data-tour-id` + active-tab exposure), `data-tour-id` across chrome elements; remove `PortfolioGuideOverlay.tsx` |
| #4 sequencing | `EditorShell.tsx` (load sequence: guide → entry), `PortfolioEntryDialog.tsx` (returning), `TemplatePickerDialog.tsx` (brand-new welcome framing) |
| persistence | reuse `Workspace.publicPage.guideDismissedAt`, `app/[locale]/(app)/portfolio/_actions.ts` `dismissPortfolioGuideAction` (no schema change) |
