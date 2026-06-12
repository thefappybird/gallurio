# Gallery Blocks — Baked Images Data Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the three gallery blocks (Grid / Masonry / Carousel) from `collectionId`-pointer async server components into isomorphic, client-safe components that render purely from a baked `images: GalleryImage[]` prop — enabling true WYSIWYG editor previews and fetch-free public rendering — and add a server-side `reconcileGalleryImages` helper wired into editor-load (in-memory) and publish (persisted).

**Architecture:** A new client-safe Cloudinary URL builder (`cloudinaryImageUrl`) lets blocks synthesize thumbnail URLs in the browser. The three blocks become pure functions of `{ images, presentation props }` (no DB, no `getRenderWorkspaceFrom`, no `listItemsForBlock`). `reconcileGalleryImages(workspaceId, puckData)` walks the Puck tree, batch-fetches every gallery block's `images[].id` in ONE `$in` query scoped by `workspaceId`, and rebuilds each block's `images[]` (refresh publicId/alt, prune deleted, preserve order, never add). The editor keeps its existing StyleToolkitField tab UX: gallery editing routes through `StyleToolkitField` Content/Layout tabs (CollectionPicker → `MultiImageControl`), `editorConfig` configs render the REAL block components and `resolveFields`-strip to `_style`.

**Tech Stack:** Next.js 16 (App Router, Node runtime), React 19, Mongoose 8, Puck (`@measured/puck`), Vitest + Testing Library + `mongodb-memory-server` (happy-dom). pnpm. Windows PowerShell.

---

## Key facts established from the codebase (read before starting)

- **Server-only Cloudinary** (`lib/storage/cloudinary.ts:68`): `cloudinaryThumbnailUrl(publicId, { width?, height?, crop?:"fill"|"fit"|"limit" })` imports the cloudinary Node SDK and reads `process.env.CLOUDINARY_CLOUD_NAME`. Transform string is `c_${crop},w_${width},h_${height},q_auto,f_auto`; returns `https://res.cloudinary.com/${cloud}/image/upload/${transform}/${publicId}` (or `""` when no cloud name). **Never import in client code.**
- **Client-safe URL already exists inline** (`lib/page-builder/blocks/manualBlocks.tsx:29`): `cloudinaryUrl(publicId, w=1200)` using `process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` → `.../image/upload/c_limit,w_${w},q_auto,f_auto/${publicId}`. `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` is confirmed configured (also used by `lib/page-builder/styleToolkit.ts`).
- **Current gallery blocks** (`lib/page-builder/blocks/GalleryGridBlock.tsx`, `GalleryMasonryBlock.tsx`, `GalleryCarouselBlock.tsx`) are `async` server components. Props today: Grid/Masonry `{ _style?, collectionId, columns:2|3|4, gap:"tight"|"normal"|"loose", maxItems }`; Carousel `{ _style?, heading, description, collectionId, aspect:"square"|"landscape"|"portrait", floatX, floatY, overlayAlign?, autoplay, maxItems }`. They register configs as `render: X as any` because they are async.
- **Carousel client island** (`lib/page-builder/blocks/GalleryCarouselClient.tsx`): `GalleryCarouselClient({ slides: CarouselSlide[], aspect, autoplay, labels:{hint,prev,next} })`; `type CarouselSlide = { id, src, alt }`. Unchanged by this plan.
- **GalleryHeader** (`lib/page-builder/blocks/GalleryText.tsx`): `GalleryHeader({ heading?, description?, align?, overlay? })` — server-safe (no "use client"), pure. Reusable in the now-client carousel.
- **Chrome labels** (`lib/page-builder/serverContext.tsx:179`): `getGalleryChromeLabelsFrom(puck)` is a PURE prop read (`puck?.metadata?.workspace?.chrome?.gallery`) with English fallbacks — **client-safe**, so the now-client Masonry/Carousel can keep calling it. `getRenderWorkspaceFrom` (line 174) also reads `puck.metadata` but falls back to `AsyncLocalStorage` (`node:async_hooks`) — **server-only via the ALS import**, so blocks must STOP importing it.
- **Puck data shape** (`lib/validators/publicPage.ts:132` `puckDataSchema`): `{ root?: { props? }, content: Array<{ type: string; props: Record<string,unknown> }>, zones?: Record<string, Array<{ type, props }>> }`. Permissive on props.
- **Editor load** (`app/[locale]/(app)/portfolio/page.tsx`): resolves `{ workspace, role } = await requireOrg()`; builds `initialData = { home: toPlain<PuckData>(homeData, EMPTY_ZONE), gallery: toPlain<PuckData>(galleryData, EMPTY_ZONE) }`; passes to `<EditorShell initialData={initialData} />`. Owner-gated already. No write on GET. `PuckData` type from `@/lib/page-builder/types`.
- **Publish** (`app/[locale]/(app)/portfolio/_actions.ts:73` `publishPortfolioAction`): owner-only; today does `Workspace.updateOne({_id}, {$set:{ "publicPage.publishedAt": now, "publicPage.lastPublishedAt": now }})` then `revalidatePath` x3. Draft save lives at line 40 (`savePortfolioDraftAction`) — does NOT revalidate.
- **`listItemsForBlock`** (`lib/db/queries/gallery.ts:51`): consumed ONLY by `GalleryMasonryBlock.tsx`, `GalleryCarouselBlock.tsx`, and its own `gallery.test.ts`. Grid uses `GalleryItem.find` directly. After this plan **no production consumer remains** → retire it + its tests. `getItemsByIds` (line 90, used by FeaturedWork) and the picker helpers stay.
- **GalleryItem fields**: `cloudinaryPublicId`, `url`, `caption`, `altText`, `order`, `width`, `height`, `collectionId (default null)`, `timestamps:true`. Indexes incl. `{ workspaceId }` and `{ workspaceId, collectionId, order }`.
- **editorConfig** (`lib/page-builder/editorConfig.tsx`): inlined `galleryGridDefaultProps`/`galleryMasonryDefaultProps`/`galleryCarouselDefaultProps` (lines 50-52, with `collectionId`/`maxItems`); `imagesField(label,{max?})` factory ALREADY EXISTS (line 265, currently `// eslint-disable no-unused-vars`); `collectionField()` (line 279) + `GalleryCollectionPreview` (line 182) + `useCollectionName` (line 176) used only by the three gallery configs (lines 414-552). `MultiImageControl`/`MediaPickerSelection` already imported (lines 30-31).
- **StyleToolkitField** (`lib/page-builder/StyleToolkitField.tsx`): `COLLECTION_GALLERY_BLOCKS = new Set(["GalleryGrid","GalleryMasonry","GalleryCarousel"])` (line 98). Content panel renders `<CollectionPicker value={props.collectionId} onChange={setProp("collectionId")} />` (lines 352-355). `GalleryLayoutControls` renders a `<NumberInputRow label="Max items" .../>` (lines 934-941). `SingleImageControl` imported (line 46). `MultiImageControl` is NOT yet imported here.
- **config.ts** (`lib/page-builder/config.ts`): imports `galleryGridBlockConfig` etc. (lines 19-21) and registers them (lines 107-109). Once blocks are sync, the `as any` casts inside those configs are dropped (config.ts itself unchanged).
- **Tests use** in-memory mongo (`@/test-utils/mongo`: `startInMemoryMongo`/`stopInMemoryMongo`/`clearCollections`); `runWithRenderWorkspace` for block render tests; `vi.mock("@/lib/storage/cloudinary", ...)` to stub the URL. `gallery.test.ts` has `makeCollection(workspaceId, {isPublic?,slug?})` and `seedItems(workspaceId, collectionId, count, startOrder=0)` helpers.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `lib/page-builder/cloudinaryClient.ts` | Create | Client-safe `cloudinaryImageUrl(publicId, { width, height?, crop? })` (NEXT_PUBLIC, no SDK). |
| `lib/page-builder/cloudinaryClient.test.ts` | Create | URL shape, missing cloud/publicId → "", crop/height defaults. |
| `lib/page-builder/blocks/manualBlocks.tsx` | Modify | Replace inline `cloudinaryUrl` with the shared util (DRY). |
| `lib/page-builder/reconcile.ts` | Create | `reconcileGalleryImages(workspaceId, data)` — batched refresh/prune/order. |
| `lib/page-builder/reconcile.test.ts` | Create | Refresh / prune / order / never-add / single-query / tenant-isolation / empty no-op. |
| `lib/page-builder/blocks/GalleryGridBlock.tsx` | Rewrite | Isomorphic; renders from `images[]`. |
| `lib/page-builder/blocks/GalleryGridBlock.test.tsx` | Rewrite | New props shape; client-safe. |
| `lib/page-builder/blocks/GalleryMasonryBlock.tsx` | Rewrite | Isomorphic; renders from `images[]`; keeps chrome labels. |
| `lib/page-builder/blocks/GalleryMasonryBlock.test.tsx` | Rewrite | New props shape. |
| `lib/page-builder/blocks/GalleryCarouselBlock.tsx` | Rewrite | Isomorphic; maps `images[]`→`CarouselSlide[]`. |
| `lib/page-builder/blocks/GalleryCarouselBlock.test.tsx` | Rewrite | New props shape; slides mapping. |
| `lib/page-builder/editorConfig.tsx` | Modify | Real block render for the 3 configs; new defaultProps; drop preview/collectionField. |
| `lib/page-builder/StyleToolkitField.tsx` | Modify | Content panel CollectionPicker → `MultiImageControl`; remove Max items control. |
| `lib/page-builder/blockShapes.test.tsx` | Modify | Assert `images` not `collectionId`. |
| `lib/page-builder/blocks/sectionPresets.test.tsx` | Modify | New shape (if any gallery assertion). |
| `lib/page-builder/templates/_blocks.ts` | Modify | Gallery factories default `images: []`; drop `collectionId`/`maxItems`. |
| `app/[locale]/(app)/portfolio/page.tsx` | Modify | Reconcile both zones in-memory before `<EditorShell>`. |
| `app/[locale]/(app)/portfolio/_actions.ts` | Modify | `publishPortfolioAction` persists reconciled zones before publishedAt. |
| `app/[locale]/(app)/portfolio/_actions.test.ts` | Create/Modify | Publish persists reconciled + publishedAt + owner-only. |
| `lib/db/queries/gallery.ts` | Modify | Retire `listItemsForBlock` (no consumers). |
| `lib/db/queries/gallery.test.ts` | Modify | Drop `listItemsForBlock` tests. |
| `lib/page-builder/seedPortfolio.ts` | Modify | Retire gallery `collectionId` auto-fill. |

