import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Booking } from "@/lib/db/models";

const workspaceId = new Types.ObjectId();
const otherWorkspaceId = new Types.ObjectId();
const clientId = new Types.ObjectId();
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

function makeReq(date: string, excludeId?: string) {
  const url = new URL(`http://test/api/bookings/shifts-on-date?date=${date}${excludeId ? `&excludeId=${excludeId}` : ""}`);
  return new Request(url);
}

/**
 * Seed a booking with explicit sessions.
 * Note: Booking.insertMany skips pre-save hooks, so set denormalised fields
 * explicitly. Using Booking.create (not insertMany) triggers the hook, but we
 * set them explicitly for clarity and test-speed.
 */
async function seedBooking(sessions: { startAt: Date; endAt: Date }[], overrides: {
  workspaceId?: Types.ObjectId;
  status?: string;
  title?: string;
} = {}) {
  const wid = overrides.workspaceId ?? workspaceId;
  const firstSessionStart = sessions.reduce((min, s) =>
    s.startAt < min ? s.startAt : min, sessions[0].startAt
  );
  const lastSessionEnd = sessions.reduce((max, s) =>
    s.endAt > max ? s.endAt : max, sessions[0].endAt
  );
  return Booking.create({
    workspaceId: wid,
    clientId,
    clientName: "Demo Client",
    title: overrides.title ?? "Demo Booking",
    status: overrides.status ?? "booked",
    sessions,
    firstSessionStart,
    lastSessionEnd,
    location: { address: "" },
    amount: { total: 50_000, deposit: 10_000, currency: "PHP" },
  });
}

describe("GET /api/bookings/shifts-on-date", () => {
  it("returns 400 for a missing date", async () => {
    const { GET } = await load();
    const req = new Request("http://test/api/bookings/shifts-on-date");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid date format", async () => {
    const { GET } = await load();
    const req = makeReq("not-a-date");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns empty shifts when no bookings exist", async () => {
    const { GET } = await load();
    const req = makeReq("2026-08-15");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shifts).toHaveLength(0);
  });

  it("returns shift from a single-session booking that overlaps the date", async () => {
    const { GET } = await load();
    await seedBooking([
      { startAt: new Date("2026-08-15T10:00:00"), endAt: new Date("2026-08-15T18:00:00") },
    ], { title: "Carter Wedding" });

    const req = makeReq("2026-08-15");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shifts).toHaveLength(1);
    expect(body.shifts[0].title).toBe("Carter Wedding");
    expect(body.shifts[0].shiftStart).toBe("10:00");
    expect(body.shifts[0].shiftEnd).toBe("18:00");
  });

  it("returns session 2 shift times when the queried date falls in session 2 (not session 1)", async () => {
    // Session 1: Aug 10, 09:00–17:00
    // Session 2: Aug 20, 14:00–20:00
    // Query Aug 20 → should return session 2's 14:00–20:00, NOT session 1's 09:00–17:00.
    const { GET } = await load();
    await seedBooking([
      { startAt: new Date("2026-08-10T09:00:00"), endAt: new Date("2026-08-10T17:00:00") },
      { startAt: new Date("2026-08-20T14:00:00"), endAt: new Date("2026-08-20T20:00:00") },
    ], { title: "Multi-session Shoot" });

    const req = makeReq("2026-08-20");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shifts).toHaveLength(1);
    expect(body.shifts[0].title).toBe("Multi-session Shoot");
    // Must be session 2's times, not session 1's.
    expect(body.shifts[0].shiftStart).toBe("14:00");
    expect(body.shifts[0].shiftEnd).toBe("20:00");
  });

  it("returns both sessions' times when two sessions touch the same date", async () => {
    // Session 1 of booking A: Aug 15
    // Session 1 of booking B: Aug 15 with different times
    const { GET } = await load();
    await seedBooking([
      { startAt: new Date("2026-08-15T09:00:00"), endAt: new Date("2026-08-15T12:00:00") },
    ], { title: "Morning Shoot" });
    await seedBooking([
      { startAt: new Date("2026-08-15T14:00:00"), endAt: new Date("2026-08-15T18:00:00") },
    ], { title: "Afternoon Shoot" });

    const req = makeReq("2026-08-15");
    const res = await GET(req);
    const body = await res.json();
    expect(body.shifts).toHaveLength(2);
    const titles = body.shifts.map((s: { title: string }) => s.title);
    expect(titles).toContain("Morning Shoot");
    expect(titles).toContain("Afternoon Shoot");
  });

  it("does not return cancelled bookings", async () => {
    const { GET } = await load();
    await seedBooking([
      { startAt: new Date("2026-08-15T10:00:00"), endAt: new Date("2026-08-15T18:00:00") },
    ], { status: "cancelled" });

    const req = makeReq("2026-08-15");
    const res = await GET(req);
    const body = await res.json();
    expect(body.shifts).toHaveLength(0);
  });

  it("excludes the booking specified by excludeId", async () => {
    const { GET } = await load();
    const b = await seedBooking([
      { startAt: new Date("2026-08-15T10:00:00"), endAt: new Date("2026-08-15T18:00:00") },
    ]);

    const req = makeReq("2026-08-15", b._id.toString());
    const res = await GET(req);
    const body = await res.json();
    expect(body.shifts).toHaveLength(0);
  });

  it("never leaks another workspace's bookings (tenant isolation)", async () => {
    const { GET } = await load();
    await seedBooking([
      { startAt: new Date("2026-08-15T10:00:00"), endAt: new Date("2026-08-15T18:00:00") },
    ], { workspaceId: otherWorkspaceId });

    const req = makeReq("2026-08-15");
    const res = await GET(req);
    const body = await res.json();
    expect(body.shifts).toHaveLength(0);
  });
});
