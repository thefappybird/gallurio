# Unified Media Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one modal `MediaPicker` (single + multi) with collection-first paginated browsing, the paginated collection-items endpoint that backs it, two Puck field adapters, and re-point the Image block's picker to it — with no data migration.

**Architecture:** One self-contained modal (`MediaPicker`) owns the hard UX (collection grid → drill-in → 4×4 paginated photos, tap-to-toggle, reorder, bulk-select, upload-into-collection, create-collection). Two thin sidebar controls (`SingleImageControl`, `MultiImageControl`) open it and round-trip the field value; two Puck `Field` factories (`imageField`, `imagesField`) wrap those controls. A new owner-only `GET` on the collection-items route (with an `id="all"` virtual feed) and two cursor-paginated query helpers feed the modal lazily.

**Tech Stack:** Next.js 16 (App Router, Node runtime), React 19, Mongoose 8, Puck (`@measured/puck`), base-ui Dialog, Cloudinary signed direct upload, Vitest + Testing Library + `mongodb-memory-server`.

---

## Key facts established from the codebase (read before starting)

- **`PickerItem`** (`lib/page-builder/galleryPicker/types.ts` and re-declared in `lib/db/queries/gallery.ts`): `{ id: string; publicId: string; thumbUrl: string; caption: string | null }`. `thumbUrl` is computed **server-side** by `cloudinaryThumbnailUrl` (which reads `process.env.CLOUDINARY_CLOUD_NAME` and imports the Node SDK — **never call it in client code**).
- **`usePickerData()`** (`.../usePickerData.ts`) returns `{ state, retry }`, state = `{status:"loading"} | {status:"error";message} | {status:"ok";data:PickerData}`, `data = { collections: PickerCollection[]; items: PickerItem[] }`. Module-level cache; `retry()` busts it (call after uploads/creates). Test reset: `__clearPickerDataCache()`.
- **`PickerCollection`**: `{ id; name; coverUrl: string|null; itemCount: number }`.
- **Dialog** (`components/ui/dialog.tsx`): base-ui; `DialogContent` already portals (`DialogPortal`) and is `z-50` — confirmed above Puck chrome. Use `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter` + `Button`. Pattern reference: `CreateCollectionDialog.tsx`.
- **Upload**: `uploadImageToCloudinary(file, { subfolder:"portfolio" })` → `UploadedImage { cloudinaryPublicId; url; width?; height?; format?; sizeBytes? }`. Rejects throw `Error(reason)` where reason ∈ `type_not_accepted | file_too_large | dimension_too_small | sign_failed | upload_failed`. Client pre-validation: `validatePhotoFile(file)` from `@/lib/page-builder/photoSpec`.
- **Items POST** `/api/portfolio/gallery/items` currently creates a **standalone** item (`collectionId: null`) and returns `{ id; thumbUrl; caption }`. We extend it (Task 3) to accept an optional `collectionId`.
- **Collections POST** `/api/portfolio/gallery/collections` returns `{ id; name; slug }`.
- **`GalleryItem`** (`lib/db/models/GalleryItem.ts`): fields incl. `cloudinaryPublicId, collectionId (default null), order (default 0), caption, createdAt (timestamps:true)`. Indexes: `workspaceId` (single), `{ workspaceId, collectionId, order }`.
- **`requireOrg()`** → `{ userId, clerkOrgId, role:"owner"|"staff", workspace: WorkspaceDoc }`. Owner gate everywhere: `if (ctx.role !== "owner") 403`.
- **The Image block's live picker is NOT the sidebar field.** `editorConfig.tsx` declares `imagePublicId: imagePickerField("Image")` but `resolveFields` strips it; the actual UI is `ImagePanel` in `StyleToolkitField.tsx:1138` rendering `<SingleImagePicker value={p.imagePublicId} onChange={setProp("imagePublicId", v)} />`. **Re-pointing the Image block = swapping that one call** (Task 6). Container/banner backgrounds use `BannerSection` (`StyleToolkitField.tsx:261`) → **leave on `SingleImagePicker`** (deferred to spec #3).
- **Route-test conventions** (`.../collections/[id]/route.test.ts`): `vi.mock("next/server", ...)` returns `NextResponse.json → {body,status}`; `vi.mock("@/lib/db/mongoose", connectDB)`; `vi.mock("@/lib/auth/requireOrg", () => ({ requireOrg: async () => ({ ...mockCtx }) }))` with a mutable `mockCtx`; in-memory mongo from `@/test-utils/mongo` (`startInMemoryMongo`/`stopInMemoryMongo`/`clearCollections`); `makeParams(id) = { params: Promise.resolve({ id }) }`.
- **Component-test conventions** (`FeaturedItemsPicker.test.tsx`): `vi.stubGlobal("fetch", mockFetch)`; `__clearPickerDataCache()` in `beforeEach`; Testing Library `render/screen/fireEvent/waitFor`.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `lib/db/queries/gallery.ts` | Modify | Add `listCollectionItemsPage`, `listAllItemsPage`, cursor helpers, `toPickerItem`. |
| `lib/db/queries/gallery.test.ts` | Modify | Tests for the two paginated helpers (order, cursor, tenant scope). |
| `lib/db/models/GalleryItem.ts` | Modify | Add `{ workspaceId:1, createdAt:-1 }` index for the "All photos" feed. |
| `app/api/portfolio/gallery/collections/[id]/route.ts` | Modify | Add owner-only paginated `GET` (+ `id="all"` sentinel). |
| `app/api/portfolio/gallery/collections/[id]/route.test.ts` | Modify | Tests for `GET` (owner-only, isolation, cursor, `all`, invalid id, clamp). |
| `app/api/portfolio/gallery/items/route.ts` | Modify | Accept optional `collectionId` (upload-into-collection). |
| `app/api/portfolio/gallery/items/route.test.ts` | Modify | Tests for `collectionId` (valid, foreign→reject, order). |
| `lib/page-builder/galleryPicker/MediaPicker.tsx` | Create | The modal. Mode-agnostic single/multi. |
| `lib/page-builder/galleryPicker/MediaPicker.test.tsx` | Create | Modal behavior + all async states. |
| `lib/page-builder/galleryPicker/MediaField.tsx` | Create | `SingleImageControl` + `MultiImageControl` sidebar triggers. |
| `lib/page-builder/galleryPicker/MediaField.test.tsx` | Create | Value round-trips, clear-to-empty, open/close. |
| `lib/page-builder/editorConfig.tsx` | Modify | Add `imageField`/`imagesField` factories; re-point Image block config to `imageField`. |
| `lib/page-builder/StyleToolkitField.tsx` | Modify | `ImagePanel` swaps `SingleImagePicker` → `SingleImageControl`. |

---

## Task 1: Paginated query helpers

**Files:**
- Modify: `lib/db/queries/gallery.ts` (add after `listItemsForPicker`, ~line 225)
- Test: `lib/db/queries/gallery.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `lib/db/queries/gallery.test.ts` (the file already has `startInMemoryMongo`/`clearCollections` lifecycle, `makeCollection`, `seedItems`):

```ts
import { listCollectionItemsPage, listAllItemsPage, listCollectionNewest } from "./gallery";

describe("listCollectionItemsPage", () => {
  it("returns {items:[], nextCursor:null} for empty workspace or bad collectionId", async () => {
    expect(await listCollectionItemsPage({ workspaceId: "", collectionId: new Types.ObjectId().toString() }))
      .toEqual({ items: [], nextCursor: null });
    expect(await listCollectionItemsPage({ workspaceId: new Types.ObjectId().toString(), collectionId: "nope" }))
      .toEqual({ items: [], nextCursor: null });
  });

  it("paginates by (order,_id) ascending and walks the cursor to the end", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    await seedItems(ws, col._id, 5); // orders 0..4

    const p1 = await listCollectionItemsPage({ workspaceId: ws.toString(), collectionId: col._id.toString(), limit: 2 });
    expect(p1.items.map((i) => i.caption)).toEqual(["Photo 1", "Photo 2"]);
    expect(p1.nextCursor).toBeTruthy();

    const p2 = await listCollectionItemsPage({ workspaceId: ws.toString(), collectionId: col._id.toString(), limit: 2, cursor: p1.nextCursor });
    expect(p2.items.map((i) => i.caption)).toEqual(["Photo 3", "Photo 4"]);

    const p3 = await listCollectionItemsPage({ workspaceId: ws.toString(), collectionId: col._id.toString(), limit: 2, cursor: p2.nextCursor });
    expect(p3.items.map((i) => i.caption)).toEqual(["Photo 5"]);
    expect(p3.nextCursor).toBeNull();
  });

  it("clamps limit to <= 50 and >= 1", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    await seedItems(ws, col._id, 3);
    const page = await listCollectionItemsPage({ workspaceId: ws.toString(), collectionId: col._id.toString(), limit: 9999 });
    expect(page.items).toHaveLength(3);
  });

  it("does not return another workspace's items (tenant isolation)", async () => {
    const wsA = new Types.ObjectId();
    const wsB = new Types.ObjectId();
    const colB = await makeCollection(wsB);
    await seedItems(wsB, colB._id, 3);
    const page = await listCollectionItemsPage({ workspaceId: wsA.toString(), collectionId: colB._id.toString() });
    expect(page.items).toEqual([]);
  });

  it("exposes id and publicId on every item", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    await seedItems(ws, col._id, 1);
    const page = await listCollectionItemsPage({ workspaceId: ws.toString(), collectionId: col._id.toString() });
    expect(page.items[0].id).toBeTruthy();
    expect(page.items[0].publicId).toContain(`ws/${ws}/item0`);
  });
});

