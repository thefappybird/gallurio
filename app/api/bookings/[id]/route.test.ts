import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Booking, ActivityLog } from "@/lib/db/models";

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

async function seedBooking(wid: Types.ObjectId, overrides: Record<string, unknown> = {}) {
  const defaultStart = new Date("2026-08-15T10:00:00Z");
  return Booking.create({
    workspaceId: wid,
    clientId: new Types.ObjectId(),
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
    const b = await seedBooking(workspaceId);
    const { GET } = await load();
    const res = await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.title).toBe("Carter Wedding");
  });

  it("returns 404 when the booking belongs to another workspace (tenant isolation)", async () => {
    const b = await seedBooking(otherWorkspaceId);
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
    const b = await seedBooking(workspaceId);
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
    const b = await seedBooking(workspaceId);
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
    const b = await seedBooking(workspaceId);
    const { PATCH } = await load();
    await PATCH(
      makePatch({ status: "cancelled" }, b._id.toString()),
      ctx(b._id.toString())
    );
    const log = await ActivityLog.findOne({ workspaceId, entity: "booking" }).lean();
    expect(log?.action).toBe("status_changed");
  });

  it("rejects unknown keys with 400 (strict allowlist)", async () => {
    const b = await seedBooking(workspaceId);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ workspaceId: "leak" }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(400);
  });

  it("rejects an empty body with 400", async () => {
    const b = await seedBooking(workspaceId);
    const { PATCH } = await load();
    const res = await PATCH(makePatch({}, b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(400);
  });

  it("returns 404 when patching a booking from another workspace", async () => {
    const b = await seedBooking(otherWorkspaceId);
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
    const b = await seedBooking(workspaceId);
    const { PATCH } = await load();
    await PATCH(
      makePatch({ title: "Carter Wedding" }, b._id.toString()),
      ctx(b._id.toString())
    );
    const logs = await ActivityLog.find({ workspaceId, entity: "booking" }).lean();
    expect(logs).toHaveLength(0);
  });
});
