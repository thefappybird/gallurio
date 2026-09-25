# Puck 0.23 follow-ups — scope for the next branch

The 0.23 upgrade (`action/portfolio-puck-upgrade`) was deliberately kept
behaviour-preserving: it changed the package, fixed the editor theming, replaced
the plugin rail, and proved the blocks and published data survive. Everything
the upgrade *unlocked* was left out of it on purpose. This is that list.

Source: the "What we would gain" section of `docs/perf-audit/07-puck-upgrade.md`,
plus the code-splitting and virtualization audit points (`03`, `05`).

Items 1-6 are unlocks, not bug fixes. Item 7 is the exception: it is the
portfolio e2e set the upgrade left red, and it is maintenance rather than new
capability. Each item is independently shippable — do not bundle them into one
commit.

**This doc is also the portfolio-module slice of the perf audits.** The
`docs/perf-audit/01`–`06` files score the whole application; they are being
worked **per module**, and items 8–13 below are the portfolio module's share.
Every item names which of these surfaces it applies to:

- **Editor** — the Puck canvas and every control/tab around it
  (`app/[locale]/(app)/portfolio/_components/*`, `lib/page-builder/*` including
  `StyleToolkitField`, `galleryPicker/*`, `MediaPicker`, `LayoutPicker`, the
  dialogs).
- **Published page** — `app/(public)/w/[orgSlug]/{page,gallery/page,layout}.tsx`,
  rendered through `Render` from `@puckeditor/core/rsc`.
- **Preview** — the editor's Preview tab (iframe) and "preview in new tab" are
  **one route**, `app/[locale]/portfolio-preview/page.tsx` →
  `_components/PreviewClient.tsx`, which renders **client-side** with `Render`
  from `@puckeditor/core` (not `/rsc`) from the localStorage draft. One route,
  one fix surface — never count it twice.

"Passing" an audit here means **measured before/after**, not "fix applied":
every item that touches a rendered surface carries a `Measure:` line naming the
metric, the tool, the page or script, and where the number is recorded. The
`0X` audit files are not re-scored by this branch.

---

## 1. Dictionary API — localize Puck's own chrome

**Why this is first.** We ship 5 locales (`en`, `fil`, `id`, `ar`, `th`) and the
editor leaks hard English into all of them. Our own chrome is already localized
through `createEditorConfig(t)`; Puck's built-in strings were simply not
localizable before 0.23 — drag handles, the Insert drawer header, the empty-slot
placeholder, outline row actions. 0.23 adds a runtime `dictionary` prop, so that
constraint is gone and the remaining English is now a choice.

This compounds with RTL. Puck ships **no** `[dir=rtl]` rules at all (measured:
zero, against 30 `inline-start` / 18 `inline-end` and 23 `left:` / 18 `right:`),
so an Arabic-speaking owner currently gets English chrome in a hard-LTR sidebar.
Dictionary fixes the language half. The direction half is a separate, larger
question and is **not** in this scope.

**Work:**
- Enumerate Puck's dictionary keys from `Dictionary` (exported from
  `@puckeditor/core`) and `useMessage` call sites in the shipped bundle.
- Add a `puck.chrome.*` block to all 5 message catalogs.
- Thread `dictionary={...}` into `<Puck>` from `EditorShell`, built with
  `useTranslations` and memoized on `t` (the `plugins` array next to it is
  module-level for identity reasons — do not accidentally make it per-render).
- Verify in `ar` that nothing overflows its container.

**Done when:** no hardcoded English remains in editor chrome, and a locale switch
changes Puck's own strings, asserted on rendered text (which also catches
mojibake).

**Landed 2026-09-25.** Puck 0.23's `defaultDictionary` has 72 keys; 27 are
`field-richtext-*` for a field type this app never registers, so 45 are
localized under a top-level `puck.chrome` block in all five catalogs.
`lib/page-builder/puckDictionary.ts` builds the prop from `t.raw(key)` — raw,
not `t(key)`, because Puck interpolates its own `{title}`/`{count}` syntax and
next-intl would otherwise try to ICU-format those braces. `EditorShell`
memoizes it on the `puck.chrome` translator; `puckPlugins` stayed module-level.
Tests pin the key list, per-locale presence, placeholder parity with `en`, and
a copy-paste guard (at most three values per locale may equal English). The
rendered-text assertion in `ar` belongs to the batched browser run.

---

## 2. Code splitting — the editor, then the published page

Two distinct problems that `03-code-splitting.md` treats as one.

### 2a. The editor bundle (existing audit finding, now worse)

`EditorShell.tsx:6` statically imports Puck, so `/portfolio` ships the whole
drag-and-drop editor before the owner touches anything. The 0.23 upgrade roughly
doubles that: **1.29 MB -> 2.65 MB unpacked**, plus `@tiptap/*`,
`@radix-ui/react-popover` and `@tanstack/react-virtual`.

**Work:** `dynamic(..., { ssr: false })` the Puck mount, and add
`optimizePackageImports` for `@puckeditor/core` in `next.config.ts`.

**Measure first.** The audit says to measure rather than assume, and that has
still not been done. Add a bundle analyzer to `next.config.ts` and record the
before/after — otherwise "we improved it" is unfalsifiable. The analyzer and the
baseline capture are item 13; do not start 2a before item 13 has landed.

**Surfaces:** editor, and preview. `/portfolio-preview` imports the client
`Render` from `@puckeditor/core` (`PreviewClient.tsx:4`), so the preview route
also ships Puck's client renderer plus every block. Whatever split 2a applies to
the editor mount, check the preview route's first-load JS in the same analyzer
run.

**Measure:** first-load JS (gzipped) for the `/portfolio` and `/portfolio-preview`
routes from the item-13 analyzer, before and after, recorded in the baseline
table. Done when the number moved and the editor still boots in the batched
Playwright run.

> Settled during the upgrade, so nobody re-investigates: **`happy-dom` never
> loads at runtime.** It is a hard dependency of `@puckeditor/core`, and
> `@tiptap/html`'s root export resolves to a happy-dom build under the `node`
> condition — but Puck's richtext renderer sits behind
> `lazy(() => import("./Render-…mjs"))`, and `useRichtextProps` only mounts it
> for a field with `type: "richtext"`. We register zero. The chunk is never
> fetched, client or server, and the `/rsc` entry does not reference it
> statically. It costs install weight and image size, nothing else.

### 2b. Per-block splitting on the published page

Not in the original audit — raised separately, and the more interesting half.

Today `app/(public)/w/[orgSlug]/page.tsx` renders through one shared
`puckConfig`, so **every** visitor downloads **every** block's client code even
though a given portfolio uses a fraction of them. A minimal portfolio pays for
the masonry gallery, the lightbox, the carousel and the contact sheet.

**Work:** split the *client* blocks behind `next/dynamic` at the config level,
keyed by block type, so a page only pulls the blocks its data actually contains.

