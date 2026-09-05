# Portfolio builder — enhancements wave 2 (spec / pseudo-plan)

Branch: `fix-feat/portfolio-maker-reliability-and-new-presets`
Status: **approved, in progress.** Wave A1 landed (items 2, 6, 7). Wave A2 in
flight (items 3, 8).

Follow-up to a testing session on the current branch. Eleven items: nine editor
behaviours, one asset refresh, one public-copy refresh.

Decisions locked by the user are marked **[decided]**. All open questions are
resolved — see the decisions table at the end.

---

## Item 1 — Full page width for footer, header, and preset containers

**Problem.** The footer looks narrow on wide screens, even in preview mode. The
same complaint applies to the site header and to the container blocks generated
for each section preset.

**Current behaviour (verified).**
- `ColumnsBlock` already has an `overallWidth: "page-fit" | "full"` prop
  (`lib/page-builder/blocks/manualBlocks.tsx:633`). `"full"` does two things:
  breaks the outer wrapper out of any clamp (`width:100vw; margin-left:calc(50% - 50vw)`
  on the public page, `width:100%` in the editor canvas) **and** drops
  `max-width:80rem` from the emitted grid rule (`manualBlocks.tsx:785`).
- The control is rendered in the Layout drawer for Columns only
  (`lib/page-builder/StyleToolkitField.tsx:2567`).
- `ContainerBlock` has no equivalent prop. Its content slot hardcodes
  `maxWidth: "80rem", margin: "0 auto"` (`manualBlocks.tsx:1046`), so container
  content is clamped to 1280px regardless of viewport.
- Footer presets (`lib/page-builder/blocks/presets/footer.ts`) are Containers
  carrying `_chrome: "footer"`. The header is the `Navigation` block carrying
  `_chrome: "nav"`. Both are pinned and mirrored by
  `lib/page-builder/chromeSync.ts`.

**Target [decided].** `"full"` means **band and content both edge-to-edge** —
the outer section breaks out to `100vw` and the inner slot's `max-width:80rem`
is removed. The container's own padding is the only inset.

**Every affected block keeps the toggle** — the difference between surfaces is
only what they *default* to. Users may not want full width in every case, so
nothing is locked.

| Surface | Default | Control |
|---|---|---|
| Footer (`_chrome === "footer"`) | `"full"` | Shown |
| Header / Navigation (`_chrome === "nav"`) | `"full"` | Shown |
| Preset-generated containers | **`"page-fit"`** | Shown |
| Manually inserted Container | `"page-fit"` | Shown |
| Columns | `"page-fit"` (unchanged) | Shown (already exists) |

**[decided] Presets stay page-fit.** Only chrome (footer, header) defaults to
full. A preset's background band already spans the viewport today — the outer
`<section>` is block-level and always has — so presets gain nothing from the
default flip except unreadable line lengths at 2560px. Users who want a preset
edge-to-edge flip the toggle. **This removes the preset-padding work entirely:
no `clamp()` padding pass, no preset data edits.**

**Files.**
- `lib/page-builder/blocks/manualBlocks.tsx` — add `overallWidth` to
  `ContainerBlockProps` / `containerDefaultProps` / `containerBlockConfig.fields`;
  apply the breakout on the `<section>` and drop the slot clamp when `"full"`.
- `lib/page-builder/StyleToolkitField.tsx` — extend the existing "Overall width"
  control from `isColumns` to `isColumns || isFlexContainer`, and show it for
  Navigation too. The control is never hidden; chrome blocks only differ in
  their default.
- `lib/page-builder/blocks/NavigationBlock.tsx` — accept `overallWidth`,
  defaulting to `"full"`.
- `lib/page-builder/chromeSync.ts` / footer preset data — footer containers
  default to `"full"`.
- Preset files (`lib/page-builder/blocks/presets/*.ts`, `sectionPresets.ts`) —
  **no change**, per the decision above.

**Acceptance.**
- Footer and header content spans the viewport width at 1280px and 2560px, in
  both the editor canvas and the public page.
- The "Overall width" control is reachable for footer, header, preset
  containers, manual containers, and Columns, and toggling it back to
  "Page fit" restores the 80rem clamp on each.
- A freshly dropped preset renders full width; a freshly dropped manual
  Container renders page-fit and can be toggled.
- Existing saved drafts are unchanged (absent `overallWidth` still means
  page-fit for manual containers).
