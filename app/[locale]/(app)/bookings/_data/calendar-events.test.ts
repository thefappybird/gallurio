import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { countQueries } from "@/test-utils/query-counter";
import { Booking } from "@/lib/db/models";
import { loadBookingsCalendarEvents } from "./calendar-events";

const workspaceId = new Types.ObjectId();
const otherWorkspaceId = new Types.ObjectId();
const teamA = new Types.ObjectId();
const TZ = "Asia/Manila";

beforeAll(startInMemoryMongo);
afterAll(stopInMemoryMongo);
beforeEach(clearCollections);

async function seed(title: string, startAt: Date, endAt: Date, wid = workspaceId) {
  return Booking.create({
    workspaceId: wid,
    teamId: teamA,
    clientId: new Types.ObjectId(),
    clientName: "C",
    title,
    status: "booked",
    sessions: [{ startAt, endAt }],
    firstSessionStart: startAt,
    lastSessionEnd: endAt,
    location: { address: "" },
    amount: { total: 1, deposit: 0, currency: "PHP" },
  });
}

describe("loadBookingsCalendarEvents", () => {
  it("issues exactly one booking query and returns only in-window, own-workspace events without emails", async () => {
    await seed("inside", new Date("2026-09-10T01:00:00Z"), new Date("2026-09-10T09:00:00Z"));
    await seed("overnight-in", new Date("2026-09-30T14:00:00Z"), new Date("2026-10-01T02:00:00Z"));
    await seed("far-away", new Date("2027-03-10T01:00:00Z"), new Date("2027-03-10T09:00:00Z"));
    await seed("other-ws", new Date("2026-09-10T01:00:00Z"), new Date("2026-09-10T09:00:00Z"), otherWorkspaceId);

    const { result: events, queries } = await countQueries(() =>
      loadBookingsCalendarEvents({
        workspaceId,
        tz: TZ,
        date: new Date("2026-09-15T04:00:00Z"),
        filters: { includePast: true, includeCancelled: false },
      })
    );

    expect(queries).toHaveLength(1);
    expect(queries[0].collection).toBe("bookings");
    expect([...new Set(events.map((e) => e.title))].sort()).toEqual(["inside", "overnight-in"]);
    expect(events.every((e) => e.clientEmail === null)).toBe(true);
  });
});
