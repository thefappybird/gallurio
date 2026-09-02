# Module: Portfolio Builder & Media

## Public portfolio

Exactly 3 public pages per workspace: Home, Gallery, Contact, served at `/w/[orgSlug]`. Source of truth is `Workspace.publicPage` (template id, `data.{home,gallery}`, `brandKit`, `savedThemes[]`, SEO fields, `formLocale`/`formDir`, per-section style overrides). A shared Puck config powers both the in-app editor and the public renderer — one block definition, two consumers. Do not add portfolio collections beyond Home/Gallery/Contact without explicit approval.

The page/canvas background is **never auto-adopted from the theme background** (`var(--pf-color-bg)`). It's painted only when an explicit page background (`_rootStyle.bgColorToken`) is set on the page root style — consistently across editor canvas, preview, and publish/public render.

Inquiry submission from the public Contact page is a **single transaction**: creates `Inquiry` + `Client` + a draft `Booking` together, or fails atomically.

**Meaningful vs decorative images (SEO):** Google doesn't index CSS background images, so any image that carries meaning renders as a real `<img src alt>` in server HTML — the gallery Grid/Masonry/Carousel blocks, the `Image` block, and featured-collection covers. Alt text source differs per kind: the gallery Grid/Masonry/Carousel blocks pull `GalleryItem.altText || caption || ""` via `reconcileGalleryImages`; the `Image` block's alt is a manual Puck field (`alt` prop, `lib/page-builder/blocks/manualBlocks.tsx`); featured-collection covers use the collection's `name` (`tile.name` in `FeaturedCollectionsClient.tsx`), not `GalleryItem.altText`. Purely decorative layers stay `alt=""` / `aria-hidden` and must never get keyword-stuffed alt text — `ContainerBlock` backgrounds, the featured-collection cover placeholder, and hero background slideshows. Featured-collection covers are the one exception with both: the `<img>` carries a real `alt={collection name}` for crawlers, but also `aria-hidden="true"` so it isn't announced twice — the wrapping `<button>` already exposes the collection name as its accessible name.

For new slot-based Photo Grid/Masonry layouts, the meaningful images are their nested `Image` blocks: use the `alt` prop and `_style.bgImagePublicId`. The former `images[]` reconciliation path remains solely for previously saved gallery blocks.

## Public discovery (SEO)

- **Sitemap selection.** `listPublishedWorkspaceSlugs()` returns `{ slug, lastPublishedAt, hasHome, hasGallery }`, excluding `publicPage.seo.noindex === true`. `hasHome`/`hasGallery` are computed **in the aggregation** so no page data crosses the wire; a parity test pins the expression against `hasRenderableBlocks()` (`normalizePublicPageData.ts`), which is the single definition of "this page has real content". `app/sitemap.ts` emits Home and Gallery independently, so a portfolio with no Gallery content never advertises a URL that renders Coming Soon.
- **Per-tenant crawler files.** `app/(public)/w/[orgSlug]/robots.txt/route.ts` and `.../sitemap.xml/route.ts`. On a configured `NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN`, `proxy.ts` already rewrites `{slug}.{base}/robots.txt` to these routes — no proxy change was needed, only the handlers. `noindex` → robots `Disallow: /` and sitemap `404`; unpublished/unknown slug → `404` on both, leaking no existence. The tenant sitemap carries `<image:image>` entries (note: Google deprecated `<image:caption>` in 2022 and reads only `<image:loc>`; the caption is kept for other consumers).
- **Every emitted URL comes from the resolved `workspace.slug`, never the raw route param** — a mixed-case `/w/{Slug}` request would otherwise emit a canonical that disagrees with the sitemap.
- **Language.** `proxy.ts` stamps `x-gallurio-portfolio-slug` (stripped of any inbound copy once at the top of `proxy()`), and the `(public)` root layout reads it to render real `lang`/`dir` on `<html>`. Do **not** reintroduce a client-side `document.lang` patch — crawlers never see it.
- **Metadata is never empty.** `lib/portfolio/seoDefaults.ts` supplies deterministic translated defaults built only from the workspace name and the owner-selected business type. `findPublishedWorkspaceBySlug` must keep projecting `businessType` — it drives both the schema.org `@type` and the description variant.
- **Structured data** is one connected graph per page with stable `@id`s, and each page is self-contained: every `@id` a page references is also defined in that page's own markup.

> **Blocks nest inside slot props.** A published tree is not just `content` + `zones` — presets hold their children in `props.content`, so a `GalleryGrid` commonly sits 2-3 levels deep. Always traverse with `collectBlocks`/`mapBlocks` (`lib/page-builder/blockTree.ts`), never by iterating `content`/`zones` alone. Reconciliation and image collection both silently returned nothing before this was fixed.

## Workspace-level settings buffer (`publicPage.settingsDraft`)