- Unit tests: `manualBlocks.test.tsx`, `StyleToolkitField.test.tsx`,
  preset composition tests.

---

## Item 2 — Drawer rows need `cursor: pointer`

**Problem.** The left-panel drawer rows that house preset blocks and manual
blocks show the default arrow cursor, which reads as non-interactive.

**Current behaviour (verified).** The rows are Puck's own `Drawer.Item` chrome,
wrapped by `PresetDrawerItem` / `ManualDrawerItem`
(`app/[locale]/(app)/portfolio/_components/PresetPreviewCard.tsx:188,200`).
Those wrappers attach handlers only and render no element of their own, so the
cursor comes from Puck's stylesheet. `app/[locale]/(app)/portfolio/_components/editor.css`
contains no `cursor` rule at all.

**Target [decided].** `cursor: grab` idle / `grabbing` active on every draggable
drawer row (they are dragged, not clicked), and `cursor: pointer` on the
category accordion headers (those are real click targets), in both the preset drawer and the manual-blocks
drawer.

**Files.** `app/[locale]/(app)/portfolio/_components/editor.css` — one scoped
rule targeting Puck's drawer-item class, alongside the existing editor
overrides. `lib/page-builder/EditorDrawerSection.tsx:53` — the accordion
`<button>` needs `cursor-pointer` added to its className.

**Acceptance.** Hovering any drawer row or accordion header shows the pointer
cursor at all three breakpoints. Playwright asserts the computed `cursor` value
on one preset row and one manual-block row.

---

## Item 3 — "Move out" should move up one level, in place

**Problem.** "Move out" always dumps the block at the bottom of the root canvas,
so a block moved out of a deeply nested container is hard to find again.

**Current behaviour (verified).** `selectedBlockActions`
(`lib/page-builder/moveBlockToRoot.ts:47`) hardcodes
`destinationZone: ROOT_ZONE, destinationIndex: rootContentLength` for any block
whose zone is not root.

**Target.** Move the block to its **parent's** zone, inserted **immediately
after** the block it was nested in.

Mechanics: a Puck slot zone id is `${parentBlockId}:${slotName}`. So from
`sourceZone` we derive `parentBlockId`, then resolve that parent's own zone and
index. Puck's store already exposes what we need — `getItemById` and
`getSelectorForId` are used the same way in
`lib/page-builder/blocks/EditorContainerAnchor.tsx`. When the parent is itself a
root-level block, the destination is the root zone at `parentIndex + 1` — which
is the current behaviour only in the special case where the parent happens to be
last.

**Files.**
- `lib/page-builder/moveBlockToRoot.ts` — `selectedBlockActions` gains a
  resolver argument (parent zone + index lookup) and returns the one-level
  `moveOut` action. Keep the function pure; the lookup is injected.
- `app/[locale]/(app)/portfolio/_components/BlockActionsToolbar.tsx:200` — pass
  the lookup from `usePuckStore`.

**Acceptance.**
- Block in `Container A > Columns B > cell` → one click lands it directly after
  `Columns B` inside `Container A`, still selected, still scrolled into view.
- Repeated clicks walk it out one level at a time until it reaches root.
- The button stays hidden for root-level blocks.
- Unit tests in `moveBlockToRoot.test.ts` cover: nested-in-nested, parent is
  last child, parent is root-level, malformed zone id.

---

## Item 4 — Auto-fit (hug) sizing for Containers and Columns  **[decided]**

**Problem.** Containers and Columns are always full width, which makes building
something small — e.g. a two-button row — fiddly.

**Current behaviour (verified).** `BlockStyle` already carries
`width?: CssLength` and `height?: CssLength`
(`lib/page-builder/styleToolkit.ts:104-105`), and a `DimensionInput` Width/Height
pair is already rendered — but only for Image and Video
(`StyleToolkitField.tsx:2431,2456`). Container/Columns expose neither.

**Target [decided].** A **Width control only** on the Layout drawer for Container
and Columns:

```
Width    [ Fill ][ Hug ][ Fixed ]
```

- **Fill** — default, current behaviour. Writes nothing (`width` unset).
- **Hug** — `fit-content`.
- **Fixed** — reveals the existing `DimensionInput` (px/%).

**[decided] No Height control.** Height stays governed by the existing
`minHeight [ Auto | Short | Medium | Tall | Custom ]`. The stated problem — a
small 2-column button row — is a *width* problem, and adding a second height
knob would overlap `minHeight` and force a data migration for every saved draft
and every preset. Zero overlap, zero migration.

