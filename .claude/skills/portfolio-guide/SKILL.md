---
name: portfolio-guide
description: Internals and gotchas of Gallurio's portfolio editor spotlight tour (the guided "Guide" walkthrough with numbered steps, dim+cutout highlight, and "Try it" gated steps). Use this WHENEVER you touch, debug, or extend the tour — a step highlighting the wrong element, the tooltip jumping to center, a gated step that won't advance, the "Try it" pill, adding/reordering steps, or anything in SpotlightGuide / spotlightSteps / useElementRect / SandboxEditorGuide. The tour has a non-obvious sandbox-dual-shell + portal + overlay architecture; read this before editing so you don't burn hours rediscovering it.
---

# Portfolio spotlight tour internals

The tour is gotcha-dense. The files:
`app/[locale]/(app)/portfolio/_components/` → `SpotlightGuide.tsx`, `spotlightSteps.ts`,
`useElementRect.ts`, `SandboxEditorGuide.tsx`; plus `EditorShell.tsx` (anchors + gates).

## Mental model
- Clicking **Guide** mounts `SandboxEditorGuide` — a full-screen overlay
  (`<div aria-label="Portfolio editor guide" class="fixed inset-0 z-[9980]">`) that renders
  a **SECOND `EditorShell` in `guideMode`** against scratch data. The real editor (drafts,
  localStorage, server) is never touched. So at runtime **two EditorShells exist and both
  render the same `data-tour-id` attributes.**
- `SpotlightGuide` renders the dim+cutout and the tooltip card **via `createPortal` to
  `document.body`** — they are NOT inside the overlay container in the DOM.

## The four gotchas that bite
1. **Dual-shell anchor scoping.** `useElementRect(anchorId, queryRoot)` resolves
   `[data-tour-id="..."]`. Because both shells render the same ids, an unscoped
   `document.querySelector` finds the REAL shell's element → cutout lands in the wrong place.
   `SandboxEditorGuide` passes its container as `guideQueryRoot` → `EditorShell` →
   `SpotlightGuide`'s `queryRoot` → `useElementRect`'s `root`, scoping the lookup to the
   sandbox subtree. If a new anchor mispoints, suspect scoping first.
2. **Gated steps are visual-only — they MUST NOT block clicks.** `DimWithCutout` renders
   the dim (an SVG mask, `pointer-events-none`) plus, for PASSIVE steps only, transparent
   `pointer-events-auto` blocker rects around the cutout. For `gated` (and `passthrough`)
   steps NO blocker rects render, so the highlighted control is always clickable regardless
   of pixel-perfect rect accuracy. Historically gated steps blocked everything except the
   cutout hole; when the anchor rect was even slightly off, the blocker covered the real
   control and ate the click so the gate could never satisfy. Keep gated = no blockers.
3. **`useElementRect` rect retention.** A rAF loop re-measures each frame so the cutout
   tracks the live position. It **retains the last valid rect** on a transient `(0,0)`
   reading (mid-layout) instead of nulling (which would jump the tooltip to viewport
   center — the old steps 4-6 flicker bug). It clears to null only when the element is
   truly gone (`!el.isConnected`) or absent on effect re-run.
4. **Playwright must target the portal.** Tooltip Next/Back/Skip live in `<body>` via the
   portal, not in the overlay container — see `portfolio-testing`.

## Steps & gating (`spotlightSteps.ts`, `SPOTLIGHT_STEPS`)
- 19 steps; the UI shows "N of 19" and that number == array index + 1.
- A step: `{ id, anchorId?, title, body, placement?, gated?, passthrough? }`. Chrome is
  English-only — copy is hardcoded here, NOT in locale files.
- **Gate ids** (`EditorShell.tsx` `gateSatisfied`, ~1061): `drag-block` (content count >
  baseline; needs `passthrough` so the drag can cross panel→canvas), `header-tab`
  (`headerOpen`, set by `openHeader()` when the Navigation tab is clicked), `contact-tab`
  (`contactOpen`). When a gated step's condition flips true, the engine auto-advances.
- `gated` steps hide Next until satisfied and show the "Try it" pill (style on
  `bg-popover`-contrasting tokens, not `--accent`, or it's invisible).

## Anchors (`data-tour-id`, in `EditorShell.tsx` unless noted)
`blocks-panel` (left panel) · `properties-panel-full` (full right column — marked
dynamically by `RightPanelTourMarker`, which climbs to the Puck column with
`gridRowStart==="right"`) · `section-tabs` (wraps the five page tabs) · `header-tab`
(Navigation button) · `contact-tab` · `style-tab-content/-design/-layout`
(`StyleToolkitField.tsx`) · `photos` · `theme` · `preview-toggle` · `save-changes` · `publish`.

## When editing
- Adding a step: add to `SPOTLIGHT_STEPS` with a real `anchorId` (or none for a centered
  card). If it anchors something inside a panel that opens later, gate the prior step so the
  panel is open when this step runs (else its anchor doesn't exist → center flicker).
- Verify in a REAL browser (`portfolio-testing`), not just unit tests — the failure modes
  here are runtime overlay/scoping/timing, invisible to jsdom.
