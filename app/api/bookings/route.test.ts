import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Booking, Client, ActivityLog, Transaction, Team, TEAM_COLOR_PALETTE } from "@/lib/db/models";

const workspaceId = new Types.ObjectId();
const userId = "user_test";
const teamId = new Types.ObjectId();

// Mutable auth holder so individual tests can flip role/memberships to exercise
// the team write-permission wiring (defaults reset in beforeEach).
const auth = vi.hoisted(() => ({
  role: "owner" as "owner" | "staff",
  memberships: [] as { teamId: string; role: "member" | "lead" }[],
}));

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: async () => undefined,
}));

vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: async () => ({
    userId,
    role: auth.role,
    workspace: { _id: workspaceId, currency: "PHP", name: "Test", slug: "t", timezone: "UTC" },
  }),
}));

vi.mock("@/lib/auth/teamContext", () => ({
  getTeamsForUser: async () => auth.memberships,
}));

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
  auth.role = "owner";
  auth.memberships = [];
  // An active team must exist for new bookings to attach to.
  await Team.create({
    _id: teamId,
    workspaceId,
    name: "Main",
    color: TEAM_COLOR_PALETTE[0],
    isDefault: true,
    isActive: true,
    memberCount: 0,
    createdByWorkosUserId: userId,
  });
});

async function load() {
  return import("./route");
}

function makeBody(overrides: Record<string, unknown> = {}) {
  return {
    client: { mode: "new", name: "Emma Carter", email: "emma@example.com" },
    teamId: String(teamId),
    title: "Carter Wedding",
    eventType: "wedding",
    status: "booked",
    sessions: [
      {
        startAt: new Date("2026-08-15T10:00:00Z").toISOString(),
        endAt: new Date("2026-08-15T18:00:00Z").toISOString(),
      },
    ],
    location: { address: "100 Ayala Ave" },
    amount: { total: 75_000, deposit: 25_000, currency: "PHP" },
    notes: "",
    ...overrides,
  };
}

