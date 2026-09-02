# Portfolio editor: Navigation block, gallery picker, draft lifecycle, nested block drawer

Single scope doc for branch `fix-feat/portfolio-maker-reliability-and-new-presets`.

## Context

Commit `235d46dc` (already reverted, `70d9b04e`) hallucinated a locked single-instance
`NavigationBlock` plus a "shared chrome" sync layer, and regressed the working footer
presets into a synced tab/zone. Reverted cleanly, no conflicts. A search for
`sharedChrome` / `chromeSync` / `NavigationBlock` returns nothing today, so this work
starts from a clean tree.

The header still lives outside Puck: `PortfolioHeaderConfig` is edited through a bespoke
2-tab dialog, persisted to `Workspace.publicPage.header`, and rendered once globally in the
public layout. It becomes a Puck block — but a **pinned, undeletable preset block that
mirrors across the home and gallery pages**, with a per-page detach toggle. The footer gets
the same mirroring while staying optional.

Live testing on the same branch then surfaced four more problems:

1. **Photo Grid / Masonry backdrops are now noise.** Those two blocks gained bulk
   upload, so their content *is* images. A separate "Background images" picker on the
   same block is confusing and redundant.
2. **The photo picker's hard cap of 60 is arbitrary.** It is the owner's own website —
   a full page of photos is a legitimate layout.
3. **The collection tile's select-all control looks like a pre-ticked checkbox.** It
   renders a check icon unconditionally on every collection, selected or not.
4. **"Welcome back" silently overwrites a saved draft.** The localStorage buffer is
   applied on mount regardless of which entry option the owner picks, and it carries
   `draftId`/`draftName` with it — so stale unsaved edits get re-attributed to a clean
   saved draft and the next Save writes over it. Compounding this, the server seeds the
   canvas from the *published* page while labelling it with the *newest draft's* name.
5. **The left panel's 12 flat drawers do not scan.** Presets should nest one level
   deeper: `Preset blocks` > group > variant.

Outcome: a header that is always there and always consistent across pages without being a
cage, gallery blocks whose only images are their content, an uncapped picker with an honest
checkbox, a draft buffer with a single clear lifecycle, and a two-level block drawer.

**Sequencing.** E/F and C touch the same code (`headerConfig` lives in
`buildDraftSnapshot`, `PortfolioBrowserDraft`, `savedSnapshot`, and `applyDraft`). Land
**E/F first**, then C, then A/B/D in any order. A, B and D are mutually independent.

---

## How the local draft buffer works today (reference)

- **Storage:** localStorage, key `gallurio:portfolio-draft:{slug}` (demo mode uses
  `demoDraftKey(demoSessionId)`), value a `PortfolioBrowserDraft` v2
  (`EditorShell.tsx:983`, `:1015-1036`).
- **Written:** debounced ~350ms on every Puck `onChange`, flushed on zone-switch /
  preview / `beforeunload` / unmount, plus synchronously after `applyDraft` and after
  `handleSaveChanges`.
- **Cleared:** only three places — parse failure (`:1087`), `handleDiscardChanges`
  (`:1423`), successful publish (`:1559`). Saving a draft *rewrites* it rather than
  clearing it, which is the bug behind problem 4.

---

## Decisions (confirmed with the owner)

| Question | Decision |
|---|---|
| Photo limit | **No cap at all.** Whatever is selected becomes the block's images. |
| Collection checkbox | Real tri-state checkbox: empty / indeterminate / checked. Clicking a checked box **deselects** that collection. |
| Background images | Remove control **and** rendering, on `GalleryGrid` + `GalleryMasonry` only. `Container` and `FeaturedWork` untouched. |
| Drawer | Two top-level drawers: `Preset blocks` (nests **12** groups > variants, `nav` added) and `Manual blocks` (flat). |
| Nav + Footer form | Both are **preset blocks**, not manual blocks. |
| Zone behavior | **Truly synced** across home + gallery, with a per-page detach toggle that only one page may hold. |
| Detach off | **Anchor wins** — the detached page adopts the other page's header; confirm dialog first. |
| Sync scope | **Everything** — config fields *and* the slot's logo/title blocks. |
| Header presence | Pinned to index 0, `delete`/`duplicate`/`drag` all false, auto-injected into any zone lacking one, including `scratch`. |
| Header internals | Free slot on the left (Image + Heading, deletable); links + contact button rendered by the block, not removable. |
| Footer | Same sync + detach mechanism, but stays optional and deletable. |
| Existing header values | **Auto-migrated on editor load** into the new block. |