**Files.** `lib/page-builder/StyleToolkitField.tsx` (new segmented control +
wiring for `isFlexContainer || isColumns`), `lib/page-builder/styleToolkit.ts`
(no schema change needed — `CssLength` is `string`, so `"fit-content"` is
already representable; confirm `resolveBlockStyle` passes it through unchanged),
`lib/page-builder/blocks/manualBlocks.tsx` (a hugging Container must not also
apply `flexGrow: 1`).

**Interaction with Item 1.** Width=Hug and `overallWidth: "full"` are
contradictory. Hug wins, and the Overall width control should read as inactive
while Width is Hug — decide the exact affordance during implementation, but do
not let both apply at once.

**Acceptance.** A Container set to Width=Hug, Direction=Horizontal, holding two
Buttons, renders exactly as wide as the two buttons plus gap — in the canvas,
in preview, and on the published page. `selfAlign` still positions it. Unit
tests; browser check folded into run P2.

---

## Item 5 — Horizontal / vertical mode for Containers  **[decided]**

**Problem.** No UI to lay a container's children out in a row.

**Current behaviour (verified).** `_style.flexDirection: "row" | "column"`
already exists (`styleToolkit.ts:112`) and `ContainerBlock` already consumes it
(`manualBlocks.tsx:1052`). Several presets set it by hand — e.g. the footer
signature preset's link row (`presets/footer.ts:31`). **No control exposes it.**

**Target [decided].** A `Direction [ ↓ Vertical ][ → Horizontal ]` segmented
control in the Container Layout drawer, writing `_style.flexDirection`. Unset
displays as Vertical (effective-default display pattern, per the
`portfolio-effective-defaults` skill — the prop stays unset until edited).

**Files.** `lib/page-builder/StyleToolkitField.tsx` only. No render change.

**Acceptance.** Toggling Direction on a container reorients its children in the
canvas and on the published page. Existing presets that already set
`flexDirection: "row"` show Horizontal as active when selected. RTL (`ar`) row
direction follows the public wrapper's `dir`.

---

## Item 6 — Inherent padding on Heading and Text  **[decided]**

**Problem.** Heading and Text blocks render with zero padding, so the inline-text
editor covers the entire block and there is no grabbable strip to drag it out of
a tight container.

**Current behaviour (verified).** `HeadingBlock` and `TextBlock`
(`manualBlocks.tsx:106,177`) render a bare `<div>` carrying `puck.dragRef` with
no padding of any kind.

**Target [decided].** A **4px effective default on all four sides**, editable
through the existing Spacing padding controls — same mechanism as
`CONTAINER_EFFECTIVE_PAD` / `COLUMNS_EFFECTIVE_PAD`: the render falls back to
4px when `_style.padding*` is unset, and the control shows 4 as its
`effectiveValue` so the user can override it (including to 0).

**Files.**
- `lib/page-builder/blocks/manualBlocks.tsx` — add `TEXT_EFFECTIVE_PAD = 4px`
  and apply it in both blocks the same way Container does.
- `lib/page-builder/StyleToolkitField.tsx` — make `PaddingControls` reachable
  for Heading/Text and pass `effectivePad`.

**Acceptance.** Dragging a Heading out of a 2-column footer container succeeds
by grabbing the 4px strip. All 5 locales' preset stacks are re-checked for
loosened spacing at 375/768/1280. Existing drafts are unchanged in data (the
value is an unset fallback, not a materialized prop) — this is a **visual
change** to already-published pages of +4px per text block, which is accepted.

---

## Item 7 — Container anchor must survive container-only children

**Problem.** A container whose only child is a Container or a Columns loses its
drop anchor, so nothing can be dropped into it as a sibling.

**Current behaviour (verified).** Two layers disagree:
- `lib/page-builder/containerAnchorReconciler.ts` **strips** the anchor whenever
  `realChildren.length > 0`, unconditionally.
- `lib/page-builder/blocks/EditorContainerAnchor.tsx` has a "bridge case" that
  keeps a 4px footprint when `realChildren.length === 1 && realChildren[0].type === "Container"`
  — but the reconciler has already removed the anchor from the data, so that
  branch is effectively dead, and it never covered `"Columns"` anyway.

