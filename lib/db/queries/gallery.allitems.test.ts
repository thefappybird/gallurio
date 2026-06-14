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
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(all)).toEqual(new Set(["dup", "x", "y"]));
  });
});