describe("listAllItemsPage", () => {
  it("returns newest-first across collections and standalone, paginated", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    // createdAt is set by timestamps; insert sequentially so order is deterministic.
    await seedItems(ws, col._id, 2, 0);            // item0, item1
    await GalleryItem.create({
      workspaceId: ws, collectionId: null,
      cloudinaryPublicId: `ws/${ws}/standalone`, url: "https://x/s.jpg",
      caption: "Standalone", order: 0,
    });

    const p1 = await listAllItemsPage({ workspaceId: ws.toString(), limit: 2 });
    expect(p1.items).toHaveLength(2);
    expect(p1.nextCursor).toBeTruthy();
    // Newest first => the standalone (created last) leads.
    expect(p1.items[0].caption).toBe("Standalone");

    const p2 = await listAllItemsPage({ workspaceId: ws.toString(), limit: 2, cursor: p1.nextCursor });
    expect(p2.items).toHaveLength(1);
    expect(p2.nextCursor).toBeNull();
  });

  it("returns {items:[], nextCursor:null} for empty workspaceId", async () => {
    expect(await listAllItemsPage({ workspaceId: "" })).toEqual({ items: [], nextCursor: null });
  });

  it("only returns the caller workspace's items (tenant isolation)", async () => {
    const wsA = new Types.ObjectId();
    const wsB = new Types.ObjectId();
    const colB = await makeCollection(wsB);
    await seedItems(wsB, colB._id, 4);
    const page = await listAllItemsPage({ workspaceId: wsA.toString() });
    expect(page.items).toEqual([]);
  });
});

