import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

type MockResponse = { body: unknown; status: number };

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    NextResponse: {
      json: (body: unknown, init?: ResponseInit): MockResponse => ({
        body,
        status: init?.status ?? 200,
      }),
    },
  };
});

vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

let mockCtx: {
  userId: string;
  role: "owner" | "staff";
  workspace: { _id: Types.ObjectId; slug: string };
};
vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: async () => ({
    userId: mockCtx.userId,
    role: mockCtx.role,
    workspace: mockCtx.workspace,
  }),
}));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryCollection, GalleryItem, Workspace } from "@/lib/db/models";
import { GET } from "./route";

type MockResp = { body: unknown; status: number };

let workspaceIdA: Types.ObjectId;
let workspaceIdB: Types.ObjectId;

async function seedData() {
  const wsA = await Workspace.create({
    slug: "workspace-a",
    name: "Workspace A",
    ownerUserId: "user_a",
    currency: "PHP",
  });
  const wsB = await Workspace.create({
    slug: "workspace-b",
    name: "Workspace B",
    ownerUserId: "user_b",
    currency: "PHP",
  });
  workspaceIdA = wsA._id;
  workspaceIdB = wsB._id;

  // Collection + items for workspace A
  const colA = await GalleryCollection.create({
    workspaceId: workspaceIdA,
    name: "Wedding 2024",
    slug: "wedding-2024",
    isPublic: true,
    order: 0,
  });
  await GalleryItem.create([
    {
      workspaceId: workspaceIdA,
      collectionId: colA._id,
      assetId: `gallurio/${workspaceIdA}/portfolio/1.jpg`,
      url: "https://imagedelivery.net/test-hash/1/public",
      order: 0,
    },
    {
      workspaceId: workspaceIdA,
      collectionId: colA._id,
      assetId: `gallurio/${workspaceIdA}/portfolio/2.jpg`,
      url: "https://imagedelivery.net/test-hash/2/public",
      order: 1,
    },
  ]);

  // Collection + items for workspace B (must not bleed into A's response)
  const colB = await GalleryCollection.create({
    workspaceId: workspaceIdB,
    name: "B Collection",
    slug: "b-collection",
    isPublic: true,
    order: 0,
  });
  await GalleryItem.create({
    workspaceId: workspaceIdB,
    collectionId: colB._id,
    assetId: `gallurio/${workspaceIdB}/portfolio/b.jpg`,
    url: "https://imagedelivery.net/test-hash/b/public",
    order: 0,
  });

  mockCtx = {
    userId: "user_a",
    role: "owner",
    workspace: { _id: workspaceIdA, slug: "workspace-a" },
  };
}

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
  await seedData();
});

describe("GET /api/portfolio/gallery", () => {
  it("returns collections and items for the current workspace", async () => {
    const res = (await GET()) as unknown as MockResp;
    expect(res.status).toBe(200);
    const body = res.body as { collections: unknown[]; items: unknown[] };
    expect(body.collections).toHaveLength(1);
    expect((body.collections[0] as { name: string }).name).toBe("Wedding 2024");
    expect(body.items).toHaveLength(2);
  });

  it("rejects non-owner with 403", async () => {
    mockCtx.role = "staff";
    const res = (await GET()) as unknown as MockResp;
    expect(res.status).toBe(403);
    expect((res.body as { error: string }).error).toBe("owner_only");
  });

  it("tenant isolation: workspace A cannot see workspace B's data", async () => {
    // mockCtx is workspace A — B's items must not appear
    const res = (await GET()) as unknown as MockResp;
    expect(res.status).toBe(200);
    const body = res.body as { collections: unknown[]; items: { id: string }[] };
    const itemIds = body.items.map((i) => i.id);

    // Fetch workspace B's items and confirm none appear in the response
    const bItems = await GalleryItem.find({ workspaceId: workspaceIdB }).lean();
    for (const bItem of bItems) {
      expect(itemIds).not.toContain(String(bItem._id));
    }
  });

  it("includes itemCount in collection data", async () => {
    const res = (await GET()) as unknown as MockResp;
    const body = res.body as { collections: { itemCount: number }[] };
    expect(body.collections[0].itemCount).toBe(2);
  });
});
