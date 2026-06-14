import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

type MockResp = { body: unknown; status: number };

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    NextResponse: {
      json: (body: unknown, init?: ResponseInit): MockResp => ({ body, status: init?.status ?? 200 }),
    },
  };
});
vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

let mockCtx: { userId: string; role: "owner" | "staff"; workspace: { _id: Types.ObjectId; slug: string } };
vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: async () => ({ userId: mockCtx.userId, role: mockCtx.role, workspace: mockCtx.workspace }),
}));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryCollection, GalleryItem, Workspace } from "@/lib/db/models";
import { POST } from "./route";

let wsA: Types.ObjectId, wsB: Types.ObjectId, colA: Types.ObjectId, srcStandalone: Types.ObjectId, srcForeign: Types.ObjectId;

async function seed() {
  const a = await Workspace.create({ slug: "a", name: "A", ownerUserId: "user_a", currency: "PHP" });
  const b = await Workspace.create({ slug: "b", name: "B", ownerUserId: "user_b", currency: "PHP" });
  wsA = a._id; wsB = b._id;
  const col = await GalleryCollection.create({ workspaceId: wsA, name: "C", slug: "c", order: 0 });
  colA = col._id;
  const s = await GalleryItem.create({ workspaceId: wsA, collectionId: null, assetId: "src_standalone", url: "https://imagedelivery.net/hash/src_standalone/public", order: 0 });
  srcStandalone = s._id;
  const f = await GalleryItem.create({ workspaceId: wsB, collectionId: null, assetId: "src_foreign", url: "https://imagedelivery.net/hash/src_foreign/public", order: 0 });
  srcForeign = f._id;
  mockCtx = { userId: "user_a", role: "owner", workspace: { _id: wsA, slug: "a" } };
}
function req(body: unknown) {
  return new Request("http://t/copy", { method: "POST", body: JSON.stringify(body) });
}

beforeAll(startInMemoryMongo);
afterAll(stopInMemoryMongo);
beforeEach(async () => { await clearCollections(); await seed(); });

describe("POST copy", () => {
  it("creates a copy of an existing item in the collection", async () => {
    const res = (await POST(req({ sourceItemIds: [srcStandalone.toString()] }), { params: Promise.resolve({ id: colA.toString() }) })) as unknown as MockResp;
    expect(res.status).toBe(201);
    const copies = await GalleryItem.find({ workspaceId: wsA, collectionId: colA }).lean();
    expect(copies).toHaveLength(1);
    expect(copies[0].assetId).toBe("src_standalone");
  });

  it("is idempotent per collection (skips assets already present)", async () => {
    await POST(req({ sourceItemIds: [srcStandalone.toString()] }), { params: Promise.resolve({ id: colA.toString() }) });
    await POST(req({ sourceItemIds: [srcStandalone.toString()] }), { params: Promise.resolve({ id: colA.toString() }) });
    const copies = await GalleryItem.find({ workspaceId: wsA, collectionId: colA }).lean();
    expect(copies).toHaveLength(1);
  });

  it("ignores items from another workspace (tenant isolation)", async () => {
    const res = (await POST(req({ sourceItemIds: [srcForeign.toString()] }), { params: Promise.resolve({ id: colA.toString() }) })) as unknown as MockResp;
    expect((res.body as { items: unknown[] }).items).toHaveLength(0);
    expect(await GalleryItem.countDocuments({ workspaceId: wsA, collectionId: colA })).toBe(0);
  });

  it("backfills the cover when the collection has none", async () => {
    await POST(req({ sourceItemIds: [srcStandalone.toString()] }), { params: Promise.resolve({ id: colA.toString() }) });
    const col = await GalleryCollection.findById(colA).lean();
    expect(col?.coverItemId).toBeTruthy();
  });

  it("rejects non-owner", async () => {
    mockCtx.role = "staff";
    const res = (await POST(req({ sourceItemIds: [srcStandalone.toString()] }), { params: Promise.resolve({ id: colA.toString() }) })) as unknown as MockResp;
    expect(res.status).toBe(403);
  });
});