**Target.** Keep the anchor whenever **every** real child is a container-class
block (`Container` or `Columns`), not only when the container is empty. Drop it
only once the container holds at least one non-container child.

Both layers must agree on one predicate — extract e.g.
`isContainerClass(type)` / `shouldKeepAnchor(children)` into a single shared
helper consumed by the reconciler and by `EditorContainerAnchor`.

**Files.** `lib/page-builder/containerAnchorReconciler.ts`,
`lib/page-builder/blocks/EditorContainerAnchor.tsx`, plus a shared predicate
(new small module or an export from `blockTree.ts`).

**Acceptance.** A Container holding one Columns still shows a droppable anchor;
dropping a Heading on it nests as a **sibling of the Columns**, not inside it.
A Container holding a Columns *and* a Heading shows no anchor. Existing tests in
`containerAnchorReconciler.test.ts` and `containerAnchor.test.ts` extended.
This item is a prerequisite for Item 11 — the user hit both in the same repro.

---

## Item 8 — Undo, and Delete-key removal

**Problem.** Undo is gone: clicking "Move out", then Ctrl+Z, does nothing. The
Delete key should also remove the selected block.

**Current behaviour (verified).**
- Undo/Redo **buttons** exist in the editor toolbar and are wired to
  `usePuckStore(s => s.history.back / s.history.forward)`, disabled off
  `history.hasPast` / `hasFuture` (`EditorShell.tsx:435-471`).
- Puck 0.20.2 registers `ctrl+z` / `meta+z` / `ctrl+shift+z` / `ctrl+y` itself
  (`chunk-QIGVND56.mjs:957-962`) and monitors keydown on **both** the parent
  document and the canvas iframe document (`:829`, `:8673`).
- `EditorShell` installs a capture-phase `interceptPuckHotkeys` that calls
  `stopImmediatePropagation()` on keydown — but only when the event target is
  editable (`EditorShell.tsx:2398-2415`).
- The `BlockActionsToolbar` buttons dispatch plain Puck actions
  (`move` / `duplicate` / `remove`), which Puck records into history normally.

**This is a bug with no confirmed root cause yet.** Per
`superpowers:systematic-debugging`, step 1 is a Playwright reproduction, not a
speculative patch. Candidate causes to test, in order:

1. **Undo is re-clobbered.** This branch runs `reconcileContainerAnchors` and
   `syncChrome` off live store updates. An undo may restore the previous state,
   then be immediately re-normalized and re-committed, so the canvas appears
   unchanged. Test: click Undo (the **button**, not the key) after a Move out —
   if the button is also a no-op, the key binding is innocent and this is the
   cause.
2. **Puck's hotkey `held` map is stuck.** Puck's matcher requires an exact
   combo — any key stuck `held` (from a keyup that landed in the other document
   while focus crossed the iframe boundary) kills every hotkey permanently.
3. **Focus is nowhere.** After the portaled toolbar button unmounts, focus falls
   to a document that isn't the one receiving the keystroke.

**Target.**
- Ctrl/Cmd+Z undoes, and Ctrl+Shift+Z / Ctrl+Y redoes, **including for actions
  performed by clicking the toolbar buttons**, with focus anywhere in the editor
  (canvas iframe or app chrome) except inside a text input.
- `Delete` and `Backspace` remove the currently selected block, respecting
  `permissions.delete` (so the pinned Navigation and footer stay undeletable),
  and never fire while a text input or contenteditable has focus.
- Both are undoable.

**Files.** `app/[locale]/(app)/portfolio/_components/EditorShell.tsx`
(hotkey handling near `interceptPuckHotkeys`), possibly
`BlockActionsToolbar.tsx` for the shared delete path.

**Acceptance.** Playwright: move out → Ctrl+Z restores position; delete →
Ctrl+Z restores block; select pinned Navigation → Delete does nothing; type in
the Heading text field → Ctrl+Z edits the text, does not undo the canvas.
Verified at 1280px, and the Delete guard verified in all 5 locales (Arabic RTL
included, since focus handling differs).

---

## Item 9 — Refresh the marketing screenshots  **[decided]**

**Problem.** `public/marketing/screenshots/portfolio-builder-canvas-{light,dark}.png`
show the old builder.

**Current state (verified).** Both files are **3840×2160** (1920×1080 at
`deviceScaleFactor: 2`). They are consumed by the marketing landing page in two
places — the feature panel (`app/[locale]/(marketing)/page.tsx:76`) and the
"show / manage" split (`:207`), both through `ThemedShot`, which resolves the
`-light` / `-dark` suffix. There is **no existing capture script** for them.

