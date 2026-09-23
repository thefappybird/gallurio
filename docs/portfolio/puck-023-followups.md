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
before/after — otherwise "we improved it" is unfalsifiable.

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

**Constraints that make this non-trivial — read before starting:**
- The editor and the renderer share one config (`lib/page-builder/config.ts` vs
  `editorConfig.tsx`). A split that only applies to the public renderer must not
  fork block behaviour, or it breaks the canvas/preview/publish parity invariant
  that `blockSweep.test.tsx` pins.
- Many blocks are server-rendered already. Splitting those buys nothing and
  costs a suspense boundary.
- Above-the-fold blocks (nav, hero) must **not** be lazy — that trades bundle
  size for LCP, which is the wrong direction on the surface SEO cares about.

**Done when:** two portfolios with different block sets provably download
different JS, and `blockSweep`'s parity assertions still pass.

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

**Constraints:**
- Masonry lanes are column-partitioned (`column1..column4` slots) — virtualizing
  per lane, not per flat list.
- The public gallery is an SEO surface. Virtualized images must still be
  crawlable, which in practice means real `<img>` with `loading="lazy"` and
  correct dimensions rather than a JS-only windowed list. Coordinate with
  `feat/portfolio-seo-discovery`.
- Editor canvas parity: a virtualized gallery must still look right in the
  canvas, where it is not scrolled the same way.

---

## 4. Remove `ContainerAnchor` — BLOCKED, do not start

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

> **What the drawer still needs, and what it lost.** Deleting these gave up the
> only browser coverage of the grouped preset drawer — 11 groups, three variants
> each, collapsed-except-Hero, no horizontal overflow, Arabic chrome. That
> behaviour is still shipping and is now only unit-tested. If it gets re-covered,
> it must be written against **our** `PresetBlocksDrawer` markup, not Puck's
> `ComponentList`, which our override means we will never render.

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

### Two traps, both already paid for once

1. **A spec that drifted off its selector fails identically to a real
   regression.** "It fails on `dev` too" must be proven from the code, not
   inferred from the message.
2. **`puck023-chrome.spec.ts` writes its JSON artifact before its assertions
   run.** A failing run leaves a complete-looking artifact; one was misread as
   proof the rail was gone when it was not. Artifacts record observations, never
   verdicts.

---

## Suggested order

1. **Dictionary** — largest user-visible gap, self-contained.
2. **Slot `as`** — cheap, helps the public surfaces, low risk.
3. **Code splitting 2a** (editor mount) — measure, then split.
4. **Virtualization** — bigger, needs SEO coordination.
5. **Code splitting 2b** (per-block) — hardest, and must not break parity.
6. **`componentOverlay`** — whenever that CSS is open anyway.
7. **Anchor removal** — only after someone characterises the DnD bug.

**e2e triage (item 7) is not in that sequence — it runs alongside it.** It blocks
nothing and nothing blocks it, but it is the reason the suite cannot currently
tell you whether any of the above broke something. Do the 5 visibility-scoping
fixes first; they are mechanical and buy back most of the signal.
