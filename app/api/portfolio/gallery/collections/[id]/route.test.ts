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
  cloudinaryThumbnailUrl: (publicId: string) => `https://res.cloudinary.com/test/image/upload/c_fill,w_200,h_200,q_auto,f_auto/${publicId}`,
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
import { GET } from "./route";

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

describe("GET /api/portfolio/gallery/collections/[id]", () => {
  it("rejects a non-owner with 403", async () => {
    const col = await seedCollectionWithItems(workspaceId, 2);
    mockCtx.role = "staff";
    const res = (await GET(new Request("http://t/?limit=16"), makeParams(String(col._id)))) as unknown as MockResp;
    expect(res.status).toBe(403);
  });

  it("returns 400 for an invalid (non-'all') id", async () => {
    const res = (await GET(new Request("http://t"), makeParams("not-an-id"))) as unknown as MockResp;
    expect(res.status).toBe(400);
  });

  it("returns a collection's items, paginated by cursor", async () => {
    const col = await seedCollectionWithItems(workspaceId, 5); // orders 0..4
    const r1 = (await GET(new Request("http://t/?limit=2"), makeParams(String(col._id)))) as unknown as MockResp;
    const b1 = r1.body as { items: { id: string }[]; nextCursor: string | null };
    expect(b1.items).toHaveLength(2);
    expect(b1.nextCursor).toBeTruthy();

    const r2 = (await GET(
      new Request(`http://t/?limit=2&cursor=${encodeURIComponent(b1.nextCursor!)}`),
      makeParams(String(col._id))
    )) as unknown as MockResp;
    expect((r2.body as { items: unknown[] }).items).toHaveLength(2);
  });

  it("cannot read another workspace's collection items (tenant isolation)", async () => {
    const otherWs = await Workspace.create({
      slug: "ws-c", name: "C", ownerUserId: "user_c",
      clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`, currency: "PHP",
    });
    const foreign = await seedCollectionWithItems(otherWs._id, 3);
    const res = (await GET(new Request("http://t/?limit=16"), makeParams(String(foreign._id)))) as unknown as MockResp;
    expect(res.status).toBe(200);
    expect((res.body as { items: unknown[] }).items).toEqual([]);
  });

  it("serves the virtual 'all' feed newest-first across collections", async () => {
    await seedCollectionWithItems(workspaceId, 2);
    await GalleryItem.create({
      workspaceId, collectionId: null,
      cloudinaryPublicId: `gallurio/${workspaceId}/portfolio/last.jpg`,
      url: "https://x/last.jpg", caption: "Last", order: 0,
    });
    const res = (await GET(new Request("http://t/?limit=10"), makeParams("all"))) as unknown as MockResp;
    expect(res.status).toBe(200);
    const body = res.body as { items: { caption: string | null }[] };
    expect(body.items.length).toBeGreaterThanOrEqual(3);
    expect(body.items[0].caption).toBe("Last"); // newest-first
  });

  it("?newest=N returns the newest N of a collection (bulk select), nextCursor null", async () => {
    const col = await seedCollectionWithItems(workspaceId, 5); // orders 0..4, createdAt increasing
    const res = (await GET(new Request("http://t/?newest=2"), makeParams(String(col._id)))) as unknown as MockResp;
    expect(res.status).toBe(200);
    const body = res.body as { items: unknown[]; nextCursor: string | null };
    expect(body.items).toHaveLength(2);
    expect(body.nextCursor).toBeNull();
  });
});
