import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryCollection } from "./GalleryCollection";

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
afterEach(async () => {
  await clearCollections();
});

describe("GalleryCollection schema defaults", () => {
  it("defaults description to '' when omitted", async () => {
    const col = await GalleryCollection.create({
      workspaceId: new Types.ObjectId(),
      name: "Weddings",
      slug: "weddings",
    });
    expect(col.description).toBe("");
  });

  it("persists a provided description", async () => {
    const col = await GalleryCollection.create({
      workspaceId: new Types.ObjectId(),
      name: "Weddings",
      slug: "weddings-2",
      description: "Full-day wedding coverage across Metro Manila.",
    });
    expect(col.description).toBe("Full-day wedding coverage across Metro Manila.");
  });

  it("a legacy document lacking `description` still hydrates it via the schema default", async () => {
    await GalleryCollection.collection.insertOne({
      workspaceId: new Types.ObjectId(),
      name: "Legacy",
      slug: "legacy",
      isPublic: true,
      order: 0,
    });
    const fetched = await GalleryCollection.findOne({ slug: "legacy" });
    expect(fetched?.description).toBe("");
  });
});