**Target [decided].**
- Source drafts: **"Minimal template"** → light, **"Luxury template"** → dark,
  in the seeded owner workspace.
- The editor at `/portfolio` with the **Gallery** section tab active (the user
  prefers the gallery view of both drafts).
- Same output dimensions as today, 3840×2160, same filenames, overwritten in
  place — no marketing-page code change.
- **The Next.js dev overlay must not appear.** Injected via
  `page.addStyleTag({ content: 'nextjs-portal { display: none !important }' })`
  before capture, and asserted absent in the saved PNG's DOM state.

**Files.** New `e2e/` or `scripts/` capture spec modelled on
`scripts/screenshot-emails.spec.ts` + `scripts/playwright-screenshots.config.ts`;
the two PNGs overwritten.

- **Framing [defaulted]:** unchanged from today's shots — full editor chrome
  (left blocks panel + canvas + right properties panel + top toolbar).

---

## Item 10 — Update public copy about the portfolio builder

**Problem.** Marketing and SEO copy still describes the pre-wave builder.

**Surfaces that mention it (verified).**
- `messages/{en,fil,id,ar,th}.json` → `marketing.features.portfolioBuilder.*`
  (title, panelHeadline, description, feature1-4, cta) and `marketing.split.*`.
- `content/blog/writing-a-portfolio-page-that-books-clients.mdx`
- `content/blog/website-builder-or-booking-system.mdx`
- `content/compare/best-website-builders-for-creatives-2026.mdx`
- `content/compare/gallurio-vs-{dubsado,17hats,google-forms-and-email}.mdx`,
  `content/compare/best-crm-for-photographers-2026.mdx`
- `app/[locale]/(marketing)/page.tsx` alt text via `split.showImageAlt`

**Constraint.** No speculation. The copy may only claim capabilities that exist
in the shipped branch. The candidate list below is drawn from this branch's
commit history and from this spec's own items — **the user must tick which of
these go into public copy before any copy is written** (Q5).

**[decided] Approved for public copy: A, B, C, D, E, F, G, H, I.**
**Explicitly NOT approved: J and K.** The demo builder (J) and this wave's own
layout/undo work (K) stay out of the copy — K is not built yet, and shipping
copy ahead of code is how overclaims happen.

**[decided] Scope: landing locale strings + both blog posts + all 5 compare
pages.** Surgical edits only — a claim is touched when it is now stale or newly
true. No wholesale rewrites, and no new claim that is not one of A-I.

Capabilities, sourced from `git log dev..HEAD`:

| # | Capability | Evidence |
|---|---|---|
| A | Site header is an editable in-canvas Navigation block with its own panel, pinned and mirrored across pages | `041c093d`, `54e0876f`, `ab17a290` |
| B | Pinned footer, mirrored across pages, with three footer presets | `d1ed5b54`, `488b590d`, `presets/footer.ts` |
| C | Section preset library in a two-level drawer with live previews | `3c9739ef`, `PresetPreviewCard.tsx` |
| D | Editable gallery layouts (grid / masonry / carousel) as slot-based presets | `77c8d28c`, `0a57dc56` |
| E | Named drafts with preview-the-active-draft | `5a3b674b`, `51614d12`, `e08b8aca` |
| F | Uncapped photo picker + bulk collection select | `ba689f51`, `51f93908`, `8c9a1817` |
| G | Per-block design controls (padding, gap, color, type, radius, spans) | `StyleToolkitField.tsx` |
| H | Brand kit / theme presets, fonts, colors | `portfolio-theme-brand-kit` |
| I | Owner-controlled public page language incl. RTL Arabic | `PortfolioLanguageControl.tsx` |
| ~~J~~ | ~~Try-before-signup demo builder~~ — **excluded from copy** | `/portfolio-maker-demo` |
| ~~K~~ | ~~This spec's own layout/undo work~~ — **excluded from copy** | items 1, 4, 5, 8 |

**Files.**
- `messages/{en,fil,id,ar,th}.json` — all 5 catalogs in the same change.
- `content/blog/writing-a-portfolio-page-that-books-clients.mdx`
- `content/blog/website-builder-or-booking-system.mdx`
- `content/compare/best-website-builders-for-creatives-2026.mdx`
- `content/compare/best-crm-for-photographers-2026.mdx`
- `content/compare/gallurio-vs-dubsado.mdx`
- `content/compare/gallurio-vs-17hats.mdx`
- `content/compare/gallurio-vs-google-forms-and-email.mdx`

