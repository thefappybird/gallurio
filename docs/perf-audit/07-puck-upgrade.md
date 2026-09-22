# Perf audit: Puck upgrade blast radius — score 7/10 (upgrade is viable, cost is concentrated in editor chrome)

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
2. Rewrite the `editor.css` theming bridge against the documented token API. Verify light + dark against the tokens, not by eye.
3. Replace the overlay/canvas/drawer substring selectors with `componentOverlay` and theming tokens where a supported hook now exists; keep a substring rule only where none does, and comment why.
4. Resolve the Plugin Rail — `legacySideBarPlugin()` if it restores our sidebar assumptions, otherwise rework the header toggles and `drawer` override.
5. Only then, on a separate commit, attempt the `ContainerAnchor` deletion. It is the reward, not the migration.
6. Regression pass: the 157 portfolio unit tests, then one batched Playwright run over the editor at 1280px (editor chrome is not a public surface).

Do **not** bundle the richtext migration or any AI work into this. The upgrade should be provably behaviour-preserving before anything new is adopted on top of it.