**Surfaces:** published page and preview. `puckConfig` has **two** consumers, not
one: `app/(public)/w/[orgSlug]/page.tsx:4` (server `Render`) and
`app/[locale]/portfolio-preview/_components/PreviewClient.tsx:5` (client
`Render`). The split must land on both, or the preview keeps paying the full
bundle the published page no longer does.

**Constraints that make this non-trivial — read before starting:**
- The editor and the renderer share one config (`lib/page-builder/config.ts` vs
  `editorConfig.tsx`). A split that only applies to the public renderer must not
  fork block behaviour, or it breaks the canvas/preview/publish parity invariant
  that `blockSweep.test.tsx` pins. Parity is three-way — canvas, preview,
  publish — and the preview is the one most likely to be forgotten because it is
  client-rendered from localStorage rather than from the DB.
- Many blocks are server-rendered already. Splitting those buys nothing and
  costs a suspense boundary.
- Above-the-fold blocks (nav, hero) must **not** be lazy — that trades bundle
  size for LCP, which is the wrong direction on the surface SEO cares about.

**Measure:** first-load JS for `/w/[orgSlug]` and `/w/[orgSlug]/gallery` for
two seeded portfolios with different block sets, from the item-13 analyzer, plus
the `/portfolio-preview` route. Before/after in the baseline table.

**Done when:** two portfolios with different block sets provably download
different JS, the preview route's number moved with them, and `blockSweep`'s
parity assertions still pass.

---

## 3. Virtualization — images, not blocks

`05-virtualization.md` is the home audit point. Puck's own
`_experimentalVirtualization` is explicitly **out of scope** — it is flagged
experimental, and our templates run 57-79 blocks, which is nowhere near the
threshold where it pays.

What is worth virtualizing is **images**, in three places:

1. **`FeaturedWork` / featured collections** — a collection can hold far more
   images than fit a viewport.
2. **Long gallery grids** — `GalleryGridBlock` and `GalleryMasonryBlock` render
   every tile. A gallery page is the single heaviest public surface we ship.
3. **Image modal layouts** — the lightbox and the collections popup
   (`Lightbox.tsx`, `FeaturedCollectionsClient.tsx`, the `popupLayouts/*` set),
   which mount their whole image list up front.

`@tanstack/react-virtual` now arrives as a Puck dependency, so it is already in
the tree either way.

**Surfaces:** published page first (it is the one visitors and Core Web Vitals
see), preview and editor canvas for parity.

**Image element — decided 2026-09-25: `next/image` with a custom Cloudflare
Images loader.** `05-virtualization.md` asks for `next/image` (responsive
`srcSet`, `priority`, blur placeholder); the earlier draft of this item said
plain `<img loading="lazy">` for crawlability. `next/image` wins: it still
renders a real `<img>` with `src`/`srcset`/`width`/`height`, so it is exactly as
crawlable, and it gets `sizes` and `priority` right for free.

- The loader is a thin wrapper over `imageDeliveryUrl` in
  `lib/storage/cloudflareImages.ts:140` (client twin
  `lib/storage/imageDelivery.client`), which already builds flexible-variant
  URLs (`https://imagedelivery.net/<hash>/<id>/<parts.join(",")>`) — map
  `width` → `w=` and `quality` → `q=`. `next.config.ts` already allows the
  `imagedelivery.net` remote pattern; it does not yet declare a loader.
- `sizes` is derived from the block's column count (the grid and masonry blocks
  both know it); `priority` only on tiles that are above the fold on the home
  page — never on the gallery page's full grid.
- Blur placeholder is optional; only if Cloudflare's smallest variant is cheap
  enough to inline. Do not add a per-image blur-hash pipeline for this.
- The same loader must be used in the editor canvas and in the preview, or the
  three surfaces stop rendering the same bytes (parity).

**Constraints:**
- Masonry lanes are column-partitioned (`column1..column4` slots) — virtualizing
  per lane, not per flat list.
- The public gallery is an SEO surface. Virtualized images must still be
  crawlable — `next/image` satisfies that; a JS-only windowed list that mounts
  nothing until scroll does not. Coordinate with `feat/portfolio-seo-discovery`.
- Editor canvas parity: a virtualized gallery must still look right in the
  canvas, where it is not scrolled the same way.

**Measure:** see item 11 — Lighthouse LCP/CLS on the seeded home and gallery
pages, plus DOM node count on the gallery page, before and after.

---

## 4. `ContainerAnchor` — kept, predicate fixed, leaner (was: remove — BLOCKED)

**Resolved 2026-09-25.** The anchor stays. What changed and why is at the end of
this section; the original analysis is kept above it because it is still the
reason the mechanism exists.

The actual prize of the upgrade, and still not available.

`ContainerAnchor` is an invisible editor-only spacer reconciled into the data
tree so a block can be dropped *beside* a nested `Container`/`Columns` instead of
landing inside it. It spans `containerAnchorPredicate.ts`,
`containerAnchorReconciler.ts`, `EditorContainerAnchor.tsx`, the `ContainerAnchor`
registration in `manualBlocks.tsx`, three CSS overlay-suppression rules, and its
own e2e spec. 0.23's insertion-line drag-and-drop was supposed to make all of it
redundant.

**Status: it does not, yet.** Anchor emission was disabled behind a flag during
the upgrade and reverted. Manual testing against 0.23's insertion lines found
drag-and-drop **still buggy without the anchor**. The mechanism stays, in full.

Automation cannot currently answer this either: synthetic Playwright drags no-op
against `@dnd-kit` 0.4's rewritten sensors, so the drag recipe in the
`portfolio-testing` skill needs re-validating against the new engine before any
of this can be tested rather than eyeballed.

**Prerequisite before this item is even scopeable:** characterise *how* it is
buggy — which drop targets, which nesting depth, whether `dnd.behavior` set to
`"fluid"` or `"static"` changes it. Until that exists, this is not a task.

### Decision 2026-09-25 — keep it, fix the predicate, host it on presets

**Characterisation (owner, manual, 0.23 insertion lines, anchor emission off):**
dropping a block "beside" a nested container lands it *inside* the nested
container, not in the parent, at every nesting depth tried. The outline panel
and the block-actions toolbar give a workable keyboard/menu path, but they do
not replace a direct drop. With the anchor on, the drop works. So the anchor is
not redundant; the question becomes why it sometimes disappears.

**The bug that actually bit:** `isContainerClass` only knew `Container` and
`Columns`. A parent Container holding `[Container, Container, HeroPreset]` lost
its anchor the moment the preset arrived, because every section preset has its
own type (`HeroSplitPreset`, …) even though it renders through `ContainerBlock`.
With the anchor gone, the parent became the un-droppable case above.

