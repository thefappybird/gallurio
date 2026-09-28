import { beforeEach, describe, expect, it, vi } from "vitest";
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

const mockGalleryLinksBelongToWorkspace = vi.fn(async (_opts: unknown) => true);
const mockUpdateItemMeta = vi.fn(
  async (_opts: unknown): Promise<{ id: string; caption: string; altText: string } | null> => ({
    id: "item_1",
    caption: "Updated",
    altText: "",
  })
);
const mockPropagateItemAltText = vi.fn(async (_opts: unknown) => undefined);
vi.mock("@/lib/db/queries/gallery", () => ({
  galleryLinksBelongToWorkspace: (opts: unknown) => mockGalleryLinksBelongToWorkspace(opts),
  updateItemMeta: (opts: unknown) => mockUpdateItemMeta(opts),
  propagateItemAltText: (opts: unknown) => mockPropagateItemAltText(opts),
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

import { PATCH } from "./route";

function makeReq(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGalleryLinksBelongToWorkspace.mockResolvedValue(true);
  mockUpdateItemMeta.mockResolvedValue({ id: "item_1", caption: "Updated", altText: "" });
  mockPropagateItemAltText.mockResolvedValue(undefined);
  mockCtx = {
    userId: "user_owner",
    role: "owner",
    workspace: { _id: new Types.ObjectId(), slug: "studio-aurora" },
  };
});

describe("PATCH /api/portfolio/gallery/items/[id]", () => {
  it("updates metadata and returns 200 with the updated item", async () => {
    const res = (await PATCH(makeReq({ caption: "Updated" }), makeParams("item_1"))) as unknown as MockResp;
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: "item_1", caption: "Updated", altText: "" });
  });

  it("returns 500 gallery_item_update_failed when updateItemMeta throws, and logs it", async () => {
    mockUpdateItemMeta.mockRejectedValueOnce(new Error("boom"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = (await PATCH(makeReq({ caption: "Updated" }), makeParams("item_1"))) as unknown as MockResp;
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "gallery_item_update_failed" });
    expect(errSpy).toHaveBeenCalledWith("[gallery:items:patch]", expect.any(Error));
    errSpy.mockRestore();
  });
});