---

## Workstream A — kill background images on Photo Grid + Masonry

**Frontend.**

- `lib/page-builder/blocks/GalleryGridBlock.tsx` and `GalleryMasonryBlock.tsx`:
  drop `backgroundImages`, `bgAnimation`, `bgSpeed`, `overlayOpacity` from the props
  type, `defaultProps`, `fields`, and `render`. Section background becomes
  `var(--pf-color-bg)` unconditionally (delete the `hasBg` ternary). Keep
  `minHeight` / `minHeightValue` and the `PresetMediaPlaceholder` empty state.
- **Do not delete `resolveBannerLayers`** — it is defined in `GalleryGridBlock.tsx:109`
  but imported by `FeaturedWorkBlock.tsx:144` and used by masonry. Move it (with
  `bgImageUrl` and the `GalleryBannerLayers` sub-render) into a new
  `lib/page-builder/blocks/bannerLayers.ts` and repoint `FeaturedWorkBlock` +
  `manualBlocks.tsx`. Same treatment for `resolveGalleryMinHeight` /
  `GALLERY_MIN_HEIGHT` if masonry imports them from the grid file.
- `lib/page-builder/StyleToolkitField.tsx:779` — `hideBgImage` is currently dead
  (`= false`) with a comment describing exactly this behavior. Set it to
  `SLOT_GALLERY_PICKER_BLOCKS.has(type)` (that set is `{GalleryGrid, GalleryMasonry}`;
  **not** `GALLERY_CONTAINER_BLOCKS`, which includes FeaturedWork). `BannerSection`
  already honors the flag (`:464`) and has a test at `StyleToolkitField.test.tsx:796`.
  Simplify `effectiveBannerColor` so those two blocks resolve to `"background"` with no
  `hasBackgroundImages` branch.
- Presets: remove the `backgroundImages: []` seed from
  `lib/page-builder/blocks/presets/galleryGrid.ts` and `galleryMasonry.ts` **only**;
  leave about/contact/cta/footer/featuredWork alone.
- `lib/db/seedE2eDraft.ts:51` — drop if it seeds one of these two blocks.

**Leave alone:** `lib/db/queries/gallery.ts:499` (`ALT_HOLDING_PROP_KEYS`) still serves
Container/FeaturedWork. Stray `backgroundImages` on already-saved pages need no
migration — Puck preserves unknown props and the render simply stops reading them.
Stripping them would flip `isDirty` on load for every existing draft; don't.

## Workstream B — picker: no cap, honest checkbox

**Frontend.** `lib/page-builder/galleryPicker/MediaPicker.tsx`, `MediaField.tsx`,
`StyleToolkitField.tsx`.

*No cap:*
- Widen `max?: number` to `max?: number | null` on `MediaPicker` (`:102`, `:112`) and
  `MultiImageControl` (`MediaField.tsx:106`); `null` means unbounded.
