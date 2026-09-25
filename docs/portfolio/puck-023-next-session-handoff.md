# Puck 0.23 follow-ups — handoff for the next session

Written 2026-09-25 at the end of the foundation-wave session. Read this first,
then `docs/portfolio/puck-023-followups.md` (the scope doc; every item number
below refers to it). Delete this file when the next session's PR consolidates
its own summary into the scope doc — it is a scratch handoff, not a durable
reference.

## Where things stand

- **Branch:** `update/portfolio-maker-updates`, pushed. **PR #108** → `dev`,
  open, not merged. Merge needs review + the owner's explicit approval.
- **Tree:** clean at the last commit of that PR. Start the next session on a
  new branch cut from `dev` *after* #108 merges (`action/puck-perf-wave` or
  similar). If #108 is still open, branch from `update/portfolio-maker-updates`
  and say so in the new PR.
- **Gates at hand-off:** `tsc --noEmit` clean; `pnpm lint` 0 errors; all 613
  vitest files pass (run in chunks); browser results below.

## What landed (PR #108)

| item | outcome | where to look |
|---|---|---|
| 13 | `pnpm analyze` (Turbopack `experimental-analyze`, build-free) + `scripts/perf/analyze-summary.mjs`; baseline table filled except rows 8 and 10 | scope doc item 13 + "Baseline" |
| 4 + 6 | presets are container-class **and** host bridge anchors; dead `height` prop removed; `overrides.componentOverlay` replaces the hashed-class CSS. **Owner manual drag test passed 2026-09-26**: (a) a block dropped on a preset's anchor lands as a sibling of the preset's inner Container, not inside it; (b) parent Container holding `[Container, Container, HeroPreset]` keeps its anchor and accepts a drop at its own level | `lib/page-builder/containerAnchorPredicate.ts`, `containerAnchorReconciler.ts`, `editorConfig.tsx` preset cfg, `EditorShell.tsx` overrides |
| 1 | 45 Puck chrome strings under `puck.chrome` × 5 locales, built with `t.raw` (not `t`) so Puck's `{placeholder}` syntax survives | `lib/page-builder/puckDictionary.ts` |
| 5 | slot-`as` audit: zero changes warranted | scope doc item 5 table |
| 14 | Base UI `Collapsible` behind `CollapsibleDrawer` + `EditorDrawerSection` (200 ms, reduced-motion aware) | `components/ui/collapsible.tsx` |
| 9 | 3 error boundaries, 16 actions + 5 route handlers with typed failures | scope doc item 9 |
| 7 | specs re-scoped from traces; `portfolio-nav-order` deleted (control absent); batched wave spec added | scope doc item 7, `e2e/puck023-followups-wave.spec.ts` |

## Browser results at hand-off

**Runs 4–7, 2026-09-26 (current state; supersedes the Run 3 table below).**
One `--project=setup` login, then every file with `--no-deps` — no rate
limit. Each failure was diagnosed from trace + code before anything was
edited. Artifacts: `e2e/.artifacts/run4`…`run7/<spec>/` (gitignored).

