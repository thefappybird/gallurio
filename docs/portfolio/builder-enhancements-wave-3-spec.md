# Portfolio builder enhancements — wave 3

12 items: featured-popup panel UX, preset default widths, container/columns layout
correctness, image-metadata capture moving to upload time, and image-modal nav/layout
plumbing.

Status legend: **[locked]** answered by the owner · **[open]** needs an answer before
that item is implemented.

---

## 1. Featured-popup "Layout" section collapsible

**Now:** `CollectionsPopupPanelDialog.tsx:236` renders the Layout section as
`<EditorDrawerSection title={t("collectionsDialog.layout")} flat>` inside an
`EditorDrawerGroup plain`. `flat` renders a static title with no chevron
(`EditorDrawerSection.tsx:39-47`).

**Target:** collapsible like the Popup / Title styles / Button styles sections,
**default open** [locked].

**Files:** `app/[locale]/(app)/portfolio/_components/CollectionsPopupPanelDialog.tsx`.

**Acceptance:** section header is a `button` with `aria-expanded`; collapsed state
persists across StyleToolkitField remounts via `drawerOpenStore` like the others.

---

## 2. One-sentence context under each layout picker

**Now:** `collectionsDialog.popupLayoutLabel` = "Featured work layout",
`collectionsDialog.imageModalLayoutLabel` = "Image preview layout"
(`messages/en.json:2746-2747`) — bare labels.

**Target:** a muted one-line description under each label. Copy written by us
[locked], in the owner's sense:
- Featured work layout → "This is what visitors see when they open a featured collection."
- Image preview layout → "This is what visitors see when they click an image on your page."

**Files:** `CollectionsPopupPanelDialog.tsx`, `messages/{en,fil,id,ar,th}.json`.

**Acceptance:** both strings render in all 5 locales; `messages/encoding-sanity.test.ts`
stays green.

---

## 3. Layout-preview card eats the cursor

**Now:** `LayoutPicker` opens the shared `LayoutPreviewCard` on hover/focus/click and
only closes it on outside-pointerdown or Escape (`layoutPreviewStore.ts`, card effect at
`LayoutPicker.tsx:216-231`). The card anchors `preferredSide: "start"` — for a
right-column tile it lands on top of the left-column tile, which then cannot be hovered.

**Target [locked]:** option (a) — close the card as soon as the pointer leaves the tile,
including when it moves onto the card itself. Opt-in, because the same
`createAnchoredPreviewStore` contract backs the sidebar preset previews
(`presetPreviewStore`), which keep today's sticky behavior.

**Files:** `app/[locale]/(app)/portfolio/_components/LayoutPicker.tsx` (opt-in prop,
`onMouseLeave` → `closeLayoutPreview()`); no change to `presetPreviewStore` or
`PresetPreviewCard`.

**Acceptance:** unit test — `mouseLeave` on a tile closes the card; a `LayoutPicker`
without the opt-in prop does not close on leave; focus-driven open still closes on blur
path unchanged for keyboard users.

---

## 4. Compact contact bar → horizontal container

**Now:** `presets/contact.ts:CONTACT_BAR_PRESET` is a Container whose only child is
`Columns{columns:3}` holding [Container(heading+text), ContactDetails, Button].

**Target [locked]:** drop the Columns. Preset container stays **page-fit**; its slot
becomes a row (`_style.flexDirection: "row"`) with `justifyContent: "between"`
(spread evenly) and three children in order: hugging Container (Heading + Text),
ContactDetails, Button.

**Mobile [locked]:** the row wraps to a stacked column at 375px — no cramped 3-across
band, no horizontal overflow.

**Files:** `lib/page-builder/blocks/presets/contact.ts`; contrast/composition tests in
`presets.composition.test.ts`, `presetContrast.test.ts`.

**Acceptance:** preset composition test asserts no `Columns` child and the row
direction/justify; accent-band contrast assertions still pass.

---

## 5. containerAnchor must not affect layout

**Now:** the anchor is a real in-flow `div` (`manualBlocks.tsx:1290-1303`,
`width:100%`, `height:${height}px`). `shouldKeepAnchor`
(`containerAnchorPredicate.ts`) keeps it when **every** real child is
Container/Columns — exactly the "two containers, spread apart" case — so it becomes a
third flex item and eats the free space that `justify-content: space-between` should be
distributing.

