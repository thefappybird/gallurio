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
import { PATCH } from "./route";

let wsA: Types.ObjectId, colA: Types.ObjectId, itemInA: Types.ObjectId, itemForeignCol: Types.ObjectId;

async function seed() {
  const a = await Workspace.create({ slug: "a", name: "A", ownerUserId: "user_a", currency: "PHP" });
  wsA = a._id;
  const col = await GalleryCollection.create({ workspaceId: wsA, name: "Old", slug: "old", order: 0 });
  colA = col._id;
  const it = await GalleryItem.create({ workspaceId: wsA, collectionId: colA, assetId: "p", url: "u", order: 0 });
  itemInA = it._id;
  const otherCol = await GalleryCollection.create({ workspaceId: wsA, name: "Other", slug: "other", order: 1 });
  const it2 = await GalleryItem.create({ workspaceId: wsA, collectionId: otherCol._id, assetId: "q", url: "u", order: 0 });
  itemForeignCol = it2._id;
  mockCtx = { userId: "user_a", role: "owner", workspace: { _id: wsA, slug: "a" } };
}
const params = () => ({ params: Promise.resolve({ id: colA.toString() }) });
const req = (b: unknown) => new Request("http://t/x", { method: "PATCH", body: JSON.stringify(b) });

beforeAll(startInMemoryMongo); afterAll(stopInMemoryMongo);
beforeEach(async () => { await clearCollections(); await seed(); });

describe("PATCH collection", () => {
  it("renames without changing the slug", async () => {
    const res = (await PATCH(req({ name: "New name" }), params())) as unknown as MockResp;
    expect(res.status).toBe(200);
    const col = await GalleryCollection.findById(colA).lean();
    expect(col?.name).toBe("New name");
    expect(col?.slug).toBe("old");
  });
  it("sets a description", async () => {
    const res = (await PATCH(req({ description: "Full-day coverage." }), params())) as unknown as MockResp;
    expect(res.status).toBe(200);
    expect((res.body as { description: string }).description).toBe("Full-day coverage.");
    const col = await GalleryCollection.findById(colA).lean();
    expect(col?.description).toBe("Full-day coverage.");
  });
  it("sets a cover that belongs to the collection", async () => {
    const res = (await PATCH(req({ coverItemId: itemInA.toString() }), params())) as unknown as MockResp;
    expect(res.status).toBe(200);
    const col = await GalleryCollection.findById(colA).lean();
    expect(String(col?.coverItemId)).toBe(itemInA.toString());
  });
  it("rejects a cover from another collection", async () => {
    const res = (await PATCH(req({ coverItemId: itemForeignCol.toString() }), params())) as unknown as MockResp;
    expect(res.status).toBe(400);
  });
  it("rejects an empty body", async () => {
    const res = (await PATCH(req({}), params())) as unknown as MockResp;
    expect(res.status).toBe(400);
  });
  it("rejects non-owner", async () => {
    mockCtx.role = "staff";
    const res = (await PATCH(req({ name: "x" }), params())) as unknown as MockResp;
    expect(res.status).toBe(403);
  });
});
