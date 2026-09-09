import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

type MockResp = { body: unknown; status: number };

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    NextResponse: {
      json: (body: unknown, init?: ResponseInit): MockResp => ({ body, status: init?.status ?? 200 }),
    },
  };
});
vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

const mockRequireApiOrg = vi.fn();
vi.mock("@/lib/auth/apiOrgContext", () => ({ requireApiOrg: () => mockRequireApiOrg() }));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Booking, Client, Workspace } from "@/lib/db/models";
import { GET } from "./route";

beforeAll(startInMemoryMongo);
afterAll(stopInMemoryMongo);
beforeEach(async () => {
  await clearCollections();
  mockRequireApiOrg.mockReset();
});

async function workspace(slug: string, owner: string) {
  return Workspace.create({ slug, name: slug, ownerUserId: owner, currency: "PHP" });
}

describe("GET /api/portfolio/gallery/metadata-options", () => {
  it("returns only the active workspace's linkable bookings and clients", async () => {
    const own = await workspace("metadata-own", "owner-a");
    const foreign = await workspace("metadata-foreign", "owner-b");
    const ownClient = await Client.create({ workspaceId: own._id, name: "Ana Reyes", email: "ana@example.com" });
    const foreignClient = await Client.create({ workspaceId: foreign._id, name: "Foreign Client" });
    await Booking.create({
      workspaceId: own._id,
      clientId: ownClient._id,
      clientName: ownClient.name,
      title: "Sunset wedding",
      status: "completed",
      firstSessionStart: new Date("2026-09-02T10:00:00Z"),
      lastSessionEnd: new Date("2026-09-02T12:00:00Z"),
      sessions: [{ startAt: new Date("2026-09-02T10:00:00Z"), endAt: new Date("2026-09-02T12:00:00Z") }],
      location: { address: "Tagaytay" },
    });
    await Booking.create({
      workspaceId: foreign._id,
      clientId: foreignClient._id,
      clientName: foreignClient.name,
      title: "Foreign event",
      status: "completed",
      firstSessionStart: new Date("2026-09-03T10:00:00Z"),
      lastSessionEnd: new Date("2026-09-03T12:00:00Z"),
      sessions: [{ startAt: new Date("2026-09-03T10:00:00Z"), endAt: new Date("2026-09-03T12:00:00Z") }],
    });
    mockRequireApiOrg.mockResolvedValue({ ok: true, ctx: { role: "owner", workspace: { _id: own._id } } });

    const res = (await GET()) as unknown as MockResp;
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      bookings: [expect.objectContaining({
        title: "Sunset wedding",
        clientId: ownClient._id.toString(),
        clientName: "Ana Reyes",
        date: "2026-09-02",
        location: "Tagaytay",
      })],
      clients: [expect.objectContaining({ id: ownClient._id.toString(), name: "Ana Reyes" })],
    });
  });

  it("rejects staff", async () => {
    mockRequireApiOrg.mockResolvedValue({
      ok: true,
      ctx: { role: "staff", workspace: { _id: new Types.ObjectId() } },
    });
    const res = (await GET()) as unknown as MockResp;
    expect(res.status).toBe(403);
  });
});