function makeReq(body: unknown) {
  return new Request("http://test/api/bookings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/bookings", () => {
  it("creates a booking + a client + an activity log on a new-client payload", async () => {
    const { POST } = await load();
    const res = await POST(makeReq(makeBody()));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(typeof json.id).toBe("string");

    const booking = await Booking.findOne({ workspaceId }).lean();
    expect(booking?.title).toBe("Carter Wedding");
    expect(booking?.clientName).toBe("Emma Carter");
    expect(booking?.amount?.currency).toBe("PHP");

    const client = await Client.findOne({ workspaceId }).lean();
    expect(client?.email).toBe("emma@example.com");

    const log = await ActivityLog.findOne({ workspaceId, entity: "booking" }).lean();
    expect(log?.action).toBe("created");
  });

  it("persists the teamId on the created booking", async () => {
    const { POST } = await load();
    const res = await POST(makeReq(makeBody()));
    expect(res.status).toBe(201);
    const booking = await Booking.findOne({ workspaceId }).lean();
    expect(String(booking?.teamId)).toBe(String(teamId));
  });

  it("returns 404 when the teamId is not a team in this workspace", async () => {
    const { POST } = await load();
    const res = await POST(makeReq(makeBody({ teamId: String(new Types.ObjectId()) })));
    expect(res.status).toBe(404);
    expect(await Booking.countDocuments({ workspaceId })).toBe(0);
  });

  it("returns 400 when the target team is deactivated (no new work on dead teams)", async () => {
    await Team.updateOne({ _id: teamId }, { $set: { isActive: false, deactivatedAt: new Date() } });
    const { POST } = await load();
    const res = await POST(makeReq(makeBody()));
    expect(res.status).toBe(400);
    expect(await Booking.countDocuments({ workspaceId })).toBe(0);
  });

  it("treats a legacy team with a MISSING isActive field as active (not deactivated)", async () => {
    // Teams created before Phase 4 have no isActive field; a .lean() read returns
    // undefined, which must NOT be treated as deactivated.
    await Team.updateOne({ _id: teamId }, { $unset: { isActive: "" } });
    const { POST } = await load();
    const res = await POST(makeReq(makeBody()));
    expect(res.status).toBe(201);
    expect(String((await Booking.findOne({ workspaceId }).lean())?.teamId)).toBe(String(teamId));
  });

  it("forbids a non-owner who is only a member of the team (view-only)", async () => {
    auth.role = "staff";
    auth.memberships = [{ teamId: String(teamId), role: "member" }];
    const { POST } = await load();
    const res = await POST(makeReq(makeBody()));
    expect(res.status).toBe(403);
    expect(await Booking.countDocuments({ workspaceId })).toBe(0);
  });

  it("allows a non-owner who is a LEAD of the target active team", async () => {
    auth.role = "staff";
    auth.memberships = [{ teamId: String(teamId), role: "lead" }];
    const { POST } = await load();
    const res = await POST(makeReq(makeBody()));
    expect(res.status).toBe(201);
    expect(await Booking.countDocuments({ workspaceId })).toBe(1);
  });

  it("persists location lat/lng when provided", async () => {
    const { POST } = await load();
    const res = await POST(
      makeReq(
        makeBody({ location: { address: "Pier 27, Manila", lat: 14.5995, lng: 120.9842 } })
      )
    );
    expect(res.status).toBe(201);
    const booking = await Booking.findOne({ workspaceId }).lean();
    expect(booking?.location?.address).toBe("Pier 27, Manila");
    expect(booking?.location?.lat).toBe(14.5995);
    expect(booking?.location?.lng).toBe(120.9842);
  });

  it("defaults location lat/lng to null when only an address is given", async () => {
    const { POST } = await load();
    const res = await POST(makeReq(makeBody({ location: { address: "No coords" } })));
    expect(res.status).toBe(201);
    const booking = await Booking.findOne({ workspaceId }).lean();
    expect(booking?.location?.lat ?? null).toBeNull();
    expect(booking?.location?.lng ?? null).toBeNull();
  });

  it("returns 400 on an out-of-range latitude", async () => {
    const { POST } = await load();
    const res = await POST(
      makeReq(makeBody({ location: { address: "x", lat: 200, lng: 0 } }))
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 on missing required field", async () => {
    const { POST } = await load();
    const res = await POST(makeReq(makeBody({ title: "" })));
    expect(res.status).toBe(400);
  });

  it("returns 400 when deposit exceeds total (Zod refine)", async () => {
    const { POST } = await load();
    const res = await POST(
      makeReq(makeBody({ amount: { total: 1000, deposit: 9999, currency: "PHP" } }))
    );
    expect(res.status).toBe(400);
  });

  it("reuses an existing client when mode='existing' and ownership matches", async () => {
    const existing = await Client.create({
      workspaceId,
      name: "Priya Shah",
      email: "priya@example.com",
    });
    const { POST } = await load();
    const res = await POST(
      makeReq(makeBody({ client: { mode: "existing", clientId: existing._id.toString() } }))
    );
    expect(res.status).toBe(201);
    const booking = await Booking.findOne({ workspaceId }).lean();
    expect(booking?.clientName).toBe("Priya Shah");
    expect(await Client.countDocuments({ workspaceId })).toBe(1);
  });

  it("returns 404 when existing clientId belongs to a different workspace (tenant isolation)", async () => {
    const otherWid = new Types.ObjectId();
    const other = await Client.create({
      workspaceId: otherWid,
      name: "Stranger",
      email: "x@example.com",
    });
    const { POST } = await load();
    const res = await POST(
      makeReq(makeBody({ client: { mode: "existing", clientId: other._id.toString() } }))
    );
    expect(res.status).toBe(404);
    expect(await Booking.countDocuments({ workspaceId })).toBe(0);
  });

  it("recordBookingForClient integration: populates client + transaction docs", async () => {
    const { POST } = await load();
    const res = await POST(
      makeReq(
        makeBody({
          amount: { total: 50_000, deposit: 25_000, currency: "PHP" },
        })
      )
    );
    expect(res.status).toBe(201);
    const json = await res.json();

    // Exactly one Client created for the workspace.
    const clients = await Client.find({ workspaceId }).lean();
    expect(clients).toHaveLength(1);
    const client = clients[0];

    expect(client.bookingsCount).toBe(1);
    expect(client.totalSpent).toBe(25_000);
    expect(client.transactions).toHaveLength(1);

    const tx = client.transactions[0];
    expect(tx.amount).toBe(25_000);
    expect(tx.type).toBe("deposit");
    expect(tx.source).toBe("manual");

    // Exactly one Transaction doc created for the workspace.
    const txDocs = await Transaction.find({ workspaceId }).lean();
    expect(txDocs).toHaveLength(1);
    const txDoc = txDocs[0];

    expect(txDoc.bookingId?.toString()).toBe(
      (await Booking.findOne({ workspaceId }).lean())?._id.toString()
    );
    expect(txDoc.clientId?.toString()).toBe(client._id.toString());
    expect(txDoc.amount).toBe(25_000);
    expect(txDoc.type).toBe("deposit");

    // Booking ID from response matches the stored booking.
    const booking = await Booking.findOne({ workspaceId }).lean();
    expect(booking?._id.toString()).toBe(json.id);
  });

  it("atomic rollback: new-client doc is not persisted when Booking.create throws", async () => {
    // Simulate a booking write failure AFTER client creation would have occurred.
    const spy = vi.spyOn(Booking, "create").mockRejectedValueOnce(
      new Error("simulated booking write failure")
    );

    const { POST } = await load();

    let status: number;
    try {
      const res = await POST(makeReq(makeBody()));
      status = res.status;
    } catch {
      status = 500;
    }

    spy.mockRestore();

    expect(status).toBe(500);

    // The transaction rolled back — no orphan Client, no Booking, no ActivityLog.
    expect(await Client.countDocuments({ workspaceId })).toBe(0);
    expect(await Booking.countDocuments({ workspaceId })).toBe(0);
    expect(await ActivityLog.countDocuments({ workspaceId, entity: "booking" })).toBe(0);
  });

  it("atomic rollback: no Booking/Transaction/ActivityLog written when recordBookingForClient throws", async () => {
    // Use an existing client so we can assert its state is unchanged after rollback.
    const existingClient = await Client.create({
      workspaceId,
      name: "Rollback Test",
      email: "rollback@example.com",
      bookingsCount: 0,
      totalSpent: 0,
    });

    // Force Client.updateOne to throw inside the transaction, simulating a
    // write failure in recordBookingForClient.
    const spy = vi.spyOn(Client, "updateOne").mockRejectedValueOnce(
      new Error("forced failure")
    );

    const { POST } = await load();

    // The route has try/finally but no catch: an unhandled write failure propagates.
    // Next.js converts unhandled route-handler throws to 500 responses in production;
    // in unit tests the throw surfaces directly. We handle both cases here.
    let status: number;
    try {
      const res = await POST(
        makeReq(
          makeBody({
            client: { mode: "existing", clientId: existingClient._id.toString() },
            amount: { total: 50_000, deposit: 25_000, currency: "PHP" },
          })
        )
      );
      status = res.status;
    } catch {
      // Unhandled error from the route handler — equivalent to a 500 in production.
      status = 500;
    }

    spy.mockRestore();

    expect(status).toBe(500);

    // Transaction rolled back — no Booking, Transaction, or ActivityLog created.
    expect(await Booking.countDocuments({ workspaceId })).toBe(0);
    expect(await Transaction.countDocuments({ workspaceId })).toBe(0);
    expect(await ActivityLog.countDocuments({ workspaceId, entity: "booking" })).toBe(0);

    // Client state is unchanged.
    const refreshed = await Client.findById(existingClient._id).lean();
    expect(refreshed?.bookingsCount ?? 0).toBe(0);
    expect(refreshed?.totalSpent ?? 0).toBe(0);
    expect(refreshed?.transactions ?? []).toHaveLength(0);
  });
});
