# Perf audit: Puck upgrade blast radius — score 8/10 (upgrade is viable; measured cost is small and concentrated in editor theming)

> A throwaway spike ran the real upgrade on 2026-09-22 against `@puckeditor/core@0.23.0`. **Read `## Spike findings` at the bottom before acting on the predictions above it** — three of the desk audit's estimates were wrong, two in our favour.


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

### 1. The theming bridge — full rewrite (highest cost)

`app/[locale]/(app)/portfolio/_components/editor.css:41-233` (~190 lines) remaps `--puck-color-grey-01..12`, `--puck-color-azure-02..12`, `--puck-color-white`, `--puck-color-black` and `--puck-font-family` onto our semantic tokens, twice (light + dark). This is the **only** thing making the editor follow app dark mode, and it is precisely the undocumented palette-variable override 0.22 replaced.

Expect to rewrite the whole block against the documented token API (`--puck-color-interactive`, `--puck-radius-m`, and siblings). Not mechanical — it is a re-derivation of the mapping, including the deliberate inverted-scheme trick documented at `editor.css:263-282`. Budget this as the single largest item.

### 2. Internal class-name CSS hooks — likely silent breakage

`editor.css:251-341` reaches Puck's hashed CSS-module class names by substring:

- `[class*="DraggableComponent-overlay"]`, `-actionsOverlay`, `-overlayWrapper` — suppress the hover/selection chrome on `ContainerAnchor` spacers.
- `[class*="PuckCanvas_"]` — kill the canvas frame padding.
- `[class*="PuckCanvas-loader"]` — remove the permanently-invisible loader that still steals ~26px of row width.
- `[class*="DrawerItem-draggable"]` — grab/grabbing cursor on drawer rows.

These six are the *only* Puck-coupled CSS in the repo. The other `!important` rules in the portfolio code — `responsive.ts:115`, `manualBlocks.tsx:1394-1403`, `GalleryMasonryBlock.tsx:297,323`, `RootCanvasStyle.tsx:140,142` — all target our own class names (`PF_COLUMN_STACK_CLASS`, `contentAlignmentClass`, `PF_FULL_WIDTH_CONTAINER_SLOT_CLASS`) and our own `[data-block]` / `[data-pf-*]` attributes, so they are upgrade-inert. Don't re-audit them.

0.22 restyled the overlays and 0.23 rewrote drag-and-drop and the outline. These selectors fail **silently** — nothing errors, the editor just looks wrong. The supported replacements now exist: the new `componentOverlay` override for the first group, theming tokens for drag indicators and outline styling for the rest. Treat every one of these six selectors as needing re-verification in a browser, not a grep.

### 3. Plugin Rail vs our chrome — unknown until observed

Our `header` override (`EditorShell.tsx:3175-3209`) renders its own sidebar-visibility toggles driven by `appState.ui.leftSideBarVisible` / `rightSideBarVisible` (`:470-522`), and our `drawer` override replaces Puck's flat block list with a two-level preset tree (`PresetBlocksDrawer`). Under 0.21's rail, the drawer, outline and fields are *plugins* rendered into a rail rather than a sidebar, and plugin overrides are curried.

`legacySideBarPlugin()` is documented to restore the old stacked single sidebar, which would likely make all of this a no-op. Unproven — this is a spike question.

### 4. Mechanical

- 56 files import `@measured/puck`; a scope rename across all of them plus `package.json`. Trivially codemoddable, but it touches nearly the whole `lib/page-builder` tree, so it should land as its own commit to keep the semantic changes readable.
- ~64 `createUsePuck` selector call sites reading `appState.ui.itemSelector`, `history.back/forward`, `getPermissions`, and dispatching `remove` / `setUi` / `setData`. No documented change to the store shape, but this is the widest surface the docs do not cover and typecheck is the only thing guarding it.
- 157 portfolio-area test files plus ~15 portfolio `e2e/*.spec.ts` re-run as regression surface.

## What we would gain

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

`happy-dom` as a *runtime* dependency is the one that deserves a second look. None of this reaches the public portfolio pages, which import only `Render` from `/rsc` — but it does reach `/portfolio`, and that should be measured after the upgrade rather than assumed benign.

## Not evaluated