describe("listCollectionNewest", () => {
  it("returns the newest N items of a collection, newest-first", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    // Insert sequentially so createdAt is strictly increasing.
    for (let i = 0; i < 5; i++) {
      await GalleryItem.create({
        workspaceId: ws, collectionId: col._id,
        cloudinaryPublicId: `ws/${ws}/n${i}`, url: `https://x/n${i}.jpg`,
        caption: `N${i}`, order: i,
      });
    }
    const items = await listCollectionNewest({ workspaceId: ws.toString(), collectionId: col._id.toString(), limit: 3 });
    expect(items.map((i) => i.caption)).toEqual(["N4", "N3", "N2"]);
  });

  it("clamps limit to the safety cap and returns [] for bad input", async () => {
    expect(await listCollectionNewest({ workspaceId: "", collectionId: new Types.ObjectId().toString(), limit: 5 })).toEqual([]);
    expect(await listCollectionNewest({ workspaceId: new Types.ObjectId().toString(), collectionId: "nope", limit: 5 })).toEqual([]);
  });

  it("does not return another workspace's items (tenant isolation)", async () => {
    const wsA = new Types.ObjectId();
    const wsB = new Types.ObjectId();
    const colB = await makeCollection(wsB);
    await seedItems(wsB, colB._id, 3);
    expect(await listCollectionNewest({ workspaceId: wsA.toString(), collectionId: colB._id.toString(), limit: 10 })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test --run lib/db/queries/gallery.test.ts`
Expected: FAIL — `listCollectionItemsPage`/`listAllItemsPage` are not exported.

- [ ] **Step 3: Implement the helpers**

In `lib/db/queries/gallery.ts`, append after `listItemsForPicker` (keep `PICKER_ITEMS_CAP`, `PickerItem`, and existing exports unchanged):

```ts
// ---------------------------------------------------------------------------
// Paginated picker feeds (owner editor only — back the MediaPicker drill-in)
// ---------------------------------------------------------------------------

const PAGE_DEFAULT = 16;
const PAGE_MAX = 50;

function clampLimit(limit: number | undefined): number {
  const n = Number.isFinite(limit) ? (limit as number) : PAGE_DEFAULT;
  return Math.min(Math.max(1, Math.trunc(n)), PAGE_MAX);
}

// Opaque cursor = base64url of "<sortValue>|<_id>". sortValue is `order` for a
// collection feed (ascending) or createdAt-ms for the "all" feed (descending).
function encodeCursor(sortValue: string | number, id: string): string {
  return Buffer.from(`${sortValue}|${id}`, "utf8").toString("base64url");
}
function decodeCursor(cursor: string): { sortValue: string; id: string } | null {
  try {
    const [sortValue, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!sortValue || !id || !Types.ObjectId.isValid(id)) return null;
    return { sortValue, id };
  } catch {
    return null;
  }
}

function toPickerItem(it: { _id: unknown; cloudinaryPublicId?: unknown; caption?: unknown }): PickerItem {
  const publicId = (it.cloudinaryPublicId as string) ?? "";
  return {
    id: String(it._id),
    publicId,
    thumbUrl: cloudinaryThumbnailUrl(publicId, { width: 200, height: 200 }),
    caption: (it.caption as string) || null,
  };
}

/**
 * One page of a collection's items, ordered by the existing
 * { workspaceId, collectionId, order } index. Cursor pagination on (order,_id)
 * ascending. Foreign/missing collections return an empty page (tenant-safe).
 */
export async function listCollectionItemsPage(opts: {
  workspaceId: string;
  collectionId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<{ items: PickerItem[]; nextCursor: string | null }> {
  const { workspaceId, collectionId } = opts;
  if (!workspaceId || !Types.ObjectId.isValid(collectionId)) return { items: [], nextCursor: null };

  const limit = clampLimit(opts.limit);
  await connectDB();

  const filter: Record<string, unknown> = { workspaceId, collectionId };
  if (opts.cursor) {
    const c = decodeCursor(opts.cursor);
    if (c) {
      const order = Number(c.sortValue);
      if (Number.isFinite(order)) {
        filter.$or = [
          { order: { $gt: order } },
          { order, _id: { $gt: new Types.ObjectId(c.id) } },
        ];
      }
    }
  }

  const docs = await GalleryItem.find(filter)
    .sort({ order: 1, _id: 1 })
    .limit(limit + 1)
    .select({ cloudinaryPublicId: 1, caption: 1, order: 1 })
    .lean();

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.order as number, String(last._id)) : null;
  return { items: page.map(toPickerItem), nextCursor };
}

/**
 * One page of ALL workspace items, newest-first, paginated. Backs the virtual
 * "All photos" collection (covers standalone collectionId:null items too).
 * Cursor pagination on (createdAt,_id) descending. Backed by the new
 * { workspaceId, createdAt } index.
 */
export async function listAllItemsPage(opts: {
  workspaceId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<{ items: PickerItem[]; nextCursor: string | null }> {
  const { workspaceId } = opts;
  if (!workspaceId) return { items: [], nextCursor: null };

  const limit = clampLimit(opts.limit);
  await connectDB();

  const filter: Record<string, unknown> = { workspaceId };
  if (opts.cursor) {
    const c = decodeCursor(opts.cursor);
    if (c) {
      const ms = Number(c.sortValue);
      if (Number.isFinite(ms)) {
        const d = new Date(ms);
        filter.$or = [
          { createdAt: { $lt: d } },
          { createdAt: d, _id: { $lt: new Types.ObjectId(c.id) } },
        ];
      }
    }
  }

  const docs = await GalleryItem.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .select({ cloudinaryPublicId: 1, caption: 1, createdAt: 1 })
    .lean();

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor(new Date(last.createdAt as Date).getTime(), String(last._id)) : null;
  return { items: page.map(toPickerItem), nextCursor };
}

/**
 * The newest `limit` items of one collection, newest-first — backs the
 * "Select all in collection" bulk action (owner wants the latest N). Tenant-safe;
 * foreign/missing collections return []. `limit` is clamped to the safety cap.
 */
export async function listCollectionNewest(opts: {
  workspaceId: string;
  collectionId: string;
  limit: number;
}): Promise<PickerItem[]> {
  const { workspaceId, collectionId } = opts;
  if (!workspaceId || !Types.ObjectId.isValid(collectionId)) return [];

  const limit = Math.min(Math.max(1, Math.trunc(Number.isFinite(opts.limit) ? opts.limit : 1)), PICKER_ITEMS_CAP);
  await connectDB();

  const docs = await GalleryItem.find({ workspaceId, collectionId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .select({ cloudinaryPublicId: 1, caption: 1 })
    .lean();

  return docs.map(toPickerItem);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test --run lib/db/queries/gallery.test.ts`
Expected: PASS (all describe blocks, old + new).

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries/gallery.ts lib/db/queries/gallery.test.ts
git commit -m "feat(gallery): add paginated picker query helpers"
```

---

## Task 2: `{ workspaceId, createdAt }` index for the "All photos" feed

**Files:**
- Modify: `lib/db/models/GalleryItem.ts:26`

- [ ] **Step 1: Add the index**

After the existing `galleryItemSchema.index({ workspaceId: 1, collectionId: 1, order: 1 });` add:

```ts
// Backs the "All photos" picker feed (listAllItemsPage): newest-first paginated.
galleryItemSchema.index({ workspaceId: 1, createdAt: -1 });
```

- [ ] **Step 2: Verify typecheck stays clean**

Run: `pnpm typecheck`
Expected: PASS (no type errors).

- [ ] **Step 3: Commit**

```bash
git add lib/db/models/GalleryItem.ts
git commit -m "feat(gallery): index workspaceId+createdAt for all-photos feed"
```

---

## Task 3: Extend items POST to accept optional `collectionId`

**Files:**
- Modify: `app/api/portfolio/gallery/items/route.ts`
- Test: `app/api/portfolio/gallery/items/route.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `app/api/portfolio/gallery/items/route.test.ts` (reuse its existing mocks/helpers; if it lacks a body-builder, the snippet below is self-contained). The route returns `{ id, thumbUrl, caption }`. Verify a valid `collectionId` lands the item in that collection with the next order; a foreign collection is rejected.

```ts
import { GalleryCollection, GalleryItem } from "@/lib/db/models";

function validBody(wsId: Types.ObjectId, extra: Record<string, unknown> = {}) {
  return {
    cloudinaryPublicId: `gallurio/${wsId}/portfolio/x.jpg`,
    url: "https://res.cloudinary.com/x/x.jpg",
    width: 1200, height: 900, format: "jpg", sizeBytes: 1000,
    ...extra,
  };
}

describe("POST /api/portfolio/gallery/items — collectionId", () => {
  it("creates the item inside a workspace-owned collection with the next order", async () => {
    const col = await GalleryCollection.create({
      workspaceId, name: "C", slug: `c-${Math.round(Math.random() * 1e9)}`, isPublic: true, order: 0,
    });
    await GalleryItem.create({
      workspaceId, collectionId: col._id, cloudinaryPublicId: `gallurio/${workspaceId}/portfolio/a.jpg`,
      url: "https://x/a.jpg", order: 0,
    });

    const req = new Request("http://t", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody(workspaceId, { collectionId: String(col._id) })),
    });
    const res = (await POST(req)) as unknown as MockResp;
    expect(res.status).toBe(201);

    const items = await GalleryItem.find({ workspaceId, collectionId: col._id }).sort({ order: 1 }).lean();
    expect(items).toHaveLength(2);
    expect(items[1].order).toBe(1);
  });

  it("rejects a collectionId from another workspace with 400", async () => {
    const otherWs = await Workspace.create({
      slug: "ws-z", name: "Z", ownerUserId: "user_z",
      clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`, currency: "PHP",
    });
    const foreign = await GalleryCollection.create({
      workspaceId: otherWs._id, name: "F", slug: `f-${Math.round(Math.random() * 1e9)}`, isPublic: true, order: 0,
    });
    const req = new Request("http://t", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody(workspaceId, { collectionId: String(foreign._id) })),
    });
    const res = (await POST(req)) as unknown as MockResp;
    expect(res.status).toBe(400);
    expect(await GalleryItem.countDocuments({ collectionId: foreign._id })).toBe(0);
  });

  it("still creates a standalone item (collectionId:null) when omitted", async () => {
    const req = new Request("http://t", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody(workspaceId)),
    });
    const res = (await POST(req)) as unknown as MockResp;
    expect(res.status).toBe(201);
    const item = await GalleryItem.findOne({ workspaceId }).lean();
    expect(item?.collectionId).toBeNull();
  });
});
```

> If `route.test.ts` does not already import `POST`, `Workspace`, `workspaceId`, `MockResp`, or set up the standard mocks (`next/server`, `connectDB`, `requireOrg`) + in-memory mongo lifecycle, mirror the setup block from `collections/[id]/route.test.ts` (lines 1–95) at the top of the file first.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test --run app/api/portfolio/gallery/items/route.test.ts`
Expected: FAIL — `collectionId` is ignored; item is created standalone, order/collection assertions fail.

- [ ] **Step 3: Implement the optional `collectionId`**

In `app/api/portfolio/gallery/items/route.ts`:

Add `isValidObjectId` to the mongoose import and `GalleryCollection` to the models import:

```ts
import { isValidObjectId } from "mongoose";
import { GalleryCollection, GalleryItem } from "@/lib/db/models";
```

Extend `bodySchema` with an optional `collectionId`:

```ts
const bodySchema = z.object({
  cloudinaryPublicId: z.string().min(1).max(300),
  url: z.string().url().max(1000),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
  format: z.string().max(20).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  caption: z.string().max(300).optional(),
  altText: z.string().max(300).optional(),
  collectionId: z.string().min(1).max(64).optional(),
});
```

Replace the order-assignment + create block (currently the `existingCount`/`GalleryItem.create` section) with collection-aware logic:

```ts
  await connectDB();

  // Resolve an optional collection — must be a valid id owned by THIS workspace.
  let collectionId: typeof workspaceId | null = null;
  if (parsed.data.collectionId) {
    if (!isValidObjectId(parsed.data.collectionId)) {
      return NextResponse.json({ error: "invalid_collection" }, { status: 400 });
    }
    const collection = await GalleryCollection.findOne({
      _id: parsed.data.collectionId,
      workspaceId,
    })
      .select({ _id: 1 })
      .lean();
    if (!collection) {
      return NextResponse.json({ error: "invalid_collection" }, { status: 400 });
    }
    collectionId = collection._id;
  }

  // Next order index within the target scope (collection or standalone).
  const existingCount = await GalleryItem.countDocuments({ workspaceId, collectionId });

  const item = await GalleryItem.create({
    workspaceId,
    collectionId,
    cloudinaryPublicId: parsed.data.cloudinaryPublicId,
    url: parsed.data.url,
    width: parsed.data.width ?? null,
    height: parsed.data.height ?? null,
    format: parsed.data.format ?? null,
    sizeBytes: parsed.data.sizeBytes ?? 0,
    caption: parsed.data.caption ?? "",
    altText: parsed.data.altText ?? "",
    order: existingCount,
  });
```

(The `prefixCheck` ownership guard on `cloudinaryPublicId` and `validatePhotoMeta` call above it stay exactly as they are. The `thumbUrl`/response block below stays unchanged.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test --run app/api/portfolio/gallery/items/route.test.ts`
Expected: PASS (old + new).

- [ ] **Step 5: Commit**

```bash
git add app/api/portfolio/gallery/items/route.ts app/api/portfolio/gallery/items/route.test.ts
git commit -m "feat(gallery): items POST accepts optional collectionId"
```

---

## Task 4: Collection-items GET endpoint (+ `all` sentinel)

**Files:**
- Modify: `app/api/portfolio/gallery/collections/[id]/route.ts`
- Test: `app/api/portfolio/gallery/collections/[id]/route.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

The existing test file already mocks `next/server`, `connectDB`, `requireOrg` (mutable `mockCtx`), `cloudinary`, and sets up in-memory mongo + `seedCollectionWithItems`. Append:

```ts
import { GET } from "./route";

describe("GET /api/portfolio/gallery/collections/[id]", () => {
  it("rejects a non-owner with 403", async () => {
    const col = await seedCollectionWithItems(workspaceId, 2);
    mockCtx.role = "staff";
    const res = (await GET(new Request("http://t/?limit=16"), makeParams(String(col._id)))) as unknown as MockResp;
    expect(res.status).toBe(403);
  });

  it("returns 400 for an invalid (non-'all') id", async () => {
    const res = (await GET(new Request("http://t"), makeParams("not-an-id"))) as unknown as MockResp;
    expect(res.status).toBe(400);
  });

  it("returns a collection's items, paginated by cursor", async () => {
    const col = await seedCollectionWithItems(workspaceId, 5); // orders 0..4
    const r1 = (await GET(new Request("http://t/?limit=2"), makeParams(String(col._id)))) as unknown as MockResp;
    const b1 = r1.body as { items: { id: string }[]; nextCursor: string | null };
    expect(b1.items).toHaveLength(2);
    expect(b1.nextCursor).toBeTruthy();

    const r2 = (await GET(
      new Request(`http://t/?limit=2&cursor=${encodeURIComponent(b1.nextCursor!)}`),
      makeParams(String(col._id))
    )) as unknown as MockResp;
    expect((r2.body as { items: unknown[] }).items).toHaveLength(2);
  });

  it("cannot read another workspace's collection items (tenant isolation)", async () => {
    const otherWs = await Workspace.create({
      slug: "ws-c", name: "C", ownerUserId: "user_c",
      clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`, currency: "PHP",
    });
    const foreign = await seedCollectionWithItems(otherWs._id, 3);
    const res = (await GET(new Request("http://t/?limit=16"), makeParams(String(foreign._id)))) as unknown as MockResp;
    expect(res.status).toBe(200);
    expect((res.body as { items: unknown[] }).items).toEqual([]);
  });

  it("serves the virtual 'all' feed newest-first across collections", async () => {
    await seedCollectionWithItems(workspaceId, 2);
    await GalleryItem.create({
      workspaceId, collectionId: null,
      cloudinaryPublicId: `gallurio/${workspaceId}/portfolio/last.jpg`,
      url: "https://x/last.jpg", caption: "Last", order: 0,
    });
    const res = (await GET(new Request("http://t/?limit=10"), makeParams("all"))) as unknown as MockResp;
    expect(res.status).toBe(200);
    const body = res.body as { items: { caption: string | null }[] };
    expect(body.items.length).toBeGreaterThanOrEqual(3);
    expect(body.items[0].caption).toBe("Last"); // newest-first
  });

  it("?newest=N returns the newest N of a collection (bulk select), nextCursor null", async () => {
    const col = await seedCollectionWithItems(workspaceId, 5); // orders 0..4, createdAt increasing
    const res = (await GET(new Request("http://t/?newest=2"), makeParams(String(col._id)))) as unknown as MockResp;
    expect(res.status).toBe(200);
    const body = res.body as { items: unknown[]; nextCursor: string | null };
    expect(body.items).toHaveLength(2);
    expect(body.nextCursor).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test --run "app/api/portfolio/gallery/collections/[id]/route.test.ts"`
Expected: FAIL — `GET` is not exported from `./route`.

- [ ] **Step 3: Implement the GET handler**

In `app/api/portfolio/gallery/collections/[id]/route.ts`, add the query-helper import and the `GET` export (keep the entire existing `DELETE` handler unchanged):

```ts
import { listCollectionItemsPage, listAllItemsPage, listCollectionNewest } from "@/lib/db/queries/gallery";
```

```ts
/**
 * GET /api/portfolio/gallery/collections/[id]/items?cursor=<c>&limit=16
 *
 * Owner-only paginated feed of a collection's photos for the MediaPicker.
 * `id="all"` is a virtual sentinel: newest-first across the whole workspace
 * (covers standalone collectionId:null items). Tenant-scoped — a foreign or
 * missing collection resolves to an empty page.
 *
 * Response: { items: PickerItem[]; nextCursor: string | null }
 */
export async function GET(req: Request, { params }: Params) {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") {
    return NextResponse.json({ error: "owner_only" }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw == null ? undefined : Number(limitRaw);
  const newestRaw = searchParams.get("newest");
  const workspaceId = ctx.workspace._id.toString();

  if (id === "all") {
    const page = await listAllItemsPage({ workspaceId, cursor, limit });
    return NextResponse.json(page);
  }

  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  // Bulk "select all in collection": the newest N items, no pagination.
  if (newestRaw != null) {
    const items = await listCollectionNewest({ workspaceId, collectionId: id, limit: Number(newestRaw) });
    return NextResponse.json({ items, nextCursor: null });
  }

  const page = await listCollectionItemsPage({ workspaceId, collectionId: id, cursor, limit });
  return NextResponse.json(page);
}
```

> Note: the route lives at `collections/[id]/route.ts`. The spec's URL shows `/collections/[id]/items`; since Next App Router maps this file to `/collections/[id]`, the picker calls `GET /api/portfolio/gallery/collections/<id>?cursor=&limit=` (and `<id>=all` for the virtual feed). Keep the picker's fetch URL consistent with this in Task 5.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test --run "app/api/portfolio/gallery/collections/[id]/route.test.ts"`
Expected: PASS (DELETE + GET).

- [ ] **Step 5: Commit**

```bash
git add "app/api/portfolio/gallery/collections/[id]/route.ts" "app/api/portfolio/gallery/collections/[id]/route.test.ts"
git commit -m "feat(gallery): paginated collection items GET with all sentinel"
```

---

## Task 5: `MediaPicker` modal

**Files:**
- Create: `lib/page-builder/galleryPicker/MediaPicker.tsx`
- Test: `lib/page-builder/galleryPicker/MediaPicker.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `lib/page-builder/galleryPicker/MediaPicker.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MediaPicker } from "./MediaPicker";
import { __clearPickerDataCache } from "./usePickerData";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const collections = [
  { id: "col1", name: "Weddings", coverUrl: "https://x/c1.jpg", itemCount: 3 },
];
const colItems = [
  { id: "a", publicId: "pid-a", thumbUrl: "https://x/a.jpg", caption: "A" },
  { id: "b", publicId: "pid-b", thumbUrl: "https://x/b.jpg", caption: "B" },
];

// Route fetch by URL: picker-data (/api/portfolio/gallery) vs paginated feed.
function routeFetch(url: string) {
  if (url === "/api/portfolio/gallery") {
    return Promise.resolve({ ok: true, json: async () => ({ collections, items: colItems }) } as Response);
  }
  // collection or "all" feed
  return Promise.resolve({ ok: true, json: async () => ({ items: colItems, nextCursor: null }) } as Response);
}

beforeEach(() => {
  __clearPickerDataCache();
  mockFetch.mockReset();
  mockFetch.mockImplementation((u: string) => routeFetch(u));
});

describe("MediaPicker", () => {
  it("renders the collection grid with the pinned 'All photos' entry", async () => {
    render(<MediaPicker mode="single" value="" onChange={vi.fn()} open onOpenChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /all photos/i })).toBeTruthy());
    expect(screen.getByRole("button", { name: /weddings/i })).toBeTruthy();
  });

  it("single mode: picking a photo calls onChange(publicId) and closes", async () => {
    const onChange = vi.fn();
    const onOpenChange = vi.fn();
    render(<MediaPicker mode="single" value="" onChange={onChange} open onOpenChange={onOpenChange} />);
    fireEvent.click(await screen.findByRole("button", { name: /weddings/i }));
    fireEvent.click(await screen.findByRole("option", { name: /^A/ }));
    expect(onChange).toHaveBeenCalledWith("pid-a");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("multi mode: toggling appends {id,publicId} and respects max", async () => {
    const onChange = vi.fn();
    render(<MediaPicker mode="multi" max={1} value={[]} onChange={onChange} open onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /weddings/i }));
    fireEvent.click(await screen.findByRole("option", { name: /^A/ }));
    expect(onChange).toHaveBeenCalledWith([{ id: "a", publicId: "pid-a" }]);
  });

  it("multi mode: 'select all on page' respects max (newest/page order, capped)", async () => {
    const onChange = vi.fn();
    render(<MediaPicker mode="multi" max={1} value={[]} onChange={onChange} open onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /weddings/i }));
    fireEvent.click(await screen.findByRole("button", { name: /select all on page/i }));
    expect(onChange).toHaveBeenCalledWith([{ id: "a", publicId: "pid-a" }]);
  });

  it("multi mode: 'select all in collection' fetches newest-N and sets selection (capped)", async () => {
    const onChange = vi.fn();
    render(<MediaPicker mode="multi" max={2} value={[]} onChange={onChange} open onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /weddings/i }));
    fireEvent.click(await screen.findByRole("button", { name: /select all in collection/i }));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        { id: "a", publicId: "pid-a" },
        { id: "b", publicId: "pid-b" },
      ])
    );
    // The bulk fetch hit the ?newest= endpoint.
    expect(mockFetch.mock.calls.some(([u]) => String(u).includes("newest="))).toBe(true);
  });

  it("hides 'select all in collection' on the All photos feed", async () => {
    render(<MediaPicker mode="multi" value={[]} onChange={vi.fn()} open onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /all photos/i }));
    await waitFor(() => screen.getByRole("button", { name: /select all on page/i }));
    expect(screen.queryByRole("button", { name: /select all in collection/i })).toBeNull();
  });

  it("renders the empty-workspace state with an upload affordance", async () => {
    mockFetch.mockImplementation((u: string) =>
      u === "/api/portfolio/gallery"
        ? Promise.resolve({ ok: true, json: async () => ({ collections: [], items: [] }) } as Response)
        : Promise.resolve({ ok: true, json: async () => ({ items: [], nextCursor: null }) } as Response)
    );
    render(<MediaPicker mode="single" value="" onChange={vi.fn()} open onOpenChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/no photos yet/i)).toBeTruthy());
  });

  it("shows error + retry when picker data fails", async () => {
    mockFetch.mockImplementation((u: string) =>
      u === "/api/portfolio/gallery" ? Promise.reject(new Error("net")) : routeFetch(u)
    );
    render(<MediaPicker mode="single" value="" onChange={vi.fn()} open onOpenChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/could not load/i)).toBeTruthy());
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  });

  it("does not render its dialog content when closed", () => {
    render(<MediaPicker mode="single" value="" onChange={vi.fn()} open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /all photos/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test --run lib/page-builder/galleryPicker/MediaPicker.test.tsx`
Expected: FAIL — `MediaPicker` does not exist.

- [ ] **Step 3: Implement `MediaPicker`**

Create `lib/page-builder/galleryPicker/MediaPicker.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  GripVerticalIcon,
  ImagePlusIcon,
  Loader2Icon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { validatePhotoFile } from "@/lib/page-builder/photoSpec";
import { uploadImageToCloudinary } from "@/lib/storage/uploadToCloudinary.client";
import { usePickerData } from "./usePickerData";
import { CreateCollectionDialog } from "./CreateCollectionDialog";
import type { PickerCollection, PickerItem } from "./types";

// Plain strings — the Puck field panel is not wrapped in an IntlProvider.
const L = {
  title: "Choose photos",
  titleSingle: "Choose a photo",
  back: "Back to collections",
  allPhotos: "All photos",
  createCollection: "New collection",
  loading: "Loading…",
  loadMore: "Load more",
  error: "Could not load photos.",
  retry: "Retry",
  emptyWorkspace: "No photos yet — upload below.",
  emptyCollection: "This collection is empty — upload below.",
  selectAllPage: "Select all on page",
  selectAllCollection: "Select all in collection",
  clearAll: "Clear selection",
  done: "Done",
  photos: (n: number) => `${n} photo${n === 1 ? "" : "s"}`,
  selectedCount: (n: number, max?: number) => (max ? `${n}/${max} selected` : `${n} selected`),
  dragHint: "Drag to reorder",
  removePhoto: "Remove photo",
  uploadHere: "Upload photo",
  uploading: "Uploading…",
  dropActive: "Drop to upload",
  errType: "Only JPEG, PNG, WebP, and AVIF photos are accepted.",
  errSize: "Each photo must be under 10 MB.",
  errDim: "Photos must be at least 600px on the shorter side.",
  errUpload: "Some photos failed to upload.",
};

const ALL_PHOTOS_ID = "all";
const PAGE_SIZE = 16;
const SAFETY_CAP = 60;

export type MediaPickerSelection = { id: string; publicId: string };
export type MediaPickerValue = string | MediaPickerSelection[];

type Props = {
  mode: "single" | "multi";
  /** single: publicId string (""=none). multi: ordered [{id,publicId}]. */
  value: MediaPickerValue;
  onChange: (next: MediaPickerValue) => void;
  /** multi only: hard cap on selections. */
  max?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Nav = { kind: "collections" } | { kind: "photos"; id: string; name: string };

type FeedState = {
  items: PickerItem[];
  nextCursor: string | null;
  loading: boolean;
  error: boolean;
};

const EMPTY_FEED: FeedState = { items: [], nextCursor: null, loading: false, error: false };

function asSelection(value: MediaPickerValue): MediaPickerSelection[] {
  return Array.isArray(value) ? value : [];
}

export function MediaPicker({ mode, value, onChange, max, open, onOpenChange }: Props) {
  const { state, retry } = usePickerData();
  const [nav, setNav] = useState<Nav>({ kind: "collections" });
  const [feed, setFeed] = useState<FeedState>(EMPTY_FEED);
  const [createOpen, setCreateOpen] = useState(false);

  // Upload state (scoped to the open collection / all feed).
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Accumulated id->item map so the multi reorder strip can resolve thumbnails
  // for selections regardless of which page/collection they came from.
  const seen = useRef<Map<string, PickerItem>>(new Map());
  const remember = useCallback((items: PickerItem[]) => {
    for (const it of items) seen.current.set(it.id, it);
  }, []);

  const selection = asSelection(value);

  // Reset navigation each time the modal opens.
  useEffect(() => {
    if (open) {
      setNav({ kind: "collections" });
      setFeed(EMPTY_FEED);
      setUploadError(null);
    }
  }, [open]);

  // Seed the seen-map from picker data so existing selections resolve.
  useEffect(() => {
    if (state.status === "ok") remember(state.data.items);
  }, [state, remember]);

  const fetchFeed = useCallback(
    async (id: string, cursor: string | null) => {
      setFeed((f) => ({ ...f, loading: true, error: false }));
      try {
        const qs = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (cursor) qs.set("cursor", cursor);
        const res = await fetch(`/api/portfolio/gallery/collections/${id}?${qs.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { items: PickerItem[]; nextCursor: string | null };
        remember(data.items);
        setFeed((f) => ({
          items: cursor ? [...f.items, ...data.items] : data.items,
          nextCursor: data.nextCursor,
          loading: false,
          error: false,
        }));
      } catch {
        setFeed((f) => ({ ...f, loading: false, error: true }));
      }
    },
    [remember]
  );

  function openCollection(id: string, name: string) {
    setNav({ kind: "photos", id, name });
    setFeed(EMPTY_FEED);
    setUploadError(null);
    void fetchFeed(id, null);
  }

  function goBack() {
    setNav({ kind: "collections" });
    setFeed(EMPTY_FEED);
  }

  // -------------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------------

  function pickSingle(item: PickerItem) {
    onChange(item.publicId);
    onOpenChange(false);
  }

  function toggleMulti(item: PickerItem) {
    const exists = selection.some((s) => s.id === item.id);
    if (exists) {
      onChange(selection.filter((s) => s.id !== item.id));
      return;
    }
    if (max != null && selection.length >= max) return;
    onChange([...selection, { id: item.id, publicId: item.publicId }]);
  }

  function selectAllOnPage() {
    const cap = max ?? SAFETY_CAP;
    const next = [...selection];
    for (const it of feed.items) {
      if (next.length >= cap) break;
      if (!next.some((s) => s.id === it.id)) next.push({ id: it.id, publicId: it.publicId });
    }
    onChange(next);
  }

  // "Select all in collection" — the newest `cap` items across ALL pages,
  // fetched server-side (newest-first). Display order stays collection-`order`;
  // bulk-select is intentionally newest-first (owner wants the latest N).
  const [bulkLoading, setBulkLoading] = useState(false);
  async function selectAllInCollection() {
    if (nav.kind !== "photos" || nav.id === ALL_PHOTOS_ID) return;
    const cap = max ?? SAFETY_CAP;
    setBulkLoading(true);
    try {
      const res = await fetch(`/api/portfolio/gallery/collections/${nav.id}?newest=${cap}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: PickerItem[] };
      remember(data.items);
      onChange(data.items.slice(0, cap).map((it) => ({ id: it.id, publicId: it.publicId })));
    } catch {
      // Non-fatal: leave the current selection untouched.
    } finally {
      setBulkLoading(false);
    }
  }

  function clearSelection() {
    onChange([]);
  }

  function reorder(fromId: string, toId: string) {
    if (fromId === toId) return;
    const copy = [...selection];
    const fi = copy.findIndex((s) => s.id === fromId);
    const ti = copy.findIndex((s) => s.id === toId);
    if (fi === -1 || ti === -1) return;
    const [moved] = copy.splice(fi, 1);
    copy.splice(ti, 0, moved);
    onChange(copy);
  }

  // -------------------------------------------------------------------------
  // Upload (into the open collection, or standalone when on "All photos")
  // -------------------------------------------------------------------------

  async function handleFiles(files: FileList | null) {
    if (!files || nav.kind !== "photos") return;
    const valid: File[] = [];
    let typeErr = false;
    let sizeErr = false;
    Array.from(files).forEach((f) => {
      const check = validatePhotoFile(f);
      if (!check.ok) {
        if (check.reason === "type_not_accepted") typeErr = true;
        else sizeErr = true;
      } else valid.push(f);
    });
    if (valid.length === 0) {
      setUploadError(typeErr ? L.errType : sizeErr ? L.errSize : null);
      return;
    }

    setUploading(true);
    setUploadError(null);
    const results = await Promise.allSettled(
      valid.map((file) => uploadImageToCloudinary(file, { subfolder: "portfolio" }))
    );

    let dimErr = false;
    let generalErr = false;
    const targetCollection = nav.id === ALL_PHOTOS_ID ? undefined : nav.id;

    for (const r of results) {
      if (r.status === "rejected") {
        if ((r.reason instanceof Error ? r.reason.message : "") === "dimension_too_small") dimErr = true;
        else generalErr = true;
        continue;
      }
      try {
        const createRes = await fetch("/api/portfolio/gallery/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...r.value, collectionId: targetCollection }),
        });
        if (!createRes.ok) throw new Error(`HTTP ${createRes.status}`);
        const created = (await createRes.json()) as { id: string; thumbUrl: string; caption: string | null };
        const item: PickerItem = {
          id: created.id,
          publicId: r.value.cloudinaryPublicId,
          thumbUrl: created.thumbUrl,
          caption: created.caption,
        };
        remember([item]);
        setFeed((f) => ({ ...f, items: [item, ...f.items] }));
      } catch {
        generalErr = true;
      }
    }

    setUploading(false);
    if (dimErr) setUploadError(L.errDim);
    else if (generalErr) setUploadError(L.errUpload);
    if (fileInputRef.current) fileInputRef.current.value = "";
    retry(); // refresh collection covers/counts
  }

  // -------------------------------------------------------------------------
  // Derived render data
  // -------------------------------------------------------------------------

  const collections: PickerCollection[] = state.status === "ok" ? state.data.collections : [];
  const isSelected = (id: string) =>
    mode === "single" ? false : selection.some((s) => s.id === id);
  const orderOf = (id: string) => selection.findIndex((s) => s.id === id) + 1;

  const selectionItems = useMemo(
    () =>
      selection.map((s) => ({
        ...s,
        item: seen.current.get(s.id) ?? null,
      })),
    [selection]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] w-full max-w-[calc(100%-1rem)] flex-col overflow-hidden sm:h-[80vh] sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {nav.kind === "photos" && (
              <button
                type="button"
                onClick={goBack}
                aria-label={L.back}
                className="inline-flex size-7 items-center justify-center border border-border hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <ArrowLeftIcon className="size-4" aria-hidden />
              </button>
            )}
            <DialogTitle>{nav.kind === "photos" ? nav.name : mode === "single" ? L.titleSingle : L.title}</DialogTitle>
          </div>
        </DialogHeader>

        {/* Multi reorder strip */}
        {mode === "multi" && selection.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">
              {L.selectedCount(selection.length, max)} · {L.dragHint}
            </p>
            <ul className="flex flex-wrap gap-2" aria-label="Selected photos (drag to reorder)">
              {selectionItems.map(({ id, item }) => (
                <ReorderChip key={id} id={id} item={item} onReorder={reorder} onRemove={() => onChange(selection.filter((s) => s.id !== id))} />
              ))}
            </ul>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {state.status === "loading" && <CenterSpinner label={L.loading} />}
          {state.status === "error" && <ErrorRetry onRetry={retry} />}

          {state.status === "ok" && nav.kind === "collections" && (
            <CollectionGrid
              collections={collections}
              hasAnyPhotos={state.data.items.length > 0 || collections.some((c) => c.itemCount > 0)}
              onOpen={openCollection}
              onCreate={() => setCreateOpen(true)}
            />
          )}

          {state.status === "ok" && nav.kind === "photos" && (
            <PhotoGrid
              feed={feed}
              mode={mode}
              isSelected={isSelected}
              orderOf={orderOf}
              onPickSingle={pickSingle}
              onToggleMulti={toggleMulti}
              onLoadMore={() => nav.kind === "photos" && feed.nextCursor && fetchFeed(nav.id, feed.nextCursor)}
              emptyLabel={nav.id === ALL_PHOTOS_ID ? L.emptyWorkspace : L.emptyCollection}
              uploadSlot={
                <UploadZone
                  uploading={uploading}
                  error={uploadError}
                  inputRef={fileInputRef}
                  onFiles={handleFiles}
                />
              }
            />
          )}
        </div>

        {/* Multi bulk actions + footer */}
        <DialogFooter className="items-center sm:justify-between">
          {mode === "multi" && nav.kind === "photos" ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={selectAllOnPage} disabled={feed.items.length === 0}>
                {L.selectAllPage}
              </Button>
              {nav.id !== ALL_PHOTOS_ID && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAllInCollection}
                  loading={bulkLoading}
                  disabled={bulkLoading || feed.items.length === 0}
                >
                  {L.selectAllCollection}
                </Button>
              )}
              {selection.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                  {L.clearAll}
                </Button>
              )}
            </div>
          ) : (
            <span />
          )}
          {mode === "multi" && (
            <Button type="button" onClick={() => onOpenChange(false)}>
              {L.done}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      <CreateCollectionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          setCreateOpen(false);
          retry();
        }}
      />
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CenterSpinner({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2Icon className="size-4 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

function ErrorRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10">
      <p className="text-sm text-destructive">{L.error}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-xs underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
      >
        {L.retry}
      </button>
    </div>
  );
}

function CollectionGrid({
  collections,
  hasAnyPhotos,
  onOpen,
  onCreate,
}: {
  collections: PickerCollection[];
  hasAnyPhotos: boolean;
  onOpen: (id: string, name: string) => void;
  onCreate: () => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-2 p-1 sm:grid-cols-4" role="listbox" aria-label="Collections">
      {/* Virtual 'All photos', pinned first */}
      <li role="option" aria-selected={false}>
        <button
          type="button"
          onClick={() => onOpen(ALL_PHOTOS_ID, L.allPhotos)}
          className="flex w-full flex-col overflow-hidden border border-border text-left hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span className="flex aspect-square w-full items-center justify-center bg-muted">
            <ImagePlusIcon className="size-6 text-muted-foreground" aria-hidden />
          </span>
          <span className="px-2 py-1.5 text-xs font-medium">{L.allPhotos}</span>
        </button>
      </li>

      {collections.map((col) => (
        <li key={col.id} role="option" aria-selected={false}>
          <button
            type="button"
            onClick={() => onOpen(col.id, col.name)}
            aria-label={col.name}
            className="flex w-full flex-col overflow-hidden border border-border text-left hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <span className="relative aspect-square w-full overflow-hidden bg-muted">
              {col.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={col.coverUrl} alt="" className="size-full object-cover" loading="lazy" />
              ) : (
                <span className="flex size-full items-center justify-center">
                  <ImagePlusIcon className="size-6 text-muted-foreground" aria-hidden />
                </span>
              )}
            </span>
            <span className="flex flex-col gap-0.5 px-2 py-1.5">
              <span className="truncate text-xs font-medium">{col.name}</span>
              <span className="text-xs text-muted-foreground">{L.photos(col.itemCount)}</span>
            </span>
          </button>
        </li>
      ))}

      {/* Create collection */}
      <li>
        <button
          type="button"
          onClick={onCreate}
          className="flex aspect-square w-full flex-col items-center justify-center gap-1 border border-dashed border-border text-xs text-muted-foreground hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <PlusIcon className="size-5" aria-hidden />
          {L.createCollection}
        </button>
      </li>

      {!hasAnyPhotos && (
        <li className="col-span-full py-4 text-center text-sm text-muted-foreground">{L.emptyWorkspace}</li>
      )}
    </ul>
  );
}

function PhotoGrid({
  feed,
  mode,
  isSelected,
  orderOf,
  onPickSingle,
  onToggleMulti,
  onLoadMore,
  emptyLabel,
  uploadSlot,
}: {
  feed: FeedState;
  mode: "single" | "multi";
  isSelected: (id: string) => boolean;
  orderOf: (id: string) => number;
  onPickSingle: (item: PickerItem) => void;
  onToggleMulti: (item: PickerItem) => void;
  onLoadMore: () => void;
  emptyLabel: string;
  uploadSlot: React.ReactNode;
}) {
  if (feed.error) return <ErrorRetry onRetry={onLoadMore} />;

  return (
    <div className="flex flex-col gap-3 p-1">
      {feed.items.length === 0 && !feed.loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4" role="listbox" aria-label="Photos">
          {feed.items.map((item) => {
            const selected = isSelected(item.id);
            return (
              <li key={item.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => (mode === "single" ? onPickSingle(item) : onToggleMulti(item))}
                  aria-label={`${item.caption || "Photo"}${selected ? " — selected" : ""}`}
                  className={cn(
                    "relative block aspect-square w-full overflow-hidden border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    selected ? "border-foreground" : "border-border hover:bg-accent/40"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.thumbUrl} alt="" className="size-full object-cover" loading="lazy" />
                  {selected && (
                    <span className="absolute right-1 top-1 inline-flex size-5 items-center justify-center bg-foreground text-xs font-bold text-background">
                      {mode === "multi" ? orderOf(item.id) : "✓"}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {feed.loading && <CenterSpinner label={L.loading} />}

      {feed.nextCursor && !feed.loading && (
        <Button type="button" variant="outline" size="sm" className="self-center" onClick={onLoadMore}>
          {L.loadMore}
        </Button>
      )}

      {uploadSlot}
    </div>
  );
}

function UploadZone({
  uploading,
  error,
  inputRef,
  onFiles,
}: {
  uploading: boolean;
  error: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFiles: (files: FileList | null) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label={dragOver ? L.dropActive : L.uploadHere}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={cn(
          "flex min-h-14 cursor-pointer items-center justify-center gap-2 border border-dashed p-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          dragOver ? "border-foreground bg-accent/30" : "border-border text-muted-foreground hover:bg-accent/20"
        )}
      >
        {uploading ? (
          <>
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            {L.uploading}
          </>
        ) : (
          <>
            <ImagePlusIcon className="size-4" aria-hidden />
            {dragOver ? L.dropActive : L.uploadHere}
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => onFiles(e.target.files)}
      />
      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function ReorderChip({
  id,
  item,
  onReorder,
  onRemove,
}: {
  id: string;
  item: PickerItem | null;
  onReorder: (fromId: string, toId: string) => void;
  onRemove: () => void;
}) {
  return (
    <li
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const from = e.dataTransfer.getData("text/plain");
        if (from) onReorder(from, id);
      }}
      className="relative aspect-square w-16 shrink-0 overflow-hidden border border-border"
    >
      {item ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.thumbUrl} alt="" className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center bg-muted text-xs text-muted-foreground">?</span>
      )}
      <span aria-hidden className="absolute left-0.5 top-0.5 flex size-5 items-center justify-center bg-background/80">
        <GripVerticalIcon className="size-3.5 text-muted-foreground" />
      </span>
      <button
        type="button"
        aria-label={L.removePhoto}
        onClick={onRemove}
        className="absolute right-0.5 top-0.5 inline-flex size-5 items-center justify-center border border-border bg-background/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <XIcon className="size-3" aria-hidden />
      </button>
    </li>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test --run lib/page-builder/galleryPicker/MediaPicker.test.tsx`
Expected: PASS. If the base-ui Dialog renders content even when `open={false}` in jsdom, adjust the "does not render when closed" assertion to query within the portal; the component itself is correct (base-ui only mounts the popup when open).

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/galleryPicker/MediaPicker.tsx lib/page-builder/galleryPicker/MediaPicker.test.tsx
git commit -m "feat(picker): MediaPicker modal (single + multi)"
```

---

## Task 6: Sidebar controls + Puck field adapters

**Files:**
- Create: `lib/page-builder/galleryPicker/MediaField.tsx`
- Test: `lib/page-builder/galleryPicker/MediaField.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `lib/page-builder/galleryPicker/MediaField.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SingleImageControl, MultiImageControl } from "./MediaField";
import { __clearPickerDataCache } from "./usePickerData";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const items = [
  { id: "a", publicId: "pid-a", thumbUrl: "https://x/a.jpg", caption: "A" },
  { id: "b", publicId: "pid-b", thumbUrl: "https://x/b.jpg", caption: "B" },
];

beforeEach(() => {
  __clearPickerDataCache();
  mockFetch.mockReset();
  mockFetch.mockImplementation((u: string) =>
    u === "/api/portfolio/gallery"
      ? Promise.resolve({ ok: true, json: async () => ({ collections: [], items }) } as Response)
      : Promise.resolve({ ok: true, json: async () => ({ items, nextCursor: null }) } as Response)
  );
});

describe("SingleImageControl", () => {
  it("shows 'Choose photo' when empty and opens the picker", async () => {
    render(<SingleImageControl value="" onChange={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: /choose photo/i });
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole("button", { name: /all photos/i })).toBeTruthy());
  });

  it("renders the current thumbnail and clears to empty", async () => {
    const onChange = vi.fn();
    render(<SingleImageControl value="pid-a" onChange={onChange} />);
    await waitFor(() => screen.getByRole("button", { name: /clear/i }));
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});

describe("MultiImageControl", () => {
  it("shows the count and opens the picker", async () => {
    render(<MultiImageControl value={[{ id: "a", publicId: "pid-a" }]} onChange={vi.fn()} />);
    expect(screen.getByText(/1 photo/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /choose photos/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /all photos/i })).toBeTruthy());
  });

  it("round-trips an ordered array value", () => {
    render(<MultiImageControl value={[{ id: "a", publicId: "pid-a" }, { id: "b", publicId: "pid-b" }]} onChange={vi.fn()} />);
    expect(screen.getByText(/2 photos/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test --run lib/page-builder/galleryPicker/MediaField.test.tsx`
Expected: FAIL — `MediaField` does not exist.

- [ ] **Step 3: Implement the controls**

Create `lib/page-builder/galleryPicker/MediaField.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { ImageIcon, ImagePlusIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePickerData } from "./usePickerData";
import { MediaPicker, type MediaPickerSelection } from "./MediaPicker";
import type { PickerItem } from "./types";

const L = {
  choosePhoto: "Choose photo",
  changePhoto: "Change photo",
  choosePhotos: "Choose photos",
  clear: "Clear",
  none: "No photo selected",
  selected: "Photo selected",
  count: (n: number) => `${n} photo${n === 1 ? "" : "s"} selected`,
};

/** Resolves a thumbUrl for a publicId/id from the cached picker items, if loaded. */
function useThumbLookup() {
  const { state } = usePickerData();
  return useMemo(() => {
    const byPublicId = new Map<string, PickerItem>();
    const byId = new Map<string, PickerItem>();
    if (state.status === "ok") {
      for (const it of state.data.items) {
        byPublicId.set(it.publicId, it);
        byId.set(it.id, it);
      }
    }
    return { byPublicId, byId };
  }, [state]);
}

export function SingleImageControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const { byPublicId } = useThumbLookup();
  const thumb = value ? byPublicId.get(value)?.thumbUrl ?? null : null;

  return (
    <div className="flex items-center gap-3">
      <div className="relative size-14 shrink-0 overflow-hidden border border-border bg-muted">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center">
            <ImageIcon className="size-5 text-muted-foreground" aria-hidden />
          </span>
        )}
      </div>
      <div className="flex flex-col items-start gap-1">
        <span className="text-xs text-muted-foreground">{value ? L.selected : L.none}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <ImagePlusIcon className="size-3.5" aria-hidden />
            {value ? L.changePhoto : L.choosePhoto}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
            >
              <XIcon className="size-3" aria-hidden />
              {L.clear}
            </button>
          )}
        </div>
      </div>

      <MediaPicker
        mode="single"
        value={value}
        onChange={(v) => onChange(v as string)}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}

export function MultiImageControl({
  value,
  onChange,
  max,
}: {
  value: MediaPickerSelection[];
  onChange: (v: MediaPickerSelection[]) => void;
  max?: number;
}) {
  const [open, setOpen] = useState(false);
  const { byId } = useThumbLookup();
  const selection = Array.isArray(value) ? value : [];

  return (
    <div className="flex flex-col gap-2">
      {selection.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected photos">
          {selection.slice(0, 6).map((s) => {
            const thumb = byId.get(s.id)?.thumbUrl ?? null;
            return (
              <li key={s.id} className="size-10 overflow-hidden border border-border bg-muted">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" className="size-full object-cover" />
                ) : (
                  <span className="flex size-full items-center justify-center">
                    <ImageIcon className="size-4 text-muted-foreground" aria-hidden />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{L.count(selection.length)}</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ImagePlusIcon className="size-3.5" aria-hidden />
          {L.choosePhotos}
        </button>
      </div>

      <MediaPicker
        mode="multi"
        max={max}
        value={selection}
        onChange={(v) => onChange(v as MediaPickerSelection[])}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test --run lib/page-builder/galleryPicker/MediaField.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add the Puck field factories**

In `lib/page-builder/editorConfig.tsx`, add the import next to the other galleryPicker imports (~line 29):

```ts
import { SingleImageControl, MultiImageControl } from "./galleryPicker/MediaField";
import type { MediaPickerSelection } from "./galleryPicker/MediaPicker";
```

Add the factories next to `imagePickerField` (~line 247):

```ts
/** Single-image Puck custom field backed by the unified MediaPicker. */
function imageField(label: string): Field<string | undefined> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) => (
      <SingleImageControl value={(value as string) ?? ""} onChange={onChange as (v: string) => void} />
    ),
  } as unknown as Field<string | undefined>;
}

/** Multi-image Puck custom field backed by the unified MediaPicker (used by #2). */
function imagesField(label: string, opts: { max?: number } = {}): Field<MediaPickerSelection[]> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) => (
      <MultiImageControl
        value={(value as MediaPickerSelection[]) ?? []}
        onChange={onChange as (v: MediaPickerSelection[]) => void}
        max={opts.max}
      />
    ),
  } as unknown as Field<MediaPickerSelection[]>;
}
```

Re-point the Image block config (~line 692) from `imagePickerField("Image")` to `imageField("Image")`:

```ts
    imagePublicId: imageField("Image"),
```

> `imagesField` has no block call site yet (lands in #2). To avoid an "unused" lint error, export it for #2's use: add `imagesField` to the module's exports if the file exports field factories, or reference it in a typed re-export. Simplest: `export { imageField, imagesField }` is not how this file is structured — instead, add `void imagesField;` is NOT acceptable. If lint flags it as unused, add a single explanatory export line at the end of the factories region: `export const __pickerFieldFactories = { imageField, imagesField };` and import-check it in the MediaField test. Prefer exporting and wiring in #2; only add the guard export if lint fails in Step 8.

- [ ] **Step 6: Commit**

```bash
git add lib/page-builder/galleryPicker/MediaField.tsx lib/page-builder/galleryPicker/MediaField.test.tsx lib/page-builder/editorConfig.tsx
git commit -m "feat(picker): MediaPicker field adapters; Image block uses imageField"
```

---

## Task 7: Re-point the Image block's live picker (ImagePanel)

**Files:**
- Modify: `lib/page-builder/StyleToolkitField.tsx` (`ImagePanel`, ~line 1138; import ~line 45)

> The Image block's sidebar field is resolved out; the visible picker is `ImagePanel`. This is the user-facing re-point. **Do not touch `BannerSection` (~line 261)** — container/banner backgrounds stay on `SingleImagePicker` (deferred to spec #3).

- [ ] **Step 1: Swap the control in ImagePanel**

Add the import (keep the existing `SingleImagePicker` import — `BannerSection` still uses it):

```ts
import { SingleImageControl } from "./galleryPicker/MediaField";
```

In `ImagePanel` replace:

```tsx
      <SingleImagePicker
        value={(p?.imagePublicId as string) ?? ""}
        onChange={(v) => setProp("imagePublicId", v)}
      />
```

with:

```tsx
      <SingleImageControl
        value={(p?.imagePublicId as string) ?? ""}
        onChange={(v) => setProp("imagePublicId", v)}
      />
```

- [ ] **Step 2: Verify the existing StyleToolkitField tests still pass**

Run: `pnpm test --run lib/page-builder/StyleToolkitField.test.tsx`
Expected: PASS. If a test asserted on `SingleImagePicker`'s inline grid for the Image panel, update it to assert the new "Choose photo" trigger (the control opens the modal rather than rendering an inline grid). Keep container/banner assertions unchanged.

- [ ] **Step 3: Commit**

```bash
git add lib/page-builder/StyleToolkitField.tsx
git commit -m "feat(picker): Image block ImagePanel uses MediaPicker control"
```

---

## Task 8: Full verification (Definition of Done)

- [ ] **Step 1: Run all touched tests**

Run:
```bash
pnpm test --run lib/db/queries/gallery.test.ts "app/api/portfolio/gallery/collections/[id]/route.test.ts" app/api/portfolio/gallery/items/route.test.ts lib/page-builder/galleryPicker/MediaPicker.test.tsx lib/page-builder/galleryPicker/MediaField.test.tsx lib/page-builder/StyleToolkitField.test.tsx
```
Expected: all PASS.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: clean. (If `imagesField` trips no-unused, apply the guard export noted in Task 6 Step 5.)

- [ ] **Step 4: Mobile 375px check**

Manually verify in the editor at 375px: the modal is full-height (`h-[100dvh]`), the grid is ~3 columns, the footer action bar (Done / bulk actions) is reachable, Back + breadcrumb work, and the upload zone is visible inside a collection.

- [ ] **Step 5: Confirm no public-facing strings / no locale changes**

Confirm all new strings live in `const L = {...}` blocks (English, editor chrome) and that no files under `messages/` or `app/[locale]/.../messages` were added or changed.

- [ ] **Step 6: Final commit (if anything was adjusted in verification)**

```bash
git add -A
git commit -m "chore(picker): verification fixes for unified media picker"
```

---

## Self-review against the spec

- **One picker for every image field (single + multi):** `MediaPicker` (Task 5) + `imageField`/`imagesField` (Task 6). ✓
- **Collection-first browsing + pagination:** `CollectionGrid` → `PhotoGrid` with cursor "Load more" (Task 5) backed by `listCollectionItemsPage`/`listAllItemsPage` (Task 1) and the GET endpoint (Task 4). ✓
- **WYSIWYG-friendly value shapes:** single = `publicId` string (unchanged Image-block contract); multi = ordered `[{id,publicId}]`. ✓
- **No regressions / no migration:** Image block re-point is value-compatible (still `imagePublicId` string, Task 7); `FeaturedItemsPicker`, `CollectionPicker`, and container/banner `SingleImagePicker` untouched. ✓
- **Virtual "All photos":** `id="all"` sentinel feed (Tasks 1, 4) pinned in `CollectionGrid` (Task 5). ✓
- **Bulk selection:** "Select all on page" (loaded items) and cross-page "Select all in collection" (newest-`max` via `listCollectionNewest` + `?newest=` endpoint, Tasks 1/4/5) both implemented; the latter is hidden on the All-photos feed. ✓
- **A11y / states:** loading/error/empty/populated, `role=listbox/option`, focus-visible rings, visible drag grip, badge+ring (not color-only), Escape/focus-trap via base-ui Dialog. ✓
- **Endpoint security:** owner-only 403, `workspaceId` from session, tenant isolation, invalid id 400, limit clamp, `nodejs` runtime. ✓
- **Indexes:** added `{ workspaceId, createdAt }` for the all-photos feed (Task 2). ✓
- **Tests:** query layer, endpoint (owner/isolation/cursor/all/invalid/clamp), MediaPicker states + selection, adapters round-trip, items collectionId. ✓

### Deviations from the spec (intentional, called out)

1. **Endpoint path:** the route file is `collections/[id]/route.ts`, so the picker calls `GET /api/portfolio/gallery/collections/<id>` (not `.../items`). The spec's `/items` suffix would require a new nested route; reusing the existing file is simpler and equivalent. The `id="all"` sentinel and `?newest=` bulk feed live on this same route as the spec intends.
2. **Single-image sidebar thumbnail** resolves via the cached picker items (server-provided `thumbUrl`); if the selected `publicId` isn't in the capped feed, a neutral placeholder shows. `cloudinaryThumbnailUrl` is server-only, so the client cannot synthesize a thumb from a bare `publicId` without a new `NEXT_PUBLIC` env (out of scope).
3. **Items POST gains an optional `collectionId`** (Task 3) — required for the picker's "upload-into-collection"; additive and backward-compatible.

## Resolved decisions

- **Cross-page "Select all in collection" (newest-`max`)** is **included** in this sub-project: `listCollectionNewest` helper (Task 1), `?newest=` endpoint branch (Task 4), and the wired button (Task 5). Display order stays collection-`order`; bulk select is newest-first by design.
