import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

type MockResp = { body: unknown; status: number };
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, NextResponse: { json: (body: unknown, init?: ResponseInit): MockResp => ({ body, status: init?.status ?? 200 }) } };
});
vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));
let mockCtx: { userId: string; role: "owner" | "staff"; workspace: { _id: Types.ObjectId; slug: string } };
vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: async () => ({ userId: mockCtx.userId, role: mockCtx.role, workspace: mockCtx.workspace }),
}));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryCollection, GalleryItem, Workspace } from "@/lib/db/models";
import { POST } from "./route";

let wsA: Types.ObjectId, colA: Types.ObjectId, i0: Types.ObjectId, i1: Types.ObjectId, i2: Types.ObjectId;
async function seed() {
  const a = await Workspace.create({ slug: "a", name: "A", ownerUserId: "user_a", currency: "PHP" });
  wsA = a._id;
  const col = await GalleryCollection.create({ workspaceId: wsA, name: "C", slug: "c", order: 0 });
  colA = col._id;
  const [a0, a1, a2] = await GalleryItem.create([
    { workspaceId: wsA, collectionId: colA, assetId: "0", url: "u", order: 0 },
    { workspaceId: wsA, collectionId: colA, assetId: "1", url: "u", order: 1 },
    { workspaceId: wsA, collectionId: colA, assetId: "2", url: "u", order: 2 },
  ]);
  i0 = a0._id; i1 = a1._id; i2 = a2._id;
  mockCtx = { userId: "user_a", role: "owner", workspace: { _id: wsA, slug: "a" } };
}
const params = () => ({ params: Promise.resolve({ id: colA.toString() }) });
const req = (b: unknown) => new Request("http://t/x", { method: "POST", body: JSON.stringify(b) });
beforeAll(startInMemoryMongo); afterAll(stopInMemoryMongo);
beforeEach(async () => { await clearCollections(); await seed(); });

describe("POST reorder", () => {
  it("reassigns order by index", async () => {
    const res = (await POST(req({ orderedItemIds: [i2.toString(), i0.toString(), i1.toString()] }), params())) as unknown as MockResp;
    expect(res.status).toBe(200);
    const byId = Object.fromEntries((await GalleryItem.find({ collectionId: colA }).lean()).map((d) => [String(d._id), d.order]));
    expect(byId[i2.toString()]).toBe(0);
    expect(byId[i0.toString()]).toBe(1);
    expect(byId[i1.toString()]).toBe(2);
  });
  it("ignores ids not in the collection", async () => {
    const foreign = new Types.ObjectId().toString();
    const res = (await POST(req({ orderedItemIds: [foreign, i0.toString()] }), params())) as unknown as MockResp;
    expect(res.status).toBe(200);
    // The foreign id must not leave a gap: i0 takes index 0, not 1.
    const i0Doc = await GalleryItem.findById(i0).lean();
    expect(i0Doc?.order).toBe(0);
  });
  it("rejects non-owner", async () => {
    mockCtx.role = "staff";
    const res = (await POST(req({ orderedItemIds: [i0.toString()] }), params())) as unknown as MockResp;
    expect(res.status).toBe(403);
  });
});
