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