**Acceptance.** Every new claim maps to an approved row (A-I) — nothing from J
or K. All 5 locales updated in the same change;
`messages/encoding-sanity.test.ts` passes (guards the Thai/Arabic mojibake
regression). Marketing page tests and `e2e/marketing-landing.spec.ts` pass. The
compare pages' competitor claims are NOT touched — only the Gallurio-side
description of the builder.

---

## Item 11 — Container drop zone does not match its highlighted area

**Problem (user's repro).** A Columns block with a Container in column 1 and a
tall Masonry block spanning columns 2-3. The grid stretches column 1, so the
Container's visible box grows to match. The grown area highlights on drag-over,
but dropping there does nothing — the real drop target is only the strip
directly beneath the Container's existing children, which requires scrolling up
to see.

**Current behaviour (verified).** `ContainerBlock`'s `<section>` is
`display:flex; flex-direction:column; flex-grow:1`, and its content slot is
rendered with `flex: "1 1 auto"; minHeight: 0` (`manualBlocks.tsx:1035-1050`).
So the slot element *should* fill the stretched section. The mismatch between
the highlighted rect and the droppable rect has not yet been root-caused.

**This is a bug with no confirmed root cause yet** — diagnosis first, per
`superpowers:systematic-debugging`. Candidates:

1. **The anchor is missing** (Item 7). In the exact repro the Container's only
   child is a container-class block, so the anchor was stripped and the only
   droppable surface is the child's own bounds. Item 7 may resolve this outright
   — **fix Item 7 first, then re-test Item 11 before writing any further code.**
2. **Stale dnd-kit rect.** The droppable's measured rect is cached from before
   the grid stretched it; the highlight is drawn from the DOM element while
   collision uses the stale rect.
3. **Highlight is drawn on the wrong element** — the outer `<section>` (hover
   target) rather than the slot (drop target), so they legitimately disagree.

**Target.** The area that highlights is the area that accepts a drop. No
scrolling required.

**Files.** To be determined by the diagnosis; likely
`lib/page-builder/blocks/manualBlocks.tsx` and/or
`app/[locale]/(app)/portfolio/_components/editor.css`.

**Acceptance.** Playwright reproduces the exact shape (Container in col 1,
3-item + duplicates Masonry spanning cols 2-3), drops a Heading into the
stretched empty area of the Container without scrolling, and asserts it landed
inside that Container. Verified at 768 and 1280.

---

## Sequencing

Two waves, because Item 7 gates Item 11 and Items 1/4/5 all touch the same two
files.

**Wave A — independent, parallelizable**
- Item 2 (drawer cursor) — CSS only
- Item 3 (move out one level) — `moveBlockToRoot.ts` + toolbar
- Item 6 (text padding) — `manualBlocks.tsx` Heading/Text
- Item 7 (container anchor predicate) — reconciler + anchor
- Item 8 (undo + Delete) — diagnose, then `EditorShell.tsx`

**Wave B — depends on Wave A**
- Item 1 + Item 4 + Item 5 — all three edit `manualBlocks.tsx` and
  `StyleToolkitField.tsx`; land as one sequenced track, not in parallel
- Item 11 — re-test after Item 7 lands, then fix if still present

**Wave C — after the editor is stable**
- Item 9 (screenshots) — needs the finished builder on screen
- Item 10 (public copy) — needs the final capability list signed off

Per project rules: only this session runs `pnpm build` / full typecheck, one at
a time; implementer subagents run scoped `pnpm test --run <fragment>` and eslint
on their own files, serialized because tdd-guard state is shared per worktree.

## P1 results (run 2026-09-03)

**Verified in the browser:**
- Item 2 — drawer rows compute `cursor: grab`, accordion headers `cursor: pointer`.
- Item 6 — all eight text blocks measured `4px 4px 4px 4px`.
- Item 8 — Undo/Redo controls mount and are correctly disabled on a fresh load.

**Item 11 — root-caused.** Measured every grid-cell Container at 1280px:

```
{ sectionH: 399, padY: 56, slotH: 341, contentH: 96,
  emptySlotH: 246, slackH: 2, hasAnchor: false, puckChildren: 2 }
```

`slackH ≈ 0` everywhere, so the slot DOES fill the section's content box — the CSS
was never the problem. The 246px of empty space *inside* the slot is what
highlights and refuses drops, because Puck resolves a slot's drop target from its
child rects, not the slot box. Fixed by making the anchor always present and
letting it absorb the leftover space via `flex: 1 1 auto` (no ResizeObserver, so
the documented oscillation hazard stays avoided).

**NOT browser-verified: the item 11 fix itself.** 523 unit tests pass, including
the reconciler's idempotence-by-reference guard, and the production render returns
an empty fragment outside the editor so anchors cannot leak onto public pages. But
the confirming browser run was never obtained — see below.

**Why P1 cost 8 runs instead of 1**, recorded so the next session does better:
1. Three runs were spent on my own bad probes — a global `h2` selector that hit
   editor chrome, a "dead zone" measurement that didn't subtract the container's
   own padding (and briefly produced a false 64px finding), and a `getByRole`
   query that misses the editor toolbar because it sits in an `aria-hidden`
   subtree.
2. Interaction steps (click a block, Delete, Ctrl+Z, Move out) could not be driven:
   Puck's drag overlay intercepts synthetic pointer events on canvas blocks. Those
   items have 17 and 10 unit tests respectively; the browser was the wrong tool.
3. A zombie `pnpm dev` (PID held the port without serving) caused a hang that I
   briefly misread as a regression from the anchor change.
4. The editor's opening state is not stable across runs: the entry dialog differs
   for a returning user, and the preset drawer is two-level so draggable rows exist
   during boot and then collapse behind category rows. A spec that assumes either
   is flaky by construction.

**Lesson for the next attempt:** pin the editor state explicitly (load a known
draft by name via `openEditorWithDraft`, never "start from scratch") and assert
only measurements, never synthetic drags.

## Verification budget

A previous session lost most of a day to Playwright. Browser runs are rationed
here: **three consolidated runs total**, each covering many items at once. Unit
tests and eslint carry the rest.

| Run | When | Covers | Shape |
|---|---|---|---|
| **P1** | After Wave A lands | Items 2, 3, 6, 7, 8, 11 | One spec, one editor session, one login. Opens the editor once, then walks: drawer cursor assertions → drop a Heading into a container-only Container (7) → drag it out via the 4px strip (6) → Move out and assert placement (3) → Ctrl+Z and Delete (8) → the tall-Masonry drop repro (11). 1280px only. |
| **P2** | After Wave B lands | Items 1, 4, 5 | One spec. Toggles Overall width on footer/header/preset/manual/Columns, sets Hug/Fill/Fixed, flips Direction, and screenshots the public page at 1280 and 2560. Locale × theme sweep runs **here only**, and only on the public page render — not the editor. |
| **P3** | Wave C | Item 9 | The screenshot capture itself. Not a test run. |

Rules for whoever writes these:
- No per-item spec files. A new browser run must justify itself against the
  table above or fold into an existing one.
- No re-navigation or reload between assertions inside a run.
- Editor-side items get **1280px only**. The 3-breakpoint × 5-locale ×
  light/dark rule applies to the **public page** (P2), which is the
  public-facing surface the rule exists for.
- Subagents do not run Playwright. P1/P2/P3 are orchestrator-run, one at a time,
  same as builds.

## Done criteria

Per `CLAUDE.md`: implementation complete · tests passing · lint + typecheck pass
· all 5 locales updated · 3 breakpoints (375/768/1280) × 5 locales × light+dark
verified in a real browser · errors surfaced · existing published pages
unbroken.

Docs hygiene: this spec is consolidated into
`docs/modules/portfolio-and-media.md` and deleted before the PR.

---

## Open questions

All resolved. Decisions recorded inline above:

| Q | Decision |
|---|---|
| Q1 preset padding | Presets stay page-fit; only chrome defaults to full. No padding pass. |
| Q2 drawer cursor | `grab` idle / `grabbing` active on draggable rows; `pointer` on the accordion header. One-line flip to `pointer` documented in `editor.css`. |
| Q3 height control | Width only. `minHeight` keeps governing height. No migration. |
| Q4 screenshot framing | Unchanged — full editor chrome, 3840x2160. |
| Q5 copy claims | A-I approved; J and K excluded. |
| Q5 copy scope | Landing locale strings + both blog posts + all 5 compare pages. |
