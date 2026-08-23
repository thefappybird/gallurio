import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryItem } from "@/lib/db/models/GalleryItem";
import { GalleryCollection } from "@/lib/db/models/GalleryCollection";

vi.mock("@/lib/storage/cloudflareImages", () => ({
  imageDeliveryUrl: (id: string) => (id ? `https://cdn.example.com/${id}` : ""),
}));

import { collectCollectionImages, collectGalleryPublishedImages } from "../publishedImages.server";

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
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

async function makeItem(workspaceId: Types.ObjectId, collectionId: Types.ObjectId, i: number, over: Record<string, unknown> = {}) {
  return GalleryItem.create({
    workspaceId,
    collectionId,
    assetId: `asset-${i}`,
    url: `https://x/${i}.jpg`,
    altText: `Alt ${i}`,
    caption: `Cap ${i}`,
    order: i,
    ...over,
  });
}

describe("collectCollectionImages", () => {
  it("returns images for the given collections, scoped to the workspace", async () => {
    const ws = new Types.ObjectId();
    const col = await GalleryCollection.create({ workspaceId: ws, name: "Public", slug: "public", isPublic: true });
    await makeItem(ws, col._id, 0);
    const result = await collectCollectionImages({ workspaceId: ws.toString(), collectionIds: [col._id.toString()], limit: 10 });
    expect(result).toEqual([{ url: "https://cdn.example.com/asset-0", alt: "Alt 0" }]);
  });

  it("never returns a foreign-workspace item", async () => {
    const wsA = new Types.ObjectId();
    const wsB = new Types.ObjectId();
    const col = new Types.ObjectId();
    await GalleryCollection.create({ workspaceId: wsB, _id: col, name: "Foreign", slug: "foreign", isPublic: true });
    await makeItem(wsB, col, 0);
    const result = await collectCollectionImages({ workspaceId: wsA.toString(), collectionIds: [col.toString()], limit: 10 });
    expect(result).toEqual([]);
  });

  it("never exposes items from a private collection referenced by published Puck data", async () => {
    const ws = new Types.ObjectId();
    const col = await GalleryCollection.create({
      workspaceId: ws,
      name: "Private",
      slug: "private",
      isPublic: false,
    });
    await makeItem(ws, col._id, 0);

    const result = await collectCollectionImages({
      workspaceId: ws.toString(),
      collectionIds: [col._id.toString()],
      limit: 10,
    });

    expect(result).toEqual([]);
  });

  it("falls back alt to caption then empty string", async () => {
    const ws = new Types.ObjectId();
    const col = await GalleryCollection.create({ workspaceId: ws, name: "Public", slug: "public", isPublic: true });
    await makeItem(ws, col._id, 0, { altText: "", caption: "" });
    const result = await collectCollectionImages({ workspaceId: ws.toString(), collectionIds: [col._id.toString()], limit: 10 });
    expect(result[0].alt).toBe("");
  });

  it("returns empty array when collectionIds is empty", async () => {
    const result = await collectCollectionImages({ workspaceId: new Types.ObjectId().toString(), collectionIds: [], limit: 10 });
    expect(result).toEqual([]);
  });

  it("bounds the DB query itself: a collection larger than the cap returns exactly `limit`, in stable (order,_id) order, not Mongo's insertion order", async () => {
    const ws = new Types.ObjectId();
    const col = await GalleryCollection.create({ workspaceId: ws, name: "Public", slug: "public", isPublic: true });
    // Insert out of `order` sequence so natural/insertion order would differ
    // from the expected (order, _id) result if the query weren't sorted.
    for (const i of [4, 2, 0, 3, 1]) {
      await makeItem(ws, col._id, i, { order: i });
    }
    const result = await collectCollectionImages({ workspaceId: ws.toString(), collectionIds: [col._id.toString()], limit: 3 });
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.url)).toEqual([
      "https://cdn.example.com/asset-0",
      "https://cdn.example.com/asset-1",
      "https://cdn.example.com/asset-2",
    ]);
  });
});

describe("collectGalleryPublishedImages", () => {
  it("merges gallery-block images and FeaturedWork collection images, deduped by url", async () => {
    const ws = new Types.ObjectId();
    const col = await GalleryCollection.create({ workspaceId: ws, name: "Public", slug: "public", isPublic: true });
    await makeItem(ws, col._id, 0, { assetId: "shared-asset" });
    const galleryData = {
      content: [
        { type: "GalleryGrid", props: { images: [{ id: "x", publicId: "shared-asset", alt: "grid alt" }] } },
        { type: "FeaturedWork", props: { collections: [{ id: col._id.toString() }] } },
      ],
    };
    const result = await collectGalleryPublishedImages({ workspaceId: ws.toString(), galleryData });
    // Both sources resolve to the same delivery URL for "shared-asset" — deduped to one entry.
    expect(result).toEqual([{ url: "https://cdn.example.com/shared-asset", alt: "grid alt" }]);
  });
});