---

## Task 1: Shared client-safe Cloudinary URL util

**Files:**
- Create: `lib/page-builder/cloudinaryClient.ts`
- Test: `lib/page-builder/cloudinaryClient.test.ts`
- Modify: `lib/page-builder/blocks/manualBlocks.tsx`

- [ ] **Step 1: Write the failing tests**

Create `lib/page-builder/cloudinaryClient.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cloudinaryImageUrl } from "./cloudinaryClient";

const OLD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

beforeEach(() => {
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "test-cloud";
});
afterEach(() => {
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = OLD;
});

describe("cloudinaryImageUrl", () => {
  it("builds a fill URL with width+height (mirrors server cloudinaryThumbnailUrl)", () => {
    expect(cloudinaryImageUrl("ws/1/item0", { width: 600, height: 600 })).toBe(
      "https://res.cloudinary.com/test-cloud/image/upload/c_fill,w_600,h_600,q_auto,f_auto/ws/1/item0"
    );
  });

  it("defaults height to width and crop to fill", () => {
    expect(cloudinaryImageUrl("p", { width: 400 })).toBe(
      "https://res.cloudinary.com/test-cloud/image/upload/c_fill,w_400,h_400,q_auto,f_auto/p"
    );
  });

  it("honours an explicit crop (limit)", () => {
    expect(cloudinaryImageUrl("p", { width: 800, height: 1600, crop: "limit" })).toBe(
      "https://res.cloudinary.com/test-cloud/image/upload/c_limit,w_800,h_1600,q_auto,f_auto/p"
    );
  });

  it("returns empty string when publicId is missing", () => {
    expect(cloudinaryImageUrl("", { width: 400 })).toBe("");
  });

  it("returns empty string when the cloud name env is unset", () => {
    delete process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    expect(cloudinaryImageUrl("p", { width: 400 })).toBe("");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test --run lib/page-builder/cloudinaryClient.test.ts`
Expected: FAIL — `cloudinaryClient` module does not exist.

- [ ] **Step 3: Implement the util**

Create `lib/page-builder/cloudinaryClient.ts`:

```ts
/**
 * Client-safe Cloudinary delivery URL builder.
 *
 * Mirrors the server `cloudinaryThumbnailUrl` (lib/storage/cloudinary.ts) transform
 * EXACTLY (`c_${crop},w_${w},h_${h},q_auto,f_auto`) so a block rendered on the
 * server (SSR of a client component) and the same block rendered on the editor
 * canvas produce identical URLs. Reads only the PUBLIC cloud name — NO cloudinary
 * Node SDK import, NO server-only env — so it is safe in the client bundle.
 */
export function cloudinaryImageUrl(
  publicId: string,
  opts: { width: number; height?: number; crop?: "fill" | "fit" | "limit" }
): string {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloud || !publicId) return "";
  const width = opts.width;
  const height = opts.height ?? width;
  const crop = opts.crop ?? "fill";
  const transform = `c_${crop},w_${width},h_${height},q_auto,f_auto`;
  return `https://res.cloudinary.com/${cloud}/image/upload/${transform}/${publicId}`;
}
```

- [ ] **Step 4: Refactor manualBlocks to use the shared util (DRY)**

In `lib/page-builder/blocks/manualBlocks.tsx`, replace the inline helper (lines ~28-33):

```tsx
// Client-safe Cloudinary delivery URL (PUBLIC cloud name only — no server SDK).
function cloudinaryUrl(publicId: string, w = 1200): string | null {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloud || !publicId) return null;
  return `https://res.cloudinary.com/${cloud}/image/upload/c_limit,w_${w},q_auto,f_auto/${publicId}`;
}
```

with an import + a thin wrapper that preserves the existing `c_limit` behaviour and the `string | null` contract its call sites rely on (`cloudinaryUrl(...) || imageUrl`):

```tsx
import { cloudinaryImageUrl } from "@/lib/page-builder/cloudinaryClient";

// Client-safe Cloudinary delivery URL. `c_limit` keeps the image within `w` while
// preserving aspect ratio (height matches width as the bound). Returns null when
// unavailable so existing `cloudinaryUrl(...) || imageUrl` fallbacks still work.
function cloudinaryUrl(publicId: string, w = 1200): string | null {
  return cloudinaryImageUrl(publicId, { width: w, crop: "limit" }) || null;
}
```

> Note: the original `c_limit,w_${w}` had NO `h_`; the shared util always emits `h_`. `c_limit` only ever downscales to fit within the box, so adding `h_${w}` (a square upper bound ≥ the width bound for landscape/portrait within a square) changes nothing visually for the manual Image/Container backgrounds. Keep the wrapper. (If a reviewer objects, the manual blocks may instead pass an explicit large height; the visual result is identical because `c_limit` never upscales.)

- [ ] **Step 5: Run tests + existing manualBlocks tests to verify they pass**

Run: `pnpm test --run lib/page-builder/cloudinaryClient.test.ts lib/page-builder/blocks/manualBlocks.test.tsx`
Expected: PASS (new util tests + unchanged manualBlocks tests).

- [ ] **Step 6: Commit**

```powershell
git add lib/page-builder/cloudinaryClient.ts lib/page-builder/cloudinaryClient.test.ts lib/page-builder/blocks/manualBlocks.tsx
git commit -m "feat(portfolio): shared client-safe cloudinary URL util"
```

---

## Task 2: `reconcileGalleryImages` helper

**Files:**
- Create: `lib/page-builder/reconcile.ts`
- Test: `lib/page-builder/reconcile.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/page-builder/reconcile.test.ts`:

```ts
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryItem } from "@/lib/db/models/GalleryItem";
import { reconcileGalleryImages } from "./reconcile";
import type { PuckData } from "@/lib/page-builder/types";

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
afterEach(async () => {
  await clearCollections();
});

async function makeItem(workspaceId: Types.ObjectId, i: number, over: Record<string, unknown> = {}) {
  return GalleryItem.create({
    workspaceId,
    collectionId: null,
    cloudinaryPublicId: `ws/${workspaceId}/item${i}`,
    url: `https://x/${i}.jpg`,
    altText: `Alt ${i}`,
    caption: `Cap ${i}`,
    order: i,
    ...over,
  });
}

function gridBlock(images: Array<{ id: string; publicId: string; alt?: string }>): { type: string; props: Record<string, unknown> } {
  return { type: "GalleryGrid", props: { id: "g1", images, columns: 3, gap: "normal" } };
}

