import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Booking, ActivityLog, Client } from "@/lib/db/models";

const workspaceId = new Types.ObjectId();
const otherWorkspaceId = new Types.ObjectId();
const userId = "user_test";

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: async () => undefined,
}));

vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: async () => ({
    userId,
    clerkOrgId: "org_test",
    role: "owner",
    workspace: { _id: workspaceId, currency: "PHP", name: "Test", slug: "t" },
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
    source: "manual",
    bookingsCount: 0,
    totalSpent: 0,
    ...overrides,
  });
}

async function seedBooking(
  wid: Types.ObjectId,
  clientId: Types.ObjectId,
  overrides: Record<string, unknown> = {}
) {
  const defaultStart = new Date("2026-08-15T10:00:00Z");
  return Booking.create({
    workspaceId: wid,
    clientId,
    clientName: "Emma Carter",
    title: "Carter Wedding",
    status: "booked",
    sessions: [{ startAt: defaultStart, endAt: defaultStart }],
    firstSessionStart: defaultStart,
    lastSessionEnd: defaultStart,
    amount: { total: 75_000, deposit: 25_000, currency: "PHP" },
    ...overrides,
  });
}

function makePatch(body: unknown, id: string) {
  return new Request(`http://test/api/bookings/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGet(id: string) {
  return new Request(`http://test/api/bookings/${id}`, { method: "GET" });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/bookings/[id]", () => {
  it("returns the booking when workspaceId matches", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { GET } = await load();
    const res = await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.title).toBe("Carter Wedding");
  });

  it("returns 404 when the booking belongs to another workspace (tenant isolation)", async () => {
    const c = await seedClient(otherWorkspaceId);
    const b = await seedBooking(otherWorkspaceId, c._id);
    const { GET } = await load();
    const res = await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(404);
  });

  it("returns 400 for an invalid id", async () => {
    const { GET } = await load();
    const res = await GET(makeGet("not-an-id"), ctx("not-an-id"));
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/bookings/[id]", () => {
  it("applies a single-field patch and writes one activity entry", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ title: "Renamed" }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.title).toBe("Renamed");

    const log = await ActivityLog.findOne({ workspaceId, entity: "booking" }).lean();
    expect(log?.action).toBe("updated");
    const diff = log?.diff as { changes?: Record<string, { before: unknown; after: unknown }> };
    expect(diff?.changes?.title).toEqual({ before: "Carter Wedding", after: "Renamed" });
  });

  it("applies a multi-field patch and writes ONE activity entry with all changes", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch(
        { title: "Renamed", "amount.total": 50_000, notes: "Updated" },
        b._id.toString()
      ),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);

    const logs = await ActivityLog.find({ workspaceId, entity: "booking" }).lean();
    expect(logs).toHaveLength(1);
    const diff = logs[0].diff as { changes?: Record<string, unknown> };
    expect(Object.keys(diff.changes ?? {}).sort()).toEqual([
      "amount.total",
      "notes",
      "title",
    ]);
  });

  it("logs action='status_changed' when status is in the patch", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { PATCH } = await load();
    await PATCH(
      makePatch({ status: "cancelled" }, b._id.toString()),
      ctx(b._id.toString())
    );
    const log = await ActivityLog.findOne({ workspaceId, entity: "booking" }).lean();
    expect(log?.action).toBe("status_changed");
  });

  it("rejects unknown keys with 400 (strict allowlist)", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ workspaceId: "leak" }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(400);
  });

  it("rejects an empty body with 400", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { PATCH } = await load();
    const res = await PATCH(makePatch({}, b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(400);
  });

  it("returns 404 when patching a booking from another workspace", async () => {
    const c = await seedClient(otherWorkspaceId);
    const b = await seedBooking(otherWorkspaceId, c._id);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ title: "Hacked" }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(404);
    const fresh = await Booking.findById(b._id).lean();
    expect(fresh?.title).toBe("Carter Wedding");
  });

  it("skips identical values and does not write an activity log", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { PATCH } = await load();
    await PATCH(
      makePatch({ title: "Carter Wedding" }, b._id.toString()),
      ctx(b._id.toString())
    );
    const logs = await ActivityLog.find({ workspaceId, entity: "booking" }).lean();
    expect(logs).toHaveLength(0);
  });
});

