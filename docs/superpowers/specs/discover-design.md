# Discover: portfolio showcase, browse page, listing toggle, header refresh

Status: design, awaiting approval. Mockups (approved): `docs/mockups/discover-marketing-section.html` (variant A only), `docs/mockups/discover-browse.html`.

## Intent

Gallurio has no place where visitors see what real portfolios built on it look like. Discover gives prospects proof by example and gives owners a second channel for being found. It has three parts:

1. A Steam-style banner on the marketing home page: copy and a "Browse portfolios" button on the left, three angled rows of portfolio tiles drifting on the right.
2. A public `/discover` page: a Pinterest-style masonry grid of image-only cards, where name and category appear over the image on hover. It has category chips and search. A card opens a modal with photos (or a live scaled-down view of the site) on the left and a business outline on the right.
3. An owner-facing "List on Discover" toggle, **on by default**, in Settings → Public page and in the Publish dialog.

The same change also refreshes the marketing header.

## Goals

- An owner gets listed with no extra setup. The toggle is pre-ticked, and saving or publishing with it on is enough.
- Listing changes on a live page are always explicit: the owner sees a clear statement of what is about to happen before it happens.
- The listing can never drift from the live page. It is read from the published snapshot. The only derived value is the fallback cover, which is written by publish itself.

## Non-goals

- Screenshots of portfolios, whether headless rendering or a third-party service.
- New owner-editable listing fields such as a custom cover, pitch, city or extra images. v1 uses data that already exists, and this can be revisited later.
- Ranking, featured slots, likes, analytics or moderation tooling beyond a report link.
- Removing the Resources and Compare pages. Only their header links go; the footer keeps them.

## Anti-goals (a failure even if it works)

- Any private field (email, phone, address, `contact.*`, `ownerUserId`, inquiry recipient, client names hidden with `hideClient`) appears in a Discover response.
- An unpublished, wiped (`publishedAt = null`), "Coming Soon" (no renderable blocks), noindex or lapsed (gated) portfolio shows on Discover.
- An owner's listing state changes on a live page without the explicit warning or confirmation below.
- A portfolio published before this ships appears on Discover without its owner saving or publishing with the toggle on. There is no backfill, and the field has no schema default.
- Fabricated sample portfolios ship to production. The product is pre-launch and has no fake customers.

## Constraints

- Next.js 16 App Router, server components by default, `params`/`searchParams` awaited.
- Design system "The Studio Ledger" (`DESIGN.md`):
  - Brand teal only on actions.
  - Flat surfaces with hairline rings.
  - `--radius` for controls, `--radius-surface` for frames.
  - Plus Jakarta Sans for UI.
- i18n: `en`, `fil`, `id`, `ar` (RTL), `th`, all updated together, with logical properties throughout.
- Discover is a deliberate **cross-tenant public read**, like the sitemap query (`listPublishedWorkspaceSlugs`). It is the documented exception to "every query includes `workspaceId`". Safety comes from a fixed field whitelist plus the listing filter.
- Public route hardening follows the Endpoint hardening checklist in `docs/modules/hosting-ops.md`: rate limit, input validation, no error detail leakage.
- Playwright is rationed: one batched final run, and public surfaces get 375/768/1280 × 5 locales × light/dark.

## Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (chosen)** | Fields on `Workspace` (`discover.listed`, `discover.listedAt`). The listing is derived live from the published snapshot. | Simplest, and cannot go stale. The cross-tenant query needs a dedicated index and a strict projection. |
| B | A separate `DiscoverListing` collection, synced on publish, save, unpublish, wipe, slug change and noindex. | Faster to query and naturally isolated, but every write path must keep the copy in sync. One missed path shows a dead or stale portfolio, which counts as a class-1 data-integrity defect. |
| C | Screenshot service. | Ruled out: cost, VPS RAM, staleness. |

The owner picked A.

## How previews are sourced (no screenshots, no server rendering)

Every preview is built from something the owner already uploaded or configured.

- **Grid and banner tile:** the first of these that exists.
  1. **Share image:** the owner's 1200×630 Open Graph image from Settings → Public page (`publicPage.seo.ogImageUrl`).
  2. **First image on the live page:** a real photo the owner uploaded and placed on their published Home page, usually the hero image. It is already hosted on Cloudflare Images. It is picked once at publish time and stored as `discover.coverUrl` (see Data model).
  3. **Brand tile:** a CSS-only card drawn from the published brand kit (background, text and accent colors, heading font) and the business name. No image is involved.