Branding/SEO entered outside the block editor — the first-visit story-prompt dialog (`completeStoryPromptAction`) and the `settings/public-page` Save action — lands on **`Workspace.publicPage.settingsDraft`**, a workspace-owned buffer that is independent of whichever `PortfolioDraft` is active. The story prompt no longer resolves/creates a `PortfolioDraft` (that draft-creation side effect used to fabricate a blank draft on every first visit and corrupt the new-user check). `settingsDraft` holds `seoDescription`, `seo.keywords`, `seo.ogImage{Url,AssetId}`, `siteIcon.{url,assetId}`, and `logo.{url,assetId}`; it is promoted onto the live `publicPage` only on **Publish**. The `logo` slot is legacy — the story prompt still stages it, but nothing promotes it onto `publicPage.header` any more.

- **Workspace logo**: no longer editable from `settings/public-page` — that upload control and its save path were removed when the header became a block. The portfolio nav logo is now an ordinary `Image` block inside the Navigation block's slot, so it lives in the published Puck data like any other block. `publicPage.header` survives as **read-only legacy**: the load-time draft migration consumes it, public metadata reads its logo as a favicon fallback, and inquiry emails still read `header.logoUrl`. No code path writes it.

## Navigation, footer, and chrome sync

The site header is **not** a stored config object any more — it is a `Navigation` block living inside the zone data, mirrored across pages. `Workspace.publicPage.data` stays the single published source of truth; chrome needs no schema field of its own.

- **Chrome marker.** A block is chrome when its props carry `_chrome: "nav" | "footer"`. That marker is what `chromeSync` keys on — not the component key, since presets are otherwise all `Container`s. `detached?: boolean` opts one zone out of mirroring; at most one zone per kind may be detached, and toggling detach off is destructive (the detached page’s chrome is discarded for the anchor’s), so it sits behind a confirm.
- **`lib/page-builder/chromeSync.ts` is pure and React-free**: `findChrome` locates a zone’s chrome block; `syncChrome` mirrors the changed zone’s chrome into the other zone in full (config props *and* slot children), preserving the target block’s own Puck id and regenerating ids for mirrored children; `reanchorChrome` overwrites a detached zone from the anchor zone (anchor wins) and clears `detached`; `normalizeChrome` collapses duplicates and pins nav first / footer last. It never invents a nav or footer — absence is a valid state, and seeding is the caller’s job.
- **Pinned, not deletable.** Navigation sits at index 0 and the footer last, with their delete/drag actions locked. Dropping a nav or footer preset onto a page that already has one **replaces** it in place, keeping the pinned block’s id, rather than inserting a second copy.
- **Migration.** A draft or published page saved before the block existed carries a legacy `header` value instead. `prepareForEditor` converts it into a Navigation block on editor load and that repair is persisted, not merely displayed; `migrateDraft` must never throw on a legacy `header`. `publishDraftAction` runs `normalizeChrome` on both zones before writing, so a published page cannot ship without a nav block.
- **Known gap (pages published before the migration).** The public layout renders no header of its own — nav and footer come from the published zone data. A workspace that published earlier and has not republished since renders with no nav until its owner reopens the editor (which migrates) and publishes. There is no read-time fallback; closing this needs either read-path synthesis from `publicPage.header` or a one-off republish migration.

## Section presets

The insertable section library is **11 groups x 3 variants = 33 registered preset components**: Hero, About, Services, Call to action, Contact, Gallery grid, Gallery masonry, Featured work, Gallery landing, Video, Footer. Every preset is a `Container` whose slot is pre-filled with ordinary manual blocks, so each nested piece stays individually selectable, movable, and editable — never a monolithic section renderer whose text cannot be reached.