| spec | now | diagnosis | action |
|---|---|---|---|
| `puck023-chrome` | pass | — | — |
| `portfolio-preview-footer-gap` | **pass** | spec drift: read `main.firstElementChild` as the slot; PageBodyBlock renders a `<style>` tag first | selects `:scope > .pf-page-body-slot` |
| `item4-defaults-prefill` | **pass** (2/2) | spec drift: Puck 0.23 canvas wrappers have no accessible name, so `getByRole('button', {name:'Columns'})` matched nothing | `dispatchEvent("click")` on `[data-puck-component="e2e-columns"]` |
| `portfolio-page-body-batch` | **pass** | spec drift: `section > div > [role=button]` also matched 8 canvas block roots (Puck 0.23 gives them `role=button`, `cursor: grab`) | excludes `[data-puck-component]`; assertion now names offenders |
| `block-floated-parity` `:249` footer links | **pass** (all presets, contrast ≥ bar) | spec drift: expected brand *background*; `FOOTER_STATEMENT_PRESET` pins the links to `textColorToken: "foreground"` | expects `--pf-color-fg` |
| `block-floated-parity` `:131` GalleryGrid padding | **red** | fixture drift: **no seeded template contains a `GalleryGrid`** (Editorial's gallery zone is FeaturedWork) — zone switch works | not fixed. Insert a "Classic grid" preset (`GalleryGridPreset`, drawer group "Gallery grid") with the file's own `dragDrawerItemToCanvas`, or move the placeholder assertion to a unit test |
| `preset-canvas-parity` `:183` button families | **pass** (3/3, Run 7) | template drift: the spec's premise (soft "Get in Touch" → brand primary on Home; no-`_style` "Send a Message" → brand fg) is gone since `cdb012aa` re-ported the templates | rewritten to the families Editorial Home ships: soft "View Gallery" (label = brand fg, tinted fill) and outline "Send a Message" (label + border = brand fg, no fill); contrast checks kept |
| `portfolio-rtl-scoping` | **red** | fixture drift: clicks a "Glow" featured-work tile — **no "Glow" collection exists in `seed.ts`**, and the "Minimal Template" draft's FeaturedWork tiles are unconfigured ("select a collection") | not fixed — needs the seed to create a collection and a draft whose FeaturedWork points at it |
| `portfolio-responsive` 375 px | **red — probable app bug** | spec drifts fixed (Welcome dialog used `isVisible({timeout})`; "works best on a larger screen" banner now dismissed via "Continue anyway"). After that, the editor toolbar is in the a11y tree but **the Puck canvas paints over it** — `canvas-controls-trigger` click is intercepted by `Navigation-editorial-home-0`. Screenshot: no toolbar row under the app header | not fixed — probe the toolbar's and canvas's `getBoundingClientRect()` at 375 px first |
| `portfolio-page-body-child-height` | **pass** (Run 7) | **not an app bug** (the Run 3 read was wrong): presets are `overallWidth: "full"` by design (`sectionPresets.ts` `pageFitPresetProps`), and `PageBodyBlock` deliberately bleeds a full-width section across its side margin (unit-pinned in `PageBodyBlock.test.tsx:103-128`). The 47 px was that bleed | spec asserts the real rule: full-width sections span the slot edge to edge (±1.5 px), page-fit ones stay inside the margin |

Run 3 table (history — the traces it points at are superseded):

| spec | result | failure | read |
|---|---|---|---|
| `puck023-followups-wave` (warm-up) | pass | — | the other four wave tests passed in Run 2 (anchors in presets, panel transitions, Arabic Puck chrome, 2b A/B) |
| `anchor-snapshot-loop` | pass (Run 2) | — | no render loop with presets hosting anchors |
| `block-floated-parity` | 3 pass / 2 fail | `:128` waits 30 s for `[data-block="gallery-grid"]` in the canvas; `:250` "Minimal: Home link paints brand background" — expected `rgb(252,250,246)`, got `rgb(31,28,22)` | `:128`: the Gallery zone has no GalleryGrid in the fixture draft *or* the zone switch didn't happen — read the trace. `:250`: a real paint/token result on the Minimal preset footer, or seed drift (memory: seeded drafts predate the onPrimaryBand recipe) — prove which from code before touching |
| `portfolio-page-body-batch` | 1 pass / 1 fail | a `toBe(true)` further down the test (the `:scope >` fix got past the old count failure) | new failure point — read the trace for which assertion |
| `portfolio-responsive` | 3 pass / 1 fail | mobile test: click on `canvas-controls-trigger` times out (resolves to one visible button, so the duplicate is fixed; something covers it at 375 px) | likely the "Welcome back" dialog or a mobile overlay intercepting — check the trace's "intercepts pointer events" line |
| `preset-canvas-parity` | 3 pass / 1 fail | waits 30 s for canvas `a[role="button"]` "Get in Touch" | copy/fixture drift or the preset no longer renders that CTA — read the trace |
| `item4-defaults-prefill` | 1 pass / 2 fail | `getByRole('button', { name: 'Columns' }).first()` click times out at both 1280 and 768 | the drawer "Columns" row is inside a collapsed group now that item 14 animates it, or Puck's hidden twin; scope to visible + expand the Manual group first |
| `portfolio-rtl-scoping` | 1 pass / 1 fail | clicking "Glow" inside the Live preview iframe times out | preview iframe content not matching the spec's expectation — read the trace |
| `portfolio-page-body-child-height` | not run | WorkOS login: "Too many attempts. Try again in 419 seconds." | runner artifact, see below |
| `portfolio-preview-footer-gap` | not run | same rate limit | — |
| `puck023-chrome` | not run | same rate limit | — |

**Why the last three didn't run:** each per-file invocation re-ran
`auth.setup.ts`, i.e. ten WorkOS sign-ins in fifteen minutes, which tripped
WorkOS's rate limit. Fix for next time: run the setup once, then every spec
file with `--no-deps` so it reuses `e2e/.auth/owner.json`:

```
pnpm exec playwright test --project=setup
pnpm exec playwright test <spec file> --project=chromium --no-deps --trace retain-on-failure --reporter=list
```

**Three reds remain (see the Runs 4–7 table); resolve them before the perf
wave** — the suite has to be able to say whether 2a/10/8 broke something. Rule from this session's
experience: prove from the trace + code whether each is spec drift or a real
regression before editing either side; a drifted spec and a real bug fail
identically.

## Next session — do these in order

0. **Close the three reds** from the Runs 4–7 table. Diagnosis is done;
   what's left is:
   - the 375 px toolbar geometry probe, then the fix (app);
   - a seed decision for `rtl-scoping` and `:131` (a collection plus a
     configured FeaturedWork, and a GalleryGrid somewhere), to ask the owner
     about;
   - the FeaturedWork empty-state locale bug (below);
   - the three owner-requested editor UI changes (sidebar scroll, presets
     collapsed at start, drawer gap; see "Owner-requested editor UI
     changes").
   End with one consolidated re-run.
1. **Capture the two missing "before" rows first** (both have recipes in scope
   doc item 13; neither may be skipped — items 8 and 10 are unfalsifiable
   without them):
   - **Row 8** — gallery-picker network count. Automatable: add a Playwright
     request listener that counts `/api/portfolio/gallery*` requests over the
     recipe's exact click script. Record the number, commit.
   - **Row 10** — React Profiler commit/render counts of an unedited block.
     Needs React DevTools in a real browser; ask the owner to run the recipe
     and paste the numbers, or skip with an explicit note — do not invent one.
2. **2a — split the editor mount.** `dynamic(() => import(...), { ssr: false })`
   around the Puck mount in `EditorShell` (it statically imports Puck at the
   top of the file). Measure: `pnpm analyze -- -o`, then
   `node scripts/perf/analyze-summary.mjs "[locale]/portfolio" "[locale]/portfolio-preview"`;
   compare with rows 2a (1446.4 KB / 880.7 KB gzip). Done when the number moved
   and the editor still boots in one browser check.
3. **10 — `memo()` the block renderers.** First answer the open question: is
   Puck 0.23's `puck` render prop referentially stable across renders? If not,
   `memo` needs a comparator that ignores it. Record the answer in item 10
   before wrapping anything.
4. **8 — react-query at the editor boundary** (new dependency, editor-only).
   `usePickerData.ts` → `useQuery`; delete `GalleryPickerCacheContext`'s
   hand-rolled cache; `MediaPicker` → `useInfiniteQuery`. Every key includes
   `workspaceId`.
5. **3 / 11 — images.** `next/image` + a Cloudflare loader over
   `imageDeliveryUrl`; then per-lane virtualization. Lighthouse after, same
   recipe as the baseline (dev-mode numbers only).
6. **2b — per-block splitting.** Today portfolios A and B download
   byte-identical JS (1,591,671 B / 40 chunks, dev mode) — that is the number
   to beat. Must keep `blockSweep` three-way parity green.

## Owner-requested editor UI changes (2026-09-26; do in the next session)

Editor chrome only, so verify at 1280 px. Do all three in one change and one
browser check.

1. **Each sidebar scrolls on its own.** The left (Components/Outline) and
   right (fields) panels each get their own y-scrollbar, isolated from the
   page. They stay pinned (sticky) in view while the page or the canvas
   scrolls vertically. First find which ancestor scrolls today (canvas root
   vs. page vs. panel) before choosing `overflow-y-auto` + height vs.
   `sticky`.
2. **Preset blocks open with every group collapsed.** Today the Navigation
   group opens by default: `EditorShell.tsx:968`,
   `defaultOpen={group.id === "nav"}`. Remove that so nothing opens at the
   start. Check whether any e2e helper relies on Navigation starting open
   (`expandDrawerGroup` already clicks when `aria-expanded` is false).
3. **Remove the vertical gap between the "Preset blocks" and "Manual blocks"
   dropdowns.** They are sibling `CollapsibleDrawer`s inside Puck's `<Drawer>`
   (`EditorShell.tsx:961-991`). Measure where the space comes from (Drawer
   gap/padding vs. the drawer's own margin) before changing anything.

## Known app bugs surfaced (not fixed; triage before or alongside the perf wave)

- **Per-item nav reordering does not exist.** The spec that expected it was
  deleted; the owner decides whether to build it.
- **Crashed public page may stay indexable** (`generateMetadata` resolves
  before the render throws). Documented in item 9; SEO's call.
- **React "unique key" warnings** on `/w/[orgSlug]` in dev.
- **375 px editor: the Puck canvas covers the toolbar.** This was found in
  Run 5/6, after dismissing the "larger screen" banner. The toolbar's buttons
  exist, but a canvas block intercepts the click, so on a phone the canvas
  controls (device toggle, language, etc.) are unreachable. Geometry not yet
  probed.
- **Seed gaps block two specs:** no gallery collection named in any draft's
  FeaturedWork, and no GalleryGrid in any seeded template.
- **FeaturedWork empty-state hint uses the wrong locale (owner confirmed not
  intended, 2026-09-26).** "Select a collection to feature." / "No featured
  images yet." render in the *portfolio's* language (Arabic in
  `rtl-scoping`'s Live preview) while the CRM locale is `en`. Editor-facing
  hints should follow the CRM locale. Not fixed. Find where FeaturedWork
  resolves these strings, and check whether the published page shows them at
  all.

## Rules this box enforces (learned the hard way — follow them)

- **`pnpm install` before anything.** This session found `node_modules`
  holding `@measured/puck` 0.20.2 while the lockfile pinned
  `@puckeditor/core` 0.23.0.
- **7 GB RAM.** The harness's low-memory reaper kills every background task at
  once. Never run the dev server + Playwright alongside a subagent that runs
  vitest, or alongside `tsc`/`pnpm analyze`. Sequence: agent phases → stop
  agents → dev server + browser alone → stop server → typecheck.
- **Run Playwright one spec file at a time**, logging each result as it
  finishes, so a kill loses one file, not the batch. Warm `/portfolio` first
  (the wave spec's `--grep warm-up` test does it) or the first spec times out
  on Turbopack's cold compile.
- **Never edit the worktree while a browser run is up** — Turbopack HMR
  reloads the editor mid-test (that was the `item4-defaults-prefill`
  "timeout").
- **Vitest must be chunked** (`lib/page-builder`, portfolio app + `app/api`,
  `components messages`, `lib/db`, rest of `lib`, rest of `app` + `scripts`);
  one invocation of the whole suite never finishes here.
- **`next build` crashes** on this box (TS worker); `tsc --noEmit` is the gate,
  `rm -rf .next` before it after a dev server has run.
- **tdd-guard** is ON; the project-local switch is
  `.claude/tdd-guard/data/config.json`. Serialize guarded implementers.
- **Playwright traps:** `locator.isVisible({ timeout })` never waits — use
  `waitFor({ state: "visible" }).then(() => true).catch(() => false)`; the
  editor's Components/Outline and Content/Design/Layout switches are
  `aria-pressed` buttons, not `role="tab"`; Puck 0.23 keeps hidden duplicate
  panels mounted, so scope selectors to `:visible` or our own test ids; never
  target `_ComponentList_` (our drawer override removes it).
- **Commit messages from PowerShell:** write the file with
  `UTF8Encoding($false)` or the subject starts with a BOM.

## Useful commands

```
pnpm install
pnpm dev                                   # background; warm /w/seed-owner-demo with a GET
pnpm exec playwright test e2e/puck023-followups-wave.spec.ts --grep warm-up
pnpm exec playwright test <one spec file> --trace retain-on-failure --reporter=list
MEASURE_2B=1 pnpm exec playwright test e2e/puck023-followups-wave.spec.ts --grep 2b   # re-publishes A/B
pnpm analyze -- -o
node scripts/perf/analyze-summary.mjs "[locale]/portfolio" "w/[orgSlug]"
rm -rf .next && pnpm typecheck
```
