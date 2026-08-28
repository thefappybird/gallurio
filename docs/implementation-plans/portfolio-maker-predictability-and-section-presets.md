# Claude handoff: predictable portfolio layout and expanded section presets

Status: preset-expansion work order; predictability foundation implemented locally

Created: 2026-08-28

Target base branch: `dev`

Suggested branch: `action/portfolio-predictability-presets`

Lifecycle: delete this handoff after the implementation is merged and move any durable architectural rules into `docs/modules/portfolio-and-media.md` and the relevant portfolio skills.

## Outcome

Finish the preset-expansion phase of a portfolio maker where every enabled editor control has a truthful, observable effect in the editor canvas and in preview/published rendering, and where beginners can build a polished portfolio from a grouped library of 33 distinct section presets.

The implementation has three inseparable outcomes:

1. Preserve the implemented Container and Columns behavior, especially when neighboring grid cells derive their height from the tallest cell.
2. Finish the remaining control audit so no enabled control is a silent no-op. If the current structure cannot make a control meaningful, hide or disable it and explain the prerequisite.
3. The existing 10 preset types each offer three meaningfully different variants, and a new Footer group offers three variants. Presets are organized by section type instead of presented as one long flat list.

Do not replace the current predictability model while expanding presets. Every new preset must inherit and demonstrate the corrected behavior.

## Required reading and working rules

Before editing:

1. Read `CLAUDE.md`, `AGENTS.md`, `docs/AGENTS-INDEX.md`, `docs/modules/portfolio-and-media.md`, `docs/modules/i18n-design.md`, `PRODUCT.md`, `DESIGN.md`, and `REUSABLE_CODE.md`.
2. Read the installed Claude skills:
   - `.claude/skills/portfolio-editor-architecture/SKILL.md`
   - `.claude/skills/portfolio-blocks-and-design/SKILL.md`
   - `.claude/skills/portfolio-effective-defaults/SKILL.md`
   - `.claude/skills/portfolio-theme-brand-kit/SKILL.md`
   - `.claude/skills/portfolio-testing/SKILL.md`
3. If the `impeccable` skill is available in the implementing environment, use its context setup, `shape` flow, portfolio/brand register, and `polish` pass for the preset library. Gallurio's committed product/design system wins over generic recommendations; do not block the work on an unavailable optional skill.
4. Inspect the real current branch/worktree before changing anything. Preserve unrelated dirty files, including the existing untracked `docs/demo-scripts/` directory.
5. Keep the shared editor/public renderer invariant: the same Puck component render must power canvas, preview, and publish.
6. If subagents are used, guarded implementers must run one at a time in this worktree. Only the orchestrator runs full typecheck and Playwright.

Do not run seed/reset/reindex scripts. Do not install or upgrade dependencies for this work.

## Scope boundaries

In scope:

- Container child-height propagation and content distribution.
- Columns row/cell predictability and truthful min-height behavior.
- Separating content arrangement from grid-cell placement.
- Auditing every current Content/Design/Layout button or option for a real effect.
- Context-aware hiding/disabling and concise prerequisite copy.
- Grouped section-preset discovery in the existing Puck drawer.
- Three variants for every current preset type, plus three Footer variants.
- A deterministic `Move to...` path if needed to make moving blocks between nested containers reliable.
- Five-locale editor chrome changes (`en`, `fil`, `id`, `ar`, `th`) and RTL-safe layout.
- Unit, integration, and real-browser parity verification.

Out of scope:

- A fourth public page or arbitrary-page system. Public pages remain exactly Home, Gallery, and Contact.
- A global footer field persisted separately from Puck data. Footer is an insertable section preset; owners may insert it on Home and/or Gallery.
- Free-form absolute positioning, overlap layers, breakpoint-specific arbitrary coordinates, or a Wix-style pixel canvas.
- New portfolio database collections or changes to `Workspace.publicPage` ownership.
- Replacing Puck, introducing a second renderer, or adding a new design-token system.
- Expanding the five full-site starter templates. This work expands insertable section presets, not `PORTFOLIO_TEMPLATES`.

## Current baseline and remaining work

