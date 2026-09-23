# Puck 0.23 follow-ups — scope for the next branch

The 0.23 upgrade (`action/portfolio-puck-upgrade`) was deliberately kept
behaviour-preserving: it changed the package, fixed the editor theming, replaced
the plugin rail, and proved the blocks and published data survive. Everything
the upgrade *unlocked* was left out of it on purpose. This is that list.

Source: the "What we would gain" section of `docs/perf-audit/07-puck-upgrade.md`,
plus the code-splitting and virtualization audit points (`03`, `05`).

Nothing here is a bug fix. Each item is independently shippable — do not bundle
them into one commit.

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

## Suggested order

1. **Dictionary** — largest user-visible gap, self-contained.
2. **Slot `as`** — cheap, helps the public surfaces, low risk.
3. **Code splitting 2a** (editor mount) — measure, then split.
4. **Virtualization** — bigger, needs SEO coordination.
5. **Code splitting 2b** (per-block) — hardest, and must not break parity.
6. **`componentOverlay`** — whenever that CSS is open anyway.
7. **Anchor removal** — only after someone characterises the DnD bug.
