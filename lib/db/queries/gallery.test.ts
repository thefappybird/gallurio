import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryItem } from "@/lib/db/models/GalleryItem";
import { GalleryCollection } from "@/lib/db/models/GalleryCollection";
import { listItemsForBlock, getItemsByIds } from "./gallery";

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

describe("listItemsForBlock", () => {
  it("returns [] for null/blank/malformed collectionId", async () => {
    const ws = new Types.ObjectId().toString();
    expect(await listItemsForBlock({ workspaceId: ws, collectionId: null })).toEqual([]);
    expect(await listItemsForBlock({ workspaceId: ws, collectionId: "   " })).toEqual([]);
    expect(await listItemsForBlock({ workspaceId: ws, collectionId: "not-an-id" })).toEqual([]);
  });

  it("returns [] when workspaceId is empty", async () => {
    const col = new Types.ObjectId().toString();
    expect(await listItemsForBlock({ workspaceId: "", collectionId: col })).toEqual([]);
  });

  it("returns items for a public collection in the workspace", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    await seedItems(ws, col._id, 3);

    const items = await listItemsForBlock({
      workspaceId: ws.toString(),
      collectionId: col._id.toString(),
    });
    expect(items).toHaveLength(3);
  });

  it("returns [] for a private collection", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws, { isPublic: false });
    await seedItems(ws, col._id, 5);

    const items = await listItemsForBlock({
      workspaceId: ws.toString(),
      collectionId: col._id.toString(),
    });
    expect(items).toEqual([]);
  });

  it("returns [] when the collection belongs to another workspace (tenant isolation)", async () => {
    const wsA = new Types.ObjectId();
    const wsB = new Types.ObjectId();
    const colB = await makeCollection(wsB);
    await seedItems(wsB, colB._id, 4);

    // Workspace A asks for workspace B's collection id
    const items = await listItemsForBlock({
      workspaceId: wsA.toString(),
      collectionId: colB._id.toString(),
    });
    expect(items).toEqual([]);
  });

  it("sorts by order then createdAt", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    // Insert out of order: order values 2, 0, 1
    await GalleryItem.create({
      workspaceId: ws,
      collectionId: col._id,
      cloudinaryPublicId: "p2",
      url: "u2",
      caption: "c2",
      order: 2,
    });
    await GalleryItem.create({
      workspaceId: ws,
      collectionId: col._id,
      cloudinaryPublicId: "p0",
      url: "u0",
      caption: "c0",
      order: 0,
    });
    await GalleryItem.create({
      workspaceId: ws,
      collectionId: col._id,
      cloudinaryPublicId: "p1",
      url: "u1",
      caption: "c1",
      order: 1,
    });

    const items = await listItemsForBlock({
      workspaceId: ws.toString(),
      collectionId: col._id.toString(),
    });
    expect(items.map((i) => i.cloudinaryPublicId)).toEqual(["p0", "p1", "p2"]);
  });

  it("caps results at the requested limit", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    await seedItems(ws, col._id, 30);

    const items = await listItemsForBlock({
      workspaceId: ws.toString(),
      collectionId: col._id.toString(),
      limit: 5,
    });
    expect(items).toHaveLength(5);
  });

  it("defaults the limit to 24", async () => {
    const ws = new Types.ObjectId();
    const col = await makeCollection(ws);
    await seedItems(ws, col._id, 30);

    const items = await listItemsForBlock({
      workspaceId: ws.toString(),
      collectionId: col._id.toString(),
    });
    expect(items).toHaveLength(24);
  });
});

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