- **Modal:** a photo carousel of the share image plus up to 4 images the published page actually renders (see Read paths). There is **no live site view** (owner decision). "Visit portfolio" opens the real page in a new tab. In production, portfolios live on their own subdomains, and embedding them would have required relaxing the framing headers.

## Decisions made with the owner

- **Banner:** mockup variant A, with copy and the teal CTA on the left and three angled rows (alternating direction) on the right. It has a pause button (WCAG 2.2.2), pauses on hover, and turns into swipeable static rows under reduced motion. Below 820px it stacks.
- **Browse page:** follows the mockup.
  - Search, category chips, and a CSS-columns masonry (2 columns at 375px, 3 from 760px, 4 from 1100px).
  - **Cards are image only (owner decision; this replaces the mockup's always-visible captions).**
    - On hover **and** on keyboard `:focus-visible`, the image fades to about 35% opacity over the card's dark surface token. The name and "Category · Country" fade in on top, aligned bottom-start, over 150–200ms, with no movement.
    - Text contrast is measured against the dimmed image in both themes and must meet AA.
    - Touch devices (`@media (hover: none)`) get no overlay. A tap opens the modal, which carries all the metadata, so no information is hover-only.
    - Because the text is hidden at rest, the card link keeps an accessible name: `aria-label` set to name, category and country.
    - With reduced motion, the overlay appears without the fade.
    - Brand tiles show the name in the tile already, and get the same dim and overlay for consistency.
    - The marketing banner strip is unchanged (decorative, `aria-hidden`).
  - Loading, empty, no-results and load-more states.
  - A native `<dialog>` modal: two panes on desktop, a bottom sheet at 720px and below.
  - "Visit portfolio" opens `/w/<slug>` in a new tab with `rel="noopener"`.
- **Header order (desktop):**
  - Nav: Discover, About, Pricing, Portfolio Builder.
  - Then: Sign in (text link), **Book a Demo** (outline / secondary button), **Get started** (brand button), followed by the theme and locale toggles.
  - Resources and Compare are removed from the header.
  - Mobile sheet: the same nav order plus Sign in, then Book a Demo as an outline button. The bar keeps Get started beside the menu button.
- **List on Discover toggle:**
  - Shown ticked by default in the UI. It is never applied to the database implicitly (see Data model).
  - Shown in Settings → Public page and in the Publish dialog.
- **Confirmation rule, both directions (option B):**
  - It applies only when the page is **currently published** and the toggle value differs from the effective saved state (`listed === true`; unset counts as not listed).
  - Never-published page: the owner can toggle freely with no warning or confirmation. The value is simply saved and takes effect on first publish.
  - **Settings → Save** (the existing Save button): a confirm modal (Cancel / Confirm).
    - Turning on: title "Show your portfolio on Discover?" and body "Your portfolio will appear on the Gallurio Discover page, where anyone can browse it."
    - Turning off: title "Remove your portfolio from Discover?" and body "Your portfolio will no longer appear on the Discover page. Your public page stays live."
    - Final copy goes through all 5 locales.
  - **Publish dialog:** no second modal, because the Publish dialog *is* the confirmation.
    - When the toggle differs from the saved value on a published page, a **prominent warning block** appears directly above the footer. It is in the amber warning style already used by the settings pending-changes banner: an icon, a bold title and one line of body.
    - The block must stand out. It uses a full-width bordered block with the amber tint. It does not use muted helper text.
    - The primary button label changes to "Publish and list on Discover" or "Publish and remove from Discover".
    - The block is announced with `aria-live="polite"`.
- **Storage:** approach A.

## Design

### Data model (`lib/db/models/Workspace.ts`)

```ts
discover: {
  listed:   { type: Boolean, default: undefined }, // NO schema default: unset = never decided
  listedAt: { type: Date, default: null },          // set when the listing goes live, cleared never (sort key)
  // Fallback cover: first image on the published Home page. Written ONLY by publishDraftAction.
  coverUrl:     { type: String, default: "" },
  coverAssetId: { type: String, default: "" },
  coverWidth:   { type: Number, default: null },
  coverHeight:  { type: Number, default: null },
}
```

**Fallback cover (`discover.cover*`):**
- `publishDraftAction` computes it in the **same** `$set` as the publish. It walks the normalized `home` zone blocks in render order and takes the first image reference, reusing the block traversal that `reconcileGalleryImages` already does in `app/[locale]/(app)/portfolio/_draftActions.ts`.
- Dimensions come from the matching `GalleryItem` (tenant-scoped).
- If no image is found, all four fields are cleared to their defaults.
- Publish is the only writer and the value is derived from the snapshot being published, so it cannot drift.
- There is no backfill. Already-published pages get a cover on their next publish, which is also when they first become listed.

**No backfill and no implicit listing (owner decision).** Portfolios already published when this ships must **not** appear on Discover on deploy. A workspace lists only after its owner has seen the toggle and saved or published with it on.

- `discover.listed` has three states. `undefined` means never decided, and Discover treats it as **not listed**. `true` and `false` are explicit choices.
- **No schema default.** A Mongoose default would be applied when an old document is hydrated, and could be persisted by an unrelated `.save()` elsewhere, silently listing the portfolio. The "on by default" behaviour lives in the UI only: both toggles initialise to `listed ?? true`.
- The query matches `discover.listed: true` strictly, never `$ne: false`.
- The confirmation rule compares the toggle against the **effective** saved state, which is `listed === true`. For example, an already-published portfolio whose owner opens settings sees the toggle ticked while the saved state is "not listed". If they click Save, the confirm modal fires: "Your portfolio will appear on Discover". The Publish dialog shows the same warning and the "Publish and list on Discover" label. This is the moment the owner consents.
- A never-published workspace shows the toggle ticked with no warning. Its first publish writes `listed: true` (or `false` if unticked) along with the publish.
- **Seed:** set `discover.listed` explicitly on seeded workspaces, with a mix of `true`, `false` and unset, so every state is exercised.
- **Call:** the dev seed adds about 10 clearly fictional, published, listed workspaces, using the mockup's sample names and brand kits. Without them the banner (which needs 8 or more listings) and the populated grid can't be verified. `seed.ts` refuses to run in production, so none of them can ship as fake customers.

- `listedAt` is set **once**: the first time a write makes the workspace both published and `listed: true`. It is never reset. Unlisting, unpublishing and re-listing keep the original time, so owners can't bump themselves to the top by toggling (**call**). It is the sort key ("newest on Discover first").
- Index: `{ "discover.listed": 1, "discover.listedAt": -1, _id: -1 }`.
  - Equality, then sort.
  - `publishedAt` and `noindex` are residual filters.
  - Add a comment explaining the cross-tenant exception, and a test in `lib/db/models/indexes.test.ts`.

### Write paths

1. **Settings Save (`updatePublicPageSettingsAction`):**
   - `discoverListed` is added to `publicPageSettingsSchema` and registered in the existing form, so the existing Save button covers it.
   - The action writes `discover.listed` **live-immediately**, the same way `inquiryRecipientEmail` already bypasses `settingsDraft`, and sets `discover.listedAt` per the rule above.
   - It is excluded from `computeHasPendingChanges`, so it never raises the "pending changes, publish to apply" banner.
   - Client side: on submit, if the page is published and `discoverListed` differs from the saved value, the confirm modal opens first. Confirm submits; Cancel leaves the form dirty with the toggle as the owner set it. If not published or not changed, it submits directly.
   - No Discover revalidation is needed, because Discover reads live (see Caching). The existing `revalidatePath("/settings/public-page")` stays.
2. **`publishDraftAction(id, opts?: { listed?: boolean })`**:
   - Accepts the dialog's toggle value and writes `discover.listed` (and `listedAt`) in the **same** `$set` as the publish, so one write covers both.
   - Validated with Zod.
   - Omitting `opts` leaves the listing unchanged. The settings-page Publish button omits it.
   - Always writes `discover.cover*` (see Data model), whatever `opts` contains.
3. Unpublish (`togglePublicPagePublishedAction(false)`) and the billing lifecycle wipe set `publishedAt = null`. The listing then drops automatically, and `discover.listed` is left alone, so republishing restores it.

### Read paths (`lib/db/queries/discover.ts`, new)

**`listDiscoverPortfolios({ cursor, category, q, limit })`** is an aggregation.

- **Match:**
  - `discover.listed: true` (strict; unset means not listed)
  - **Entitled accounts only (owner decision).** Lapsed free-month or Pro workspaces are hidden while gated, even though their public page stays live until the wipe. The match is a query-side mirror of `isEntitled` in `lib/billing/access.ts`, evaluated against the request time:
    - `lsSubscriptionId` set and `lsSubscriptionStatus` in active/trialing/past_due/paused
    - OR `canceled` with `lsCurrentPeriodEnd > now`
    - OR `planGrantExpiresAt > now`
    - OR `plan: "beta"` with no grant expiry

    A shared-fixture parity test keeps the mirror in lockstep with `isEntitled`, the same way `renderableBlocksAggExpr` is kept in sync. The owner's toggle is untouched, so paying again restores the listing automatically.
  - `publicPage.publishedAt != null`
  - `publicPage.seo.noindex != true`
  - `hasHome` is true, reusing `renderableBlocksAggExpr` from `publicPage.ts` so "Coming Soon" pages never list. It is not exported today and must be exported.
  - optional `businessType`
  - optional `q`: a case-insensitive escaped regex on `name`, max 60 chars. Acceptable at pre-launch scale; revisit with a text index if it grows.
- **Sort:** `listedAt desc, _id desc`. Cursor is `(listedAt, _id)`, using the existing `encodeCursor`/`decodeCursor` helpers. `limit` is clamped (default 24, max 48).
- **Projection whitelist, nothing else:**
  - `slug`, `name`, `businessType`, `country`, `discover.listedAt`
  - `discover.coverUrl`, `discover.coverWidth`, `discover.coverHeight`
  - `publicPage.seoDescription`, `publicPage.seo.ogImageUrl`
  - `publicPage.brandKit` (colors and heading font only)
  - The Puck `data` blob is never projected.
- **Tile kind:** a **cover** tile using `ogImageUrl`, else `discover.coverUrl`. Otherwise a **brand** tile rendered from the brand kit colors and heading font with the workspace name.
  - The tile's aspect ratio comes from the image's dimensions. The og image is 1200×630. A brand tile uses a fixed 4:5.
  - The mockup's "composite" (browser-frame) style is dropped.

**`getDiscoverPortfolio(slug)`** feeds the modal.

- Returns the same whitelist plus up to 5 images.
- Images are the og image first, then images the **published page actually renders**: assets and collections referenced in `publicPage.data.home` and `publicPage.data.gallery`, in page order. **Call:** `GalleryCollection.isPublic` is not a usable privacy signal, because it defaults to `true` and has no off control. Client-delivery sets would leak if the modal read collections directly. The builder extracts the references with the same walk that `reconcileGalleryImages` and `reconcileFeaturedCollections` use at publish, then fetches only those items, tenant-scoped. Items with `hideClient` never expose the client name, and only image URL, dimensions and alt text are returned.
- It is tenant-scoped once the slug resolves.
- **Pitch:** `seoDescription`, or the automatic description from `lib/portfolio/seoDefaults.ts` in the viewer's locale.
- **Location (owner decision):** the modal shows "Category · Country", with the country name from `Intl.DisplayNames` in the viewer's locale. No city field exists. `country` is in the whitelist; if it is null, only the category shows.
- **Category label:** from `businessType`. `other` gets no label.

### Routes and UI

**`app/[locale]/(marketing)/discover/page.tsx`**
- A server component that renders the first page.
- `?category=`, `?q=` and `?p=<slug>` are read from awaited `searchParams`. `p` server-renders the modal open, which makes deep links shareable.
- Gets metadata, hreflang and a sitemap entry.

**`GET /api/public/discover`** (load more) and **`GET /api/public/discover/[slug]`** (modal)
- Route handlers, Node runtime, Zod-validated query.
- Rate limited per the hardening checklist.
- Responses use `Cache-Control: no-store` (**call**). Stale data counts as class 1: an unlisted portfolio must vanish from load-more and the modal on the next request, never up to 60 seconds later through a CDN.

**Components** under `app/[locale]/(marketing)/discover/_components/`:
- `DiscoverGrid` (client: chips, search with debounce, load more)
- `DiscoverTile` (cover / brand kinds)
- `DiscoverDialog` (native `<dialog>`, @starting-style entrance, Esc and backdrop close, arrow keys RTL-aware, focus return, Copy link, Report)

**Modal images:** the left pane is the photo carousel only. "Visit portfolio" opens `portfolioPublicUrl(slug)` (`lib/portfolio/publicUrl.ts`, the subdomain in production) in a new tab with `rel="noopener"`. There is no iframe, so no framing or beacon changes are needed.

**Report:**
- **Call:** a `mailto:` link to the support address, with the slug prefilled in the subject. There is no in-app moderation queue in v1.

**Marketing banner:** `app/[locale]/(marketing)/_components/discover-banner.tsx`.
- A server component fetches up to 14 listings.
- It renders **nothing** when fewer than 8 portfolios are listed. **Call:** 8 is the minimum that fills three rows without obvious repetition.
- Placement: on the home page between the dark feature band and the brand CTA band. The builder confirms the visual fit.

**Header:** `marketing-header.tsx` is reordered as above, with a new `marketing.nav.discover` key. The `ENGLISH_NAV` fallback map also gains `discover`. **Call:** the Discover link always shows. Before launch the page shows its empty state ("No portfolios listed yet", with a Get started CTA).

**Settings → Public page (`_form.tsx`):**
- A switch row "List on Discover" in the Visibility section.
- Hint: "Show your published portfolio on the Gallurio Discover page."
- If `seo.noindex` is on, a note under it: "Hidden from Discover while search visibility is off."

**Publish dialog (`PublishDialog.tsx`):**
- New props `discoverListed` (saved value) and `isPublished`.
- A local switch, initialised from `discoverListed` each time the dialog opens.
- Warning block and button relabel as described above.
- `onConfirm(listed)` passes the value through to `publishDraftAction`.

**Fonts for brand tiles:**
- Reuse the public page's existing brand-font loading (see the `portfolio-theme-brand-kit` skill).
- Load only the fonts that the tiles currently on the page use. Fall back to the UI font if a font is unavailable.

### Caching

- **No cached Discover data (call).** Entitlement expires by the clock (`planGrantExpiresAt`, `lsCurrentPeriodEnd`), not by a write, so no revalidation hook can catch a lapse. Tag or path revalidation would leave a lapsed portfolio listed until the next unrelated write, which is a class-1 staleness defect.
- The `/discover` page and both API routes are rendered and served dynamically, and the query is the single source of truth.
- If the marketing home is statically rendered, the banner is a dynamic island: a `Suspense` boundary with a dynamic data fetch, so the rest of the home page keeps its caching. Its fallback is nothing, so there is no layout shift when it resolves to empty. The builder confirms how the home page is rendered today.
- Cost: one indexed query per Discover or home view. That is fine at pre-launch scale. If it ever matters, use a short server-side memo (seconds) keyed by query, never a CDN cache.

### i18n

New keys in all 5 locales:
- `marketing.nav.discover`
- `marketing.discover.*`: banner copy, page title and description, chips, search, states, modal labels, report subject
- `app.settings.publicPage.discover*`: toggle label, hint, noindex note, confirm modal copy
- `app.pageBuilder.editor.publishDialog.discover*`: toggle, warning titles and bodies, relabelled buttons

Category chip labels reuse the existing business-type label keys where present. `messages/encoding-sanity.test.ts` must stay green.

## Testing

- **Data layer:**
  - The listing filter excludes unpublished, wiped, noindex, "Coming Soon", gated (lapsed), `listed: false` **and unset** portfolios.
  - The entitlement match stays in parity with `isEntitled`, checked by a shared-fixture test.
  - A hydrated pre-existing workspace saved through an unrelated `.save()` path does not gain `discover.listed`.
  - The projection whitelist: a test asserts that private fields are absent from both query results.
  - Cursor pagination is stable across equal `listedAt`.
  - The category filter works.
  - `listedAt` set/keep rules.
  - The tile cover falls back in order: og image, then `discover.coverUrl`, then brand tile.
  - Publish writes `discover.cover*` from the first Home image, and clears it when there is none.
- **Actions:**
  - Owner-only.
  - `publishDraftAction` with and without `listed`.
  - The settings save writes `discover.listed` live, never into `settingsDraft`, and leaves pending-changes detection untouched.
- **Components:**
  - `PublishDialog`: no warning when never published; warning and relabel in both directions when published; the value passes through on confirm.
  - Settings: the confirm modal opens only when published and changed; Cancel keeps the form unsaved.
  - Header order.
  - Card overlay: present on hover and focus-visible, `aria-label` always set.
- **Routes:** validation, rate limit, 404 for an unlisted slug.
- **Batched Playwright run:**
  - The banner, `/discover` grid and modal, and the header at 375/768/1280 × 5 locales × light/dark.
  - The publish dialog and settings toggle at 1280px only, because that is in-app chrome.

## Left to the builder

- Exact banner placement on the home page, and whether the marketing home is statically rendered (which decides whether the banner needs a dynamic island).
- Rate-limit numbers, taken from existing public routes.
- Brand-tile font loading mechanics.
- Final copy polish within the meanings above.

## Docs hygiene

On completion, consolidate this spec and the plan into one `docs/modules/discover.md` summary, delete the scratch files, and register any reusable pieces in `REUSABLE_CODE.md`. The mockups in `docs/mockups/` stay until the feature ships.
