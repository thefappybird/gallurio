# Perf audit: Puck upgrade blast radius — CLOSED, upgraded on `action/portfolio-puck-upgrade`

> **Status: closed.** The upgrade shipped on `action/portfolio-puck-upgrade` (2026-09-23). `@measured/puck@0.20.2` -> `@puckeditor/core@0.23.0`.
>
> Every section below has been revised in place to state its **outcome**, not its prediction. Where a desk estimate or a spike finding turned out wrong, the section says so rather than leaving the wrong text standing. `## Spike findings` is kept as a dated record of how we got here — it is history, not instructions.
>
> Work this upgrade deliberately did **not** do is scoped in `docs/portfolio/puck-023-followups.md`. Nothing on that list is a defect; the upgrade was kept behaviour-preserving on purpose.


We ship `@measured/puck@0.20.2`. Latest stable is `@puckeditor/core@0.23.0` — three minors ahead, and the package changed npm scope along the way. This audit answers: do we upgrade, and what work keeps every block, every personalization control, and every already-published page intact.

The short version: **the data layer and the blocks survive untouched. The cost is almost entirely in editor chrome we styled by reaching into Puck's internals.**

## Version delta

| | now | target |
|---|---|---|
| package | `@measured/puck@0.20.2` | `@puckeditor/core@0.23.0` |
| CSS import | `@measured/puck/puck.css` | `@puckeditor/core/puck.css` (now optional — injected at runtime) |
| RSC entry | `@measured/puck/rsc` | `@puckeditor/core/rsc` (still exists) |
| licence | MIT | MIT |
| peer react | `^18 \|\| ^19` | `^18 \|\| ^19` |
| engines.node | unset | `>=20` (we run 24) |

Cumulative breaking changes 0.20 to 0.23 are unusually thin:

- **0.21** — no API breaking changes. Scope rename only. Two behavioural shifts: a left **Plugin Rail** replaces the single sidebar (opt out with `legacySideBarPlugin()`), and a full-width default viewport is added unless `viewports` is passed explicitly.
- **0.22** — no API breaking changes. The editor was rebuilt on public CSS custom-property design tokens; the release explicitly warns that **undocumented palette-variable overrides must migrate to the new theming API**.
- **0.23** — Node 20+. Slot `allow`/`disallow` must live on the field definition rather than the render prop. Canvas drag-and-drop now draws insertion lines by default (`dnd.behavior: "fluid"` restores 0.20 behaviour). Outline theming token defaults changed.

## What survives untouched

> **Outcome: every claim in this section held.** The full page-builder suite passed unchanged on 0.23 before any fix was applied, and a 242-case registry-driven sweep was added to keep it that way.