- Every `max ?? SAFETY_CAP` site becomes `max === null ? Infinity : (max ?? SAFETY_CAP)`
  — `MediaPicker.tsx:290, 305, 331, 390, 524`. `SAFETY_CAP` stays as the default for
  every other multi caller (the banner picker's `max={12}`, etc.).
- `StyleToolkitField.tsx:587-591` — pass `max={null}` for the slot gallery picker.
  **Leave `DemoMultiImageControl` at `max={60}`**: the demo's image cap is a deliberate
  upsell gate (`activeDemoGate`), not the same constraint.
- `L.selectedCount` (`:58`) already degrades to `"N selected"` when `max` is falsy —
  verify the header call passes the unbounded value through rather than a literal.

*Checkbox:* replace the always-checked button at `MediaPicker.tsx:860-877`.
- Tri-state derived from the existing `useGalleryPickerCache`: cache each collection's
  item ids the first time they are fetched (the bulk path already fetches them via
  `/api/portfolio/gallery/collections/{id}?newest=...`). State = `all` / `some` / `none`
  of the cached ids present in `selection`. A collection whose ids are not cached yet
  renders **unchecked** — which is the desired default and needs no extra request.
- Click semantics: unchecked or indeterminate -> select all (fetch if uncached);
  checked -> remove that collection's ids from `selection`.
- Markup: empty bordered box by default, `MinusIcon` for indeterminate, `CheckIcon` for
  all; keep `Loader2Icon` while `bulkLoadingId === col.id`. Set `aria-checked` with
  `role="checkbox"` and `"mixed"` for indeterminate.
- Add `L.deselectAllInTile(name)` beside `L.selectAllInTile`. **Note:** `MediaPicker`'s
  `L` object is hardcoded English today (only the alt-text dialog uses `next-intl`).
  Follow the existing pattern; do not localize the whole picker in this PR — flagged as
  a pre-existing gap instead.

## Workstream C — draft lifecycle

**Frontend** — `app/[locale]/(app)/portfolio/_components/EditorShell.tsx`:

1. **Gate restoration on the entry choice.** Extract the mount effect at `:1059-1089`
   into a `restoreLocalDraft()` callback and stop running it on mount. Call it *only*
   from `PortfolioEntryDialog`'s `onContinue` (`:2656-2663`). `canContinue` already
   derives from the same buffer probe used for `entryOpen` (`:863-872`) — reuse it, do
   not re-parse. Picking "Load an existing draft" or "Start from scratch" must leave the
   buffer unapplied.
   - Preserve today's auto-restore in the two paths that show no entry dialog: demo mode,
     and the guide-deferred path (restore fires from the deferred entry choice, not mount).
2. **Save clears the buffer.** In `handleSaveChanges` (`:1162-1240`) replace
   `persistLocalDraft()` with a `clearLocalDraft()` helper
   (`window.localStorage.removeItem(draftKey)`) on the real-workspace path. There is one
   buffer per workspace, so saving *any* draft retires it.
   **Keep `persistLocalDraft()` in the `demoMode` branch**: the buffer is a demo
   session's only storage, and clearing it would destroy the visitor's work.
3. **`applyDraft` clears too.** `applyDraftInner` (`:1325-1389`) ends with
   `persistLocalDraft()`, which manufactures a buffer for a freshly-loaded clean draft
   and makes the next visit offer "Continue where you left off" for edits that never
   happened. Clear instead.

**Backend** — `app/[locale]/(app)/portfolio/page.tsx`:

4. **Seed the canvas from the active draft, not the published page.** Today
   `initialData` reads `workspace.publicPage.data` while `initialActiveDraftId` is
   `initialDrafts[0]` — so a reload shows published content under the newest draft's
   name, and Save overwrites that draft with published content. Extend the existing
   `PortfolioDraft.findOne` (already run for SEO fields) to project `data`, `brandKit`,
   `contact`, `header`, `collectionsPopup`, `formLocale`, `formDir`, `templateId`, and
   use those for the `initial*` props, falling back to `publicPage` when there are no
   drafts. Keep `toPlain` + `reconcileZone` on the way out and keep the query scoped by
   `workspaceId` alongside `_id`. This also stops `savedSnapshot` (`:921-937`) from
   being spuriously dirty on first paint.

## Workstream D — nested preset drawer

**Frontend** — new `components` Puck override in `EditorShell.tsx` (near the existing
`drawer` / `drawerItem` overrides at `:2002-2046`, `:2387-2395`).

- Puck 0.20 `categories` are flat and cannot nest, so replace the default component list
  with a `components: RenderFunc` override that renders the tree itself using `Drawer` /
  `Drawer.Item` from `@measured/puck` plus the existing
  `components/ui/collapsible-drawer.tsx` (`CollapsibleDrawer`, already controlled/
  uncontrolled with keyboard support).
- Structure — **one single `<Drawer>` wrapping everything** (one droppableId keeps drag
  working); the collapsible sections are plain elements inside it:
  ```
  <Drawer>
    CollapsibleDrawer "Preset blocks"        (defaultOpen)
      CollapsibleDrawer per PRESET_GROUPS    (12 groups: nav first and open,
        Drawer.Item per group.keys            other 11 closed)
    CollapsibleDrawer "Manual blocks"        (closed)
      Drawer.Item per MANUAL_BLOCK_KEYS
  </Drawer>
  ```
- Titles: `t("puckConfig.categories.presets")` — **the key already exists**
  (`editorConfig.tsx:310`, "Preset blocks") — `t("puckConfig.categories.manual")`, and
  `t(group.labelKey)` from `PRESET_GROUPS` (`blocks/sectionPresets.ts:269-297`).
- **Preserve demo filtering:** derive both lists by intersecting `PRESET_GROUPS` /
  `MANUAL_BLOCK_KEYS` with the keys actually present in the live `config.components`,
  which demo mode already trims. Do not read a second source of truth.
- `Drawer.Item` still routes through the registered `drawerItem` override, so
  `PresetDrawerItem` popovers keep working; keep `PresetPreviewPanel` mounted once, as
  today.
- Keep `data-tour-id="blocks-panel"` on the `drawer` override — the spotlight step
  anchors to it (`portfolio-guide` skill).
- Once the override lands, delete the now-unused `presetCategories` build and
  `categories` key in `editorConfig.tsx:937-957` so the drawer has one source of truth.

## Workstream E — Navigation block + synced chrome (frontend)

Navigation and Footer become **preset blocks** that mirror across the home and gallery
zones, with a per-page detach toggle.

**This deliberately rebuilds a sync layer.** Commit `235d46dc` was reverted for
hallucinating one; this one is specified, toggleable, and tested.

### E1. Chrome identity and the sync rule

- Section presets are all `Container`s today (`sectionPresets.ts` header comment) and are
  identified only by component key, so chrome needs an explicit marker: add
  `_chrome?: "nav" | "footer"` to the Navigation block props and to the three footer
  preset prop objects (`presets/footer.ts`).
- Add `detached?: boolean` to the same props. **At most one zone per chrome kind may be
  detached**: when home's Navigation has `detached: true`, gallery's toggle renders
  disabled (with a hint naming the page that holds it), and vice versa.
- New pure module `lib/page-builder/chromeSync.ts` — no React, unit-testable:
  - `findChrome(zoneData, kind)` -> the block or null.
  - `syncChrome(zones, changedZone, kind)` -> mirrors the changed zone's chrome block
    **in full — config props AND `content` slot children** — into the other zone,
    **preserving the target block's own Puck id** and regenerating ids for mirrored slot
    children (Puck ids must be unique within a tree). No-op when either side is detached.
  - `reanchorChrome(zones, detachedZone, kind)` -> **anchor wins**: overwrite the detached
    zone's chrome with the anchor zone's copy, then clear `detached`.
  - `normalizeChrome(zoneData)` -> guarantees exactly one Navigation at index 0.
- Wire `syncChrome` into `EditorShell`'s `handleChange` (after `zoneDataRef` updates,
  before the debounced persist) so mirroring rides the existing change path. Both zones
  already live in `zoneDataRef`, so this is a pure transform — no extra state.
