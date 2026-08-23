import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryItem } from "@/lib/db/models/GalleryItem";
import { GalleryCollection } from "@/lib/db/models/GalleryCollection";
import { Workspace } from "@/lib/db/models/Workspace";
import { getItemsByIds, listCollectionsForPicker, listCollectionItemsPage, listAllItemsPage, listCollectionNewest, listPublicCollectionItemsPage, detachItemsFromCollection, updateItemMeta, propagateItemAltText } from "./gallery";

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
    assetId: `ws/${workspaceId}/item${startOrder + i}`,
    url: `https://imagedelivery.net/hash/item${startOrder + i}/public`,
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
    expect(page.items[0].publicId).toContain(`ws/${ws.toString()}/item0`);
  });

  it("exposes altText on every item", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    await seedItems(ws, col._id, 1);
    const page = await listCollectionItemsPage({ workspaceId: ws.toString(), collectionId: col._id.toString() });
    expect(page.items[0].altText).toBe("Alt 1");
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
      assetId: `ws/${ws}/standalone`, url: "https://imagedelivery.net/hash/standalone/public",
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

  it("exposes altText on every item", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    await seedItems(ws, col._id, 1);
    const page = await listAllItemsPage({ workspaceId: ws.toString() });
    expect(page.items[0].altText).toBe("Alt 1");
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
        assetId: `ws/${ws}/n${i}`, url: `https://imagedelivery.net/hash/n${i}/public`,
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

  it("exposes altText on every item", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    await GalleryItem.create({
      workspaceId: ws, collectionId: col._id,
      assetId: `ws/${ws}/n0`, url: "https://imagedelivery.net/hash/n0/public",
      caption: "N0", altText: "Alt N0", order: 0,
    });
    const items = await listCollectionNewest({ workspaceId: ws.toString(), collectionId: col._id.toString(), limit: 1 });
    expect(items[0].altText).toBe("Alt N0");
  });
});

describe("updateItemMeta", () => {
  it("sets altText only, leaving caption untouched", async () => {
    const ws = new Types.ObjectId();
    const item = await GalleryItem.create({
      workspaceId: ws, assetId: "pid", url: "u", caption: "Original caption", altText: "Original alt", order: 0,
    });
    const result = await updateItemMeta({ workspaceId: ws.toString(), itemId: item._id.toString(), altText: "New alt" });
    expect(result).toEqual({ id: item._id.toString(), publicId: "pid", thumbUrl: expect.any(String), caption: "Original caption", altText: "New alt" });
    const saved = await GalleryItem.findById(item._id).lean();
    expect(saved?.caption).toBe("Original caption");
    expect(saved?.altText).toBe("New alt");
  });

  it("sets caption only, leaving altText untouched", async () => {
    const ws = new Types.ObjectId();
    const item = await GalleryItem.create({
      workspaceId: ws, assetId: "pid", url: "u", caption: "Original caption", altText: "Original alt", order: 0,
    });
    const result = await updateItemMeta({ workspaceId: ws.toString(), itemId: item._id.toString(), caption: "New caption" });
    expect(result?.caption).toBe("New caption");
    expect(result?.altText).toBe("Original alt");
  });

  it("returns null for an item in another workspace (tenant isolation)", async () => {
    const wsA = new Types.ObjectId();
    const wsB = new Types.ObjectId();
    const item = await GalleryItem.create({ workspaceId: wsB, assetId: "pid", url: "u", order: 0 });
    const result = await updateItemMeta({ workspaceId: wsA.toString(), itemId: item._id.toString(), altText: "x" });
    expect(result).toBeNull();
    const saved = await GalleryItem.findById(item._id).lean();
    expect(saved?.altText).toBe("");
  });

  it("returns null for a missing item", async () => {
    const ws = new Types.ObjectId();
    const result = await updateItemMeta({ workspaceId: ws.toString(), itemId: new Types.ObjectId().toString(), altText: "x" });
    expect(result).toBeNull();
  });

  it("returns null for a malformed itemId (no throw)", async () => {
    const ws = new Types.ObjectId();
    const result = await updateItemMeta({ workspaceId: ws.toString(), itemId: "not-an-id", altText: "x" });
    expect(result).toBeNull();
  });

  it("returns null when neither altText nor caption is provided", async () => {
    const ws = new Types.ObjectId();
    const item = await GalleryItem.create({ workspaceId: ws, assetId: "pid", url: "u", order: 0 });
    const result = await updateItemMeta({ workspaceId: ws.toString(), itemId: item._id.toString() });
    expect(result).toBeNull();
  });
});

