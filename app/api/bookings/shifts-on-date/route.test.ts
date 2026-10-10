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

/**
 * Seed a booking with explicit sessions.
 * Note: Booking.insertMany skips pre-save hooks, so set denormalised fields
 * explicitly.
 */
async function seedBooking(sessions: { startAt: Date; endAt: Date }[], overrides: {
  workspaceId?: Types.ObjectId;
  status?: string;
  title?: string;
  teamId?: Types.ObjectId | null;
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
    teamId: overrides.teamId === undefined ? new Types.ObjectId() : overrides.teamId,
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
  async function getQs(qs: string) {
    const { GET } = await load();
    return GET(new Request(`http://test/api/bookings/shifts-on-date${qs ? `?${qs}` : ""}`));
  }

  it("returns byDate with an entry per unique date", async () => {
    await seedBooking([
      { startAt: new Date("2030-08-15T01:00:00Z"), endAt: new Date("2030-08-15T09:00:00Z") },
    ]);
    const res = await getQs("dates=2030-08-15,2030-08-16,2030-08-15");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Object.keys(json.byDate).sort()).toEqual(["2030-08-15", "2030-08-16"]);
    expect(json.byDate["2030-08-15"]).toHaveLength(1);
    expect(json.byDate["2030-08-16"]).toEqual([]);
  });

  it("rejects a missing dates param with 400", async () => {
    const res = await getQs("");
    expect(res.status).toBe(400);
  });

  it("rejects more than 31 dates with 400", async () => {
    const dates = Array.from({ length: 32 }, (_, i) => `2030-01-${String(i + 1).padStart(2, "0")}`);
    const res = await getQs(`dates=${dates.join(",")}`);
    expect(res.status).toBe(400);
  });

  it("rejects the removed single-date form (dates is required)", async () => {
    const res = await getQs("date=2030-08-15");
    expect(res.status).toBe(400);
  });

  it("rejects a malformed entry in dates", async () => {
    const res = await getQs("dates=2030-08-15,nope");
    expect(res.status).toBe(400);
  });

  it("does not leak another workspace's bookings in a batch", async () => {
    await seedBooking(
      [{ startAt: new Date("2030-08-15T01:00:00Z"), endAt: new Date("2030-08-15T09:00:00Z") }],
      { workspaceId: otherWorkspaceId }
    );
    const json = await (await getQs("dates=2030-08-15")).json();
    expect(json.byDate["2030-08-15"]).toEqual([]);
  });

  it("excludes the booking specified by excludeId", async () => {
    const b = await seedBooking([
      { startAt: new Date("2030-08-15T10:00:00Z"), endAt: new Date("2030-08-15T18:00:00Z") },
    ]);
    const json = await (await getQs(`dates=2030-08-15&excludeId=${b._id}`)).json();
    expect(json.byDate["2030-08-15"]).toEqual([]);
  });

  it("excludeShiftKey skips only the specified session; siblings still appear", async () => {
    const b = await seedBooking([
      { startAt: new Date("2030-08-15T09:00:00Z"), endAt: new Date("2030-08-15T11:00:00Z") },
      { startAt: new Date("2030-08-15T14:00:00Z"), endAt: new Date("2030-08-15T16:00:00Z") },
    ]);
    const key = encodeURIComponent(`${b._id}:0`);
    const json = await (await getQs(`dates=2030-08-15&excludeShiftKey=${key}`)).json();
    expect(json.byDate["2030-08-15"]).toHaveLength(1);
    expect(json.byDate["2030-08-15"][0].sessionIndex).toBe(1);
  });

  it("rejects a malformed teamId with 400", async () => {
    const res = await getQs("dates=2030-08-15&teamId=nope");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid team" });
  });

  it("teamId filters to that team's bookings", async () => {
    const teamA = new Types.ObjectId();
    const sessions = [
      { startAt: new Date("2030-08-15T01:00:00Z"), endAt: new Date("2030-08-15T09:00:00Z") },
    ];
    await seedBooking(sessions, { teamId: teamA, title: "a" });
    await seedBooking(sessions, { title: "other" });
    const json = await (await getQs(`dates=2030-08-15&teamId=${teamA}`)).json();
    expect(json.byDate["2030-08-15"].map((h: { title: string }) => h.title)).toEqual(["a"]);
  });

  it("teamId=none matches only teamless bookings", async () => {
    const sessions = [
      { startAt: new Date("2030-08-15T01:00:00Z"), endAt: new Date("2030-08-15T09:00:00Z") },
    ];
    await seedBooking(sessions, { teamId: null, title: "legacy" });
    await seedBooking(sessions, { title: "teamed" });
    const json = await (await getQs("dates=2030-08-15&teamId=none")).json();
    expect(json.byDate["2030-08-15"].map((h: { title: string }) => h.title)).toEqual(["legacy"]);
  });
});
