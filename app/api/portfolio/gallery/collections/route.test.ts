import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { PHOTO_SPEC } from "@/lib/page-builder/photoSpec";

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
}));

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
import { POST } from "./route";

let workspaceId: Types.ObjectId;

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
  mockVerifyOwnership.mockReset();
  mockVerifyOwnership.mockResolvedValue(true);
  const ws = await Workspace.create({
    slug: "ws-a",
    name: "Workspace A",
    ownerUserId: "user_a",
    currency: "PHP",
  });
  workspaceId = ws._id;
  mockCtx = { userId: "user_a", role: "owner", workspace: { _id: workspaceId, slug: "ws-a" } };
});

describe("POST /api/portfolio/gallery/collections", () => {
  it("creates a collection with starter items and sets the first as cover", async () => {
    const res = (await POST(
      makeReq({
        name: "Weddings 2024",
        items: [{ assetId: "img_abc", url: "https://imagedelivery.net/hash/img_abc/public", width: 1200, height: 800 }],
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

  it("rejects items when verifyImageOwnership returns false", async () => {
    mockVerifyOwnership.mockResolvedValueOnce(false);
    const res = (await POST(
      makeReq({ name: "Sneaky", items: [{ assetId: "foreign_img", url: "https://imagedelivery.net/hash/foreign_img/public" }] })
    )) as unknown as MockResp;
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("invalid_image_ownership");
    expect(await GalleryCollection.countDocuments({})).toBe(0);
  });

  it("appends a suffix when the derived slug collides within the workspace", async () => {
    await GalleryCollection.create({ workspaceId, name: "Dup", slug: "dup", isPublic: true, order: 0 });
    const res = (await POST(makeReq({ name: "Dup" }))) as unknown as MockResp;
    expect(res.status).toBe(201);
    expect((res.body as { slug: string }).slug).not.toBe("dup");
  });

  it("rejects starter items with an invalid format (gif) — format_not_accepted", async () => {
    const res = (await POST(
      makeReq({
        name: "Bad Format",
        items: [{ assetId: "img_gif", url: "https://imagedelivery.net/hash/img_gif/public", format: "gif", width: 1200, height: 800 }],
      })
    )) as unknown as MockResp;
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("format_not_accepted");
    expect(await GalleryCollection.countDocuments({})).toBe(0);
  });

  it("rejects a pdf format among starter items", async () => {
    const res = (await POST(
      makeReq({
        name: "PDF Upload",
        items: [{ assetId: "img_pdf", url: "https://imagedelivery.net/hash/img_pdf/public", format: "pdf" }],
      })
    )) as unknown as MockResp;
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("format_not_accepted");
    expect(await GalleryCollection.countDocuments({})).toBe(0);
  });

  it("rejects when the second item among several has an invalid format", async () => {
    const res = (await POST(
      makeReq({
        name: "Mixed Formats",
        items: [
          { assetId: "img_ok", url: "https://imagedelivery.net/hash/img_ok/public", format: "jpg", width: 1200, height: 800 },
          { assetId: "img_bad", url: "https://imagedelivery.net/hash/img_bad/public", format: "gif", width: 1200, height: 800 },
        ],
      })
    )) as unknown as MockResp;
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("format_not_accepted");
    expect(await GalleryCollection.countDocuments({})).toBe(0);
    expect(await GalleryItem.countDocuments({})).toBe(0);
  });

  it("rejects a starter item over the 10 MB cap — file_too_large", async () => {
    const res = (await POST(
      makeReq({
        name: "Big File",
        items: [{ assetId: "img_huge", url: "https://imagedelivery.net/hash/img_huge/public", format: "jpg", sizeBytes: PHOTO_SPEC.maxBytes + 1, width: 1200, height: 800 }],
      })
    )) as unknown as MockResp;
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("file_too_large");
    expect(await GalleryCollection.countDocuments({})).toBe(0);
  });

  it("accepts a starter item exactly at the 10 MB cap", async () => {
    const res = (await POST(
      makeReq({
        name: "Max Size",
        items: [{ assetId: "img_max", url: "https://imagedelivery.net/hash/img_max/public", format: "jpg", sizeBytes: PHOTO_SPEC.maxBytes, width: 1200, height: 800 }],
      })
    )) as unknown as MockResp;
    expect(res.status).toBe(201);
  });

  it("rejects a starter item with short side < 600 — dimension_too_small", async () => {
    const res = (await POST(
      makeReq({
        name: "Small Image",
        items: [{ assetId: "img_small", url: "https://imagedelivery.net/hash/img_small/public", format: "jpg", width: 400, height: 800 }],
      })
    )) as unknown as MockResp;
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("dimension_too_small");
    expect(await GalleryCollection.countDocuments({})).toBe(0);
  });

  it("accepts a starter item with dimensions exactly 600×600", async () => {
    const res = (await POST(
      makeReq({
        name: "Min Dim",
        items: [{ assetId: "img_mindim", url: "https://imagedelivery.net/hash/img_mindim/public", format: "jpg", width: 600, height: 600 }],
      })
    )) as unknown as MockResp;
    expect(res.status).toBe(201);
  });
});
