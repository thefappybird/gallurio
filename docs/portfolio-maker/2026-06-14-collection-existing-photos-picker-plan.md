# Collection "pick existing photos" + Edit Collection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an owner build/grow a gallery collection by picking photos that already exist in the workspace (copy semantics), and add a full Edit Collection dialog (rename, add, remove-from-collection, delete-image, drag reorder, cover-pick).

**Architecture:** A shared `ExistingPhotosPicker` modal (collections grid → 3×3 photo grid → multi-select) feeds both the create dialog and a new `EditCollectionDialog`. Copy = new `GalleryItem` docs reusing the same Cloudinary asset. All-Photos de-dupes by `publicId`; Cloudinary destroys are reference-counted.

**Tech Stack:** Next.js 16 route handlers (Node runtime), Mongoose 8 + transactions, Zod, React 19 + base-ui Dialog, Vitest + Testing Library + mongodb-memory-server.

**Spec:** `docs/portfolio-maker/2026-06-14-collection-existing-photos-picker-design.md`

**Worktree:** `D:/Portfolio/Projects/gallurio/.claude/worktrees/fix-portfolio-maker` (branch `fix/portfolio-maker`). Run tests from the worktree root with `pnpm test --run <pattern>`.

---

## File Structure

**Backend (data + routes):**
- Modify: `lib/db/models/GalleryItem.ts` — add `{workspaceId, cloudinaryPublicId}` index.
- Modify: `lib/db/queries/gallery.ts` — dedup `listAllItemsPage`; add `countItemsByPublicId`, `copyItemsIntoCollection`, `detachItemsFromCollection`, `deleteItemsByPublicId`.
- Modify: `app/api/portfolio/gallery/collections/[id]/route.ts` — add `PATCH`; make `DELETE` reference-counted.
- Create: `app/api/portfolio/gallery/collections/[id]/items/copy/route.ts`
- Create: `app/api/portfolio/gallery/collections/[id]/items/reorder/route.ts`
- Create: `app/api/portfolio/gallery/collections/[id]/items/remove/route.ts`
- Create: `app/api/portfolio/gallery/items/delete/route.ts`

**Frontend:**
- Create: `lib/page-builder/galleryPicker/ExistingPhotosPicker.tsx`
- Modify: `lib/page-builder/galleryPicker/CreateCollectionDialog.tsx`
- Create: `lib/page-builder/galleryPicker/EditCollectionDialog.tsx`
- Modify: `lib/page-builder/galleryPicker/CollectionsManagerDialog.tsx`

**Editor chrome is English-only (RELEASE-CHECKLIST §4f) — no locale files.**

---

## Conventions for every API-route test

Each route test file starts with these mocks (mirrors `app/api/portfolio/gallery/route.test.ts`):

```typescript
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

type MockResp = { body: unknown; status: number };

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    NextResponse: {
      json: (body: unknown, init?: ResponseInit): MockResp => ({ body, status: init?.status ?? 200 }),
    },
  };
});
vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

let mockCtx: { userId: string; role: "owner" | "staff"; workspace: { _id: Types.ObjectId; slug: string } };
vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: async () => ({ userId: mockCtx.userId, role: mockCtx.role, workspace: mockCtx.workspace }),
}));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
```

`beforeAll(startInMemoryMongo)`, `afterAll(stopInMemoryMongo)`, `beforeEach(async () => { await clearCollections(); /* seed */ })`.
A `Request` is built with `new Request("http://t/x", { method, body: JSON.stringify(...) })`; route params are passed as `{ params: Promise.resolve({ id }) }`.

---

## Task 1: Reference-count index + `countItemsByPublicId`

**Files:**
- Modify: `lib/db/models/GalleryItem.ts`
- Modify: `lib/db/queries/gallery.ts`
- Test: `lib/db/queries/gallery.refcount.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```typescript
// lib/db/queries/gallery.refcount.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryItem } from "@/lib/db/models";
import { countItemsByPublicId } from "./gallery";

const ws = new Types.ObjectId();

beforeAll(startInMemoryMongo);
afterAll(stopInMemoryMongo);
beforeEach(clearCollections);

