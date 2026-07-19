import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryItem } from "@/lib/db/models";
import { countItemsByAssetId } from "./gallery";

const ws = new Types.ObjectId();

beforeAll(startInMemoryMongo);
afterAll(stopInMemoryMongo);
beforeEach(clearCollections);

describe("countItemsByAssetId", () => {
  it("counts every doc in the workspace sharing an assetId", async () => {
    await GalleryItem.create([
      { workspaceId: ws, assetId: `img_a`, url: "u", order: 0 },
      { workspaceId: ws, assetId: `img_a`, url: "u", order: 1 },
      { workspaceId: ws, assetId: `img_b`, url: "u", order: 0 },
    ]);
    expect(await countItemsByAssetId(ws.toString(), "img_a")).toBe(2);
    expect(await countItemsByAssetId(ws.toString(), "img_b")).toBe(1);
  });

  it("does not count other workspaces", async () => {
    const other = new Types.ObjectId();
    await GalleryItem.create({ workspaceId: other, assetId: "shared", url: "u", order: 0 });
    expect(await countItemsByAssetId(ws.toString(), "shared")).toBe(0);
  });
});
