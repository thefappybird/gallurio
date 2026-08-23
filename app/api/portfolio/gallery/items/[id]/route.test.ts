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
const mockRequireApiOrg = vi.fn();
vi.mock("@/lib/auth/apiOrgContext", () => ({
  requireApiOrg: () => mockRequireApiOrg(),
}));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryItem, Workspace } from "@/lib/db/models";
import { PATCH } from "./route";

let workspaceId: Types.ObjectId;
let itemId: Types.ObjectId;

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}
function makeReq(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}
function authOk() {
  mockRequireApiOrg.mockResolvedValue({
    ok: true,
    ctx: {
      userId: mockCtx.userId,
      workspaceId: String(mockCtx.workspace._id),
      role: mockCtx.role,
      workspace: mockCtx.workspace,
      userAvatarUrl: null,
    },
  });
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
    slug: "ws-item-meta",
    name: "Workspace Item Meta",
    ownerUserId: "user_a",
    currency: "PHP",
  });
  workspaceId = ws._id;
  const item = await GalleryItem.create({
    workspaceId,
    assetId: "img_meta",
    url: "https://imagedelivery.net/hash/img_meta/public",
    caption: "Original caption",
    altText: "Original alt",
    order: 0,
  });
  itemId = item._id;
  mockCtx = { userId: "user_a", role: "owner", workspace: { _id: workspaceId, slug: "ws-item-meta" } };
  authOk();
});

