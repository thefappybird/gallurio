# Portfolio builder fixes — guide, contact location, Columns, default surfacing (PR summary)

Branch: `enhance/portfolio-maker-guide-templates`. Follow-up batch on top of the
guide/templates enhancements. Four independent scope items shipped.

Chrome (editor + guide) is English-only per RELEASE-CHECKLIST §4f — no locale files
changed for guide copy. No public-facing copy changed, so no locale updates were needed.

---

## Item 1 — Guide / spotlight tour fixes

Files: `app/[locale]/(app)/portfolio/_components/{SpotlightGuide,EditorShell,SandboxEditorGuide}.tsx`,
`spotlightSteps.ts`, `useElementRect.ts`.

- **1a — "Try it" pill** recolored from the low-contrast `--accent` to `text-foreground` +
  `border-border` (pulsing accent dot kept) so it is visible on `bg-popover` in both
  themes. Copy → "Try it to continue to the next step". Pill shows only on gated steps.
- **1b — Step 2 "Drag a block"** anchored to the full left components panel
  (`data-tour-id="blocks-panel"`). Stays **gated** (drag required) per the 2026-06-23
  verbal override.
- **1c — Step 3 "Block properties"** anchored to the **full right panel**. Added a
  `RightPanelTourMarker` that sets `data-tour-id="properties-panel-full"` on the sidebar
  column (`gridRowStart === "right"`) — the earlier `properties-panel-body` covered only a
  sub-section.
- **1d — Steps 4–6 center-flicker** fixed in `useElementRect`: retain the last valid rect
  on a transient zero/unmeasurable read; only clear when the anchor is truly detached
  (`!el.isConnected`). Tooltip no longer falls back to viewport-center mid-step.
- **1e — Step 7 "Switch between pages"** anchored to a `section-tabs` wrapper spanning the
  five page tabs (Home → Contact Form). Copy → "Switch between the different parts of your
  portfolio website." Made a **regular non-gated step**.
- **1f — Step 8 "Open Navigation"** gate fixed. **Root cause:** gated steps blocked all
  clicks except the cutout hole; when the anchor rect was slightly off, the perimeter
  blocker rects covered the real Navigation button and ate the click, so the gate never
  cleared. **Fix:** gated steps now render a **visual-only dim** (no click-blocking layer),
  like passthrough steps, so the highlighted control is always clickable.

Verified live (Playwright, tablet 768 + desktop 1280 — editor is desktop-only, 375 skipped):
drag clears step 2 → reached step 8 → clicking Navigation advances 8→9 and opens the header
panel. Unit tests added: gated step renders 0 click-blockers, passive step renders >0.

## Item 2 — Public contact form location selector black bar

File: `app/(public)/w/[orgSlug]/_components/ContactForm.tsx` (scoped `<style>`).

- **Root cause:** `LocationPicker`'s `Input` carries `dark:bg-input/30`; the
  `.pf-contact-form` overrides set `color`/`border-color` but not `background-color`, so in
  the editor's dark context the field painted a dark fill → black bar.
- **Fix:** scoped `background-color: var(--pf-color-bg)` on `[data-slot="input"]` and on
  `.pf-contact-location button:not(li button)`. The `:not(li button)` (and the matching
  `color: inherit` exclusion) keep the Nominatim results-dropdown option buttons on their
  own styling — a Critical review finding where the rule had over-reached into the
  dropdown. Shared `location-picker.tsx` untouched, so the bookings selector is unchanged.

## Item 3 — Columns block (stuck at 2 columns; col/row span no-op)

Files: `lib/page-builder/blocks/manualBlocks.tsx`, `blockContext.ts`,
`editorConfig.tsx`, `StyleToolkitField.tsx`, `styleToolkit.ts`.

- The public grid is mobile-first via container queries (`@container pf-cols`) keyed on the
  `.pf-cols` element width, not the viewport. The editor canvas (~428px) is narrow, so a
  prior fix lowered the breakpoints to 320/640 — which regressed the **public** page to
  2 columns at 375px (violates mobile-first).
- **Decision (user):** public must be **single column at 375px**. Restored public
  breakpoints to 480/720. Added `puck.isEditing` to the block render context
  (`BlockPuck`) and, in the editor only, inject an inline
  `grid-template-columns: repeat(cols, minmax(0,1fr))` so the chosen count is visible in
  the narrow canvas. Public keeps the container-query breakpoints. Col/row span map to grid
  spans correctly. e2e (`item3-columns-grid.spec.ts`) asserts real computed tracks.

## Item 4 — Surface every block's default styling into its controls

Files: `lib/page-builder/fillBlockDefaults.ts` (new), `EditorShell.tsx`,
`blocks/manualBlocks.tsx`, `blocks/{GalleryGrid,GalleryMasonry,FeaturedWork}Block.tsx`,
`editorConfig.tsx`.

**Goal:** every default a block renders with should float up to its control as the
pre-filled, editable value — for new *and* existing saved pages — without changing any
rendered output.

**Mechanism:**
- Make `defaultProps` the source of truth where a control already exists: Columns
  `_style.gap = 16`; `bgAnimation = "crossfade"` + `bgSpeed = "medium"` added to
  `containerDefaultProps`, the gallery/featured-work defaultProps, and (via the
  Container shape) all preset blocks.
- New `fillBlockDefaults.ts` deep-fills **missing keys only** from `defaultProps` on editor
  load (recurses into `_style`, never touches arrays, never overwrites a user value).
  `prepareForEditor()` wraps it at every editor seed site in `EditorShell`. Pure
  in-memory — nothing is persisted until the user saves.
- Public render fallbacks (`?? "crossfade"`, `?? "medium"`, `gap ?? "1rem"`, the Container
  `padding: "1.5rem"` hardcode) are **kept** so old un-normalized blocks render unchanged
  on the public page. Result: byte-for-byte identical render; controls now pre-fill.

**Scope boundary (locked):** surface defaults *only where a control already exists*; no new
controls. Structural plumbing and control-less design hardcodes stay as-is.

**Two worklist rows deliberately not changed** (doing them literally would change rendered
output, violating the hard no-render-change rule):
- *Container padding "dedup":* the hardcoded outer `1.5rem` already equals
  `containerDefaultProps._style` and is the public fallback for un-normalized old blocks;
  removing it would drop padding on the public page.
- *Button `buttonStyle`:* the unset default is a distinct "legacy per-field" render branch
  that no `solid/outline/soft` value reproduces, so adding one to `defaultProps` would
  visually change existing buttons.

Verified: 132 unit tests (merge logic + render parity), live Playwright
(`item4-defaults-prefill.spec.ts`) confirms the Columns Gap control shows `16` for an
existing draft at desktop + tablet.

---

## Verification (whole batch)
- `pnpm typecheck` clean, `pnpm lint` 0 errors.
- Unit + e2e suites for the touched areas pass.
- UI items driven in a real browser via the Playwright CLI at tablet 768 + desktop 1280
  (editor is a desktop-only surface; the public Columns mobile-first behavior checked at
  375).
- No rendered-output regression for Item 4 (defaultProps == prior render fallbacks; public
  fallbacks retained).

## Side artifacts added on this branch (kept intentionally)
- Six portfolio knowledge skills under `.claude/skills/portfolio-*` and three subagents
  under `.claude/agents/` (senior frontend/backend engineer, SEO auditor).
- CLAUDE.md: one-doc-per-PR docs-hygiene rule; Playwright 3-breakpoint rule (375/768/1280;
  desktop-only surfaces may do tablet+desktop).
