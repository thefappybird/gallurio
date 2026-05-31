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
import { POST } from "./route";

let workspaceId: Types.ObjectId;

// The route only calls req.json(); a minimal stub avoids depending on a global
// Request implementation in the test environment.
function makeReq(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
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

describe("POST /api/portfolio/gallery/collections", () => {
  it("creates a collection with starter items and sets the first as cover", async () => {
    const pid = `gallurio/${workspaceId}/portfolio/x.jpg`;
    const res = (await POST(
      makeReq({
        name: "Weddings 2024",
        items: [{ cloudinaryPublicId: pid, url: "https://res.cloudinary.com/x/x.jpg", width: 1200, height: 800 }],
      })
    )) as unknown as MockResp;

    expect(res.status).toBe(201);
    const body = res.body as { id: string; name: string; slug: string };
    expect(body.name).toBe("Weddings 2024");
    expect(body.slug).toBe("weddings-2024");

    const col = await GalleryCollection.findById(body.id).lean();
    expect(col?.workspaceId.toString()).toBe(workspaceId.toString());
    expect(col?.coverItemId).toBeTruthy();

    const items = await GalleryItem.find({ collectionId: body.id }).lean();
    expect(items).toHaveLength(1);
    expect(items[0].workspaceId.toString()).toBe(workspaceId.toString());
  });

  it("creates a collection with no starter items", async () => {
    const res = (await POST(makeReq({ name: "Empty Gallery" }))) as unknown as MockResp;
    expect(res.status).toBe(201);
    const body = res.body as { id: string };
    const items = await GalleryItem.find({ collectionId: body.id }).lean();
    expect(items).toHaveLength(0);
  });

  it("rejects a non-owner with 403", async () => {
    mockCtx.role = "staff";
    const res = (await POST(makeReq({ name: "X" }))) as unknown as MockResp;
    expect(res.status).toBe(403);
    expect((res.body as { error: string }).error).toBe("owner_only");
    expect(await GalleryCollection.countDocuments({})).toBe(0);
  });

  it("rejects an empty name with 400", async () => {
    const res = (await POST(makeReq({ name: "" }))) as unknown as MockResp;
    expect(res.status).toBe(400);
  });

  it("rejects items whose Cloudinary public id is outside the workspace folder", async () => {
    const foreignPid = `gallurio/${new Types.ObjectId()}/portfolio/evil.jpg`;
    const res = (await POST(
      makeReq({ name: "Sneaky", items: [{ cloudinaryPublicId: foreignPid, url: "https://res.cloudinary.com/x/evil.jpg" }] })
    )) as unknown as MockResp;
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("invalid_image_ownership");
    // Nothing should have been written (transaction never ran).
    expect(await GalleryCollection.countDocuments({})).toBe(0);
  });

  it("rejects a path-traversal public id even with the workspace prefix", async () => {
    const traversal = `gallurio/${workspaceId}/../${new Types.ObjectId()}/evil.jpg`;
    const res = (await POST(
      makeReq({ name: "Sneaky", items: [{ cloudinaryPublicId: traversal, url: "https://res.cloudinary.com/x/evil.jpg" }] })
    )) as unknown as MockResp;
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("invalid_image_ownership");
  });

  it("appends a suffix when the derived slug collides within the workspace", async () => {
    await GalleryCollection.create({ workspaceId, name: "Dup", slug: "dup", isPublic: true, order: 0 });
    const res = (await POST(makeReq({ name: "Dup" }))) as unknown as MockResp;
    expect(res.status).toBe(201);
    expect((res.body as { slug: string }).slug).not.toBe("dup");
  });
});