**Puck AI.** Out of scope by decision. For the record so nobody re-researches it: it is a Puck Cloud product, not part of the MIT core. Usage is metered at the model provider's list price plus a 20% platform fee, and bring-your-own-key requires the Launch plan at $199/month. It is not a free perk of upgrading.

**The `richtext` field** (0.21, TipTap-backed, supports inline `contentEditable` editing). Out of scope by decision. It is in the MIT core and would be a candidate to replace our `contentEditable: true` text fields, but that is a product change, not an upgrade requirement — the existing text fields keep working.

## Fix direction

**Provisional verdict: upgrade, but gate it on the spike.** The upgrade is unusually cheap for a three-minor jump — no data migration, no block rewrites, no API removals that touch us — and the payoff is deleting the anchor mechanism rather than merely keeping pace. But the entire case rests on one unverified claim, and the cost sits in chrome that fails silently.

Sequence, once the spike confirms:

1. Scope rename across 56 files + `package.json`, as one isolated commit. Typecheck is the gate.
2. Fix the theming bridge — see `## Spike findings`, which replaces this step's original "full rewrite" estimate with a targeted re-scoping of the semantic tokens.
3. ~~Replace the overlay/canvas/drawer substring selectors~~ — not needed; the spike confirmed all six still match. Optional cleanup only.
4. ~~Resolve the Plugin Rail~~ — not needed; the spike confirmed it never renders behind our overrides.
5. Only then, on a separate commit, attempt the `ContainerAnchor` deletion. It is the reward, not the migration.
6. Regression pass: the 157 portfolio unit tests, then one batched Playwright run over the editor at 1280px (editor chrome is not a public surface).

Do **not** bundle the richtext migration or any AI work into this. The upgrade should be provably behaviour-preserving before anything new is adopted on top of it.

## Spike findings

Run 2026-09-22 in a throwaway worktree on `@puckeditor/core@0.23.0`: scope rename across 53 source files, `pnpm remove @measured/puck && pnpm add @puckeditor/core@0.23.0` (+87 packages), then typecheck, the page-builder unit suite, and four browser probes of the live editor at 1280px.

**The editor boots on 0.23 with zero console errors and zero page errors.** Every observation below is measured, not inferred.

### Typecheck: 12 errors, all in test files, all one root cause

`tsc --noEmit` after the rename: **12 errors across 3 files, zero in production source.** Every one is the same thing — `lib/page-builder/blockShapes.test.tsx` (9), `blocks/PageBodyBlock.test.tsx` (2), `blocks/manualBlocks.test.tsx` (1) cast our typed config to the base `Config`, and 0.23 widened `resolvePermissions`'s params with a new `parent` property while narrowing `changed` to `never` on the default config type. A test-only typing fix, not an API migration.

### Unit tests: 2639 / 2639 pass

The whole `lib/page-builder` suite — 116 files — passes unchanged on 0.23. No block, no slot, no custom field, no reconciler regressed. (An intermediate run showed 4 failures; those were caused by the spike's own anchor-disabling patch, and all 4 pass once it is reverted.)

### Risk centre 2 was wrong — the internal class hooks all still match

Measured in the live DOM. Puck 0.23 still emits `_DraggableComponent-overlay_<hash>`, `_DraggableComponent-actionsOverlay_<hash>` and `_DraggableComponent-overlayWrapper_<hash>`, mounted on hover and on selection exactly as in 0.20 (they are absent at rest in both versions — that is the normal lifecycle, not breakage). `PuckCanvas_`, `PuckCanvas-loader` and `DrawerItem-draggable` are all present at rest. **All six `[class*=]` selectors in `editor.css:251-341` survive as-is.** Migrating them to the new `componentOverlay` override is now an optional cleanup, not upgrade work.

### Risk centre 3 was wrong — the Plugin Rail never renders here

No rail classes exist anywhere in the DOM, and all six of our override tour anchors are present (`canvas`, `canvas-viewport`, `blocks-panel`, `properties-panel-body`, `section-tabs`, `publish`). Because we override `header`, `drawer` and `fields` wholesale, the rail surfaces are replaced before they can render. `legacySideBarPlugin()` is not needed. The plugin system is live alongside our overrides — `_OutlinePlugin_`, `_OutlineWrapper_` and `_OutlineHeader_` classes appear in the DOM — and coexists without conflict.

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
