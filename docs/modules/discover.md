# Module: Discover

Public showcase of real portfolios built on Gallurio. Three parts: a banner on the marketing home page, a public `/discover` browse page with a detail modal, and an owner-facing "List on Discover" toggle. Visual references: `docs/mockups/discover-browse.html` and `docs/mockups/discover-marketing-section.html` (variant A).

## What it is

- **Banner** (`app/[locale]/(marketing)/_components/discover-banner.tsx`): copy and a "Browse portfolios" CTA beside three angled, drifting rows of decorative tiles. It has a pause button, pauses on hover, and degrades to static rows under reduced motion. It renders **nothing** below 8 listings.
- **`/discover`** (`app/[locale]/(marketing)/discover/`): search, category chips, a CSS-columns masonry of image-only cards (name and "Category · Country" appear on hover and `:focus-visible`; touch devices get no overlay), and load more. A card opens a native `<dialog>` modal (two panes on desktop, bottom sheet at 720px and below) with a photo carousel, pitch, "Visit portfolio" (`portfolioPublicUrl(slug)` in a new tab), Copy link, and Report (a `mailto:` to support with the slug in the subject, always English). `?category=`, `?q=` and `?p=<slug>` are read server-side, so filters and the open modal are deep-linkable.
- **Owner toggle**: "List on Discover" in Settings -> Public page (Visibility section) and in the Publish dialog. Shown ticked by default in the UI only.
- The marketing header also gained a Discover link (Resources and Compare left the header, not the footer).

## Data model (`Workspace.discover`)

```ts
discover: {
  listed:   Boolean,          // NO schema default
  listedAt: Date | null,
  coverUrl, coverAssetId: String, coverWidth, coverHeight: Number | null,
}
```

- **`listed` is tri-state.** `true` / `false` are explicit owner choices; **unset means never decided and is treated as not listed**. There is deliberately **no schema default and no backfill**: a default would be applied when an old document is hydrated and persisted by any unrelated `.save()`, silently listing a portfolio. The UI initialises both toggles to `listed ?? true`; the database is only written on an explicit save or publish. Queries match `listed: true` strictly, never `$ne: false`.
- **`listedAt` is set once**, by `listingSet(prev, next, now)` (`lib/discover/rules.ts`), the first time a write leaves the workspace both published and listed. It is never reset, so unlisting, unpublishing and re-listing cannot bump a portfolio to the top. It is the sort key. Writers: settings save, `publishDraftAction`, and `togglePublicPagePublishedAction(true)` (stamps a page that was listed while unpublished, or published through the settings Publish button with a saved `listed === true` but no `listedAt`).
- **`cover*`** is a denormalized fallback cover written **only** by `publishDraftAction`, in the same `$set` as the publish. It takes `firstHomeImage()` of the final published Home tree (render order, `backgroundImages` before `images`), with dimensions from the tenant-scoped `GalleryItem`; with no image all four fields are cleared. It exists so the directory query never reads `publicPage.data`.
- Unpublish and the billing lifecycle wipe set `publishedAt = null`; the listing drops automatically and `listed` is left alone, so republishing restores it.

## Listing filter

`listDiscoverPortfolios` and `getDiscoverPortfolio` share `listedMatch(now)` so a workspace is in the list iff it opens in the modal:

- `discover.listed === true`
- `publicPage.publishedAt != null`
- `publicPage.seo.noindex != true`
- `entitledMatch(now)` (`lib/discover/entitledMatch.ts`): a query-side mirror of `isEntitled` (`lib/billing/access.ts`): subscription id set with status active/trialing/past_due/paused, or `canceled` with `lsCurrentPeriodEnd > now`, or `planGrantExpiresAt > now`, or `plan: "beta"` with no grant expiry. Lapsed free-month and Pro workspaces are hidden while gated; the owner's toggle is untouched, so paying again restores the listing. A shared-fixture parity test keeps it in lockstep with `isEntitled`; change both together.
- Renderable Home: `renderableBlocksAggExpr("publicPage.data.home")` (same expression as the sitemap), so "Coming Soon" pages never list.

Optional filters: `businessType` (never `other`) and `q`, a trimmed, 60-char-capped, regex-escaped case-insensitive match on `name` (fine at pre-launch scale; add a text index if it grows). Sort `listedAt desc, _id desc`, keyset cursor `(listedAt, _id)`, limit default 24, max 48.

