import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryItem } from "@/lib/db/models/GalleryItem";
import { GalleryCollection } from "@/lib/db/models/GalleryCollection";
import { getItemsByIds, listCollectionsForPicker, listCollectionItemsPage, listAllItemsPage, listCollectionNewest, listPublicCollectionItemsPage } from "./gallery";

beforeAll(async () => {
  await startInMemoryMongo();
});

afterAll(async () => {
  await stopInMemoryMongo();
});

afterEach(async () => {
  await clearCollections();
});

async function makeCollection(
  workspaceId: Types.ObjectId,
  opts: { isPublic?: boolean; slug?: string } = {}
) {
  return GalleryCollection.create({
    workspaceId,
    name: "Collection",
    slug: opts.slug ?? `c-${new Types.ObjectId().toString()}`,
    isPublic: opts.isPublic ?? true,
  });
}

async function seedItems(
  workspaceId: Types.ObjectId,
  collectionId: Types.ObjectId,
  count: number,
  startOrder = 0
) {
  const docs = Array.from({ length: count }, (_, i) => ({
    workspaceId,
    collectionId,
    cloudinaryPublicId: `ws/${workspaceId}/item${startOrder + i}`,
    url: `https://res.cloudinary.com/test/${workspaceId}/item${startOrder + i}`,
    caption: `Photo ${startOrder + i + 1}`,
    altText: `Alt ${startOrder + i + 1}`,
    order: startOrder + i,
  }));
  return GalleryItem.insertMany(docs);
}

describe("getItemsByIds", () => {
  it("returns [] for empty/invalid id lists", async () => {
    const ws = new Types.ObjectId().toString();
    expect(await getItemsByIds({ workspaceId: ws, itemIds: [] })).toEqual([]);
    expect(await getItemsByIds({ workspaceId: ws, itemIds: ["bad", "ids"] })).toEqual([]);
  });

  it("returns items in the requested order", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    const created = await seedItems(ws, col._id, 3);
    const ids = created.map((d) => d._id.toString());
    const reordered = [ids[2], ids[0], ids[1]];

    const items = await getItemsByIds({ workspaceId: ws.toString(), itemIds: reordered });
    expect(items.map((i) => i._id.toString())).toEqual(reordered);
  });

  it("drops ids that belong to another workspace", async () => {
    const wsA = new Types.ObjectId();
    const wsB = new Types.ObjectId();
    const colA = await makeCollection(wsA);
    const colB = await makeCollection(wsB);
    const aItems = await seedItems(wsA, colA._id, 2);
    const bItems = await seedItems(wsB, colB._id, 2);

    const mixed = [aItems[0]._id.toString(), bItems[0]._id.toString(), aItems[1]._id.toString()];
    const items = await getItemsByIds({ workspaceId: wsA.toString(), itemIds: mixed });
    expect(items.map((i) => i._id.toString())).toEqual([
      aItems[0]._id.toString(),
      aItems[1]._id.toString(),
    ]);
  });

  it("drops missing ids without crashing", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    const created = await seedItems(ws, col._id, 1);
    const missing = new Types.ObjectId().toString();

    const items = await getItemsByIds({
      workspaceId: ws.toString(),
      itemIds: [created[0]._id.toString(), missing],
    });
    expect(items.map((i) => i._id.toString())).toEqual([created[0]._id.toString()]);
  });
});

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
  it("invalid collectionId yields empty (no throw)", async () => {
    const page = await listPublicCollectionItemsPage({ workspaceId: new Types.ObjectId().toString(), collectionId: "not-an-id" });
    expect(page).toEqual({ items: [], nextCursor: null });
  });
});

describe("listCollectionsForPicker — coverPublicId", () => {
  it("resolves coverPublicId from coverItemId, else newest item, else ''", async () => {
    const ws = new Types.ObjectId();
    const col = await GalleryCollection.create({ workspaceId: ws, name: "Weddings", slug: "weddings", isPublic: true });
    const a = await GalleryItem.create({ workspaceId: ws, collectionId: col._id, cloudinaryPublicId: "pid-a", url: "u", order: 0 });
    await GalleryItem.create({ workspaceId: ws, collectionId: col._id, cloudinaryPublicId: "pid-b", url: "u", order: 1 });
    // no explicit cover → falls back to the newest item's publicId (pid-b created last)
    let cols = await listCollectionsForPicker(ws.toString());
    expect(cols.find((c) => c.id === String(col._id))!.coverPublicId).toBe("pid-b");
    // explicit cover → that item's publicId
    await GalleryCollection.updateOne({ _id: col._id }, { $set: { coverItemId: a._id } });
    cols = await listCollectionsForPicker(ws.toString());
    expect(cols.find((c) => c.id === String(col._id))!.coverPublicId).toBe("pid-a");
  });
  it("coverPublicId is '' for an empty collection", async () => {
    const ws = new Types.ObjectId();
    const col = await GalleryCollection.create({ workspaceId: ws, name: "Empty", slug: "empty", isPublic: true });
    const cols = await listCollectionsForPicker(ws.toString());
    expect(cols.find((c) => c.id === String(col._id))!.coverPublicId).toBe("");
  });
});