**Fix [locked]:** keep two modes, change only the bridge one.
- Empty container → unchanged: in-flow, full editor footprint (nothing to misalign).
- Bridge mode (all children container-class) → out of flow: `position:absolute;
  inset-inline:0; bottom:0; height:~16px` inside the Container's slot, which is already
  `position:relative` (`manualBlocks.tsx:1136`). It keeps a measurable droppable rect for
  dnd-kit (rect math, not pointer events) while contributing zero flex sizing, so
  `space-between` ends both nested containers at the slot's edges.
- Rejected: deleting the anchor whenever ≥1 container child exists — that is what makes
  dropping a sibling into the parent container nearly impossible (owner's own concern).

**Files:** `lib/page-builder/blocks/manualBlocks.tsx` (ContainerAnchorBlock),
`lib/page-builder/blocks/EditorContainerAnchor.tsx` (mode decision),
`containerAnchor.test.ts`.

**Acceptance:** unit test — bridge anchor renders out of flow (absolute) and an empty
container's anchor stays in flow; Playwright (batched wave): a Container with
`flexDirection:row` + `justifyContent:between` and two nested Containers ends the second
flush at the container's inline end.

---

## 6 / 8 / 9. Preset default widths — new insertions only [locked]

No migration of saved drafts or published pages [locked]. All three are data-only preset
edits.

- **6.** `presets/galleryLanding.ts:39` `GALLERY_LANDING_SPLIT_PRESET.overallWidth`:
  `"full"` → `"page-fit"`.
- **8.** `blocks/NavigationBlock.tsx:65` `navigationDefaultProps.overallWidth`:
  `"full"` → `"page-fit"`. The absent-value fallback at `NavigationBlock.tsx:109`
  (`overallWidth ?? "full"`) stays as-is [locked: "only default"], so existing saved
  headers keep rendering full-width.
- **9.** `presets/footer.ts:FOOTER_DIRECTORY_PRESET`: wrap only the trailing
  `child("Text", { text: "© 2026 Lumen Studio" })` in a `Container` with
  `overallWidth: "page-fit"` [locked: credits text only]. The two Dividers stay
  full-bleed.

**Credits alignment [assumed]:** start (inline-start), matching the rest of the directory
footer's content. Say so if you want it centered.

**Acceptance:** preset composition tests assert the new width values and the credits
wrapper; `NavigationBlock.test.tsx` keeps its "absent → full" case and gains a
"defaultProps → page-fit" case.

---

## 7. Nested page-fit width behavior

**7.1** Nested **Container** (page-fit inside a full-width parent) is the correct
reference behavior: content spans to the base page margin.

**7.2** Nested **Columns** (page-fit) renders wrong — **preview tab only; the editor
canvas looks fine** [locked]. Owner-reported combos:
- Container (page-fit) → Columns (2 cols) → one Heading: heading should start at the
  container's left edge, actually sits near the page center. Same with a full-width
  parent.
- Columns with no parent container, one Text child: text ends up centered on the page.

**Why it is not fixable blind:** the canvas drives the grid with inline
`gridTemplateColumns` (`manualBlocks.tsx:790-796`) while preview/public rely on
`@container` rules keyed to the block's own `container-type: inline-size` wrapper
(`manualBlocks.tsx:781-788`) plus the grid's own `max-width:80rem;margin:0 auto`
(`manualBlocks.tsx:836`). Which of those produces the shrink is a measurement, not a
reading.

**Plan:** measure in the preview tab during the batched Playwright wave (computed width
of the Columns wrapper, its grid, and the resolved track list for both combos), then fix
the identified cause and add a unit test pinning it.

**Acceptance:** in the preview tab, a page-fit Columns fills its parent's content box up
to the page margin, its first track starts at the parent's inline start, and a
single-child Columns does not center its child.

---

## 10. Image metadata captured at upload, not per placement

**10a. Wizard missing on new-collection uploads.** `ImageMetaWizard` is wired only into
`MediaPicker.tsx`; `CreateCollectionDialog.tsx` has no wizard, so images uploaded while
creating a collection never prompt for metadata. Target: run the wizard one image at a
time after the upload completes, same as MediaPicker.

**Locked:** dismissable (MediaPicker behavior) — never a gate on creating the
collection. Instead, any image left with incomplete metadata carries a warning
indicator (icon) in every picker/manager grid that lists it; hovering/focusing it says
the photo has incomplete metadata and may not display as intended. Wired into both
`CreateCollectionDialog` and `EditCollectionDialog` uploads [assumed — the strictness
answer replaced only the gating half].

**Incomplete = ** missing `altText` at minimum (accessibility + modal copy); title and
caption count toward "complete" but their absence alone is not a warning. Pin the exact
predicate in one shared helper so grid, wizard and any future surface agree.

**10b. Wizard gains custom meta rows [locked].** `ImageMetaWizard` covers
title/caption/altText/date/location/client/tags; `ImageBlockMetaSection` additionally
edits `meta[{label,value}]` rows. Add those rows to the wizard so it is a superset.

**10c. Block-level metadata editing removed [locked].**
- Remove `alt` from `imageBlockConfig.fields` (`manualBlocks.tsx:395`).
- Remove the Photo-details section (`ImageBlockMetaSection.tsx`) from the Image block's
  Content tab — the block is styles/layout only.
- On pick/drop, plug the GalleryItem's entered metadata into the block
  (title/caption/alt/date/location/client/tags/meta), so the renderer and every image
  modal have it without a per-placement form. Values are not shown as inputs in the
  panel again.
- Replace them with one row: `[image] ......... [Edit]`, spread apart — image title on
  the far inline-start, Edit button on the far inline-end — opening that image's
  metadata modal directly.

**Row placement [assumed]:** the `[image] [Edit]` row sits in the Image block's Content
tab, exactly where the removed inputs were.

**Files:** `lib/page-builder/galleryPicker/{CreateCollectionDialog,ImageMetaWizard,MediaPicker}.tsx`,
`lib/page-builder/ImageBlockMetaSection.tsx` (removed from the block panel),
`lib/page-builder/blocks/manualBlocks.tsx` (ImageBlock fields + baked metadata),
`lib/page-builder/StyleToolkitField.tsx` (panel section wiring), all 5 locale catalogs.

**Acceptance:** creating a collection with N uploads walks N wizard steps; a picked image
carries its metadata into block props; the Image block's panel exposes no alt/details
inputs, only the `[image] [Edit]` row; existing drafts with a per-block `alt` keep
rendering (legacy prop still read at render, just not editable).

---

## 11. No prev/next when opening an image inside a gallery block

**Now:** `Lightbox.tsx:316` `hasNav = images.length > 1`. Slot-nested `ImageBlock`s open
the modal with a single image (`manualBlocks.tsx:353-362`), so masonry/grid galleries
built from slot children have no navigation.

**Target [locked]:** navigation pages through **the images inside that block only**.
Applies to every gallery/masonry preset and to the `GalleryGrid` / `GalleryMasonry`
blocks themselves.

**Files:** `lib/page-builder/blocks/{GalleryGridBlock,GalleryMasonryBlock}.tsx`,
`GalleryLightboxTrigger.tsx`, `manualBlocks.tsx` (ImageBlock), plus whatever per-block
image-collection context this needs.

**Acceptance:** clicking the 2nd of 5 photos in a slot-built masonry opens at index 1
with working prev/next and a "2 / 5" counter; a standalone Image block outside a gallery
block still opens without nav.

---

## 12. Image modal ignores the chosen layout and shows no metadata

**Now, three separate causes:**
1. `Lightbox.tsx:279-281` — the legacy `image=` signature hardcodes
   `layout = "caption"`, ignoring any `layout` prop.
2. Every caller builds `LightboxImage`s with only `id/publicId/alt/width/height`
   (`GalleryMasonryBlock.tsx:130-137`, `manualBlocks.tsx:355`), so
   `title/caption/date/location/client/meta/tags` are always absent — nothing to render
   even in `CaptionLayout`. Item 10c supplies these.
3. The preview route resolves the layout from the **saved**
   `workspace.publicPage.collectionsPopup` (`serverContext.tsx:72-77`,
   `portfolio-preview/page.tsx:145`), so an unsaved panel change shows the old layout.

**Owner observation [locked]:** preview tab, clicking an image → only the photo and a
close button; no entered metadata, no selected layout. Follow-up: **Image blocks still
show the unchanged view even AFTER saving**, so cause 3 is not the whole story.

**Owner correction:** the photo DID have metadata saved through the Image block's Photo
details fields, and the modal still shows neither it nor the chosen layout after saving.
That metadata lives on the **GalleryItem** record (`ImageBlockMetaSection` persists it
server-side), while `ImageBlock` hands the Lightbox only
`{id, publicId, alt}` (`manualBlocks.tsx:353-362`) — so the modal never sees it. Item 10c
(bake the item's metadata onto the block) is what closes that half.

**A genuine second bug exists — the layout is not applied for Image blocks.**
`SidebarLayout` renders its 340px panel unconditionally (stacked below the photo under
768px — `SidebarLayout.tsx:5-26,97-112`), so a chosen `sidebar` layout could never look
like a bare photo on a dark scrim. Ruled out statically, do NOT re-audit:
- the save is not draft-only — `_actions.ts:170-173` `$set`s `publicPage.collectionsPopup`
  on the Workspace doc directly;
- the preview threads it — `PreviewClient.tsx:72` renders
  `metadata={{ workspace }}` where `workspace` spreads `buildRenderWorkspace(workspace)`
  (which carries `publicPage.collectionsPopup`).
Remaining hypotheses, in the order to test — all settleable with unit tests, no browser:
1. `puck.metadata` does not reach slot-nested children in the RSC `Render` path, so
   `ImageBlock`'s `puck?.metadata?.workspace?.…?.imageModalLayout` is `undefined` and
   `resolveImageModalLayout` returns `"caption"`. Test: render a Container slot holding
   an ImageBlock with metadata set, assert the trigger receives the non-caption layout.
2. Something between the trigger and `Lightbox` drops `layout` for the single-image
   shape. Test: `Lightbox` with `layout="sidebar"` and one image → the sidebar panel is
   in the DOM.
3. Only then: a persistence/projection gap (published-workspace projection omitting
   `collectionsPopup`).

**Why every layout also looks alike once that is fixed (cause 2):** every non-caption layout's
distinguishing chrome is gated on metadata or navigation —
`CinemaLayout.tsx:100` (`hasMeta = Boolean(image.title || image.caption)`, filmstrip on
`hasNav`), `SheetLayout.tsx:47-50,85,105`, `SidebarLayout.tsx:52-55,136,141`. An
`ImageBlock` opens the modal with ONE image carrying no title/caption/date/location/
client/meta, so cinema, sheet, sidebar and caption all degrade to the same "photo +
close button" regardless of the saved layout. Only `BACKDROP_BY_LAYOUT` still differs.
So items 10c (bake metadata onto the block) and 11 (block-scoped nav) are what make the
layout choice observable at all — verify the chain in that order, and only then judge
whether a persistence bug also exists.

**Chain already verified as sound (do not re-audit):** `lib/validators/publicPage.ts:85`
accepts `imageModalLayout`; the published page threads `metadata.workspace` including
`publicPage.collectionsPopup` (`app/(public)/w/[orgSlug]/page.tsx:157-191` via
`buildRenderWorkspace`). If a persistence gap remains after 10c/11, look at the save
action and the published-workspace projection, not at the validator or the renderer.

**Locked:** the layout change must be visible in the preview tab **before** saving —
thread the live, in-editor popup config into the preview the way `PreviewPopupShell`
already does with `fallbackConfig`, so choosing a layout is immediately reflected.

**Files:** `lib/page-builder/blocks/Lightbox.tsx`, the two gallery blocks,
`manualBlocks.tsx`, and — depending on [open-12] — `portfolio-preview/page.tsx` /
`PreviewDraftContext.tsx`.

**Acceptance:** with `imageModalLayout: "cinema"` saved, opening an image from masonry,
grid and the featured popup all render the cinema leaf; entered title/caption/date/
location/client/meta appear in the layouts that display them.

---

## Verification plan

- Unit tests per item (scoped `pnpm test --run <fragment>`), lint on touched files,
  one orchestrator-run `tsc --noEmit`.
- **One batched Playwright wave at the end**, not per item. Editor-internal surfaces at
  1280px only; the public/preview surfaces touched by items 4/6/7/8/9/11/12 get the
  3-breakpoint × 5-locale × light+dark sweep in that same run. Planned runs: (1) editor
  panel items 1/2/3/5/10 at 1280px, (2) preview/public sweep for 4/6/7.2/8/9/11/12.
- Locales updated together for items 2, 4 (if copy changes), 10.
