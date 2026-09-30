import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Booking } from "@/lib/db/models";
import { getShiftsOnDate, getShiftsOnDates } from "./shift-conflicts";

// Asia/Manila is UTC+8. A session stored as 01:00 UTC is 09:00 Manila.
const TZ = "Asia/Manila";
const workspaceId = new Types.ObjectId();
const clientId = new Types.ObjectId();

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
});

/** Seed a booking. firstSessionStart/lastSessionEnd are set from sessions. */
async function seedBooking(
  sessions: { startAt: Date; endAt: Date }[],
  overrides: {
    workspaceId?: Types.ObjectId;
    status?: string;
    title?: string;
  } = {}
) {
  const wid = overrides.workspaceId ?? workspaceId;
  const firstSessionStart = sessions.reduce(
    (min, s) => (s.startAt < min ? s.startAt : min),
    sessions[0].startAt
  );
  const lastSessionEnd = sessions.reduce(
    (max, s) => (s.endAt > max ? s.endAt : max),
    sessions[0].endAt
  );
  return Booking.create({
    workspaceId: wid,
    clientId,
    clientName: "Test Client",
    title: overrides.title ?? "Test Booking",
    status: overrides.status ?? "booked",
    sessions,
    firstSessionStart,
    lastSessionEnd,
    amount: { total: 0, deposit: 0, currency: "PHP" },
  });
}

describe("getShiftsOnDate", () => {
  it("returns empty array when no bookings exist", async () => {
    const result = await getShiftsOnDate(workspaceId, "2030-08-15", TZ);
    expect(result).toEqual([]);
  });

  it("returns shift with correct HH:MM for active booking session on queried date", async () => {
    // 01:00–09:00 UTC = 09:00–17:00 Manila
    await seedBooking([
      {
        startAt: new Date("2030-08-15T01:00:00Z"),
        endAt: new Date("2030-08-15T09:00:00Z"),
      },
    ]);
    const result = await getShiftsOnDate(workspaceId, "2030-08-15", TZ);
    expect(result).toHaveLength(1);
    expect(result[0].shiftStart).toBe("09:00");
    expect(result[0].shiftEnd).toBe("17:00");
  });

  it("does not return draft bookings", async () => {
    await seedBooking(
      [{ startAt: new Date("2030-08-15T01:00:00Z"), endAt: new Date("2030-08-15T09:00:00Z") }],
      { status: "draft" }
    );
    const result = await getShiftsOnDate(workspaceId, "2030-08-15", TZ);
    expect(result).toHaveLength(0);
  });

  it("does not return cancelled bookings", async () => {
    await seedBooking(
      [{ startAt: new Date("2030-08-15T01:00:00Z"), endAt: new Date("2030-08-15T09:00:00Z") }],
      { status: "cancelled" }
    );
    const result = await getShiftsOnDate(workspaceId, "2030-08-15", TZ);
    expect(result).toHaveLength(0);
  });

  it("excludes booking matching excludeId", async () => {
    const b = await seedBooking([
      { startAt: new Date("2030-08-15T01:00:00Z"), endAt: new Date("2030-08-15T09:00:00Z") },
    ]);
    const result = await getShiftsOnDate(workspaceId, "2030-08-15", TZ, {
      excludeId: b._id.toString(),
    });
    expect(result).toHaveLength(0);
  });

  it("does not return booking on a different date", async () => {
    // Booking is on Aug 16 Manila time (00:00 UTC Aug 16 = 08:00 Manila Aug 16)
    await seedBooking([
      {
        startAt: new Date("2030-08-16T00:00:00Z"),
        endAt: new Date("2030-08-16T08:00:00Z"),
      },
    ]);
    // Query Aug 15 — should return nothing
    const result = await getShiftsOnDate(workspaceId, "2030-08-15", TZ);
    expect(result).toHaveLength(0);
  });
});