**What landed:**
- Container-class children = `Container | Columns | every preset with
  componentType "Container"` (`CONTAINER_PRESET_KEYS`, exported from
  `sectionPresets.ts`). Nav presets are not container-class.
- Anchor hosts = `Container` + container presets (`isAnchorHost`). The live
  reconciler walks preset nodes and every preset editor config now carries the
  same `resolveData` as the manual Container, so the two writers agree. Every
  non-nav preset wraps its content in one page-fit Container child, so every
  preset now carries a bridge anchor — the drop-beside-the-nested-container
  case is exactly the one the owner wanted.
- Columns stays child-class only. It has one grid slot, not per-column slots;
  the owner's verdict was that Columns drops fine as-is. A per-column anchor
  would need a per-column-slot migration and is not planned.
- Mixed children (any ordinary block) → no anchor. Unchanged, for the churn
  reasons in the predicate header.
- Leaner: the dead `height` prop is gone from the anchor's type, defaults,
  fields, reconciler literal and the five template files; item 6's
  `componentOverlay` override replaced the three hashed-class CSS rules.

**Still manual:** drag verification. Synthetic Playwright drags no-op against
`@dnd-kit` 0.4, so Run 2 only asserts anchor presence inside a preset's slot
and the absence of hover/selection chrome on it. Re-validating the drag recipe
in the `portfolio-testing` skill is a follow-up for the next session.

---

## 5. Slot `as` — semantic elements on the public page

Small, and the only item whose value lands outside the editor.

Puck slots render their wrapper as a `div`. 0.23 adds `as?: ElementType` to
`DropZoneProps`, and a slot is called as
`SlotComponent = (props?: Omit<DropZoneProps, "zone">)`, so a call site becomes:

```tsx
{content({ as: "section", className, style })}
```

Today the public page carries wrapper `div`s where `<section>`, `<header>`,
`<main>` and `<nav>` belong — e.g. `ContainerBlock` renders a real `<section>`
and then Puck adds a non-semantic `div` inside it. That is a flat document
outline for a page whose whole job is to be read by search engines and screen
readers.

**Work:** audit every slot call site, pass `as` where a semantic element is
correct, leave it where a `div` genuinely is the right box.

**Ties into:** `06-accessibility.md` and the SEO branches. Cheap to do, easy to
verify (assert the tag name in the existing public-page tests), no behaviour
change.

**Audited 2026-09-25 — no `as` warranted.** The premise above was half right:
`ContainerBlock` does render a real `<section>` with a `div` slot inside it, but
that pattern holds for every slot, and in each case the semantic element is
already the block's own root, so the slot `div` is a layout box, not a missing
landmark. Adding `as="section"` to any of them would nest a section inside a
section.

| slot | block root (already semantic) | slot element | verdict |
|---|---|---|---|
| `PageBody.content` (`PageBodyBlock.tsx:157`) | `<main data-block="page-body">` | `div`, block-flow, padded | keep — the `<main>` is the landmark; the slot is the gutter box |
| `Container.content` (`manualBlocks.tsx:1407`) | `<section data-block="container">` | `div`, flex column/row | keep — a `<section>` inside a `<section>` adds an outline level with no heading |
| `Columns.content` (`manualBlocks.tsx:1014`) | `<div data-block="columns">` | `div`, CSS grid | keep — a column grid is layout, not a document section; the children carry their own semantics |
| `Navigation.content` (`NavigationBlock.tsx`) | `<div data-block="navigation">` wrapping a `<nav aria-label>` | `div` (brand heading slot) | keep — the landmark is the inner `<nav>`; the slot holds the brand mark |
| `GalleryGrid.content` / `GalleryMasonry.content` + `column1..4` | `<section data-block="gallery-*">` | `div` grid / lanes | keep — tiles are figures, not list items; the gallery `<section>` is the landmark |

Every preset renders through `ContainerBlock`, so the preset rows collapse into
the Container row. The document outline on the public page is therefore
`main > section*` with `nav` and `footer` from their blocks — flat where the
content is flat, which is correct, not a defect. Item closed; item 12's
close-out stands.

---

## 6. `componentOverlay` override — insurance only

`editor.css:251-341` reaches Puck's hashed CSS-module class names by substring
(`[class*="DraggableComponent-overlay"]` and two siblings) to suppress hover and
selection chrome on anchor spacers. 0.23 adds a supported `componentOverlay`
override that hands you the overlay to render.

**This buys nothing today** — the spike verified in the live DOM that all six
selectors still match on 0.23. It buys not silently breaking on 0.24, since these
selectors fail without erroring: the editor just looks wrong.

Lowest priority here. Worth doing opportunistically while touching that CSS for
another reason.

**Closed 2026-09-25** inside item 4's commit: `EditorShell` passes
`overrides.componentOverlay`, which returns `null` for any `componentId` ending
in `--anchor` and the default `children` otherwise. The three
`[class*="DraggableComponent-*"]` rules and their comment block are deleted
from `editor.css`. Puck's overlay node is purely visual (outline/background,
`cursor: pointer`; the actions overlay is `pointer-events: none`), so removing
it does not touch drop detection.

---

## 7. Portfolio e2e triage — the one item here that IS maintenance

Everything above is an unlock. This one is not: it is the portfolio e2e set,
which the upgrade left red. **CI does not run Playwright** (`ci.yml` is
typecheck / lint / test / build), so none of this gated the upgrade PR — but it
is real and it is unfinished.

Measured after the dev DB was re-seeded on the footer-normalizer fix, over the
10 candidate spec files (the 9 known-dead ones excluded): **13 failed, 6 passed**
in 10.7 minutes. The re-seed alone cleared `batch1-flow`, both
`portfolio-responsive` canvas/overflow cases and `preset-canvas-parity:114` —
those had been failing on corrupted fixture data, not on the upgrade.

### Already answered — DELETED, do not re-investigate

**9 specs were dead on `dev` and were dead before this branch.** They waited on
`[class*="_ComponentList_"]`, which our `drawer` override makes unreachable: the
override drops `children`, so Puck's `ComponentList` never renders. `Components`
is byte-identical in 0.20 and 0.23 and the override is untouched here, so this
was never upgrade fallout.

They have been **deleted** in this branch rather than left red:

- `preset-library.spec.ts` — whole file removed. All 5 tests were built on
  `CATEGORY_ROOT` / `CATEGORY_TITLE`; there was nothing salvageable in it.
- `editor-reliability-batch.spec.ts` — 5 of 8 tests removed, **file kept**. The
  remaining 3 pass and cover real ground: the brand background actually painting,
  app-shell scrollbars, and the e2e fixture contract.

The fifth was "the drawer does not overflow once rows carry a preview control",
which **passed**. It was removed anyway because it passed vacuously: it queried
the same unreachable `_ComponentList_` selector, and both its assertions hold on
an empty result (`toEqual([])` over a filtered empty list, and
`toBeGreaterThanOrEqual(0)`). A green test that proves nothing is worse than a
red one — it reports coverage that does not exist.

