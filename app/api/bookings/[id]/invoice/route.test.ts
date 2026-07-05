import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Booking, Client } from "@/lib/db/models";

const workspaceId = new Types.ObjectId();
const otherWorkspaceId = new Types.ObjectId();
const userId = "user_test";

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: async () => undefined,
}));

vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: async () => ({
    userId,
    role: "owner",
    workspace: {
      _id: workspaceId,
      name: "Test Studio",
      logoUrl: "",
      contact: { email: "owner@studio.test", address: "123 Main St" },
      publicPage: { brandKit: { accentColor: "#2f5d56" } },
    },
  }),
}));

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
});

async function load() {
  return import("./route");
}

async function seedClient(wid: Types.ObjectId, overrides: Record<string, unknown> = {}) {
  return Client.create({
    workspaceId: wid,
    name: "Emma Carter",
    email: "emma@example.com",
    phone: "+639171234567",
    source: "manual",
    ...overrides,
  });
}

async function seedBooking(
  wid: Types.ObjectId,
  clientId: Types.ObjectId,
  overrides: Record<string, unknown> = {}
) {
  const start = new Date("2026-08-15T10:00:00Z");
  const end = new Date("2026-08-15T14:00:00Z");
  return Booking.create({
    workspaceId: wid,
    clientId,
    clientName: "Emma Carter",
    title: "Carter Wedding",
    eventType: "wedding",
    status: "completed",
    sessions: [{ startAt: start, endAt: end }],
    firstSessionStart: start,
    lastSessionEnd: end,
    location: { address: "Pier 27, Manila" },
    amount: { total: 75_000, deposit: 25_000, currency: "PHP" },
    ...overrides,
  });
}

function makeGet(id: string) {
  return new Request(`http://test/api/bookings/${id}/invoice`, { method: "GET" });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/bookings/[id]/invoice", () => {
  it("returns 400 for an invalid id", async () => {
    const { GET } = await load();
    const res = await GET(makeGet("not-an-id"), ctx("not-an-id"));
    expect(res.status).toBe(400);
  });

  it("returns 404 for a nonexistent booking", async () => {
    const { GET } = await load();
    const id = new Types.ObjectId().toString();
    const res = await GET(makeGet(id), ctx(id));
    expect(res.status).toBe(404);
  });

  it("returns 404 when the booking belongs to another workspace (tenant isolation)", async () => {
    const c = await seedClient(otherWorkspaceId);
    const b = await seedBooking(otherWorkspaceId, c._id);
    const { GET } = await load();
    const res = await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(404);
  });

  it("returns 400 when the booking status is not completed", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id, { status: "booked" });
    const { GET } = await load();
    const res = await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invoice_not_available");
  });

  it("returns a PDF for a completed booking with correct headers", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { GET } = await load();
    const res = await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe(
      `attachment; filename="invoice-${b._id}.pdf"`
    );
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("falls back to booking.clientName when the client doc is missing (hard-deleted)", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    await Client.deleteOne({ _id: c._id });
    const { GET } = await load();
    const res = await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });
});
