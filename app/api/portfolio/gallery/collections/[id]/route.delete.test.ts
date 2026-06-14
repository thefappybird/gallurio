import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
type MockResp = { body: unknown; status: number };
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, NextResponse: { json: (body: unknown, init?: ResponseInit): MockResp => ({ body, status: init?.status ?? 200 }) } };
});
vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));
const destroyAsset = vi.fn(async () => undefined);
vi.mock("@/lib/storage/cloudinary", () => ({ destroyAsset: (p: string) => destroyAsset(p) }));
let mockCtx: { userId: string; role: "owner" | "staff"; workspace: { _id: Types.ObjectId; slug: string } };
vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: async () => ({ userId: mockCtx.userId, role: mockCtx.role, workspace: mockCtx.workspace }),
}));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryCollection, GalleryItem, Workspace } from "@/lib/db/models";
import { DELETE } from "./route";

let wsA: Types.ObjectId, colA: Types.ObjectId;
async function seed() {
  const a = await Workspace.create({ slug: "a", name: "A", ownerUserId: "user_a", currency: "PHP" });
  wsA = a._id;
  const col = await GalleryCollection.create({ workspaceId: wsA, name: "C", slug: "c", order: 0 });
  colA = col._id;
  const colB = await GalleryCollection.create({ workspaceId: wsA, name: "C2", slug: "c2", order: 1 });
  // "shared" is in both colA and colB; "only" is only in colA.
  await GalleryItem.create({ workspaceId: wsA, collectionId: colA, cloudinaryPublicId: "shared", url: "u", order: 0 });
  await GalleryItem.create({ workspaceId: wsA, collectionId: colB._id, cloudinaryPublicId: "shared", url: "u", order: 0 });
  await GalleryItem.create({ workspaceId: wsA, collectionId: colA, cloudinaryPublicId: "only", url: "u", order: 1 });
  mockCtx = { userId: "user_a", role: "owner", workspace: { _id: wsA, slug: "a" } };
}
const params = () => ({ params: Promise.resolve({ id: colA.toString() }) });
beforeAll(startInMemoryMongo); afterAll(stopInMemoryMongo);
beforeEach(async () => { await clearCollections(); destroyAsset.mockClear(); await seed(); });

describe("DELETE collection (reference-counted)", () => {
  it("destroys only assets no other collection references", async () => {
    const res = (await DELETE(new Request("http://t/x", { method: "DELETE" }), params())) as unknown as MockResp;
    expect(res.status).toBe(200);
    expect(destroyAsset).toHaveBeenCalledTimes(1);
    expect(destroyAsset).toHaveBeenCalledWith("only");
    expect(destroyAsset).not.toHaveBeenCalledWith("shared");
    expect(await GalleryItem.countDocuments({ cloudinaryPublicId: "shared" })).toBe(1);
  });
});
