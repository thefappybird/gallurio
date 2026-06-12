# Featured Work — Collections Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Featured Work block (editor label "Highlights", component key `FeaturedWork`) from an async server block that picks ≤3 individual photos into an isomorphic, client-safe **collections showcase**: cover+title tiles that open a paginated public popup with a nested full-size lightbox, styled by a new workspace-wide "Collections Popup" config edited from a new editor tab.

**Architecture:** The block bakes `collections: FeaturedCollectionRef[]` into Puck props (spec #2 pattern), renders tiles purely from baked covers (no server fetch), and delegates interactivity to client islands. Popup images are fetched **lazily, paginated** — owner endpoint in the editor, a new **public slug-scoped** endpoint on the live page — both normalized to `{ id, publicId, alt }`. A new `MediaPicker` `collections` mode + `collectionsField` adapter replaces the retired `FeaturedItemsPicker`. `reconcile` gains a sibling pass that refreshes/prunes `collections[]`. Popup style lives in `publicPage.collectionsPopup`, edited via a `CollectionsPopupPanelDialog` mirroring `header`/`contact`.

**Tech Stack:** Next.js 16 App Router, React 19, Puck (`@measured/puck`), Mongoose 8, Zod, `base-ui` dialog (`components/ui/dialog.tsx`), Tailwind v4, Vitest + `@testing-library/react` + `happy-dom` + `mongodb-memory-server` (`test-utils/mongo`), Cloudinary (client-safe `cloudinaryImageUrl`).

---

## Critical facts & spec reconciliations (read before starting)

These were verified against the **worktree** (`.claude/worktrees/feat+portfolio+enhancements`), which — unlike the main checkout — contains specs #1–3 work.

1. **`GalleryItem` has NO `isPublic` field.** `isPublic` is on **`GalleryCollection`** only (`lib/db/models/GalleryCollection.ts`). So the spec's "filter items by `isPublic:true`" is replaced by: the public endpoint gates on the **collection's** `isPublic` (private/foreign/missing ⇒ 404); a public collection returns **all** its items. `itemCount` = `collection.isPublic ? totalItemCount : 0` (so the tile label matches what the popup shows).
2. **`PickerCollection` carries `coverUrl` (a thumbnail URL), not `coverPublicId`.** The picker-data query must additionally surface `coverPublicId`. The collection cover field is **`coverItemId`** (not `coverImageId`).
3. **The editor `<Puck>` passes no `metadata` today.** The block is rendered server→client; the popup island must take **serializable** props (`mode: "owner"|"public"`, `slug`, `popupConfig`, tile data) — never a function. We thread `metadata.workspace` into the editor `<Puck>` (Task 14) and the public `<Render>` already threads it (Task 1 extends its shape).
4. **`spec.md` says block uses `getItemsByIds`** — that path is removed. Check `getItemsByIds` for other consumers before deleting it (Task 16); it is still used by other code, so likely keep it but ensure FeaturedWork no longer imports it.
5. **Cloudinary helpers:** server `cloudinaryThumbnailUrl` (`lib/storage/cloudinary.ts`) is server-only; client-safe is `cloudinaryImageUrl` (`lib/page-builder/cloudinaryClient.ts`, reads `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`). The block + islands use ONLY `cloudinaryImageUrl`.
6. **Editor chrome is English-only** (Puck panels are not inside `IntlProvider`). Add NO new public-facing locale strings. The block's photo-count text is plain English chrome (per spec).
7. **Owner endpoint already exists** (`GET /api/portfolio/gallery/collections/[id]`) returning `{ items: PickerItem[]; nextCursor }` where `PickerItem = { id, publicId, thumbUrl, caption }`. Editor-mode popup uses it and maps `caption → alt`. The new public endpoint returns `{ id, publicId, alt }`. The island normalizes both to `{ id, publicId, alt }`.

## File structure

**Create:**
- `app/api/public/w/[orgSlug]/collections/[id]/route.ts` — public paginated collection-images endpoint.
- `lib/page-builder/blocks/FeaturedCollectionsClient.tsx` — `"use client"` tile grid + active-collection state.
- `lib/page-builder/blocks/CollectionPopup.tsx` — `"use client"` modal (paginated, sticky header, floating close, 6-wide flex-wrap) + nested lightbox.
- `lib/page-builder/blocks/FeaturedCollectionsClient.test.tsx`, `CollectionPopup.test.tsx`.
- `app/[locale]/(app)/portfolio/_components/CollectionsPopupPanelDialog.tsx` — config panel.
- `app/api/public/w/[orgSlug]/collections/[id]/route.test.ts`.
- Tests co-located with each new query/action/component.

**Modify:**
- `lib/validators/publicPage.ts` — add `portfolioCollectionsPopupConfigSchema` + type.
- `lib/db/models/Workspace.ts` — add `publicPage.collectionsPopup`.
- `lib/page-builder/blockContext.ts` — extend `RenderWorkspace` (collectionsPopup + `editorPreview`).
- `lib/page-builder/serverContext.tsx` — `buildRenderWorkspace` copies `collectionsPopup`.
- `lib/db/queries/gallery.ts` — add `coverPublicId` to picker collections; add `listPublicCollectionItemsPage` + shared keyset helper.
- `lib/page-builder/blocks/FeaturedWorkBlock.tsx` — full rewrite (isomorphic).
- `lib/page-builder/galleryPicker/MediaPicker.tsx` — add `collections` mode.
- `lib/page-builder/galleryPicker/types.ts` — `PickerCollection.coverPublicId`.
- `lib/page-builder/editorConfig.tsx` — `collectionsField` factory + `MultiCollectionControl`; rewire `featuredWork` to real block.
- `lib/page-builder/StyleToolkitField.tsx` — FeaturedWork Content/Layout tabs → collections picker + columns.
- `lib/page-builder/reconcile.ts` — add `reconcileFeaturedCollections`.
- `app/[locale]/(app)/portfolio/page.tsx` — chain reconcile; pass `initialCollectionsPopup`.
- `app/[locale]/(app)/portfolio/_actions.ts` — `updateCollectionsPopupConfigAction`; chain reconcile in publish.
- `app/[locale]/(app)/portfolio/_components/EditorShell.tsx` — new tab, panel mount, draft, publish, editor `<Puck>` metadata.
- `app/(public)/w/[orgSlug]/page.tsx` — include `collectionsPopup` + `editorPreview:false` in render metadata.
- `lib/page-builder/blocks/sectionPresets.ts` — `FeaturedWorkPreset` embeds new block shape.
- `lib/page-builder/seedPortfolio.ts` — drop/adapt `injectGalleryRefs` itemIds injection.

**Delete:**
- `lib/page-builder/galleryPicker/FeaturedItemsPicker.tsx` + `FeaturedItemsPicker.test.tsx`.

---

## Task 1: `collectionsPopup` config type, schema, model, render-shape

**Files:**
- Modify: `lib/page-builder/types.ts` (add `PortfolioCollectionsPopupConfig` type near `BRAND_KIT_RADII`)
- Modify: `lib/validators/publicPage.ts`
- Modify: `lib/db/models/Workspace.ts`
- Modify: `lib/page-builder/blockContext.ts` (RenderWorkspace)
- Modify: `lib/page-builder/serverContext.tsx` (buildRenderWorkspace)
- Test: `lib/validators/publicPage.test.ts` (create or extend)

- [ ] **Step 1: Write the failing schema test**

Create/extend `lib/validators/publicPage.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { portfolioCollectionsPopupConfigSchema } from "./publicPage";

describe("portfolioCollectionsPopupConfigSchema", () => {
  it("accepts an empty object (all optional → flat sharp defaults)", () => {
    expect(portfolioCollectionsPopupConfigSchema.parse({})).toEqual({});
  });
  it("accepts valid border/background/radius", () => {
    const v = { backgroundColor: "surface", borderColor: "#1a1a1a", borderWidth: 2, radius: "subtle" as const };
    expect(portfolioCollectionsPopupConfigSchema.parse(v)).toEqual(v);
  });
  it("rejects borderWidth out of range", () => {
    expect(portfolioCollectionsPopupConfigSchema.safeParse({ borderWidth: 999 }).success).toBe(false);
  });
  it("rejects an unknown radius", () => {
    expect(portfolioCollectionsPopupConfigSchema.safeParse({ radius: "huge" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`portfolioCollectionsPopupConfigSchema` not exported)

Run: `npx vitest run lib/validators/publicPage.test.ts`

- [ ] **Step 3: Add the type** in `lib/page-builder/types.ts` (after `BRAND_KIT_RADII`):

```typescript
export type PortfolioCollectionsPopupConfig = {
  backgroundColor?: string; // token name or hex
  borderColor?: string;     // token name or hex
  borderWidth?: number;     // px, 0 = none
  radius?: BrandKitRadius | "";
};
```

- [ ] **Step 4: Add the Zod schema** in `lib/validators/publicPage.ts` (mirror `portfolioContactConfigSchema`; `BRAND_KIT_RADII` is already imported):

```typescript
export const portfolioCollectionsPopupConfigSchema = z.object({
  backgroundColor: z.string().max(32).optional().or(z.literal("")),
  borderColor: z.string().max(32).optional().or(z.literal("")),
  borderWidth: z.number().int().min(0).max(12).optional(),
  radius: z.enum(BRAND_KIT_RADII).optional().or(z.literal("")),
});
export type PortfolioCollectionsPopupConfigInput = z.infer<typeof portfolioCollectionsPopupConfigSchema>;
```

- [ ] **Step 5: Add the Workspace subdoc** in `lib/db/models/Workspace.ts` `publicPage` (sibling of `header`/`contact`):

```typescript
collectionsPopup: {
  backgroundColor: { type: String, default: "" },
  borderColor: { type: String, default: "" },
  borderWidth: { type: Number, default: 0 },
  radius: { type: String, enum: [...BRAND_KIT_RADII, ""], default: "" },
},
```

(Import `BRAND_KIT_RADII` in Workspace.ts if not already.)

- [ ] **Step 6: Extend `RenderWorkspace`** in `lib/page-builder/blockContext.ts`:

```typescript
// inside RenderWorkspace.publicPage:
publicPage?: {
  inquiryRecipientEmail?: string | null;
  collectionsPopup?: import("@/lib/page-builder/types").PortfolioCollectionsPopupConfig | null;
} | null;
/** True when rendered inside the editor canvas / chrome-less preview (owner context). */
editorPreview?: boolean;
```

(Use a direct `import type` at the top instead of inline import if the file style prefers that.)

- [ ] **Step 7: Copy `collectionsPopup`** in `buildRenderWorkspace` (`lib/page-builder/serverContext.tsx`) — add `collectionsPopup` to the `publicPage` it builds from the workspace doc.

- [ ] **Step 8: Run schema test — expect PASS.** Run: `npx vitest run lib/validators/publicPage.test.ts`

- [ ] **Step 9: typecheck**

Run: `pnpm typecheck` — Expected: clean.

- [ ] **Step 10: Commit**

```bash
git add lib/page-builder/types.ts lib/validators/publicPage.ts lib/validators/publicPage.test.ts lib/db/models/Workspace.ts lib/page-builder/blockContext.ts lib/page-builder/serverContext.tsx
git commit -m "feat(portfolio): collectionsPopup config type/schema/model/render-shape"
```

---

## Task 2: New `FeaturedWorkProps` + `FeaturedCollectionRef` types

**Files:**
- Modify: `lib/page-builder/blocks/FeaturedWorkBlock.tsx` (types + defaultProps only this task; full render rewrite in Task 9)
- Test: `lib/page-builder/blocks/FeaturedWorkBlock.test.tsx` (replace old tests in Task 9; here add a types/default test)

- [ ] **Step 1: Failing test** — append to a fresh `FeaturedWorkBlock.test.tsx` (old file will be fully replaced in Task 9; create a minimal one now):

```typescript
import { describe, it, expect } from "vitest";
import { featuredWorkDefaultProps } from "./FeaturedWorkBlock";

describe("featuredWorkDefaultProps (new shape)", () => {
  it("defaults to empty collections + columns 3, no itemIds/layout", () => {
    expect(featuredWorkDefaultProps.collections).toEqual([]);
    expect(featuredWorkDefaultProps.columns).toBe(3);
    expect(featuredWorkDefaultProps).not.toHaveProperty("itemIds");
    expect(featuredWorkDefaultProps).not.toHaveProperty("layout");
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** Run: `npx vitest run lib/page-builder/blocks/FeaturedWorkBlock.test.tsx`

- [ ] **Step 3: Replace the types + defaults** at the top of `FeaturedWorkBlock.tsx` (leave the old async render in place for now so the file compiles; Task 9 removes it). Add:

```typescript
export type FeaturedCollectionRef = {
  id: string;            // durable GalleryCollection id
  name: string;          // cache (reconcile-refreshed)
  coverPublicId: string; // cache: Cloudinary publicId of the cover (reconcile-refreshed)
  itemCount: number;     // cache: public photo count (reconcile-refreshed)
};

export type FeaturedWorkProps = {
  _style?: BlockStyle;
  collections: FeaturedCollectionRef[];
  columns: 2 | 3 | 4;
};

export const featuredWorkDefaultProps: FeaturedWorkProps = {
  collections: [],
  columns: 3,
};
```

Temporarily comment out / delete the old `FeaturedWorkItemId`, `normalizeItemIds`, `MAX_FEATURED`, the async `FeaturedWorkBlock`, and `featuredWorkBlockConfig` ONLY if they block compilation; otherwise leave them and Task 9 removes them. (Simplest: in this task, delete the old `featuredWorkDefaultProps` and old `FeaturedWorkProps`, keep old render temporarily renamed `LegacyFeaturedWorkBlock` if needed to keep `config.ts` importing. If that is messy, fold Task 2 into Task 9 — but keep the commit boundary.)

- [ ] **Step 4: Run — expect PASS.** Run: `npx vitest run lib/page-builder/blocks/FeaturedWorkBlock.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/blocks/FeaturedWorkBlock.tsx lib/page-builder/blocks/FeaturedWorkBlock.test.tsx
git commit -m "feat(portfolio): new FeaturedWork collections props shape"
```

---

## Task 3: Surface `coverPublicId` on picker collections

**Files:**
- Modify: `lib/page-builder/galleryPicker/types.ts` (add `coverPublicId`)
- Modify: `lib/db/queries/gallery.ts` (the collections-list builder — `listCollectionsForPicker` or equivalent that produces `PickerCollection[]`)
- Test: `lib/db/queries/gallery.test.ts`

- [ ] **Step 1: Failing test** — add to `gallery.test.ts`:

```typescript
import { listCollectionsForPicker } from "./gallery"; // confirm exact exported name

describe("listCollectionsForPicker — coverPublicId", () => {
  it("resolves coverPublicId from coverItemId, else newest item, else ''", async () => {
    const ws = new Types.ObjectId();
    const col = await GalleryCollection.create({ workspaceId: ws, name: "Weddings", slug: "weddings", isPublic: true });
    const a = await GalleryItem.create({ workspaceId: ws, collectionId: col._id, cloudinaryPublicId: "pid-a", url: "u", order: 0 });
    await GalleryItem.create({ workspaceId: ws, collectionId: col._id, cloudinaryPublicId: "pid-b", url: "u", order: 1 });
    // no explicit cover → newest item (highest createdAt). Assert non-empty.
    let cols = await listCollectionsForPicker(ws.toString());
    expect(cols[0].coverPublicId).toBeTruthy();
    // explicit cover → that item's publicId
    await GalleryCollection.updateOne({ _id: col._id }, { $set: { coverItemId: a._id } });
    cols = await listCollectionsForPicker(ws.toString());
    expect(cols.find((c) => c.id === String(col._id))!.coverPublicId).toBe("pid-a");
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`coverPublicId` undefined). Run: `npx vitest run lib/db/queries/gallery.test.ts -t coverPublicId`

- [ ] **Step 3:** Add `coverPublicId: string` to `PickerCollection` in `lib/page-builder/galleryPicker/types.ts`. Mirror it in any duplicate `PickerCollection` in `gallery.ts` (keep them identical).

- [ ] **Step 4:** In the collections-list builder in `gallery.ts`: it already resolves the cover's `cloudinaryPublicId` to build `coverUrl`. Capture that publicId as `coverPublicId`. When there is no `coverItemId`, resolve the **newest** item's publicId (batch a `$sort: { createdAt: -1 }` first-per-collection, or reuse the existing cover-resolution batch) and use it for BOTH `coverUrl` and `coverPublicId`. Empty collection → `coverPublicId: ""`, `coverUrl: null`.

- [ ] **Step 5: Run — expect PASS.** Run: `npx vitest run lib/db/queries/gallery.test.ts -t coverPublicId`

- [ ] **Step 6: typecheck + commit**

```bash
pnpm typecheck
git add lib/page-builder/galleryPicker/types.ts lib/db/queries/gallery.ts lib/db/queries/gallery.test.ts
git commit -m "feat(portfolio): expose coverPublicId on picker collections"
```

---

## Task 4: Public collection-images query + shared keyset helper

**Files:**
- Modify: `lib/db/queries/gallery.ts`
- Test: `lib/db/queries/gallery.test.ts`

- [ ] **Step 1: Failing test** — add to `gallery.test.ts`:

```typescript
import { listPublicCollectionItemsPage } from "./gallery";

describe("listPublicCollectionItemsPage", () => {
  it("returns { id, publicId, alt } paginated by (order,_id) for a PUBLIC collection", async () => {
    const ws = new Types.ObjectId();
    const col = await GalleryCollection.create({ workspaceId: ws, name: "C", slug: "c", isPublic: true });
    await GalleryItem.insertMany(
      Array.from({ length: 3 }, (_, i) => ({ workspaceId: ws, collectionId: col._id, cloudinaryPublicId: `p${i}`, url: "u", altText: i === 0 ? "Alt0" : "", caption: i === 0 ? "" : `Cap${i}`, order: i }))
    );
    const p1 = await listPublicCollectionItemsPage({ workspaceId: ws.toString(), collectionId: col._id.toString(), limit: 2 });
    expect(p1.items.map((i) => i.publicId)).toEqual(["p0", "p1"]);
    expect(p1.items[0]).toEqual({ id: expect.any(String), publicId: "p0", alt: "Alt0" });
    expect(p1.items[1].alt).toBe("Cap1"); // alt falls back to caption
    expect(p1.nextCursor).toBeTruthy();
    const p2 = await listPublicCollectionItemsPage({ workspaceId: ws.toString(), collectionId: col._id.toString(), limit: 2, cursor: p1.nextCursor });
    expect(p2.items.map((i) => i.publicId)).toEqual(["p2"]);
    expect(p2.nextCursor).toBeNull();
  });
  it("returns empty for a PRIVATE collection", async () => {
    const ws = new Types.ObjectId();
    const col = await GalleryCollection.create({ workspaceId: ws, name: "C", slug: "c", isPublic: false });
    await GalleryItem.create({ workspaceId: ws, collectionId: col._id, cloudinaryPublicId: "p", url: "u", order: 0 });
    const page = await listPublicCollectionItemsPage({ workspaceId: ws.toString(), collectionId: col._id.toString() });
    expect(page).toEqual({ items: [], nextCursor: null });
  });
  it("tenant isolation: foreign workspace id yields empty", async () => {
    const wsA = new Types.ObjectId(); const wsB = new Types.ObjectId();
    const colB = await GalleryCollection.create({ workspaceId: wsB, name: "B", slug: "b", isPublic: true });
    await GalleryItem.create({ workspaceId: wsB, collectionId: colB._id, cloudinaryPublicId: "p", url: "u", order: 0 });
    const page = await listPublicCollectionItemsPage({ workspaceId: wsA.toString(), collectionId: colB._id.toString() });
    expect(page).toEqual({ items: [], nextCursor: null });
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** Run: `npx vitest run lib/db/queries/gallery.test.ts -t listPublicCollectionItemsPage`

- [ ] **Step 3:** Implement in `gallery.ts`. Add a `PublicCollectionImage` type and refactor the existing `(order,_id)` keyset logic out of `listCollectionItemsPage` into a private helper `keysetCollectionPage(filter, cursor, limit, mapFn)` shared by both. New function:

```typescript
export type PublicCollectionImage = { id: string; publicId: string; alt: string };

export async function listPublicCollectionItemsPage(opts: {
  workspaceId: string;
  collectionId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<{ items: PublicCollectionImage[]; nextCursor: string | null }> {
  const { workspaceId, collectionId } = opts;
  if (!workspaceId || !Types.ObjectId.isValid(collectionId)) return { items: [], nextCursor: null };
  await connectDB();
  // Gate on the COLLECTION's isPublic (items have no isPublic field). Tenant-scoped.
  const col = await GalleryCollection.findOne({ _id: collectionId, workspaceId, isPublic: true })
    .select({ _id: 1 }).lean();
  if (!col) return { items: [], nextCursor: null };

  const limit = clampLimit(opts.limit);
  const filter: Record<string, unknown> = { workspaceId, collectionId };
  if (opts.cursor) {
    const c = decodeCursor(opts.cursor);
    if (c) {
      const order = Number(c.sortValue);
      if (Number.isFinite(order)) {
        filter.$or = [{ order: { $gt: order } }, { order, _id: { $gt: new Types.ObjectId(c.id) } }];
      }
    }
  }
  const docs = await GalleryItem.find(filter)
    .sort({ order: 1, _id: 1 })
    .limit(limit + 1)
    .select({ cloudinaryPublicId: 1, altText: 1, caption: 1, order: 1 })
    .lean();
  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor((last.order as number), String(last._id)) : null;
  return {
    items: page.map((d) => ({ id: String(d._id), publicId: (d.cloudinaryPublicId as string) ?? "", alt: (d.altText as string) || (d.caption as string) || "" })),
    nextCursor,
  };
}
```

(Reuse existing `clampLimit`/`encodeCursor`/`decodeCursor`. The `{ workspaceId, collectionId, order }` index backs this.)

- [ ] **Step 4: Run — expect PASS.** Run: `npx vitest run lib/db/queries/gallery.test.ts -t listPublicCollectionItemsPage`

- [ ] **Step 5: Run the full gallery query suite** (ensure the `listCollectionItemsPage` refactor didn't regress): `npx vitest run lib/db/queries/gallery.test.ts`

- [ ] **Step 6: Commit**

```bash
git add lib/db/queries/gallery.ts lib/db/queries/gallery.test.ts
git commit -m "feat(portfolio): public collection-images query (isPublic-gated, paginated)"
```

---

## Task 5: Public endpoint `GET /api/public/w/[orgSlug]/collections/[id]`

**Files:**
- Create: `app/api/public/w/[orgSlug]/collections/[id]/route.ts`
- Test: `app/api/public/w/[orgSlug]/collections/[id]/route.test.ts`

- [ ] **Step 1: Failing test** (mirror `app/api/portfolio/gallery/route.test.ts` mocking style; do NOT mock `requireOrg` — this is public):

```typescript
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

type MockResp = { body: unknown; status: number };
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, NextResponse: { json: (body: unknown, init?: ResponseInit): MockResp => ({ body, status: init?.status ?? 200 }) } };
});
vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryCollection, GalleryItem, Workspace } from "@/lib/db/models";
import { GET } from "./route";

function req(url: string) { return new Request(url); }
async function call(orgSlug: string, id: string, qs = "") {
  return (await GET(req(`http://localhost/api/public/w/${orgSlug}/collections/${id}${qs}`), { params: Promise.resolve({ orgSlug, id }) })) as unknown as MockResp;
}

let ws: { _id: Types.ObjectId; slug: string };
let publicCol: Types.ObjectId;

async function seed() {
  const w = await Workspace.create({ slug: "studio", name: "Studio", ownerUserId: "u", clerkOrgId: `org_${Math.round(Math.random()*1e9)}`, currency: "PHP", publicPage: { publishedAt: new Date() } });
  ws = { _id: w._id, slug: "studio" };
  const col = await GalleryCollection.create({ workspaceId: w._id, name: "Weddings", slug: "weddings", isPublic: true });
  publicCol = col._id;
  await GalleryItem.insertMany(Array.from({ length: 3 }, (_, i) => ({ workspaceId: w._id, collectionId: col._id, cloudinaryPublicId: `p${i}`, url: "u", order: i })));
}

beforeAll(startInMemoryMongo); afterAll(stopInMemoryMongo);
beforeEach(async () => { await clearCollections(); await seed(); });

describe("GET /api/public/w/[orgSlug]/collections/[id]", () => {
  it("returns paginated items for a published workspace's public collection", async () => {
    const res = await call("studio", publicCol.toString(), "?limit=2");
    expect(res.status).toBe(200);
    const body = res.body as { items: { publicId: string }[]; nextCursor: string | null };
    expect(body.items.map((i) => i.publicId)).toEqual(["p0", "p1"]);
    expect(body.nextCursor).toBeTruthy();
  });
  it("404 for an unpublished/unknown slug", async () => {
    await Workspace.updateOne({ _id: ws._id }, { $set: { "publicPage.publishedAt": null } });
    expect((await call("studio", publicCol.toString())).status).toBe(404);
    expect((await call("nope", publicCol.toString())).status).toBe(404);
  });
  it("400 for an invalid id", async () => {
    expect((await call("studio", "not-an-id")).status).toBe(400);
  });
  it("tenant isolation: cannot read another workspace's collection via this slug", async () => {
    const other = await Workspace.create({ slug: "other", name: "O", ownerUserId: "u2", clerkOrgId: `org_${Math.round(Math.random()*1e9)}`, currency: "PHP", publicPage: { publishedAt: new Date() } });
    const colO = await GalleryCollection.create({ workspaceId: other._id, name: "X", slug: "x", isPublic: true });
    await GalleryItem.create({ workspaceId: other._id, collectionId: colO._id, cloudinaryPublicId: "z", url: "u", order: 0 });
    const res = await call("studio", colO._id.toString());
    expect((res.body as { items: unknown[] }).items).toEqual([]); // studio's workspace doesn't own colO
  });
  it("private collection yields empty items", async () => {
    await GalleryCollection.updateOne({ _id: publicCol }, { $set: { isPublic: false } });
    const res = await call("studio", publicCol.toString());
    expect((res.body as { items: unknown[] }).items).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (route missing). Run: `npx vitest run "app/api/public/w/[orgSlug]/collections/[id]/route.test.ts"`

- [ ] **Step 3: Implement** `route.ts`:

```typescript
import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { findPublishedWorkspaceBySlug } from "@/lib/db/queries/publicPage";
import { listPublicCollectionItemsPage } from "@/lib/db/queries/gallery";

export const runtime = "nodejs";

type Params = { params: Promise<{ orgSlug: string; id: string }> };

/**
 * GET /api/public/w/[orgSlug]/collections/[id]?cursor=<c>&limit=<n>
 *
 * Public, slug-scoped paginated read of a published workspace's PUBLIC collection
 * images, for the Featured Work popup. Resolves orgSlug→workspaceId (publish-gated;
 * 404 before any item read). workspaceId is NEVER client-supplied. The collection's
 * isPublic gates visibility (items have no isPublic field). Response:
 * { items: { id, publicId, alt }[]; nextCursor }.
 */
export async function GET(req: Request, { params }: Params) {
  const { orgSlug, id } = await params;
  const workspace = await findPublishedWorkspaceBySlug(orgSlug);
  if (!workspace) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (!isValidObjectId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw == null ? undefined : Number(limitRaw);

  const page = await listPublicCollectionItemsPage({
    workspaceId: String(workspace._id),
    collectionId: id,
    cursor,
    limit,
  });
  return NextResponse.json(page);
}
```

- [ ] **Step 4: Run — expect PASS.** Run: `npx vitest run "app/api/public/w/[orgSlug]/collections/[id]/route.test.ts"`

- [ ] **Step 5: Commit**

```bash
git add "app/api/public/w/[orgSlug]/collections/[id]/route.ts" "app/api/public/w/[orgSlug]/collections/[id]/route.test.ts"
git commit -m "feat(portfolio): public slug-scoped collection-images endpoint"
```

---

## Task 6: `reconcileFeaturedCollections` + wire both call sites

**Files:**
- Modify: `lib/page-builder/reconcile.ts`
- Modify: `app/[locale]/(app)/portfolio/page.tsx` (editor-load chain)
- Modify: `app/[locale]/(app)/portfolio/_actions.ts` (publish chain)
- Test: `lib/page-builder/reconcile.test.ts`

- [ ] **Step 1: Failing test** — add to `reconcile.test.ts`:

```typescript
import { reconcileFeaturedCollections } from "./reconcile";
import { GalleryCollection } from "@/lib/db/models/GalleryCollection";

function fwBlock(collections: Array<{ id: string; name?: string; coverPublicId?: string; itemCount?: number }>) {
  return { type: "FeaturedWork", props: { id: "fw1", collections, columns: 3 } };
}

describe("reconcileFeaturedCollections", () => {
  it("refreshes name + coverPublicId(from coverItemId) + itemCount(public total); preserves order; prunes deleted/foreign; never adds", async () => {
    const ws = new Types.ObjectId();
    const colA = await GalleryCollection.create({ workspaceId: ws, name: "Weddings", slug: "w", isPublic: true });
    const cover = await GalleryItem.create({ workspaceId: ws, collectionId: colA._id, cloudinaryPublicId: "cover-pid", url: "u", order: 0 });
    await GalleryItem.create({ workspaceId: ws, collectionId: colA._id, cloudinaryPublicId: "p1", url: "u", order: 1 });
    await GalleryCollection.updateOne({ _id: colA._id }, { $set: { coverItemId: cover._id } });
    const foreignWs = new Types.ObjectId();
    const foreign = await GalleryCollection.create({ workspaceId: foreignWs, name: "X", slug: "x", isPublic: true });
    const missing = new Types.ObjectId().toString();

    const data = { root: {}, content: [fwBlock([
      { id: String(colA._id), name: "STALE", coverPublicId: "STALE", itemCount: 0 },
      { id: missing },
      { id: String(foreign._id) },
    ])] } as any;

    const out = await reconcileFeaturedCollections(ws.toString(), data);
    const cols = out.content[0].props.collections;
    expect(cols).toEqual([{ id: String(colA._id), name: "Weddings", coverPublicId: "cover-pid", itemCount: 2 }]);
  });

  it("itemCount is 0 for a private collection (label matches empty popup)", async () => {
    const ws = new Types.ObjectId();
    const col = await GalleryCollection.create({ workspaceId: ws, name: "Priv", slug: "p", isPublic: false });
    await GalleryItem.create({ workspaceId: ws, collectionId: col._id, cloudinaryPublicId: "x", url: "u", order: 0 });
    const data = { root: {}, content: [fwBlock([{ id: String(col._id) }])] } as any;
    const out = await reconcileFeaturedCollections(ws.toString(), data);
    expect(out.content[0].props.collections[0].itemCount).toBe(0);
  });

  it("falls back coverPublicId to newest item when no coverItemId; '' for empty collection", async () => {
    const ws = new Types.ObjectId();
    const withItems = await GalleryCollection.create({ workspaceId: ws, name: "A", slug: "a", isPublic: true });
    await GalleryItem.create({ workspaceId: ws, collectionId: withItems._id, cloudinaryPublicId: "newest", url: "u", order: 0 });
    const empty = await GalleryCollection.create({ workspaceId: ws, name: "B", slug: "b", isPublic: true });
    const data = { root: {}, content: [fwBlock([{ id: String(withItems._id) }, { id: String(empty._id) }])] } as any;
    const out = await reconcileFeaturedCollections(ws.toString(), data);
    expect(out.content[0].props.collections[0].coverPublicId).toBe("newest");
    expect(out.content[0].props.collections[1].coverPublicId).toBe("");
  });

  it("no-op (no query) when there are no FeaturedWork blocks", async () => {
    const ws = new Types.ObjectId();
    const findSpy = vi.spyOn(GalleryCollection, "find");
    const data = { root: {}, content: [{ type: "Heading", props: { id: "h", text: "x", level: "h2" } }] } as any;
    const out = await reconcileFeaturedCollections(ws.toString(), data);
    expect(findSpy).not.toHaveBeenCalled();
    expect(out).toEqual(data);
    findSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** Run: `npx vitest run lib/page-builder/reconcile.test.ts -t reconcileFeaturedCollections`

- [ ] **Step 3:** Implement `reconcileFeaturedCollections` in `reconcile.ts` (reuse `blockArrays`, `validId`). Walk for `type === "FeaturedWork"`, collect `props.collections[].id`. If none, return `data` unchanged (no DB). Otherwise:
- One batched `GalleryCollection.find({ workspaceId, _id: { $in: ids } }).select({ name:1, coverItemId:1, isPublic:1 })`.
- One batched item-count aggregate per collection (`$match { workspaceId, collectionId: { $in: ids } }`, `$group { _id: "$collectionId", count }`).
- Resolve cover publicIds: batch `GalleryItem.find` for all `coverItemId`s → map id→publicId; for collections lacking a cover, batch the **newest** item per collection (e.g. aggregate `$sort {createdAt:-1}` + `$group {_id:"$collectionId", pid: {$first:"$cloudinaryPublicId"}}` restricted to the cover-less ids).
- Rebuild each block's `collections[]`: for each stored id present in the workspace map → `{ id, name, coverPublicId: cover ?? newest ?? "", itemCount: isPublic ? count : 0 }`. Drop missing/foreign. Preserve order. Never add. Return a new data object (don't mutate); handle `content` + `zones` like `reconcileGalleryImages`.

- [ ] **Step 4: Run — expect PASS.** Run: `npx vitest run lib/page-builder/reconcile.test.ts`

- [ ] **Step 5: Wire call sites.** In `page.tsx`, chain after the gallery reconcile:

```typescript
const reconcile = async (raw: unknown) =>
  reconcileFeaturedCollections(workspaceId, await reconcileGalleryImages(workspaceId, toPlain<PuckData>(raw, EMPTY_ZONE)));
const initialData = { home: await reconcile(homeData), gallery: await reconcile(galleryData) };
```

In `_actions.ts` `publishPortfolioAction`, wrap each persisted zone the same way:

```typescript
if (home) set["publicPage.data.home"] = await reconcileFeaturedCollections(workspaceId, await reconcileGalleryImages(workspaceId, home));
if (gallery) set["publicPage.data.gallery"] = await reconcileFeaturedCollections(workspaceId, await reconcileGalleryImages(workspaceId, gallery));
```

- [ ] **Step 6: typecheck + commit**

```bash
pnpm typecheck
git add lib/page-builder/reconcile.ts lib/page-builder/reconcile.test.ts "app/[locale]/(app)/portfolio/page.tsx" "app/[locale]/(app)/portfolio/_actions.ts"
git commit -m "feat(portfolio): reconcile Featured Work collections[] (editor-load + publish)"
```

---

## Task 7: `MediaPicker` `collections` mode

**Files:**
- Modify: `lib/page-builder/galleryPicker/MediaPicker.tsx`
- Test: `lib/page-builder/galleryPicker/MediaPicker.test.tsx` (extend existing or create)

- [ ] **Step 1: Failing test** — collections-mode behavior:

```typescript
// Render <MediaPicker mode="collections" open value={[]} onChange=... />
// Assert: collection tiles render with role="option"/aria-selected; clicking toggles
// selection (ordered, with an order badge); selecting two then re-clicking the first
// removes it and the second becomes order 1; value shape is { id, name, coverPublicId, itemCount }.
```

Mirror the existing MediaPicker test setup (mock `usePickerData` to return fixed collections, or mock the fetch). Assert `onChange` receives `Array<{ id; name; coverPublicId; itemCount }>` in selection order.

- [ ] **Step 2: Run — expect FAIL.** Run: `npx vitest run lib/page-builder/galleryPicker/MediaPicker.test.tsx`

- [ ] **Step 3:** Implement. Extend the `Props.mode` union to `"single" | "multi" | "collections"`. Add `MediaPickerCollectionSelection = { id: string; name: string; coverPublicId: string; itemCount: number }` and broaden `MediaPickerValue` accordingly (or add a discriminated handler). In `collections` mode:
- The Nav stays on the `collections` view (tiles do NOT drill into photos; clicking toggles selection).
- Reuse the collection tile grid; add order badge + `role="option"` + `aria-selected` + focus-visible ring; selection not by color alone (badge + ring + checkmark).
- Reuse the reorder strip (drag, visible grip) for the selected collections.
- No cap beyond `SAFETY_CAP`.
- Keep "create collection" + upload-into-collection; uploading a photo does NOT auto-select a collection.
- Derive `coverPublicId` + `itemCount` from `PickerCollection` (now carries both) at pick time.

- [ ] **Step 4: Run — expect PASS.** Run: `npx vitest run lib/page-builder/galleryPicker/MediaPicker.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/galleryPicker/MediaPicker.tsx lib/page-builder/galleryPicker/MediaPicker.test.tsx
git commit -m "feat(portfolio): MediaPicker collections mode (ordered multi-select)"
```

---

## Task 8: `collectionsField` adapter + `MultiCollectionControl`

**Files:**
- Modify: `lib/page-builder/editorConfig.tsx`
- Test: `lib/page-builder/editorConfig.test.tsx` (or a dedicated control test)

- [ ] **Step 1: Failing test** — render `MultiCollectionControl` (the component `collectionsField` wraps): clicking "Choose collections" opens the picker (`mode="collections"`); selecting round-trips `{ id, name, coverPublicId, itemCount }[]`; a "clear" affordance empties it; closing the modal works. Mirror the `MultiImageControl` test if one exists.

- [ ] **Step 2: Run — expect FAIL.** Run: `npx vitest run lib/page-builder/editorConfig.test.tsx -t collectionsField`

- [ ] **Step 3:** Add `MultiCollectionControl` (mirror `MultiImageControl`: holds `open` state, renders a cover strip + count + "Choose collections" button, mounts `<MediaPicker mode="collections" .../>`) and the factory:

```typescript
function collectionsField(label: string): Field<FeaturedCollectionRef[]> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) => (
      <MultiCollectionControl
        value={(value as FeaturedCollectionRef[]) ?? []}
        onChange={onChange as (v: FeaturedCollectionRef[]) => void}
      />
    ),
  } as unknown as Field<FeaturedCollectionRef[]>;
}
```

- [ ] **Step 4: Run — expect PASS.** Run: `npx vitest run lib/page-builder/editorConfig.test.tsx -t collectionsField`

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/editorConfig.tsx lib/page-builder/editorConfig.test.tsx
git commit -m "feat(portfolio): collectionsField adapter + MultiCollectionControl"
```

---

## Task 9: Rewrite `FeaturedWorkBlock` (isomorphic) + register real component

**Files:**
- Rewrite: `lib/page-builder/blocks/FeaturedWorkBlock.tsx`
- Modify: `lib/page-builder/config.ts` (still imports `featuredWorkBlockConfig` — unchanged import, new shape)
- Modify: `lib/page-builder/editorConfig.tsx` (`featuredWork`: real component, fields `_style` + `collectionsField` + `columns`)
- Test: `lib/page-builder/blocks/FeaturedWorkBlock.test.tsx` (replace)

- [ ] **Step 1: Failing test** — replace the file (mirror `GalleryGridBlock.test.tsx`):

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeaturedWorkBlock, featuredWorkDefaultProps, type FeaturedWorkProps, type FeaturedCollectionRef } from "./FeaturedWorkBlock";

const OLD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
beforeEach(() => { process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "test-cloud"; });
afterEach(() => { process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = OLD; });

function cols(n: number): FeaturedCollectionRef[] {
  return Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: `Coll ${i}`, coverPublicId: `pid${i}`, itemCount: i + 1 }));
}
const base: FeaturedWorkProps = { ...featuredWorkDefaultProps };

describe("FeaturedWorkBlock — isomorphic collections grid", () => {
  it("is synchronous (not a Promise)", () => {
    expect(FeaturedWorkBlock({ ...base, collections: cols(2) })).not.toBeInstanceOf(Promise);
  });
  it("renders one tile per collection with cover img, title, pluralized count", () => {
    render(FeaturedWorkBlock({ ...base, collections: cols(2) }));
    expect(screen.getByText("Coll 0")).toBeInTheDocument();
    expect(screen.getByText(/1 photo$/)).toBeInTheDocument();   // itemCount 1 → "1 photo"
    expect(screen.getByText(/2 photos$/)).toBeInTheDocument();  // itemCount 2 → "2 photos"
    expect(document.querySelectorAll("img").length).toBe(2);
  });
  it("renders empty state when collections is empty", () => {
    render(FeaturedWorkBlock({ ...base, collections: [] }));
    expect(document.querySelector("[data-block='featured-work'][data-empty='true']")).toBeInTheDocument();
  });
  it.each([2,3,4] as const)("columns=%i sets grid-template-columns", (c) => {
    const { container } = render(FeaturedWorkBlock({ ...base, collections: cols(2), columns: c }));
    const grid = container.querySelector("[data-block='featured-work'] .pf-featured-grid") as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe(`repeat(${c}, 1fr)`);
  });
  it("renders a neutral placeholder tile for an empty cover (coverPublicId '')", () => {
    render(FeaturedWorkBlock({ ...base, collections: [{ id: "c0", name: "Empty", coverPublicId: "", itemCount: 0 }] }));
    expect(screen.getByText("Empty")).toBeInTheDocument();
  });
  it("client-safe: produces cloudinary URLs without mocking server cloudinary", () => {
    const { container } = render(FeaturedWorkBlock({ ...base, collections: cols(1) }));
    expect(container.querySelector("img")?.getAttribute("src")).toContain("test-cloud");
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** Run: `npx vitest run lib/page-builder/blocks/FeaturedWorkBlock.test.tsx`

- [ ] **Step 3: Rewrite** `FeaturedWorkBlock.tsx` (isomorphic, no `"use client"`). Imports: `cloudinaryImageUrl` from `cloudinaryClient`, `resolveBlockStyle`/`resolveBlockAttrs`/`productionStyleField`/`BlockStyle` from `styleToolkit`, `getGalleryChromeLabelsFrom`/`BlockPuck` from `blockContext`, the `FeaturedCollectionsClient` island (Task 10). The block:
- Reads `puck.metadata.workspace`: `slug`, `editorPreview` (→ `mode = editorPreview ? "owner" : "public"`), `publicPage.collectionsPopup` (→ `popupConfig`), chrome `featuredEmpty`.
- Maps `collections[]` → tile data `{ id, name, count, coverUrl: cloudinaryImageUrl(coverPublicId, { width: 700, height: 900, crop: "fill" }) }` (empty `coverPublicId` → `coverUrl: ""` → placeholder).
- Renders the same `<section data-block="featured-work">` shell + mobile `<style>` collapse-to-1 rule as the legacy block, but the grid uses `columns`.
- Empty `collections` → `data-empty="true"` + `labels.featuredEmpty`.
- Otherwise renders `<FeaturedCollectionsClient tiles columns mode slug popupConfig />`.
- Photo-count helper: `count === 1 ? "1 photo" : count === 0 ? "No photos" : ${count} photos` (English chrome; no new locale strings).
- Export `featuredWorkBlockConfig` with `label: "Highlights"`, `defaultProps: featuredWorkDefaultProps`, `fields: { _style: productionStyleField, columns: <select 2/3/4>, collections: <hidden/managed by StyleToolkit> }`, `render: FeaturedWorkBlock` (sync). Remove `getItemsByIds`, `MAX_FEATURED`, `normalizeItemIds`, `FeaturedWorkItemId`, `layout`.

- [ ] **Step 4: Update `editorConfig.tsx` `featuredWork`** to render the REAL block (not `Preview`):

```typescript
const featuredWork: ComponentConfig<FeaturedWorkProps> = {
  label: "Highlights",
  defaultProps: featuredWorkDefaultProps,
  fields: {
    _style: styleField,
    collections: collectionsField("Collections"),
    columns: { type: "select", label: "Columns", options: [
      { label: "2 columns", value: 2 }, { label: "3 columns", value: 3 }, { label: "4 columns", value: 4 },
    ] } as Field<2|3|4>,
  },
  resolveFields: (_data, { fields }) => ({ _style: (fields as Record<string, unknown>)._style } as typeof fields),
  render: FeaturedWorkBlock,
};
```

Remove the `FeaturedItemsPicker` import + the local legacy `featuredWorkDefaultProps`/`FeaturedWorkProps` import for `itemIds`/`layout`; import the new `FeaturedWorkProps`/`featuredWorkDefaultProps`/`FeaturedWorkBlock` from the block.

- [ ] **Step 5: Run — expect PASS** + ensure `config.ts`/`editorConfig.ts` still compile. Run: `npx vitest run lib/page-builder/blocks/FeaturedWorkBlock.test.tsx` then `pnpm typecheck`.

- [ ] **Step 6: Commit**

```bash
git add lib/page-builder/blocks/FeaturedWorkBlock.tsx lib/page-builder/blocks/FeaturedWorkBlock.test.tsx lib/page-builder/config.ts lib/page-builder/editorConfig.tsx
git commit -m "feat(portfolio): isomorphic Featured Work collections tile grid"
```

---

## Task 10: `FeaturedCollectionsClient` island (tile grid + active state)

**Files:**
- Create: `lib/page-builder/blocks/FeaturedCollectionsClient.tsx`
- Test: `lib/page-builder/blocks/FeaturedCollectionsClient.test.tsx`

- [ ] **Step 1: Failing test** — given `tiles` + `columns`, renders N tile buttons (cover, title, count); clicking a tile sets it active and mounts `CollectionPopup` for that id; a placeholder tile (empty coverUrl) still renders + is clickable. Mock `CollectionPopup` (or assert it appears with the right `collectionId`).

- [ ] **Step 2: Run — expect FAIL.** Run: `npx vitest run lib/page-builder/blocks/FeaturedCollectionsClient.test.tsx`

- [ ] **Step 3:** Implement (`"use client"`):

```typescript
"use client";
import { useState } from "react";
import { CollectionPopup } from "./CollectionPopup";
import type { PortfolioCollectionsPopupConfig } from "@/lib/page-builder/types";

export type FeaturedTile = { id: string; name: string; count: number; coverUrl: string };
export type FeaturedCollectionsClientProps = {
  tiles: FeaturedTile[];
  columns: 2 | 3 | 4;
  mode: "owner" | "public";
  slug?: string;
  popupConfig: PortfolioCollectionsPopupConfig;
  countLabel: (n: number) => string;
};

export function FeaturedCollectionsClient({ tiles, columns, mode, slug, popupConfig, countLabel }: FeaturedCollectionsClientProps) {
  const [active, setActive] = useState<FeaturedTile | null>(null);
  return (
    <>
      <div className="pf-featured-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: "1.5rem" }}>
        {tiles.map((t) => (
          <button key={t.id} type="button" onClick={() => setActive(t)}
            style={{ /* sharp, flat, idle/hover/focus-visible states; cursor pointer; text-align left */ }}>
            {t.coverUrl
              ? /* eslint-disable-next-line @next/next/no-img-element */ (<img src={t.coverUrl} alt="" loading="lazy" style={{ width: "100%", aspectRatio: "7 / 9", objectFit: "cover", display: "block" }} />)
              : (<span aria-hidden style={{ /* neutral placeholder block */ }} />)}
            <span style={{ display: "block" }}>{t.name}</span>
            <span style={{ display: "block", opacity: 0.65 }}>{countLabel(t.count)}</span>
          </button>
        ))}
      </div>
      {active && (
        <CollectionPopup
          collectionId={active.id}
          collectionName={active.name}
          mode={mode}
          slug={slug}
          popupConfig={popupConfig}
          open
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}
```

Pass `countLabel` from the block so the chrome string stays in one place. Ensure tile buttons have visible idle/hover/focus-visible/active states (no hover-only), are keyboard-activatable.

- [ ] **Step 4: Run — expect PASS.** Run: `npx vitest run lib/page-builder/blocks/FeaturedCollectionsClient.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/blocks/FeaturedCollectionsClient.tsx lib/page-builder/blocks/FeaturedCollectionsClient.test.tsx
git commit -m "feat(portfolio): Featured Work tile-grid client island"
```

---

## Task 11: `CollectionPopup` island (modal + pagination + nested lightbox)

**Files:**
- Create: `lib/page-builder/blocks/CollectionPopup.tsx`
- Test: `lib/page-builder/blocks/CollectionPopup.test.tsx`

- [ ] **Step 1: Failing test** — mock `fetch` to return two pages then `nextCursor: null`. Assert:
- Modal renders with sticky title header (collection name) and a floating close button (`aria-label="Close"`).
- Loading → populated; "Load more" appends page 2; disappears when `nextCursor === null`; error state shows Retry; empty collection shows empty state.
- Body is a `flex flex-wrap`; image items present.
- Clicking an image opens a nested lightbox (second dialog) showing the full-size image; Escape/close returns to the popup (popup still mounted).
- Builds the correct URL per `mode` (`/api/portfolio/gallery/collections/<id>` for owner, `/api/public/w/<slug>/collections/<id>` for public) and normalizes items to `{ id, publicId, alt }` (owner: `alt = caption`).
- Applies `popupConfig` (background/border/radius) to the shell.

```typescript
// sketch
vi.stubGlobal("fetch", vi.fn(async (url: string) => {
  if (String(url).includes("cursor=")) return jsonResp({ items: [{ id: "b", publicId: "pb" }], nextCursor: null });
  return jsonResp({ items: [{ id: "a", publicId: "pa", alt: "A" }], nextCursor: "C1" });
}));
process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "test-cloud";
render(<CollectionPopup collectionId="col1" collectionName="Weddings" mode="public" slug="studio" popupConfig={{}} open onClose={() => {}} />);
expect(await screen.findByText("Weddings")).toBeInTheDocument();
// wait for first page, click load more, assert second image, assert load-more gone, etc.
```

- [ ] **Step 2: Run — expect FAIL.** Run: `npx vitest run lib/page-builder/blocks/CollectionPopup.test.tsx`

- [ ] **Step 3:** Implement (`"use client"`), built on `components/ui/dialog.tsx` (`Dialog`, `DialogPortal`, `DialogOverlay`, `DialogContent` with className overrides, or compose `DialogPrimitive` via the exported `Dialog` root). Contract:

```typescript
"use client";
export type CollectionPopupProps = {
  collectionId: string;
  collectionName: string;
  mode: "owner" | "public";
  slug?: string;
  popupConfig: PortfolioCollectionsPopupConfig;
  open: boolean;
  onClose: () => void;
};
type PopupImage = { id: string; publicId: string; alt: string };
```

Behavior:
- **Shell:** centered; `style={{ maxHeight: "90vh", minWidth: "90vw", maxWidth: 900 }}`; background/border/radius from `popupConfig` (resolve token-or-hex like the panels; radius via the shared radius→px scale `sharp:0 / subtle:.. / rounded:..` used elsewhere — reuse the existing resolver if one exists, else map `BRAND_KIT_RADII`).
- **Sticky header:** `position: sticky; top: 0`; collection title; sits above the scroll area.
- **Floating close:** absolute top-right, `aria-label="Close"`, visible idle/hover/focus-visible; calls `onClose`.
- **Scroll body:** `overflow-y: auto`; `display:flex; flex-wrap:wrap`; each item `flex: 0 0 calc(100%/6 - gap)` (6 per row; reflows to ~2–3 at 375px via a min-width floor / media tweak).
- **Fetch/pagination:** `buildUrl(cursor)` → owner: `/api/portfolio/gallery/collections/${collectionId}?limit=24${cursor?`&cursor=${cursor}`:""}`; public: `/api/public/w/${slug}/collections/${collectionId}?...`. Normalize each item: `{ id, publicId, alt: it.alt ?? it.caption ?? "" }`. Track `items`, `cursor`, `status: idle|loading|error|done`, `loadingMore`. "Load more" button until `nextCursor === null`. States: loading / error+Retry / empty / populated.
- **Thumbnails** via `cloudinaryImageUrl(publicId, { width: 400, height: 400, crop: "fill" })`; lightbox full-size via `cloudinaryImageUrl(publicId, { width: 2000 })` (or fit), `object-fit: contain`, capped to viewport.
- **Nested lightbox:** clicking an image opens a SECOND `<Dialog>` (own open state) stacked above; its own close + Escape; on close, focus returns to the popup (the popup stays mounted). Use `dialog.tsx` focus-trap + portal for both.
- Decorative covers use real `alt`; lightbox image carries the same alt.

- [ ] **Step 4: Run — expect PASS.** Run: `npx vitest run lib/page-builder/blocks/CollectionPopup.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/blocks/CollectionPopup.tsx lib/page-builder/blocks/CollectionPopup.test.tsx
git commit -m "feat(portfolio): CollectionPopup island (paginated, sticky header, nested lightbox)"
```

---

## Task 12: `updateCollectionsPopupConfigAction`

**Files:**
- Modify: `app/[locale]/(app)/portfolio/_actions.ts`
- Test: `app/[locale]/(app)/portfolio/_actions.test.ts`

- [ ] **Step 1: Failing test** (mirror `updateContactConfigAction` tests):

```typescript
import { updateCollectionsPopupConfigAction } from "./_actions";

describe("updateCollectionsPopupConfigAction", () => {
  it("owner-only (403 for staff)", async () => {
    mockCtx.role = "staff";
    expect(await updateCollectionsPopupConfigAction({})).toEqual({ error: "owner_only" });
  });
  it("persists to publicPage.collectionsPopup + revalidates", async () => {
    const res = await updateCollectionsPopupConfigAction({ borderWidth: 2, radius: "subtle" });
    expect(res).toMatchObject({ ok: true });
    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws!.publicPage!.collectionsPopup).toMatchObject({ borderWidth: 2, radius: "subtle" });
    expect(revalidatePath).toHaveBeenCalledWith("/w/studio-aurora");
  });
  it("rejects invalid input", async () => {
    expect(await updateCollectionsPopupConfigAction({ borderWidth: 999 })).toHaveProperty("error");
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** Run: `npx vitest run "app/[locale]/(app)/portfolio/_actions.test.ts" -t updateCollectionsPopupConfigAction`

- [ ] **Step 3:** Implement (mirror `updateContactConfigAction`):

```typescript
export async function updateCollectionsPopupConfigAction(input: unknown): Promise<EditorActionResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };
  const parsed = portfolioCollectionsPopupConfigSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "invalid_collections_popup" };
  await connectDB();
  await Workspace.updateOne({ _id: ctx.workspace._id }, { $set: { "publicPage.collectionsPopup": parsed.data } });
  revalidatePath(`/w/${ctx.workspace.slug}`);
  return { ok: true };
}
```

- [ ] **Step 4: Run — expect PASS.** Run: `npx vitest run "app/[locale]/(app)/portfolio/_actions.test.ts" -t updateCollectionsPopupConfigAction`

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(app)/portfolio/_actions.ts" "app/[locale]/(app)/portfolio/_actions.test.ts"
git commit -m "feat(portfolio): updateCollectionsPopupConfigAction (owner-only)"
```

---

## Task 13: `CollectionsPopupPanelDialog`

**Files:**
- Create: `app/[locale]/(app)/portfolio/_components/CollectionsPopupPanelDialog.tsx`
- Test: `app/[locale]/(app)/portfolio/_components/CollectionsPopupPanelDialog.test.tsx`

- [ ] **Step 1: Failing test** — renders border color/width, background color, radius controls; editing calls `onChange` with updated config (live preview); a small popup-chrome preview reflects values. Mirror the Contact/Header panel test if present; otherwise assert the controls render and `onChange` fires.

- [ ] **Step 2: Run — expect FAIL.** Run: `npx vitest run "app/[locale]/(app)/portfolio/_components/CollectionsPopupPanelDialog.test.tsx"`

- [ ] **Step 3:** Implement, mirroring `ContactPanelDialog`'s scaffolding and reusing its extracted primitives (`ColorSwatchRow`, `BorderRow`, `RadiusRow`, `NumberInputRow` from `toolbarPrimitives`). Props: `{ config: PortfolioCollectionsPopupConfig; onChange; brandKit; onSaved; onCancel }`. Layout: left = a live popup-chrome preview (a div styled by `config`), right = the controls. English-only labels (no `useTranslations` needed for the field copy; match how the panels handle non-IntlProvider chrome — Contact/Header panels DO use translations, but the spec says editor chrome is English-only and no new public locale strings — use literal English strings here). Wire a Save button that calls `updateCollectionsPopupConfigAction(config)` then `onSaved()` (or let `EditorShell` own the save like it does for header/contact — match whichever pattern the existing panels use; Header/Contact panels call back via `onSaved` and the shell saves on publish).

- [ ] **Step 4: Run — expect PASS.** Run: `npx vitest run "app/[locale]/(app)/portfolio/_components/CollectionsPopupPanelDialog.test.tsx"`

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(app)/portfolio/_components/CollectionsPopupPanelDialog.tsx" "app/[locale]/(app)/portfolio/_components/CollectionsPopupPanelDialog.test.tsx"
git commit -m "feat(portfolio): CollectionsPopupPanelDialog config panel"
```

---

## Task 14: Thread the "Collections Popup" tab + editor `<Puck>` metadata through `EditorShell`

**Files:**
- Modify: `app/[locale]/(app)/portfolio/_components/EditorShell.tsx`
- Modify: `app/[locale]/(app)/portfolio/page.tsx` (pass `initialCollectionsPopup`)
- Test: extend an EditorShell test if one exists; otherwise rely on typecheck + manual 375px check (note in Task 17).

- [ ] **Step 1:** In `EditorShell.tsx`:
- Extend `EditorSection` to include `"collectionsPopup"` and `EDITOR_SECTIONS` to `["home","gallery","collectionsPopup","header","contact"]` (right of `gallery`).
- Add `Props.initialCollectionsPopup: PortfolioCollectionsPopupConfig`; state `const [collectionsPopup, setCollectionsPopup] = useState(initialCollectionsPopup ?? {})`; `const [collectionsPopupOpen, setCollectionsPopupOpen] = useState(false)`; snapshot refs mirroring header.
- `openCollectionsPopup()` / `closeCollectionsPopup(saved)` / `saveCollectionsPopupSnapshot()` mirroring `openHeader`/`closeHeader`/`saveHeaderSnapshot`. Update `sidePanelOpen` and `activeSection` to include the new panel.
- In `navCluster()`, add the label for `collectionsPopup` ("Collections Popup") and `onClick` → `openCollectionsPopup()`. Decide preview-mode visibility (hide in preview like header/contact).
- Mount `<CollectionsPopupPanelDialog>` in the same conditional block as Header/Contact, with a left-side preview.
- Add `collectionsPopup` to `PortfolioBrowserDraft` + the localStorage draft read/write.
- In `handlePublish()`, add `updateCollectionsPopupConfigAction(collectionsPopup)` to the `Promise.all([...])`.

- [ ] **Step 2:** Add `metadata` to the editor `<Puck>` so the in-canvas FeaturedWork block renders the real popup (owner mode). Find the `<Puck ...>` JSX in `EditorShell.tsx` and add:

```tsx
metadata={{ workspace: { _id: "", name: workspaceName, slug, editorPreview: true, publicPage: { collectionsPopup } } }}
```

(Include whatever `metadata` already exists; merge. `slug` is a Prop. This gives the block `mode: "owner"` + the live `collectionsPopup` so the canvas preview matches.) Do the same for the chrome-less preview route if it renders `<Render>`/`<Puck>` with metadata — set `editorPreview: true` there too (owner viewing a draft).

- [ ] **Step 3:** In `page.tsx`, read + pass:

```typescript
const initialCollectionsPopup = toPlain<PortfolioCollectionsPopupConfig>(pp?.collectionsPopup ?? null, {});
// ...pass initialCollectionsPopup to <EditorShell .../>
```

- [ ] **Step 4: Public render metadata.** In `app/(public)/w/[orgSlug]/page.tsx`, `buildRenderWorkspace` now copies `collectionsPopup` (Task 1); explicitly set `editorPreview: false` on `renderWorkspace` (or leave undefined — block treats falsy as public). Confirm `<Render metadata={{ workspace: renderWorkspace }}>` carries `publicPage.collectionsPopup` + `slug`.

- [ ] **Step 5: typecheck.** Run: `pnpm typecheck` — Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(app)/portfolio/_components/EditorShell.tsx" "app/[locale]/(app)/portfolio/page.tsx" "app/(public)/w/[orgSlug]/page.tsx"
git commit -m "feat(portfolio): Collections Popup editor tab + editor/public render metadata"
```

---

## Task 15: Update `FeaturedWorkPreset` seed shape + `seedPortfolio`

**Files:**
- Modify: `lib/page-builder/blocks/sectionPresets.ts`
- Modify: `lib/page-builder/seedPortfolio.ts`
- Test: `lib/page-builder/seedPortfolio.test.ts` (if present) / `sectionPresets` test

- [ ] **Step 1: Failing test** — assert `FEATURED_WORK_PRESET.content` embeds a `FeaturedWork` child with `{ collections: [], columns: 3 }` (no `itemIds`/`layout`); and that `injectGalleryRefs` no longer writes `itemIds` (either it's removed or it's a no-op for the new shape).

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3:** In `sectionPresets.ts`, change the embedded child:

```typescript
child("FeaturedWork", { collections: [], columns: 3 }),
```

In `seedPortfolio.ts`, remove the `injectGalleryRefs` `itemIds` injection (FeaturedWork no longer holds itemIds). If a default "featured-work collection" auto-pick is still desired, leave it out for MVP (owner picks collections via the editor) — delete `injectGalleryRefs` and its call in `buildSeed`, plus any now-unused `FEATURED_COLLECTION_SLUG` import if it's unused elsewhere. Verify nothing else imports `injectGalleryRefs`.

- [ ] **Step 4: Run — expect PASS.** Run the seed/preset tests.

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/blocks/sectionPresets.ts lib/page-builder/seedPortfolio.ts lib/page-builder/seedPortfolio.test.ts
git commit -m "feat(portfolio): seed FeaturedWorkPreset with collections shape"
```

---

## Task 16: Retire `FeaturedItemsPicker` + cleanup

**Files:**
- Delete: `lib/page-builder/galleryPicker/FeaturedItemsPicker.tsx`, `FeaturedItemsPicker.test.tsx`
- Modify: `lib/page-builder/StyleToolkitField.tsx` (FeaturedWork Content/Layout tabs)
- Modify: `lib/page-builder/editorConfig.tsx` (remove import if still present)

- [ ] **Step 1:** In `StyleToolkitField.tsx`, replace the FeaturedWork **Content** tab block (currently renders `FeaturedItemsPicker` for `itemIds`) with the `MultiCollectionControl`/`collectionsField`-driven collections picker bound to `props.collections` (`setProp("collections", v)`), labelled "Collections". Replace the FeaturedWork **Layout** tab block (currently row/stagger `FEATURED_LAYOUT_OPTIONS`) with a **Columns** control (2/3/4) bound to `props.columns` (`setProp("columns", v)`). Remove `FEATURED_LAYOUT_OPTIONS` if now unused.

- [ ] **Step 2:** Delete `FeaturedItemsPicker.tsx` + `FeaturedItemsPicker.test.tsx`. Remove its import from `editorConfig.tsx` (should already be gone after Task 9) and `StyleToolkitField.tsx`.

- [ ] **Step 3:** Grep the worktree for `FeaturedItemsPicker`, `itemIds` (in FeaturedWork context), `MAX_FEATURED`, `FEATURED_LAYOUT_OPTIONS`, `injectGalleryRefs` — confirm zero dangling references. Confirm `getItemsByIds` still has other consumers (it does — keep it) and that FeaturedWork no longer imports it.

Run: `git grep -n "FeaturedItemsPicker"` (Expected: no matches) and `git grep -n "MAX_FEATURED"` (Expected: none).

- [ ] **Step 4: typecheck + lint.** Run: `pnpm typecheck` then `pnpm lint` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(portfolio): retire FeaturedItemsPicker; FeaturedWork uses collections picker"
```

---

## Task 17: Full verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Run all affected tests.**

Run:
```
npx vitest run lib/db/queries/gallery.test.ts lib/page-builder/reconcile.test.ts lib/validators/publicPage.test.ts lib/page-builder/blocks/FeaturedWorkBlock.test.tsx lib/page-builder/blocks/FeaturedCollectionsClient.test.tsx lib/page-builder/blocks/CollectionPopup.test.tsx lib/page-builder/galleryPicker/MediaPicker.test.tsx "app/api/public/w/[orgSlug]/collections/[id]/route.test.ts" "app/[locale]/(app)/portfolio/_actions.test.ts" "app/[locale]/(app)/portfolio/_components/CollectionsPopupPanelDialog.test.tsx"
```
Expected: all pass.

- [ ] **Step 2: Full suite** (pre-merge): `pnpm test` — Expected: green (existing FeaturedWork/itemIds tests removed; no orphans).

- [ ] **Step 3: typecheck + lint + build.**

Run: `pnpm typecheck` → clean. `pnpm lint` → clean. `pnpm next build` → success (verify the now-client-safe block + islands don't transitively import Mongo / `node:async_hooks`; the build fails loudly if a `"use client"` island pulls a server-only module).

- [ ] **Step 4: Manual 375px check** (note for the human): block tiles collapse to 1 column < 640px; popup reflows to ~2–3 per row at 375px; sticky header + floating close reachable while scrolling; nested lightbox opens, Escape returns focus to the popup, popup-close returns focus to the trigger tile. Editor: the "Collections Popup" tab opens the panel; the live preview reflects config; clicking a canvas tile opens the real popup (owner mode).

- [ ] **Step 5: Final commit (if any lint/format fixups).**

```bash
git add -A
git commit -m "chore(portfolio): featured-work collections redesign verification fixups"
```

---

## Self-review notes (spec coverage)

- Block holds any number of collections (no cap), cover+title+count tiles, `columns` grid, <640px → 1 col → Tasks 2, 9, 10.
- Click → popup (90vh/90vw/900px, sticky header, floating close, scroll) → Task 11.
- 6-per-row `flex-wrap`, paginated load-more until `nextCursor===null`, all async states → Task 11.
- Nested full-size lightbox with focus restoration → Task 11.
- Baked `collections[]` (id/name/coverPublicId/itemCount), WYSIWYG client-side, no server fetch → Tasks 2, 9.
- `MediaPicker` `collections` mode + `collectionsField`; `FeaturedItemsPicker` retired → Tasks 7, 8, 16.
- Popup images fetched lazily/paginated, never baked; public slug-scoped endpoint (publish-gated, tenant-isolated, collection-`isPublic`-gated) + shared query helper → Tasks 4, 5.
- `publicPage.collectionsPopup` config + Zod + action + panel + editor tab, threaded through EditorShell/draft/publish → Tasks 1, 12, 13, 14.
- Reconcile refresh/prune `collections[]` (editor-load in-memory, publish persisted), batched, tenant-safe → Task 6.
- No migration; default seed reshaped → Task 15. Editor chrome English-only; no new public locale strings → Tasks 9, 13.
- Public read surface audited for tenant isolation + publish-gating → Tasks 4, 5 tests. Stacked-dialog focus/z-index → Task 11. Editor vs public fetch divergence isolated to `mode` + covered both → Tasks 11, 14.

**Deviations from spec (intentional, due to schema reality):**
1. `itemCount` and the public endpoint gate on the **collection's** `isPublic` (items have none); `itemCount = isPublic ? total : 0`.
2. The popup island receives serializable `mode`/`slug`/`popupConfig` props (not a `fetchPage` closure) because the block renders server→client.
3. Cover field is `coverItemId`; `coverPublicId` is newly surfaced on `PickerCollection`.
