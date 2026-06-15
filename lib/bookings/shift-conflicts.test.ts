import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Booking } from "@/lib/db/models";
import { getShiftsOnDate } from "./shift-conflicts";

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
