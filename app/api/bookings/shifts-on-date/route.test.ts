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
    // timezone is "UTC" so HH:MM assertions match UTC-stored Date values directly.
    workspace: { _id: workspaceId, currency: "PHP", name: "Test", slug: "t", timezone: "UTC" },
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

function makeReqWithShiftKey(date: string, excludeShiftKey: string) {
  const url = new URL(
    `http://test/api/bookings/shifts-on-date?date=${date}&excludeShiftKey=${encodeURIComponent(excludeShiftKey)}`
  );
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
    teamId: new Types.ObjectId(),
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
      { startAt: new Date("2026-08-15T10:00:00Z"), endAt: new Date("2026-08-15T18:00:00Z") },
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
      { startAt: new Date("2026-08-10T09:00:00Z"), endAt: new Date("2026-08-10T17:00:00Z") },
      { startAt: new Date("2026-08-20T14:00:00Z"), endAt: new Date("2026-08-20T20:00:00Z") },
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
      { startAt: new Date("2026-08-15T09:00:00Z"), endAt: new Date("2026-08-15T12:00:00Z") },
    ], { title: "Morning Shoot" });
    await seedBooking([
      { startAt: new Date("2026-08-15T14:00:00Z"), endAt: new Date("2026-08-15T18:00:00Z") },
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
      { startAt: new Date("2026-08-15T10:00:00Z"), endAt: new Date("2026-08-15T18:00:00Z") },
    ], { status: "cancelled" });

    const req = makeReq("2026-08-15");
    const res = await GET(req);
    const body = await res.json();
    expect(body.shifts).toHaveLength(0);
  });

  it("excludes the booking specified by excludeId", async () => {
    const { GET } = await load();
    const b = await seedBooking([
      { startAt: new Date("2026-08-15T10:00:00Z"), endAt: new Date("2026-08-15T18:00:00Z") },
    ]);

    const req = makeReq("2026-08-15", b._id.toString());
    const res = await GET(req);
    const body = await res.json();
    expect(body.shifts).toHaveLength(0);
  });

  it("never leaks another workspace's bookings (tenant isolation)", async () => {
    const { GET } = await load();
    await seedBooking([
      { startAt: new Date("2026-08-15T10:00:00Z"), endAt: new Date("2026-08-15T18:00:00Z") },
    ], { workspaceId: otherWorkspaceId });

    const req = makeReq("2026-08-15");
    const res = await GET(req);
    const body = await res.json();
    expect(body.shifts).toHaveLength(0);
  });

  it("returns BOTH sessions of the SAME booking when two of its sessions touch the date (drag will see siblings as conflicts)", async () => {
    const { GET } = await load();
    await seedBooking(
      [
        { startAt: new Date("2026-08-15T09:00:00Z"), endAt: new Date("2026-08-15T11:00:00Z") },
        { startAt: new Date("2026-08-15T14:00:00Z"), endAt: new Date("2026-08-15T16:00:00Z") },
      ],
      { title: "Two-session Same Day" }
    );

    const req = makeReq("2026-08-15");
    const res = await GET(req);
    const body = await res.json();
    expect(body.shifts).toHaveLength(2);
    const indexes = body.shifts.map((s: { sessionIndex: number }) => s.sessionIndex).sort();
    expect(indexes).toEqual([0, 1]);
    const ranges = body.shifts
      .map((s: { shiftStart: string; shiftEnd: string }) => `${s.shiftStart}-${s.shiftEnd}`)
      .sort();
    expect(ranges).toEqual(["09:00-11:00", "14:00-16:00"]);
  });

  it("excludeShiftKey skips only the specified session; sibling sessions of the same booking still appear", async () => {
    const { GET } = await load();
    const b = await seedBooking(
      [
        { startAt: new Date("2026-08-15T09:00:00Z"), endAt: new Date("2026-08-15T11:00:00Z") },
        { startAt: new Date("2026-08-15T14:00:00Z"), endAt: new Date("2026-08-15T16:00:00Z") },
      ],
      { title: "Drag Source" }
    );

    // Dragging session 0 — it should not appear in its own conflict set, but
    // session 1 of the same booking must still show.
    const req = makeReqWithShiftKey("2026-08-15", `${b._id.toString()}:0`);
    const res = await GET(req);
    const body = await res.json();
    expect(body.shifts).toHaveLength(1);
    expect(body.shifts[0].sessionIndex).toBe(1);
    expect(body.shifts[0].shiftStart).toBe("14:00");
  });

  it("excludeShiftKey ignores malformed input and returns all matching sessions", async () => {
    const { GET } = await load();
    await seedBooking([
      { startAt: new Date("2026-08-15T10:00:00Z"), endAt: new Date("2026-08-15T18:00:00Z") },
    ]);

    const req = makeReqWithShiftKey("2026-08-15", "not-a-key");
    const res = await GET(req);
    const body = await res.json();
    expect(body.shifts).toHaveLength(1);
  });

  it("returns a shift via firstSessionStart/lastSessionEnd fallback for a legacy booking with empty sessions[]", async () => {
    // Raw insert bypasses the pre-save hook and schema validation so we can
    // simulate a legacy doc that has no sessions array but valid denormalised bounds.
    const { GET } = await load();
    await Booking.collection.insertOne({
      workspaceId,
      clientId,
      clientName: "Legacy Client",
      title: "Legacy Booking",
      status: "booked",
      sessions: [],
      firstSessionStart: new Date("2026-08-15T10:00:00Z"),
      lastSessionEnd: new Date("2026-08-15T18:00:00Z"),
      location: { address: "" },
      amount: { total: 0, deposit: 0, currency: "PHP" },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = makeReq("2026-08-15");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shifts).toHaveLength(1);
    expect(body.shifts[0].title).toBe("Legacy Booking");
    expect(body.shifts[0].shiftStart).toBe("10:00");
    expect(body.shifts[0].shiftEnd).toBe("18:00");
  });

  it("returns all-day sentinel (00:00–23:59) for a multi-day legacy booking queried on a mid-span date", async () => {
    // Verifies the isMultiDay sentinel branch: a legacy booking spanning Aug 15–17
    // queried on the middle date (Aug 16) should yield shiftStart=00:00/shiftEnd=23:59
    // rather than exposing the raw firstSessionStart/lastSessionEnd wall times.
    const { GET } = await load();
    await Booking.collection.insertOne({
      workspaceId,
      clientId,
      clientName: "Multi-day Legacy Client",
      title: "Multi-day Legacy Booking",
      status: "booked",
      sessions: [],
      firstSessionStart: new Date("2026-08-15T10:00:00Z"),
      lastSessionEnd: new Date("2026-08-17T18:00:00Z"),
      location: { address: "" },
      amount: { total: 0, deposit: 0, currency: "PHP" },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = makeReq("2026-08-16");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shifts).toHaveLength(1);
    expect(body.shifts[0].shiftStart).toBe("00:00");
    expect(body.shifts[0].shiftEnd).toBe("23:59");
  });

  it("modern booking with sessions[]: gap day between sessions returns no shift", async () => {
    // Booking X has sessions on day 1 (Aug 18) and day 3 (Aug 20).
    // Querying the gap day (Aug 19) must return an empty shifts array —
    // the Mongo $or bounds-clause matches because firstSessionStart=Aug18 and
    // lastSessionEnd=Aug20 span Aug 19, but no individual session touches Aug 19.
    // Without the fix, the legacy-fallback fires and emits an all-day sentinel,
    // causing a false conflict for any booking attempted on Aug 19.
    const { GET } = await load();
    await seedBooking(
      [
        { startAt: new Date("2026-08-18T09:00:00Z"), endAt: new Date("2026-08-18T17:00:00Z") },
        { startAt: new Date("2026-08-20T09:00:00Z"), endAt: new Date("2026-08-20T17:00:00Z") },
      ],
      { title: "Two-day Multi-session Shoot" }
    );

    const req = makeReq("2026-08-19");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shifts).toHaveLength(0);
  });
});