- **`lib/page-builder/blocks/sectionPresets.ts` is the registry**, and the only place these facts live: each preset's group, its localized label/description keys, its content dependencies (`gallery` / `collections` / `contact` / `video`), and its `defaultProps`. `puckConfig`, `createEditorConfig`, the drawer categories, `PRESET_BLOCK_KEYS`, `fillBlockDefaults`, and `StyleToolkitField`'s container-type sets all derive from it. Do not reintroduce a hand-maintained parallel list — the two gaps that motivated the registry (`VideoPreset` missing from `fillBlockDefaults` and from both toolkit sets) were both drift between copies.
- Compositions live one file per group under `blocks/presets/`, with the shared band recipes in `presets/_helpers.ts`.
- **The ten original component keys are frozen** (`HeroPreset`, `AboutPreset`, `ServicesPreset`, `CtaPreset`, `ContactPreset`, `GalleryGridPreset`, `GalleryMasonryPreset`, `FeaturedWorkPreset`, `GalleryLandingPreset`, `VideoPreset`) — published pages reference them. Their display labels are variant names now, because the group name is the category heading above them; the keys must not be renamed or removed.
- Footer is an **insertable section preset**, not a global field persisted separately from Puck data. Public pages remain exactly Home, Gallery, and Contact.
- Gallery layout belongs in `_style.galleryColumns` / `_style.galleryGap`. Top-level `columns`, `gap`, `collectionId`, and `maxItems` props on `GalleryGrid` / `GalleryMasonry` / `FeaturedWork` are stale and are asserted absent.
- New Photo Grid and Masonry layouts own a `content` slot of ordinary `Image` blocks. Each photo therefore has its own picker, alt text, crop/size controls, and Puck drag order. Legacy `images[]` gallery data remains read-only compatibility input for previously saved pages; do not seed it in new presets. `FeaturedWork` is retained only for saved pages, while every new collection composition uses `Columns` plus `CollectionCard` blocks.
- `CollectionCard` has dedicated Card, Collection title, and Photo count design drawers. Its no-collection empty state inherits the Collection title typography and color, so the canvas placeholder previews the same styling instead of using a separate hardcoded foreground treatment.
- `ContainerBlock` caps its slot at `max-width: 80rem`. The only way a preset breaks the page measure is a `Columns` child with `columns: 1, overallWidth: "full"`.
- Every `Columns` inside a preset sets an explicit `minHeight`. `columnsDefaultProps.minHeight` is `"320px"` — a row that inherits it grows dead space.

### Contrast is a correctness property, not a style choice

`blocks/presetContrast.test.ts` measures all 33 presets against all 6 committed brand kits (WCAG 2.1), modelling `resolveBlockStyle` and every `ButtonBlock` branch, plus the scrim case that only appears once an owner adds a background image. It is coupled to those renderers on purpose: if either changes, this test changes with it.

Every committed kit guarantees its `foreground` reaches WCAG AA contrast against all four surface tokens: `background`, `primary`, `secondary`, and `accent`. Presets can therefore use the palette's more varied surfaces without changing their text token or guessing whether the kit is light or dark. Built-in buttons likewise keep their label and boundary on `foreground` unless an owner explicitly overrides them.

`ContainerBlock.overlayColorToken` still exists for image scrims: unset keeps the legacy `rgba(0,0,0,a)` so saved pages do not shift, and a set token composites via `color-mix`. Preset image scrims pin both overlay and copy deliberately so their contrast remains measurable.

A button on a contrasting band must still pin its own style and color. `ButtonBlock` reads only `_style.buttonStyle` and never the brand kit's button-style preference, while the named solid, soft, and outline branches now default their labels to the universal foreground.

### The brand background must be PAINTED, not just declared

`resolveBrandKit` returns `--pf-color-bg` in `cssVars`, but declaring a custom
property paints nothing. Both portfolio wrappers — the public layout and the
preview shell — must set `backgroundColor: var(--pf-color-bg)` explicitly after
spreading `cssVars`. Without it the page ground falls through to whatever the
surrounding shell paints: the preview route lives under `[locale]`, so a dark app
theme rendered a light brand kit black. `floatedDefaultParity.test.ts` is the
permanent gate over this whole class of bug — every control that displays an
effective default is asserted against what the renderer actually applies when the
prop is unset.

### Button styles: two unions on purpose

`BRAND_KIT_BUTTON_STYLES` (`solid | outline | soft`) is the workspace-wide default
picked in the Theme panel. `BLOCK_BUTTON_STYLES` adds `link` and is the per-block
`_style.buttonStyle` union only — a hairline underline is a deliberate footer
treatment, never a sensible kit-wide default. `link` renders a transparent fill
with `border-bottom: 1px solid currentColor`, square corners and `padding: .25rem 0`;
`outline`'s hardcoded 2px full frame is what made the footer presets read heavier
than their mockups.

### Container and Columns traps

- `ContainerBlock` accepts `_style.flexDirection` but **ignored it** until recently,
  hardcoding `column`. That is why footer button groups stacked instead of sitting
  in a row. Rows also need explicit `marginLeft/marginRight: "0px"` on each Button:
  `ButtonBlock`'s legacy `align` prop still emits auto margins that fight the row's
  own `gap`.
- `ButtonBlock` resolves `_style.cellVerticalAlign` into `alignSelf` but used to
  copy only the four margins off the resolved object, silently dropping it — which
  is why a Columns cell refused to center vertically.