Re-check this baseline against the live worktree before editing. The following predictability changes are already implemented and must be preserved, not reimplemented:

- `BlockStyle` now has the dedicated, serializable `contentHorizontalAlign`, `contentVerticalDistribution`, `cellHorizontalAlign`, and `cellVerticalAlign` fields. New controls write these; legacy `alignX`/`alignY`/`alignItems`/`justifyContent` remain read fallbacks.
- `ContainerBlock` applies content distribution to its real Puck slot, which fills the available Container height. The outer section no longer distributes its background/slot siblings.
- `ColumnsBlock` makes the inner grid fill its minimum height. Newly inserted Columns use a 320px (`Short`) minimum-height default so an empty one-column block is immediately droppable; users can still choose Auto.
- Empty Containers own exactly one editor-only `ContainerAnchor`; populated Containers own none. `reconcileContainerAnchors` normalizes this recursively before Puck mounts and after every Puck mutation, so drops, deletes, restored drafts, and nested Containers stay in sync. Do not restore the earlier CSS absolute-position workaround.
- Frame controls use independently toggleable `borderSides`. Full replaces any partial set; selecting an individual edge from Full starts a fresh set; a first side selection materializes a visible 1px width when needed. Legacy single-choice `borderPreset` remains read-compatible.
- Preview waits for the local browser draft before mounting preview content, preventing a visible published/DB fallback flash when entering preview or navigating Home/Gallery inside the iframe.
- Each Edit Collection dialog now begins its image grid with an equal-size upload card that accepts image drops and opens the file picker on click.

The preset library remains unexpanded:

- `lib/page-builder/blocks/sectionPresets.ts` still defines the 10 legacy composed Container presets: Hero, About, Services, CTA, Contact, Gallery Grid, Gallery Masonry, Featured Work, Gallery Landing, and Video.
- `lib/page-builder/blockCategories.ts` still exposes them in one `Preset blocks` category.
- Existing persisted pages contain the current component keys (`HeroPreset`, `AboutPreset`, and so on). These keys must remain registered and render unchanged unless a deliberate compatibility fallback is applied.
- Existing controls use the effective-default display pattern. Do not materialize theme/system defaults merely to make a control look selected.

## Non-negotiable control contract

An editor control is truthful only when all of the following hold:

1. **Observable:** choosing a different enabled option causes a visible or interactively verifiable change in the current editor canvas.
2. **Parity:** the same saved value produces the same relevant DOM/computed style/behavior in preview and published rendering.
3. **Applicable:** the control is enabled only when its prerequisite structure/content exists.
4. **Explainable:** a disabled control includes short helper text or a tooltip stating what is required.
5. **Stateful:** the UI distinguishes an explicit block override from a lighter effective theme/system default.
6. **Resettable:** clearing an override returns to the displayed effective value without freezing the current theme value into block props.
7. **Persistent:** save, reload, preview, publish, and draft switching preserve the selected behavior.
8. **Accessible:** every icon button has an accessible name, active state uses `aria-pressed` where appropriate, disabled reasons are keyboard discoverable, and color is not the only state signal.

There are only three valid resolutions for a no-op control:

- Fix the render so the control has the promised effect.
- Hide/disable the control when it cannot apply, with a reason.
- Remove the control if the renderer intentionally does not support it.

Do not keep an enabled control merely because it mutates stored data or changes an invisible computed property. The user must be able to tell that the action mattered.

Content fields and behavior fields use the same principle with a narrower definition:

- Text, media, collection, count, and sizing changes must update canvas and preview content.
- Navigation/button actions must be clearly represented in the editor and work in interactive preview/public rendering. They do not need to navigate while the canvas is in editing mode.
- Semantic-only fields such as image alt text are not expected to change appearance, but they must update the rendered semantic attribute and have focused tests.

## Target layout contract to preserve

### 1. Separate four concepts

Do not reintroduce use of `alignItems`/`justifyContent` for unrelated jobs. The current implementation already uses these explicit, serializable concepts:

- `contentHorizontalAlign`: `start | center | end | stretch`
- `contentVerticalDistribution`: `start | center | end | between | around`
- `cellHorizontalAlign`: `stretch | start | center | end`
- `cellVerticalAlign`: `stretch | start | center | end`