- **Toggling detach off is destructive** (the detached page's header is discarded for the
  anchor's). Gate it behind a confirm dialog naming which page's styling is lost.

### E2. Navigation as a preset group

- Section presets are typed `ContainerBlockProps` and assumed to be `Container`s. Navigation
  is its own block type (it renders locked links), so widen the registry: give each preset
  entry an optional `componentType` defaulting to `"Container"`, and have `puckConfig` /
  `createEditorConfig` / `fillBlockDefaults` read it. Everything else derives from the
  registry already and needs no change.
- Add `nav` to `PRESET_GROUP_IDS` + `GROUP_LABELS` (`sectionPresets.ts:79-99`, `:269-297`)
  as the **first** group, with three variants in a new `presets/navigation.ts`, seeded from
  the distinct looks in the templates' former `defaultHeader` values. Workstream D's drawer
  picks the new group up automatically.
- Footer stays the existing `footer` group with its three presets, unchanged except for the
  `_chrome` marker and the detach toggle.
- **Assumption (flagged, not asked):** since the header is pinned and undeletable, dragging
  a Navigation variant onto a page **replaces** that zone's existing Navigation rather than
  inserting a second one, then syncs. This is the only coherent behavior under
  "always present, never deletable" — say so in the drawer item's preview copy.

### E3. Block structure, permissions, presence

- **Permissions** (`ComponentConfig.permissions`, confirmed present in Puck 0.20 —
  `Permissions = { drag, duplicate, delete, edit, insert }`): Navigation gets
  `{ delete: false, duplicate: false, drag: false }`. Footer keeps full freedom (still
  optional and deletable).
- `drag: false` stops the header being moved, but Puck has no "cannot insert above index 0"
  rule — so `normalizeChrome` also runs in `handleChange` to push Navigation back to index
  0 if another block lands above it.
- **Structure — free slot left, locked links right:**
  - `content: { type: "slot" }` seeded with an `Image` block (logo) and a `Heading` block
    (title), side by side. Fully editable, restyleable, and deletable by the owner.
  - The links (`Home` / `Gallery`) and the contact button are rendered **by the block
    itself**, not as slot children, so they cannot be removed. They are styled by the
    block's own fields.
- **Always present:** `prepareForEditor` (`EditorShell.tsx:614`) is the single funnel every
  load path already goes through (initial mount `:759`, `savedSnapshot` seed `:927`,
  `zoneDataRef` `:946`, `puckSeed` `:978`, local-buffer restore `:1070`, and `applyDraft`).
  Extend it to call `normalizeChrome`, prepending a Navigation when a zone has none.
- **Block props are the full `PortfolioHeaderConfig` shape** — 24 fields,
  `lib/page-builder/types.ts:161-210` (brandText, logoUrl/logoAssetId, background
  color/opacity, link/brand/active-link colors, border bottom width/color, shadowSize,
  fontSize, navbarSize, activeLinkScale/Highlight/Radius/Underline + highlight and
  underline colors/opacity, contact button color/textColor/opacity/radius), plus
  `_chrome`, `detached`, and the `content` slot. This is the same set of updatable values
  the dedicated tab has today, ported into Puck block form.
- **Reuse `PortfolioHeader.tsx` as-is** (`app/(public)/w/[orgSlug]/_components/`,
  props at `:107-127`: `{ slug, labels, config, activePath, homeHref, galleryHref }`).
  Do not rewrite its rendering. The block's `render()` resolves `labels` / `homeHref` /
  `galleryHref` / workspace name from `puck.metadata` and passes `config={props}`.
- **Metadata bridge:** add `chrome.nav` beside the existing `chrome.gallery` in
  `lib/page-builder/blockContext.ts` (type at `:68-77`, `chrome` object at `:61`), wired
  at the page boundary the same way — follow that pattern, do not invent a new one.
- **Fields in Puck's ordinary sidebar** via `StyleToolkitField.tsx`'s existing
  per-block-type dispatch (see the `CollectionCard` / `Image` branches). Logo upload keeps
  the old `HeaderPanelDialog` constraints: 250KB, 512x256 max, png/jpeg/webp,
  `portfolio_header` subfolder.
- **Seed into all 5 templates**, first content item in BOTH `home` and `gallery` zones —
  **including `scratch`**, which must no longer open header-less. Use each template's own
  former `defaultHeader` values as initial props; they differ per template, preserve them,
  do not collapse to one default: `templates/minimal.ts:25`, `bold.ts:33`,
  `editorial.ts:35`, `luxury.ts:34`, `scratch.ts:22`. Then remove `defaultHeader` from
  `PortfolioTemplate` and all 5 files.
- **Migrate saved values on load (auto).** In the same `prepareForEditor` pass, when a zone
  has no Navigation, build one from that draft's saved `header` config, falling back to
  `publicPage.header`, then to the template default. Existing styling carries over with no
  action from the owner, and the header field is then dropped from the draft on next save.
  - **Known gap, accepted:** a page published *before* this change and never republished
    loses its header on the public site until the owner republishes, because
    `layout.tsx` no longer renders one and the published zone data has no Navigation
    block. Tolerable only because `dev` is the sole branch with real data — re-seed or
    republish after merge.
- **Stop rendering the header globally:** `app/(public)/w/[orgSlug]/layout.tsx` — drop the
  `PortfolioHeader` render (`:82-96`) and the `publicPage.header` read (`:65`).
- **`EditorShell.tsx`:** remove `"header"` from `EditorSection` / `EDITOR_SECTIONS`, the
  header branch of `previewZoneFor`, the `HeaderPanelDialog` import/usage, the
  `headerConfig` / `initialHeaderConfig` state, `headerSnapshot`, `headerHasSaved`, and the
  "edit header" trigger.
- **Delete:** `HeaderPanelDialog.tsx` (618 lines) + `HeaderPanelDialog.test.tsx`;
  `_components/HeaderFormPreview.tsx` (+test); `app/[locale]/portfolio-preview/_components/
  PreviewHeaderShell.tsx` (+test) — both are dead once the header renders inline as Puck
  content in the same iframe.
- **`generateMetadata`** in `w/[orgSlug]/page.tsx` and `gallery/page.tsx`: drop the
  `portfolioHeaderLogoUrl(publicPage?.header)` favicon fallback. There is no single
  reliable header logo anymore — the site icon falls back to explicit `siteIcon` only.
- **i18n:** remove the editor-only `headerDialog.*` keys across en/fil/id/ar/th. **Keep**
  `publicPage.nav.*` — still the real nav labels at the page boundary, same as
  `publicPage.chrome.gallery.*`. **Add** across all 5 locales: the `nav` preset group
  label + its 3 variant labels/descriptions, the detach toggle label and its
  disabled-because-the-other-page-holds-it hint, and the re-anchor confirm dialog copy.
- **Draft-shape interaction (read with Workstream C):** `headerConfig` leaves
  `buildDraftSnapshot`, `PortfolioBrowserDraft`, the `savedSnapshot` seed, and
  `applyDraftInner`. Make the field **optional** in `PortfolioBrowserDraft` and ignore it
  on hydrate — an old buffer simply carries an extra unread key. **Do NOT bump
  `LOCAL_DRAFT_VERSION`**: a bump silently invalidates every existing buffer on deploy, and
  this change is backward-compatible without one (per the `portfolio-drafts` skill).

## Workstream F — header storage removal (backend)

- Delete `updateHeaderConfigAction` (`app/[locale]/(app)/portfolio/_actions.ts:159-179`).
- Delete the `settingsDraft.logo` -> `publicPage.header` promotion in `publishDraftAction`
  (`_draftActions.ts:329-338`) and the paired block further down the same function.
- `lib/db/models/Workspace.ts`: drop the `publicPage.header` subdocument (`:235-258`) and
  the `logo` field from `publicPageSettingsDraftSchema` (`:51-73`) — staged only for the
  promotion path that is going away. Leave `siteIcon`, `seo`, and the seo* fields intact.
- Remove the Settings-page logo control and its `_actions.ts` save logic.
- `lib/page-builder/migrateDraft.ts`: keep reading a legacy `header` value long enough for
  E's load-time migration to consume it, then ignore it. It must never throw on a draft
  saved during this session's testing.
- `publishDraftAction`: run `normalizeChrome` on both zones before writing, so a published
  page can never ship without a Navigation block even if the client sent one without.
- Keep `Workspace.publicPage.data` as the published source of truth — the header now lives
  inside that zone data like any other block. No new schema field for chrome.

---

## Split (hard boundary, per CLAUDE.md)

- **Backend:** Workstream F, plus Workstream C item 4 (`page.tsx` active-draft projection
  + fallback).
- **Frontend:** A, B, C 1-3, D, E + i18n + tests.
- E and F are two halves of one change: land F's schema/action removals only after E's
  block renders, or the public page loses its header in between.

---

## Tests

- `gallerySlotImages.test.ts` — unchanged behavior, confirm still green after the
  `max` widening.
- `StyleToolkitField.test.tsx` — extend the existing `hideBgImage` test: assert the
  Background-images picker is absent for `GalleryGrid`/`GalleryMasonry` and still
  present for `Container` and `FeaturedWork`.
- New `MediaPicker` tests: unbounded selection (no cap at 60 when `max={null}`);
  checkbox renders empty for an uncached collection, `mixed` for partial, checked for
  full; clicking a checked box removes exactly that collection's ids.
- New `EditorShell` tests: buffer is NOT applied on mount; applied only via
  `onContinue`; `handleSaveChanges` removes the key while the demo path keeps it;
  `applyDraft` removes the key.
- New `page.test.tsx` case: with drafts present, `initialData` comes from the newest
  draft; with none, from `publicPage`; and the draft query is `workspaceId`-scoped.
- Block render tests for grid/masonry: no banner layers even when legacy
  `backgroundImages` props survive in saved data.
- Navigation block: renders `PortfolioHeader` from its own props; resolves labels/hrefs
  from `puck.metadata.chrome.nav`; carries `{ delete: false, duplicate: false, drag: false }`;
  each of the 5 templates (scratch included) seeds it into both zones with that template's
  own former `defaultHeader` values.
- `chromeSync.ts` is pure and gets the densest unit coverage — it is the piece the earlier
  revert got wrong:
  - `syncChrome` mirrors config **and** slot children both directions; deleting the logo
    block on one zone removes it on the other; the target block keeps its own Puck id and
    mirrored slot children get fresh unique ids.
  - `syncChrome` is a no-op when either side is `detached`.
  - `reanchorChrome` overwrites the detached zone from the anchor and clears the flag
    (anchor wins); the anchor zone is left untouched.
  - Only one zone per kind can be detached; the second toggle is refused.
  - `normalizeChrome` prepends a Navigation to a zone that has none, moves a displaced one
    back to index 0, and collapses a duplicate pair to one.
  - Footer goes through the identical path and stays deletable.
- Load-time migration: a draft carrying a legacy `header` config and no Navigation block
  yields a Navigation seeded with those exact values; with no `header`, it falls back to
  `publicPage.header`, then the template default.
- `publishDraftAction` normalizes both zones before writing.
- Draft compatibility: a v2 buffer still carrying `headerConfig` hydrates without error
  and without bumping the version.
- Delete the tests belonging to the three removed components; do not leave them skipped.
- Run targeted only: `pnpm test --run <fragment>`.

## Verification

1. `pnpm exec eslint` on touched files; then, orchestrator-only and one at a time,
   `pnpm run typecheck`.
2. Playwright (CLI, per `portfolio-testing`), 375 / 768 / 1280 px x en/fil/id/ar/th x
   light+dark:
   - Drop a Photo Grid: the Design tab shows **no** Background images / animation /
     speed / overlay controls; a Container still shows all four.
   - "Choose photos": header reads `N selected` with no `/60`; select past 60 and
     confirm it keeps going and all of them land in the block.
   - Collection tiles: box is empty on open, goes checked after select-all, clicking a
     checked box clears that collection, partial selection shows the mixed state.
   - Left panel: `Preset blocks` > `Hero` > variant; drag a nested variant onto the
     canvas and confirm it drops; the guide's "drag a block" spotlight still frames the
     panel; `Manual blocks` still drags.
   - Navigation presence: open a **scratch** template — the header is there. Try to delete
     it (no delete affordance), try to drag it (pinned), drop another block above it and
     confirm it returns to the top. Confirm it no longer double-renders — it appears only
     where the block sits, never from the layout. Check `ar` RTL geometry stays inside the bar.
   - Header content: edit the brand text and logo as the slot's Heading/Image blocks,
     delete the logo, confirm the links and contact button survive and cannot be removed.
   - **Sync:** restyle the header on home, switch to gallery — it matches. Delete the logo
     on gallery, return to home — also gone. Do the same for a Footer preset.
   - **Detach:** toggle detach on home, restyle it dark, confirm gallery stays light and
     gallery's toggle is disabled with the hint naming home. Toggle home back off, confirm
     the dialog warns, and that home adopts gallery's light header (anchor wins).
   - Drag a second Navigation variant in and confirm it replaces rather than stacks.
   - Migration: open a draft that predates this change and confirm its old header styling
     appears on the new block, in both zones.
   - Publish a draft carrying a Navigation block and load the real public page + the
     preview iframe; the header must be identical in both and in the editor canvas.
3. Draft lifecycle, in a real browser with DevTools > Application > Local Storage:
   - Edit without saving, reload -> "Welcome back" -> **Load an existing draft** -> the
     saved draft loads clean; the stale edits are not applied and Save does not clobber it.
   - Same setup -> **Continue where you left off** -> edits restored.
   - Save a draft -> `gallurio:portfolio-draft:{slug}` is gone; reload -> no "Continue"
     option, canvas loads that draft's content under its own name.
   - With no buffer and several drafts, reload lands on the newest draft's content
     (not the published page); with no drafts at all, on the published page.
   - Demo mode (`/portfolio-maker-demo`): save still preserves the session buffer.