The cut orphaned `CATEGORY_TITLE`, `CATEGORY_ROOT`, `ITEM_NAME`, `SHELL`, and the
`hoverRow` and `openEditor` helpers, all removed with it.

> **What the drawer lost, and what still covers it.** The preset drawer is *not*
> uncovered. `portfolio-maker-demo-editor.spec.ts` exercises it and passes (15/15
> verified): its `hoverPreset()` helper expands a category via `aria-expanded`,
> finds the preset row, hovers it and asserts the preview panel's image,
> background and cinema placeholders. It is already written the right way — its
> own comment notes that "Puck's CSS-module class names are implementation
> details" and targets **our** `PresetBlocksDrawer` buttons instead.
>
> What the deletion did give up is the drawer's **structural inventory**, which
> only `preset-library.spec.ts` asserted:
>
> - 11 groups, three variants each
> - only Hero expanded on arrival
> - no horizontal overflow at 768 and 1280
> - Arabic chrome mirrors the drawer without breaking it
>
> That behaviour still ships and is now unit-tested only. If it gets re-covered,
> extend the demo-editor spec's approach — role and `aria-expanded` against our
> own markup — and never reach for `_ComponentList_`, which our `drawer` override
> means we will never render.

> **The lesson worth keeping.** A test failing against an unreachable selector is
> loud; a test *passing* against one is silent. `[class*="_ComponentList_"]`
> produced both here — 9 red and 1 green — and the green one survived the first
> pass precisely because the failure list was the only thing being read. When a
> selector is proven unreachable, audit everything that touches it, not just the
> things that went red.

### The dominant live cause — one mechanism, five specs

0.23 **mounts inactive plugin panels rather than unmounting them**:
`_PuckPluginTab_` is `display: none`, so the blocks and fields panels each exist
twice with one visible copy. Every one of these is a selector that now matches
the hidden copy too. The fix is to scope to visible nodes — **not** to delete
the spec, and **not** to change app code:

| spec | symptom |
|---|---|
| `block-floated-parity.spec.ts:38` | `getByLabel('Instagram username')` resolves to 2 |
| `block-floated-parity.spec.ts:128` | `getByRole('button', { name: 'Gallery' })` resolves to 3 |
| `portfolio-page-body-batch.spec.ts:32` | `[data-puck-dropzone$=":content"]` expected 1, got 6 |
| `portfolio-responsive.spec.ts:47` | `canvas-controls-trigger` resolves to 2 buttons |
| `preset-canvas-parity.spec.ts:263` | `getByRole('button', { name: 'Gallery' })` resolves to 3 |

### Likely the same cause, but UNPROVEN — check before assuming

These time out rather than reporting a strict-mode violation. Clicking a
`display: none` copy times out exactly this way, and `portfolio-responsive:47`
above demonstrates the resolver picking a hidden twin — so the hypothesis is
reasonable. It has **not** been confirmed for any of the five. Verify each
against the DOM before treating it as solved.

- `block-floated-parity.spec.ts:250` — `waitFor` 15s
- `item4-defaults-prefill.spec.ts:45` and `:51` — click timeout 90s
- `portfolio-rtl-scoping.spec.ts:25` — click timeout 60s, popup shell
- `preset-canvas-parity.spec.ts:182` — `waitFor` 30s

### Genuinely undiagnosed — start here, 3 specs

Nothing explains these yet. Do not fold them into the group above.

- `portfolio-nav-order.spec.ts:17` — the reorder control is not found at all
  (`element(s) not found`), not a duplicate-match problem.
- `portfolio-page-body-child-height.spec.ts:16` — geometry: width 461 against an
  expected `<= 414`. A real layout delta or a stale constant; unknown which.
- `portfolio-preview-footer-gap.spec.ts:15` — `Cannot read properties of
  undefined (reading 'getBoundingClientRect')`. The spec dereferences an element
  it never found, so it is a spec bug masking whatever the real state is; fix the
  dereference first, then re-read the actual failure.

### Run 1, 2026-09-25 — what the fresh seed + 0.23 install actually shows

Run against a re-seeded dev DB with `@puckeditor/core` 0.23.0 genuinely
installed (the previous measurement was taken with a stale `node_modules`
still holding `@measured/puck` 0.20.2 — see the session log at the end). The
run was killed by the host's low-memory reaper after 12 of 19 tests, so the
last 7 (`portfolio-responsive` ×2, `portfolio-rtl-scoping`,
`preset-canvas-parity` ×2, `puck023-chrome`, the rest of
`anchor-snapshot-loop`) have no fresh evidence yet. Traces exist for the 12.

| spec | Run 1 | verdict |
|---|---|---|
| `block-floated-parity.spec.ts:38` | `getByLabel('Instagram username')` → 2 | hidden-panel duplicate, **confirmed** |
| `block-floated-parity.spec.ts:128` | `getByRole('button', { name: 'Gallery' })` → 3 | hidden-panel duplicate, **confirmed** |
| `block-floated-parity.spec.ts:250` | `waitFor` 15 s on `[class*="_ComponentList_"]` … `_ComponentList-title_` /^Footer$/ | **not** the hidden-panel cause — it is the unreachable selector this doc already purged from nine other specs. Same fix as those: target our `PresetBlocksDrawer` buttons by role. |
| `item4-defaults-prefill.spec.ts:45` / `:51` | 90 s timeout, both | still unproven; read the traces before assuming |
| `portfolio-nav-order.spec.ts:17` | `getByRole('button', { name: 'Move Contact up' })` not visible | reproduced as described; undiagnosed |
| `portfolio-page-body-batch.spec.ts:32` | `[data-puck-dropzone$=":content"]` count ≠ 1 | hidden-panel duplicate, **confirmed** |
| `portfolio-page-body-child-height.spec.ts:16` | 461 > 414 | reproduced; real delta vs stale constant still open |
| `portfolio-preview-footer-gap.spec.ts:15` | `getBoundingClientRect` of `undefined` | reproduced; spec bug first |
| `anchor-snapshot-loop.spec.ts:7` | 60 s timeout; the page snapshot shows the app shell, not the editor | ran **first** after a cold dev server, so it ate `/portfolio`'s first Turbopack compile. Not loop evidence. Warm `/portfolio` before this spec. |
| `block-floated-parity.spec.ts:90` | passed | — |

**Run-order rule learned:** warm `/portfolio` and `/portfolio-preview` with a
plain GET before the first editor spec, or the first spec's timeout measures
Turbopack, not the app.

### Static fixes 2026-09-25 (from the Run 1 traces; no app code touched)

Fixed, awaiting Run 2:

- `block-floated-parity.spec.ts:38` — `getByLabel('Instagram username')`
  scoped with `.and(page.locator(":visible"))`.
