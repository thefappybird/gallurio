# Module: Portfolio Builder & Media

## Public portfolio

Exactly 3 public pages per workspace: Home, Gallery, Contact, served at `/w/[orgSlug]`. Source of truth is `Workspace.publicPage` (template id, `data.{home,gallery}`, `brandKit`, `savedThemes[]`, SEO fields, `formLocale`/`formDir`, per-section style overrides). A shared Puck config powers both the in-app editor and the public renderer — one block definition, two consumers. Do not add portfolio collections beyond Home/Gallery/Contact without explicit approval.

Inquiry submission from the public Contact page is a **single transaction**: creates `Inquiry` + `Client` + a draft `Booking` together, or fails atomically.

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
- Store the asset id + provider (`GalleryItem.assetId`, `assetProvider: "cloudflare"`) and the delivery `url`; thumbnails are URL variants via `imageDeliveryUrl()`. Delete the remote asset (`deleteImage`) whenever the owning document is deleted — never leave orphaned remote images. Format/size limits are enforced app-side (`lib/page-builder/photoSpec.ts`).
