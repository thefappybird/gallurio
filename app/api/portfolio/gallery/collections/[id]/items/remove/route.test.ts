import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
type MockResp = { body: unknown; status: number };
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, NextResponse: { json: (body: unknown, init?: ResponseInit): MockResp => ({ body, status: init?.status ?? 200 }) } };
});
vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));
let mockCtx: { userId: string; role: "owner" | "staff"; workspace: { _id: Types.ObjectId; slug: string } };
vi.mock("@/lib/auth/apiOrgContext", () => ({
  requireApiOrg: async () => ({
    ok: true,
    ctx: {
      userId: mockCtx.userId,
      workspaceId: String(mockCtx.workspace._id),
      role: mockCtx.role,
      workspace: mockCtx.workspace,
      userAvatarUrl: null,
    },
  }),
}));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryCollection, GalleryItem, Workspace } from "@/lib/db/models";
import { POST } from "./route";

let wsA: Types.ObjectId, colA: Types.ObjectId, soleItem: Types.ObjectId, copyItem: Types.ObjectId, otherCopy: Types.ObjectId;
async function seed() {
  const a = await Workspace.create({ slug: "a", name: "A", ownerUserId: "user_a", currency: "PHP" });
  wsA = a._id;
  const col = await GalleryCollection.create({ workspaceId: wsA, name: "C", slug: "c", order: 0 });
  colA = col._id;
  const s = await GalleryItem.create({ workspaceId: wsA, collectionId: colA, assetId: "uno", url: "u", order: 0 });
  soleItem = s._id;
  const c1 = await GalleryItem.create({ workspaceId: wsA, collectionId: colA, assetId: "dos", url: "u", order: 1 });
  copyItem = c1._id;
  const otherCol = await GalleryCollection.create({ workspaceId: wsA, name: "O", slug: "o", order: 1 });
  const c2 = await GalleryItem.create({ workspaceId: wsA, collectionId: otherCol._id, assetId: "dos", url: "u", order: 0 });
  otherCopy = c2._id;
  mockCtx = { userId: "user_a", role: "owner", workspace: { _id: wsA, slug: "a" } };
}
const params = () => ({ params: Promise.resolve({ id: colA.toString() }) });
const req = (b: unknown) => new Request("http://t/x", { method: "POST", body: JSON.stringify(b) });
beforeAll(startInMemoryMongo); afterAll(stopInMemoryMongo);
beforeEach(async () => { await clearCollections(); await seed(); });

describe("POST remove (detach)", () => {
  it("deletes the membership when the asset survives elsewhere", async () => {
    await POST(req({ itemIds: [copyItem.toString()] }), params());
    expect(await GalleryItem.findById(copyItem)).toBeNull();
    expect(await GalleryItem.findById(otherCopy)).not.toBeNull();
  });
  it("keeps the photo as standalone when it was the asset's last doc", async () => {
    await POST(req({ itemIds: [soleItem.toString()] }), params());
    const doc = await GalleryItem.findById(soleItem).lean();
    expect(doc).not.toBeNull();
    expect(doc?.collectionId).toBeNull();
  });
  it("rejects non-owner", async () => {
    mockCtx.role = "staff";
    const res = (await POST(req({ itemIds: [soleItem.toString()] }), params())) as unknown as MockResp;
    expect(res.status).toBe(403);
  });
  it("repoints the cover to the newest remaining item when the cover was detached", async () => {
    await GalleryCollection.updateOne({ _id: colA }, { $set: { coverItemId: copyItem } });
    await POST(req({ itemIds: [copyItem.toString()] }), params());
    const col = await GalleryCollection.findById(colA).lean();
    expect(String(col?.coverItemId)).toBe(soleItem.toString());
  });
});