- `block-floated-parity.spec.ts:128` and `preset-canvas-parity.spec.ts:268`
  (the real line; `:182`/`:263` above had drifted) — the three "Gallery"
  buttons are the zone-switcher button, a hidden dnd-kit handle and the canvas
  nav link; scoped through `getByTestId("portfolio-toolbar-grid")`.
- `block-floated-parity.spec.ts` (`:250` test, dead selector at `:210`) —
  `expandDrawerGroup` / `dragDrawerItemToCanvas` rewritten to role/name +
  `aria-expanded` against our `PresetBlocksDrawer`, mirroring `hoverPreset()`.
- `portfolio-page-body-batch.spec.ts:41` — **the table above was wrong about
  the cause.** Count was 6 every retry, not a hidden twin: the descendant
  selector `[data-puck-dropzone$=":content"]` also matched every nested
  Container's own content slot. Fixed to `:scope > …` (the direct-child form
  `portfolio-page-body-child-height.spec.ts` already used).
- `portfolio-preview-footer-gap.spec.ts` — the dereference now throws a
  message naming the child count, so the next run reports the real state.
- `portfolio-rtl-scoping.spec.ts`, `portfolio-responsive.spec.ts` — already
  carried `:visible` scoping; nothing to do.

Diagnosed, deliberately not "fixed" in the spec:

- `item4-defaults-prefill.spec.ts:45` / `:51` — the trace shows the "Welcome
  back" dialog still open with a `navigated to /portfolio` entry inside the
  click wait: a full page reload mid-test. Cause: this session edited the
  message catalogs while Run 1 was in flight and Turbopack HMR reloaded the
  editor. Not a selector bug. Rule: **no worktree edits while a browser run is
  up** (see the session log for the RAM constraint that forces the same
  sequencing).
- `portfolio-nav-order.spec.ts:17` — `Move Contact up` is **absent from the
  app**, not hidden. The only reorder controls in the codebase are the
  whole-block `moveUp`/`moveDown` toolbar actions; no per-item nav reorder
  control exists. The spec describes a feature that is not there. Product
  decision needed: restore/implement per-item nav reordering, or delete the
  spec. Not an e2e fix.
- `portfolio-page-body-child-height.spec.ts:92` — the 414 is computed live
  (`geometry.slotContentWidth + 1`), so it is not a stale constant: a dropped
  section really does overflow its page-body slot by 47 px. App-code
  investigation for the next session.
- `puck023-chrome.spec.ts` — trap 2 below stands as a *reading* rule, but the
  write order is deliberate and commented: several assertions run before the
  write, and the artifact exists to preserve diagnostics when the later ones
  fail. Do not move the write; do not read the artifact as a verdict.

### Two traps, both already paid for once

1. **A spec that drifted off its selector fails identically to a real
   regression.** "It fails on `dev` too" must be proven from the code, not
   inferred from the message.
2. **`puck023-chrome.spec.ts` writes its JSON artifact before its assertions
   run.** A failing run leaves a complete-looking artifact; one was misread as
   proof the rail was gone when it was not. Artifacts record observations, never
   verdicts.

---

## 14. Editor panel sections open and close instantly

Added 2026-09-25 from the owner's review: every collapsible section in the
editor's left panel (Presets header, each preset group, Manual blocks) and
right panel (every Content/Design/Layout section, the collections-popup
dialog) snaps between closed and open. It reads as unfinished.

**Surfaces:** editor only.

**What the "dropdowns" are.** Two components of ours, not Puck chrome:
`components/ui/collapsible-drawer.tsx` (`CollapsibleDrawer`, left panel; also
`PublishDialog` and the booking-session stacks) and
`lib/page-builder/EditorDrawerSection.tsx` (`EditorDrawerSection` +
`EditorDrawerGroup`, right panel, open state persisted per block in
`drawerOpenStore.ts`). Both render the body with `{open && …}`, so there is
nothing to transition. Puck's own expanders (outline tree nodes, array-field
items) are not in scope; if wanted they are a separate item against Puck's
hashed classes.

**Mechanism: Base UI `Collapsible`** (`@base-ui/react`, the shadcn-v4
foundation the rest of `components/ui` already stands on) — not `motion`. It
animates height through `--collapsible-panel-height` with
`data-starting-style`/`data-ending-style`, keeps the panel **unmounted while
closed** (so the right panel's sections don't stay mounted through Puck's
per-keystroke field re-renders, and "content absent when closed" tests keep
their meaning), and keeps `aria-expanded` on the trigger so every existing e2e
selector survives. 200 ms, default easing, `motion-reduce:transition-none`,
per DESIGN.md §Motion. A shared `components/ui/collapsible.tsx` wrapper is
registered in `REUSABLE_CODE.md`; both components consume it.

**Test gotcha:** happy-dom 20.9 implements `getAnimations` on `ShadowRoot`
only, and Base UI waits on `element.getAnimations()` before unmounting a
closed panel — a test that asserts the body disappears may need a per-file
stub.

**Done when:** opening and closing a left-panel group and a right-panel
section visibly animates at 1280 in the batched browser run, `aria-expanded`
still drives the existing specs, and reduced-motion disables it.

---

# Perf-audit coverage — portfolio module

Each `docs/perf-audit/0X` file stays app-wide and keeps its score. The items
below are the portfolio module's slice of each — the fix direction applied to
the three surfaces named at the top of this doc, with a measurement contract
per item. Audits `03` (code splitting) and `05` (virtualization) are already
items 2 and 3 above; items 11 and 13 add their measurement contracts rather than
restating the work. Audit `07` is the source of items 1–6 and is closed.

---

## 8. Audit 01 — server state: react-query for the editor's fetches

**Surfaces:** editor only. The published page is server-rendered from the DB
and the preview renders from localStorage; neither has client fetches worth
caching.

**Decided 2026-09-25: adopt `@tanstack/react-query`** (new dependency — the
repo currently has `@tanstack/react-table` only). One `QueryClientProvider`
mounted at the editor boundary — `EditorShell` or a client wrapper in
`portfolio/page.tsx` — **not** app-wide. The list pages elsewhere in the app
are Server-Component-first and the audit says to leave them alone.