- **Saved data needs no migration.** We are already fully on slot fields — `editorConfig.tsx:751,820,840-844,1217,1295`, `manualBlocks.tsx:1078,1522`, `GalleryGridBlock.tsx:270`. There is **no `DropZone` anywhere in the repo**, so the `zones`-to-slot-props data migration (and Puck's `migrate()` helper) simply does not apply to us. Every `Workspace.publicPage.data` and `PortfolioDraft.data` document loads as-is. `PuckData.zones` (`lib/page-builder/types.ts:381`) and the `data.zones` branches in `blockTree.ts:62-135` are legacy-defensive dead paths, not live format.
- **The 0.23 `allow`/`disallow` breaking change is already satisfied.** Every slot restriction in the repo is declared on the field definition; zero slot render-prop `allow=`/`disallow=` call sites exist. No work item.
- **No deep imports.** Everything comes through the public `@measured/puck` and `@measured/puck/rsc` entry points across all 56 referencing files. No `dist/` reaching, no monkey-patching.
- **All 8 custom fields.** `StyleToolkitField` (`editorConfig.tsx:593`), `RootStyleField` (`:605`), `MultiImageControl` (`:249`), `DimensionInput` (`:617`), `PageBodyContainerDefaultsControl` (`:640`), `NavStyleField` (`:658`), `NumberInputRow` (`:1134`), and the server-side no-op (`styleToolkit.ts:306`). `type: "custom"` is unchanged; 0.23 even fixes caret-position loss in overridden fields.
- **`inline: true` + `puck.dragRef`** (~25 call sites across the block files) and **`contentEditable: true`** text fields (`editorConfig.tsx:241,1091`) — both 0.20 features, both still current.
- **`metadata` injection** (`EditorShell.tsx:3139-3161`), our workaround for Puck's thin context plumbing into slot children. Unchanged.
- **`iframe={{ enabled: false }}`** (`EditorShell.tsx:3137`). Still supported; 0.22 added `iframe.syncHostStyles` but it is irrelevant while the canvas is not framed.
- **Public rendering.** `Render` from the `/rsc` entry, used by `app/(public)/w/[orgSlug]/page.tsx:247` and `gallery/page.tsx:184`. Same import shape, new scope.
- **All seven overrides we use** — `header`, `puck`, `preview`, `drawer`, `fields`, `actionBar`, `drawerItem` — still exist in 0.23, which also adds `componentOverlay`.

## Blast radius

### 1. The theming bridge — RESOLVED (and far cheaper than this estimate)

> **Outcome:** real problem, wrong cause and wrong price. The palette bridge below was never the issue; 0.22's semantic alias layer was. Fixed with one added block in `editor.css`, not the ~190-line rewrite budgeted here. See `## What shipped`. The estimate below is left for the record.

`app/[locale]/(app)/portfolio/_components/editor.css:41-233` (~190 lines) remaps `--puck-color-grey-01..12`, `--puck-color-azure-02..12`, `--puck-color-white`, `--puck-color-black` and `--puck-font-family` onto our semantic tokens, twice (light + dark). This is the **only** thing making the editor follow app dark mode, and it is precisely the undocumented palette-variable override 0.22 replaced.

Expect to rewrite the whole block against the documented token API (`--puck-color-interactive`, `--puck-radius-m`, and siblings). Not mechanical — it is a re-derivation of the mapping, including the deliberate inverted-scheme trick documented at `editor.css:263-282`. Budget this as the single largest item.

### 2. Internal class-name CSS hooks — NOT A PROBLEM, all six still match

> **Outcome:** verified in the live 0.23 DOM. No work was needed and none was done. Migrating to the supported `componentOverlay` override is optional insurance against 0.24, tracked in the follow-ups doc.

`editor.css:251-341` reaches Puck's hashed CSS-module class names by substring:

- `[class*="DraggableComponent-overlay"]`, `-actionsOverlay`, `-overlayWrapper` — suppress the hover/selection chrome on `ContainerAnchor` spacers.
- `[class*="PuckCanvas_"]` — kill the canvas frame padding.
- `[class*="PuckCanvas-loader"]` — remove the permanently-invisible loader that still steals ~26px of row width.
- `[class*="DrawerItem-draggable"]` — grab/grabbing cursor on drawer rows.

These six are the *only* Puck-coupled CSS in the repo. The other `!important` rules in the portfolio code — `responsive.ts:115`, `manualBlocks.tsx:1394-1403`, `GalleryMasonryBlock.tsx:297,323`, `RootCanvasStyle.tsx:140,142` — all target our own class names (`PF_COLUMN_STACK_CLASS`, `contentAlignmentClass`, `PF_FULL_WIDTH_CONTAINER_SLOT_CLASS`) and our own `[data-block]` / `[data-pf-*]` attributes, so they are upgrade-inert. Don't re-audit them.

0.22 restyled the overlays and 0.23 rewrote drag-and-drop and the outline. These selectors fail **silently** — nothing errors, the editor just looks wrong. The supported replacements now exist: the new `componentOverlay` override for the first group, theming tokens for drag indicators and outline styling for the rest. Treat every one of these six selectors as needing re-verification in a browser, not a grep.

### 3. Plugin Rail vs our chrome — REAL, and fixed

> **Outcome:** the rail does render. A spike finding claiming otherwise was retracted (see below for why the probe was wrong). Replaced with our own two-tab sidebar. See `## What shipped`.

Our `header` override (`EditorShell.tsx:3175-3209`) renders its own sidebar-visibility toggles driven by `appState.ui.leftSideBarVisible` / `rightSideBarVisible` (`:470-522`), and our `drawer` override replaces Puck's flat block list with a two-level preset tree (`PresetBlocksDrawer`). Under 0.21's rail, the drawer, outline and fields are *plugins* rendered into a rail rather than a sidebar, and plugin overrides are curried.

`legacySideBarPlugin()` is documented to restore the old stacked single sidebar, which would likely make all of this a no-op. Unproven — this is a spike question.

### 4. Mechanical — DONE

> **Outcome:** 53-file scope rename landed as its own commit; the `createUsePuck` surface came through clean under `tsc`; the unit suite passes; the portfolio e2e set was re-run. Sizes below were the estimate.

- 56 files import `@measured/puck`; a scope rename across all of them plus `package.json`. Trivially codemoddable, but it touches nearly the whole `lib/page-builder` tree, so it should land as its own commit to keep the semantic changes readable.
- ~64 `createUsePuck` selector call sites reading `appState.ui.itemSelector`, `history.back/forward`, `getPermissions`, and dispatching `remove` / `setUi` / `setData`. No documented change to the store shape, but this is the widest surface the docs do not cover and typecheck is the only thing guarding it.
- 157 portfolio-area test files plus ~15 portfolio `e2e/*.spec.ts` re-run as regression surface.

## What we would gain — what was taken, and what was not

**None of the items below were adopted in the upgrade itself**, by design: the upgrade had to be provably behaviour-preserving before anything new was built on it. They are scoped in `docs/portfolio/puck-023-followups.md`, with the one exception noted inline.

| gain | status |
|---|---|
| insertion-line DnD -> delete `ContainerAnchor` | **blocked** — manual testing found DnD still buggy without the anchor |
| `componentOverlay` override | not taken — optional, nothing is broken |
| documented theming tokens | **taken** — this is what the theming fix is built on |
| slot `as` | not taken — cheap, and the only one that helps the public page |
| Dictionary API | not taken — highest-value follow-up |
| `_experimentalVirtualization` | **rejected** — experimental, and our trees are far too small to benefit |

The original reasoning follows.

- **Insertion-line drag-and-drop** (`dnd.behavior`, 0.23) plus a **draggable outline** that reorders, duplicates and deletes inside deeply nested layouts. This targets exactly the problem `ContainerAnchor` exists to solve — the invisible editor-only spacer reconciled into the data tree (`containerAnchorReconciler.ts`, `containerAnchorPredicate.ts`, `EditorContainerAnchor.tsx`, the `ContainerAnchor` component in `manualBlocks.tsx:1570`, plus the three overlay-suppression CSS rules and its own e2e spec) so a user can drop a sibling *next to* a nested `Container`/`Columns` instead of always landing inside it. If 0.23 makes that native, the whole mechanism deletes.
- **`componentOverlay` override** — a supported replacement for the `DraggableComponent-overlay` substring hacks.
- **Documented theming tokens** — the palette bridge stops being a bet on undocumented variables.
- **Slot `as`** — replace slot wrapper `div`s with semantic elements on the public page.
- **Dictionary API** (0.23) — every editor UI string becomes translatable at runtime. Editor chrome is English-only today (a deliberate choice, see the `puckStableOverrides` memo comment at `EditorShell.tsx:2736-2738`); this is what would make revisiting it cheap.
- **0.21.2's load-time work and experimental virtualization** for large component trees — relevant to us, portfolio drafts are the deepest trees in the app.

## Bundle cost

Editor-only, but real, and worth stating on a perf branch:

- unpacked package size **1.29 MB to 2.65 MB** (2.1x)
- `@dnd-kit/*` **0.1.18 to 0.4.0** (engine rewrite, not a patch bump)
- new runtime dependencies: `@tiptap/*` (~14 packages, the richtext field), `@radix-ui/react-popover`, `@tanstack/react-virtual`, `object-hash`, `happy-dom`

**`happy-dom` — resolved, it never loads at runtime.** It is a hard dependency of `@puckeditor/core`, and `@tiptap/html`'s root export does resolve to a happy-dom build under the `node` condition, so the concern was reasonable. But Puck's richtext renderer sits behind `lazy(() => import("./Render-<hash>.mjs"))`, and `useRichtextProps` only mounts it for a field declaring `type: "richtext"`. We declare **zero**. The chunk is never fetched, client or server, and the `/rsc` entry does not reference it statically. Cost is install weight and Docker image size only. Do not re-investigate.

**The bundle itself is still unmeasured.** The 2.1x package growth reaches `/portfolio` (not the public pages, which import only `Render` from `/rsc`). Measuring it, and dynamically importing the editor mount, is carried in `03-code-splitting.md` and the follow-ups doc — it was not done here.

## Not evaluated

**Puck AI.** Out of scope by decision. For the record so nobody re-researches it: it is a Puck Cloud product, not part of the MIT core. Usage is metered at the model provider's list price plus a 20% platform fee, and bring-your-own-key requires the Launch plan at $199/month. It is not a free perk of upgrading.

**The `richtext` field** (0.21, TipTap-backed, supports inline `contentEditable` editing). Out of scope by decision. It is in the MIT core and would be a candidate to replace our `contentEditable: true` text fields, but that is a product change, not an upgrade requirement — the existing text fields keep working.

## Fix direction — executed

**Verdict: upgraded.** The sequence below is what was planned and what happened; the original provisional wording is kept underneath for the record.

1. **Done** — scope rename across 53 files + `package.json`, isolated commit, `tsc` as the gate.
2. **Done** — theming fixed by re-scoping 0.22's semantic aliases, guarded by `editorThemeBridge.test.ts`.
3. **Skipped, correctly** — the six substring selectors all still match; no migration needed.
4. **Done** — the Plugin Rail was real and was replaced with our own two-tab sidebar.
5. **Blocked** — `ContainerAnchor` stays. Manual testing found 0.23's insertion lines still drop incorrectly without it.
6. **Done for the upgrade's own surface; the wider e2e set is not clean.** The page-builder unit sweep is green (178 files / 3565 tests), `tsc --noEmit` is clean, and CI on the upgrade PR (typecheck / lint / test / **build**) passes. Both upgrade-specific specs now pass on measured geometry. The rest of the portfolio e2e set still fails for reasons catalogued in `## Validation` below — one was a real regression in this branch (fixed), the rest are environment drift, specs already dead on `dev`, and ~10 still undiagnosed. Those failures gate nothing: **CI does not run Playwright.**

---

*Original provisional wording, pre-spike:*

**Provisional verdict: upgrade, but gate it on the spike.** The upgrade is unusually cheap for a three-minor jump — no data migration, no block rewrites, no API removals that touch us — and the payoff is deleting the anchor mechanism rather than merely keeping pace. But the entire case rests on one unverified claim, and the cost sits in chrome that fails silently.

Sequence, once the spike confirms:

1. Scope rename across 56 files + `package.json`, as one isolated commit. Typecheck is the gate.
2. Fix the theming bridge — see `## Spike findings`, which replaces this step's original "full rewrite" estimate with a targeted re-scoping of the semantic tokens.
3. ~~Replace the overlay/canvas/drawer substring selectors~~ — not needed; the spike confirmed all six still match. Optional cleanup only.
4. Resolve the Plugin Rail. (The spike claimed this was unnecessary; that claim was retracted — see the section above.)
5. Only then, on a separate commit, attempt the `ContainerAnchor` deletion. It is the reward, not the migration.
6. Regression pass: the 157 portfolio unit tests, then one batched Playwright run over the editor at 1280px (editor chrome is not a public surface).

Do **not** bundle the richtext migration or any AI work into this. The upgrade should be provably behaviour-preserving before anything new is adopted on top of it.

## Spike findings

> Historical record of the 2026-09-22 spike, kept so the reasoning is auditable. **One finding in it was wrong and is marked retracted.** For what is true now, read `## What shipped`.

Run 2026-09-22 in a throwaway worktree on `@puckeditor/core@0.23.0`: scope rename across 53 source files, `pnpm remove @measured/puck && pnpm add @puckeditor/core@0.23.0` (+87 packages), then typecheck, the page-builder unit suite, and four browser probes of the live editor at 1280px.

**The editor boots on 0.23 with zero console errors and zero page errors.** Every observation below is measured, not inferred.

### Typecheck: 12 errors, all in test files, all one root cause

`tsc --noEmit` after the rename: **12 errors across 3 files, zero in production source.** Every one is the same thing — `lib/page-builder/blockShapes.test.tsx` (9), `blocks/PageBodyBlock.test.tsx` (2), `blocks/manualBlocks.test.tsx` (1) cast our typed config to the base `Config`, and 0.23 widened `resolvePermissions`'s params with a new `parent` property while narrowing `changed` to `never` on the default config type. A test-only typing fix, not an API migration.

### Unit tests: 2639 / 2639 pass

The whole `lib/page-builder` suite — 116 files — passes unchanged on 0.23. No block, no slot, no custom field, no reconciler regressed. (An intermediate run showed 4 failures; those were caused by the spike's own anchor-disabling patch, and all 4 pass once it is reverted.)

### Risk centre 2 was wrong — the internal class hooks all still match

Measured in the live DOM. Puck 0.23 still emits `_DraggableComponent-overlay_<hash>`, `_DraggableComponent-actionsOverlay_<hash>` and `_DraggableComponent-overlayWrapper_<hash>`, mounted on hover and on selection exactly as in 0.20 (they are absent at rest in both versions — that is the normal lifecycle, not breakage). `PuckCanvas_`, `PuckCanvas-loader` and `DrawerItem-draggable` are all present at rest. **All six `[class*=]` selectors in `editor.css:251-341` survive as-is.** Migrating them to the new `componentOverlay` override is now an optional cleanup, not upgrade work.

### Risk centre 3 — ~~the Plugin Rail never renders here~~ RETRACTED, it does render

**This finding was wrong and was retracted the same day.** It was produced by a DOM probe searching for class names matching `/rail/i`; Puck names them `Nav`, `NavItem`, `PuckPluginTab`, `Sidebar` and `SidebarSection`, so the probe found nothing and the absence was reported as fact. The rail renders plainly — a screenshot settled it. Overriding `header`/`drawer`/`fields` replaces what the rail *contains*, not the rail itself.

Counting DOM nodes is not enough either: `legacySideBarPlugin()` leaves the other plugins mounted and flagged `mobileOnly`, so the tab nodes stay in the document while laid out out of view. The decisive check is geometric — whether the block tree is inset from the sidebar's left edge by roughly a rail's width.

Risk centre 3 was therefore **real**, and cost a real (if small) fix. See `## What shipped`.

### Risk centre 1 was real, but the cause and the fix are both different

Our palette bridge **is** still applied: read from `.gallurio-editor`, `--puck-color-grey-12` and `--puck-color-white` correctly flip between near-white in light mode and near-black in dark. The bridge itself is fine.

What breaks is 0.22's semantic alias layer. Puck declares ~28 aliases such as `--puck-color-surface: var(--puck-color-grey-11)` and `--puck-color-text: var(--puck-color-black)`, and it declares them **at `:root`**. A custom property resolves where it is *declared*, so those aliases resolve against Puck's own palette before our `.gallurio-editor` overrides are ever in scope. Measured, identical in light and dark:

| token | value | should be (dark) |
|---|---|---|
| `--puck-color-surface` | `255,255,255` | `--card` = `31,33,35` |
| `--puck-color-surface-subtle` | `250,250,250` | tonal dark |
| `--puck-color-text` | `0,0,0` | `--foreground` = `226,229,231` |
| `--puck-color-interactive` | `1,88,173` | brand teal |
| `--puck-color-border` | `220,220,220` | `--border` |
| `--puck-color-line-placeholder` | `#6499cf` | brand teal |

And the real paint follows the aliases, not our palette: in dark mode the right properties panel paints pure white and the blocks drawer paints `#fafafa`. **The editor is effectively light-only on 0.23 until this is fixed.**

The fix is mechanical, not a re-derivation: either hoist the existing palette overrides from `.gallurio-editor` up to `:root`/`html` (where the aliases resolve), or redeclare the ~28 semantic aliases on `.gallurio-editor` so they re-resolve in our scope. The second is the safer one — it keeps Puck's variables scoped to the editor subtree instead of leaking them app-wide. Either way it is one focused edit to `editor.css`, not the ~190-line rewrite the desk audit budgeted. `--puck-color-line-placeholder` should be mapped at the same time so insertion lines land in brand teal rather than Puck's default blue.

### Unresolved: the ContainerAnchor question

**Not answered.** With anchor emission patched off the canvas rendered correctly and `[data-puck-component$="--anchor"]` count was 0, but every synthetic canvas-to-canvas drag no-opped: across two attempts the dragged block's parent and position were unchanged. Playwright's pointer events do not drive 0.23's rewritten `@dnd-kit` 0.4 sensors the way they drove 0.1.18, so the technique in the `portfolio-testing` skill needs re-validating against the new engine before automation can answer this.

The supporting machinery is confirmed present — `dnd.behavior` accepts `"auto" | "fluid" | "static"`, `dnd.disableOutlineDrag` exists, and `--puck-color-line-placeholder` is defined, so insertion lines are wired. Whether they actually let a block land beside a nested `Container`/`Columns` without the anchor bridge is a 60-second manual check: run the editor with `shouldKeepAnchor` returning `false` (`lib/page-builder/containerAnchorPredicate.ts:28`), load a draft with a nested container, and drag a block to the container's bottom edge.

### Revised verdict

**Upgrade.** The measured cost is far below the estimate: a mechanical 53-file scope rename, a test-only typing fix in 3 files, and one focused `editor.css` change to re-scope the semantic tokens. Nothing in the data layer, the blocks, the custom fields, the overrides or the CSS hooks needs touching, and the full page-builder suite passes untouched.

The anchor deletion — the actual prize — stays a separate, later commit gated on the manual drag check above. Upgrade first for the supported theming API, the outline, and the load-time work; delete the anchor mechanism only once a human has watched a block land where it should.

## What shipped

Carried out on `action/portfolio-puck-upgrade`, 2026-09-23. This section supersedes any prediction above it.

### Theming (risk centre 1)

Fixed as the spike's second option: `editor.css` now re-declares all 30 palette-backed semantic aliases inside `.gallurio-editor`, so they re-resolve in our scope instead of against Puck's `:root` palette. Puck's variables stay scoped to the editor subtree rather than leaking app-wide. **One block added; the ~190-line rewrite the desk audit budgeted was not needed.**

`editorThemeBridge.test.ts` guards it structurally: it reads Puck's own shipped `dist/index.css`, extracts every `--puck-*` property defined in terms of a palette variable, and asserts each one is re-declared in `editor.css`. A future Puck release that adds an alias fails the test instead of silently painting light-on-light.

### The sidebar (risk centre 3)

The rail was first removed with `legacySideBarPlugin()`, then replaced outright: the editor now mounts its own plugin rendering a two-tab column (Components / Outline). `Puck.Components` and `Puck.Outline` are public statics on the exported `Puck` function, so both panels are composed through supported API; `Puck.Components` still routes through our `drawer` override.

**The plugin's `name` must be exactly `legacy-side-bar`, and that is the whole mechanism.** Puck's rail hard-codes that literal — it flips every other plugin to `mobileOnly` and this one to `desktopOnly`, so a single render owns the desktop sidebar. Nothing else opts out. An earlier version of this section claimed that omitting `label`/`icon` was what kept a plugin off the rail; that was **wrong**. Omitting the label only changes the tab's caption, so the plugin shipped for a time as a third rail tab captioned with its own raw name, beside Blocks and Outline.

It also claimed the result was "verified geometrically (block tree inset 0px)". That was **not true and should not have been written**: the spike's own artifact (`e2e/.artifacts/puck023-chrome-report.json`) recorded `visibleRailTabs: 2` and `blocksInsetFromEditorLeft: 84`, and the spec asserting `< 40` failed. The report is written before the assertions run, which is how a failing run left a plausible-looking artifact behind. `puck023-chrome.spec.ts` now asserts zero visible rail tabs, the inset, the landing tab, and that opening Outline *swaps* the panel rather than stacking it.

### RTL

**Puck has no first-class RTL support**, so there was nothing to adopt. Measured in `dist/index.css`: zero `[dir=rtl]` rules, and a mix of logical (30 `inline-start` / 18 `inline-end`) and physical (23 `left:` / 18 `right:`) properties. Disregarded per instruction. Do not re-research this.

### Validation

- `blockSweep.test.tsx` — 242 cases generated from the registry itself (`puckConfig.components`, `SECTION_PRESET_KEYS`, `MANUAL_BLOCK_KEYS`, `PORTFOLIO_TEMPLATES`), so new blocks are covered on registration. Every component renders from its own `defaultProps`, keeps its `data-block` identity in canvas and publish alike, resolves the same inline style in both, honours at least one `_style` override, and (for the manual primitives) keeps spacing out of `defaultProps`.
- Two contracts pinned rather than skipped: **Navigation's `_style` is inert by design** (`NavigationBlock` destructures it as `_styleIgnored`; nav styling lives on `PortfolioHeaderConfig`), and **preset spacing in `defaultProps` is authored composition**, not a float-up violation — so the de-materialization check is scoped to `MANUAL_BLOCK_KEYS`.
- `publishRoundTrip.test.tsx` — all six templates published through the real `publishDraftAction` against a throwaway in-memory workspace, then the published data re-rendered through the production config. Publish may *add* structure (`normalizePageBody` wraps bare content in `PageBody`); the invariant pinned is that it never drops blocks.
- One batched browser pass at 1280px: five templates (57–79 blocks, 28–39 distinct types), the in-app preview iframe and the new-tab preview, zero console errors.

**The rail fix is now measured green.** `puck023-chrome.spec.ts` passes with `railWidth: 0`, `visibleRailItems: 0`, `blocksInsetFromEditorLeft: 0` (was 84), the Outline tab swapping the panel rather than stacking it, and 8 outline rows with PageBody expanded on first visit. Light and dark both resolve `--puck-color-surface` to `--card` and `--puck-color-text` to `--foreground`. Zero console errors.

**0.23 mounts inactive plugin panels rather than unmounting them.** Measured: `_PuckPluginTab_` is `display: none`, so the blocks and fields panels are each present **twice** with exactly one visible copy, and Puck's own mobile Outline panel is always in the DOM (1 present, 0 visible) while Components is active. Presence is therefore never the right assertion on 0.23 — only visibility distinguishes the tab an owner is looking at. Several specs that "fail on 0.23" fail for exactly this reason and need re-pointing at visibility, not deletion.

**`role="button"` on canvas components is not a 0.23 change.** 62 of 63 canvas components carry it. It comes from `@dnd-kit/dom`'s accessibility plugin, whose `defaultAttributes = { role: "button", roleDescription: "draggable" }` are **identical in 0.1.21 and 0.4.0** — it predates this upgrade. An earlier note here claiming otherwise was wrong. Note it is applied regardless of `permissions.drag`: Navigation, Footer and PageBody all set `drag: false` and all still carry the role, because Puck disables the draggable *after* registration and marks it with `data-puck-disabled`.

**Chasing the one component that lacked that role found a real, pre-existing data bug — unrelated to Puck.** The probe records each component's `data-puck-component` id; the census showed one id stamped on **two** disjoint DOM nodes, only one registered with dnd-kit. Root cause: `normalizeDirectoryFooter` in `lib/page-builder/templates/normalizePresetLayouts.ts` selected the footer credits line with `findNested(shellChildren, "Text")`, a depth-first pre-order walk that descended into the directory `Columns` and returned the tagline nested there. That one block object was then re-emitted in the credits slot while still inside the Columns — two DOM nodes sharing a single Puck component id (one undraggable, rendering 47px wide), and the real credits line dropped from the tree. It affected **three of five templates** (minimal, editorial, luxury), and the normalizer also runs on the draft save path, editor load, preview and public-page rendering, so it corrupted stored data the first time a footer was loaded or saved. Fixed by scoping the search to what follows the last `Divider`, with a regression test and a cross-template invariant asserting no id is emitted twice per zone. Two lessons: a probe aimed at one question is worth more than three hypotheses reasoned from DOM shape, and an a11y attribute missing from exactly one node was a *data* symptom, not an accessibility one.

**The wider portfolio e2e batch was not clean, and the reasons matter more than the count.** A 24-spec run finished 13 passed / 27 failed / 7 skipped. After a re-seed a second full run was 6 passed / 27 failed, but 13 of those were `ERR_CONNECTION_REFUSED` after the dev server died mid-run (`STATUS_STACK_BUFFER_OVERRUN`) and were void; re-running that subset gave 4 passed / 11 failed. Net standing position: **9 specs dead on `dev` before this branch, 13 still failing, 1 caused by a bad selector in my own new spec (fixed, now green).** The 13 were re-measured after the dev DB was re-seeded on the footer-normalizer fix — that re-seed alone cleared `batch1-flow`, both `portfolio-responsive` canvas/overflow cases and `preset-canvas-parity:114`, which had been failing on corrupted fixture data rather than on the upgrade. Full triage, with each failure's symptom and what is proven versus assumed, is item 7 of `docs/portfolio/puck-023-followups.md`. Every failure was traced before anything was re-run:

| cause | count | verdict |
|---|---|---|
| plugin named `gallurio-side-bar` instead of `legacy-side-bar`, leaving the rail up | — | **real regression in this branch**, fixed |
| dev DB missing `Editorial Summer Refresh` / `E2E Block Fixture` | 12 | environment drift; both are in `seed.ts`, so a re-seed restores them |
| specs waiting on `[class*="_ComponentList_"]` | 6 | **already dead on `dev`** — our `drawer` override drops `children`, so Puck's `ComponentList` never renders. `Components` is byte-identical in 0.20 and 0.23, and the override is untouched on this branch |
| specs loading drafts named `"<Label> Template"` | rest | those drafts were never in `seed.ts` — they survived only as hand-made leftovers in the shared dev DB. Now generated from `PORTFOLIO_TEMPLATES` so a clean `pnpm seed` reproduces them |
| Playwright strict-mode violations (a label resolving to 2 nodes, a PageBody count of 6) | several | **not duplication** — 0.23 keeps inactive plugin panels mounted at `display: none`. The selectors need scoping to visible nodes, not deleting |
| `[class*="PuckPluginTab"]` counted panel *bodies*, so the count could never reach 0 | 1 | my own bad selector in the new chrome spec; fixed to `nav[class*="_Nav_"]` width + `li[class*="_NavItem_"]` |
| remainder | 13 | re-measured after the re-seed and triaged in `docs/portfolio/puck-023-followups.md` (item 7): **5** are the `display: none` panel-scoping issue above, **5** are timeouts that are plausibly the same cause but unproven, **3** are genuinely undiagnosed |

Two process notes worth keeping. First, a spec that has drifted off its target selector fails *identically* to a real regression, so "it fails on `dev` too" has to be proven from the code, not assumed from the message. Second, `puck023-chrome.spec.ts` writes its JSON report **before** its assertions run — a failing run therefore leaves a complete-looking artifact behind, which is exactly how the retracted "rail is gone" claim survived as long as it did.

### Localization

The sidebar labels were hardcoded English, inherited from the `legacySideBarPlugin({ outlineLabel: "Outline" })` call the new sidebar replaced. They now resolve through `puckConfig.sidebar.*` in all 5 catalogs. `EditorSideBar` translates itself rather than taking labels as props — Puck renders panels through `createPortal` without mounting a second React root, so next-intl context reaches it, and the `plugins` array keeps the module-level identity Puck needs.

Puck's **own** chrome (drag handles, Insert drawer header, empty-slot placeholder) is still English. 0.23's Dictionary API is what would fix that, and it is the highest-ranked follow-up.

### The ContainerAnchor question — ANSWERED for now: anchors are KEPT

Disabling the anchors was attempted behind a single flag in `containerAnchorPredicate.ts` and then **reverted**. The mechanism stays, in full: undraggable (Puck 0.23's outline row gates dragging on the same `permissions.getPermissions({ item }).drag` the canvas reads, so the existing `drag: false` covers the outline too — pinned by a test), reconciled in and out of the data by child type, and rendering a real drop zone for the empty and all-container-class cases.

**Manual testing settled the open question, and the answer is no.** With anchors off, 0.23's insertion-line drag-and-drop still drops incorrectly. The bridge is not yet redundant, so the whole mechanism stays.

This also means automation still cannot cover it: synthetic Playwright drags no-op against `@dnd-kit` 0.4's rewritten sensors, so the drag recipe in the `portfolio-testing` skill needs re-validating against the new engine. Before anchor removal is even scopeable, someone has to characterise *how* the drop misbehaves — which targets, which nesting depth, and whether `dnd.behavior` set to `"fluid"` or `"static"` changes it. Tracked in `docs/portfolio/puck-023-followups.md`.