Use logical start/end semantics and CSS (`text-align: start/end`) for the new values. Preserve reads of legacy `alignX`, `alignY`, `_style.alignItems`, and `_style.justifyContent` so old drafts/public pages do not break. New controls must write only the new unambiguous fields.

Legacy priority should be explicit and tested:

1. New dedicated field.
2. Existing `_style` legacy field where required for visual compatibility.
3. Existing top-level `alignX`/`alignY` fallback.
4. System default.

Do not mass-rewrite stored pages. Compatibility belongs in resolution/rendering.

### 2. Make the Container slot own available height

The intended shape is:

```text
Columns row (used height comes from tallest cell)
└─ Container root (fills or hugs its grid cell by explicit policy)
   └─ Puck content slot (flex column; owns available height)
      ├─ first child
      ├─ middle children
      └─ last child
```

For a filling Container, the content slot must receive the available height (`flex: 1 1 auto`, `min-height: 0`, and any necessary width rules) and `contentVerticalDistribution` must be applied to that slot. Background/slideshow/scrim layers remain absolute and must not participate in flex distribution.

Expected behavior:

- `start`, `center`, and `end` position the child group vertically.
- `between` places the first real child at the start and the last real child at the end.
- `around` allocates visible space around real children.
- `gap` remains spacing between adjacent real children and composes with distribution.
- `ContainerAnchor` is editor plumbing and must not count as a distributable child.
- Anchor lifecycle is data-driven, not CSS-driven: `reconcileContainerAnchors` strips it after a drop, restores it after the final real child is deleted, and normalizes old nested drafts before their first editor render.
- A standalone auto-height Container still hugs content and does not gain artificial blank height.

### 3. Make height behavior explicit and contextual

Use these user-facing concepts:

- **Hug content:** height follows children.
- **Fill grid row:** available only for a direct Columns child; fills the row height established by the tallest cell or the grid.
- **Minimum height:** Auto, Short, Medium, Tall, or Custom; remains a lower bound, not a fixed clipping height.

Do not introduce additional fixed heights. The approved exception is the new Columns default of `minHeight: "320px"`, the Short equivalent that makes a fresh empty Columns block droppable. Min-height plus grid/flex fill remains the responsive solution.

When Columns has a min-height, its inner grid must actually occupy the available content box. Avoid the current outcome where only the outer wrapper grows. Preserve padding semantics and `overallWidth` behavior.

If explicit multi-row sizing is retained, define and test one clear rule. Recommended release-safe rule:

- Rows remain content-sized by default.
- Each row height is determined by its tallest item.
- Items default to Fill grid row.
- Do not add equal-height-across-all-rows behavior unless it is an explicit, separately labelled option with a visible effect.

### 4. Context rules for existing controls

Audit the live UI, not only this table. At minimum enforce:

| Control | Applicability/effect rule |
| --- | --- |
| Child gap | Applies to direct real children. Disable with “Add at least two blocks” when fewer than two children exist. |
| Spread apart/evenly | Requires at least two real children and available height from Fill grid row or a non-auto minimum height. Otherwise disable with a reason. |
| Content horizontal alignment | Changes inner-child/text alignment only; never changes the Container's placement in its grid cell. |
| Cell horizontal/vertical alignment | Show only for direct Columns children. It changes the block root's placement, never its internal content alignment. |
| Block position | Enable only when an explicit width smaller than the available width makes left/center/right observable. Otherwise disable with a reason. |
| Column span | Show only for direct Columns children when the parent defines more than one column. Clamp to the actual parent count. |
| Row span | Show only when the parent has meaningful explicit rows. Do not offer a clickable value that cannot create a span. |
| Columns min-height | Must visibly enlarge/fill the inner grid, not add dead space under it. |
| Overall width | Page fit and Full must differ in canvas and preview. Show a clear selected state and preserve the editor's safe viewport constraint. |
| Border sides | Full replaces any partial edge selection. Individual edges combine after the first selection; changing from Full starts a fresh edge set. Selecting an edge with no positive width sets 1px so the result is visible. |
| Border color | Disable or hide while border width is zero, with a short prerequisite. |
| Highlight shape/size/color | Show only while highlight is enabled. |
| Background animation/speed | Show only with at least two valid background images. One image is static. |
| Background image opacity | Show only when a valid image exists. It affects the image layer only, not text/scrim. |
| Gallery columns/gap | With no media, either hide/disable or render truthful editor/preview placeholders that visibly reflect the selection. Never leave enabled buttons that only change dormant data. |
| Featured Work columns | Same rule as gallery layout; collections or truthful placeholders are required. |
| Width/height unit controls | The chosen px/% value must be reflected in computed style in canvas and preview, with bounds and no overflow at 375px. |
| Entrance animation | A changed option must replay in editor safely and must honor reduced motion. It may not leave content initially hidden. |
| Hover effect | Must be testable by hover/focus in canvas and interactive preview; never hover-only for essential meaning. |
| Button action | Keep contact/gallery behavior and add `go-to-home` for Footer navigation. Show the selected destination in the control; verify links/modal behavior in interactive preview/public. |

