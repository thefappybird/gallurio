# Portfolio Maker — Overhaul Spec (guide, editor fixes, templates)

> Executable spec for branch `enhance/portfolio-maker-guide-templates`.
> Source of truth for this work — execute items in the order in §Sequencing.
> Each item has: **Problem → Root cause → Target behavior → Files → Acceptance**.
> Check boxes as work lands. Templates (#10) are **last** — they depend on the block fixes.

## Decisions (locked)

- **Guide**: anchored-tooltip overlay, **free Next/Back** (no forced actions), running on a
  **separate sandbox editor instance** seeded with scratch (non-persisted) data. Real
  portfolio data is never touched.
- **Canvas overflow**: page **grows to fit content** (no fixed-height clipping).
- **Columns**: shared segmented "count" control — buttons `1/2/3` + a 4th number-input
  button (same color/style) for custom counts up to **6**. `rows` uses the same control with
  **Auto** (default).
- **Gallery blocks**: get the same Content/Design/Layout tabs + drawers as `Container`,
  minus the Typography drawer.
- **Templates**: no bespoke branding — each uses a distinct carried theme preset (Minimal/
  Editorial/Luxury/Bold/Romantic/Modern); content uses the default text/headers we ship.

## Constraints (from CLAUDE.md — apply to every item)

- Server Components by default; validate at boundaries with Zod; tenant-scope every query
  by `workspaceId` (N/A here — UI + static template data, no new query shapes expected).
- Mobile-first @375px; every async surface ships loading/empty/error/populated; every
  control ships idle/hover/focus-visible/active/disabled; no hover-only UX.
- Update all 4 locales together: `en`, `fil`, `ms`, `id`. No `th`.
- Design tokens only; controls use `--radius`, frames use `--radius-surface`.
- Every change ships tests. Pre-merge: affected tests + `pnpm typecheck` + `pnpm lint` + build.
- Reuse before building (check `REUSABLE_CODE.md`); never name the auth provider in copy.

---

## Component inventory (the only blocks templates/guide may use)

**Presets (8):** HeroPreset, AboutPreset, ServicesPreset, CtaPreset, ContactPreset,
GalleryGridPreset, GalleryMasonryPreset, FeaturedWorkPreset.
**Manual (14):** Heading, Text, Image, Button, Spacer, Divider, **Columns**, **Container**,
GalleryGrid, GalleryMasonry, GalleryCarousel, FeaturedWork, Video, ContactDetails.

Config: `lib/page-builder/editorConfig.tsx` (editor) / `lib/page-builder/config.ts` (prod).
Keys: `lib/page-builder/blockCategories.ts`.

---

## Item 5 — Button corner radius into the Button style section

- **Problem:** the button corner-radius control does nothing.
- **Root cause:** `ButtonBlock` hardcodes `tkBorderRadius = "var(--pf-radius)"`
  (`lib/page-builder/blocks/manualBlocks.tsx:303`) and ignores `_style.radius`; Button is
  in `TEXT_ONLY_BLOCKS` so the Design→Frame radius drawer is hidden — no working control.
- **Target behavior:**
  - `ButtonBlock` uses `_style.radius` when set; falls back to `var(--pf-radius)` when unset
    (existing buttons keep brand-kit radius).
  - A corner-radius picker appears in the Button **style** section (the buttonStyle/size/
    position area in `LayoutTabBody`, `StyleToolkitField.tsx` ~1450–1498). Reuse the existing
    `RadiusButtons` component (`StyleToolkitField.tsx:639`). Not in the Frame drawer.
- **Files:** `blocks/manualBlocks.tsx`, `StyleToolkitField.tsx`.
- **Acceptance:**
  - [ ] Changing the picker visibly changes a button's corner radius in canvas + public render.
  - [ ] Unset radius → renders brand-kit `--pf-radius` (no regression on existing buttons).
  - [ ] Picker shows all control states @375px.
  - [ ] Test: `_style.radius` set → resolved style uses px value; unset → uses CSS var.

## Item 6 — Flatten single-drawer tabs

- **Problem:** a tab with only one drawer still shows an accordion header.
- **Root cause:** `EditorDrawerSection`/`EditorDrawerGroup` always render the header
  (`lib/page-builder/EditorDrawerSection.tsx`).
- **Target behavior:** when a tab/group has exactly one drawer, render its children flat
  (no header, no collapse). Prefer a helper in `EditorDrawerSection.tsx` so all call sites
  in `StyleToolkitField` (Content/Design/Layout) benefit.
- **Files:** `EditorDrawerSection.tsx`, `StyleToolkitField.tsx`.
- **Acceptance:**
  - [ ] Single-drawer tab: contents render flat (no chevron/header).
  - [ ] Multi-drawer tab: unchanged (accordion sections remain).
  - [ ] Test: group with 1 child → no header; group with 2 → headers present.

## Item 6.1 — First drawer open on tab visit

- **Problem:** all drawers default closed.
- **Target behavior:** the first drawer of a tab is open when that tab is first shown; on
  tab switch the first drawer of the newly shown tab opens. Track open-state per tab in
  component state (not the module-level `blockTabStore`).
- **Files:** `EditorDrawerSection.tsx` (accept/propagate `defaultOpen`), `StyleToolkitField.tsx`.
- **Acceptance:**
  - [ ] Visiting a tab shows its first drawer expanded.
  - [ ] Switching tabs expands the first drawer of the new tab.
  - [ ] Does not fight item 6 (flattened single-drawer tabs need no open-state).

## Item 7 — Columns container rows/columns

- **Problem:** columns is `2|3` only; rows is a free number; inconsistent; no "auto".
- **Target behavior:**
  - `columns` control = a segmented "count" control: buttons styled identically (same
    color/size) for `1`, `2`, `3`, **plus a 4th button that is an inline number input**
    (same styling) for custom counts up to **6**. Effective range 1–6.
  - `rows` uses the **same segmented control** (synced look + behavior): `Auto` (**default**),
    `1`, `2`, `3`, + number-input button up to **6**. Render treats `Auto`/`1` as auto-flow.
  - Build one small **shared count control** (buttons + inline number input) reused by both
    fields — implemented as a Puck custom field (`type: "custom"` with a render fn) rather
    than two different input types. Place it in `lib/page-builder/` and register in
    `REUSABLE_CODE.md`.
  - Update `ColumnsBlockProps` types/defaults, `ColumnsBlock` grid CSS (handle 1–6 cols +
    explicit rows), and **both** configs: `columnsBlockConfig` (`manualBlocks.tsx:544`) +
    editor `columns` (`editorConfig.tsx:765`). Raise the max from 3/12 to **6**.
- **Files:** `blocks/manualBlocks.tsx` (props/defaults/render/config), `editorConfig.tsx`,
  new shared count-control component.
- **Acceptance:**
  - [ ] Columns 1–6 render correct grid templates; 1/2/3 via quick buttons, 4–6 via the
        number input; control clamps to 1–6.
  - [ ] Columns + rows controls look identical (same button styling).
  - [ ] rows=Auto (default) → line breaks spawn new rows (auto-flow); rows=N → N explicit rows.
  - [ ] Existing saved Columns (old rows number / 2–3 cols) still render (back-compat).
  - [ ] All control states @375px (idle/hover/focus/active/disabled on buttons + number input).
  - [ ] Test: columns 1–6 grid template; rows Auto vs N CSS; clamp behavior.

## Item 8 — Canvas overflow: page grows to fit content

- **Problem:** tall blocks (e.g. CTA `min-height:100vh`) spill past the page frame
  (see `C:\Users\alexb\Downloads\page overflow.jpeg`).
- **Root cause:** canvas root sets `minHeight:100%` with no containment; viewport-height
  blocks escape the visual page.
- **Target behavior:** the canvas page is content-driven — the page/background/frame
  expands to wrap content; tall blocks extend the page instead of overflowing a clipped
  frame. No fixed `height`/`max-height` on the canvas surface.
- **Files:** `RootCanvasStyle.tsx` (`buildCanvasCss`/container CSS), `config.ts`
  (`PF_PAGE_CONTAINER`/root render), and any block forcing viewport height in-editor
  (`manualBlocks.tsx` / preset blocks).
- **Acceptance:**
  - [ ] CTA repro: page extends to contain the CTA; frame wraps it; nothing spills past.
  - [ ] No regression to normal-height pages.
  - [ ] Playwright screenshot of the repro confirms containment @375px and desktop.

## Item 9 — Gallery blocks: editable container/banner

- **Problem:** Photo Grid / Masonry / Highlights show a background div that can't be edited
  (see `C:\Users\alexb\Downloads\gallery image container.jpeg`).
- **Root cause:** `GalleryGridBlock`, `GalleryMasonryBlock`, `FeaturedWorkBlock` render
  hardcoded inner wrappers (`maxWidth + margin:auto`) and have no banner props; only the
  outer `<section>` honors `_style`.
- **Target behavior:** give the 3 gallery blocks the **same Content/Design/Layout tabs +
  drawers as `Container`**, minus the **Typography** drawer (galleries have no body text).
  i.e. treat them as "container-like" in `StyleToolkitField`: banner/background controls in
  Content, Frame + Effects in Design, Layout drawers in Layout — **plus** their existing
  gallery-specific content fields (collections/columns/gap). Reuse, don't re-implement:
  - Add the container banner/layout props (`backgroundImages[]`, `bgAnimation`, `bgSpeed`,
    `overlayOpacity`, padding, min-height, `alignX`/`alignY`) to the 3 gallery prop types.
  - In `StyleToolkitField`, include the 3 gallery block types in the "container-like"
    predicate so they get the container tab/drawer set; **explicitly exclude the Typography
    drawer** for them.
  - In each render, apply the banner (reuse `ContainerBackgroundSlideshow` like
    `ContainerBlock`) and make the inner wrapper padding/max-width/min-height style-driven.
- **Files:** `blocks/GalleryGridBlock.tsx`, `blocks/GalleryMasonryBlock.tsx`,
  `blocks/FeaturedWorkBlock.tsx` (+ `FeaturedCollectionsClient.tsx`),
  `StyleToolkitField.tsx`, `editorConfig.tsx`/`config.ts`, `manualBlocks.tsx` (shared types).
  Reuse: `ContainerBackgroundControls`, `ContainerBackgroundSlideshow`, container field set.
- **Acceptance:**
  - [ ] Each gallery block shows the **same tabs/drawers as Container except Typography**.
  - [ ] Background color/image-slideshow/overlay/padding/min-height/align controls render +
        persist; public render matches editor.
  - [ ] Back-compat: existing gallery blocks render unchanged when new props unset.
  - [ ] Control states @375px; tests per block for banner/layout prop application.

## Items 2/3/4 — Guide redesign (anchored overlay on a scratch sandbox)

- **Problem (item 2/4):** the guide "is just a 19-step modal" — it appears centered every
  step; only the style-tab steps move, and they're in reverse order
  (screenshot at "5 of 19"). **Problem (item 3):** footer actions overflow the 320px card,
  especially when "Skip this step" is shown.
- **Root cause:** anchoring via `[data-tour-id]` + `useElementRect` exists, but most anchor
  targets resolve to **zero-size/missing rects** → `hasMeaningfulRect=false` → tooltip
  centers. The canvas tour anchor is `className="contents"` (`display:contents` → zero box,
  `EditorShell.tsx:1002`); panels are measured before render; no scroll-into-view. Style-tab
  steps in `spotlightSteps.ts` are ordered Layout→Design→Content (UI is Content→Design→Layout).
- **Target behavior:**
  - **Sandbox:** a full-screen guide overlay mounting an **isolated editor instance** with
    **scratch data** (reuse `EMPTY_ZONE`; seed a few demo blocks so "selected block" +
    properties anchors have a target) and **persistence disabled** (no save/draft/network/
    Cloudinary/Mongo writes). Real `EditorShell` stays mounted underneath and is untouched;
    on exit the overlay unmounts and data is exactly as before. Reuse the real editor chrome
    so every `data-tour-id` anchor exists and is sized.
  - **Robust anchoring (fixes center-only):** every step's anchor element must be present,
    **sized** (give the canvas tour anchor a real box, not `display:contents`), and
    **scrolled into view** before measuring. Add scroll-into-view on step transition in
    `useElementRect`/the step controller. Keep center-fallback only for the welcome step.
  - **Footer (item 3):** rework `TooltipCard` footer so it never overflows 320px — wrap/stack
    secondary actions ("Don't show again", "Skip this step") so Back/Next always fit; verify
    the 3-button gated case.
  - **Order:** reorder style-tab steps to **Content → Design → Layout** in `spotlightSteps.ts`.
  - **Nav:** free Next/Back; gating relaxed to optional/visual only.
- **Files:** `_components/SpotlightGuide.tsx`, `_components/spotlightSteps.ts`,
  `_components/useElementRect.ts`, `_components/EditorShell.tsx` (guide mount + canvas anchor
  box), new sandbox wrapper under `_components/`.
- **Checkpoints:** (a) sandbox mount + scratch + no-persist; (b) robust anchoring +
  scroll-into-view; (c) footer + step order + copy.
- **Acceptance:**
  - [ ] Each step's tooltip anchors next to its element (e.g. below the Home tab), not centered.
  - [ ] Footer never overflows the card in any step (incl. gated 3-button case), @375px too.
  - [ ] Guide runs on scratch data; after exit the user's real draft/data is unchanged
        (verified: no draft/network writes during the tour).
  - [ ] Style-tab steps go Content → Design → Layout.
  - [ ] Tests: step ordering, anchor/scroll helper, footer layout; Playwright end-to-end run.

## Item 10 — Rebuild the 5 templates (LAST)

- **Problem:** templates + `sectionPresets.ts` reference stale props (`collectionId`,
  `maxItems`) and don't reflect the desired layouts.
- **Target behavior:** rebuild all 5 (`wedding-photographer`, `event-photographer`,
  `planner`, `venue-stylist`, `minimal`) to match the 5 sketch sets (each = Landing/home +
  Gallery layout) from `block template part 1.jpeg` / `part 2.jpeg`, using **only** the
  inventory above. Map: multi-column boxes → `Columns` (1–6 cols + rows); hero/banner →
  `Container` (now with banner) or Hero preset; gallery grids → GalleryGrid/Masonry/
  Carousel/FeaturedWork with new banner options.
  - **Theming (branding removed):** templates carry **no bespoke colors/fonts**. Each
    template uses a **distinct carried theme preset** from `THEME_PRESET_DEFINITIONS`
    (`brandKitPicker/themePresetDefinitions.ts`): Minimal, Editorial, Luxury, Bold,
    Romantic, Modern. Set `defaultBrandKit = THEME_PRESET_DEFINITIONS[<preset>].brandKit`
    (no per-field overrides like the old `fontPair`/colors hand-tuning).
  - **Content:** use the default headings/text we ship — sensible per-business placeholder
    copy only; do not hand-tune brand styling.
  - Remove stale `collectionId`/`maxItems` in `sectionPresets.ts`; add a FeaturedWork
    factory in `_blocks.ts` if a set uses Highlights. Keep `defaultContact`.
- **Files:** `templates/{wedding-photographer,event-photographer,planner,venue-stylist,
  minimal}.ts`, `templates/_blocks.ts`, `blocks/sectionPresets.ts`, `templates/*.test.ts`.
- **Sketch → template → theme mapping (confirm sets against images during impl):**
  - [ ] Set 1 → minimal → **Minimal**
  - [ ] Set 2 → wedding-photographer → **Romantic**
  - [ ] Set 3 → event-photographer → **Bold**
  - [ ] Set 4 → planner → **Modern**
  - [ ] Set 5 → venue-stylist → **Luxury**
  - (Editorial preset left unassigned — still available via the Theme picker.)
- **Acceptance:**
  - [ ] Each template's home + gallery seed loads without errors and only uses current blocks.
  - [ ] Each template applies its distinct carried theme preset (5 different themes).
  - [ ] Layouts visually match their sketch set (Playwright screenshots, desktop + 375px).
  - [ ] No bespoke per-template branding overrides; no stale props (`collectionId`,`maxItems`).
  - [ ] `templates.test.ts` updated (seed snapshots / valid against config + theme assertions).

---

## Sequencing

1. Items 5, 6/6.1, 7 — small isolated editor fixes (tests + checkpoint commit each).
2. Item 8 — overflow (Playwright verify the CTA repro).
3. Item 9 — gallery banners.
4. Items 2/3/4 — guide sandbox + anchoring (3 checkpoints).
5. Item 10 — rebuild templates (on corrected blocks).

## Verification (run before marking each item done)

- Vitest for the item's units/components (`pnpm test --run <fragment>` / `rtk vitest`).
- Playwright CLI (not MCP) run-through of UI changes: anchoring, footer, columns, gallery
  banner, CTA overflow repro, template loads — each at **375px** + control states.
- `pnpm typecheck`, `pnpm lint`; full `pnpm build` at pre-merge.
- Locales present for all new copy (`en`/`fil`/`ms`/`id`).

## Risks / watch-outs

- Guide sandbox must guarantee **zero persistence** while rendering real editor chrome —
  find and disable the EditorShell autosave/draft-write seam in sandbox mode.
- Gallery banner + canvas-overflow changes touch shared render paths — keep back-compat for
  existing saved portfolios (unset props must render as before).
- Templates depend on items 5–9; do not start #10 until those land.