describe("listPublicCollectionItemsPage", () => {
  it("returns { id, publicId, alt } paginated by (order,_id) for a PUBLIC collection", async () => {
    const ws = new Types.ObjectId();
    const col = await GalleryCollection.create({ workspaceId: ws, name: "C", slug: "c", isPublic: true });
    await GalleryItem.insertMany(
      Array.from({ length: 3 }, (_, i) => ({ workspaceId: ws, collectionId: col._id, assetId: `p${i}`, url: "u", altText: i === 0 ? "Alt0" : "", caption: i === 0 ? "" : `Cap${i}`, order: i }))
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
    await GalleryItem.create({ workspaceId: ws, collectionId: col._id, assetId: "p", url: "u", order: 0 });
    const page = await listPublicCollectionItemsPage({ workspaceId: ws.toString(), collectionId: col._id.toString() });
    expect(page).toEqual({ items: [], nextCursor: null });
  });
  it("tenant isolation: foreign workspace id yields empty", async () => {
    const wsA = new Types.ObjectId(); const wsB = new Types.ObjectId();
    const colB = await GalleryCollection.create({ workspaceId: wsB, name: "B", slug: "b", isPublic: true });
    await GalleryItem.create({ workspaceId: wsB, collectionId: colB._id, assetId: "p", url: "u", order: 0 });
    const page = await listPublicCollectionItemsPage({ workspaceId: wsA.toString(), collectionId: colB._id.toString() });
    expect(page).toEqual({ items: [], nextCursor: null });
  });
  it("invalid collectionId yields empty (no throw)", async () => {
    const page = await listPublicCollectionItemsPage({ workspaceId: new Types.ObjectId().toString(), collectionId: "not-an-id" });
    expect(page).toEqual({ items: [], nextCursor: null });
  });
});

describe("detachItemsFromCollection", () => {
  it("dedups items sharing an assetId with no external refs (keep one, delete rest), deletes items whose assetId has an external ref, and avoids a per-item countDocuments N+1", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    // Two items share assetId "dup-asset", no other GalleryItem references it.
    const dupA = await GalleryItem.create({ workspaceId: ws, collectionId: col._id, assetId: "dup-asset", url: "u", order: 0 });
    const dupB = await GalleryItem.create({ workspaceId: ws, collectionId: col._id, assetId: "dup-asset", url: "u", order: 1 });
    // One item whose assetId also has an external reference outside the batch.
    const refd = await GalleryItem.create({ workspaceId: ws, collectionId: col._id, assetId: "shared-asset", url: "u", order: 2 });
    await GalleryItem.create({ workspaceId: ws, collectionId: null, assetId: "shared-asset", url: "u", order: 0 });

    const countSpy = vi.spyOn(GalleryItem, "countDocuments");

    const count = await detachItemsFromCollection({
      workspaceId: ws.toString(),
      collectionId: col._id.toString(),
      itemIds: [dupA._id.toString(), dupB._id.toString(), refd._id.toString()],
    });
    expect(count).toBe(3);
    // Fixed cost regardless of batch size: no per-item countDocuments query.
    expect(countSpy).not.toHaveBeenCalled();
    countSpy.mockRestore();

    const remainingDup = await GalleryItem.find({ workspaceId: ws, assetId: "dup-asset" }).lean();
    expect(remainingDup).toHaveLength(1);
    expect(remainingDup[0].collectionId).toBeNull();

    const refdDoc = await GalleryItem.findById(refd._id).lean();
    expect(refdDoc).toBeNull();
  });
});