describe("reconcileGalleryImages", () => {
  it("refreshes publicId + alt from the current GalleryItem (stale cache rebuilt)", async () => {
    const ws = new Types.ObjectId();
    const it = await makeItem(ws, 0);
    const data: PuckData = {
      root: {},
      content: [gridBlock([{ id: String(it._id), publicId: "STALE", alt: "stale" }])],
    };
    const out = await reconcileGalleryImages(ws.toString(), data);
    const images = (out.content[0].props.images as Array<{ id: string; publicId: string; alt: string }>);
    expect(images).toEqual([{ id: String(it._id), publicId: `ws/${ws}/item0`, alt: "Alt 0" }]);
  });

  it("falls back alt to caption then empty string", async () => {
    const ws = new Types.ObjectId();
    const noAlt = await makeItem(ws, 1, { altText: "" });
    const noText = await makeItem(ws, 2, { altText: "", caption: "" });
    const data: PuckData = {
      root: {},
      content: [gridBlock([
        { id: String(noAlt._id), publicId: "x" },
        { id: String(noText._id), publicId: "x" },
      ])],
    };
    const out = await reconcileGalleryImages(ws.toString(), data);
    const images = out.content[0].props.images as Array<{ alt: string }>;
    expect(images[0].alt).toBe("Cap 1");
    expect(images[1].alt).toBe("");
  });

  it("prunes ids whose item no longer exists; preserves stored order; never adds", async () => {
    const ws = new Types.ObjectId();
    const a = await makeItem(ws, 0);
    const b = await makeItem(ws, 1);
    const c = await makeItem(ws, 2);
    const missing = new Types.ObjectId().toString();
    // stored order: c, missing, a  → expect c, a (missing dropped, b never added)
    const data: PuckData = {
      root: {},
      content: [gridBlock([
        { id: String(c._id), publicId: "x" },
        { id: missing, publicId: "x" },
        { id: String(a._id), publicId: "x" },
      ])],
    };
    const out = await reconcileGalleryImages(ws.toString(), data);
    const ids = (out.content[0].props.images as Array<{ id: string }>).map((i) => i.id);
    expect(ids).toEqual([String(c._id), String(a._id)]);
    expect(ids).not.toContain(String(b._id));
  });

  it("prunes a foreign-workspace id (tenant isolation)", async () => {
    const wsA = new Types.ObjectId();
    const wsB = new Types.ObjectId();
    const foreign = await makeItem(wsB, 0);
    const mine = await makeItem(wsA, 0);
    const data: PuckData = {
      root: {},
      content: [gridBlock([
        { id: String(foreign._id), publicId: "x" },
        { id: String(mine._id), publicId: "x" },
      ])],
    };
    const out = await reconcileGalleryImages(wsA.toString(), data);
    const ids = (out.content[0].props.images as Array<{ id: string }>).map((i) => i.id);
    expect(ids).toEqual([String(mine._id)]);
  });

  it("collects ids across all gallery blocks AND zones with a SINGLE query (no N+1)", async () => {
    const ws = new Types.ObjectId();
    const a = await makeItem(ws, 0);
    const b = await makeItem(ws, 1);
    const findSpy = vi.spyOn(GalleryItem, "find");
    const data: PuckData = {
      root: {},
      content: [
        { type: "GalleryGrid", props: { id: "g1", images: [{ id: String(a._id), publicId: "x" }], columns: 3, gap: "normal" } },
        { type: "Heading", props: { id: "h1", text: "x", level: "h2" } },
      ],
      zones: {
        "g1:content": [
          { type: "GalleryCarousel", props: { id: "c1", images: [{ id: String(b._id), publicId: "x" }], heading: "", description: "", aspect: "landscape", floatX: "center", floatY: "center", autoplay: false } },
        ],
      },
    };
    const out = await reconcileGalleryImages(ws.toString(), data);
    expect(findSpy).toHaveBeenCalledTimes(1);
    expect((out.content[0].props.images as unknown[]).length).toBe(1);
    expect((out.zones!["g1:content"][0].props.images as unknown[]).length).toBe(1);
    findSpy.mockRestore();
  });

  it("is a no-op (no query) when there are no gallery blocks", async () => {
    const ws = new Types.ObjectId();
    const findSpy = vi.spyOn(GalleryItem, "find");
    const data: PuckData = { root: {}, content: [{ type: "Heading", props: { id: "h1", text: "x", level: "h2" } }] };
    const out = await reconcileGalleryImages(ws.toString(), data);
    expect(findSpy).not.toHaveBeenCalled();
    expect(out).toEqual(data);
    findSpy.mockRestore();
  });

  it("treats a missing/empty images[] as empty (no throw)", async () => {
    const ws = new Types.ObjectId();
    const data: PuckData = {
      root: {},
      content: [{ type: "GalleryMasonry", props: { id: "m1", columns: 3, gap: "normal" } }],
    };
    const out = await reconcileGalleryImages(ws.toString(), data);
    expect(out.content[0].props.images).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test --run lib/page-builder/reconcile.test.ts`
Expected: FAIL — `reconcile` module does not exist.

- [ ] **Step 3: Implement the helper**

Create `lib/page-builder/reconcile.ts`:

```ts
import "server-only";

import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { GalleryItem } from "@/lib/db/models/GalleryItem";
import type { PuckData } from "@/lib/page-builder/types";

/** Block types whose `images[]` cache is reconciled against live GalleryItems. */
const GALLERY_BLOCK_TYPES = new Set(["GalleryGrid", "GalleryMasonry", "GalleryCarousel"]);

type StoredImage = { id?: unknown; publicId?: unknown; alt?: unknown };
type PuckBlock = { type: string; props: Record<string, unknown> };

/** All block arrays in a Puck data tree: root content + every zone/slot array. */
function blockArrays(data: PuckData): PuckBlock[][] {
  const arrays: PuckBlock[][] = [];
  if (Array.isArray(data.content)) arrays.push(data.content as unknown as PuckBlock[]);
  const zones = (data as { zones?: Record<string, unknown> }).zones;
  if (zones) {
    for (const key of Object.keys(zones)) {
      const arr = zones[key];
      if (Array.isArray(arr)) arrays.push(arr as PuckBlock[]);
    }
  }
  return arrays;
}

function storedImagesOf(block: PuckBlock): StoredImage[] {
  const imgs = block.props?.images;
  return Array.isArray(imgs) ? (imgs as StoredImage[]) : [];
}

function validId(id: unknown): id is string {
  return typeof id === "string" && Types.ObjectId.isValid(id);
}

/**
 * Rebuilds every gallery block's `images[]` from the live GalleryItem documents.
 *
 * - ONE batched query: `GalleryItem.find({ workspaceId, _id: { $in: allIds } })`
 *   (no N+1). `workspaceId` comes from the CALLER's session — never Puck props —
 *   so foreign ids resolve to nothing and are pruned (tenant-safe).
 * - For each stored id still present: emit `{ id, publicId: cloudinaryPublicId,
 *   alt: altText || caption || "" }`. Refreshes a changed publicId/alt.
 * - Drops ids whose item no longer exists. Preserves the stored order. NEVER adds.
 * - No-op (and no DB call) when the tree has no gallery blocks.
 *
 * Pure transform over the fetched map — returns a NEW data object; does not mutate
 * the input.
 */
export async function reconcileGalleryImages(workspaceId: string, data: PuckData): Promise<PuckData> {
  if (!workspaceId || !data) return data;

  const arrays = blockArrays(data);

  // 1. Collect every gallery block's image ids across all blocks + zones.
  const allIds = new Set<string>();
  let hasGalleryBlock = false;
  for (const arr of arrays) {
    for (const block of arr) {
      if (!GALLERY_BLOCK_TYPES.has(block.type)) continue;
      hasGalleryBlock = true;
      for (const img of storedImagesOf(block)) {
        if (validId(img.id)) allIds.add(img.id);
      }
    }
  }
  if (!hasGalleryBlock) return data;

  // 2. ONE batched, tenant-scoped query.
  const map = new Map<string, { publicId: string; alt: string }>();
  if (allIds.size > 0) {
    await connectDB();
    const docs = (await GalleryItem.find({ workspaceId, _id: { $in: [...allIds] } })
      .select({ cloudinaryPublicId: 1, altText: 1, caption: 1 })
      .lean()) as Array<{ _id: unknown; cloudinaryPublicId?: string; altText?: string; caption?: string }>;
    for (const d of docs) {
      map.set(String(d._id), {
        publicId: d.cloudinaryPublicId ?? "",
        alt: d.altText || d.caption || "",
      });
    }
  }

  // 3. Rebuild each gallery block's images[], preserving order, pruning misses.
  const rebuildBlock = (block: PuckBlock): PuckBlock => {
    if (!GALLERY_BLOCK_TYPES.has(block.type)) return block;
    const next: Array<{ id: string; publicId: string; alt: string }> = [];
    for (const img of storedImagesOf(block)) {
      if (!validId(img.id)) continue;
      const live = map.get(img.id);
      if (!live) continue; // pruned
      next.push({ id: img.id, publicId: live.publicId, alt: live.alt });
    }
    return { ...block, props: { ...block.props, images: next } };
  };

  const nextData: PuckData = {
    ...data,
    content: (data.content as unknown as PuckBlock[]).map(rebuildBlock) as unknown as PuckData["content"],
  };

  const zones = (data as { zones?: Record<string, PuckBlock[]> }).zones;
  if (zones) {
    const nextZones: Record<string, PuckBlock[]> = {};
    for (const key of Object.keys(zones)) {
      nextZones[key] = Array.isArray(zones[key]) ? zones[key].map(rebuildBlock) : zones[key];
    }
    (nextData as { zones?: Record<string, PuckBlock[]> }).zones = nextZones;
  }

  return nextData;
}
```

> If `PuckData` from `@/lib/page-builder/types` does not type `zones`, the `as { zones?: ... }` casts above keep this compiling. Confirm the `PuckData` shape on first typecheck; the casts are defensive and required because the reconcile walks an optional `zones` map that the editor type may not surface.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test --run lib/page-builder/reconcile.test.ts`
Expected: PASS (all 7 cases).

- [ ] **Step 5: Commit**

```powershell
git add lib/page-builder/reconcile.ts lib/page-builder/reconcile.test.ts
git commit -m "feat(portfolio): reconcileGalleryImages cache rebuild helper"
```

---

## Task 3: Isomorphic GalleryGridBlock

**Files:**
- Rewrite: `lib/page-builder/blocks/GalleryGridBlock.tsx`
- Rewrite: `lib/page-builder/blocks/GalleryGridBlock.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace the ENTIRE contents of `lib/page-builder/blocks/GalleryGridBlock.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { GalleryGridBlock, galleryGridDefaultProps } from "./GalleryGridBlock";
import type { GalleryGridProps, GalleryImage } from "./GalleryGridBlock";
import { puckConfig } from "@/lib/page-builder/config";

const OLD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
beforeEach(() => {
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "test-cloud";
});
afterEach(() => {
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = OLD;
});

function imgs(n: number): GalleryImage[] {
  return Array.from({ length: n }, (_, i) => ({ id: `id${i}`, publicId: `pid${i}`, alt: `Alt ${i}` }));
}

const base: GalleryGridProps = { ...galleryGridDefaultProps };

describe("GalleryGridBlock — isomorphic render", () => {
  it("is a synchronous (non-async) component", () => {
    const out = GalleryGridBlock({ ...base, images: imgs(2) });
    expect(out).not.toBeInstanceOf(Promise);
  });

  it("renders one <img> per image with a client cloudinary URL + alt", () => {
    const { container } = render(GalleryGridBlock({ ...base, images: imgs(3) }));
    const els = container.querySelectorAll("img");
    expect(els.length).toBe(3);
    expect(els[0].getAttribute("src")).toContain("res.cloudinary.com/test-cloud/image/upload/");
    expect(els[0].getAttribute("src")).toContain("/pid0");
    expect(els[0].getAttribute("alt")).toBe("Alt 0");
  });

  it("renders the empty state when images is empty", () => {
    render(GalleryGridBlock({ ...base, images: [] }));
    expect(screen.getByText(/no photos selected yet/i)).toBeInTheDocument();
    expect(document.querySelector("[data-block='gallery-grid'][data-empty='true']")).toBeInTheDocument();
  });

  it.each([2, 3, 4] as const)("columns=%i sets grid-template-columns", (cols) => {
    const { container } = render(GalleryGridBlock({ ...base, images: imgs(2), columns: cols }));
    const grid = container.querySelector("[data-block='gallery-grid'] > div > div") as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe(`repeat(${cols}, 1fr)`);
  });

  it("applies the gap value", () => {
    const { container } = render(GalleryGridBlock({ ...base, images: imgs(1), gap: "loose" }));
    const grid = container.querySelector("[data-block='gallery-grid'] > div > div") as HTMLElement;
    expect(grid.style.gap).toBe("16px");
  });

  it("does not import server-only cloudinary (no SDK access in client bundle)", () => {
    // The block must NOT call the server cloudinaryThumbnailUrl; this test renders
    // without any vi.mock of @/lib/storage/cloudinary and still produces URLs.
    const { container } = render(GalleryGridBlock({ ...base, images: imgs(1) }));
    expect(container.querySelector("img")?.getAttribute("src")).toContain("test-cloud");
  });

  it("registers default props with images:[] and no collectionId/maxItems", () => {
    expect(galleryGridDefaultProps.images).toEqual([]);
    expect(galleryGridDefaultProps).not.toHaveProperty("collectionId");
    expect(galleryGridDefaultProps).not.toHaveProperty("maxItems");
    expect(puckConfig.components.GalleryGrid.defaultProps).toHaveProperty("images");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test --run lib/page-builder/blocks/GalleryGridBlock.test.tsx`
Expected: FAIL — block is still async / still has `collectionId`; `GalleryImage` not exported.

- [ ] **Step 3: Rewrite the block**

Replace the ENTIRE contents of `lib/page-builder/blocks/GalleryGridBlock.tsx`:

```tsx
/**
 * GalleryGridBlock — ISOMORPHIC (client-safe) responsive thumbnail grid.
 *
 * Renders purely from its own `images[]` prop (baked by the editor's multi-image
 * picker and refreshed by reconcileGalleryImages on editor-load / publish). No DB
 * access, no server context, no server-only Cloudinary import — so the SAME
 * component renders in the editor canvas AND on the public page (WYSIWYG,
 * fetch-free).
 *
 * All branding via `--pf-*` CSS variables. No `rounded-*` Tailwind classes.
 */

import type { ComponentConfig, Field } from "@measured/puck";
import { cloudinaryImageUrl } from "@/lib/page-builder/cloudinaryClient";
import {
  resolveBlockStyle,
  resolveBlockAttrs,
  productionStyleField,
  type BlockStyle,
} from "@/lib/page-builder/styleToolkit";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type GalleryImage = { id: string; publicId: string; alt?: string };

export type GalleryGridProps = {
  _style?: BlockStyle;
  images: GalleryImage[];
  columns: 2 | 3 | 4;
  gap: "tight" | "normal" | "loose";
};

export const galleryGridDefaultProps: GalleryGridProps = {
  images: [],
  columns: 3,
  gap: "normal",
};

const GAP_MAP: Record<GalleryGridProps["gap"], string> = {
  tight: "4px",
  normal: "8px",
  loose: "16px",
};

const THUMB_WIDTH_MAP: Record<GalleryGridProps["columns"], number> = {
  2: 800,
  3: 600,
  4: 400,
};

export function GalleryGridBlock({ _style, images, columns, gap }: GalleryGridProps) {
  const gapValue = GAP_MAP[gap] ?? "8px";
  const thumbWidth = THUMB_WIDTH_MAP[columns] ?? 600;
  const list = Array.isArray(images) ? images : [];

  if (list.length === 0) {
    return <GalleryEmptyState message="No photos selected yet." />;
  }

  return (
    <section
      data-block="gallery-grid"
      style={{
        backgroundColor: "var(--pf-color-bg)",
        padding: "4rem 1.5rem",
        fontFamily: "var(--pf-font-body)",
        ...resolveBlockStyle(_style),
      }}
      {...resolveBlockAttrs(_style)}
    >
      <div style={{ maxWidth: "80rem", margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: gapValue,
          }}
        >
          {list.map((img) => {
            const src = cloudinaryImageUrl(img.publicId, {
              width: thumbWidth,
              height: thumbWidth,
              crop: "fill",
            });
            return (
              <figure key={img.id} style={{ margin: 0, padding: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={img.alt ?? ""}
                  loading="lazy"
                  style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }}
                />
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function GalleryEmptyState({ message }: { message: string }) {
  return (
    <section
      data-block="gallery-grid"
      data-empty="true"
      style={{
        backgroundColor: "var(--pf-color-bg)",
        padding: "4rem 1.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <p
        style={{
          fontFamily: "var(--pf-font-body)",
          color: "var(--pf-color-fg)",
          opacity: 0.45,
          fontSize: "0.9375rem",
          margin: 0,
        }}
      >
        {message}
      </p>
    </section>
  );
}

export const galleryGridBlockConfig: ComponentConfig<GalleryGridProps> = {
  label: "Gallery Grid",
  defaultProps: galleryGridDefaultProps,
  fields: {
    _style: productionStyleField,
    columns: {
      type: "select",
      label: "Columns",
      options: [
        { label: "2 columns", value: 2 },
        { label: "3 columns", value: 3 },
        { label: "4 columns", value: 4 },
      ],
    } as Field<2 | 3 | 4>,
    gap: {
      type: "select",
      label: "Gap between images",
      options: [
        { label: "Tight (4px)", value: "tight" },
        { label: "Normal (8px)", value: "normal" },
        { label: "Loose (16px)", value: "loose" },
      ],
    },
  },
  render: GalleryGridBlock,
};
```

> The `images` field is intentionally absent from the production `fields` map — the editor drives it through `StyleToolkitField` (Task 7). Production `<Render>` reads `images` straight from saved props; it does not need a sidebar field. Removing the `as any` cast is the point: the component is now sync.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test --run lib/page-builder/blocks/GalleryGridBlock.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/page-builder/blocks/GalleryGridBlock.tsx lib/page-builder/blocks/GalleryGridBlock.test.tsx
git commit -m "feat(portfolio): isomorphic GalleryGrid block renders from images[]"
```

---

## Task 4: Isomorphic GalleryMasonryBlock

**Files:**
- Rewrite: `lib/page-builder/blocks/GalleryMasonryBlock.tsx`
- Rewrite: `lib/page-builder/blocks/GalleryMasonryBlock.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace the ENTIRE contents of `lib/page-builder/blocks/GalleryMasonryBlock.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { GalleryMasonryBlock, galleryMasonryDefaultProps } from "./GalleryMasonryBlock";
import type { GalleryMasonryProps } from "./GalleryMasonryBlock";
import type { GalleryImage } from "./GalleryGridBlock";
import { puckConfig } from "@/lib/page-builder/config";

const OLD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
beforeEach(() => {
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "test-cloud";
});
afterEach(() => {
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = OLD;
});

function imgs(n: number): GalleryImage[] {
  return Array.from({ length: n }, (_, i) => ({ id: `id${i}`, publicId: `pid${i}`, alt: `Alt ${i}` }));
}

const base: GalleryMasonryProps = { ...galleryMasonryDefaultProps };

describe("GalleryMasonryBlock — isomorphic render", () => {
  it("is synchronous", () => {
    expect(GalleryMasonryBlock({ ...base, images: imgs(1) })).not.toBeInstanceOf(Promise);
  });

  it("renders one <img> per image", () => {
    const { container } = render(GalleryMasonryBlock({ ...base, images: imgs(4) }));
    expect(container.querySelectorAll("img").length).toBe(4);
  });

  it("sets columnCount from the columns prop", () => {
    const { container } = render(GalleryMasonryBlock({ ...base, images: imgs(2), columns: 4 }));
    const col = container.querySelector(".pf-masonry") as HTMLElement;
    expect(col.style.columnCount).toBe("4");
  });

  it("renders the empty state (default English label) when images is empty", () => {
    render(GalleryMasonryBlock({ ...base, images: [] }));
    expect(screen.getByText(/no photos in this collection yet/i)).toBeInTheDocument();
    expect(document.querySelector("[data-block='gallery-masonry'][data-empty='true']")).toBeInTheDocument();
  });

  it("uses a localized empty label from puck.metadata chrome when present", () => {
    render(
      GalleryMasonryBlock({
        ...base,
        images: [],
        // @ts-expect-error puck is injected at runtime by Puck
        puck: { metadata: { workspace: { _id: "x", name: "x", chrome: { gallery: { empty: "Walang larawan" } } } } },
      })
    );
    expect(screen.getByText(/walang larawan/i)).toBeInTheDocument();
  });

  it("registers default props with images:[] and no collectionId/maxItems", () => {
    expect(galleryMasonryDefaultProps.images).toEqual([]);
    expect(galleryMasonryDefaultProps).not.toHaveProperty("collectionId");
    expect(galleryMasonryDefaultProps).not.toHaveProperty("maxItems");
    expect(puckConfig.components.GalleryMasonry.defaultProps).toHaveProperty("images");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test --run lib/page-builder/blocks/GalleryMasonryBlock.test.tsx`
Expected: FAIL — old async/collectionId shape.

- [ ] **Step 3: Rewrite the block**

Replace the ENTIRE contents of `lib/page-builder/blocks/GalleryMasonryBlock.tsx`:

```tsx
/**
 * GalleryMasonryBlock — ISOMORPHIC (client-safe) CSS column-count masonry layout.
 *
 * Renders from its own `images[]` prop (no DB, no server context, no server-only
 * Cloudinary import). Empty-state copy is read from `puck.metadata` chrome via
 * getGalleryChromeLabelsFrom (a pure, client-safe prop read) so a localized public
 * render still gets translated copy, falling back to English.
 */

import type { ComponentConfig, Field } from "@measured/puck";
import { cloudinaryImageUrl } from "@/lib/page-builder/cloudinaryClient";
import { getGalleryChromeLabelsFrom, type BlockPuck } from "@/lib/page-builder/serverContext";
import {
  resolveBlockStyle,
  resolveBlockAttrs,
  productionStyleField,
  type BlockStyle,
} from "@/lib/page-builder/styleToolkit";
import type { GalleryImage } from "./GalleryGridBlock";

export type GalleryMasonryProps = {
  _style?: BlockStyle;
  images: GalleryImage[];
  columns: 2 | 3 | 4;
  gap: "tight" | "normal" | "loose";
};

export const galleryMasonryDefaultProps: GalleryMasonryProps = {
  images: [],
  columns: 3,
  gap: "normal",
};

const GAP_MAP: Record<GalleryMasonryProps["gap"], string> = {
  tight: "4px",
  normal: "12px",
  loose: "24px",
};

const THUMB_WIDTH_MAP: Record<GalleryMasonryProps["columns"], number> = {
  2: 800,
  3: 600,
  4: 400,
};

export function GalleryMasonryBlock({
  _style,
  images,
  columns,
  gap,
  puck,
}: GalleryMasonryProps & { puck?: BlockPuck }) {
  const gapValue = GAP_MAP[gap] ?? "12px";
  const thumbWidth = THUMB_WIDTH_MAP[columns] ?? 600;
  const labels = getGalleryChromeLabelsFrom(puck);
  const list = Array.isArray(images) ? images : [];

  if (list.length === 0) {
    return <MasonryEmptyState message={labels.empty} />;
  }

  return (
    <section
      data-block="gallery-masonry"
      style={{
        backgroundColor: "var(--pf-color-bg)",
        padding: "4rem 1.5rem",
        fontFamily: "var(--pf-font-body)",
        ...resolveBlockStyle(_style),
      }}
      {...resolveBlockAttrs(_style)}
    >
      <style>{`
        @media (max-width: 639px) { .pf-masonry { column-count: 2 !important; } }
        @media (max-width: 399px) { .pf-masonry { column-count: 1 !important; } }
      `}</style>
      <div style={{ maxWidth: "80rem", margin: "0 auto" }}>
        <div className="pf-masonry" style={{ columnCount: columns, columnGap: gapValue }}>
          {list.map((img) => {
            const src = cloudinaryImageUrl(img.publicId, {
              width: thumbWidth,
              height: thumbWidth * 2,
              crop: "limit",
            });
            return (
              <figure
                key={img.id}
                style={{ margin: 0, marginBottom: gapValue, padding: 0, breakInside: "avoid" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={img.alt ?? ""}
                  loading="lazy"
                  decoding="async"
                  style={{ width: "100%", height: "auto", display: "block" }}
                />
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MasonryEmptyState({ message }: { message: string }) {
  return (
    <section
      data-block="gallery-masonry"
      data-empty="true"
      style={{
        backgroundColor: "var(--pf-color-bg)",
        padding: "4rem 1.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <p
        style={{
          fontFamily: "var(--pf-font-body)",
          color: "var(--pf-color-fg)",
          opacity: 0.45,
          fontSize: "0.9375rem",
          margin: 0,
        }}
      >
        {message}
      </p>
    </section>
  );
}

export const galleryMasonryBlockConfig: ComponentConfig<GalleryMasonryProps> = {
  label: "Gallery Masonry",
  defaultProps: galleryMasonryDefaultProps,
  fields: {
    _style: productionStyleField,
    columns: {
      type: "select",
      label: "Columns",
      options: [
        { label: "2 columns", value: 2 },
        { label: "3 columns", value: 3 },
        { label: "4 columns", value: 4 },
      ],
    } as Field<2 | 3 | 4>,
    gap: {
      type: "select",
      label: "Gap between images",
      options: [
        { label: "Tight", value: "tight" },
        { label: "Normal", value: "normal" },
        { label: "Loose", value: "loose" },
      ],
    },
  },
  render: GalleryMasonryBlock,
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test --run lib/page-builder/blocks/GalleryMasonryBlock.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/page-builder/blocks/GalleryMasonryBlock.tsx lib/page-builder/blocks/GalleryMasonryBlock.test.tsx
git commit -m "feat(portfolio): isomorphic GalleryMasonry block renders from images[]"
```

---

## Task 5: Isomorphic GalleryCarouselBlock

**Files:**
- Rewrite: `lib/page-builder/blocks/GalleryCarouselBlock.tsx`
- Rewrite: `lib/page-builder/blocks/GalleryCarouselBlock.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace the ENTIRE contents of `lib/page-builder/blocks/GalleryCarouselBlock.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { GalleryCarouselBlock, galleryCarouselDefaultProps } from "./GalleryCarouselBlock";
import type { GalleryCarouselProps } from "./GalleryCarouselBlock";
import type { GalleryImage } from "./GalleryGridBlock";
import { puckConfig } from "@/lib/page-builder/config";

const OLD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
beforeEach(() => {
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "test-cloud";
});
afterEach(() => {
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = OLD;
});

function imgs(n: number): GalleryImage[] {
  return Array.from({ length: n }, (_, i) => ({ id: `id${i}`, publicId: `pid${i}`, alt: `Alt ${i}` }));
}

const base: GalleryCarouselProps = { ...galleryCarouselDefaultProps };

describe("GalleryCarouselBlock — isomorphic render", () => {
  it("is synchronous", () => {
    expect(GalleryCarouselBlock({ ...base, images: imgs(2) })).not.toBeInstanceOf(Promise);
  });

  it("maps images[] to carousel slides (one <img> per image)", () => {
    const { container } = render(GalleryCarouselBlock({ ...base, images: imgs(3) }));
    expect(container.querySelectorAll("[data-slide] img").length).toBe(3);
    expect(container.querySelector("[data-block='gallery-carousel']")).toBeInTheDocument();
  });

  it("renders the floating header heading/description", () => {
    render(GalleryCarouselBlock({ ...base, images: imgs(2), heading: "Our Work", description: "Recent shoots" }));
    expect(screen.getByText("Our Work")).toBeInTheDocument();
    expect(screen.getByText("Recent shoots")).toBeInTheDocument();
  });

  it("renders the empty state when images is empty", () => {
    render(GalleryCarouselBlock({ ...base, images: [] }));
    expect(screen.getByText(/no photos in this collection yet/i)).toBeInTheDocument();
    expect(document.querySelector("[data-block='gallery-carousel'][data-empty='true']")).toBeInTheDocument();
  });

  it("registers default props with images:[] and no collectionId/maxItems/overlayAlign", () => {
    expect(galleryCarouselDefaultProps.images).toEqual([]);
    expect(galleryCarouselDefaultProps).not.toHaveProperty("collectionId");
    expect(galleryCarouselDefaultProps).not.toHaveProperty("maxItems");
    expect(galleryCarouselDefaultProps).not.toHaveProperty("overlayAlign");
    expect(puckConfig.components.GalleryCarousel.defaultProps).toHaveProperty("images");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test --run lib/page-builder/blocks/GalleryCarouselBlock.test.tsx`
Expected: FAIL — old shape.

- [ ] **Step 3: Rewrite the block**

Replace the ENTIRE contents of `lib/page-builder/blocks/GalleryCarouselBlock.tsx`:

```tsx
/**
 * GalleryCarouselBlock — ISOMORPHIC (client-safe). Maps its own `images[]` prop to
 * CarouselSlide[] and feeds the existing GalleryCarouselClient island. No DB, no
 * server context, no server-only Cloudinary import. Floating header copy renders
 * via the shared GalleryHeader; empty/chrome labels come from puck.metadata chrome
 * (pure, client-safe) with English fallbacks.
 */

import type { ComponentConfig, Field } from "@measured/puck";
import { cloudinaryImageUrl } from "@/lib/page-builder/cloudinaryClient";
import { getGalleryChromeLabelsFrom, type BlockPuck } from "@/lib/page-builder/serverContext";
import { GalleryCarouselClient, type CarouselSlide } from "./GalleryCarouselClient";
import {
  resolveBlockStyle,
  resolveBlockAttrs,
  productionStyleField,
  type BlockStyle,
} from "@/lib/page-builder/styleToolkit";
import { GalleryHeader } from "./GalleryText";
import type { GalleryImage } from "./GalleryGridBlock";

export type CarouselFloatX = "left" | "center" | "right";
export type CarouselFloatY = "top" | "center" | "bottom";

export type GalleryCarouselProps = {
  _style?: BlockStyle;
  images: GalleryImage[];
  heading: string;
  description: string;
  aspect: "square" | "landscape" | "portrait";
  floatX: CarouselFloatX;
  floatY: CarouselFloatY;
  autoplay: boolean;
};

export const galleryCarouselDefaultProps: GalleryCarouselProps = {
  images: [],
  heading: "",
  description: "",
  aspect: "landscape",
  floatX: "center",
  floatY: "center",
  autoplay: false,
};

const FLOAT_X_TO_JUSTIFY: Record<CarouselFloatX, string> = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
};

const FLOAT_Y_TO_ALIGN: Record<CarouselFloatY, string> = {
  top: "flex-start",
  center: "center",
  bottom: "flex-end",
};

const THUMB_SIZE: Record<GalleryCarouselProps["aspect"], { width: number; height: number }> = {
  square: { width: 800, height: 800 },
  landscape: { width: 1000, height: 562 },
  portrait: { width: 700, height: 933 },
};

export function GalleryCarouselBlock({
  _style,
  images,
  heading,
  description,
  aspect,
  floatX,
  floatY,
  autoplay,
  puck,
}: GalleryCarouselProps & { puck?: BlockPuck }) {
  const labels = getGalleryChromeLabelsFrom(puck);
  const list = Array.isArray(images) ? images : [];

  if (list.length === 0) {
    return <CarouselEmptyState message={labels.empty} />;
  }

  const horizontal: CarouselFloatX = floatX ?? "center";
  const vertical: CarouselFloatY = floatY ?? "center";
  const size = THUMB_SIZE[aspect] ?? THUMB_SIZE.landscape;

  const slides: CarouselSlide[] = list.map((img) => ({
    id: img.id,
    src: cloudinaryImageUrl(img.publicId, { width: size.width, height: size.height, crop: "fill" }),
    alt: img.alt ?? "",
  }));

  return (
    <section
      data-block="gallery-carousel"
      style={{
        backgroundColor: "var(--pf-color-bg)",
        padding: "0.75rem",
        fontFamily: "var(--pf-font-body)",
        ...resolveBlockStyle(_style),
      }}
      {...resolveBlockAttrs(_style)}
    >
      <div style={{ position: "relative", maxWidth: "80rem", margin: "0 auto" }}>
        <GalleryCarouselClient
          slides={slides}
          aspect={aspect}
          autoplay={autoplay}
          labels={{ hint: labels.carouselHint, prev: labels.carouselPrev, next: labels.carouselNext }}
        />
        <div
          data-gallery-overlay="true"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: FLOAT_Y_TO_ALIGN[vertical],
            justifyContent: FLOAT_X_TO_JUSTIFY[horizontal],
            padding: "1.5rem",
            pointerEvents: "none",
          }}
        >
          <div style={{ width: "min(100%, 40rem)" }}>
            <GalleryHeader heading={heading} description={description} align={horizontal} overlay />
          </div>
        </div>
      </div>
    </section>
  );
}

function CarouselEmptyState({ message }: { message: string }) {
  return (
    <section
      data-block="gallery-carousel"
      data-empty="true"
      style={{
        backgroundColor: "var(--pf-color-bg)",
        padding: "4rem 1.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <p
        style={{
          fontFamily: "var(--pf-font-body)",
          color: "var(--pf-color-fg)",
          opacity: 0.45,
          fontSize: "0.9375rem",
          margin: 0,
        }}
      >
        {message}
      </p>
    </section>
  );
}

export const galleryCarouselBlockConfig: ComponentConfig<GalleryCarouselProps> = {
  label: "Gallery Carousel",
  defaultProps: galleryCarouselDefaultProps,
  fields: {
    _style: productionStyleField,
    heading: { type: "text", label: "Heading" },
    description: { type: "textarea", label: "Description" },
    aspect: {
      type: "select",
      label: "Image shape",
      options: [
        { label: "Square", value: "square" },
        { label: "Landscape", value: "landscape" },
        { label: "Portrait", value: "portrait" },
      ],
    },
    floatX: {
      type: "select",
      label: "Floating header — horizontal",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    } as Field<CarouselFloatX>,
    floatY: {
      type: "select",
      label: "Floating header — vertical",
      options: [
        { label: "Top", value: "top" },
        { label: "Middle", value: "center" },
        { label: "Bottom", value: "bottom" },
      ],
    } as Field<CarouselFloatY>,
    autoplay: {
      type: "select",
      label: "Autoplay",
      options: [
        { label: "Off", value: false },
        { label: "On", value: true },
      ],
    } as Field<boolean>,
  },
  render: GalleryCarouselBlock,
};
```

> `overlayAlign` is dropped entirely (dev-only legacy, no saved data to honour, per spec §Data shape).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test --run lib/page-builder/blocks/GalleryCarouselBlock.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/page-builder/blocks/GalleryCarouselBlock.tsx lib/page-builder/blocks/GalleryCarouselBlock.test.tsx
git commit -m "feat(portfolio): isomorphic GalleryCarousel block renders from images[]"
```

---

## Task 6: editorConfig — real render, new defaultProps, drop preview stubs

**Files:**
- Modify: `lib/page-builder/editorConfig.tsx`

- [ ] **Step 1: Update imports + inlined default props**

Add the real block component imports near the other isomorphic block imports (after line ~60):

```ts
import { GalleryGridBlock } from "./blocks/GalleryGridBlock";
import { GalleryMasonryBlock } from "./blocks/GalleryMasonryBlock";
import { GalleryCarouselBlock } from "./blocks/GalleryCarouselBlock";
```

Replace the inlined default props (lines 50-52):

```ts
const galleryGridDefaultProps: GalleryGridProps = { collectionId: "", columns: 3, gap: "normal", maxItems: 12 };
const galleryMasonryDefaultProps: GalleryMasonryProps = { collectionId: "", columns: 3, gap: "normal", maxItems: 18 };
const galleryCarouselDefaultProps: GalleryCarouselProps = { heading: "", description: "", collectionId: "", aspect: "landscape", floatX: "center", floatY: "center", autoplay: false, maxItems: 12 };
```

with:

```ts
const galleryGridDefaultProps: GalleryGridProps = { images: [], columns: 3, gap: "normal" };
const galleryMasonryDefaultProps: GalleryMasonryProps = { images: [], columns: 3, gap: "normal" };
const galleryCarouselDefaultProps: GalleryCarouselProps = { images: [], heading: "", description: "", aspect: "landscape", floatX: "center", floatY: "center", autoplay: false };
```

- [ ] **Step 2: Replace the three gallery configs (lines 414-552)**

Replace `galleryGrid`, `galleryMasonry`, and `galleryCarousel` configs with WYSIWYG configs that render the real component and `resolveFields`-strip to `_style` (so `StyleToolkitField` keeps driving editing):

```ts
// ---------------------------------------------------------------------------
// Gallery data blocks — now ISOMORPHIC. Editor renders the REAL component for
// true WYSIWYG; all content/layout editing flows through the StyleToolkitField
// Content/Layout tabs, so resolveFields strips everything but _style.
// ---------------------------------------------------------------------------

const galleryGrid: ComponentConfig<GalleryGridProps> = {
  label: "Gallery Grid",
  defaultProps: galleryGridDefaultProps,
  fields: {
    _style: styleField,
    columns: {
      type: "select",
      label: "Columns",
      options: [
        { label: "2 columns", value: 2 },
        { label: "3 columns", value: 3 },
        { label: "4 columns", value: 4 },
      ],
    } as Field<2 | 3 | 4>,
    gap: {
      type: "select",
      label: "Gap between images",
      options: [
        { label: "Tight (4px)", value: "tight" },
        { label: "Normal (8px)", value: "normal" },
        { label: "Loose (16px)", value: "loose" },
      ],
    },
  },
  resolveFields: (_data, { fields }) => {
    return { _style: (fields as Record<string, unknown>)._style } as typeof fields;
  },
  render: GalleryGridBlock,
};

const galleryMasonry: ComponentConfig<GalleryMasonryProps> = {
  label: "Gallery Masonry",
  defaultProps: galleryMasonryDefaultProps,
  fields: {
    _style: styleField,
    columns: {
      type: "select",
      label: "Columns",
      options: [
        { label: "2 columns", value: 2 },
        { label: "3 columns", value: 3 },
        { label: "4 columns", value: 4 },
      ],
    } as Field<2 | 3 | 4>,
    gap: {
      type: "select",
      label: "Gap between images",
      options: [
        { label: "Tight", value: "tight" },
        { label: "Normal", value: "normal" },
        { label: "Loose", value: "loose" },
      ],
    },
  },
  resolveFields: (_data, { fields }) => {
    return { _style: (fields as Record<string, unknown>)._style } as typeof fields;
  },
  render: GalleryMasonryBlock,
};

const galleryCarousel: ComponentConfig<GalleryCarouselProps> = {
  label: "Gallery Carousel",
  defaultProps: galleryCarouselDefaultProps,
  fields: {
    _style: styleField,
    heading: richTextField("Heading (optional)"),
    description: richTextField("Description (optional)", true),
    aspect: {
      type: "select",
      label: "Image shape",
      options: [
        { label: "Square", value: "square" },
        { label: "Landscape", value: "landscape" },
        { label: "Portrait", value: "portrait" },
      ],
    },
    floatX: {
      type: "select",
      label: "Floating header — horizontal",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    } as Field<"left" | "center" | "right">,
    floatY: {
      type: "select",
      label: "Floating header — vertical",
      options: [
        { label: "Top", value: "top" },
        { label: "Middle", value: "center" },
        { label: "Bottom", value: "bottom" },
      ],
    } as Field<"top" | "center" | "bottom">,
    autoplay: {
      type: "select",
      label: "Autoplay",
      options: [
        { label: "Off", value: false },
        { label: "On", value: true },
      ],
    } as Field<boolean>,
  },
  resolveFields: (_data, { fields }) => {
    return { _style: (fields as Record<string, unknown>)._style } as typeof fields;
  },
  render: GalleryCarouselBlock,
};
```

> The editor render of the carousel uses `GalleryCarouselClient`, which is a `"use client"` island — fine inside the client `<Puck>` canvas. `getGalleryChromeLabelsFrom(undefined)` returns English defaults in the editor (no `puck.metadata.workspace`), which is correct for editor chrome.

- [ ] **Step 3: Remove now-dead helpers**

Delete `collectionField` (lines 279-287), `GalleryCollectionPreview` (lines 182-206), and `useCollectionName` (lines 176-180) — they have no remaining consumer (verify with a grep; FeaturedWork uses `FeaturedItemsPicker`, not these). Remove the now-unused `CollectionPicker` import (line 27) and the `usePickerData` import (line 32) **only if** nothing else in the file uses them after deletion — `useCollectionName` is the sole `usePickerData` consumer in this file, and `collectionField` the sole `CollectionPicker` consumer, so both imports go. The `imagesField` factory (line 265) gains a real consumer path conceptually, but since gallery editing routes through `StyleToolkitField` (not a sidebar Field), `imagesField` may STILL be unused here — keep its `// eslint-disable-next-line @typescript-eslint/no-unused-vars` comment OR remove the factory if the unified-picker plan no longer needs it exported. **Decision: keep `imagesField` + its eslint-disable** (it is the documented spec-#1 deliverable and harmless).

- [ ] **Step 4: Typecheck + run editorConfig/blockShapes-adjacent tests**

Run: `pnpm tsc`
Expected: clean (gallery configs now type as `ComponentConfig<GalleryXProps>` with no `as any`).

- [ ] **Step 5: Commit**

```powershell
git add lib/page-builder/editorConfig.tsx
git commit -m "feat(portfolio): editor renders real gallery blocks; drop collection preview stubs"
```

---

## Task 7: StyleToolkitField — CollectionPicker → MultiImageControl, remove Max items

**Files:**
- Modify: `lib/page-builder/StyleToolkitField.tsx`

- [ ] **Step 1: Update imports**

Add `MultiImageControl` to the MediaField import (line 46 currently imports `SingleImageControl`):

```ts
import { SingleImageControl, MultiImageControl } from "./galleryPicker/MediaField";
import type { MediaPickerSelection } from "./galleryPicker/MediaPicker";
```

Remove the now-unused `CollectionPicker` import if no other consumer remains in this file (grep `CollectionPicker` in `StyleToolkitField.tsx` — only the gallery Content panel uses it).

- [ ] **Step 2: Swap the gallery Content panel (lines 350-356)**

Replace:

```tsx
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Collection</span>
          <CollectionPicker
            value={(props.collectionId as string) ?? ""}
            onChange={(v) => setProp("collectionId", v)}
          />
        </div>
```

with:

```tsx
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Photos</span>
          <MultiImageControl
            value={(props.images as MediaPickerSelection[]) ?? []}
            onChange={(v) => setProp("images", v)}
            max={60}
          />
        </div>
```

- [ ] **Step 3: Remove the Max items control (lines 934-941)**

Delete the trailing `<NumberInputRow label="Max items" ... onChange={(v) => setProp("maxItems", v)} />` block from `GalleryLayoutControls`. Array length is now the count (spec §Data shape). If `NumberInputRow` becomes unused in this file after deletion, remove its import too (verify — it may be used elsewhere in the file).

- [ ] **Step 4: Run StyleToolkitField tests**

Run: `pnpm test --run lib/page-builder/StyleToolkitField.test.tsx`
Expected: PASS. If a test asserted the gallery panel rendered a CollectionPicker or a "Max items" row, update it to assert the new "Photos" `MultiImageControl` trigger (text `Choose photos`) and the absence of "Max items". FeaturedWork's panel is untouched.

- [ ] **Step 5: Commit**

```powershell
git add lib/page-builder/StyleToolkitField.tsx
git commit -m "feat(portfolio): gallery content panel uses multi-image picker; drop max items"
```

---

## Task 8: Reconcile wiring — editor load (in-memory) + publish (persisted)

**Files:**
- Modify: `app/[locale]/(app)/portfolio/page.tsx`
- Modify: `app/[locale]/(app)/portfolio/_actions.ts`
- Create/Modify: `app/[locale]/(app)/portfolio/_actions.test.ts`

- [ ] **Step 1: Write the failing publish-action test**

Create (or append to) `app/[locale]/(app)/portfolio/_actions.test.ts`. Mirror the route-test conventions: mock `next/cache`, `requireOrg` (mutable `mockCtx`), `connectDB`; use in-memory mongo:

```ts
import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Workspace, GalleryItem } from "@/lib/db/models";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn(async () => {}) }));

const mockCtx: { role: "owner" | "staff"; workspace: { _id: Types.ObjectId; slug: string } } = {
  role: "owner",
  workspace: { _id: new Types.ObjectId(), slug: "ws-a" },
};
vi.mock("@/lib/auth/requireOrg", () => ({ requireOrg: async () => mockCtx }));

import { publishPortfolioAction } from "./_actions";

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
afterEach(async () => {
  await clearCollections();
});
beforeEach(() => {
  mockCtx.role = "owner";
});

async function setup(images: Array<{ id: string; publicId: string; alt?: string }>) {
  const wsId = mockCtx.workspace._id;
  await Workspace.create({
    _id: wsId,
    slug: "ws-a",
    name: "A",
    ownerUserId: "u1",
    clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`,
    currency: "PHP",
    publicPage: {
      data: {
        home: { root: {}, content: [{ type: "GalleryGrid", props: { id: "g1", images, columns: 3, gap: "normal" } }] },
        gallery: { root: {}, content: [] },
      },
    },
  });
  return wsId;
}

describe("publishPortfolioAction — reconcile + publish", () => {
  it("rejects a non-owner", async () => {
    mockCtx.role = "staff";
    expect(await publishPortfolioAction()).toEqual({ error: "owner_only" });
  });

  it("persists reconciled images (refresh + prune) AND sets publishedAt", async () => {
    const wsId = mockCtx.workspace._id;
    const live = await GalleryItem.create({
      workspaceId: wsId, collectionId: null,
      cloudinaryPublicId: `ws/${wsId}/live`, url: "https://x/l.jpg", altText: "Live alt", order: 0,
    });
    const missing = new Types.ObjectId().toString();
    await setup([
      { id: String(live._id), publicId: "STALE", alt: "stale" },
      { id: missing, publicId: "x" },
    ]);

    const res = await publishPortfolioAction();
    expect(res).toEqual({ ok: true });

    const fresh = await Workspace.findById(wsId).lean();
    const images = (fresh!.publicPage!.data!.home as { content: Array<{ props: { images: Array<{ id: string; publicId: string; alt: string }> } }> }).content[0].props.images;
    expect(images).toEqual([{ id: String(live._id), publicId: `ws/${wsId}/live`, alt: "Live alt" }]);
    expect(fresh!.publicPage!.publishedAt).toBeTruthy();
    expect(fresh!.publicPage!.lastPublishedAt).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test --run "app/[locale]/(app)/portfolio/_actions.test.ts"`
Expected: FAIL — publish does not reconcile/persist `images`; reconciled assertion fails.

- [ ] **Step 3: Wire reconcile into the publish action**

In `app/[locale]/(app)/portfolio/_actions.ts`, add the import:

```ts
import { reconcileGalleryImages } from "@/lib/page-builder/reconcile";
import type { PuckData } from "@/lib/page-builder/types";
```

Replace the body of `publishPortfolioAction` (lines 73-88):

```ts
export async function publishPortfolioAction(): Promise<EditorActionResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  await connectDB();
  const workspaceId = String(ctx.workspace._id);

  // Read current draft zones, reconcile their gallery images against live
  // GalleryItems, and persist the refreshed data so the live page renders fresh,
  // fetch-free images. Reconcile runs BEFORE publishedAt is set.
  const ws = await Workspace.findById(ctx.workspace._id)
    .select({ "publicPage.data.home": 1, "publicPage.data.gallery": 1 })
    .lean();

  const set: Record<string, unknown> = {};
  const home = ws?.publicPage?.data?.home as PuckData | null | undefined;
  const gallery = ws?.publicPage?.data?.gallery as PuckData | null | undefined;
  if (home) set["publicPage.data.home"] = await reconcileGalleryImages(workspaceId, home);
  if (gallery) set["publicPage.data.gallery"] = await reconcileGalleryImages(workspaceId, gallery);

  const now = new Date();
  set["publicPage.publishedAt"] = now;
  set["publicPage.lastPublishedAt"] = now;

  await Workspace.updateOne({ _id: ctx.workspace._id }, { $set: set });

  revalidatePath(`/w/${ctx.workspace.slug}`);
  revalidatePath(`/w/${ctx.workspace.slug}/gallery`);
  revalidatePath("/sitemap.xml");
  return { ok: true };
}
```

- [ ] **Step 4: Wire reconcile into editor load (in-memory, no write)**

In `app/[locale]/(app)/portfolio/page.tsx`, add the import:

```ts
import { reconcileGalleryImages } from "@/lib/page-builder/reconcile";
```

Replace the `initialData` construction (lines 74-77) so each zone is reconciled in-memory AFTER `toPlain` (the page already has `workspace` from `requireOrg`):

```ts
  const workspaceId = String(workspace._id);
  const initialData = {
    home: await reconcileGalleryImages(workspaceId, toPlain<PuckData>(homeData, EMPTY_ZONE)),
    gallery: await reconcileGalleryImages(workspaceId, toPlain<PuckData>(galleryData, EMPTY_ZONE)),
  };
```

> This is purely in-memory: the reconciled data is passed to `<EditorShell initialData>` and never written here (the owner's next save persists it). No new `Workspace.updateOne` on GET. `reconcileGalleryImages` returns the input unchanged when a zone has no gallery blocks, so the empty-zone fallback is a no-op DB-wise.

- [ ] **Step 5: Run the publish test to verify it passes**

Run: `pnpm test --run "app/[locale]/(app)/portfolio/_actions.test.ts"`
Expected: PASS (owner-only + reconciled-persist + publishedAt).

- [ ] **Step 6: Commit**

```powershell
git add "app/[locale]/(app)/portfolio/_actions.ts" "app/[locale]/(app)/portfolio/page.tsx" "app/[locale]/(app)/portfolio/_actions.test.ts"
git commit -m "feat(portfolio): reconcile gallery images on editor load and publish"
```

---

## Task 9: Seed, template factories, shape tests, and `listItemsForBlock` retirement

**Files:**
- Modify: `lib/page-builder/seedPortfolio.ts`
- Modify: `lib/page-builder/templates/_blocks.ts`
- Modify: `lib/page-builder/blockShapes.test.tsx`
- Modify: `lib/page-builder/blocks/sectionPresets.test.tsx`
- Modify: `lib/db/queries/gallery.ts`
- Modify: `lib/db/queries/gallery.test.ts`

- [ ] **Step 1: Retire the gallery collectionId auto-fill in the seeder**

In `lib/page-builder/seedPortfolio.ts`, `injectGalleryRefs` (lines 31-52) currently fills `block.props.collectionId` on `Gallery*` blocks. Gallery blocks no longer have `collectionId`. Update it to ONLY handle FeaturedWork:

```ts
/**
 * Seed FeaturedWork.itemIds with the first uploaded photos so a freshly seeded
 * portfolio's Featured Work isn't visibly empty when the workspace already has a
 * Featured-work collection. Gallery blocks now bake `images[]` directly (no
 * collectionId pointer), so they are seeded empty and the owner picks photos in
 * the editor. Mutates `data` in place.
 */
export function injectGalleryRefs(
  data: PortfolioPuckData,
  _collectionId: string,
  itemIds: string[]
): void {
  const zones: (PuckData | null)[] = [data.home, data.gallery];
  for (const z of zones) {
    if (!z) continue;
    for (const block of z.content) {
      if (
        block.type === "FeaturedWork" &&
        Array.isArray(block.props.itemIds) &&
        block.props.itemIds.length === 0
      ) {
        block.props.itemIds = itemIds.slice(0, 3).map((id) => ({ id }));
      }
    }
  }
}
```

> `buildSeed` (lines 56-81) still queries the featured-work collection's first 3 items for FeaturedWork — keep that; it is NOT a gallery-block concern. The `GalleryItem` import stays (used by `buildSeed`). The `collectionId` param is retained for call-site compatibility but unused (prefix `_`).

- [ ] **Step 2: Update the template gallery factories**

In `lib/page-builder/templates/_blocks.ts`, the gallery factories (lines 53-98) spread `...galleryGridDefaultProps` (now `{ images:[], columns, gap }`) and set `maxItems`. Drop `maxItems` from each (no longer a prop). `galleryGridDefaultProps`/`galleryMasonryDefaultProps`/`galleryCarouselDefaultProps` now carry `images: []`, so the spread already yields the new shape. Edit each factory to remove the `maxItems` line and the `maxItems?` param:

```ts
export function galleryGrid(
  id: string,
  props?: { columns?: 2 | 3 | 4; gap?: "tight" | "normal" | "loose" }
): PuckBlockEntry {
  return {
    type: "GalleryGrid",
    props: { id, ...galleryGridDefaultProps, columns: props?.columns ?? 3, gap: props?.gap ?? "normal" },
  };
}

export function galleryMasonry(
  id: string,
  props?: { columns?: 2 | 3 | 4; gap?: "tight" | "normal" | "loose" }
): PuckBlockEntry {
  return {
    type: "GalleryMasonry",
    props: { id, ...galleryMasonryDefaultProps, columns: props?.columns ?? 3, gap: props?.gap ?? "normal" },
  };
}

export function galleryCarousel(
  id: string,
  props?: { aspect?: "square" | "landscape" | "portrait" }
): PuckBlockEntry {
  return {
    type: "GalleryCarousel",
    props: { id, ...galleryCarouselDefaultProps, aspect: props?.aspect ?? "landscape" },
  };
}
```

> Check the four template files (`minimal.ts`, `event-photographer.ts`, `planner.ts`, `venue-stylist.ts`, `wedding-photographer.ts`) for callers passing `maxItems` to these factories; remove those args. Grep `galleryGrid(`/`galleryMasonry(`/`galleryCarousel(` across `templates/`.

- [ ] **Step 3: Update blockShapes.test.tsx (lines 189-190)**

Replace:

```tsx
  it("GalleryGrid defaultProps has collectionId field", () => {
    expect(puckConfig.components.GalleryGrid.defaultProps).toHaveProperty("collectionId");
```

with:

```tsx
  it("GalleryGrid defaultProps has images field (baked images model)", () => {
    expect(puckConfig.components.GalleryGrid.defaultProps).toHaveProperty("images");
    expect(puckConfig.components.GalleryGrid.defaultProps).not.toHaveProperty("collectionId");
```

(Keep the surrounding `it(...)` close brace.) The comment at line ~13 ("Async data blocks (GalleryGrid etc.)") is now stale — update it to note the gallery blocks are isomorphic.

- [ ] **Step 4: Check sectionPresets.test.tsx**

`sectionPresets.test.tsx` (lines 46-47) references `GalleryGridPreset`/`GalleryMasonryPreset` (Container-based presets, NOT the gallery blocks themselves) — those are unaffected. The line-13 comment ("Gallery blocks ... touch the Cloudinary SDK") is now FALSE (they no longer import the server SDK). Update the comment; verify the preset render assertions still pass unchanged.

Run: `pnpm test --run lib/page-builder/blocks/sectionPresets.test.tsx lib/page-builder/blockShapes.test.tsx`
Expected: PASS.

- [ ] **Step 5: Retire `listItemsForBlock`**

No production consumer remains (Masonry/Carousel rewritten; Grid never used it). Remove `listItemsForBlock` (lines 51-83) and the now-unused `GalleryCollection` import IF it is only used there (verify — `listItemsForBlock` is the sole `GalleryCollection` consumer in `lib/db/queries/gallery.ts`; the picker helpers use `GalleryCollection` too in `listCollectionsForPicker`, so KEEP the import). Remove the `GalleryBlockItem`/`ITEM_PROJECTION`/`DEFAULT_LIMIT`/`MAX_LIMIT` exports ONLY if unused after the deletion — `getItemsByIds` uses `ITEM_PROJECTION`, `MAX_LIMIT`, and `GalleryBlockItem`, so KEEP all of those. Net: delete only the `listItemsForBlock` function + its doc comment lines.

In `lib/db/queries/gallery.test.ts`, delete the `describe("listItemsForBlock", ...)` block(s) and any helper used solely by them.

Run: `pnpm test --run lib/db/queries/gallery.test.ts`
Expected: PASS (remaining helper tests).

- [ ] **Step 6: Commit**

```powershell
git add lib/page-builder/seedPortfolio.ts lib/page-builder/templates/_blocks.ts lib/page-builder/templates/*.ts lib/page-builder/blockShapes.test.tsx lib/page-builder/blocks/sectionPresets.test.tsx lib/db/queries/gallery.ts lib/db/queries/gallery.test.ts
git commit -m "refactor(portfolio): seed/templates use baked gallery images; retire listItemsForBlock"
```

---

## Task 10: Full verification (Definition of Done)

- [ ] **Step 1: Run all touched tests**

Run:
```powershell
pnpm test --run lib/page-builder/cloudinaryClient.test.ts lib/page-builder/reconcile.test.ts lib/page-builder/blocks/GalleryGridBlock.test.tsx lib/page-builder/blocks/GalleryMasonryBlock.test.tsx lib/page-builder/blocks/GalleryCarouselBlock.test.tsx lib/page-builder/blocks/manualBlocks.test.tsx lib/page-builder/StyleToolkitField.test.tsx lib/page-builder/blockShapes.test.tsx lib/page-builder/blocks/sectionPresets.test.tsx lib/db/queries/gallery.test.ts lib/page-builder/templates/templates.test.ts "app/[locale]/(app)/portfolio/_actions.test.ts"
```
Expected: all PASS.

- [ ] **Step 2: Typecheck**

Run: `pnpm tsc`
Expected: clean (no `as any` on gallery configs; reconcile `PuckData` casts compile).

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: clean. (`imagesField` retains its eslint-disable; remove any newly-unused imports flagged.)

- [ ] **Step 4: Client-bundle hygiene assertion**

Confirm the three gallery block modules transitively import NO server-only module: grep each block file for `connectDB`, `node:async_hooks`, `mongoose`, `@/lib/db`, `@/lib/storage/cloudinary` — expect ZERO matches. They import only `cloudinaryClient`, `styleToolkit`, `serverContext` (type + `getGalleryChromeLabelsFrom`, which is the pure prop-read path), `GalleryCarouselClient`, `GalleryText`. Note: `serverContext.tsx` itself imports `node:async_hooks`; importing `getGalleryChromeLabelsFrom` from it pulls that module into the client graph. **Verify** the build (`pnpm next build`) succeeds — if Turbopack rejects `node:async_hooks` in the client gallery bundle, move `getGalleryChromeLabelsFrom` + the `BlockPuck`/`GalleryChromeLabels` types into a new client-safe module (e.g. `lib/page-builder/galleryChrome.ts`) that does NOT import `node:async_hooks`, and re-export from `serverContext` for back-compat. (This is the one residual server-import risk; resolve it here.)

Run: `pnpm next build`
Expected: build succeeds.

- [ ] **Step 5: Mobile 375px check**

Manually verify at 375px: editor canvas shows real gallery thumbnails (WYSIWYG); the Content tab "Photos" `MultiImageControl` opens the picker; Grid/Masonry/Carousel render correctly; empty state shows when no photos picked; public render is fetch-free.

- [ ] **Step 6: Confirm no new locale strings**

Confirm no files under `messages/` changed. Editor chrome stays English; the Masonry/Carousel public empty-state copy uses the EXISTING `chrome.gallery` labels (no new keys).

- [ ] **Step 7: Final commit (if verification adjusted anything)**

```powershell
git add -A
git commit -m "chore(portfolio): verification fixes for baked gallery images"
```

---

## Self-review against the spec

- **Blocks render from their own props (WYSIWYG + fetch-free):** Grid/Masonry/Carousel rewritten as sync components over `images[]` (Tasks 3-5); editor renders the real component (Task 6). ✓
- **`GalleryImage = { id, publicId, alt? }`; removed `collectionId`/`maxItems`; kept presentation props; dropped `overlayAlign`:** Tasks 3-5. ✓
- **Client-safe Cloudinary URL mirroring the server transform:** `cloudinaryImageUrl` (Task 1), shared into manualBlocks. ✓
- **`reconcileGalleryImages` — single `$in` query scoped by workspaceId, refresh/prune/order, never-add, no-op when no gallery blocks, walks content + zones:** Task 2. ✓
- **Reconcile triggers: editor-load in-memory (no write), publish persists then sets publishedAt; owner-only:** Task 8. ✓
- **Editor uses the real blocks + StyleToolkitField tabs (CollectionPicker → MultiImageControl, max items removed); `resolveFields` strips to `_style`:** Tasks 6-7. ✓
- **Seed/templates updated to `images: []`; parity/shape tests updated; `listItemsForBlock` retired (no consumers):** Task 9. ✓
- **Tenant safety:** workspaceId from session only; `$in` scoped; foreign ids pruned (reconcile tests). ✓
- **Client-bundle hygiene asserted; no new locales; mobile 375px; typecheck + lint clean:** Task 10. ✓

### Deviations from the spec (intentional, called out)

1. **Editor keeps the StyleToolkitField tab UX (NOT raw Puck `imagesField` sidebar).** The spec says "use imagesField, drop resolveFields stub." The CURRENT codebase routes ALL gallery editing through `StyleToolkitField` Content/Layout tabs with `resolveFields` stripping to `_style`. To honour the live pattern (and keep one editing surface), the gallery configs render the real block + `resolveFields`→`_style`, and the **multi-image picker lives in the StyleToolkitField Content panel** (`MultiImageControl`) rather than as a Puck sidebar `imagesField`. Net effect matches the spec's intent (baked `images[]`, WYSIWYG, no collectionId), with a different wiring. `imagesField` (already defined for spec #1) is kept but unused by gallery blocks.
2. **Shared client Cloudinary util is a NEW module** (`cloudinaryClient.ts`) rather than reusing the inline `manualBlocks.cloudinaryUrl`; the inline helper is refactored to delegate to it (DRY). The shared util always emits `h_`, where the old inline `c_limit` URL omitted it — visually identical because `c_limit` never upscales.
3. **`listItemsForBlock` is retired** (spec left it conditional). Verified: zero remaining production consumers after the rewrite. Its tests are removed.
4. **`injectGalleryRefs` keeps its `collectionId` param** (prefixed `_`, unused) to avoid touching `buildSeed` call sites; only the gallery-block branch is removed.

## Open questions for the orchestrator to decide before execution

1. **`node:async_hooks` in the client gallery bundle (Task 10 Step 4).** The now-client Masonry/Carousel import `getGalleryChromeLabelsFrom` from `serverContext.tsx`, which imports `node:async_hooks`. Tree-shaking SHOULD drop the ALS path, but if `pnpm next build` (Turbopack) rejects it, the fix is to extract `getGalleryChromeLabelsFrom` + the `BlockPuck`/`GalleryChromeLabels` types into a client-safe module. **Decide upfront:** extract preemptively (cleaner, more files) or only-if-build-fails (fewer changes). The plan currently does the latter.
2. **Grid empty-state copy:** the rewritten Grid hardcodes English `"No photos selected yet."` (the current Grid hardcoded English too). Masonry/Carousel use the localized `chrome.gallery.empty`. Confirm Grid should stay English-hardcoded (consistent with its prior behaviour) rather than also reading `getGalleryChromeLabelsFrom`. The plan keeps it simple per the orchestrator's instruction.
3. **`PuckData` `zones` typing:** confirm `PuckData` from `@/lib/page-builder/types` includes (or tolerates) `zones`. The reconcile helper uses defensive casts; if `PuckData` already types `zones`, the casts can be simplified during Task 2 typecheck.

## Execution Handoff

Execute tasks 1→10 in order using superpowers:subagent-driven-development. Each task is independently committable; Tasks 3-5 depend on Task 1, Task 8 depends on Task 2, Tasks 6-7 depend on Tasks 3-5. Stop and surface to the orchestrator if open question #1 (the `node:async_hooks` build risk) materializes at Task 10 Step 4.