describe("PATCH /api/portfolio/gallery/items/[id]", () => {
  it("returns the auth response when unauthenticated", async () => {
    mockRequireApiOrg.mockResolvedValueOnce({
      ok: false,
      response: { body: { error: "not_authenticated" }, status: 401 },
    });
    const res = (await PATCH(makeReq({ altText: "x" }), makeParams(itemId.toString()))) as unknown as MockResp;
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "not_authenticated" });
  });

  it("rejects a non-owner with 403", async () => {
    mockCtx.role = "staff";
    authOk();
    const res = (await PATCH(makeReq({ altText: "x" }), makeParams(itemId.toString()))) as unknown as MockResp;
    expect(res.status).toBe(403);
    expect((res.body as { error: string }).error).toBe("owner_only");
  });

  it("returns 404 for an item belonging to another workspace (tenant isolation)", async () => {
    const otherWs = await Workspace.create({
      slug: "ws-item-meta-b",
      name: "B",
      ownerUserId: "user_b",
      currency: "PHP",
    });
    const foreignItem = await GalleryItem.create({
      workspaceId: otherWs._id,
      assetId: "img_foreign",
      url: "https://imagedelivery.net/hash/img_foreign/public",
      order: 0,
    });
    const res = (await PATCH(
      makeReq({ altText: "x" }),
      makeParams(foreignItem._id.toString())
    )) as unknown as MockResp;
    expect(res.status).toBe(404);
    expect((res.body as { error: string }).error).toBe("not_found");
  });

  it("returns 404 for a missing item", async () => {
    const res = (await PATCH(
      makeReq({ altText: "x" }),
      makeParams(new Types.ObjectId().toString())
    )) as unknown as MockResp;
    expect(res.status).toBe(404);
    expect((res.body as { error: string }).error).toBe("not_found");
  });

  it("returns 404 for a malformed id", async () => {
    const res = (await PATCH(makeReq({ altText: "x" }), makeParams("not-an-id"))) as unknown as MockResp;
    expect(res.status).toBe(404);
    expect((res.body as { error: string }).error).toBe("not_found");
  });

  it("rejects an empty body with 400", async () => {
    const res = (await PATCH(makeReq({}), makeParams(itemId.toString()))) as unknown as MockResp;
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("invalid_input");
  });

  it("rejects altText over 300 chars with 400", async () => {
    const res = (await PATCH(
      makeReq({ altText: "a".repeat(301) }),
      makeParams(itemId.toString())
    )) as unknown as MockResp;
    expect(res.status).toBe(400);
  });

  it("sets altText and returns the updated PickerItem", async () => {
    const res = (await PATCH(
      makeReq({ altText: "A bride and groom at sunset" }),
      makeParams(itemId.toString())
    )) as unknown as MockResp;
    expect(res.status).toBe(200);
    const body = res.body as { id: string; publicId: string; thumbUrl: string; caption: string | null; altText: string | null };
    expect(body.id).toBe(itemId.toString());
    expect(body.publicId).toBe("img_meta");
    expect(body.altText).toBe("A bride and groom at sunset");

    const saved = await GalleryItem.findById(itemId).lean();
    expect(saved?.altText).toBe("A bride and groom at sunset");
  });

  it("sending only caption leaves an existing altText untouched", async () => {
    const res = (await PATCH(
      makeReq({ caption: "New caption" }),
      makeParams(itemId.toString())
    )) as unknown as MockResp;
    expect(res.status).toBe(200);
    const body = res.body as { caption: string | null; altText: string | null };
    expect(body.caption).toBe("New caption");
    expect(body.altText).toBe("Original alt");

    const saved = await GalleryItem.findById(itemId).lean();
    expect(saved?.altText).toBe("Original alt");
    expect(saved?.caption).toBe("New caption");
  });

  it("sending only altText leaves an existing caption untouched", async () => {
    const res = (await PATCH(
      makeReq({ altText: "New alt" }),
      makeParams(itemId.toString())
    )) as unknown as MockResp;
    expect(res.status).toBe(200);
    const body = res.body as { caption: string | null; altText: string | null };
    expect(body.altText).toBe("New alt");
    expect(body.caption).toBe("Original caption");

    const saved = await GalleryItem.findById(itemId).lean();
    expect(saved?.caption).toBe("Original caption");
    expect(saved?.altText).toBe("New alt");
  });

  it("propagates a changed altText to the item's entry on the published home page", async () => {
    await Workspace.updateOne(
      { _id: workspaceId },
      {
        $set: {
          "publicPage.data.home": {
            content: [
              {
                type: "GalleryGrid",
                props: {
                  id: "g1",
                  images: [{ id: itemId.toString(), publicId: "img_meta", alt: "Original alt" }],
                  columns: 3,
                  gap: "normal",
                },
              },
            ],
          },
        },
      }
    );

    const res = (await PATCH(
      makeReq({ altText: "Updated live alt" }),
      makeParams(itemId.toString())
    )) as unknown as MockResp;
    expect(res.status).toBe(200);

    const ws = await Workspace.findById(workspaceId).lean();
    const home = ws!.publicPage!.data!.home as { content: Array<{ props: { images: Array<{ id: string; alt: string }> } }> };
    expect(home.content[0].props.images[0].alt).toBe("Updated live alt");
  });

  it("does not propagate when only caption changes (altText untouched, no page write needed)", async () => {
    await Workspace.updateOne(
      { _id: workspaceId },
      {
        $set: {
          "publicPage.data.home": {
            content: [
              { type: "GalleryGrid", props: { id: "g1", images: [{ id: itemId.toString(), publicId: "img_meta", alt: "Original alt" }], columns: 3, gap: "normal" } },
            ],
          },
        },
      }
    );

    const res = (await PATCH(makeReq({ caption: "New caption only" }), makeParams(itemId.toString()))) as unknown as MockResp;
    expect(res.status).toBe(200);

    const ws = await Workspace.findById(workspaceId).lean();
    const home = ws!.publicPage!.data!.home as { content: Array<{ props: { images: Array<{ id: string; alt: string }> } }> };
    expect(home.content[0].props.images[0].alt).toBe("Original alt");
  });

  it("still returns 200 with the updated item when alt propagation throws", async () => {
    const gallery = await import("@/lib/db/queries/gallery");
    const propSpy = vi.spyOn(gallery, "propagateItemAltText").mockRejectedValueOnce(new Error("boom"));

    const res = (await PATCH(
      makeReq({ altText: "Alt that fails to propagate" }),
      makeParams(itemId.toString())
    )) as unknown as MockResp;

    expect(res.status).toBe(200);
    expect((res.body as { altText: string | null }).altText).toBe("Alt that fails to propagate");

    const saved = await GalleryItem.findById(itemId).lean();
    expect(saved?.altText).toBe("Alt that fails to propagate");

    propSpy.mockRestore();
  });
});