Inspect block-specific controls too: Heading level, button size/style/color/opacity, typography, frame, gallery layout, collection selection, media selection, Divider thickness, Spacer height, ContactDetails controls, and root/page controls. Every enabled option must satisfy the contract.

### 5. Deterministic moving in nested layouts

Keep drag-and-drop, the Outline, and the existing move up/down/out toolbar. Add a deterministic `Move to...` action if the current UI cannot reliably move a selected block between sibling/nested Containers.

Minimum behavior:

- List valid destination zones using readable breadcrumbs, for example `Home / Services / Column 2`.
- Let the user choose start/end or a before/after sibling insertion point.
- Do not list the selected block's own descendant zones.
- Preserve selection after moving and scroll the destination into view.
- Use Puck's public dispatch/index data; do not mutate Puck state directly.
- Moving is keyboard operable and does not depend on precision dragging.

During pointer dragging, compatible Containers should expose their full drop area and a clear insertion indicator. Do not solve this with DOM-size feedback loops or ResizeObserver-driven layout mutations.

## Preset library architecture

### Exact catalog size

- 10 existing section groups x 3 variants = 30 choices.
- 1 new Footer group x 3 variants = 3 choices.
- Total = 33 registered section preset components.

The existing component key in each group remains Variant A for persistence compatibility. Do not rename or remove those 10 keys.

### Registry shape

Replace hand-maintained parallel lists with one client-safe typed registry that can derive:

- Section group id and localized group label.
- Component key.
- Localized variant name and one-sentence description.
- Default Container props/content composition.
- Optional lightweight preview metadata used by the drawer item.
- Whether the preset depends on galleries, collections, contact details, or video.

The registry must power both `puckConfig` and `createEditorConfig`, category grouping, demo/guide filtering, `PuckGateReader`, and parity tests. Avoid manually repeating 33 keys in multiple files.

`SECTION_PRESETS` may remain as a derived compatibility export if current tests/importers benefit from it. `PRESET_BLOCK_KEYS` should be derived from dependency-safe registry metadata rather than drifting by hand.

All presets continue to render through the real `ContainerBlock` and use editable nested manual/data blocks. Do not create monolithic bespoke section renderers whose text and children cannot be selected independently.

### Grouped drawer experience

Use Puck's supported categories and `drawerItem` override rather than replacing its drag system.

- Present section groups as collapsible categories: Hero, About, Services, Call to action, Contact, Gallery grid, Gallery masonry, Featured work, Gallery landing, Video, Footer.
- Each group contains exactly three variants with distinct names.
- Keep Manual blocks in its own collapsed category.
- Default-expand only the most useful beginner group, or preserve the user's expanded state if Puck already does so.
- Enhance preset drawer items with the localized variant name and a concise description. A lightweight, non-interactive schematic preview is allowed if it does not duplicate the production renderer or harm drag behavior; actual inserted canvas output remains the source of truth.
- Preserve the existing Outline below the component list.
- Demo mode must hide every Featured Work variant if collection selection is unavailable, not only the legacy key.
- The guide's “insert a preset” detection must recognize all 33 preset keys.
- Use logical spacing/alignment in the drawer so Arabic mirrors correctly.

