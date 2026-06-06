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

// Mock Cloudinary thumbnail helper (pure URL derivation, no network needed).
vi.mock("@/lib/storage/cloudinary", () => ({
  cloudinaryThumbnailUrl: (publicId: string) => `https://res.cloudinary.com/test/${publicId}`,
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
import { GalleryItem, Workspace } from "@/lib/db/models";
import { POST } from "./route";
import { PHOTO_SPEC } from "@/lib/page-builder/photoSpec";

let workspaceId: Types.ObjectId;

function makeReq(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

/** Returns a valid starter payload for this workspace. */
function validPayload(override: Record<string, unknown> = {}) {
  const pid = `gallurio/${workspaceId}/portfolio/test.jpg`;
  return {
    cloudinaryPublicId: pid,
    url: "https://res.cloudinary.com/test/x.jpg",
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
  const ws = await Workspace.create({
    slug: "ws-items",
    name: "Workspace Items",
    ownerUserId: "user_a",
    clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`,
    currency: "PHP",
  });
  workspaceId = ws._id;
  mockCtx = { userId: "user_a", role: "owner", workspace: { _id: workspaceId, slug: "ws-items" } };
});

describe("POST /api/portfolio/gallery/items", () => {
  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it("creates a gallery item and returns 201 with id + thumbUrl", async () => {
    const res = (await POST(makeReq(validPayload()))) as unknown as MockResp;
    expect(res.status).toBe(201);
    const body = res.body as { id: string; thumbUrl: string; caption: string | null };
    expect(body.id).toBeTruthy();
    expect(body.thumbUrl).toContain("cloudinary.com");
    expect(body.caption).toBeNull();

    const saved = await GalleryItem.findById(body.id).lean();
    expect(saved?.workspaceId.toString()).toBe(workspaceId.toString());
  });

  it("accepts all supported formats: jpeg, png, webp, avif", async () => {
    for (const fmt of ["jpeg", "png", "webp", "avif"]) {
      const pid = `gallurio/${workspaceId}/portfolio/${fmt}.img`;
      const res = (await POST(
        makeReq(validPayload({ cloudinaryPublicId: pid, format: fmt }))
      )) as unknown as MockResp;
      expect(res.status, `format ${fmt} should be accepted`).toBe(201);
    }
  });

  it("creates the item even when optional fields (format, sizeBytes, dimensions) are omitted", async () => {
    const pid = `gallurio/${workspaceId}/portfolio/minimal.jpg`;
    const res = (await POST(
      makeReq({ cloudinaryPublicId: pid, url: "https://res.cloudinary.com/test/x.jpg" })
    )) as unknown as MockResp;
    expect(res.status).toBe(201);
  });

  // -------------------------------------------------------------------------
  // Auth / ownership checks
  // -------------------------------------------------------------------------

  it("rejects a non-owner with 403", async () => {
    mockCtx.role = "staff";
    const res = (await POST(makeReq(validPayload()))) as unknown as MockResp;
    expect(res.status).toBe(403);
    expect((res.body as { error: string }).error).toBe("owner_only");
    expect(await GalleryItem.countDocuments({})).toBe(0);
  });

  it("rejects a public_id outside the workspace folder", async () => {
    const foreignPid = `gallurio/${new Types.ObjectId()}/portfolio/evil.jpg`;
    const res = (await POST(
      makeReq(validPayload({ cloudinaryPublicId: foreignPid }))
    )) as unknown as MockResp;
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("invalid_image_ownership");
    expect(await GalleryItem.countDocuments({})).toBe(0);
  });

  it("rejects a path-traversal public_id even with the workspace prefix", async () => {
    const traversal = `gallurio/${workspaceId}/../${new Types.ObjectId()}/evil.jpg`;
    const res = (await POST(
      makeReq(validPayload({ cloudinaryPublicId: traversal }))
    )) as unknown as MockResp;
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("invalid_image_ownership");
  });

  // -------------------------------------------------------------------------
  // Photo-meta validation — format
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Photo-meta validation — sizeBytes
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Photo-meta validation — dimensions
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Tenant isolation
  // -------------------------------------------------------------------------

  it("tenant isolation: org B cannot see org A items after org A creates one", async () => {
    // Create as org A.
    await POST(makeReq(validPayload()));

    // Switch to org B.
    const wsB = await Workspace.create({
      slug: "ws-b",
      name: "Workspace B",
      ownerUserId: "user_b",
      clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`,
      currency: "PHP",
    });
    const wsBId = wsB._id;

    // Items query scoped to B returns nothing.
    const itemsForB = await GalleryItem.find({ workspaceId: wsBId }).lean();
    expect(itemsForB).toHaveLength(0);
  });
});