describe("countItemsByPublicId", () => {
  it("counts every doc in the workspace sharing a publicId", async () => {
    await GalleryItem.create([
      { workspaceId: ws, cloudinaryPublicId: `gallurio/${ws}/p/a`, url: "u", order: 0 },
      { workspaceId: ws, cloudinaryPublicId: `gallurio/${ws}/p/a`, url: "u", order: 1 },
      { workspaceId: ws, cloudinaryPublicId: `gallurio/${ws}/p/b`, url: "u", order: 0 },
    ]);
    expect(await countItemsByPublicId(ws.toString(), `gallurio/${ws}/p/a`)).toBe(2);
    expect(await countItemsByPublicId(ws.toString(), `gallurio/${ws}/p/b`)).toBe(1);
  });

  it("does not count other workspaces", async () => {
    const other = new Types.ObjectId();
    await GalleryItem.create({ workspaceId: other, cloudinaryPublicId: "shared", url: "u", order: 0 });
    expect(await countItemsByPublicId(ws.toString(), "shared")).toBe(0);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`countItemsByPublicId` not exported)

Run: `pnpm test --run gallery.refcount`

- [ ] **Step 3: Add the index** in `lib/db/models/GalleryItem.ts` after the existing `index(...)` calls:

```typescript
// Backs reference-counting (copy semantics): "how many items share this asset?"
galleryItemSchema.index({ workspaceId: 1, cloudinaryPublicId: 1 });
```

- [ ] **Step 4: Add the helper** at the end of `lib/db/queries/gallery.ts`. First ensure the imports at the top include `mongoose` default and `PipelineStage` (used by later tasks):

```typescript
// at top — adjust the existing mongoose import to include these:
import mongoose, { Types, type PipelineStage } from "mongoose";
```

Then append:

```typescript
/** Count GalleryItem docs in a workspace that reference a Cloudinary asset. */
export async function countItemsByPublicId(
  workspaceId: string,
  cloudinaryPublicId: string
): Promise<number> {
  if (!workspaceId || !cloudinaryPublicId) return 0;
  await connectDB();
  return GalleryItem.countDocuments({ workspaceId, cloudinaryPublicId });
}
```

- [ ] **Step 5: Run it — expect PASS**

Run: `pnpm test --run gallery.refcount`

- [ ] **Step 6: Commit**

```bash
git add lib/db/models/GalleryItem.ts lib/db/queries/gallery.ts lib/db/queries/gallery.refcount.test.ts
git commit -m "feat(gallery): reference-count index + countItemsByPublicId"
```

---

## Task 2: De-duplicate `listAllItemsPage` by `publicId`

**Files:**
- Modify: `lib/db/queries/gallery.ts` (replace `listAllItemsPage` body)
- Test: `lib/db/queries/gallery.allitems.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```typescript
// lib/db/queries/gallery.allitems.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryItem } from "@/lib/db/models";
import { listAllItemsPage } from "./gallery";

const ws = new Types.ObjectId();

beforeAll(startInMemoryMongo);
afterAll(stopInMemoryMongo);
beforeEach(clearCollections);

async function seedSharedAndUnique() {
  // Same asset "dup" appears in 3 docs; "x" and "y" once each.
  await GalleryItem.create({ workspaceId: ws, cloudinaryPublicId: "dup", url: "u", order: 0 });
  await GalleryItem.create({ workspaceId: ws, cloudinaryPublicId: "x", url: "u", order: 0 });
  await GalleryItem.create({ workspaceId: ws, cloudinaryPublicId: "dup", url: "u", order: 0 });
  await GalleryItem.create({ workspaceId: ws, cloudinaryPublicId: "y", url: "u", order: 0 });
  await GalleryItem.create({ workspaceId: ws, cloudinaryPublicId: "dup", url: "u", order: 0 });
}

describe("listAllItemsPage (deduped)", () => {
  it("returns each asset once", async () => {
    await seedSharedAndUnique();
    const page = await listAllItemsPage({ workspaceId: ws.toString(), limit: 50 });
    const pubs = page.items.map((i) => i.publicId).sort();
    expect(pubs).toEqual(["dup", "x", "y"]);
    expect(page.nextCursor).toBeNull();
  });

  it("paginates deduped assets without repeating across pages", async () => {
    await seedSharedAndUnique();
    const p1 = await listAllItemsPage({ workspaceId: ws.toString(), limit: 2 });
    expect(p1.items).toHaveLength(2);
    expect(p1.nextCursor).not.toBeNull();
    const p2 = await listAllItemsPage({ workspaceId: ws.toString(), limit: 2, cursor: p1.nextCursor });
    const all = [...p1.items, ...p2.items].map((i) => i.publicId);
    expect(new Set(all).size).toBe(all.length); // no dupes across pages
    expect(new Set(all)).toEqual(new Set(["dup", "x", "y"]));
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (currently `dup` appears 3×)

Run: `pnpm test --run gallery.allitems`

- [ ] **Step 3: Replace the `listAllItemsPage` function body** in `lib/db/queries/gallery.ts` with:

```typescript
export async function listAllItemsPage(opts: {
  workspaceId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<{ items: PickerItem[]; nextCursor: string | null }> {
  const { workspaceId } = opts;
  if (!workspaceId) return { items: [], nextCursor: null };

  const limit = clampLimit(opts.limit);
  await connectDB();

  // Group by Cloudinary asset so each unique photo appears once (copy semantics
  // can create several GalleryItem docs per asset). The representative is the
  // newest doc per publicId; pagination is by that representative's (createdAt,_id).
  const pipeline: PipelineStage[] = [
    { $match: { workspaceId: new Types.ObjectId(workspaceId) } },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $group: {
        _id: "$cloudinaryPublicId",
        docId: { $first: "$_id" },
        createdAt: { $first: "$createdAt" },
        caption: { $first: "$caption" },
      },
    },
    { $sort: { createdAt: -1, docId: -1 } },
  ];

  if (opts.cursor) {
    const c = decodeCursor(opts.cursor);
    if (c) {
      const ms = Number(c.sortValue);
      if (Number.isFinite(ms)) {
        const d = new Date(ms);
        pipeline.push({
          $match: {
            $or: [{ createdAt: { $lt: d } }, { createdAt: d, docId: { $lt: new Types.ObjectId(c.id) } }],
          },
        });
      }
    }
  }

  pipeline.push({ $limit: limit + 1 });

  const rows = await GalleryItem.aggregate<{
    _id: string;
    docId: Types.ObjectId;
    createdAt: Date;
    caption?: string;
  }>(pipeline);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor(new Date(last.createdAt).getTime(), String(last.docId)) : null;

  const items: PickerItem[] = page.map((r) => ({
    id: String(r.docId),
    publicId: r._id,
    thumbUrl: cloudinaryThumbnailUrl(r._id, { width: 200, height: 200 }),
    caption: (r.caption as string) || null,
  }));

  return { items, nextCursor };
}
```

- [ ] **Step 4: Run it — expect PASS**. Also re-run the existing collections route test to confirm no regression: `pnpm test --run "gallery.allitems|collections"`

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries/gallery.ts lib/db/queries/gallery.allitems.test.ts
git commit -m "feat(gallery): de-duplicate All Photos feed by asset"
```

---

## Task 3: Copy items into a collection

**Files:**
- Modify: `lib/db/queries/gallery.ts` (add `copyItemsIntoCollection`)
- Create: `app/api/portfolio/gallery/collections/[id]/items/copy/route.ts`
- Test: `app/api/portfolio/gallery/collections/[id]/items/copy/route.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// .../items/copy/route.test.ts  — prepend the standard mocks block (see Conventions)
import { GalleryCollection, GalleryItem, Workspace } from "@/lib/db/models";
import { POST } from "./route";

let wsA: Types.ObjectId, wsB: Types.ObjectId, colA: Types.ObjectId, srcStandalone: Types.ObjectId, srcForeign: Types.ObjectId;

async function seed() {
  const a = await Workspace.create({ slug: "a", name: "A", ownerUserId: "user_a", currency: "PHP" });
  const b = await Workspace.create({ slug: "b", name: "B", ownerUserId: "user_b", currency: "PHP" });
  wsA = a._id; wsB = b._id;
  const col = await GalleryCollection.create({ workspaceId: wsA, name: "C", slug: "c", order: 0 });
  colA = col._id;
  const s = await GalleryItem.create({ workspaceId: wsA, collectionId: null, cloudinaryPublicId: `gallurio/${wsA}/p/s`, url: "https://x/s.jpg", order: 0 });
  srcStandalone = s._id;
  const f = await GalleryItem.create({ workspaceId: wsB, collectionId: null, cloudinaryPublicId: `gallurio/${wsB}/p/f`, url: "https://x/f.jpg", order: 0 });
  srcForeign = f._id;
  mockCtx = { userId: "user_a", role: "owner", workspace: { _id: wsA, slug: "a" } };
}

function req(body: unknown) {
  return new Request("http://t/copy", { method: "POST", body: JSON.stringify(body) });
}

beforeAll(startInMemoryMongo);
afterAll(stopInMemoryMongo);
beforeEach(async () => { await clearCollections(); await seed(); });

describe("POST copy", () => {
  it("creates a copy of an existing item in the collection", async () => {
    const res = (await POST(req({ sourceItemIds: [srcStandalone.toString()] }), { params: Promise.resolve({ id: colA.toString() }) })) as unknown as MockResp;
    expect(res.status).toBe(201);
    const copies = await GalleryItem.find({ workspaceId: wsA, collectionId: colA }).lean();
    expect(copies).toHaveLength(1);
    expect(copies[0].cloudinaryPublicId).toBe(`gallurio/${wsA}/p/s`);
  });

  it("is idempotent per collection (skips assets already present)", async () => {
    await POST(req({ sourceItemIds: [srcStandalone.toString()] }), { params: Promise.resolve({ id: colA.toString() }) });
    await POST(req({ sourceItemIds: [srcStandalone.toString()] }), { params: Promise.resolve({ id: colA.toString() }) });
    const copies = await GalleryItem.find({ workspaceId: wsA, collectionId: colA }).lean();
    expect(copies).toHaveLength(1);
  });

  it("ignores items from another workspace (tenant isolation)", async () => {
    const res = (await POST(req({ sourceItemIds: [srcForeign.toString()] }), { params: Promise.resolve({ id: colA.toString() }) })) as unknown as MockResp;
    expect((res.body as { items: unknown[] }).items).toHaveLength(0);
    expect(await GalleryItem.countDocuments({ workspaceId: wsA, collectionId: colA })).toBe(0);
  });

  it("backfills the cover when the collection has none", async () => {
    await POST(req({ sourceItemIds: [srcStandalone.toString()] }), { params: Promise.resolve({ id: colA.toString() }) });
    const col = await GalleryCollection.findById(colA).lean();
    expect(col?.coverItemId).toBeTruthy();
  });

  it("rejects non-owner", async () => {
    mockCtx.role = "staff";
    const res = (await POST(req({ sourceItemIds: [srcStandalone.toString()] }), { params: Promise.resolve({ id: colA.toString() }) })) as unknown as MockResp;
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (route missing)

Run: `pnpm test --run "items/copy"`

- [ ] **Step 3: Add `copyItemsIntoCollection`** at the end of `lib/db/queries/gallery.ts`:

```typescript
import type { GalleryItemDoc } from "@/lib/db/models"; // add to imports if not present

/** Copy existing items (by id) into a collection as new docs reusing the same asset. */
export async function copyItemsIntoCollection(opts: {
  workspaceId: string;
  collectionId: string;
  sourceItemIds: string[];
}): Promise<PickerItem[]> {
  const { workspaceId, collectionId, sourceItemIds } = opts;
  if (!workspaceId || !Types.ObjectId.isValid(collectionId)) return [];
  await connectDB();

  const ids = sourceItemIds.filter((id) => Types.ObjectId.isValid(id));
  if (ids.length === 0) return [];
  const sources = await GalleryItem.find({ workspaceId, _id: { $in: ids } }).lean();
  if (sources.length === 0) return [];

  const existing = await GalleryItem.find({ workspaceId, collectionId })
    .select({ cloudinaryPublicId: 1 })
    .lean();
  const present = new Set(existing.map((e) => e.cloudinaryPublicId as string));
  const seen = new Set<string>();
  const toCopy = sources.filter((s) => {
    const pid = s.cloudinaryPublicId as string;
    if (present.has(pid) || seen.has(pid)) return false;
    seen.add(pid);
    return true;
  });
  if (toCopy.length === 0) return [];

  const base = await GalleryItem.countDocuments({ workspaceId, collectionId });

  const session = await mongoose.startSession();
  let created: GalleryItemDoc[] = [];
  try {
    await session.withTransaction(async () => {
      const docs = toCopy.map((s, i) => ({
        workspaceId,
        collectionId,
        cloudinaryPublicId: s.cloudinaryPublicId,
        url: s.url,
        width: s.width ?? null,
        height: s.height ?? null,
        format: s.format ?? null,
        sizeBytes: s.sizeBytes ?? 0,
        caption: s.caption ?? "",
        altText: s.altText ?? "",
        order: base + i,
      }));
      created = await GalleryItem.create(docs, { session, ordered: true });
      const col = await GalleryCollection.findOne({ _id: collectionId, workspaceId })
        .select({ coverItemId: 1 })
        .session(session);
      if (col && !col.coverItemId && created[0]) {
        await GalleryCollection.updateOne(
          { _id: collectionId, workspaceId },
          { $set: { coverItemId: created[0]._id } },
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }

  return created.map(toPickerItem);
}
```

- [ ] **Step 4: Create the route** `app/api/portfolio/gallery/collections/[id]/items/copy/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { requireOrg } from "@/lib/auth/requireOrg";
import { GalleryCollection } from "@/lib/db/models";
import { connectDB } from "@/lib/db/mongoose";
import { copyItemsIntoCollection } from "@/lib/db/queries/gallery";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({ sourceItemIds: z.array(z.string().min(1).max(64)).min(1).max(100) });

export async function POST(req: Request, { params }: Params) {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return NextResponse.json({ error: "owner_only" }, { status: 403 });

  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "invalid_input" }, { status: 400 });
  }

  const workspaceId = ctx.workspace._id.toString();
  await connectDB();
  const collection = await GalleryCollection.findOne({ _id: id, workspaceId }).select({ _id: 1 }).lean();
  if (!collection) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const items = await copyItemsIntoCollection({ workspaceId, collectionId: id, sourceItemIds: parsed.data.sourceItemIds });
  return NextResponse.json({ items }, { status: 201 });
}
```

- [ ] **Step 5: Run it — expect PASS** (`pnpm test --run "items/copy"`)

- [ ] **Step 6: Commit**

```bash
git add lib/db/queries/gallery.ts "app/api/portfolio/gallery/collections/[id]/items/copy"
git commit -m "feat(gallery): copy existing photos into a collection"
```

---

## Task 4: PATCH collection (rename + cover)

**Files:**
- Modify: `app/api/portfolio/gallery/collections/[id]/route.ts` (add `PATCH` + `import { z }`)
- Test: `app/api/portfolio/gallery/collections/[id]/route.patch.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// route.patch.test.ts — prepend standard mocks block
import { GalleryCollection, GalleryItem, Workspace } from "@/lib/db/models";
import { PATCH } from "./route";

let wsA: Types.ObjectId, colA: Types.ObjectId, itemInA: Types.ObjectId, itemForeignCol: Types.ObjectId;

async function seed() {
  const a = await Workspace.create({ slug: "a", name: "A", ownerUserId: "user_a", currency: "PHP" });
  wsA = a._id;
  const col = await GalleryCollection.create({ workspaceId: wsA, name: "Old", slug: "old", order: 0 });
  colA = col._id;
  const it = await GalleryItem.create({ workspaceId: wsA, collectionId: colA, cloudinaryPublicId: "p", url: "u", order: 0 });
  itemInA = it._id;
  const otherCol = await GalleryCollection.create({ workspaceId: wsA, name: "Other", slug: "other", order: 1 });
  const it2 = await GalleryItem.create({ workspaceId: wsA, collectionId: otherCol._id, cloudinaryPublicId: "q", url: "u", order: 0 });
  itemForeignCol = it2._id;
  mockCtx = { userId: "user_a", role: "owner", workspace: { _id: wsA, slug: "a" } };
}
const params = () => ({ params: Promise.resolve({ id: colA.toString() }) });
const req = (b: unknown) => new Request("http://t/x", { method: "PATCH", body: JSON.stringify(b) });

beforeAll(startInMemoryMongo); afterAll(stopInMemoryMongo);
beforeEach(async () => { await clearCollections(); await seed(); });

describe("PATCH collection", () => {
  it("renames without changing the slug", async () => {
    const res = (await PATCH(req({ name: "New name" }), params())) as unknown as MockResp;
    expect(res.status).toBe(200);
    const col = await GalleryCollection.findById(colA).lean();
    expect(col?.name).toBe("New name");
    expect(col?.slug).toBe("old");
  });
  it("sets a cover that belongs to the collection", async () => {
    const res = (await PATCH(req({ coverItemId: itemInA.toString() }), params())) as unknown as MockResp;
    expect(res.status).toBe(200);
    const col = await GalleryCollection.findById(colA).lean();
    expect(String(col?.coverItemId)).toBe(itemInA.toString());
  });
  it("rejects a cover from another collection", async () => {
    const res = (await PATCH(req({ coverItemId: itemForeignCol.toString() }), params())) as unknown as MockResp;
    expect(res.status).toBe(400);
  });
  it("rejects an empty body", async () => {
    const res = (await PATCH(req({}), params())) as unknown as MockResp;
    expect(res.status).toBe(400);
  });
  it("rejects non-owner", async () => {
    mockCtx.role = "staff";
    const res = (await PATCH(req({ name: "x" }), params())) as unknown as MockResp;
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`pnpm test --run "route.patch"`)

- [ ] **Step 3: Edit `app/api/portfolio/gallery/collections/[id]/route.ts`** — add `import { z } from "zod";` at the top, then append this export:

```typescript
const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    coverItemId: z.string().min(1).max(64).optional(),
  })
  .refine((d) => d.name !== undefined || d.coverItemId !== undefined, { message: "no_fields" });

export async function PATCH(req: Request, { params }: Params) {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return NextResponse.json({ error: "owner_only" }, { status: 403 });

  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const json = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "invalid_input" }, { status: 400 });
  }

  const workspaceId = ctx.workspace._id;
  await connectDB();
  const collection = await GalleryCollection.findOne({ _id: id, workspaceId });
  if (!collection) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (parsed.data.coverItemId !== undefined) {
    if (!isValidObjectId(parsed.data.coverItemId)) {
      return NextResponse.json({ error: "invalid_cover" }, { status: 400 });
    }
    const coverItem = await GalleryItem.findOne({ _id: parsed.data.coverItemId, workspaceId, collectionId: id })
      .select({ _id: 1 })
      .lean();
    if (!coverItem) return NextResponse.json({ error: "invalid_cover" }, { status: 400 });
    collection.coverItemId = coverItem._id;
  }
  if (parsed.data.name !== undefined) collection.name = parsed.data.name;
  await collection.save();

  return NextResponse.json(
    { id: String(collection._id), name: collection.name, coverItemId: collection.coverItemId ? String(collection.coverItemId) : null },
    { status: 200 }
  );
}
```

- [ ] **Step 4: Run it — expect PASS** (`pnpm test --run "route.patch"`)

- [ ] **Step 5: Commit**

```bash
git add "app/api/portfolio/gallery/collections/[id]/route.ts" "app/api/portfolio/gallery/collections/[id]/route.patch.test.ts"
git commit -m "feat(gallery): PATCH collection rename + cover-pick"
```

---

## Task 5: Reorder collection items

**Files:**
- Create: `app/api/portfolio/gallery/collections/[id]/items/reorder/route.ts`
- Test: `app/api/portfolio/gallery/collections/[id]/items/reorder/route.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// reorder/route.test.ts — prepend standard mocks block
import { GalleryCollection, GalleryItem, Workspace } from "@/lib/db/models";
import { POST } from "./route";

let wsA: Types.ObjectId, colA: Types.ObjectId, i0: Types.ObjectId, i1: Types.ObjectId, i2: Types.ObjectId;
async function seed() {
  const a = await Workspace.create({ slug: "a", name: "A", ownerUserId: "user_a", currency: "PHP" });
  wsA = a._id;
  const col = await GalleryCollection.create({ workspaceId: wsA, name: "C", slug: "c", order: 0 });
  colA = col._id;
  const [a0, a1, a2] = await GalleryItem.create([
    { workspaceId: wsA, collectionId: colA, cloudinaryPublicId: "0", url: "u", order: 0 },
    { workspaceId: wsA, collectionId: colA, cloudinaryPublicId: "1", url: "u", order: 1 },
    { workspaceId: wsA, collectionId: colA, cloudinaryPublicId: "2", url: "u", order: 2 },
  ]);
  i0 = a0._id; i1 = a1._id; i2 = a2._id;
  mockCtx = { userId: "user_a", role: "owner", workspace: { _id: wsA, slug: "a" } };
}
const params = () => ({ params: Promise.resolve({ id: colA.toString() }) });
const req = (b: unknown) => new Request("http://t/x", { method: "POST", body: JSON.stringify(b) });
beforeAll(startInMemoryMongo); afterAll(stopInMemoryMongo);
beforeEach(async () => { await clearCollections(); await seed(); });

describe("POST reorder", () => {
  it("reassigns order by index", async () => {
    const res = (await POST(req({ orderedItemIds: [i2.toString(), i0.toString(), i1.toString()] }), params())) as unknown as MockResp;
    expect(res.status).toBe(200);
    const byId = Object.fromEntries((await GalleryItem.find({ collectionId: colA }).lean()).map((d) => [String(d._id), d.order]));
    expect(byId[i2.toString()]).toBe(0);
    expect(byId[i0.toString()]).toBe(1);
    expect(byId[i1.toString()]).toBe(2);
  });
  it("ignores ids not in the collection", async () => {
    const foreign = new Types.ObjectId().toString();
    const res = (await POST(req({ orderedItemIds: [foreign, i0.toString()] }), params())) as unknown as MockResp;
    expect(res.status).toBe(200);
  });
  it("rejects non-owner", async () => {
    mockCtx.role = "staff";
    const res = (await POST(req({ orderedItemIds: [i0.toString()] }), params())) as unknown as MockResp;
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`pnpm test --run "items/reorder"`)

- [ ] **Step 3: Create the route** `app/api/portfolio/gallery/collections/[id]/items/reorder/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose, { isValidObjectId } from "mongoose";
import { requireOrg } from "@/lib/auth/requireOrg";
import { GalleryCollection, GalleryItem } from "@/lib/db/models";
import { connectDB } from "@/lib/db/mongoose";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({ orderedItemIds: z.array(z.string().min(1).max(64)).min(1).max(500) });

export async function POST(req: Request, { params }: Params) {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return NextResponse.json({ error: "owner_only" }, { status: 403 });

  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "invalid_input" }, { status: 400 });
  }

  const workspaceId = ctx.workspace._id;
  await connectDB();
  const collection = await GalleryCollection.findOne({ _id: id, workspaceId }).select({ _id: 1 }).lean();
  if (!collection) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const validIds = parsed.data.orderedItemIds.filter((x) => isValidObjectId(x));
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      let order = 0;
      for (const itemId of validIds) {
        await GalleryItem.updateOne({ _id: itemId, workspaceId, collectionId: id }, { $set: { order } }, { session });
        order += 1;
      }
    });
  } finally {
    await session.endSession();
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
```

- [ ] **Step 4: Run it — expect PASS** (`pnpm test --run "items/reorder"`)

- [ ] **Step 5: Commit**

```bash
git add "app/api/portfolio/gallery/collections/[id]/items/reorder"
git commit -m "feat(gallery): reorder collection items"
```

---

## Task 6: Remove (detach) items from a collection

**Files:**
- Modify: `lib/db/queries/gallery.ts` (add `detachItemsFromCollection`)
- Create: `app/api/portfolio/gallery/collections/[id]/items/remove/route.ts`
- Test: `app/api/portfolio/gallery/collections/[id]/items/remove/route.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// remove/route.test.ts — prepend standard mocks block
import { GalleryCollection, GalleryItem, Workspace } from "@/lib/db/models";
import { POST } from "./route";

let wsA: Types.ObjectId, colA: Types.ObjectId, soleItem: Types.ObjectId, copyItem: Types.ObjectId, otherCopy: Types.ObjectId;
async function seed() {
  const a = await Workspace.create({ slug: "a", name: "A", ownerUserId: "user_a", currency: "PHP" });
  wsA = a._id;
  const col = await GalleryCollection.create({ workspaceId: wsA, name: "C", slug: "c", order: 0 });
  colA = col._id;
  // "sole" — only one doc for asset "uno"
  const s = await GalleryItem.create({ workspaceId: wsA, collectionId: colA, cloudinaryPublicId: "uno", url: "u", order: 0 });
  soleItem = s._id;
  // "copy" in colA + "otherCopy" in another collection share asset "dos"
  const c1 = await GalleryItem.create({ workspaceId: wsA, collectionId: colA, cloudinaryPublicId: "dos", url: "u", order: 1 });
  copyItem = c1._id;
  const otherCol = await GalleryCollection.create({ workspaceId: wsA, name: "O", slug: "o", order: 1 });
  const c2 = await GalleryItem.create({ workspaceId: wsA, collectionId: otherCol._id, cloudinaryPublicId: "dos", url: "u", order: 0 });
  otherCopy = c2._id;
  mockCtx = { userId: "user_a", role: "owner", workspace: { _id: wsA, slug: "a" } };
}
const params = () => ({ params: Promise.resolve({ id: colA.toString() }) });
const req = (b: unknown) => new Request("http://t/x", { method: "POST", body: JSON.stringify(b) });
beforeAll(startInMemoryMongo); afterAll(stopInMemoryMongo);
beforeEach(async () => { await clearCollections(); await seed(); });

describe("POST remove (detach)", () => {
  it("deletes the membership when the asset survives elsewhere", async () => {
    await POST(req({ itemIds: [copyItem.toString()] }), params());
    expect(await GalleryItem.findById(copyItem)).toBeNull();
    expect(await GalleryItem.findById(otherCopy)).not.toBeNull(); // sibling untouched
  });
  it("keeps the photo as standalone when it was the asset's last doc", async () => {
    await POST(req({ itemIds: [soleItem.toString()] }), params());
    const doc = await GalleryItem.findById(soleItem).lean();
    expect(doc).not.toBeNull();
    expect(doc?.collectionId).toBeNull();
  });
  it("rejects non-owner", async () => {
    mockCtx.role = "staff";
    const res = (await POST(req({ itemIds: [soleItem.toString()] }), params())) as unknown as MockResp;
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`pnpm test --run "items/remove"`)

- [ ] **Step 3: Add `detachItemsFromCollection`** at the end of `lib/db/queries/gallery.ts`:

```typescript
/** Detach items from a collection: delete the membership, or keep as standalone if last. */
export async function detachItemsFromCollection(opts: {
  workspaceId: string;
  collectionId: string;
  itemIds: string[];
}): Promise<number> {
  const { workspaceId, collectionId, itemIds } = opts;
  if (!workspaceId || !Types.ObjectId.isValid(collectionId)) return 0;
  await connectDB();

  const ids = itemIds.filter((x) => Types.ObjectId.isValid(x));
  if (ids.length === 0) return 0;
  const items = await GalleryItem.find({ workspaceId, collectionId, _id: { $in: ids } }).lean();
  if (items.length === 0) return 0;

  let removed = 0;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const it of items) {
        const otherRefs = await GalleryItem.countDocuments({
          workspaceId,
          cloudinaryPublicId: it.cloudinaryPublicId,
          _id: { $ne: it._id },
        }).session(session);
        if (otherRefs > 0) {
          await GalleryItem.deleteOne({ _id: it._id, workspaceId }, { session });
        } else {
          await GalleryItem.updateOne({ _id: it._id, workspaceId }, { $set: { collectionId: null } }, { session });
        }
        removed += 1;
      }
      const col = await GalleryCollection.findOne({ _id: collectionId, workspaceId })
        .select({ coverItemId: 1 })
        .session(session);
      if (col && col.coverItemId && ids.includes(String(col.coverItemId))) {
        const newest = await GalleryItem.findOne({ workspaceId, collectionId })
          .sort({ createdAt: -1, _id: -1 })
          .select({ _id: 1 })
          .session(session);
        await GalleryCollection.updateOne(
          { _id: collectionId, workspaceId },
          { $set: { coverItemId: newest ? newest._id : null } },
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }
  return removed;
}
```

- [ ] **Step 4: Create the route** `app/api/portfolio/gallery/collections/[id]/items/remove/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { requireOrg } from "@/lib/auth/requireOrg";
import { GalleryCollection } from "@/lib/db/models";
import { connectDB } from "@/lib/db/mongoose";
import { detachItemsFromCollection } from "@/lib/db/queries/gallery";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({ itemIds: z.array(z.string().min(1).max(64)).min(1).max(200) });

export async function POST(req: Request, { params }: Params) {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return NextResponse.json({ error: "owner_only" }, { status: 403 });

  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "invalid_input" }, { status: 400 });
  }

  const workspaceId = ctx.workspace._id.toString();
  await connectDB();
  const collection = await GalleryCollection.findOne({ _id: id, workspaceId }).select({ _id: 1 }).lean();
  if (!collection) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const removed = await detachItemsFromCollection({ workspaceId, collectionId: id, itemIds: parsed.data.itemIds });
  return NextResponse.json({ removed }, { status: 200 });
}
```

- [ ] **Step 5: Run it — expect PASS** (`pnpm test --run "items/remove"`)

- [ ] **Step 6: Commit**

```bash
git add lib/db/queries/gallery.ts "app/api/portfolio/gallery/collections/[id]/items/remove"
git commit -m "feat(gallery): remove (detach) items from a collection"
```

---

## Task 7: Delete image (permanent, library-wide)

**Files:**
- Modify: `lib/db/queries/gallery.ts` (add `deleteItemsByPublicId`)
- Create: `app/api/portfolio/gallery/items/delete/route.ts`
- Test: `app/api/portfolio/gallery/items/delete/route.test.ts`

- [ ] **Step 1: Write the failing test** — mock Cloudinary so destroy is observable:

```typescript
// items/delete/route.test.ts — prepend standard mocks block, then add:
const destroyAsset = vi.fn(async () => undefined);
vi.mock("@/lib/storage/cloudinary", () => ({ destroyAsset: (p: string) => destroyAsset(p) }));

import { GalleryCollection, GalleryItem, Workspace } from "@/lib/db/models";
import { POST } from "./route";

let wsA: Types.ObjectId, colA: Types.ObjectId, copyInA: Types.ObjectId, copyInB: Types.ObjectId, foreign: Types.ObjectId;
async function seed() {
  const a = await Workspace.create({ slug: "a", name: "A", ownerUserId: "user_a", currency: "PHP" });
  const b = await Workspace.create({ slug: "b", name: "B", ownerUserId: "user_b", currency: "PHP" });
  wsA = a._id;
  const col = await GalleryCollection.create({ workspaceId: wsA, name: "C", slug: "c", order: 0 });
  colA = col._id;
  const colB = await GalleryCollection.create({ workspaceId: wsA, name: "C2", slug: "c2", order: 1 });
  // asset "shared" copied into two collections of workspace A
  const a1 = await GalleryItem.create({ workspaceId: wsA, collectionId: colA, cloudinaryPublicId: "shared", url: "u", order: 0 });
  const a2 = await GalleryItem.create({ workspaceId: wsA, collectionId: colB._id, cloudinaryPublicId: "shared", url: "u", order: 0 });
  copyInA = a1._id; copyInB = a2._id;
  const f = await GalleryItem.create({ workspaceId: b._id, collectionId: null, cloudinaryPublicId: "fpid", url: "u", order: 0 });
  foreign = f._id;
  await GalleryCollection.updateOne({ _id: colA }, { $set: { coverItemId: copyInA } });
  mockCtx = { userId: "user_a", role: "owner", workspace: { _id: wsA, slug: "a" } };
}
const req = (b: unknown) => new Request("http://t/x", { method: "POST", body: JSON.stringify(b) });
const noParams = {} as never;
beforeAll(startInMemoryMongo); afterAll(stopInMemoryMongo);
beforeEach(async () => { await clearCollections(); destroyAsset.mockClear(); await seed(); });

describe("POST items/delete", () => {
  it("deletes every doc for the asset across collections and destroys it once", async () => {
    const res = (await POST(req({ itemIds: [copyInA.toString()] }))) as unknown as MockResp;
    expect(res.status).toBe(200);
    expect(await GalleryItem.findById(copyInA)).toBeNull();
    expect(await GalleryItem.findById(copyInB)).toBeNull();
    expect(destroyAsset).toHaveBeenCalledTimes(1);
    expect(destroyAsset).toHaveBeenCalledWith("shared");
  });
  it("repoints a collection cover that referenced a deleted item", async () => {
    await POST(req({ itemIds: [copyInA.toString()] }));
    const col = await GalleryCollection.findById(colA).lean();
    expect(col?.coverItemId).toBeNull();
  });
  it("ignores items from another workspace", async () => {
    const res = (await POST(req({ itemIds: [foreign.toString()] }))) as unknown as MockResp;
    expect((res.body as { deletedDocs: number }).deletedDocs).toBe(0);
    expect(destroyAsset).not.toHaveBeenCalled();
  });
  it("rejects non-owner", async () => {
    mockCtx.role = "staff";
    const res = (await POST(req({ itemIds: [copyInA.toString()] }))) as unknown as MockResp;
    expect(res.status).toBe(403);
  });
});
```

> Note: this route's `POST` takes only `(req)` — call it as `POST(req(...))` (no params arg).

- [ ] **Step 2: Run it — expect FAIL** (`pnpm test --run "items/delete"`)

- [ ] **Step 3: Add `deleteItemsByPublicId`** at the end of `lib/db/queries/gallery.ts`:

```typescript
/** Permanently delete every doc sharing the selected items' assets; report assets to destroy. */
export async function deleteItemsByPublicId(opts: {
  workspaceId: string;
  itemIds: string[];
}): Promise<{ publicIds: string[]; deletedDocs: number }> {
  const { workspaceId, itemIds } = opts;
  if (!workspaceId) return { publicIds: [], deletedDocs: 0 };
  await connectDB();

  const ids = itemIds.filter((x) => Types.ObjectId.isValid(x));
  if (ids.length === 0) return { publicIds: [], deletedDocs: 0 };
  const selected = await GalleryItem.find({ workspaceId, _id: { $in: ids } }).select({ cloudinaryPublicId: 1 }).lean();
  const publicIds = [...new Set(selected.map((s) => s.cloudinaryPublicId as string))];
  if (publicIds.length === 0) return { publicIds: [], deletedDocs: 0 };

  const allDocs = await GalleryItem.find({ workspaceId, cloudinaryPublicId: { $in: publicIds } }).select({ _id: 1 }).lean();
  const allIds = allDocs.map((d) => d._id);

  const session = await mongoose.startSession();
  let deletedDocs = 0;
  try {
    await session.withTransaction(async () => {
      const del = await GalleryItem.deleteMany({ workspaceId, _id: { $in: allIds } }, { session });
      deletedDocs = del.deletedCount ?? 0;
      await GalleryCollection.updateMany(
        { workspaceId, coverItemId: { $in: allIds } },
        { $set: { coverItemId: null } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
  return { publicIds, deletedDocs };
}
```

- [ ] **Step 4: Create the route** `app/api/portfolio/gallery/items/delete/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrg } from "@/lib/auth/requireOrg";
import { deleteItemsByPublicId } from "@/lib/db/queries/gallery";
import { destroyAsset } from "@/lib/storage/cloudinary";

export const runtime = "nodejs";

const bodySchema = z.object({ itemIds: z.array(z.string().min(1).max(64)).min(1).max(200) });

export async function POST(req: Request) {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return NextResponse.json({ error: "owner_only" }, { status: 403 });

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "invalid_input" }, { status: 400 });
  }

  const workspaceId = ctx.workspace._id.toString();
  const { publicIds, deletedDocs } = await deleteItemsByPublicId({ workspaceId, itemIds: parsed.data.itemIds });

  let assetsFailed = 0;
  await Promise.all(
    publicIds.map(async (pid) => {
      try {
        await destroyAsset(pid);
      } catch (err) {
        assetsFailed += 1;
        console.error(`[portfolio/gallery/items/delete] cloudinary destroy failed for ${pid}:`, err);
      }
    })
  );

  return NextResponse.json(
    { deletedDocs, assetsDestroyed: publicIds.length - assetsFailed, assetsFailed },
    { status: 200 }
  );
}
```

- [ ] **Step 5: Run it — expect PASS** (`pnpm test --run "items/delete"`)

- [ ] **Step 6: Commit**

```bash
git add lib/db/queries/gallery.ts "app/api/portfolio/gallery/items/delete"
git commit -m "feat(gallery): permanent library-wide delete image"
```

---

## Task 8: Reference-counted collection DELETE

**Files:**
- Modify: `app/api/portfolio/gallery/collections/[id]/route.ts` (DELETE cleanup section)
- Test: `app/api/portfolio/gallery/collections/[id]/route.delete.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// route.delete.test.ts — prepend standard mocks block, then:
const destroyAsset = vi.fn(async () => undefined);
vi.mock("@/lib/storage/cloudinary", () => ({ destroyAsset: (p: string) => destroyAsset(p) }));
import { GalleryCollection, GalleryItem, Workspace } from "@/lib/db/models";
import { DELETE } from "./route";

let wsA: Types.ObjectId, colA: Types.ObjectId;
async function seed() {
  const a = await Workspace.create({ slug: "a", name: "A", ownerUserId: "user_a", currency: "PHP" });
  wsA = a._id;
  const col = await GalleryCollection.create({ workspaceId: wsA, name: "C", slug: "c", order: 0 });
  colA = col._id;
  const colB = await GalleryCollection.create({ workspaceId: wsA, name: "C2", slug: "c2", order: 1 });
  // "shared" is in both colA and colB; "only" is only in colA.
  await GalleryItem.create({ workspaceId: wsA, collectionId: colA, cloudinaryPublicId: "shared", url: "u", order: 0 });
  await GalleryItem.create({ workspaceId: wsA, collectionId: colB._id, cloudinaryPublicId: "shared", url: "u", order: 0 });
  await GalleryItem.create({ workspaceId: wsA, collectionId: colA, cloudinaryPublicId: "only", url: "u", order: 1 });
  mockCtx = { userId: "user_a", role: "owner", workspace: { _id: wsA, slug: "a" } };
}
const params = () => ({ params: Promise.resolve({ id: colA.toString() }) });
beforeAll(startInMemoryMongo); afterAll(stopInMemoryMongo);
beforeEach(async () => { await clearCollections(); destroyAsset.mockClear(); await seed(); });

describe("DELETE collection (reference-counted)", () => {
  it("destroys only assets no other collection references", async () => {
    const res = (await DELETE(new Request("http://t/x", { method: "DELETE" }), params())) as unknown as MockResp;
    expect(res.status).toBe(200);
    expect(destroyAsset).toHaveBeenCalledTimes(1);
    expect(destroyAsset).toHaveBeenCalledWith("only");
    expect(destroyAsset).not.toHaveBeenCalledWith("shared");
    // The shared copy in colB still references it.
    expect(await GalleryItem.countDocuments({ cloudinaryPublicId: "shared" })).toBe(1);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (current code destroys `shared` too)

Run: `pnpm test --run "route.delete"`

- [ ] **Step 3: Edit the DELETE cleanup** in `app/api/portfolio/gallery/collections/[id]/route.ts`. Add to imports:

```typescript
import { listCollectionItemsPage, listAllItemsPage, listCollectionNewest, countItemsByPublicId } from "@/lib/db/queries/gallery";
```

Replace the `Promise.all(publicIds.map(...))` cleanup block and the final response with:

```typescript
  // Reference-counted cleanup: the collection's item docs are gone; destroy an
  // asset on Cloudinary only if no remaining doc (a copy elsewhere) references it.
  let assetsFailed = 0;
  let assetsDestroyed = 0;
  await Promise.all(
    publicIds.map(async (pid) => {
      try {
        const remaining = await countItemsByPublicId(workspaceId.toString(), pid);
        if (remaining > 0) return;
        await destroyAsset(pid);
        assetsDestroyed += 1;
      } catch (err) {
        assetsFailed += 1;
        console.error(`[portfolio/gallery/collections] cloudinary destroy failed for ${pid}:`, err);
      }
    })
  );

  return NextResponse.json(
    { deleted: true, itemsDeleted: items.length, assetsDestroyed, assetsFailed },
    { status: 200 }
  );
```

- [ ] **Step 4: Run it — expect PASS**. Re-run any existing delete test: `pnpm test --run "route.delete|collections"`

- [ ] **Step 5: Commit**

```bash
git add "app/api/portfolio/gallery/collections/[id]/route.ts" "app/api/portfolio/gallery/collections/[id]/route.delete.test.ts"
git commit -m "feat(gallery): reference-counted asset destroy on collection delete"
```

---

## Task 9: `ExistingPhotosPicker` component

A shared modal: collections grid (4×2, client-paginated, "All Photos" pinned first) → 3×3 photo grid (cursor-paginated) → multi-select → `onAdd`.

**Files:**
- Create: `lib/page-builder/galleryPicker/ExistingPhotosPicker.tsx`
- Test: `lib/page-builder/galleryPicker/ExistingPhotosPicker.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// ExistingPhotosPicker.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { ExistingPhotosPicker } from "./ExistingPhotosPicker";
import { __clearPickerDataCache } from "./usePickerData";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const collections = Array.from({ length: 9 }, (_, i) => ({
  id: `c${i}`, name: `Collection ${i}`, coverUrl: `https://x/c${i}.jpg`, coverPublicId: `pid-c${i}`, itemCount: 2,
}));
const photos = [
  { id: "p1", publicId: "pid-1", thumbUrl: "https://x/1.jpg", caption: "One" },
  { id: "p2", publicId: "pid-2", thumbUrl: "https://x/2.jpg", caption: "Two" },
];
function routeFetch(url: string) {
  if (url === "/api/portfolio/gallery") {
    return Promise.resolve({ ok: true, json: async () => ({ collections, items: photos }) } as Response);
  }
  return Promise.resolve({ ok: true, json: async () => ({ items: photos, nextCursor: null }) } as Response);
}
beforeEach(() => {
  __clearPickerDataCache();
  mockFetch.mockReset();
  mockFetch.mockImplementation((u: string) => routeFetch(u));
});

describe("ExistingPhotosPicker", () => {
  it("pins 'All Photos' as the first collection cell", async () => {
    renderWithProviders(<ExistingPhotosPicker open onOpenChange={vi.fn()} onAdd={vi.fn()} />);
    const buttons = await screen.findAllByRole("button", { name: /collection \d|all photos/i });
    expect(buttons[0]).toHaveAccessibleName(/all photos/i);
  });

  it("client-paginates collections (8 per page incl. All Photos)", async () => {
    renderWithProviders(<ExistingPhotosPicker open onOpenChange={vi.fn()} onAdd={vi.fn()} />);
    // Page 1: All Photos + Collection 0..6 ; Collection 7 only on page 2.
    await screen.findByRole("button", { name: /all photos/i });
    expect(screen.queryByRole("button", { name: /^Collection 7$/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(await screen.findByRole("button", { name: /^Collection 7$/ })).toBeTruthy();
  });

  it("opens a collection and multi-selects, then calls onAdd and closes", async () => {
    const onAdd = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(<ExistingPhotosPicker open onOpenChange={onOpenChange} onAdd={onAdd} />);
    fireEvent.click(await screen.findByRole("button", { name: /^Collection 0$/ }));
    fireEvent.click(await screen.findByRole("option", { name: /one/i }));
    fireEvent.click(screen.getByRole("button", { name: /add 1 photo/i }));
    expect(onAdd).toHaveBeenCalledWith([expect.objectContaining({ id: "p1", publicId: "pid-1" })]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables photos already in the target collection", async () => {
    renderWithProviders(<ExistingPhotosPicker open onOpenChange={vi.fn()} onAdd={vi.fn()} excludePublicIds={["pid-1"]} />);
    fireEvent.click(await screen.findByRole("button", { name: /^Collection 0$/ }));
    const opt = await screen.findByRole("option", { name: /already added/i });
    expect(opt.querySelector("button")).toBeDisabled();
  });

  it("shows error + retry when the photo feed fails", async () => {
    mockFetch.mockImplementation((u: string) =>
      u === "/api/portfolio/gallery" ? routeFetch(u) : Promise.resolve({ ok: false, status: 500 } as Response)
    );
    renderWithProviders(<ExistingPhotosPicker open onOpenChange={vi.fn()} onAdd={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /^Collection 0$/ }));
    await waitFor(() => expect(screen.getByText(/could not load photos/i)).toBeTruthy());
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`pnpm test --run ExistingPhotosPicker`)

- [ ] **Step 3: Create `lib/page-builder/galleryPicker/ExistingPhotosPicker.tsx`:**

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeftIcon, ImagePlusIcon, Loader2Icon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePickerData } from "./usePickerData";
import type { PickerCollection, PickerItem } from "./types";

const ALL_PHOTOS: PickerCollection = { id: "all", name: "All Photos", coverUrl: null, coverPublicId: "", itemCount: 0 };
const COLS_PER_PAGE = 8; // 4×2
const PHOTOS_LIMIT = 9; // 3×3

type FeedState = { items: PickerItem[]; nextCursor: string | null; loading: boolean; error: boolean };

export function ExistingPhotosPicker({
  open,
  onOpenChange,
  excludePublicIds = [],
  onAdd,
  title = "Select existing photos",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludePublicIds?: string[];
  onAdd: (items: PickerItem[]) => void;
  title?: string;
}) {
  const { state, retry } = usePickerData();
  const [activeCol, setActiveCol] = useState<PickerCollection | null>(null);
  const [colPage, setColPage] = useState(0);
  const [feed, setFeed] = useState<FeedState>({ items: [], nextCursor: null, loading: false, error: false });
  const [selected, setSelected] = useState<Record<string, PickerItem>>({});
  const excluded = useMemo(() => new Set(excludePublicIds), [excludePublicIds]);

  useEffect(() => {
    if (!open) {
      setActiveCol(null);
      setColPage(0);
      setSelected({});
      setFeed({ items: [], nextCursor: null, loading: false, error: false });
    }
  }, [open]);

  const collections = state.status === "ok" ? state.data.collections : [];
  const pages = useMemo(() => {
    const all = [ALL_PHOTOS, ...collections];
    const out: PickerCollection[][] = [];
    for (let i = 0; i < all.length; i += COLS_PER_PAGE) out.push(all.slice(i, i + COLS_PER_PAGE));
    return out.length ? out : [[ALL_PHOTOS]];
  }, [collections]);
  const pageIndex = Math.min(colPage, pages.length - 1);

  const loadFeed = useCallback(async (col: PickerCollection, cursor: string | null) => {
    setFeed((f) => ({ ...f, loading: true, error: false }));
    try {
      const q = new URLSearchParams({ limit: String(PHOTOS_LIMIT) });
      if (cursor) q.set("cursor", cursor);
      const res = await fetch(`/api/portfolio/gallery/collections/${col.id}?${q.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: PickerItem[]; nextCursor: string | null };
      setFeed((f) => ({
        items: cursor ? [...f.items, ...data.items] : data.items,
        nextCursor: data.nextCursor,
        loading: false,
        error: false,
      }));
    } catch {
      setFeed((f) => ({ ...f, loading: false, error: true }));
    }
  }, []);

  function openCollection(col: PickerCollection) {
    setActiveCol(col);
    setFeed({ items: [], nextCursor: null, loading: true, error: false });
    void loadFeed(col, null);
  }
  function toggle(item: PickerItem) {
    if (excluded.has(item.publicId)) return;
    setSelected((prev) => {
      const next = { ...prev };
      if (next[item.id]) delete next[item.id];
      else next[item.id] = item;
      return next;
    });
  }
  const selectedList = Object.values(selected);
  function confirmAdd() {
    if (selectedList.length === 0) return;
    onAdd(selectedList);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-dvh w-full max-w-[calc(100%-1rem)] flex-col overflow-hidden sm:h-[70vh] sm:max-w-2xl">
        <DialogHeader>
          <div className="flex min-w-0 items-center gap-2">
            {activeCol && (
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Back to collections" onClick={() => setActiveCol(null)}>
                <ChevronLeftIcon className="size-4" aria-hidden />
              </Button>
            )}
            <DialogTitle className="truncate">{activeCol ? activeCol.name : title}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {!activeCol ? (
            <CollectionsView
              loading={state.status === "loading"}
              error={state.status === "error"}
              page={pages[pageIndex] ?? []}
              pageIndex={pageIndex}
              pageCount={pages.length}
              onPrev={() => setColPage((p) => Math.max(0, p - 1))}
              onNext={() => setColPage((p) => Math.min(pages.length - 1, p + 1))}
              onOpenCol={openCollection}
              onRetry={retry}
            />
          ) : (
            <PhotosView
              feed={feed}
              excluded={excluded}
              isSelected={(id) => Boolean(selected[id])}
              onToggle={toggle}
              onLoadMore={() => activeCol && feed.nextCursor && void loadFeed(activeCol, feed.nextCursor)}
              onRetry={() => activeCol && void loadFeed(activeCol, null)}
            />
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" variant="brand" disabled={selectedList.length === 0} onClick={confirmAdd}>
            {selectedList.length === 0 ? "Add photos" : `Add ${selectedList.length} photo${selectedList.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CenterSpinner() {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
      <Loader2Icon className="size-4 animate-spin" aria-hidden /> Loading…
    </div>
  );
}

function CollectionsView({
  loading, error, page, pageIndex, pageCount, onPrev, onNext, onOpenCol, onRetry,
}: {
  loading: boolean; error: boolean; page: PickerCollection[]; pageIndex: number; pageCount: number;
  onPrev: () => void; onNext: () => void; onOpenCol: (c: PickerCollection) => void; onRetry: () => void;
}) {
  if (loading) return <CenterSpinner />;
  if (error)
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-sm">
        <p className="text-destructive">Could not load your collections.</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>Retry</Button>
      </div>
    );
  return (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {page.map((col) => (
          <li key={col.id}>
            <button
              type="button"
              onClick={() => onOpenCol(col)}
              aria-label={col.name}
              className="flex w-full flex-col overflow-hidden border border-border text-left hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-muted">
                {col.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={col.coverUrl} alt="" className="size-full object-cover" loading="lazy" />
                ) : (
                  <ImagePlusIcon className="size-6 text-muted-foreground" aria-hidden />
                )}
              </span>
              <span className="flex flex-col gap-0.5 px-2 py-1.5">
                <span className="truncate text-xs font-medium">{col.name}</span>
                {col.id !== "all" && <span className="text-xs text-muted-foreground">{col.itemCount} photos</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Button type="button" variant="outline" size="sm" disabled={pageIndex === 0} onClick={onPrev}>Prev</Button>
          <span className="text-muted-foreground">{pageIndex + 1} / {pageCount}</span>
          <Button type="button" variant="outline" size="sm" disabled={pageIndex >= pageCount - 1} onClick={onNext}>Next</Button>
        </div>
      )}
    </div>
  );
}

function PhotosView({
  feed, excluded, isSelected, onToggle, onLoadMore, onRetry,
}: {
  feed: FeedState; excluded: Set<string>; isSelected: (id: string) => boolean;
  onToggle: (item: PickerItem) => void; onLoadMore: () => void; onRetry: () => void;
}) {
  if (feed.error)
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-sm">
        <p className="text-destructive">Could not load photos.</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>Retry</Button>
      </div>
    );
  return (
    <div className="flex flex-col gap-3">
      {feed.items.length === 0 && !feed.loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No photos here yet.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-1.5" role="listbox" aria-label="Photos">
          {feed.items.map((item) => {
            const isExcluded = excluded.has(item.publicId);
            const selected = isSelected(item.id);
            return (
              <li key={item.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  disabled={isExcluded}
                  onClick={() => onToggle(item)}
                  aria-label={`${item.caption || "Photo"}${isExcluded ? " — already added" : selected ? " — selected" : ""}`}
                  className={cn(
                    "relative block aspect-square w-full overflow-hidden border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    isExcluded ? "cursor-not-allowed border-border opacity-40" : selected ? "border-foreground" : "border-border hover:bg-accent/40"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.thumbUrl} alt="" className="size-full object-cover" loading="lazy" />
                  {selected && (
                    <span className="absolute right-1 top-1 inline-flex size-5 items-center justify-center bg-foreground text-xs font-bold text-background">✓</span>
                  )}
                  {isExcluded && (
                    <span className="absolute inset-x-0 bottom-0 bg-background/80 px-1 py-0.5 text-center text-[10px]">Added</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {feed.loading && <CenterSpinner />}
      {feed.nextCursor && !feed.loading && (
        <Button type="button" variant="outline" size="sm" className="self-center" onClick={onLoadMore}>Load more</Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run it — expect PASS** (`pnpm test --run ExistingPhotosPicker`)

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/galleryPicker/ExistingPhotosPicker.tsx lib/page-builder/galleryPicker/ExistingPhotosPicker.test.tsx
git commit -m "feat(gallery): shared ExistingPhotosPicker modal"
```

---

## Task 10: Wire pick-existing into `CreateCollectionDialog`

Selected existing photos are tracked separately and copied into the new collection AFTER it is created (via the copy endpoint), because `PickerItem` lacks the `url`/dimensions the create payload needs.

**Files:**
- Modify: `lib/page-builder/galleryPicker/CreateCollectionDialog.tsx`
- Test: `lib/page-builder/galleryPicker/CreateCollectionDialog.test.tsx` (create if absent; otherwise add cases)

- [ ] **Step 1: Write the failing test**

```tsx
// CreateCollectionDialog.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { CreateCollectionDialog } from "./CreateCollectionDialog";
import { __clearPickerDataCache } from "./usePickerData";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const collections = [{ id: "c0", name: "Existing", coverUrl: "https://x/c.jpg", coverPublicId: "pid-c", itemCount: 1 }];
const photos = [{ id: "src1", publicId: "pid-src1", thumbUrl: "https://x/s.jpg", caption: "Src" }];

beforeEach(() => {
  __clearPickerDataCache();
  mockFetch.mockReset();
  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    if (url === "/api/portfolio/gallery") return Promise.resolve({ ok: true, json: async () => ({ collections, items: photos }) } as Response);
    if (url === "/api/portfolio/gallery/collections" && init?.method === "POST")
      return Promise.resolve({ ok: true, json: async () => ({ id: "newCol", name: "X", slug: "x" }) } as Response);
    if (url.includes("/items/copy")) return Promise.resolve({ ok: true, json: async () => ({ items: [] }) } as Response);
    return Promise.resolve({ ok: true, json: async () => ({ items: photos, nextCursor: null }) } as Response);
  });
});

describe("CreateCollectionDialog pick-existing", () => {
  it("copies picked existing photos into the new collection after creation", async () => {
    const onCreated = vi.fn();
    renderWithProviders(<CreateCollectionDialog open onOpenChange={vi.fn()} onCreated={onCreated} />);
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "My collection" } });
    fireEvent.click(screen.getByRole("button", { name: /select existing photos/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^Existing$/ }));
    fireEvent.click(await screen.findByRole("option", { name: /src/i }));
    fireEvent.click(screen.getByRole("button", { name: /add 1 photo/i }));
    // Picked photo now previews in the dialog.
    expect(await screen.findByRole("img", { name: "" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /create/i }));
    await waitFor(() => {
      const calledCopy = mockFetch.mock.calls.some(([u]) => String(u).includes("/collections/newCol/items/copy"));
      expect(calledCopy).toBe(true);
    });
    expect(onCreated).toHaveBeenCalled();
  });
});
```

> If `CreateCollectionDialog.test.tsx` already exists, ADD this `describe` block — do not overwrite the file. Verify first with `git show HEAD:lib/page-builder/galleryPicker/CreateCollectionDialog.test.tsx` (a "does not exist" error means it's safe to create).

- [ ] **Step 2: Run it — expect FAIL** (`pnpm test --run CreateCollectionDialog`)

- [ ] **Step 3: Edit `CreateCollectionDialog.tsx`.** Add imports:

```tsx
import { ExistingPhotosPicker } from "./ExistingPhotosPicker";
import type { PickerItem } from "./types";
```

Add state next to the existing `useState`s:

```tsx
const [picked, setPicked] = useState<PickerItem[]>([]);
const [pickerOpen, setPickerOpen] = useState(false);
```

In `createCollection`, after the create POST succeeds and you have the new collection id (`const { id } = await res.json();`), copy the picked items before calling `onCreated()`:

```tsx
if (picked.length > 0) {
  const copyRes = await fetch(`/api/portfolio/gallery/collections/${id}/items/copy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceItemIds: picked.map((p) => p.id) }),
  });
  if (!copyRes.ok) {
    setError(L.errUpload); // collection exists; surface that copy failed
  }
}
```

Add a "Select existing photos" button just below the upload `<input>` (before the preview grid):

```tsx
<Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setPickerOpen(true)}>
  Select existing photos
</Button>
```

Extend the preview grid to also render `picked` items (after the `images` items). Map picked items with a removable button:

```tsx
{picked.map((p, i) => (
  <li key={`picked-${p.id}`} className="relative aspect-square overflow-hidden border border-border">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={p.thumbUrl} alt="" className="size-full object-cover" />
    <button
      type="button"
      aria-label={L.removePhoto}
      onClick={() => setPicked((prev) => prev.filter((_, j) => j !== i))}
      className="absolute right-0.5 top-0.5 inline-flex size-6 items-center justify-center border border-border bg-background/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <XIcon className="size-3.5" aria-hidden />
    </button>
  </li>
))}
```

> If the preview `<ul>` is currently gated by `images.length > 0`, change the guard to `images.length > 0 || picked.length > 0`.

Render the picker before the closing `</Dialog>` (dedupe against already-staged assets):

```tsx
<ExistingPhotosPicker
  open={pickerOpen}
  onOpenChange={setPickerOpen}
  excludePublicIds={[...images.map((i) => i.cloudinaryPublicId), ...picked.map((p) => p.publicId)]}
  onAdd={(items) =>
    setPicked((prev) => {
      const seen = new Set(prev.map((p) => p.publicId));
      return [...prev, ...items.filter((it) => !seen.has(it.publicId))];
    })
  }
/>
```

Reset `picked` in the dialog's `close`/reset handler alongside `images`.

- [ ] **Step 4: Run it — expect PASS** (`pnpm test --run CreateCollectionDialog`)

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/galleryPicker/CreateCollectionDialog.tsx lib/page-builder/galleryPicker/CreateCollectionDialog.test.tsx
git commit -m "feat(gallery): pick existing photos in create-collection dialog"
```

---

## Task 11: `EditCollectionDialog` component

Rename · add (upload + pick-existing) · current-photos grid with drag reorder, set-cover, multi-select → remove / delete-image (confirm). Loads the collection's items fully on open so reorder submits a complete order.

**Files:**
- Create: `lib/page-builder/galleryPicker/EditCollectionDialog.tsx`
- Test: `lib/page-builder/galleryPicker/EditCollectionDialog.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// EditCollectionDialog.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { EditCollectionDialog } from "./EditCollectionDialog";
import { __clearPickerDataCache } from "./usePickerData";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const collection = { id: "col1", name: "Weddings", coverUrl: "https://x/c.jpg", coverPublicId: "pid-a", itemCount: 2 };
const items = [
  { id: "a", publicId: "pid-a", thumbUrl: "https://x/a.jpg", caption: "A" },
  { id: "b", publicId: "pid-b", thumbUrl: "https://x/b.jpg", caption: "B" },
];

function defaultRoute(url: string, init?: RequestInit) {
  if (url === "/api/portfolio/gallery") return Promise.resolve({ ok: true, json: async () => ({ collections: [collection], items }) } as Response);
  if (url.startsWith("/api/portfolio/gallery/collections/col1?")) return Promise.resolve({ ok: true, json: async () => ({ items, nextCursor: null }) } as Response);
  if (url === "/api/portfolio/gallery/collections/col1" && init?.method === "PATCH")
    return Promise.resolve({ ok: true, json: async () => ({ id: "col1", name: "Renamed", coverItemId: "a" }) } as Response);
  if (url.includes("/items/remove")) return Promise.resolve({ ok: true, json: async () => ({ removed: 1 }) } as Response);
  if (url === "/api/portfolio/gallery/items/delete") return Promise.resolve({ ok: true, json: async () => ({ deletedDocs: 1, assetsDestroyed: 1, assetsFailed: 0 }) } as Response);
  if (url.includes("/items/reorder")) return Promise.resolve({ ok: true, json: async () => ({ ok: true }) } as Response);
  if (url.includes("/items/copy")) return Promise.resolve({ ok: true, json: async () => ({ items: [] }) } as Response);
  return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
}
beforeEach(() => {
  __clearPickerDataCache();
  mockFetch.mockReset();
  mockFetch.mockImplementation(defaultRoute);
});

function open() {
  return renderWithProviders(
    <EditCollectionDialog open onOpenChange={vi.fn()} collection={collection} onChanged={vi.fn()} />
  );
}

describe("EditCollectionDialog", () => {
  it("loads and shows the collection's photos", async () => {
    open();
    expect(await screen.findByRole("img", { name: "A" }) ?? screen.findByLabelText(/^A/)).toBeTruthy();
    await waitFor(() => expect(mockFetch.mock.calls.some(([u]) => String(u).startsWith("/api/portfolio/gallery/collections/col1?"))).toBe(true));
  });

  it("renames via PATCH", async () => {
    open();
    const input = await screen.findByLabelText(/collection name/i);
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: /save name/i }));
    await waitFor(() =>
      expect(mockFetch.mock.calls.some(([u, i]) => String(u) === "/api/portfolio/gallery/collections/col1" && (i as RequestInit)?.method === "PATCH")).toBe(true)
    );
  });

  it("blocks rename when the name is empty", async () => {
    open();
    const input = await screen.findByLabelText(/collection name/i);
    fireEvent.change(input, { target: { value: "  " } });
    expect(screen.getByRole("button", { name: /save name/i })).toBeDisabled();
  });

  it("removes selected photos from the collection", async () => {
    open();
    fireEvent.click(await screen.findByRole("checkbox", { name: /select A/i }));
    fireEvent.click(screen.getByRole("button", { name: /remove from collection/i }));
    await waitFor(() => expect(mockFetch.mock.calls.some(([u]) => String(u).includes("/items/remove"))).toBe(true));
  });

  it("delete image is behind a confirm dialog", async () => {
    open();
    fireEvent.click(await screen.findByRole("checkbox", { name: /select A/i }));
    fireEvent.click(screen.getByRole("button", { name: /delete image/i }));
    // Confirm dialog appears; the network call only fires after confirming.
    expect(mockFetch.mock.calls.some(([u]) => String(u) === "/api/portfolio/gallery/items/delete")).toBe(false);
    fireEvent.click(await screen.findByRole("button", { name: /delete permanently/i }));
    await waitFor(() => expect(mockFetch.mock.calls.some(([u]) => String(u) === "/api/portfolio/gallery/items/delete")).toBe(true));
  });

  it("sets a cover via PATCH coverItemId", async () => {
    open();
    fireEvent.click(await screen.findByRole("button", { name: /set B as cover/i }));
    await waitFor(() =>
      expect(mockFetch.mock.calls.some(([u, i]) => String(u) === "/api/portfolio/gallery/collections/col1" && (i as RequestInit)?.method === "PATCH" && String((i as RequestInit)?.body).includes("coverItemId"))).toBe(true)
    );
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`pnpm test --run EditCollectionDialog`)

- [ ] **Step 3: Create `lib/page-builder/galleryPicker/EditCollectionDialog.tsx`:**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GripVerticalIcon, ImagePlusIcon, Loader2Icon, StarIcon, Trash2Icon, XIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { validatePhotoFile } from "@/lib/page-builder/photoSpec";
import { uploadImageToCloudinary } from "@/lib/storage/uploadToCloudinary.client";
import { ExistingPhotosPicker } from "./ExistingPhotosPicker";
import type { PickerCollection, PickerItem } from "./types";

const PAGE = 48;

export function EditCollectionDialog({
  open, onOpenChange, collection, onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: PickerCollection | null;
  onChanged: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [items, setItems] = useState<PickerItem[]>([]);
  const [coverPublicId, setCoverPublicId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const colId = collection?.id ?? null;

  const loadAll = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const acc: PickerItem[] = [];
      let cursor: string | null = null;
      for (let guard = 0; guard < 50; guard++) {
        const q = new URLSearchParams({ limit: String(PAGE) });
        if (cursor) q.set("cursor", cursor);
        const res = await fetch(`/api/portfolio/gallery/collections/${id}?${q.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { items: PickerItem[]; nextCursor: string | null };
        acc.push(...data.items);
        cursor = data.nextCursor;
        if (!cursor) break;
      }
      setItems(acc);
    } catch {
      setError("Could not load this collection's photos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && collection) {
      setName(collection.name);
      setCoverPublicId(collection.coverPublicId);
      setSelected(new Set());
      setError(null);
      void loadAll(collection.id);
    }
  }, [open, collection, loadAll]);

  if (!collection || !colId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Edit collection</DialogTitle></DialogHeader></DialogContent>
      </Dialog>
    );
  }

  const nameInvalid = name.trim().length === 0;
  const nameUnchanged = name.trim() === collection.name;

  async function saveName() {
    if (nameInvalid || nameUnchanged || !colId) return;
    setSavingName(true);
    try {
      const res = await fetch(`/api/portfolio/gallery/collections/${colId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error();
      onChanged();
    } catch {
      setError("Could not rename the collection.");
    } finally {
      setSavingName(false);
    }
  }

  async function setCover(item: PickerItem) {
    if (!colId) return;
    const prev = coverPublicId;
    setCoverPublicId(item.publicId); // optimistic
    try {
      const res = await fetch(`/api/portfolio/gallery/collections/${colId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coverItemId: item.id }),
      });
      if (!res.ok) throw new Error();
      onChanged();
    } catch {
      setCoverPublicId(prev);
      setError("Could not set the cover.");
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function reorder(fromId: string, toId: string) {
    setItems((prev) => {
      const from = prev.findIndex((p) => p.id === fromId);
      const to = prev.findIndex((p) => p.id === toId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      void fetch(`/api/portfolio/gallery/collections/${colId}/items/reorder`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedItemIds: next.map((i) => i.id) }),
      });
      return next;
    });
  }

  function moveByKeyboard(id: string, dir: -1 | 1) {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      void fetch(`/api/portfolio/gallery/collections/${colId}/items/reorder`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedItemIds: next.map((i) => i.id) }),
      });
      return next;
    });
  }

  async function removeSelected() {
    if (selected.size === 0 || !colId) return;
    const ids = [...selected];
    setBusy(true);
    try {
      const res = await fetch(`/api/portfolio/gallery/collections/${colId}/items/remove`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemIds: ids }),
      });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.filter((p) => !selected.has(p.id)));
      setSelected(new Set());
      onChanged();
    } catch {
      setError("Could not remove the selected photos.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    const ids = [...selected];
    setBusy(true);
    try {
      const res = await fetch(`/api/portfolio/gallery/items/delete`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemIds: ids }),
      });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.filter((p) => !selected.has(p.id)));
      setSelected(new Set());
      setConfirmDelete(false);
      onChanged();
    } catch {
      setError("Could not delete the selected photos.");
    } finally {
      setBusy(false);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || !colId) return;
    const valid = Array.from(files).filter((f) => validatePhotoFile(f).ok);
    if (valid.length === 0) return;
    setUploading(true);
    Promise.allSettled(valid.map((f) => uploadImageToCloudinary(f, { subfolder: "portfolio" }))).then(async (results) => {
      const ok = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
      for (const up of ok) {
        try {
          const res = await fetch(`/api/portfolio/gallery/items`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...up, collectionId: colId }),
          });
          if (res.ok) {
            const created = (await res.json()) as { id: string; thumbUrl: string; caption: string | null };
            setItems((prev) => [...prev, { id: created.id, publicId: up.cloudinaryPublicId, thumbUrl: created.thumbUrl, caption: created.caption }]);
          }
        } catch { /* surfaced below */ }
      }
      setUploading(false);
      onChanged();
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  async function addExisting(picked: PickerItem[]) {
    if (picked.length === 0 || !colId) return;
    try {
      const res = await fetch(`/api/portfolio/gallery/collections/${colId}/items/copy`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceItemIds: picked.map((p) => p.id) }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { items: PickerItem[] };
      setItems((prev) => [...prev, ...data.items]);
      onChanged();
    } catch {
      setError("Could not add the selected photos.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-dvh w-full max-w-[calc(100%-1rem)] flex-col overflow-hidden sm:h-[80vh] sm:max-w-3xl">
        <DialogHeader><DialogTitle className="truncate">Edit “{collection.name}”</DialogTitle></DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-1">
          {/* Rename */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-col-name" className="text-xs font-medium">Collection name</label>
            <div className="flex items-center gap-2">
              <input
                id="edit-col-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 min-w-0 flex-1 border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <Button type="button" size="sm" variant="brand" disabled={nameInvalid || nameUnchanged || savingName} loading={savingName} onClick={saveName}>Save name</Button>
            </div>
          </div>

          {/* Add photos */}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              {uploading ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : <ImagePlusIcon className="size-4" aria-hidden />} Upload photos
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setPickerOpen(true)}>Select existing photos</Button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="sr-only" tabIndex={-1} onChange={(e) => handleFiles(e.target.files)} />
          </div>

          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

          {/* Current photos */}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2Icon className="size-4 animate-spin" aria-hidden /> Loading…</div>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No photos in this collection yet.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {items.map((item, idx) => {
                const isCover = item.publicId === coverPublicId;
                const isSel = selected.has(item.id);
                return (
                  <li
                    key={item.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", item.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); const from = e.dataTransfer.getData("text/plain"); if (from) reorder(from, item.id); }}
                    className={cn("relative aspect-square overflow-hidden border", isSel ? "border-foreground" : "border-border")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.thumbUrl} alt={item.caption ?? ""} className="size-full object-cover" loading="lazy" />
                    <span aria-hidden className="absolute left-0.5 top-0.5 flex size-5 cursor-grab items-center justify-center bg-background/80">
                      <GripVerticalIcon className="size-3.5 text-muted-foreground" />
                    </span>
                    {/* keyboard reorder */}
                    <span className="sr-only">
                      <button type="button" aria-label={`Move ${item.caption || "photo"} earlier`} onClick={() => moveByKeyboard(item.id, -1)} disabled={idx === 0}>up</button>
                      <button type="button" aria-label={`Move ${item.caption || "photo"} later`} onClick={() => moveByKeyboard(item.id, 1)} disabled={idx === items.length - 1}>down</button>
                    </span>
                    {/* select checkbox */}
                    <label className="absolute right-0.5 top-0.5 inline-flex size-5 items-center justify-center border border-border bg-background/90">
                      <input type="checkbox" aria-label={`Select ${item.caption || "photo"}`} checked={isSel} onChange={() => toggleSelect(item.id)} />
                    </label>
                    {/* set cover */}
                    <button
                      type="button"
                      aria-label={`Set ${item.caption || "photo"} as cover`}
                      aria-pressed={isCover}
                      onClick={() => setCover(item)}
                      className={cn("absolute bottom-0.5 left-0.5 inline-flex items-center gap-0.5 border border-border bg-background/90 px-1 py-0.5 text-[10px]", isCover && "bg-foreground text-background")}
                    >
                      <StarIcon className="size-3" aria-hidden /> {isCover ? "Cover" : "Cover"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Selection action bar */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
            <span className="text-xs text-muted-foreground">{selected.size} selected</span>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={removeSelected}>Remove from collection</Button>
            <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => setConfirmDelete(true)}>
              <Trash2Icon className="size-4" aria-hidden /> Delete image
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>

      <ExistingPhotosPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludePublicIds={items.map((i) => i.publicId)}
        onAdd={addExisting}
      />

      <AlertDialog open={confirmDelete} onOpenChange={(n) => { if (!n && !busy) setConfirmDelete(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} photo{selected.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the photo from your library and removes it from every collection it appears in. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDelete(false)} disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSelected} loading={busy} disabled={busy}>Delete permanently</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
```

> The "Cover"/"Cover" label text is intentional (same word whether or not it's the current cover; the `aria-pressed` + filled style convey state). If you prefer, render "Cover" only when `isCover` and a star-only button otherwise — keep the `aria-label` exactly `Set X as cover` either way so the test matches.

- [ ] **Step 4: Run it — expect PASS** (`pnpm test --run EditCollectionDialog`)

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/galleryPicker/EditCollectionDialog.tsx lib/page-builder/galleryPicker/EditCollectionDialog.test.tsx
git commit -m "feat(gallery): EditCollectionDialog (rename, add, remove, delete, reorder, cover)"
```

---

## Task 12: Open the Edit dialog from `CollectionsManagerDialog`

**Files:**
- Modify: `lib/page-builder/galleryPicker/CollectionsManagerDialog.tsx`
- Test: `lib/page-builder/galleryPicker/CollectionsManagerDialog.test.tsx` (create if absent; otherwise add a case)

- [ ] **Step 1: Write the failing test**

```tsx
// CollectionsManagerDialog.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { CollectionsManagerDialog } from "./CollectionsManagerDialog";
import { __clearPickerDataCache } from "./usePickerData";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);
const collections = [{ id: "col1", name: "Weddings", coverUrl: "https://x/c.jpg", coverPublicId: "pid-a", itemCount: 2 }];

beforeEach(() => {
  __clearPickerDataCache();
  mockFetch.mockReset();
  mockFetch.mockImplementation((url: string) => {
    if (url === "/api/portfolio/gallery") return Promise.resolve({ ok: true, json: async () => ({ collections, items: [] }) } as Response);
    if (url.startsWith("/api/portfolio/gallery/collections/col1?")) return Promise.resolve({ ok: true, json: async () => ({ items: [], nextCursor: null }) } as Response);
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
  });
});

describe("CollectionsManagerDialog edit", () => {
  it("opens the edit dialog when a collection is clicked", async () => {
    renderWithProviders(<CollectionsManagerDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /edit weddings/i }));
    expect(await screen.findByLabelText(/collection name/i)).toBeTruthy();
  });
});
```

> If the test file already exists, ADD this `describe` and do not overwrite (verify with `git show HEAD:lib/page-builder/galleryPicker/CollectionsManagerDialog.test.tsx`).

- [ ] **Step 2: Run it — expect FAIL** (`pnpm test --run CollectionsManagerDialog`)

- [ ] **Step 3: Edit `CollectionsManagerDialog.tsx`.** Add imports + state:

```tsx
import { EditCollectionDialog } from "./EditCollectionDialog";
// ...
const [editing, setEditing] = useState<PickerCollection | null>(null);
```

Make each collection cell open the edit dialog. Wrap the cover+meta area in a button (keep the delete button on top with `stopPropagation`). Replace the cover `<span>` + meta `<span>` block inside the `<li>` with a clickable button:

```tsx
<button
  type="button"
  aria-label={`Edit ${col.name}`}
  onClick={() => setEditing(col)}
  className="flex w-full flex-col text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
>
  <span className="relative aspect-square w-full overflow-hidden bg-muted">
    {col.coverUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={col.coverUrl} alt="" className="size-full object-cover" loading="lazy" />
    ) : (
      <span className="flex size-full items-center justify-center"><ImagePlusIcon className="size-6 text-muted-foreground" aria-hidden /></span>
    )}
  </span>
  <span className="flex flex-col gap-0.5 px-2 py-1.5">
    <span className="truncate text-xs font-medium">{col.name}</span>
    <span className="text-xs text-muted-foreground">{col.itemCount} {L.photos}</span>
  </span>
</button>
```

Keep the existing delete `<button>` as a sibling inside the `<li>` (absolute positioned). Add `onClick` guard so the delete button doesn't also trigger edit — it already lives outside the new button, so no change needed beyond ensuring it renders after the button in the DOM and stays `absolute right-1 top-1`.

Render the edit dialog before the closing `</Dialog>`:

```tsx
<EditCollectionDialog
  open={editing !== null}
  onOpenChange={(n) => { if (!n) setEditing(null); }}
  collection={editing}
  onChanged={retry}
/>
```

- [ ] **Step 4: Run it — expect PASS** (`pnpm test --run CollectionsManagerDialog`)

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/galleryPicker/CollectionsManagerDialog.tsx lib/page-builder/galleryPicker/CollectionsManagerDialog.test.tsx
git commit -m "feat(gallery): open Edit collection dialog from the manager"
```

---

## Task 13: Full verification sweep

- [ ] **Step 1: Targeted tests for everything new**

Run:
```bash
pnpm test --run "gallery.refcount|gallery.allitems|items/copy|route.patch|items/reorder|items/remove|items/delete|route.delete|ExistingPhotosPicker|CreateCollectionDialog|EditCollectionDialog|CollectionsManagerDialog"
```
Expected: all green.

- [ ] **Step 2: Regression — existing gallery + picker suites**

Run: `pnpm test --run "gallery|MediaPicker|portfolio"`
Expected: green (watch for any `listAllItemsPage` consumer assuming duplicates).

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors. (If `PipelineStage`/`GalleryItemDoc` import is missing in `gallery.ts`, fix it here.)

- [ ] **Step 4: Lint the changed files**

Run: `pnpm lint`
Expected: no NEW errors in the files touched (pre-existing repo warnings unrelated to this work are acceptable).

- [ ] **Step 5: Mobile check at 375px** (manual, per CLAUDE.md)

Confirm in the editor: the picker collections grid (2-col at 375px), the 3×3 photo grid, the Edit dialog rename row, add buttons, current-photos grid, and the selection action bar all lay out cleanly with no horizontal scroll; the photos modal title truncates with the close button reachable.

- [ ] **Step 6: Commit any sweep fixes**

```bash
git add -A
git commit -m "test(gallery): verification sweep fixes for collection picker + edit dialog"
```

---

## Self-Review (completed during authoring)

- **Spec coverage:** create pick-existing (T10), edit dialog rename/add/remove/delete/reorder/cover (T11), shared picker 4×2 + 3×3 (T9), copy idempotency + tenant isolation (T3), All-Photos dedup (T2), reference-counted delete (T8), PATCH cover validation (T4), reorder (T5), detach last-doc→standalone (T6), permanent delete repoints cover (T7). All mapped.
- **Type consistency:** `PickerItem` ({id, publicId, thumbUrl, caption}) used uniformly; copy/remove/delete routes all take id arrays; `onAdd(items: PickerItem[])` consistent across picker → both dialogs.
- **Known pitfalls flagged:** create-flow uses copy-after-create (PickerItem has no url); test files that may pre-exist (T10/T12) carry an explicit "add, don't overwrite" guard — mirrors the overwrite incident on the prior branch.