Do not render 33 live Puck canvases in the sidebar. That is unnecessary work and likely to damage editor performance.

## Preset variant catalog

Each variant must be visually and structurally distinct. Changing only a color, alignment, heading, or gap does not count as a variant. The distinctions below are product decisions; refine exact copy and spacing through a deliberate design shape/polish pass without collapsing the structural differences.

### Hero

| Key | Name | Composition and value |
| --- | --- | --- |
| `HeroPreset` | Immersive cover | Existing tall background/slideshow hero; centered headline, supporting text, contact CTA. Best for image-led portfolios. |
| `HeroSplitPreset` | Split introduction | Two-column section: left copy/CTA, right Image block. Medium minimum height; stacks copy before image on mobile. Best when the portrait/project image should remain uncropped and independently editable. |
| `HeroStatementPreset` | Typographic statement | No required image. Large start-aligned headline, restrained supporting line, divider, compact CTA. Best for strong names/creative positioning and fast loading. |

### About

| Key | Name | Composition and value |
| --- | --- | --- |
| `AboutPreset` | Editorial biography | Existing heading plus long-form biography with readable measure. Best for narrative. |
| `AboutPortraitPreset` | Portrait and story | Two columns with Image and story Container. Best for a personal introduction. |
| `AboutProfilePreset` | Studio profile | Asymmetrical three-track composition: story spans two tracks; compact location/experience/specialty facts occupy the third without card chrome. Best for scanning. |

### Services

| Key | Name | Composition and value |
| --- | --- | --- |
| `ServicesPreset` | Service cards | Existing three equal, bordered service Containers; corrected Fill row and Spread apart behavior keeps prices aligned. Best for comparable packages. |
| `ServicesMenuPreset` | Editorial menu | Stacked service rows separated by Dividers; each row uses columns for title, description, and price. No repeated cards. Best for a longer offer list. |
| `ServicesFeaturePreset` | Featured service | One prominent split service followed by two quieter supporting services. Best when one offer should dominate. |

### Call to action

| Key | Name | Composition and value |
| --- | --- | --- |
| `CtaPreset` | Accent band | Existing centered medium-height color band with contact CTA. |
| `CtaImagePreset` | Image invitation | Image/slideshow background, controlled scrim, start-aligned copy and CTA. Distinct from Hero through shorter height and closing copy hierarchy. |
| `CtaMinimalPreset` | Minimal closing | Auto-height section with Divider and two-column headline/button composition; no decorative background. |

### Contact

| Key | Name | Composition and value |
| --- | --- | --- |
| `ContactPreset` | Centered contact | Existing heading, introduction, ContactDetails, and contact CTA. |
| `ContactSplitPreset` | Split inquiry | Left narrative and CTA; right ContactDetails inside a restrained bordered Container. |
| `ContactBarPreset` | Compact contact bar | Wide multi-column closing row with heading, key details, and CTA; stacks in reading order on mobile. |

### Gallery grid

| Key | Name | Composition and value |
| --- | --- | --- |
| `GalleryGridPreset` | Classic grid | Existing heading/description plus three-column grid. |
| `GalleryGridFullPreset` | Full-width grid | Minimal header, full-width four-column grid with tight image spacing. Best for volume and visual impact. |
| `GalleryGridFramedPreset` | Framed selection | Two-column or three-column loose grid inside a deliberately padded/bordered section with centered introduction. Best for a small curated set. |

### Gallery masonry

| Key | Name | Composition and value |
| --- | --- | --- |
| `GalleryMasonryPreset` | Editorial story | Existing heading/description plus masonry flow. |
| `GalleryMasonryWallPreset` | Edge-to-edge wall | Full-width, tight masonry with minimal text. Best for image density. |
| `GalleryMasonryJournalPreset` | Journal spread | Intro occupies one track and masonry spans the remaining tracks at desktop, stacking naturally on mobile. Best for contextual storytelling. |

### Featured work