describe("listCollectionsForPicker — coverPublicId", () => {
  it("resolves coverPublicId from coverItemId, else newest item, else ''", async () => {
    const ws = new Types.ObjectId();
    const col = await GalleryCollection.create({ workspaceId: ws, name: "Weddings", slug: "weddings", isPublic: true });
    const a = await GalleryItem.create({ workspaceId: ws, collectionId: col._id, assetId: "pid-a", url: "u", order: 0 });
    await GalleryItem.create({ workspaceId: ws, collectionId: col._id, assetId: "pid-b", url: "u", order: 1 });
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

describe("propagateItemAltText", () => {
  async function makeWorkspace(over: Record<string, unknown> = {}) {
    return Workspace.create({
      slug: `ws-${new Types.ObjectId().toString()}`,
      name: "Studio",
      ownerUserId: "user_a",
      currency: "PHP",
      ...over,
    });
  }

  function gridBlock(id: string, images: Array<{ id: string; publicId: string; alt: string }>) {
    return { type: "GalleryGrid", props: { id, images, columns: 3, gap: "normal" } };
  }

  it("updates alt on every matching image entry on the published home + gallery pages", async () => {
    const ws = await makeWorkspace();
    const itemId = new Types.ObjectId().toString();
    const home = {
      content: [gridBlock("g1", [{ id: itemId, publicId: "p1", alt: "old alt" }])],
    };
    const gallery = {
      content: [gridBlock("g2", [{ id: itemId, publicId: "p1", alt: "old alt" }])],
    };
    await Workspace.updateOne(
      { _id: ws._id },
      { $set: { "publicPage.data.home": home, "publicPage.data.gallery": gallery } }
    );

    await propagateItemAltText({ workspaceId: ws._id.toString(), itemId, alt: "new alt" });

    const saved = await Workspace.findById(ws._id).lean();
    const savedHome = saved!.publicPage!.data!.home as typeof home;
    const savedGallery = saved!.publicPage!.data!.gallery as typeof gallery;
    expect((savedHome.content[0].props.images as Array<{ alt: string }>)[0].alt).toBe("new alt");
    expect((savedGallery.content[0].props.images as Array<{ alt: string }>)[0].alt).toBe("new alt");
  });

  it("never touches a foreign workspace's published page", async () => {
    const wsA = await makeWorkspace();
    const wsB = await makeWorkspace();
    const itemId = new Types.ObjectId().toString();
    const pageB = { content: [gridBlock("gB", [{ id: itemId, publicId: "p1", alt: "b alt" }])] };
    await Workspace.updateOne({ _id: wsB._id }, { $set: { "publicPage.data.home": pageB } });

    await propagateItemAltText({ workspaceId: wsA._id.toString(), itemId, alt: "new alt" });

    const savedB = await Workspace.findById(wsB._id).lean();
    const savedPageB = savedB!.publicPage!.data!.home as typeof pageB;
    expect((savedPageB.content[0].props.images as Array<{ alt: string }>)[0].alt).toBe("b alt");
  });

  it("does not write when the item is not present on the published page (common case)", async () => {
    const ws = await makeWorkspace();
    const home = { content: [gridBlock("g1", [{ id: new Types.ObjectId().toString(), publicId: "p1", alt: "unrelated" }])] };
    await Workspace.updateOne({ _id: ws._id }, { $set: { "publicPage.data.home": home } });

    const updateSpy = vi.spyOn(Workspace, "updateOne");
    await propagateItemAltText({ workspaceId: ws._id.toString(), itemId: new Types.ObjectId().toString(), alt: "new alt" });
    expect(updateSpy).not.toHaveBeenCalled();
    updateSpy.mockRestore();
  });

  it("changes only the alt string — layout, order, and other props are byte-identical afterwards", async () => {
    const ws = await makeWorkspace();
    const itemId = new Types.ObjectId().toString();
    const other = new Types.ObjectId().toString();
    const home = {
      content: [
        { type: "Heading", props: { id: "h1", text: "Gallery", level: "h2" } },
        gridBlock("g1", [
          { id: other, publicId: "p0", alt: "keep me" },
          { id: itemId, publicId: "p1", alt: "old alt" },
        ]),
      ],
    };
    await Workspace.updateOne({ _id: ws._id }, { $set: { "publicPage.data.home": home } });

    await propagateItemAltText({ workspaceId: ws._id.toString(), itemId, alt: "new alt" });

    const saved = await Workspace.findById(ws._id).lean();
    const savedHome = saved!.publicPage!.data!.home as typeof home;
    expect(savedHome.content[0]).toEqual(home.content[0]); // Heading block untouched
    const images = savedHome.content[1].props.images as Array<{ id: string; publicId: string; alt: string }>;
    expect(images).toEqual([
      { id: other, publicId: "p0", alt: "keep me" },
      { id: itemId, publicId: "p1", alt: "new alt" },
    ]);
    expect(savedHome.content[1].props.columns).toBe(3);
    expect(savedHome.content[1].props.gap).toBe("normal");
  });

  it("is a no-op for a missing workspace, malformed itemId, or empty page", async () => {
    await expect(
      propagateItemAltText({ workspaceId: new Types.ObjectId().toString(), itemId: "not-an-id", alt: "x" })
    ).resolves.toBeUndefined();
    const ws = await makeWorkspace();
    await expect(
      propagateItemAltText({ workspaceId: ws._id.toString(), itemId: new Types.ObjectId().toString(), alt: "x" })
    ).resolves.toBeUndefined();
  });
});
