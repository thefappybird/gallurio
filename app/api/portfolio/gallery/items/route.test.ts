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

const mockVerifyOwnership = vi.fn(async (_imageId: string, _wsId: string) => true);
vi.mock("@/lib/storage/cloudflareImages", () => ({
  verifyImageOwnership: (imageId: string, wsId: string) => mockVerifyOwnership(imageId, wsId),
  imageDeliveryUrl: (assetId: string) => `https://imagedelivery.net/hash/${assetId}/public`,
}));

let mockCtx: {
  userId: string;
  role: "owner" | "staff";
  workspace: { _id: Types.ObjectId; slug: string };
};
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
import { PHOTO_SPEC } from "@/lib/page-builder/photoSpec";

let workspaceId: Types.ObjectId;

function makeReq(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

function validPayload(override: Record<string, unknown> = {}) {
  return {
    assetId: "img_abc123",
    url: "https://imagedelivery.net/hash/img_abc123/public",
    format: "jpg",
    sizeBytes: 1024,
    width: 1200,
    height: 800,
    ...override,
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
  mockVerifyOwnership.mockReset();
  mockVerifyOwnership.mockResolvedValue(true);
  const ws = await Workspace.create({
    slug: "ws-items",
    name: "Workspace Items",
    ownerUserId: "user_a",
    currency: "PHP",
  });
  workspaceId = ws._id;
  mockCtx = { userId: "user_a", role: "owner", workspace: { _id: workspaceId, slug: "ws-items" } };
});

describe("POST /api/portfolio/gallery/items", () => {
  it("creates a gallery item and returns 201 with id + thumbUrl", async () => {
    const res = (await POST(makeReq(validPayload()))) as unknown as MockResp;
    expect(res.status).toBe(201);
    const body = res.body as { id: string; thumbUrl: string; caption: string | null };
    expect(body.id).toBeTruthy();
    expect(body.thumbUrl).toContain("imagedelivery.net");
    expect(body.caption).toBeNull();

    const saved = await GalleryItem.findById(body.id).lean();
    expect(saved?.workspaceId.toString()).toBe(workspaceId.toString());
  });

  it("accepts all supported formats: jpeg, png, webp, avif", async () => {
    for (const fmt of ["jpeg", "png", "webp", "avif"]) {
      const res = (await POST(
        makeReq(validPayload({ format: fmt }))
      )) as unknown as MockResp;
      expect(res.status, `format ${fmt} should be accepted`).toBe(201);
    }
  });

  it("creates the item even when optional fields (format, sizeBytes, dimensions) are omitted", async () => {
    const res = (await POST(
      makeReq({ assetId: "img_min", url: "https://imagedelivery.net/hash/img_min/public" })
    )) as unknown as MockResp;
    expect(res.status).toBe(201);
  });

  it("rejects a non-owner with 403", async () => {
    mockCtx.role = "staff";
    const res = (await POST(makeReq(validPayload()))) as unknown as MockResp;
    expect(res.status).toBe(403);
    expect((res.body as { error: string }).error).toBe("owner_only");
    expect(await GalleryItem.countDocuments({})).toBe(0);
  });

  it("rejects when verifyImageOwnership returns false", async () => {
    mockVerifyOwnership.mockResolvedValueOnce(false);
    const res = (await POST(makeReq(validPayload()))) as unknown as MockResp;
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("invalid_image_ownership");
    expect(await GalleryItem.countDocuments({})).toBe(0);
  });

  it("rejects a gif format with format_not_accepted", async () => {
    const res = (await POST(makeReq(validPayload({ format: "gif" })))) as unknown as MockResp;
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("format_not_accepted");
    expect(await GalleryItem.countDocuments({})).toBe(0);
  });

  it("rejects a pdf format with format_not_accepted", async () => {
    const res = (await POST(makeReq(validPayload({ format: "pdf" })))) as unknown as MockResp;
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("format_not_accepted");
  });

  it("rejects an svg format with format_not_accepted", async () => {
    const res = (await POST(makeReq(validPayload({ format: "svg" })))) as unknown as MockResp;
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("format_not_accepted");
  });

  it("rejects a file 1 byte over the 10 MB cap with file_too_large", async () => {
    const res = (await POST(
      makeReq(validPayload({ sizeBytes: PHOTO_SPEC.maxBytes + 1 }))
    )) as unknown as MockResp;
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("file_too_large");
    expect(await GalleryItem.countDocuments({})).toBe(0);
  });

  it("accepts a file exactly at the 10 MB cap", async () => {
    const res = (await POST(
      makeReq(validPayload({ sizeBytes: PHOTO_SPEC.maxBytes }))
    )) as unknown as MockResp;
    expect(res.status).toBe(201);
  });

  it("rejects 400×800 (short side 400 < 600) with dimension_too_small", async () => {
    const res = (await POST(
      makeReq(validPayload({ width: 400, height: 800 }))
    )) as unknown as MockResp;
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("dimension_too_small");
    expect(await GalleryItem.countDocuments({})).toBe(0);
  });

  it("rejects 300×300 with dimension_too_small", async () => {
    const res = (await POST(
      makeReq(validPayload({ width: 300, height: 300 }))
    )) as unknown as MockResp;
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("dimension_too_small");
  });

  it("accepts exactly 600×600", async () => {
    const res = (await POST(
      makeReq(validPayload({ width: 600, height: 600 }))
    )) as unknown as MockResp;
    expect(res.status).toBe(201);
  });

  it("tenant isolation: org B cannot see org A items after org A creates one", async () => {
    await POST(makeReq(validPayload()));

    const wsB = await Workspace.create({
      slug: "ws-b",
      name: "Workspace B",
      ownerUserId: "user_b",
      currency: "PHP",
    });
    const wsBId = wsB._id;

    const itemsForB = await GalleryItem.find({ workspaceId: wsBId }).lean();
    expect(itemsForB).toHaveLength(0);
  });
});

function validBody(extra: Record<string, unknown> = {}) {
  return {
    assetId: "img_col_test",
    url: "https://imagedelivery.net/hash/img_col_test/public",
    width: 1200, height: 900, format: "jpg", sizeBytes: 1000,
    ...extra,
  };
}

describe("POST /api/portfolio/gallery/items — collectionId", () => {
  it("creates the item inside a workspace-owned collection with the next order", async () => {
    const col = await GalleryCollection.create({
      workspaceId, name: "C", slug: `c-${Math.round(Math.random() * 1e9)}`, isPublic: true, order: 0,
    });
    await GalleryItem.create({
      workspaceId, collectionId: col._id, assetId: "img_existing",
      url: "https://imagedelivery.net/hash/img_existing/public", order: 0,
    });

    const req = new Request("http://t", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody({ collectionId: String(col._id) })),
    });
    const res = (await POST(req)) as unknown as MockResp;
    expect(res.status).toBe(201);

    const items = await GalleryItem.find({ workspaceId, collectionId: col._id }).sort({ order: 1 }).lean();
    expect(items).toHaveLength(2);
    expect(items[1].order).toBe(1);
  });

  it("rejects a collectionId from another workspace with 400", async () => {
    const otherWs = await Workspace.create({
      slug: "ws-z", name: "Z", ownerUserId: "user_z",
      currency: "PHP",
    });
    const foreign = await GalleryCollection.create({
      workspaceId: otherWs._id, name: "F", slug: `f-${Math.round(Math.random() * 1e9)}`, isPublic: true, order: 0,
    });
    const req = new Request("http://t", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody({ collectionId: String(foreign._id) })),
    });
    const res = (await POST(req)) as unknown as MockResp;
    expect(res.status).toBe(400);
    expect(await GalleryItem.countDocuments({ collectionId: foreign._id })).toBe(0);
  });

  it("still creates a standalone item (collectionId:null) when omitted", async () => {
    const req = new Request("http://t", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody()),
    });
    const res = (await POST(req)) as unknown as MockResp;
    expect(res.status).toBe(201);
    const item = await GalleryItem.findOne({ workspaceId }).lean();
    expect(item?.collectionId).toBeNull();
  });
});
