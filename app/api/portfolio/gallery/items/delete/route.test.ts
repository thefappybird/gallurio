import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
type MockResp = { body: unknown; status: number };
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, NextResponse: { json: (body: unknown, init?: ResponseInit): MockResp => ({ body, status: init?.status ?? 200 }) } };
});
vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));
const deleteImage = vi.fn(async (assetId: string) => { void assetId; });
vi.mock("@/lib/storage/cloudflareImages", () => ({ deleteImage: (id: string) => deleteImage(id) }));
let mockCtx: { userId: string; role: "owner" | "staff"; workspace: { _id: Types.ObjectId; slug: string } };
vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: async () => ({ userId: mockCtx.userId, role: mockCtx.role, workspace: mockCtx.workspace }),
}));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryCollection, GalleryItem, Workspace } from "@/lib/db/models";
import { POST } from "./route";

let wsA: Types.ObjectId, colA: Types.ObjectId, copyInA: Types.ObjectId, copyInB: Types.ObjectId, foreign: Types.ObjectId;
async function seed() {
  const a = await Workspace.create({ slug: "a", name: "A", ownerUserId: "user_a", currency: "PHP" });
  const b = await Workspace.create({ slug: "b", name: "B", ownerUserId: "user_b", currency: "PHP" });
  wsA = a._id;
  const col = await GalleryCollection.create({ workspaceId: wsA, name: "C", slug: "c", order: 0 });
  colA = col._id;
  const colB = await GalleryCollection.create({ workspaceId: wsA, name: "C2", slug: "c2", order: 1 });
  const a1 = await GalleryItem.create({ workspaceId: wsA, collectionId: colA, assetId: "shared", url: "u", order: 0 });
  const a2 = await GalleryItem.create({ workspaceId: wsA, collectionId: colB._id, assetId: "shared", url: "u", order: 0 });
  copyInA = a1._id; copyInB = a2._id;
  const f = await GalleryItem.create({ workspaceId: b._id, collectionId: null, assetId: "fpid", url: "u", order: 0 });
  foreign = f._id;
  await GalleryCollection.updateOne({ _id: colA }, { $set: { coverItemId: copyInA } });
  mockCtx = { userId: "user_a", role: "owner", workspace: { _id: wsA, slug: "a" } };
}
const req = (b: unknown) => new Request("http://t/x", { method: "POST", body: JSON.stringify(b) });
beforeAll(startInMemoryMongo); afterAll(stopInMemoryMongo);
beforeEach(async () => { await clearCollections(); deleteImage.mockClear(); await seed(); });

describe("POST items/delete", () => {
  it("deletes every doc for the asset across collections and destroys it once", async () => {
    const res = (await POST(req({ itemIds: [copyInA.toString()] }))) as unknown as MockResp;
    expect(res.status).toBe(200);
    expect(await GalleryItem.findById(copyInA)).toBeNull();
    expect(await GalleryItem.findById(copyInB)).toBeNull();
    expect(deleteImage).toHaveBeenCalledTimes(1);
    expect(deleteImage).toHaveBeenCalledWith("shared");
  });
  it("repoints a collection cover that referenced a deleted item", async () => {
    await POST(req({ itemIds: [copyInA.toString()] }));
    const col = await GalleryCollection.findById(colA).lean();
    expect(col?.coverItemId).toBeNull();
  });
  it("ignores items from another workspace", async () => {
    const res = (await POST(req({ itemIds: [foreign.toString()] }))) as unknown as MockResp;
    expect((res.body as { deletedDocs: number }).deletedDocs).toBe(0);
    expect(deleteImage).not.toHaveBeenCalled();
  });
  it("rejects non-owner", async () => {
    mockCtx.role = "staff";
    const res = (await POST(req({ itemIds: [copyInA.toString()] }))) as unknown as MockResp;
    expect(res.status).toBe(403);
  });
});
