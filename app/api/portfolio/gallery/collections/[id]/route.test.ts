import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

type MockResp = { body: unknown; status: number };

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    NextResponse: {
      json: (body: unknown, init?: ResponseInit): MockResp => ({
        body,
        status: init?.status ?? 200,
      }),
    },
  };
});

vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

// Track every Cloudinary destroy so we can assert the cascade ran.
const destroyed: string[] = [];
let destroyShouldThrow = false;
vi.mock("@/lib/storage/cloudinary", () => ({
  destroyAsset: async (publicId: string) => {
    if (destroyShouldThrow) throw new Error("cloudinary_down");
    destroyed.push(publicId);
  },
}));

let mockCtx: {
  userId: string;
  role: "owner" | "staff";
  workspace: { _id: Types.ObjectId; slug: string };
};
vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: async () => ({
    userId: mockCtx.userId,
    clerkOrgId: "org_test",
    role: mockCtx.role,
    workspace: mockCtx.workspace,
  }),
}));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryCollection, GalleryItem, Workspace } from "@/lib/db/models";
import { DELETE } from "./route";

let workspaceId: Types.ObjectId;

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function seedCollectionWithItems(wsId: Types.ObjectId, count: number) {
  const col = await GalleryCollection.create({
    workspaceId: wsId,
    name: "Weddings",
    slug: `weddings-${Math.round(Math.random() * 1e9)}`,
    isPublic: true,
    order: 0,
  });
  const items = await GalleryItem.create(
    Array.from({ length: count }, (_, i) => ({
      workspaceId: wsId,
      collectionId: col._id,
      cloudinaryPublicId: `gallurio/${wsId}/portfolio/img-${i}.jpg`,
      url: `https://res.cloudinary.com/x/img-${i}.jpg`,
      order: i,
    }))
  );
  await GalleryCollection.updateOne({ _id: col._id }, { $set: { coverItemId: items[0]?._id } });
  return col;
}

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
  destroyed.length = 0;
  destroyShouldThrow = false;
  const ws = await Workspace.create({
    slug: "ws-a",
    name: "Workspace A",
    ownerUserId: "user_a",
    clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`,
    currency: "PHP",
  });
  workspaceId = ws._id;
  mockCtx = { userId: "user_a", role: "owner", workspace: { _id: workspaceId, slug: "ws-a" } };
});

describe("DELETE /api/portfolio/gallery/collections/[id]", () => {
  it("hard-deletes the collection, its items, and destroys their Cloudinary assets", async () => {
    const col = await seedCollectionWithItems(workspaceId, 3);
    const res = (await DELETE(new Request("http://t"), makeParams(String(col._id)))) as unknown as MockResp;

    expect(res.status).toBe(200);
    expect((res.body as { itemsDeleted: number }).itemsDeleted).toBe(3);
    expect(await GalleryCollection.countDocuments({})).toBe(0);
    expect(await GalleryItem.countDocuments({})).toBe(0);
    expect(destroyed).toHaveLength(3);
  });

  it("rejects a non-owner with 403 and deletes nothing", async () => {
    const col = await seedCollectionWithItems(workspaceId, 2);
    mockCtx.role = "staff";
    const res = (await DELETE(new Request("http://t"), makeParams(String(col._id)))) as unknown as MockResp;

    expect(res.status).toBe(403);
    expect(await GalleryCollection.countDocuments({})).toBe(1);
    expect(await GalleryItem.countDocuments({})).toBe(2);
    expect(destroyed).toHaveLength(0);
  });

  it("cannot delete another workspace's collection (tenant isolation) → 404", async () => {
    const otherWs = await Workspace.create({
      slug: "ws-b",
      name: "Workspace B",
      ownerUserId: "user_b",
      clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`,
      currency: "PHP",
    });
    const foreign = await seedCollectionWithItems(otherWs._id, 2);

    const res = (await DELETE(new Request("http://t"), makeParams(String(foreign._id)))) as unknown as MockResp;

    expect(res.status).toBe(404);
    // Org B's data is untouched.
    expect(await GalleryCollection.countDocuments({ workspaceId: otherWs._id })).toBe(1);
    expect(await GalleryItem.countDocuments({ workspaceId: otherWs._id })).toBe(2);
    expect(destroyed).toHaveLength(0);
  });

  it("returns 404 for a missing collection", async () => {
    const res = (await DELETE(
      new Request("http://t"),
      makeParams(String(new Types.ObjectId()))
    )) as unknown as MockResp;
    expect(res.status).toBe(404);
  });

  it("returns 400 for an invalid id", async () => {
    const res = (await DELETE(new Request("http://t"), makeParams("not-an-id"))) as unknown as MockResp;
    expect(res.status).toBe(400);
  });

  it("never touches items outside the collection (collectionId: null)", async () => {
    const col = await seedCollectionWithItems(workspaceId, 2);
    await GalleryItem.create({
      workspaceId,
      collectionId: null,
      cloudinaryPublicId: `gallurio/${workspaceId}/portfolio/featured.jpg`,
      url: "https://res.cloudinary.com/x/featured.jpg",
      order: 0,
    });

    const res = (await DELETE(new Request("http://t"), makeParams(String(col._id)))) as unknown as MockResp;

    expect(res.status).toBe(200);
    const remaining = await GalleryItem.find({}).lean();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].collectionId).toBeNull();
    // The standalone asset was not destroyed.
    expect(destroyed).not.toContain(`gallurio/${workspaceId}/portfolio/featured.jpg`);
  });

  it("still completes the DB delete when Cloudinary destroy fails, reporting assetsFailed", async () => {
    const col = await seedCollectionWithItems(workspaceId, 2);
    destroyShouldThrow = true;

    const res = (await DELETE(new Request("http://t"), makeParams(String(col._id)))) as unknown as MockResp;

    expect(res.status).toBe(200);
    expect((res.body as { assetsFailed: number }).assetsFailed).toBe(2);
    // DB is still fully cleaned up despite the Cloudinary failures.
    expect(await GalleryCollection.countDocuments({})).toBe(0);
    expect(await GalleryItem.countDocuments({})).toBe(0);
  });
});