## Projection whitelist and the cross-tenant exception

Discover is a deliberate **cross-tenant public read**, the documented exception to "every query includes `workspaceId`" (like `listPublishedWorkspaceSlugs`). Safety comes from the filter above plus an absolute `$project` whitelist in `lib/db/queries/discover.ts` (`CARD_PROJECTION`): `slug`, `name`, `businessType`, `country`, `discover.{listedAt, coverUrl, coverWidth, coverHeight}`, `publicPage.seoDescription`, `publicPage.seo.ogImageUrl`, and the brand-kit colour/font fields. Never add `contact.*`, `ownerUserId`, `inquiryRecipientEmail` or anything a `hideClient` item could leak. The detail query additionally projects `publicPage.data.{home,gallery}` **only to pull ids out of it**; the tree never leaves the module.

Index: `{ "discover.listed": 1, "discover.listedAt": -1, _id: -1 }` (equality, then sort; `publishedAt`, `noindex`, entitlement are residual filters). It intentionally does **not** start with `workspaceId` because the scan spans tenants; every per-workspace follow-up read (items, collections) filters by `workspaceId`. Pinned in `lib/db/models/indexes.test.ts`.

## How previews are sourced

No screenshots and no server rendering; everything comes from what the owner already uploaded or configured.

- **Grid and banner tile**, first that exists: (1) the share image (`publicPage.seo.ogImageUrl`, 1200x630); (2) `discover.coverUrl` (first Home image; missing dimensions fall back to 4:5); (3) a **brand tile**: CSS-only card from the brand kit (bg/fg/accent via `resolveBrandKit`, heading font via `resolveEffectiveFonts`, the same resolution the live page uses) plus the business name at a fixed 4:5. A broken cover image falls back to the brand tile.
- **Modal images** (max 5): the share image first, then only images the **published page actually renders**: asset refs and collection refs walked out of `publicPage.data.home` then `.gallery` in page order (`collectBlocks`), capped at 25 refs. Collection refs resolve only through `GalleryCollection { workspaceId, isPublic: true }` (a published snapshot keeps refs to collections later made private), then `GalleryItem` by `workspaceId`. Only URL, dimensions and alt text are returned; client names are never exposed. There is no live-site iframe (prod portfolios live on their own subdomains and framing headers are not relaxed).
- **Pitch**: `seoDescription` (empty falls through to the automatic description in the UI). **Location**: `categoryLine()` -> "Category · Country", country via `Intl.DisplayNames` in the viewer's locale.

## Confirmation rules

Listing changes on a **live** page are always explicit; a never-published page toggles freely, with no warning, and the value takes effect on first publish.

- **Settings -> Save** (`settings/public-page/_form.tsx`): if the page is published and the toggle differs from the effective saved state (`listed === true`, unset counts as not listed), `DiscoverConfirmDialog` opens first (list / unlist copy). Confirm saves; Cancel leaves the form dirty. The action writes `discover.listed` live-immediately (like `inquiryRecipientEmail`), never into `settingsDraft`, and it is excluded from `computeHasPendingChanges`.
- **Publish dialog** (`PublishDialog.tsx`): no second modal, the dialog is the confirmation. When `isLive && listed !== savedListed` a full-width amber warning block (`aria-live="polite"`) appears above the footer and the primary button relabels to "Publish and list on Discover" / "Publish and remove from Discover". `onConfirm(listed)` -> `publishDraftAction(id, { listed })`; omitting `opts` (the settings Publish button) leaves the listing unchanged.
- **`isLive` gate**: `EditorShell` keeps a separate local `isLive` (seeded from `hasBeenPublished`, set true on publish success) passed to `PublishDialog` and used **only** for this warning, so a second in-session publish still warns. The pre-existing `hasBeenPublished` behaviour (slug editor) is untouched.
- Because an already-published portfolio shows the toggle ticked while its saved state is "not listed", the first save or publish after this shipped is the owner's consent moment.
- If `seo.noindex` is on, settings shows "Hidden from Discover while search visibility is off."

## Caching

**Nothing Discover reads is cached.** Entitlement expires by the clock (`planGrantExpiresAt`, `lsCurrentPeriodEnd`), not by a write, so no revalidation hook could catch a lapse; any tag/path cache would leave a lapsed or unlisted portfolio visible, a class-1 staleness defect.