describe("getShiftsOnDates", () => {
  it("a busy earlier date does not starve later dates of hits", async () => {
    await Booking.insertMany(
      Array.from({ length: 45 }, (_, i) => {
        const startAt = new Date(Date.UTC(2030, 7, 15, 1, i));
        const endAt = new Date(Date.UTC(2030, 7, 15, 2, i));
        return {
          workspaceId,
          clientId,
          clientName: "C",
          title: `busy-${i}`,
          status: "booked",
          sessions: [{ startAt, endAt }],
          firstSessionStart: startAt,
          lastSessionEnd: endAt,
          amount: { total: 0, deposit: 0, currency: "PHP" },
        };
      })
    );
    await seedBooking(
      [{ startAt: new Date("2030-08-16T01:00:00Z"), endAt: new Date("2030-08-16T02:00:00Z") }],
      { title: "later" }
    );
    const result = await getShiftsOnDates(workspaceId, ["2030-08-15", "2030-08-16"], TZ);
    expect(result["2030-08-15"]).toHaveLength(20);
    expect(result["2030-08-16"].map((h) => h.title)).toEqual(["later"]);
  });

  it("legacy booking without sessions[] falls back to top-level start/end", async () => {
    await Booking.collection.insertOne({
      workspaceId,
      clientId,
      clientName: "C",
      title: "legacy",
      status: "booked",
      sessions: [],
      firstSessionStart: new Date("2030-08-15T01:00:00Z"),
      lastSessionEnd: new Date("2030-08-15T09:00:00Z"),
    });
    const result = await getShiftsOnDates(workspaceId, ["2030-08-15"], TZ);
    expect(result["2030-08-15"]).toMatchObject([
      { title: "legacy", sessionIndex: 0, shiftStart: "09:00", shiftEnd: "17:00" },
    ]);
  });

  it("legacy multi-day booking returns the all-day sentinel on a mid-span date", async () => {
    await Booking.collection.insertOne({
      workspaceId,
      clientId,
      clientName: "C",
      title: "legacy-multi",
      status: "booked",
      sessions: [],
      firstSessionStart: new Date("2030-08-14T01:00:00Z"),
      lastSessionEnd: new Date("2030-08-17T09:00:00Z"),
    });
    const result = await getShiftsOnDates(workspaceId, ["2030-08-15"], TZ);
    expect(result["2030-08-15"]).toMatchObject([{ shiftStart: "00:00", shiftEnd: "23:59" }]);
  });

  it("a gap day between two sessions returns nothing while session days hit", async () => {
    await seedBooking([
      { startAt: new Date("2030-08-15T01:00:00Z"), endAt: new Date("2030-08-15T09:00:00Z") },
      { startAt: new Date("2030-08-17T02:00:00Z"), endAt: new Date("2030-08-17T05:00:00Z") },
    ]);
    const result = await getShiftsOnDates(workspaceId, ["2030-08-15", "2030-08-16", "2030-08-17"], TZ);
    expect(result["2030-08-16"]).toEqual([]);
    expect(result["2030-08-17"]).toMatchObject([
      { sessionIndex: 1, shiftStart: "10:00", shiftEnd: "13:00" },
    ]);
  });

  it("excludeShiftKey drops only that session; sibling still conflicts", async () => {
    const b = await seedBooking([
      { startAt: new Date("2030-08-15T01:00:00Z"), endAt: new Date("2030-08-15T02:00:00Z") },
      { startAt: new Date("2030-08-15T05:00:00Z"), endAt: new Date("2030-08-15T06:00:00Z") },
    ]);
    const result = await getShiftsOnDates(workspaceId, ["2030-08-15"], TZ, {
      excludeShiftKey: `${b._id}:0`,
    });
    expect(result["2030-08-15"].map((h) => h.sessionIndex)).toEqual([1]);
  });

  it("teamScope limits results to the given teams", async () => {
    const teamA = new Types.ObjectId();
    const teamB = new Types.ObjectId();
    const seed = (teamId: Types.ObjectId, title: string) =>
      Booking.create({
        workspaceId,
        teamId,
        clientId,
        clientName: "C",
        title,
        status: "booked",
        sessions: [{ startAt: new Date("2030-08-15T01:00:00Z"), endAt: new Date("2030-08-15T02:00:00Z") }],
        firstSessionStart: new Date("2030-08-15T01:00:00Z"),
        lastSessionEnd: new Date("2030-08-15T02:00:00Z"),
        amount: { total: 0, deposit: 0, currency: "PHP" },
      });
    await seed(teamA, "a");
    await seed(teamB, "b");
    const result = await getShiftsOnDates(workspaceId, ["2030-08-15"], TZ, {
      teamScope: [teamA.toString()],
    });
    expect(result["2030-08-15"].map((h) => h.title)).toEqual(["a"]);
  });

  it("does not leak bookings from another workspace", async () => {
    await seedBooking(
      [{ startAt: new Date("2030-08-15T01:00:00Z"), endAt: new Date("2030-08-15T02:00:00Z") }],
      { workspaceId: new Types.ObjectId() }
    );
    const result = await getShiftsOnDates(workspaceId, ["2030-08-15"], TZ);
    expect(result["2030-08-15"]).toEqual([]);
  });
});
