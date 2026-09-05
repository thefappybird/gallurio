import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryItem } from "./GalleryItem";

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
afterEach(async () => {
  await clearCollections();
});

describe("GalleryItem schema defaults", () => {
  it("defaults title/date/location/client to '' and meta to [] when omitted", async () => {
    const item = await GalleryItem.create({
      workspaceId: new Types.ObjectId(),
      assetId: "pid",
      url: "https://imagedelivery.net/hash/pid/public",
      order: 0,
    });
    expect(item.title).toBe("");
    expect(item.date).toBe("");
    expect(item.location).toBe("");
    expect(item.client).toBe("");
    expect(item.meta).toEqual([]);

    // Hydrates the same way when read back from the DB.
    const fetched = await GalleryItem.findById(item._id).lean();
    expect(fetched?.title).toBe("");
    expect(fetched?.date).toBe("");
    expect(fetched?.meta).toEqual([]);
  });

  it("persists title/date/location/client/meta when provided", async () => {
    const item = await GalleryItem.create({
      workspaceId: new Types.ObjectId(),
      assetId: "pid2",
      url: "https://imagedelivery.net/hash/pid2/public",
      order: 0,
      title: "Ceremony",
      date: "2026-06-15",
      location: "Manila",
      client: "Reyes Family",
      meta: [{ label: "Photographer", value: "J. Cruz" }],
    });
    expect(item.title).toBe("Ceremony");
    expect(item.date).toBe("2026-06-15");
    expect(item.location).toBe("Manila");
    expect(item.client).toBe("Reyes Family");
    expect(item.meta.map((m) => ({ label: m.label, value: m.value }))).toEqual([
      { label: "Photographer", value: "J. Cruz" },
    ]);
  });

  it("a legacy document created before these fields existed still hydrates them via schema defaults", async () => {
    // Simulate a pre-existing document by writing directly, bypassing the
    // schema's create-time defaults for the new keys.
    await GalleryItem.collection.insertOne({
      workspaceId: new Types.ObjectId(),
      assetId: "legacy",
      url: "https://imagedelivery.net/hash/legacy/public",
      order: 0,
      caption: "",
      altText: "",
      tags: [],
    });
    const fetched = await GalleryItem.findOne({ assetId: "legacy" });
    expect(fetched?.title).toBe("");
    expect(fetched?.date).toBe("");
    expect(fetched?.meta).toEqual([]);
  });
});
