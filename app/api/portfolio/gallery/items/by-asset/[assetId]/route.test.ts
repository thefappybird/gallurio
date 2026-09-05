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

const mockRequireApiOrg = vi.fn();
vi.mock("@/lib/auth/apiOrgContext", () => ({
  requireApiOrg: () => mockRequireApiOrg(),
}));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryItem, Workspace } from "@/lib/db/models";
import { GET, PATCH } from "./route";

let workspaceId: Types.ObjectId;
let otherWorkspaceId: Types.ObjectId;

const makeParams = (assetId: string) => ({ params: Promise.resolve({ assetId }) });
const makeReq = (body?: unknown): Request => ({ json: async () => body ?? {} }) as unknown as Request;

function authAs(role: "owner" | "staff", ws: Types.ObjectId = workspaceId) {
  mockRequireApiOrg.mockResolvedValue({
    ok: true,
    ctx: {
      userId: "user_a",
      workspaceId: String(ws),
      role,
      workspace: { _id: ws, slug: "ws-by-asset" },
      userAvatarUrl: null,
    },
  });
}

async function seed(ws: Types.ObjectId, assetId: string, extra: Record<string, unknown> = {}) {
  return GalleryItem.create({
    workspaceId: ws,
    collectionId: new Types.ObjectId(),
    assetId,
    url: `https://imagedelivery.net/hash/${assetId}/public`,
    order: 0,
    ...extra,
  });
}

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  vi.clearAllMocks();
  await clearCollections();
  const ws = await Workspace.create({
    slug: "ws-by-asset",
    name: "Workspace By Asset",
    ownerUserId: "user_a",
    currency: "PHP",
  });
  workspaceId = ws._id;
  const other = await Workspace.create({
    slug: "ws-other",
    name: "Other Workspace",
    ownerUserId: "user_b",
    currency: "PHP",
  });
  otherWorkspaceId = other._id;
  authAs("owner");
});

describe("GET by-asset", () => {
  it("returns the photo's metadata for an owner", async () => {
    await seed(workspaceId, "asset_1", { title: "Ceremony", location: "Manila" });
    const res = (await GET(makeReq(), makeParams("asset_1"))) as unknown as MockResp;
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "Ceremony", location: "Manila", publicId: "asset_1" });
  });

  it("404s for an unknown asset", async () => {
    const res = (await GET(makeReq(), makeParams("missing"))) as unknown as MockResp;
    expect(res.status).toBe(404);
  });

  it("404s identically for another workspace's asset, leaking nothing", async () => {
    await seed(otherWorkspaceId, "foreign");
    const res = (await GET(makeReq(), makeParams("foreign"))) as unknown as MockResp;
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "not_found" });
  });

  it("rejects a non-owner", async () => {
    authAs("staff");
    await seed(workspaceId, "asset_1");
    const res = (await GET(makeReq(), makeParams("asset_1"))) as unknown as MockResp;
    expect(res.status).toBe(403);
  });

  it("returns the newest row when one asset backs several copies", async () => {
    await seed(workspaceId, "shared", { title: "older", createdAt: new Date("2020-01-01") });
    await seed(workspaceId, "shared", { title: "newer", createdAt: new Date("2030-01-01") });
    const res = (await GET(makeReq(), makeParams("shared"))) as unknown as MockResp;
    expect((res.body as { title: string }).title).toBe("newer");
  });
});

describe("PATCH by-asset", () => {
  it("writes the metadata and echoes it back", async () => {
    await seed(workspaceId, "asset_1");
    const res = (await PATCH(
      makeReq({ title: "First look", date: "2027-02-12" }),
      makeParams("asset_1")
    )) as unknown as MockResp;
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "First look", date: "2027-02-12", matched: 1 });
  });

  // The editor tells the owner these details update "every place this photo
  // appears". With copy semantics that is only true if every copy is written.
  it("writes EVERY copy of the asset, not just the representative", async () => {
    const a = await seed(workspaceId, "shared", { title: "old" });
    const b = await seed(workspaceId, "shared", { title: "old" });
    const res = (await PATCH(makeReq({ title: "renamed" }), makeParams("shared"))) as unknown as MockResp;
    expect((res.body as { matched: number }).matched).toBe(2);
    expect((await GalleryItem.findById(a._id))!.title).toBe("renamed");
    expect((await GalleryItem.findById(b._id))!.title).toBe("renamed");
  });

  it("never writes a copy belonging to another workspace", async () => {
    const mine = await seed(workspaceId, "shared", { title: "mine" });
    const theirs = await seed(otherWorkspaceId, "shared", { title: "theirs" });
    await PATCH(makeReq({ title: "renamed" }), makeParams("shared"));
    expect((await GalleryItem.findById(mine._id))!.title).toBe("renamed");
    expect((await GalleryItem.findById(theirs._id))!.title).toBe("theirs");
  });

  it("leaves unsent fields untouched", async () => {
    await seed(workspaceId, "asset_1", { title: "keep", location: "Manila" });
    await PATCH(makeReq({ location: "Cebu" }), makeParams("asset_1"));
    const doc = await GalleryItem.findOne({ assetId: "asset_1" });
    expect(doc!.title).toBe("keep");
    expect(doc!.location).toBe("Cebu");
  });

  it("rejects a malformed date rather than coercing it", async () => {
    await seed(workspaceId, "asset_1");
    const res = (await PATCH(makeReq({ date: "12 Feb 2027" }), makeParams("asset_1"))) as unknown as MockResp;
    expect(res.status).toBe(400);
  });

  it("accepts an empty date, which clears it", async () => {
    await seed(workspaceId, "asset_1", { date: "2027-02-12" });
    const res = (await PATCH(makeReq({ date: "" }), makeParams("asset_1"))) as unknown as MockResp;
    expect(res.status).toBe(200);
    expect((await GalleryItem.findOne({ assetId: "asset_1" }))!.date).toBe("");
  });

  it("rejects an empty body", async () => {
    await seed(workspaceId, "asset_1");
    const res = (await PATCH(makeReq({}), makeParams("asset_1"))) as unknown as MockResp;
    expect(res.status).toBe(400);
  });

  it("404s for an unknown asset", async () => {
    const res = (await PATCH(makeReq({ title: "x" }), makeParams("missing"))) as unknown as MockResp;
    expect(res.status).toBe(404);
  });

  it("rejects a non-owner", async () => {
    authAs("staff");
    await seed(workspaceId, "asset_1");
    const res = (await PATCH(makeReq({ title: "x" }), makeParams("asset_1"))) as unknown as MockResp;
    expect(res.status).toBe(403);
  });
});