| Key | Name | Composition and value |
| --- | --- | --- |
| `FeaturedWorkPreset` | Collection overview | Existing introduction plus three collection tiles. |
| `FeaturedWorkLeadPreset` | Lead collections | Larger two-column collection treatment with a stronger introduction. Best for two or four major projects. |
| `FeaturedWorkIndexPreset` | Compact project index | Restrained contrasting section with compact collection tiles and concise copy. Best as navigation deeper into work. Do not imitate an ecommerce product grid. |

### Gallery landing

| Key | Name | Composition and value |
| --- | --- | --- |
| `GalleryLandingPreset` | Slideshow cover | Existing medium-height image/slideshow landing with centered copy. |
| `GalleryLandingSplitPreset` | Split gallery intro | Copy in one column and independently editable Image in the other. Best for a single signature image. |
| `GalleryLandingMastheadPreset` | Minimal masthead | Type-led title, short introduction, and Divider with no required image. Best when the gallery itself should immediately follow. |

### Video

| Key | Name | Composition and value |
| --- | --- | --- |
| `VideoPreset` | Centered film | Existing centered heading/description/video composition. |
| `VideoSplitPreset` | Film and story | Video occupies the larger side of a split layout; contextual copy and optional contact CTA sit beside it. |
| `VideoCinemaPreset` | Cinema band | Full-width video on a contrasting section with a compact caption below. Best for showreels. |

### Footer

| Key | Name | Composition and value |
| --- | --- | --- |
| `FooterSignaturePreset` | Signature footer | Divider, studio/name heading, one-line positioning statement, and compact Home/Gallery/Contact actions. |
| `FooterDirectoryPreset` | Directory footer | Three-column structure for identity, Home/Gallery/Contact navigation, and ContactDetails. Stacks in that semantic order. |
| `FooterStatementPreset` | Closing statement | Contrasting section with a strong final statement, contact CTA, and quiet editable copyright/legal line. |

Footer actions require adding `go-to-home` to `ButtonBlockProps` and both editor/server field options. Resolve the canonical tenant home path from existing portfolio URL helpers and Puck metadata; do not construct untrusted URLs manually. Update all five locale catalogs.

## Preset design quality bar

Every preset must satisfy all of the following:

- Uses only existing editable blocks unless a genuinely missing primitive is required by the contract above.
- Uses semantic `--pf-*` brand tokens; no raw Tailwind color utilities or hardcoded brand colors.
- Remains legible across all committed brand-kit presets, including dark/light poles. Explicitly pin a compatible section background or child text token when inheritance could become illegible.
- Has one clear visual hierarchy, readable body measure (roughly 65-75ch), balanced headings, and deliberate spacing rhythm.
- Avoids gradient text, glassmorphism, decorative side stripes, repeated eyebrow labels, arbitrary numbered scaffolding, and endless identical icon-card grids.
- Uses cards only where comparison/grouping justifies a frame. At least two variants per group must differ structurally, not merely cosmetically.
- Uses min-height, intrinsic sizing, aspect ratio, and grid/flex flow instead of fixed clipping heights.
- Works at 375, 768, and 1280 widths without horizontal overflow or unreadable columns.
- Maintains semantic heading order within a page: one Hero h1 when appropriate; section headings h2; children h3.
- Provides meaningful editable placeholder copy without presenting Gallurio as only a booking funnel. Galleries, projects, skills, and creative presentation stay primary.
- Meaningful images remain real `<img>` elements with editable alt text; decorative Container backgrounds remain decorative.
- All nested blocks remain individually selectable, movable, editable, duplicable, and removable.
- All nested Containers/Columns use the new predictable layout properties rather than relying on legacy overloaded alignment fields.

## Likely implementation files

This list is a routing guide, not permission to edit unrelated code:

- `lib/page-builder/blocks/manualBlocks.tsx`
- `lib/page-builder/blocks/manualBlocks.test.tsx`
- `lib/page-builder/styleToolkit.ts`
- `lib/page-builder/styleToolkit.test.ts`
- `lib/page-builder/StyleToolkitField.tsx`
- `lib/page-builder/StyleToolkitField.test.tsx`
- `lib/page-builder/toolbarPrimitives.tsx`
- `lib/page-builder/blocks/sectionPresets.ts`
- `lib/page-builder/blocks/sectionPresets.test.ts`
- `lib/page-builder/blocks/sectionPresets.test.tsx`
- `lib/page-builder/blockCategories.ts`
- `lib/page-builder/blockCategories.test.ts`
- `lib/page-builder/config.ts`
- `lib/page-builder/editorConfig.tsx`
- `lib/page-builder/editorConfig.test.ts`
- `lib/page-builder/containerAnchorReconciler.ts`
- `lib/page-builder/containerAnchorReconciler.test.ts`
- `app/[locale]/(app)/portfolio/_components/EditorShell.tsx`
- `app/[locale]/portfolio-preview/_components/PreviewBrandShell.tsx`
- `app/[locale]/portfolio-preview/_components/PreviewClient.tsx`
- `lib/page-builder/galleryPicker/EditCollectionDialog.tsx`
- `app/[locale]/(app)/portfolio/_components/BlockActionsToolbar.tsx`
- `lib/page-builder/moveBlockToRoot.ts` or a narrowly named replacement/helper
- `messages/en.json`, `messages/fil.json`, `messages/id.json`, `messages/ar.json`, `messages/th.json`
- `messages/parity.test.ts` and encoding sanity tests as applicable
- Focused Playwright specs under `e2e/`, reusing `e2e/helpers.ts`
- `docs/modules/portfolio-and-media.md` for the final durable layout/preset contract
- The corresponding `.claude/skills/portfolio-*` guidance if the implementation creates a new lasting gotcha agents must know

Do not edit full-site files under `lib/page-builder/templates/` merely to make the new section registry pass. Existing templates must continue to render their legacy preset keys, but expanding template compositions is a separate feature.

## Required test strategy

### Unit/integration

Keep the existing predictability regressions green. Add focused tests that fail on the current preset/control-audit gap before implementing each remaining change.

1. Container distribution:
   - The real slot wrapper, not the outer section, receives vertical distribution.
   - Filling Containers give the slot available height.
   - `between` and `around` operate on two or more real children.
   - Auto-height standalone Containers remain content-sized.
   - `ContainerAnchor` does not count as content.
   - Anchor removal on a populated drop, restoration after a final-child delete, and nested restored-draft normalization remain covered by `containerAnchorReconciler.test.ts`.
2. Grid/cell separation:
   - Content alignment changes inner content only.
   - Cell alignment changes the block root only.
   - New fields win over legacy fields; legacy-only saved data remains visually compatible.
3. Columns:
   - Neighboring Containers stretch predictably.
   - Columns min-height enlarges the inner grid.
   - Span controls clamp to real parent tracks.
4. Control applicability:
   - Every option array/button group has table-driven tests proving enabled options write a consumed value.
   - Inapplicable options are absent/disabled with a reason.
   - Effective vs explicit vs reset state is covered.
5. Presets:
   - Exactly 11 groups, exactly 3 variants per group, exactly 33 unique component keys.
   - The 10 legacy keys remain registered.
   - Every preset editor config and production config has the same field keys, defaults, inline behavior, and render.
   - Every nested child type exists in both configs.
   - Spans never exceed parent tracks; every slot composition is structurally valid.
   - Contrasting backgrounds/text remain legible by token contract.
   - Gallery presets contain no stale `collectionId`/`maxItems` props.
6. Footer/button:
   - `go-to-home` resolves the correct tenant home URL.
   - Existing contact and gallery actions remain unchanged.
7. Demo/guide:
   - All preset keys satisfy guide detection.
   - All Featured Work variants are hidden in demo mode when required.

Avoid assertions that merely prove data changed. Assert the CSS/DOM/behavior consumed by the renderer.

### Real browser

Use Playwright CLI and the portfolio-testing skill. Do not use the MCP browser plugin.

Create a focused authenticated spec that:

