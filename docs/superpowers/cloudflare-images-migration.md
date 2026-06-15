# Plan: Migrate Gallurio Images from Cloudinary to Cloudflare Images

## Summary

Move Gallurio from Cloudinary to **Cloudflare Images hosted storage**, using **Direct Creator Upload** for browser uploads and **flexible variants** for delivery so current gallery/carousel sizing behavior survives with minimal rendering churn.

**Provider rationale**: Cloudflare Images at $5/100k images/month is materially cheaper than Cloudinary for Gallurio's upload-heavy SaaS workload. No CDN or transform costs on top.

**Branch**: `migrate/cloudflare-images`, based on the latest `dev` (`8de49df`). `dev` is now the canonical, up-to-date branch — it already includes the merged `fix/portfolio-maker` work (PR #24), so this plan targets `dev`, not any `fix/*` branch.

---

## Current Cloudinary surface area (as of latest `dev`, `8de49df`)

### Packages
- `cloudinary` SDK (`lib/storage/cloudinary.ts`) — server-only
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` — client env var for URL building

### Storage layer (`lib/storage/`)
| File | Role |
|------|------|
| `lib/storage/cloudinary.ts` | Config, `signUpload()`, `workspaceFolder()`, `cloudinaryThumbnailUrl()`, `destroyAsset()` |
| `lib/storage/uploadToCloudinary.client.ts` | Browser direct-upload: fetches sign → POSTs to Cloudinary |

### API routes
| Route | What changes |
|-------|-------------|
| `app/api/uploads/sign/route.ts` | Issues Cloudinary signed params → replaced by `/api/images/direct-upload` |
| `app/api/portfolio/gallery/items/route.ts` | Accepts `cloudinaryPublicId`; validates via folder prefix check |
| `app/api/portfolio/gallery/items/delete/route.ts` | Calls `destroyAsset()` after DB delete |
| `app/api/portfolio/gallery/route.ts` | No direct Cloudinary call; calls queries that emit `publicId` |
| `app/api/portfolio/gallery/collections/[id]/route.ts` | Via gallery queries |

### Data model
| Model | Fields | Index |
|-------|--------|-------|
| `GalleryItem` | `cloudinaryPublicId: String (required)` | `{ workspaceId, cloudinaryPublicId }` for ref-count |
| `Workspace` | `logoCloudinaryPublicId`, header `logoPublicId` | — |

### Query helpers (`lib/db/queries/gallery.ts`)
All functions use `cloudinaryPublicId` as the asset identity key:
- `listCollectionsForPicker` — cover thumbnail via `cloudinaryThumbnailUrl(coverPublicId)`
- `listItemsForPicker` — maps `cloudinaryPublicId` → `publicId` on `PickerItem`
- `listAllItemsPage` — **groups/deduplicates by `cloudinaryPublicId`** (copy semantics)
- `listCollectionItemsPage` / `listCollectionNewest` — emit `publicId` from `cloudinaryPublicId`
- `listPublicCollectionItemsPage` — emits `publicId` from `cloudinaryPublicId`
- `countItemsByPublicId(workspaceId, cloudinaryPublicId)` — ref-count
- `deleteItemsByPublicId` — collects `cloudinaryPublicId[]` for remote delete
- `copyItemsIntoCollection` — deduplicates by `cloudinaryPublicId`
- `detachItemsFromCollection` — ref-counts by `cloudinaryPublicId`

### Page-builder layer
| File | Cloudinary usage |
|------|-----------------|
| `lib/page-builder/cloudinaryClient.ts` | `cloudinaryImageUrl(publicId, {width,height,crop})` — client-safe URL builder |
| `lib/page-builder/blocks/GalleryGridBlock.tsx` | Calls `cloudinaryImageUrl` |
| `lib/page-builder/blocks/GalleryMasonryBlock.tsx` | Calls `cloudinaryImageUrl` |
| `lib/page-builder/blocks/GalleryCarouselBlock.tsx` | Calls `cloudinaryImageUrl` |
| `lib/page-builder/blocks/FeaturedWorkBlock.tsx` | Calls `cloudinaryImageUrl` |
| `lib/page-builder/blocks/CollectionPopup.tsx` | Calls `cloudinaryImageUrl` |
| `lib/page-builder/styleToolkit.ts` | Background image URLs via `cloudinaryImageUrl` |
| `lib/page-builder/galleryPicker/MediaPicker.tsx` | Imports `uploadImageToCloudinary` |
| `lib/page-builder/galleryPicker/CreateCollectionDialog.tsx` | Upload on collection create |
| `lib/page-builder/galleryPicker/EditCollectionDialog.tsx` | Upload on collection edit |
| `lib/page-builder/reconcile.ts` | May reference `publicId` shape |

### Settings / onboarding flows
| File | Usage |
|------|-------|
| `app/[locale]/(app)/settings/_actions.ts` | `updateWorkspaceBrandingAction` saves `logoCloudinaryPublicId` |
| `app/[locale]/(app)/settings/account/_panel.tsx` | Avatar upload via Cloudinary |
| `app/[locale]/(app)/settings/workspace/_branding-form.tsx` | Logo upload → `uploadToCloudinary()` |
| `app/[locale]/(onboarding)/onboarding/branding/branding-form.tsx` | Onboarding logo via Cloudinary |

### Config / env
- `next.config.ts` — `remotePatterns: [{ hostname: "res.cloudinary.com" }]`
- Env: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`

---

## Provider choice

| Decision | Choice |
|----------|--------|
| Storage | Cloudflare Images hosted (not R2/BYO) |
| Upload method | **Direct Creator Upload** — server returns one-time `uploadURL`; browser POSTs directly |
| Resizing | **Flexible variants** enabled account-wide (`/w=N,h=M,fit=cover/` URL params) |
| Delivery | `imagedelivery.net/<accountHash>/<imageId>/<variant>` |
| Ownership | **Metadata verification** — server reads Cloudflare image record, checks `metadata.workspaceId` before persisting |
| Fallback | None — hard cutover; dev data is discardable |

---

## Implementation plan

### Phase 1 — Storage abstraction (no DB changes yet)

**1.1 New env vars** (add to `.env.local` and docs):
```
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_IMAGES_API_TOKEN=     # Images:Edit scope
CLOUDFLARE_IMAGES_ACCOUNT_HASH=  # for imagedelivery.net URL generation
```

**1.2 Create `lib/storage/cloudflareImages.ts`** (server-only):
```
- cfFetch(path, init) — wraps fetch to Cloudflare Images API with Bearer token
- requestDirectUpload(workspaceId, subfolder): Promise<{ imageId, uploadURL }>
  - POST /accounts/{id}/images/v2/direct_upload
  - body: metadata = { workspaceId, subfolder }, requireSignedURLs=false
  - returns one-time { id (imageId), uploadURL }
- verifyImageOwnership(imageId, workspaceId): Promise<boolean>
  - GET /accounts/{id}/images/v1/{imageId}
  - checks metadata.workspaceId === workspaceId AND draft === false
- deleteImage(imageId): Promise<void>
  - DELETE /accounts/{id}/images/v1/{imageId}
- imageDeliveryUrl(imageId, opts?: { width?, height?, fit? }): string
  - returns https://imagedelivery.net/{accountHash}/{imageId}/w={w},h={h},fit={fit}
  - or /public for no transform
```

**1.3 Create `lib/storage/imageDelivery.client.ts`** (client-safe, no SDK import):
```
- imageDeliveryUrl(imageId, opts): string
  - reads NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH
  - same URL formula as server version
  - maps crop "fill" → "cover", "limit" → "scale-down"
```

**1.4 Create `lib/storage/uploadImage.client.ts`** (replaces `uploadToCloudinary.client.ts`):
```
- uploadImage(file, opts): Promise<UploadedImage>
  - validates file via validatePhotoFile / validatePhotoDimensions (same as before)
  - POST /api/images/direct-upload { subfolder }
  - receives { imageId, uploadURL }
  - POST file to uploadURL (multipart)
  - returns { assetId: imageId, url: imageDeliveryUrl(imageId), width?, height?, format?, sizeBytes? }
```
UploadedImage shape:
```typescript
export type UploadedImage = {
  assetId: string;        // was cloudinaryPublicId
  url: string;
  width?: number;
  height?: number;
  format?: string;
  sizeBytes?: number;
};
```

**1.5 Replace `app/api/uploads/sign/route.ts`** with **`app/api/images/direct-upload/route.ts`**:
```
POST — requireOrg({ allowDuringOnboarding: true })
body: { subfolder?: string }  (same schema as before)
calls requestDirectUpload(workspaceId, subfolder)
returns { imageId, uploadURL }
```

---

### Phase 2 — Data model rename

**2.1 `lib/db/models/GalleryItem.ts`**:
- Rename `cloudinaryPublicId` → `assetId` (String, required)
- Add `assetProvider: { type: String, enum: ["cloudflare"], default: "cloudflare" }`
- Rename index: `{ workspaceId: 1, cloudinaryPublicId: 1 }` → `{ workspaceId: 1, assetId: 1 }`
- Keep all other fields unchanged (`url`, `width`, `height`, `format`, `sizeBytes`, `caption`, `altText`, `order`, `tags`)

**2.2 `lib/db/models/Workspace.ts`** (branding fields):
- Rename `logoCloudinaryPublicId` → `logoAssetId`
- Rename header `logoPublicId` → `headerLogoAssetId` (or confirm exact current field name first)
- Add `assetProvider: "cloudflare"` alongside or embed in branding sub-doc

**2.3 DB migration note**: Existing dev data can be dropped and re-seeded. No live migration needed for v1. Document this in migration notes.

---

### Phase 3 — Query layer update (`lib/db/queries/gallery.ts`)

Every reference to `cloudinaryPublicId` becomes `assetId`. Key call-by-call changes:

| Function | Change |
|----------|--------|
| `GalleryBlockItem` type | `cloudinaryPublicId` → `assetId` |
| `ITEM_PROJECTION` | `cloudinaryPublicId: 1` → `assetId: 1` |
| `listCollectionsForPicker` | `coverPublicId` is still the local var name (fine), but read from `c.assetId`; call `imageDeliveryUrl(coverPublicId, {width:240,height:240})` |
| `listItemsForPicker` | `publicId: it.assetId`, `thumbUrl: imageDeliveryUrl(it.assetId, ...)` |
| `listAllItemsPage` | `$group: { _id: "$assetId" }` — dedup still by asset identity |
| `listCollectionItemsPage` | `.select({ assetId:1, ... })`, `toPickerItem` reads `assetId` |
| `listPublicCollectionItemsPage` | `publicId: d.assetId` |
| `countItemsByPublicId` | rename fn to `countItemsByAssetId(workspaceId, assetId)` |
| `deleteItemsByPublicId` | rename to `deleteItemsByAssetId`; `publicIds` → `assetIds` |
| `copyItemsIntoCollection` | dedup Set uses `assetId`; copied doc uses `assetId` |
| `detachItemsFromCollection` | ref-count query uses `assetId` |
| `toPickerItem` helper | `publicId: it.assetId ?? ""` |

`PickerItem.publicId` field name stays as-is (it is the picker's internal representation, already provider-neutral in the UI layer).

---

### Phase 4 — API route updates

**4.1 `app/api/portfolio/gallery/items/route.ts`**:
- Body schema: `assetId: z.string().min(1).max(300)` (was `cloudinaryPublicId`)
- Replace folder-prefix ownership check with:
  ```ts
  const owned = await verifyImageOwnership(parsed.data.assetId, workspaceId.toString());
  if (!owned) return NextResponse.json({ error: "invalid_image_ownership" }, { status: 400 });
  ```
- Persist `assetId` instead of `cloudinaryPublicId`
- Thumbnail URL: `imageDeliveryUrl(parsed.data.assetId, { width: 200, height: 200 })`

**4.2 `app/api/portfolio/gallery/items/delete/route.ts`**:
- Call `deleteItemsByAssetId(...)` (renamed query)
- Call `deleteImage(assetId)` from `lib/storage/cloudflareImages.ts` instead of `destroyAsset`

**4.3 `app/api/portfolio/gallery/collections/[id]/route.ts`**:
- Update any reference to `cloudinaryPublicId` in collection cover logic

---

### Phase 5 — Page-builder layer

**5.1 Rename `lib/page-builder/cloudinaryClient.ts`** → `lib/page-builder/imageDeliveryClient.ts`**:
- Replace `cloudinaryImageUrl(publicId, {width,height,crop})` with `imageDeliveryUrl(assetId, {width,height,fit})`
- Map crop values: `"fill"` → `"cover"`, `"limit"` → `"scale-down"`, `"fit"` → `"contain"`
- Read `NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH` (no more `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`)

**5.2 Gallery blocks** (update import and call site only — prop shapes unchanged):
- `GalleryGridBlock.tsx` — import `imageDeliveryUrl` from `imageDeliveryClient`, update `GalleryImage.publicId` → remains `publicId` (PickerItem stays neutral); the `cloudinaryImageUrl` call → `imageDeliveryUrl`
- `GalleryMasonryBlock.tsx` — same
- `GalleryCarouselBlock.tsx` — same
- `FeaturedWorkBlock.tsx` — same
- `CollectionPopup.tsx` — same

**5.3 `lib/page-builder/styleToolkit.ts`**:
- Background image URL calls: `cloudinaryImageUrl` → `imageDeliveryUrl`

**5.4 `lib/page-builder/galleryPicker/MediaPicker.tsx`**:
- Import `uploadImage` from `lib/storage/uploadImage.client` (was `uploadImageToCloudinary`)
- `UploadedImage.assetId` is returned; pass to gallery item create route as `assetId`

**5.5 `CreateCollectionDialog.tsx` / `EditCollectionDialog.tsx`**:
- Same upload import swap; use `assetId` in payload

**5.6 `lib/page-builder/reconcile.ts`**:
- Audit for any `cloudinaryPublicId` / `publicId` mapping logic and update

---

### Phase 6 — Settings & onboarding flows

**6.1 `app/[locale]/(app)/settings/workspace/_branding-form.tsx`**:
- Replace `uploadToCloudinary(file, ...)` with `uploadImage(file, { subfolder: "branding" })`
- State: `logoAssetId` (was `logoPublicId` / `logoCloudinaryPublicId`)
- Submitted field: `logoAssetId`

**6.2 `app/[locale]/(app)/settings/_actions.ts`**:
- Accept `logoAssetId` in branding action
- Persist to `Workspace.logoAssetId`
- Call `deleteImage(oldLogoAssetId)` when replacing logo

**6.3 `app/[locale]/(app)/settings/account/_panel.tsx`**:
- Avatar upload → `uploadImage`, store `assetId`

**6.4 Onboarding branding form**:
- Same pattern: `uploadImage`, `assetId`

---

### Phase 7 — Config & cleanup

**7.1 `next.config.ts`**:
- Replace `res.cloudinary.com` remote pattern with `imagedelivery.net`

**7.2 `lib/storage/cloudinary.ts`** — **delete file** (after all call sites removed)

**7.3 `lib/storage/uploadToCloudinary.client.ts`** — **delete file**

**7.4 `lib/page-builder/cloudinaryClient.ts`** — **delete file** (after rename to `imageDeliveryClient`)

**7.5 `package.json`** — remove `cloudinary` dependency

**7.6 Env cleanup**:
- Remove `CLOUDINARY_*` and `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- Add new Cloudflare env vars to `.env.example` / docs

---

### Phase 8 — Seeds

**`lib/db/seed.ts` / `lib/db/seed-portfolio.ts`**:
- Replace seeded Cloudinary URLs/publicIds with Cloudflare imagedelivery.net URLs or placeholder `assetId` strings
- Remove any `cloudinary` import from seed files

---

## Ownership / tenancy model (replacing prefix check)

Current: `cloudinaryPublicId.startsWith("gallurio/${workspaceId}/")` — checked in gallery items POST.

New flow:
1. Browser calls `POST /api/images/direct-upload { subfolder }` → server embeds `metadata.workspaceId` when requesting the Cloudflare upload URL
2. Browser uploads directly to Cloudflare one-time URL
3. Browser calls `POST /api/portfolio/gallery/items { assetId, url, width, height, ... }`
4. Server calls `verifyImageOwnership(assetId, workspaceId)`:
   - fetches `GET /accounts/{id}/images/v1/{assetId}`
   - checks `metadata.workspaceId === workspaceId`
   - checks `draft === false` (upload completed)
5. Only if ownership verified → persist `GalleryItem`

This closes the old cross-tenant attack vector where a crafted `publicId` could bypass the prefix check.

---

## Cloudflare flexible variant URL format

```
https://imagedelivery.net/{accountHash}/{imageId}/w={w},h={h},fit={fit},q=85,f=auto
```

Supported `fit` values: `scale-down` | `contain` | `cover` | `crop` | `pad`

Mapping from Cloudinary semantics:
| Cloudinary crop | Cloudflare fit |
|-----------------|---------------|
| `fill` | `cover` |
| `limit` | `scale-down` |
| `fit` | `contain` |

---

## Test plan

### Storage / upload
- [ ] `POST /api/images/direct-upload` returns `{ imageId, uploadURL }` scoped to workspace
- [ ] Request embeds `metadata.workspaceId` in Cloudflare API call
- [ ] `uploadImage` client helper POSTs to `uploadURL` and returns `UploadedImage` with `assetId`
- [ ] `deleteImage` calls Cloudflare delete API; surfaced failures do not swallow errors

### Tenancy / security
- [ ] Gallery item create rejects `assetId` whose Cloudflare metadata `workspaceId` ≠ active workspace
- [ ] Draft / unfinished upload `assetId` is rejected
- [ ] Cross-tenant crafted `assetId` cannot attach another workspace's image
- [ ] Delete paths only operate on records scoped by `workspaceId`
- [ ] `verifyImageOwnership` is called before every `GalleryItem` creation

### Rendering / delivery
- [ ] `imageDeliveryUrl` produces correct `imagedelivery.net` URLs for all gallery block sizes
- [ ] `fill` maps to `fit=cover`, `limit` maps to `fit=scale-down`
- [ ] All 5 gallery blocks render via new helper; no `cloudinaryImageUrl` import remains
- [ ] `styleToolkit.ts` background URLs use new helper
- [ ] Client bundle contains no server-only imports (no `cloudinary` SDK in client chunks)

### Functional regression
- [ ] Onboarding branding upload saves `logoAssetId` correctly
- [ ] Settings logo upload/replace/remove works end-to-end
- [ ] Settings avatar upload works
- [ ] Gallery item upload via MediaPicker stores `assetId`
- [ ] Collection create/edit with cover image upload works
- [ ] Gallery item delete destroys Cloudflare asset and DB doc
- [ ] Copy-into-collection deduplicates by `assetId`
- [ ] `listAllItemsPage` dedup groups correctly by `assetId`

### Final gates
- [ ] All affected tests pass
- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint` clean
- [ ] `pnpm build` succeeds
- [ ] No `cloudinary` import anywhere in non-test source

---

## New env vars

```bash
# Cloudflare Images
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_IMAGES_API_TOKEN=          # scope: Images:Edit
CLOUDFLARE_IMAGES_ACCOUNT_HASH=       # used in imagedelivery.net URLs
NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH=   # same value, exposed to client for URL building
```

Remove:
```bash
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
```

---

## Cloudflare docs reference
- Direct Creator Upload: https://developers.cloudflare.com/images/upload-images/direct-creator-upload/
- Upload methods: https://developers.cloudflare.com/images/upload-images/
- Flexible variants: https://developers.cloudflare.com/images/transform-images/flexible-variants/
- Image delivery URL: https://developers.cloudflare.com/images/manage-images/serve-images/

---

## Operator setup — getting Cloudflare Images running (your steps)

Prerequisite: a Cloudflare account with the **Images** product enabled (≈ $5 / 100k images stored + $1 / 100k delivered — confirm current pricing in dashboard).

1. **Enable Cloudflare Images**: Dashboard → Images → enable/subscribe on the account.
2. **Collect three values:**
   - **Account ID** — Dashboard right sidebar "Account ID" → `CLOUDFLARE_ACCOUNT_ID`
   - **Images Account Hash** — Dashboard → Images → any image's "Public URL" looks like `imagedelivery.net/<hash>/...`; `<hash>` is the account hash → `CLOUDFLARE_IMAGES_ACCOUNT_HASH` **and** `NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH` (same value)
   - **API token** — Dashboard → My Profile → API Tokens → Create Token → Create Custom Token. Permissions: **Account → Cloudflare Images → Edit**. Account Resources: include your specific account. Create → copy once → `CLOUDFLARE_IMAGES_API_TOKEN`
3. **Enable flexible variants (REQUIRED).** Without this, inline `.../w=400,h=300,fit=cover` delivery URLs return **404**:
   ```bash
   curl -X PATCH "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/images/v1/config" \
     -H "Authorization: Bearer $CLOUDFLARE_IMAGES_API_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"flexible_variants": true}'
   ```
   Expect `"success": true`. (Verify endpoint against current Cloudflare docs.)
4. **Smoke-test the token (optional):**
   ```bash
   curl -X POST "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/images/v2/direct_upload" \
     -H "Authorization: Bearer $CLOUDFLARE_IMAGES_API_TOKEN" \
     -F 'requireSignedURLs=false' -F 'metadata={"workspaceId":"test"}'
   ```
   Should return `result.id` + `result.uploadURL`.
5. **Local env (`.env.local`):**
   ```bash
   CLOUDFLARE_ACCOUNT_ID=...
   CLOUDFLARE_IMAGES_API_TOKEN=...        # Images:Edit scope
   CLOUDFLARE_IMAGES_ACCOUNT_HASH=...     # server-side URL building
   NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH=... # same hash, exposed to client
   ```
   Remove: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`.
6. **Deployment env (Vercel):** add the same four vars to **Preview + Production** (`vercel env add` or dashboard); remove the four `CLOUDINARY_*` vars. `NEXT_PUBLIC_*` must be present at build time.
7. **After cutover:** re-seed dev data (`pnpm seed`) — old Cloudinary publicIds won't resolve.

Notes:
- The API token is account-scoped and **never** reaches the browser; only the account hash is public (it's already in delivery URLs).
- `requireSignedURLs` stays `false` for v1 (portfolio images are public). Turning it on later means signing delivery URLs — out of scope.

---

## Corrections & amendments (apply before/while implementing)

The "Current Cloudinary surface area" section was verified accurate against `dev` (field names, the `gallurio/${workspaceId}/` prefix check, query functions, blocks, WorkOS auth, `[locale]` routes). The Cloudflare-side design is sound in shape; the items below must be corrected for it to work and be safe.

**Correctness**
1. **`draft` check is wrong.** Cloudflare *removes* the `draft` field once upload completes (it does not set it to `false`). Use `!image.draft`, not `draft === false`, in `verifyImageOwnership`. Add a short retry/backoff (e.g. 3 tries × 250ms) — right after the client's upload POST the GET may still show draft (eventual consistency).
2. **Dimensions are not returned by Cloudflare.** Neither the upload response nor the image object includes `width/height/format/size`. These currently come from Cloudinary and drive masonry/grid aspect ratios. Capture them **client-side** in `uploadImage` from the `File` (`validatePhotoDimensions` already loads the image, so width/height are available) and send them in the gallery-items POST. Treat `width`/`height` as **required** where layout depends on them, not optional.
3. **Confirm metadata field name.** The v1 image GET may return custom metadata under `meta` (not `metadata`). Log one raw GET response and use the actual key before relying on `metadata.workspaceId`.
4. **URL option names are fine.** `w/h/q/f` are valid aliases of `width/height/quality/format`; `fit` has no alias. Valid `fit`: `scale-down, contain, cover, crop, aspect-crop, pad, squeeze`.

**Security**
5. **`verifyImageOwnership` must guard every client-supplied `assetId`**, not just gallery items. Phase 6 (logo, avatar, onboarding logo) and collection covers (`CreateCollectionDialog`/`EditCollectionDialog`) all accept an `assetId` from the browser; without the check a user can attach another workspace's image as their logo/avatar/cover. Add the check to: settings branding action, avatar persist, onboarding branding persist, and collection-cover persist.
6. **Preserve ref-count gating on delete.** Copy-into-collection dedups by `assetId`, so one asset can back multiple `GalleryItem`s. Phase 4.2 must only call `deleteImage(assetId)` when `countItemsByAssetId(workspaceId, assetId) === 0` after the DB delete — exactly how `destroyAsset` is gated today. Do not drop that guard.

**Completeness**
7. **Budget for test churn.** `CLOUDINARY` appears in ~41 files and `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` in ~27 — many are tests/mocks/fixtures. Add an explicit step to replace the cloudinary test double with a cloudflare one and update fixtures.
8. **Audit non-listed consumers.** Grep gate should also catch OG/social meta image URLs, sitemap/RSS, email templates, and docs (`RELEASE-CHECKLIST.md`, design/plan files) that hardcode `res.cloudinary.com` or `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`.
9. **Onboarding upload needs a workspaceId.** The direct-upload route uses `requireOrg({ allowDuringOnboarding: true })`; confirm the workspace exists at the branding step so `metadata.workspaceId` can be embedded.

**Operational**
10. **Hard cutover is safe (confirmed).** Active development is on `dev` only; `prod`/`staging`/`fix/*` are foundation branches with no real data entered (confirmed by operator, 2026-06-15). No live Cloudinary assets exist anywhere, so drop-and-re-seed of `dev` is sufficient — no `publicId→assetId` data migration is needed. Re-confirm before any future production go-live.
11. **Bulk-upload cost/latency.** `verifyImageOwnership` adds one GET per created item; a multi-file upload = N GETs against Images API rate limits. Fine for v1; if it bites, correlate the create with the just-minted upload instead of re-fetching.
12. **`next/image` double-optimization.** If any `next/image` usage remains (logo/avatar), serving `imagedelivery.net` through Vercel's optimizer pays twice. The `remotePatterns` swap is still correct; consider a custom loader or `unoptimized` for imagedelivery URLs.

(End of appended content.)