**Work, in this order:**
1. `lib/page-builder/galleryPicker/usePickerData.ts` — three `useEffect` +
   `fetch` + `useState` sites against `/api/portfolio/gallery` (`:34`, `:76`,
   `:114`). Move to `useQuery`, and delete
   `GalleryPickerCacheContext.tsx`'s hand-rolled `useRef<Map<string,
   CachedPage[]>>` once react-query owns that cache — it is the closest thing to
   a query cache in the repo and it becomes dead code.
2. `MediaPicker.tsx` — `fetchFeed` (cursor-paginated, `useCallback` at `:229`)
   → `useInfiniteQuery`.
3. The one-off dialog fetches: `LayoutPicker.tsx`, `CollectionPopup.tsx`,
   `EditCollectionDialog.tsx`, `ImageMetaWizard.tsx`, `ImageBlockMetaSection.tsx`,
   `StyleToolkitField.tsx`. Lower value; do them because they otherwise keep
   the `useEffect`+`fetch` pattern alive next to the migrated code.

**Constraints:**
- Every query key includes `workspaceId`. A workspace switch must never serve
  another tenant's cached collections.
- Gallery mutations (upload, delete, collection edit) invalidate the relevant
  keys instead of calling `router.refresh()`, which re-runs the whole Server
  Component subtree.
- `ContactForm.tsx` and `PageViewBeacon.tsx` on the public page are single-shot
  POSTs — explicitly out of scope, they are not "server state".

**Measure:** network-panel request count for a fixed script — open a block's
gallery picker, switch collection, switch back, open a second block's picker —
before and after. Expected: duplicate `/api/portfolio/gallery` requests for an
already-seen collection go to zero. Record in the baseline table (item 13).

---

## 9. Audit 02 — error handling

**Surfaces:** all three.

### Boundaries

- `app/[locale]/(app)/portfolio/error.tsx` — missing; a Puck crash falls back to
  the generic `(app)/error.tsx`. The local draft already survives a crash (it
  lives in localStorage, see the `portfolio-drafts` skill), so the boundary's
  job is to **say so** and offer reload plus a route back into the Drafts
  dialog — not to invent a recovery mechanism.
- `app/(public)/w/[orgSlug]/error.tsx` — missing; only `not-found.tsx` exists
  at that level, the shared `(public)/error.tsx` catches everything else. Must
  render inside the brand shell and stay index-safe.
- `app/[locale]/portfolio-preview/error.tsx` — missing, not named in the audit,
  same class of gap. Chrome-less, since it renders inside the editor's iframe.
  `portfolio-preview/loading.tsx` is also missing — optional, note it, do not
  block on it.

### Server Actions — typed-result `try/catch`

Sweep on 2026-09-25, line numbers as of that date:

- `app/[locale]/(app)/portfolio/_actions.ts` — 13 exported actions, 4 covered.
  Uncaught: `savePortfolioDraftAction:60-69`, `publishPortfolioAction:84-104`,
  `updateBrandKitAction:124-128`, `updateContactConfigAction:147-151`,
  `updateCollectionsPopupConfigAction:169-173`, `switchTemplateAction:196`,
  `dismissPortfolioGuideAction:213-217`, `completeStoryPromptAction:263-322`,
  `updateFormLocaleAction:379-383`, `saveThemeAction:423-447`,
  `updateThemeAction:480-508`, `deleteThemeAction:561-565`.
- `app/[locale]/(app)/portfolio/_draftActions.ts` — 9 exported, 7 covered.
  Uncaught: `refreshCollectionReferencesAction:86-88`,
  `deleteDraftAction:206-216`, `listDraftsAction:224-228`,
  `getDraftAction:243-244`, `seedTemplateAction:295`,
  `publishDraftAction:325-418`.

Convention to match: `try { … } catch { return { error: "…" } }` as in
`settings/_actions.ts` and `inquiries/_actions.ts`. The client already toasts
the `error` field through `sonner`.

### Route Handlers the editor depends on

Pattern to match: `app/api/webhooks/lemonsqueezy/route.ts:48-155` — try/catch
around each phase, logged before returning a typed status.

- `app/api/images/direct-upload/route.ts:28` — the Cloudflare
  `requestDirectUpload` call has no try/catch (audit-named). Every editor upload
  goes through here.
- `app/api/portfolio/gallery/route.ts:25-28` GET — no try/catch at all.
- `app/api/portfolio/gallery/items/route.ts:54-115` POST — no try/catch at all.
- `app/api/portfolio/gallery/collections/route.ts:72-112` POST — has a
  try/catch, but `verifyImageOwnership`, `validatePhotoMeta`, `connectDB`,
  `Workspace.findOne` and `GalleryCollection.create` all run before it opens.
- `app/api/portfolio/gallery/items/[id]/route.ts:54-55` PATCH — the initial
  read sits outside the try; the existing try only covers propagation cleanup.

### Explicitly NOT gaps — do not re-audit

- The awaited DB reads in the public `page.tsx`, `gallery/page.tsx` and
  `layout.tsx` sit outside any try/catch. They are Server Components; the
  boundary above is the correct mechanism, not try/catch. They must keep
  calling `notFound()` on a missing slug.
- `PageViewBeacon.tsx:33` swallows with a silent `.catch()`. Intentional — it is
  a fire-and-forget beacon, and surfacing a failure to a visitor is wrong.
- `ContactForm.tsx:327-346`, `usePickerData.ts:82-104` and
  `CollectionPopup.tsx:228-298` already catch and surface errors.
- `PreviewClient.tsx` makes no network calls; it reads localStorage.

**Measure:** not a perf number. Unit tests assert each listed action returns
`{ error }` when the underlying Mongoose call throws, and each listed handler
returns a typed 4xx/5xx with a log line. One Playwright case per boundary
forces a throw and asserts the boundary copy renders — folded into the batched
run, not a run of its own.

**Landed 2026-09-25.**

- Boundaries: all three exist, each with an RTL test (copy renders, `reset`
  fires, prefixed `console.error`). The portfolio boundary says the local
  draft is safe and offers retry + reload; the preview boundary is chrome-less.
  The public boundary is **hardcoded English**: neither `app/(public)/layout.tsx`
  nor `w/[orgSlug]/layout.tsx` mounts an intl provider (public components take
  copy as props by design), so a client `error.tsx` there has no translator —
  same trade-off `app/(public)/error.tsx` already makes. Log prefix
  `[public-workspace-error-boundary]`, distinct from the layout-level one.
- **Index-safety caveat, not fixable from `error.tsx`:** `page.tsx`'s
  `generateMetadata` resolves before the render that can throw, so a crashed
  public page ships whatever robots value the metadata computed (indexable for
  a normal published page) with the boundary's body. `error.tsx` cannot export
  metadata. Leaving it: a boundary render is transient, and forcing `noindex`
  would mean moving the decision into `generateMetadata` on speculation.
- Actions: 11 in `_actions.ts` and 5 in `_draftActions.ts` wrapped with the
  `<action>_failed` key convention and a `[portfolio-actions]` /
  `[portfolio-draft-actions]` log prefix; `listDraftsAction` returns `[]` on
  failure because its result type has no error channel (kept; flagged).
  `publishDraftAction` was the surprise: its only `try`s guarded the optional
  superseded-asset cleanup, and the whole connect→normalise→reconcile→update
  section was uncaught. Now `publish_draft_failed`. 17 new unit tests.
- Handlers: `direct-upload` → 502 `upload_unavailable`; gallery GET → 500
  `gallery_unavailable`; items POST → 500 `gallery_item_failed`; collections
  POST and items PATCH had their pre-`try` reads folded into one outer try
  (tests force a throw from a call that used to sit outside). One new test
  file for items PATCH, which had none.
- Playwright: no boundary case. No external way to force a throw was found
  that does not add a test hook to prod code, which the plan ruled out. The
  boundaries are covered by their unit tests only.

---

## 10. Audit 04 — memoization: `memo()` the block renderers

**Surfaces:** editor canvas is the one that hurts — Puck re-renders the whole
tree on every drag and every field edit. The published page and preview get
the same wrapping for free through the shared config.

**Work:**
- Wrap the nine top-level `*Block` renderers in
  `lib/page-builder/blocks/manualBlocks.tsx` and the block components in
  `blocks/*.tsx` that `config.ts` imports — `GalleryGridBlock`,
  `GalleryMasonryBlock`, `FeaturedWorkBlock`, `CollectionCardBlock`, `VideoBlock`,
  `ContactDetailsBlock`, `MasonryCloneBlock` — in `memo()`. The repo currently has
  **zero** `memo()` usage anywhere; this is the first.
- Check `editorConfig.tsx` field `render` functions and `StyleToolkitField` for
  per-render object or array literals passed as props — those defeat `memo()`
  silently. The audit reports `editorConfig.tsx` has no memoization at all;
  verify what it passes rather than trusting that.

**Constraint — record the answer before wrapping anything:** Puck passes a
`puck` prop to every renderer, and it may be a fresh object per render. If it
is, plain `memo()` never hits and the item is a no-op. Check what 0.23 actually
passes; either compare on props minus `puck` with a custom comparator, or
confirm `puck` is referentially stable. Write the finding into this item.

**Measure:** React Profiler — commit count and render count of one block that is
**not** being edited, during a fixed script (edit one Heading's text ten times,
then drag one other block once), before and after. Record in the baseline
table.

---

## 11. Audit 05 — images and virtualization: measurement contract

The work is item 3, including the `next/image` + Cloudflare loader decision.
This item only pins how it is measured, because "gallery is faster" is
unfalsifiable otherwise.

**Surfaces:** published page (`/w/[orgSlug]` and `/w/[orgSlug]/gallery`) for
the seeded owner.

**Measure:**
- Lighthouse LCP, CLS and TBT on both pages, at 375 (mobile throttling) and
  1280, before and after. Three runs each, take the median.
- DOM node count on the gallery page before and after — the direct evidence
  that virtualization mounted less.
- Preview and canvas are not measured; they are held to parity by
  `blockSweep.test.tsx`, not by Lighthouse.

---

## 12. Audit 06 — accessibility: closed for this module

`06-accessibility.md`'s single gap is the app-shell `Sidebar` root in
`components/ui/sidebar.tsx` lacking a navigation landmark. That is the
dashboard shell, not the portfolio module — it belongs to whichever module
takes the app shell.

The portfolio slice of this audit is **item 5 (slot `as`)** — semantic
elements on the public page. Everything else the audit sampled inside this
module already passes: the contact form is fully labeled, `BlockActionsToolbar`
gives every drag a keyboard path, RTL is scoped correctly, `focus-visible` is
paired with every `outline-none`. Nothing further to do here; do not re-audit.

---

## 13. Measurement harness — prerequisite for 2a, 2b, 3, 8, 10, 11

Nothing above is "done" until a number moved, so the harness lands **first** and
the baseline is captured **before** any of 2a, 3, 8 or 10 changes a byte.

**Work:**
- ~~`@next/bundle-analyzer` behind `ANALYZE=1`~~ — **wrong tool, corrected
  2026-09-25.** That plugin is webpack-only and this app builds with Turbopack.
  Next 16.2 ships `next experimental-analyze` (Turbopack-native; "does not
  produce an application build"), wired as `pnpm analyze`. **Open check
  answered:** `pnpm analyze -- -o` completes on the dev box in ~80 s with no
  TypeScript worker involved, so there is no crash to route around and no need
  for CI. Output lands in `.next/diagnostics/analyze/data/<route>/analyze.data`
  as length-prefixed records; the interactive UI (`pnpm analyze`, port 4000)
  shows the same graph. `node scripts/perf/analyze-summary.mjs "<route>"`
  prints a route's client-JS total from those files — the number in the
  baseline table is *every client chunk reachable from the route's chunk
  graph, gzip*, lazy chunks included, so it is a route ceiling rather than a
  first-paint figure. Compare before/after under that same definition. (The
  script exists because the data file is binary-framed; the interactive UI is
  the manual alternative but gives no copyable per-route total.)
- `optimizePackageImports: ["@puckeditor/core"]` — **measured 2026-09-25, not
  kept.** Turbopack already analyses barrel imports; the delta was 0.8 KB gzip
  on 1446 KB for `/portfolio` and 0.7 KB on the public routes. Noise. The
  config line was reverted; row 13 below records it.
- The analyzer is per-route and data-independent: `/w/[orgSlug]` and
  `/w/[orgSlug]/gallery` report identical totals whichever portfolio is
  published. Item 2b's "two portfolios download different JS" therefore cannot
  be read from the analyzer; its A/B rows are measured at runtime (Playwright:
  sum of transferred `.js` bytes on first load of each published portfolio) and
  the analyzer row is the shared ceiling.
- **Lighthouse recipe (used for the baseline; dev-mode numbers).** The box
  cannot `next build` (TS-worker crash), so `pnpm start:prod` is unavailable
  and Lighthouse runs against `pnpm dev` (Turbopack dev, unminified, no
  prod caching). The numbers are only comparable with each other under the same
  conditions — never against a production deployment or a Lighthouse score
  from CI.
  1. `pnpm dev`, then warm both pages once with a plain GET (first compile
     takes ~50 s and would otherwise land inside run #1).
  2. For each page and form factor, three times:
     `npx -y lighthouse <url> --output=json --output-path=<file> --only-categories=performance --quiet --chrome-flags=--headless=new`
     adding `--preset=desktop` for the 1280 column. Mobile is Lighthouse's
     default 375-wide emulation with its default CPU/network throttling.
  3. Read `audits["largest-contentful-paint"|"cumulative-layout-shift"|"total-blocking-time"].numericValue`
     and `audits["dom-size-insight"].numericValue` (Lighthouse 13 moved DOM
     size to the "insight" audit; the old `dom-size` key is absent). Take the
     median of the three.
  Lighthouse 13.5 warns that this CPU is slower than its calibration
  assumes; it is the same box every time, so the warning is noted, not fixed.
- **Item 8 network recipe.** Open `/portfolio`, load the e2e fixture draft,
  select a Gallery block → open its gallery picker → switch to a second
  collection → switch back to the first → select a second Gallery block → open
  its picker. Count requests whose URL starts with `/api/portfolio/gallery`.
  Captured by a Playwright request listener in the batched run; the "before"
  number is the count for that exact script.
- **Item 10 React Profiler recipe** (needs React DevTools in a real browser;
  not automatable here — captured at the start of the next session before item
  10 changes anything). Open `/portfolio` with DevTools → Profiler → "Record why
  each component rendered". Load the e2e fixture draft. Start recording. Edit
  one Heading's text ten times (one character each), then drag one *other*
  block once. Stop. Select a block that was neither edited nor dragged (a
  Text block) and record its commit count and render count from the
  right-hand panel.

**Where numbers live:** in this doc, in the "Baseline" appendix below — not in a
second doc. The docs-hygiene rule allows one changed doc per PR and this is it.

**Done when:** the baseline table has a "before" column filled for every row
below, committed on this branch, before any perf item starts.

---

## Baseline

Fill "before" first. One row per measurement named above. Empty cells are a
smell, not a placeholder.

| item | metric | page / script | before | after |
|---|---|---|---|---|
| 2a | route client JS (gzip, all reachable chunks), `/portfolio` | `analyze-summary.mjs` | 1446.4 KB / 55 chunks (2026-09-25) | |
| 2a | route client JS (gzip), `/portfolio-preview` | `analyze-summary.mjs` | 880.7 KB / 42 chunks (2026-09-25) | |
| 2b | route client JS (gzip), `/w/[orgSlug]` — shared ceiling | `analyze-summary.mjs` | 821.1 KB / 43 chunks (2026-09-25) | |
| 2b | transferred JS on first load, `/w/<slug>` (portfolio A = seeded editorial) | Playwright network sum | | |
| 2b | transferred JS on first load, `/w/<slug>` (portfolio B = minimal draft, re-published) | Playwright network sum | | |
| 2b | route client JS (gzip), `/w/[orgSlug]/gallery` | `analyze-summary.mjs` | 821.1 KB / 43 chunks (2026-09-25) | |
| 13 | `/portfolio` with `optimizePackageImports: ["@puckeditor/core"]` | `analyze-summary.mjs` | 1445.6 KB (−0.8 KB vs row 2a; reverted) | n/a |
| 8 | duplicate `/api/portfolio/gallery` requests | picker script | | |
| 10 | commits / renders of an unedited block | Profiler script | | |
| 11 | LCP / CLS / TBT, `/w/seed-owner-demo`, mobile | Lighthouse 13.5 vs `pnpm dev`, median of 3 | 2087 ms / 0.001 / 2814 ms (2026-09-25) | |
| 11 | LCP / CLS / TBT, `/w/seed-owner-demo`, desktop | Lighthouse 13.5 vs `pnpm dev`, median of 3 | 773 ms / 0.000 / 348 ms (2026-09-25) | |
| 11 | LCP / CLS / TBT, `/w/seed-owner-demo/gallery`, mobile | Lighthouse 13.5 vs `pnpm dev`, median of 3 | 3471 ms / 0.000 / 2127 ms (2026-09-25) | |
| 11 | LCP / CLS / TBT, `/w/seed-owner-demo/gallery`, desktop | Lighthouse 13.5 vs `pnpm dev`, median of 3 | 903 ms / 0.000 / 133 ms (2026-09-25) | |
| 11 | DOM node count, `/w/seed-owner-demo/gallery` (home for reference) | Lighthouse `dom-size-insight` | 421 (home 477) (2026-09-25) | |

---

## Suggested order

1. **Measurement harness (13)** — first, or nothing after it is falsifiable.
2. **Dictionary (1)** — largest user-visible gap, self-contained.
3. **Slot `as` (5)** + **a11y close-out (12)** — cheap, helps the public
   surfaces, low risk.
4. **Error handling (9)** — independent, mechanical, touches no rendering.
5. **Code splitting 2a** (editor mount) — baseline exists now; split.
6. **Memoization (10)** — answer the `puck`-prop question, then wrap.
7. **Server state (8)** — new dependency, editor-only blast radius.
8. **Images + virtualization (3, measured by 11)** — bigger, needs SEO
   coordination.
9. **Code splitting 2b** (per-block) — hardest, and must not break three-way
   parity.
10. **`componentOverlay` (6)** — whenever that CSS is open anyway.
11. **Anchor removal (4)** — only after someone characterises the DnD bug.

**e2e triage (item 7) is not in that sequence — it runs alongside it.** It blocks
nothing and nothing blocks it, but it is the reason the suite cannot currently
tell you whether any of the above broke something. Do the 5 visibility-scoping
fixes first; they are mechanical and buy back most of the signal.

---

# Session 2026-09-25 — foundation wave (approved plan)

Scope for this branch (`update/portfolio-maker-updates`, one commit per item):
install → **13** harness + baseline → **4** anchor (revised, below) → **1** dictionary →
**14** panel transitions (new, below) → **5** slot `as` → **9** error handling, with **7**
e2e triage alongside. Perf-changing items (2a, 10, 8, 3, 2b) are the next session's
entry point, starting at 2a, against the baseline captured here.

Decisions taken while planning:

- **`node_modules` was stale**: `@measured/puck` 0.20.2 was installed while the
  lockfile pins `@puckeditor/core` 0.23.0. `pnpm install` is step 0.
- **Analyzer tool (item 13) corrected**: the repo builds with Turbopack, so
  `@next/bundle-analyzer` (webpack-only) is the wrong tool. Next 16.2 ships
  `next experimental-analyze`, Turbopack-native and build-free — it also sidesteps
  the TS-worker crash noted in item 13. `optimizePackageImports` is measured as
  its own row but Turbopack already analyses barrel imports; expect ~0.
- **Item 2b fixture**: the seed has one published portfolio. Portfolio A/B are two
  drafts switched and re-published on the seeded workspace (sandbox DB).
- **Baseline row 10** (React Profiler) needs DevTools and is captured at the start
  of the next session, before item 10 starts. Every other "before" cell is filled
  on this branch.
- **Item 4 is no longer blocked** — see its rewritten section once Phase 2 lands.
  Manual test (owner, 2026-09-25): without the anchor, drops land in the nested
  container instead of the parent; the outline and block-actions controls help but
  do not replace it. The anchor stays and gets a correct predicate.
- **Item 14 (new)**: the collapsible sections in the editor's left and right panels
  open/close instantly. They are our own two components (`CollapsibleDrawer`,
  `EditorDrawerSection`); the transition uses Base UI `Collapsible`, the repo's UI
  foundation. Puck-internal expanders (outline tree, array fields) are out of scope.
- **Item 9 boundaries**: no test-only crash hook is added to prod code; boundaries
  are unit-tested, with a Playwright case only where a throw can be forced externally.
- **Playwright budget**: three consolidated runs for the whole session (baseline
  after reseed, post-fix with every item's browser check folded in, one retry).