1. Opens `/portfolio`, handles the entry dialog/overlay, and starts from a controlled draft.
2. Builds a two-column fixture where the right Container is taller than the left.
3. Selects Fill grid row and Spread apart on the left; verifies first/last real child positions using bounding boxes in the canvas iframe.
4. Opens preview and verifies the same relationship and relevant computed styles.
5. Exercises Hug content, top/middle/bottom, gap, cell alignment, min-height, and spans without relying on screenshots alone.
6. Moves a nested child to another Container using the deterministic path and verifies source/destination order.
7. Inserts at least one variant from every preset group and verifies it renders without runtime errors and remains selectable/editable.
8. Verifies representative structurally demanding variants at 375, 768, and 1280:
   - Hero Split
   - Services Cards and Services Menu
   - Gallery Masonry Journal
   - Contact Bar
   - Footer Directory
9. Checks no horizontal overflow and validates logical ordering under Arabic/RTL editor chrome where the public content contract permits.
10. Captures review screenshots for the final design-polish pass, but keeps computed-style/DOM assertions as the regression gate.

Use actual Puck pointer dragging only where drag behavior itself is under test. Prefer deterministic toolbar actions for setup when possible.

## Validation commands

Run focused tests throughout, then before handoff run serially:

```powershell
pnpm exec vitest run lib/page-builder/blocks/manualBlocks.test.tsx lib/page-builder/styleToolkit.test.ts lib/page-builder/StyleToolkitField.test.tsx lib/page-builder/containerAnchorReconciler.test.ts lib/page-builder/blocks/sectionPresets.test.ts lib/page-builder/blocks/sectionPresets.test.tsx lib/page-builder/blockCategories.test.ts lib/page-builder/editorConfig.test.ts lib/page-builder/galleryPicker/EditCollectionDialog.test.tsx app/[locale]/portfolio-preview/_components/PreviewClient.test.tsx app/[locale]/portfolio-preview/_components/PreviewBrandShell.test.tsx
pnpm typecheck
pnpm lint
pnpm exec playwright test <new-focused-portfolio-spec> --project=chromium
git diff --check
```

Also run existing affected portfolio specs such as the Columns/grid, default-prefill, responsive, block-panel, and editor specs. Report lint errors separately from pre-existing warnings.

## Definition of done

The predictability items below are regression acceptance criteria: their implementation already exists in the baseline. Re-verify and preserve them while completing the preset/catalog work; do not treat an unchecked box as authorization to replace their model.

- [ ] Every enabled Content/Design/Layout option has an observable canvas effect or a testable interactive/semantic effect appropriate to its purpose.
- [ ] The same persisted value has editor/preview/publish parity.
- [ ] Inapplicable controls are hidden/disabled with a useful reason; no clickable no-ops remain.
- [ ] Space Between/Evenly visibly distributes real Container children when height is available.
- [ ] Hug content and Fill grid row are understandable and predictable beside taller siblings.
- [ ] Columns min-height affects the actual inner grid.
- [ ] Content alignment and grid-cell placement no longer share one writable control/property.
- [ ] Legacy saved pages and the 10 existing preset component keys remain supported.
- [ ] The drawer shows 11 grouped section types with three distinct variants each.
- [ ] All 33 variants render through the shared real Container/Puck config and remain fully editable.
- [ ] Footer is an insertable section, not a new page/global persistence model.
- [ ] `go-to-home` works without regressing existing button actions.
- [ ] New editor copy exists in `en`, `fil`, `id`, `ar`, and `th`; parity/encoding tests pass.
- [ ] Representative variants pass design review at 375/768/1280 with no overflow and acceptable contrast.
- [ ] Focused tests, affected existing tests, typecheck, lint, Playwright, and `git diff --check` pass or any unrelated blocker is evidenced precisely.
- [ ] `docs/modules/portfolio-and-media.md` and relevant skills contain only the final durable rules.
- [ ] This temporary handoff is removed in the shipping change after its durable guidance has been transferred.

## Final handoff expected from the implementing agent

Report:

1. The layout model and compatibility strategy preserved, including any intentional compatibility additions.
2. The control audit results, including any controls removed or context-gated.
3. The final 33-preset registry and grouped drawer behavior.
4. Files changed.
5. Exact focused/full verification results.
6. Browser evidence at 375, 768, and 1280.
7. Any intentionally deferred item, with a concrete reason. Do not call the work complete if any Definition of done item remains silently unaddressed.