- `/discover` is `force-dynamic`; both API routes are `force-dynamic` with `Cache-Control: no-store`.
- The marketing home page is ISR (`revalidate = 60`), so the banner is a **client island** that fetches `/api/public/discover?limit=14` on mount (`no-store`) and renders nothing until it has 8 or more items or on any failure. No layout shift when it resolves to empty. A server-fetched banner would freeze the listing for up to 60s.
- `/discover` is public in `proxy.ts` (it was initially gated behind sign-in, caught in browser verification) and is in the sitemap list. Cost is one indexed query per view; if it ever matters, use a seconds-long server memo keyed by query, never a CDN cache.

## Public API

- `GET /api/public/discover?category=&q=&cursor=&limit=` -> `{ items: DiscoverCard[], nextCursor }`.
- `GET /api/public/discover/[slug]` -> `DiscoverDetail` (card + `images`), 404 for any non-listed slug (no existence leak).
- Node runtime, Zod-validated query, generic error bodies (`invalid_query`, `not_found`, `rate_limited`, `server_error`), all `no-store`. Both routes share one per-IP bucket `discover:${ip}`: 120 requests per 60s, `429` with `Retry-After`. **Omit empty params**: an empty `category=` or `limit=` returns 400.

## Dev seed samples

`pnpm seed` (never runs in production) inserts 10 clearly fictional workspaces from `DISCOVER_SAMPLE_SEEDS` (`lib/db/seed-fixtures.ts`, slugs `sample-*`): published, entitled (beta, no expiry), renderable Home, `listedAt` staggered a day apart, covering all three tile kinds; one has `listed: false`. The expired-subscription seed workspace is `listed: true` to prove the entitlement filter hides it. Sample Home images use fake public ids, so their modal shows only the share image. Never ship fabricated customers.

## Known deferred items

- Brand-tile per-field colour fallback uses `DEFAULT_BRAND_KIT`, while the live page passes the stored kit through; a partly-empty kit can differ slightly.
- Documents with a null `listedAt` can be skipped by the cursor; unreachable today because publish/settings stamp `listedAt` for listed + published docs.
- `marketing.discover.*` messages ship to every marketing page via `clientMessages.ts`; a scoped provider would trim it.
- Dialog frame, empty-state box and error alert lack `rounded-[var(--radius-surface)]`.
- Reduced-motion banner rows are not keyboard-scrollable (decorative).
- Opening a card cancels a pending search debounce, so typed text may not filter until the next keystroke.
- Settings `savedListed` is not resynced on prop change; the read-then-write of the listing is not atomic (self-heals on the next publish).
- The local keyset-cursor encode/decode in `lib/db/queries/discover.ts` duplicates two other copies; logged as extraction candidate L-9 in `REUSABLE_CODE.md`.

## File map

| Area | Files |
| --- | --- |
| Model + index | `lib/db/models/Workspace.ts` (`discover` subdoc, index), `lib/db/models/indexes.test.ts` |
| Rules / helpers | `lib/discover/{rules,entitledMatch,firstHomeImage,labels}.ts` |
| Queries | `lib/db/queries/discover.ts` (`listDiscoverPortfolios`, `getDiscoverPortfolio`) |
| API | `app/api/public/discover/route.ts`, `app/api/public/discover/[slug]/route.ts` |
| Public UI | `app/[locale]/(marketing)/discover/page.tsx`, `.../discover/_components/{discover-grid,discover-tile,discover-dialog}.tsx` |
| Banner | `app/[locale]/(marketing)/_components/discover-banner.tsx`, mounted in `app/[locale]/(marketing)/page.tsx` |
| Write paths | `app/[locale]/(app)/settings/_actions.ts` (settings save, publish toggle), `app/[locale]/(app)/portfolio/_draftActions.ts` (`publishDraftAction`, cover) |
| Owner UI | `settings/public-page/{_form,discover-confirm}.tsx`, `portfolio/_components/{PublishDialog,EditorShell}.tsx` |
| Routing / SEO | `proxy.ts` (public path), `app/sitemap.ts` |
| Seed | `lib/db/seed.ts`, `lib/db/seed-fixtures.ts` |
| Copy | `marketing.nav.discover`, `marketing.discover.*`, `app.settings.publicPage.discover*`, `app.pageBuilder.editor.publishDialog.discover*` in all 5 locales |