- `ColumnsBlock` supports **equal `fr` tracks only**. Asymmetric ratios (the
  Directory footer mockup's `1.4fr 0.8fr 1fr`) are not expressible; only
  `_style.colSpan` varies a child's width.

### True masonry flow

New and migrated `GalleryMasonryBlock` instances use independent flex column
lanes, so each column continues below its own previous image instead of waiting
for the tallest item in a shared grid row. The former `_style.galleryStagger`
value is ignored and is no longer offered as an editor control.

Its legacy `content` slot accepts only `Image` blocks and has no editor mode
switch; it exists only so saved pages keep rendering. New manual Masonry blocks
and every Masonry preset use **column lanes**: each active lane is its own
Image-only Puck slot, so an owner can drag images between lanes and each lane
flows independently. Optional alternating tile rhythm has separate odd/even
tile heights for odd-numbered and even-numbered columns. The even-column
defaults invert the odd-column rhythm so adjacent lanes do not repeat one
lockstep pattern.

Column lanes also support a presentation-only loop. Once **every active column
has at least three images**, the first rendered tile of each shorter lane is
duplicated and cropped into that lane's remaining height up to the tallest
original lane. The gap and duplicate never increase the masonry's pre-loop
maximum height. `MasonryClone` is an internal Puck block reconciled at the end
of each eligible lane. It is absent from insert categories and has drag, delete,
duplicate, insert, and edit permissions disabled. Its inert, `aria-hidden`
image props remain linked to that lane's first Image, and the reconciler removes
all clones whenever Loop is off or any active lane falls below three Images.
Existing saved flow blocks remain on the compatibility renderer; do not expose
that retired format as a selectable layout.

### Enabled controls must be truthful

An editor control earns its place only if all of these hold: choosing a different option causes a **visible or interactively verifiable** change in the canvas; the same saved value produces the same result in preview and publish; the control is enabled only when its prerequisite structure exists, and explains itself when disabled; explicit overrides are distinguishable from effective theme defaults and are resettable without freezing a value into props.

There are exactly three valid resolutions for a no-op control: make the render honor it, hide/disable it with a stated prerequisite, or remove it. Mutating stored data or changing an invisible computed property does not count — this is why the scrim's opacity and color controls appear only once at least one background image exists.

For the deep architecture (editor shell, Puck blocks, spotlight guide/tour, brand kit, drafts, contact form, effective-default style controls), start at the `portfolio-editor-architecture` skill — it routes to the focused sub-skills (`portfolio-blocks-and-design`, `portfolio-drafts`, `portfolio-theme-brand-kit`, `portfolio-guide`, `portfolio-effective-defaults`, `portfolio-testing`). This module doc intentionally does not duplicate that — it only covers the data model and cross-cutting rules an agent needs before diving in.

## Data model

- `Workspace.publicPage`: see above — `previousData` holds the pre-publish snapshot, `latestVersion`/`publishedAt`/`lastPublishedAt` track publish state.
- `PortfolioDraft`: named, durable draft snapshots (`{ home, gallery }` data + brandKit/contact/header/collectionsPopup/SEO), unique per `(workspaceId, name)` — replaced the old localStorage-only autosave.
- `GalleryCollection`: album/collection — `name`, `slug` (unique per workspace), `coverItemId`, `order`.
- `GalleryItem`: individual photo/media asset — Cloudflare `assetId`/`assetProvider`, delivery `url`, dimensions, `caption`/`altText`, `order`, `tags[]`.
- `Inquiry`: public form submission — contact info, one or more requested `sessions[]`, `eventType`/`guestCount`/`location`/`budgetRange`, UTM `source`, `status: inquiry|quoted|accepted|declined|archived`, links to the `Client`/`Booking` it was converted into.
- `PageviewRollup` / `PageviewVisitorSeen`: daily per-page analytics (`home|gallery|contact|_site`) with privacy-preserving visitor dedup — HMAC visitor hash, 48h TTL marker doc, no IP/UA stored.

## Cloudflare Images

- Browser uploads go **Direct Creator Upload** only (`requestDirectUpload`, `lib/storage/cloudflareImages.ts`) — the Cloudflare API token never reaches the client.
- Every create route calls `verifyImageOwnership(imageId, workspaceId)`; tenant scoping is via upload metadata (`workspaceId`), not folders.
- Store the asset id + provider (`GalleryItem.assetId`, `assetProvider: "cloudflare"`) and the delivery `url`; thumbnails are URL variants via `imageDeliveryUrl()`.
- **Leak-safe deletion**: never `deleteImage` an asset that is still live. A replaced `settingsDraft` asset (OG image, site icon, logo) is deleted only once it differs from **both** the new value **and** the currently-published value — i.e. only after it's been superseded live (on Publish, or on Save when the old value is no longer the live one). Delete the remote asset whenever the owning document is deleted — never leave orphaned remote images.
- **Upload leniency**: uploads validate file **type + size only** (`uploadAsset`/`uploadImage`) — no pixel-dimension or aspect-ratio rejection (the old 600px minimum / dimension checks were dropped). Cloudflare delivery-time fit handles sizing on read. `dimensions_too_large` stays in the error union but is unused/harmless. An in-app cropper is a planned future PR.
