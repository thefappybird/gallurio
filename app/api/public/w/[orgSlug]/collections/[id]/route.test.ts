import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

type MockResp = { body: unknown; status: number };
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, NextResponse: { json: (body: unknown, init?: ResponseInit): MockResp => ({ body, status: init?.status ?? 200 }) } };
});
vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { GalleryCollection, GalleryItem, Workspace } from "@/lib/db/models";
import { GET } from "./route";

function req(url: string) { return new Request(url); }
async function call(orgSlug: string, id: string, qs = "") {
  return (await GET(req(`http://localhost/api/public/w/${orgSlug}/collections/${id}${qs}`), { params: Promise.resolve({ orgSlug, id }) })) as unknown as MockResp;
}

let ws: { _id: Types.ObjectId; slug: string };
let publicCol: Types.ObjectId;

async function seed() {
  const w = await Workspace.create({ slug: "studio", name: "Studio", ownerUserId: "u",currency: "PHP", publicPage: { publishedAt: new Date() } });
  ws = { _id: w._id, slug: "studio" };
  const col = await GalleryCollection.create({ workspaceId: w._id, name: "Weddings", slug: "weddings", isPublic: true });
  publicCol = col._id;
  await GalleryItem.insertMany(Array.from({ length: 3 }, (_, i) => ({ workspaceId: w._id, collectionId: col._id, assetId: `p${i}`, url: "u", order: i })));
}

beforeAll(startInMemoryMongo); afterAll(stopInMemoryMongo);
beforeEach(async () => { await clearCollections(); await seed(); });

describe("GET /api/public/w/[orgSlug]/collections/[id]", () => {
  it("returns paginated items for a published workspace's public collection, plus total", async () => {
    const res = await call("studio", publicCol.toString(), "?limit=2");
    expect(res.status).toBe(200);
    const body = res.body as { items: { publicId: string; width: number; height: number }[]; nextCursor: string | null; total: number };
    expect(body.items.map((i) => i.publicId)).toEqual(["p0", "p1"]);
    expect(body.nextCursor).toBeTruthy();
    expect(body.total).toBe(3);
    // No dimensions recorded on the seeded items — required-non-null default.
    expect(body.items[0]).toMatchObject({ width: 1, height: 1 });
  });
  it("404 for an unpublished slug", async () => {
    await Workspace.updateOne({ _id: ws._id }, { $set: { "publicPage.publishedAt": null } });
    expect((await call("studio", publicCol.toString())).status).toBe(404);
  });
  it("404 for an unknown slug", async () => {
    expect((await call("nope", publicCol.toString())).status).toBe(404);
  });
  it("400 for an invalid id", async () => {
    expect((await call("studio", "not-an-id")).status).toBe(400);
  });
  it("tenant isolation: cannot read another workspace's collection via this slug", async () => {
    const other = await Workspace.create({ slug: "other", name: "O", ownerUserId: "u2",currency: "PHP", publicPage: { publishedAt: new Date() } });
    const colO = await GalleryCollection.create({ workspaceId: other._id, name: "X", slug: "x", isPublic: true });
    await GalleryItem.create({ workspaceId: other._id, collectionId: colO._id, assetId: "z", url: "u", order: 0 });
    const res = await call("studio", colO._id.toString());
    expect((res.body as { items: unknown[] }).items).toEqual([]);
  });
  it("private collection yields empty items", async () => {
    await GalleryCollection.updateOne({ _id: publicCol }, { $set: { isPublic: false } });
    const res = await call("studio", publicCol.toString());
    expect((res.body as { items: unknown[] }).items).toEqual([]);
  });
});
