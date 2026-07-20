# Module: Portfolio Builder & Media

## Public portfolio

Exactly 3 public pages per workspace: Home, Gallery, Contact, served at `/w/[orgSlug]`. Source of truth is `Workspace.publicPage` (template id, `data.{home,gallery}`, `brandKit`, `savedThemes[]`, SEO fields, `formLocale`/`formDir`, per-section style overrides). A shared Puck config powers both the in-app editor and the public renderer — one block definition, two consumers. Do not add portfolio collections beyond Home/Gallery/Contact without explicit approval.

The page/canvas background is **never auto-adopted from the theme background** (`var(--pf-color-bg)`). It's painted only when an explicit page background (`_rootStyle.bgColorToken`) is set on the page root style — consistently across editor canvas, preview, and publish/public render.

Inquiry submission from the public Contact page is a **single transaction**: creates `Inquiry` + `Client` + a draft `Booking` together, or fails atomically.

## Workspace-level settings buffer (`publicPage.settingsDraft`)

Branding/SEO entered outside the block editor — the first-visit story-prompt dialog (`completeStoryPromptAction`) and the `settings/public-page` Save action — lands on **`Workspace.publicPage.settingsDraft`**, a workspace-owned buffer that is independent of whichever `PortfolioDraft` is active. The story prompt no longer resolves/creates a `PortfolioDraft` (that draft-creation side effect used to fabricate a blank draft on every first visit and corrupt the new-user check). `settingsDraft` holds `seoDescription`, `seo.keywords`, `seo.ogImage{Url,AssetId}`, `siteIcon.{url,assetId}`, and `logo.{url,assetId}`; it is promoted onto the live `publicPage` (logo → `publicPage.header`) only on **Publish**.

- **Workspace logo**: editable from `settings/public-page` (stored on `publicPage.settingsDraft.logo`, promoted to `publicPage.header` on publish). Publish propagates *and* clears the staged header logo independently of the draft's `doc.header`, so a null/migrated draft header can't skip the promotion and strand the live logo.

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
