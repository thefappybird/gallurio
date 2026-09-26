# Puck 0.23 follow-ups — execution plan for `feat/portfolio-maker-perf`

## Context

`docs/portfolio/puck-023-next-session-handoff.md` is the scratch handoff from the foundation wave (PR #108, merged). It lists, in order: close three red e2e specs, three owner-requested editor UI changes, a FeaturedWork locale bug, two missing baseline rows, then the perf items 2a → 10 → 8 → 3/11 → 2b from `docs/portfolio/puck-023-followups.md` (the scope doc; item numbers below refer to it). The handoff is deleted at the end and its outcomes consolidated into the scope doc.

Branch state (verified): `feat/portfolio-maker-perf` = `dev` tip `1f8d4418`, zero commits ahead, clean tree. `node_modules/@puckeditor/core` is 0.23.0 (matches lockfile). `pnpm analyze` + `scripts/perf/analyze-summary.mjs` exist.

Owner decisions (2026-09-26): extend the E2E fixture draft for the seed gaps · FeaturedWork hints follow the CRM locale in editor + preview only, published page unchanged · take all three triaged app bugs (unique-key warnings, per-item nav reordering, noindex on a crashed public page) · **one PR for everything**.

## Findings that correct the handoff / scope doc (all verified in code)

1. **Item 10 is mostly already done by Puck.** Puck 0.23 wraps every canvas block render in `MemoizeComponent = memo(RenderComponent, shallowEqual(props minus puck) && deepEqual(puck))` (`node_modules/@puckeditor/core/dist/chunk-55V3NZVF.mjs:5446-5452`, used at `:5908` and `:5925`). Per-block `puckProps` is `useMemo`'d on `[metadata, componentConfig.metadata]` (`:5826-5834`). Answer to the open question: `puck` is **not** referentially stable — `EditorShell.tsx:3168` passes an inline `metadata={{…}}` literal, so its identity changes every EditorShell render — but Puck's `deepEqual` comparator absorbs that. Wrapping our renderers in `memo()` adds a redundant layer. The one cheap, real action: `useMemo` the editor `metadata` object so every `DropZoneChild` stops recomputing `puckProps`/`defaultsProps`/`transformedProps` per EditorShell render.
2. **Item 8's premise is stale.** `lib/page-builder/galleryPicker/usePickerData.ts` has ONE fetch site with a module-level cache, in-flight promise dedup and cross-instance invalidation (not "three `useEffect`+`fetch` sites"). `GalleryPickerCacheContext.tsx` caches per-collection feed pages for `MediaPicker.fetchFeed` (`MediaPicker.tsx:229-252`). Row 8's "before" will likely already be near-duplicate-free; the react-query migration is a code-shape change (delete two hand-rolled caches, one cache owner) more than a request-count win. Keep the decision, report the number honestly.
3. **2a cannot be read from the analyzer rows.** `analyze-summary.mjs:10-12` sums every reachable chunk *including lazy ones*; `dynamic()` moves bytes between chunks, not out of the graph. Add a runtime row: transferred JS on first load of `/portfolio` (same network-sum listener the wave spec already uses at `e2e/puck023-followups-wave.spec.ts:199`). Also: `ssr:false` `dynamic()` is only legal in a Client Component, so the split needs a thin `"use client"` loader; `page.tsx` currently imports `EditorShell` statically (`app/[locale]/(app)/portfolio/page.tsx:9`).
4. **Per-item nav reordering already exists and was deliberately hidden.** `NavOrderControl` (`lib/page-builder/StyleToolkitField.tsx:778-830`, aria-labels `Move {item} up/down`) is defined but unmounted with an `eslint-disable no-unused-vars` and the comment "the editor now uses the direction checkbox below rather than exposing this control" (`:775-777`; checkbox at `:872-879` sets `navDirection`). `navOrder` is still typed (`types.ts:294-296`), validated (`lib/validators/publicPage.ts`) and rendered (`PortfolioHeader.tsx:229,360,405`). The scope doc's "control does not exist" was wrong; the deleted spec (`git show 770ee07c^:e2e/portfolio-nav-order.spec.ts`) is restorable. Work = re-mount the control, not build it.
5. **375 px toolbar overlap has a Puck-CSS lead.** Below 638 px, while the left sidebar is visible, Puck sets the header grid row to `0` and `overflow:hidden` (`dist/index.css:2189-2191`, `2278-2280`). Puck hides both sidebars on mount below 638 px (`chunk:13120-13128`), but any later `setUi({leftSideBarVisible:true})` (our toggle at `EditorShell.tsx:505`, persisted UI) re-opens it. Probe before fixing.
6. **Sidebars already scroll on their own in Puck.** `._Sidebar_ { overflow-y:auto }` (`index.css:2767-2773`) inside `._PuckLayout_ { height:100dvh }` + inner `overflow:hidden`. Our nesting: app shell `<main class="flex-1 overflow-auto p-6">` under an app header (`app/[locale]/(app)/layout.tsx:89`) → page wrapper `-m-6 h-svh` (`page.tsx:173`) → EditorShell root `min-h-svh` → Puck `100dvh`. A 100dvh editor inside a (viewport − app header) box makes `<main>` scroll by the header height. Probe confirms which element scrolls.
7. **Drawer gap source is Puck's `.Drawer` flex gap** (`index.css:1482-1487`, `gap: var(--puck-space-3)`); `Drawer` accepts no `className` (`chunk:4787-4791`). Our Presets and Manual `CollapsibleDrawer`s are its two flex children (`EditorShell.tsx:961-992`).
8. **FeaturedWork hint locale.** Labels come from `puck.metadata.workspace.chrome.gallery` (`blockContext.ts:274-279`). Preview route resolves them with `chromeLocale` = formLocale override (`app/[locale]/portfolio-preview/page.tsx:106-114` → `:200-201`). The editor canvas passes only `chrome.nav` (`EditorShell.tsx:3180-3189`) so the canvas shows the hardcoded English defaults (`blockContext.ts:251-252`) whatever the CRM locale. Published page passes them in the portfolio language (`app/(public)/w/[orgSlug]/page.tsx:173-174`) and `FeaturedWorkBlock.tsx:128-166` has no `isEditing` guard — stays, per owner.
9. **Seed facts.** Collections Weddings/Editorial/Celebrations (`lib/db/seed.ts:527-549`); no seeded draft has a configured FeaturedWork; no seeded GalleryGrid. Fixture helpers exist: `galleryGrid()` (`lib/page-builder/templates/_blocks.ts:80`), no `featuredWork()` helper yet. `buildE2eFixtureData()` (`lib/db/seedE2eDraft.ts:65`) takes no args; FeaturedWork stores `collections: [{ id, … }]` and `reconcileFeaturedCollections` rebuilds name/cover/count from ids (`lib/page-builder/reconcile.ts:141-183`).
10. **`@tanstack/react-virtual` is a transitive dep only** (`package.json` has `@tanstack/react-table` only). pnpm strict mode → must be added explicitly if item 3 uses it.

## Cross-cutting rule — starter templates stay normalized (owner instruction, 2026-09-26)

The five starter templates are code (`lib/page-builder/templates/{editorial,luxury,minimal,modern,romantic}.ts` + `scratch.ts`, contract-tested by `templates/templates.test.ts`), the seed regenerates one "<Label> Template" draft per template (`seed.ts:659-672`), and saved drafts/published pages are brought up to date at load time by the normalizer chain — `normalizePresetLayouts` → `normalizePageBody` → `fillBlockDefaults` / `applyPageBodyContainerDefaults` — applied in `EditorShell.tsx`, `PreviewClient.tsx`, publish (`_draftActions.ts:381,387`) and the public page (`normalizePublicPageData.ts:104`).

For every wave, the executor checks whether the change alters a block's prop shape, default props, header config, or render contract. If it does, the same commit must:
1. update all five template files (and `scratch.ts` if applicable) + `templates.test.ts`;
2. extend the normalizer chain (`normalizePresetLayouts.ts` / `fillBlockDefaults.ts`) so drafts saved before the change load with the new shape — with a unit test feeding an old-shape fixture;
3. keep `blockSweep.test.tsx` three-way parity green;
4. re-seed (`pnpm seed`) so the seeded template drafts are regenerated, and the browser run for that wave opens at least one "<Label> Template" draft and the published `/w/seed-owner-demo` (editorial) to confirm the template still renders as designed.

Waves expected to trigger it: **Wave 1 / nav-order** (header config `navOrder` default vs the templates' header defaults and the `navDirection` interplay in `PortfolioHeader.tsx:338`), **Wave 1 / fixture** (new `featuredWork()` helper in `_blocks.ts` — helper only, no template data change), **Wave 4 / images** (if `sizes`/`priority`/aspect data become block props or defaults, every template's gallery/featured/hero image blocks get them). Waves 2, 3, 5 change no data shape; the executor still states "no template impact" in its report.

## Waves (single PR; one commit per coherent unit, gated on scoped vitest + eslint, orchestrator runs `tsc --noEmit`)

### Wave 0 — install, probes, baselines (read-only browser run first)

- `pnpm install`.
- **Run 1 (pre-edit, read-only)** — one setup login, then each file `--no-deps`; extend `e2e/puck023-followups-wave.spec.ts` with:
  - `item 8 baseline`: request listener counting `/api/portfolio/gallery*` over the exact recipe (scope doc item 13); record the count.
  - `2a baseline`: transferred `.js` bytes on first load of `/portfolio` (fresh context, dev mode) — new row.
  - `375 probe`: at 375 after "Continue anyway": classes on `._PuckLayout_` root, `getBoundingClientRect()` of the header override and of the canvas, `leftSideBarVisible` via the store. Records only.
  - `scroll probe`: at 1280, after a wheel event over the canvas: which of `main`, page wrapper, `._PuckLayout_`, `._Sidebar_` has `scrollTop > 0`; `main.clientHeight` vs `._PuckLayout_` height.
  - `unique-key capture`: console listener on `/w/seed-owner-demo`, store the warning text + component stack.
- Row 10 (React Profiler): ask the owner to run the recipe with DevTools now; if not available, write "not captured — needs DevTools" in the table. Never invent.

### Wave 1 — reds, editor UI, locale bug, app bugs (static; serialized agents)

Frontend seat (UI files only), then backend seat (seed/routes), one at a time (tdd-guard shared state).

1. **Seed fixture** (`lib/db/seedE2eDraft.ts`, `seed.ts:645`, `_blocks.ts`): add `featuredWork(id, collections)` helper; `buildE2eFixtureData({ featuredCollectionId })` adds a FeaturedWork on home pointing at the seeded Weddings collection and `galleryGrid("e2e-gallery-grid")` in the gallery zone; extend the contract comment (items 5–6). Unit test the builder output. Then `pnpm seed` (dev DB is disposable per project memory; still say so before running).
2. **Spec re-points**: `portfolio-rtl-scoping.spec.ts:26,73` → fixture draft + "Weddings" tile; `block-floated-parity.spec.ts:130-159` → fixture draft's Gallery zone.
3. **FeaturedWork locale**: preview route resolves `gallery.featuredEmpty/featuredSelect` with the route `locale` (second `getTranslations({ locale, namespace: "publicPage.chrome" })`), other chrome keeps `chromeLocale`; editor canvas adds `chrome.gallery.{featuredEmpty,featuredSelect}` from the CRM translator at `EditorShell.tsx:3180`. Tests: `portfolio-preview/page.test.tsx` asserts the two keys follow the route locale while `nav.*` follow formLocale.
4. **Editor UI (one change, 1280 only)**: (a) drop `defaultOpen={group.id === "nav"}` at `EditorShell.tsx:968` (leave `config.ts:145` — feeds Puck's own list our drawer override never renders; flag it); (b) wrap the two `CollapsibleDrawer`s in one `div` so `<Drawer>` has a single flex child; (c) sidebar scroll: decided by the Run 1 probe — expected fix is sizing the editor to the app shell's `<main>` box (e.g. page wrapper `h-full`/`min-h-0` chain instead of `h-svh`, EditorShell root `h-full` instead of `min-h-svh`) so Puck's own `overflow-y:auto` sidebars are the only vertical scrollers; if the probe shows something else, follow the probe.
5. **375 px toolbar**: decided by the probe. If `--leftSideBarVisible` is set at 375 → find who re-opens it (persisted UI restore / toggle) and keep sidebars closed below 638 on mount; if the header row is 0 for another reason, fix that. Re-enable the `portfolio-responsive` 375 test either way.
6. **Nav reordering**: mount `NavOrderControl` next to the direction checkbox (`StyleToolkitField.tsx:~880`) with `set("navOrder", next)`; remove the eslint-disable; localize `NAV_ITEM_LABELS` + aria-labels across 5 locales (en strings unchanged so the spec's `Move Contact up` still matches); restore `e2e/portfolio-nav-order.spec.ts` from `770ee07c^`, scope to `:visible` if needed; unit test the up/down handlers in `StyleToolkitField`'s test file.
7. **Unique-key warnings**: fix the list the Run 1 capture names; add a test that renders the component and asserts no `console.error` with "unique key".
8. **noindex on crashed public page**: `app/(public)/w/[orgSlug]/error.tsx` renders `<meta name="robots" content="noindex" />` (React 19 hoists metadata tags rendered in the tree; confirm with context7 React 19 docs before relying on it). Unit test asserts the meta is in the rendered output. Record in item 9 that `generateMetadata` is unchanged.
9. **Run 2 (post wave 1, 1280 + the 375 responsive test)**: reds (`block-floated-parity`, `portfolio-rtl-scoping`, `portfolio-responsive`), `portfolio-nav-order`, editor-UI assertions folded into the wave spec (no group `aria-expanded=true` at load; zero gap between the two drawers; sidebar `scrollHeight > clientHeight` scrolls while `main.scrollTop` stays 0), canvas hint stays English after switching formLocale to `ar` (extend rtl spec), no unique-key warning on `/w/seed-owner-demo`.

Commit per item. Then `rm -rf .next && pnpm typecheck`.

### Wave 2 — 2a editor-mount split

- New `app/[locale]/(app)/portfolio/_components/EditorShellLoader.tsx` (`"use client"`): `dynamic(() => import("./EditorShell").then(m => m.EditorShell), { ssr: false, loading })`; `page.tsx` renders the loader (keep the `EditorTemplateSummary` type import). Pattern precedent: `components/ui/location-picker.tsx`.
- Measure: `pnpm analyze -- -o` + `analyze-summary.mjs "[locale]/portfolio" "[locale]/portfolio-preview"` (expect ~unchanged; record) **and** the new first-load row in Run 3. Preview route: `PreviewClient.tsx:4` imports the client `Render` statically — it *is* the page; nothing to split there, record that.

### Wave 3 — item 10 + item 8

- **10**: write finding #1 into the scope doc; `useMemo` the EditorShell `metadata` (deps: `workspaceName, slug, collectionsPopup, cssVars, canvasContactDir, tNav` + the new gallery labels). No `memo()` on blocks unless row 10 "after" (owner-captured) shows unedited-block renders > 0.
- **8**: `pnpm add @tanstack/react-query`; `QueryClientProvider` created in `useState` at the top of `EditorShell`; `page.tsx` passes `workspaceId={String(workspace._id)}` (already computed at `:81`) — every key is `["gallery", workspaceId, …]`. `usePickerData` → `useQuery` (delete the module cache/listeners; `invalidatePickerData` callers → `useQueryClient().invalidateQueries`); `MediaPicker.fetchFeed` → `useInfiniteQuery`; delete `GalleryPickerCacheContext.tsx` + its provider in `EditorShell.tsx:122`; the six one-off dialog fetches → `useQuery`. Mutations invalidate keys instead of `router.refresh()`. Tests: rewrite `usePickerData`/`MediaPicker` tests under a `QueryClientProvider`; a tenant-isolation test (key for workspace A never serves B).
- **Run 3**: editor boots after the split; row 8 "after" count; 2a first-load "after"; picker open/switch/switch-back flow works.

### Wave 4 — item 3 (measured by 11)

- Loader: `lib/storage/cfImageLoader.ts` parses `https://imagedelivery.net/<hash>/<id>/<variant>` and rewrites the variant to `w=<width>,q=<quality>` (handles `/public`), passed via the **per-image `loader` prop** — not `images.loaderFile`, which would hijack the marketing/app `next/image` usages (`app/[locale]/(marketing)/*`, `components/app/*`). Register in `REUSABLE_CODE.md`.
- `<img>` → `next/image` on the public/parity surfaces: `GalleryGridBlock`, `GalleryMasonryBlock`/`MasonryCloneClient`, `FeaturedCollectionsClient`, `Lightbox`, `ImmersiveViewer`, `popupLayouts/*`, `imageModal/*`, `PortfolioHeader` logo, `bannerLayers`/`ContainerBackgroundSlideshow`. Skip editor-only pickers (`galleryPicker/*`, `StyleToolkitField`, preset preview cards). `sizes` from the block's column count; `priority` only on above-the-fold home tiles.
- Virtualization: only the client modal/popup lists (`Lightbox`, `FeaturedCollectionsClient` popup, `popupLayouts/*`) — they mount their whole list up front and are not crawl surfaces. Public grids keep full server-rendered markup (crawlability constraint in item 3) and rely on `next/image` lazy loading. `pnpm add @tanstack/react-virtual`. Stated as the scope interpretation — owner can veto at review.
- `blockSweep.test.tsx` parity stays green (canvas/preview/publish render the same `<img>` attrs).
- **Run 4**: Lighthouse recipe (item 13) mobile+desktop ×3 on home + gallery, DOM node count; public pages at 375/768/1280 × light/dark; formLocale axis (5 values) via the preview route at 375; `ar` popup RTL geometry inside its container.

### Wave 5 — 2b per-block splitting

- The 21 `"use client"` files under `lib/page-builder/blocks/` are islands imported by server-rendered block files. Split at the island import (`next/dynamic`, SSR kept — no `ssr:false`, SEO) inside the block files, so a page whose data lacks e.g. GalleryMasonry never downloads `MasonryCloneClient`/lightbox/carousel code. Because both consumers (`app/(public)/w/[orgSlug]/page.tsx` server `Render`, `PreviewClient.tsx` client `Render`) import the same `puckConfig`, the split lands on both. Navigation/`PortfolioHeader` and hero layers stay static (LCP).
- **Run 5**: `MEASURE_2B=1` A/B runtime rows (beat 1,591,671 B / 40 chunks; A ≠ B), `/portfolio-preview` analyzer row, `blockSweep` parity, `puck023-followups-wave` green.

### Wave 6 — docs + gates + PR

- Scope doc: "Landed" notes per item, baseline "after" cells, findings #1–#4 recorded (item 7 gets the nav-order correction), the two new rows (2a first-load, 375/scroll probes summarised). Delete the handoff doc; repair its inbound pointer (`puck-023-followups.md:1025`) and any in `docs/AGENTS-INDEX.md`. Net: one changed doc.
- Gates: chunked vitest (`lib/page-builder`, portfolio app + `app/api`, `components messages`, `lib/db`, rest of `lib`, rest of `app` + `scripts`), `pnpm lint`, `rm -rf .next && pnpm typecheck`. PR to `dev` with a `- [ ]` checklist; merge only on explicit approval.

## Browser-run budget (5 runs, all orchestrator-only, dev server + Playwright alone on the box)

| run | after | answers |
|---|---|---|
| 1 | install | probes (375 toolbar, scroll ancestor, unique-key stack), row 8 + 2a first-load "before" |
| 2 | wave 1 | three reds green, nav-order spec, editor UI asserts, canvas hint locale |
| 3 | waves 2–3 | editor boots split, row 8 + 2a "after", picker flow |
| 4 | wave 4 | Lighthouse/DOM rows, public 3-bp × light/dark, formLocale axis, ar RTL |
| 5 | wave 5 | 2b A/B rows, parity, wave spec |

Rules carried from the handoff: one `--project=setup` login then `--no-deps` per file; warm `/portfolio` first; never edit the worktree during a run; agents stopped before any run; `tsc` only after the server is down.

## Agent dispatch

- Read-only readers parallel (≤3). Implementers **one at a time** (tdd-guard shared state); roster agents run vitest via `node ./node_modules/vitest/vitest.mjs run <file>`; orchestrator alone runs seed, typecheck, Playwright, commits (`git diff --cached --name-only` check before each commit).
- Seat split: frontend = EditorShell/StyleToolkitField/blocks/locales/specs; backend = seed, preview route, error.tsx, route handlers, react-query provider wiring is frontend (client file) but `page.tsx` prop = backend → handoff spec in the report.

## Out of scope (record in the scope doc as open)

- Re-validating the Playwright drag recipe against dnd-kit 0.4 (handoff item 8 of "open").
- Row 10 if the owner cannot capture it — table cell says so; item 10 closes on finding #1 + the metadata memo.