describe("PATCH /api/bookings/[id] — location pin (lat/lng)", () => {
  it("persists address + lat + lng but logs only the address in the activity diff", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch(
        { "location.address": "Pier 27, Manila", "location.lat": 14.6, "location.lng": 120.98 },
        b._id.toString()
      ),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);

    const fresh = await Booking.findById(b._id).lean();
    expect(fresh?.location?.address).toBe("Pier 27, Manila");
    expect(fresh?.location?.lat).toBe(14.6);
    expect(fresh?.location?.lng).toBe(120.98);

    const logs = await ActivityLog.find({ workspaceId, entity: "booking" }).lean();
    expect(logs).toHaveLength(1);
    const changes = (logs[0].diff as { changes?: Record<string, unknown> }).changes ?? {};
    expect(changes).toHaveProperty("location.address");
    expect(changes).not.toHaveProperty("location.lat");
    expect(changes).not.toHaveProperty("location.lng");
  });

  it("persists a coordinate-only nudge WITHOUT writing an activity entry", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ "location.lat": 1.23, "location.lng": 4.56 }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);

    const fresh = await Booking.findById(b._id).lean();
    expect(fresh?.location?.lat).toBe(1.23);
    expect(fresh?.location?.lng).toBe(4.56);

    const logs = await ActivityLog.find({ workspaceId, entity: "booking" }).lean();
    expect(logs).toHaveLength(0);
  });

  it("rejects an out-of-range latitude with 400", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ "location.lat": 200 }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/bookings/[id] — client reassignment", () => {
  it("single-session: PATCH with new clientId updates booking and logs client_changed", async () => {
    const oldClient = await seedClient(workspaceId, {
      name: "Emma Carter",
      email: "emma@example.com",
      bookingsCount: 1,
      totalSpent: 25_000,
    });
    const newClient = await seedClient(workspaceId, {
      name: "Liam Carter",
      email: "liam@example.com",
      bookingsCount: 0,
      totalSpent: 0,
    });
    const b = await seedBooking(workspaceId, oldClient._id);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ clientId: newClient._id.toString() }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.clientId.toString()).toBe(newClient._id.toString());
    expect(json.clientName).toBe("Liam Carter");

    const log = await ActivityLog.findOne({ workspaceId, entity: "booking" }).lean();
    expect(log?.action).toBe("client_changed");
    const meta = log?.meta as { from: string; to: string } | null;
    expect(meta?.from).toBe(oldClient._id.toString());
    expect(meta?.to).toBe(newClient._id.toString());
  });

  it("single-session: client transaction stats reconciled on reassignment", async () => {
    const { Transaction } = await import("@/lib/db/models");
    const oldClient = await seedClient(workspaceId, {
      name: "Emma Carter",
      bookingsCount: 1,
      totalSpent: 25_000,
    });
    const newClient = await seedClient(workspaceId, {
      name: "Liam Carter",
      bookingsCount: 0,
      totalSpent: 0,
    });
    // Seed a Transaction doc for the old client.
    const defaultStart = new Date("2026-08-15T10:00:00Z");
    const b = await seedBooking(workspaceId, oldClient._id);
    await Transaction.create({
      workspaceId,
      bookingId: b._id,
      clientId: oldClient._id,
      amount: 25_000,
      currency: "PHP",
      type: "deposit",
      method: "other",
      paidAt: defaultStart,
    });

    const { PATCH } = await load();
    await PATCH(
      makePatch({ clientId: newClient._id.toString() }, b._id.toString()),
      ctx(b._id.toString())
    );

    const updatedOld = await Client.findById(oldClient._id).lean();
    expect(updatedOld?.totalSpent).toBe(0);
    expect(updatedOld?.bookingsCount).toBe(0);

    const updatedNew = await Client.findById(newClient._id).lean();
    expect(updatedNew?.totalSpent).toBe(25_000);
    expect(updatedNew?.bookingsCount).toBe(1);

    // Transaction doc must be re-assigned to new client.
    const tx = await Transaction.findOne({ bookingId: b._id }).lean();
    expect(tx?.clientId?.toString()).toBe(newClient._id.toString());
  });

  it("multi-session: PATCH with clientId returns 422", async () => {
    const oldClient = await seedClient(workspaceId);
    const newClient = await seedClient(workspaceId, { name: "Other Client" });
    const s1 = new Date("2026-08-15T10:00:00Z");
    const s2 = new Date("2026-08-22T10:00:00Z");
    const b = await seedBooking(workspaceId, oldClient._id, {
      sessions: [
        { startAt: s1, endAt: s1 },
        { startAt: s2, endAt: s2 },
      ],
      firstSessionStart: s1,
      lastSessionEnd: s2,
    });
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ clientId: newClient._id.toString() }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toMatch(/multi-session/i);
  });

  it("tenant isolation: rejects clientId from another workspace with 404", async () => {
    const myClient = await seedClient(workspaceId);
    const otherClient = await seedClient(otherWorkspaceId, { name: "Other WS Client" });
    const b = await seedBooking(workspaceId, myClient._id);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ clientId: otherClient._id.toString() }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(404);
    // Booking's clientId must be unchanged.
    const fresh = await Booking.findById(b._id).lean();
    expect(fresh?.clientId.toString()).toBe(myClient._id.toString());
  });

  it("concurrent clientId + amount.deposit change: new client receives the updated deposit, not the stale one", async () => {
    // Booking starts with deposit=25_000. PATCH changes it to 40_000 AND
    // reassigns to a new client in the same request. The new client must be
    // credited with 40_000, not the pre-patch 25_000.
    const { Transaction } = await import("@/lib/db/models");
    const oldClient = await seedClient(workspaceId, {
      name: "Emma Carter",
      bookingsCount: 1,
      totalSpent: 25_000,
    });
    const newClient = await seedClient(workspaceId, {
      name: "Liam Carter",
      email: "liam@example.com",
      bookingsCount: 0,
      totalSpent: 0,
    });
    const defaultStart = new Date("2026-08-15T10:00:00Z");
    const b = await seedBooking(workspaceId, oldClient._id);
    await Transaction.create({
      workspaceId,
      bookingId: b._id,
      clientId: oldClient._id,
      amount: 25_000,
      currency: "PHP",
      type: "deposit",
      method: "other",
      paidAt: defaultStart,
    });

    const { PATCH } = await load();
    const res = await PATCH(
      makePatch(
        { clientId: newClient._id.toString(), "amount.deposit": 40_000 },
        b._id.toString()
      ),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);

    // Old client: stats zeroed out.
    const updatedOld = await Client.findById(oldClient._id).lean();
    expect(updatedOld?.totalSpent).toBe(0);
    expect(updatedOld?.bookingsCount).toBe(0);

    // New client: must reflect the NEW deposit (40_000), not the stale 25_000.
    const updatedNew = await Client.findById(newClient._id).lean();
    expect(updatedNew?.bookingsCount).toBe(1);
    expect(updatedNew?.totalSpent).toBe(40_000);

    // Transaction doc re-assigned to new client with updated amount.
    const tx = await Transaction.findOne({ bookingId: b._id }).lean();
    expect(tx?.clientId?.toString()).toBe(newClient._id.toString());
    expect(tx?.amount).toBe(40_000);
  });

  it("concurrent clientId + sessions change: new client gets the updated firstSessionStart", async () => {
    const oldClient = await seedClient(workspaceId, {
      name: "Emma Carter",
      bookingsCount: 1,
      totalSpent: 25_000,
    });
    const newClient = await seedClient(workspaceId, {
      name: "Liam Carter",
      email: "liam@example.com",
      bookingsCount: 0,
      totalSpent: 0,
    });
    const b = await seedBooking(workspaceId, oldClient._id);
    const { PATCH } = await load();

    // Move the session date forward by one month in the same PATCH as client change.
    const newStart = new Date("2026-09-20T10:00:00Z");
    const res = await PATCH(
      makePatch(
        {
          clientId: newClient._id.toString(),
          sessions: [{ startAt: newStart.toISOString(), endAt: newStart.toISOString() }],
        },
        b._id.toString()
      ),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    // Booking must carry the updated session bounds.
    expect(new Date(json.firstSessionStart).toISOString()).toBe(newStart.toISOString());
    // New client owns the booking.
    expect(json.clientId.toString()).toBe(newClient._id.toString());
  });
});
