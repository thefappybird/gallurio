import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { countQueries } from "@/test-utils/query-counter";
import { Booking, Inquiry } from "@/lib/db/models";
import { loadInquiriesCalendarData } from "./calendar-data";

const workspaceId = new Types.ObjectId();
const otherWorkspaceId = new Types.ObjectId();
const teamA = new Types.ObjectId();
const teamB = new Types.ObjectId();
const TZ = "Asia/Manila"; // UTC+8
const DATE = new Date("2026-09-15T04:00:00Z"); // window 2026-07-30 .. 2026-11-03

beforeAll(startInMemoryMongo);
afterAll(stopInMemoryMongo);
beforeEach(clearCollections);

async function seedInquiry(
  name: string,
  startDate: string,
  extra: { wid?: Types.ObjectId; status?: string; sessions?: { startDate: string }[] } = {}
) {
  const sessions = (extra.sessions ?? [{ startDate }]).map((s) => ({
    startDate: s.startDate,
    startTime: "10:00",
    endTime: "15:00",
  }));
  return Inquiry.create({
    workspaceId: extra.wid ?? workspaceId,
    name,
    email: `${name}@example.com`,
    sessions,
    eventDate: new Date(`${sessions[0].startDate}T00:00:00Z`),
    eventTitle: name,
    status: extra.status ?? "inquiry",
  });
}

async function seedBooking(
  title: string,
  startAt: Date,
  endAt: Date,
  extra: { wid?: Types.ObjectId; team?: Types.ObjectId; status?: string } = {}
) {
  return Booking.create({
    workspaceId: extra.wid ?? workspaceId,
    teamId: extra.team ?? teamA,
    clientId: new Types.ObjectId(),
    clientName: "C",
    title,
    status: extra.status ?? "booked",
    sessions: [{ startAt, endAt }],
    firstSessionStart: startAt,
    lastSessionEnd: endAt,
    location: { address: "" },
    amount: { total: 1, deposit: 0, currency: "PHP" },
  });
}

describe("loadInquiriesCalendarData", () => {
  it("issues 1 inquiry + 1 booking query; returns only in-window, own-workspace, open-inquiry + active-booking candles", async () => {
    await seedInquiry("in-window", "2026-09-20");
    await seedInquiry("far", "2027-03-01");
    await seedInquiry("archived", "2026-09-21", { status: "archived" });
    await seedInquiry("other-ws", "2026-09-22", { wid: otherWorkspaceId });
    await seedBooking("bk-in", new Date("2026-09-10T01:00:00Z"), new Date("2026-09-10T09:00:00Z"));
    await seedBooking("bk-cancelled", new Date("2026-09-11T01:00:00Z"), new Date("2026-09-11T09:00:00Z"), { status: "cancelled" });
    await seedBooking("bk-far", new Date("2027-03-10T01:00:00Z"), new Date("2027-03-10T09:00:00Z"));
    await seedBooking("bk-other-ws", new Date("2026-09-10T01:00:00Z"), new Date("2026-09-10T09:00:00Z"), { wid: otherWorkspaceId });

    const { result: events, queries } = await countQueries(() =>
      loadInquiriesCalendarData({ workspaceId, tz: TZ, date: DATE })
    );

    expect(queries.map((q) => `${q.collection}.${q.method}`).sort()).toEqual(["bookings.find", "inquiries.find"]);
    expect([...new Set(events.map((e) => e.title))].sort()).toEqual(["bk-in", "in-window"]);
  });

  it("staff scope: conflict detected from another team's booking, but that booking never appears in events", async () => {
    // Manila 09:00-17:00 on Sep 20 belongs to teamB; staff only sees teamA.
    await seedBooking("team-b-secret", new Date("2026-09-20T01:00:00Z"), new Date("2026-09-20T09:00:00Z"), { team: teamB });
    await seedBooking("team-a-visible", new Date("2026-09-25T01:00:00Z"), new Date("2026-09-25T09:00:00Z"), { team: teamA });
    await seedInquiry("clash", "2026-09-20");

    const events = await loadInquiriesCalendarData({
      workspaceId,
      tz: TZ,
      date: DATE,
      allowedTeamIds: [teamA.toString()],
    });

    expect(events.map((e) => e.title)).not.toContain("team-b-secret");
    expect(events.map((e) => e.title)).toContain("team-a-visible");
    const clash = events.find((e) => e.kind === "inquiry");
    expect(clash?.colorOverride).toBe("var(--danger)");
  });

  it("$elemMatch: an inquiry whose sessions straddle the window (none inside) is excluded", async () => {
    await seedInquiry("straddler", "", { sessions: [{ startDate: "2026-01-05" }, { startDate: "2027-06-05" }] });
    const events = await loadInquiriesCalendarData({ workspaceId, tz: TZ, date: DATE });
    expect(events).toEqual([]);
  });

  it("windowed queries are index-backed (no COLLSCAN)", async () => {
    await seedInquiry("x", "2026-09-20");
    await seedBooking("y", new Date("2026-09-10T01:00:00Z"), new Date("2026-09-10T09:00:00Z"));
    await Promise.all([Inquiry.syncIndexes(), Booking.syncIndexes()]);
    const inqPlan = await Inquiry.find({
      workspaceId,
      status: "inquiry",
      sessions: { $elemMatch: { startDate: { $gte: "2026-07-30", $lte: "2026-11-03" } } },
    }).explain("queryPlanner");
    const bkPlan = await Booking.find({
      workspaceId,
      status: { $in: ["booked", "completed"] },
      firstSessionStart: { $lt: new Date("2026-11-04") },
      lastSessionEnd: { $gte: new Date("2026-07-29") },
    }).explain("queryPlanner");
    const stages = (p: unknown) => JSON.stringify((p as { queryPlanner: { winningPlan: unknown } }).queryPlanner.winningPlan);
    expect(stages(inqPlan)).toContain("IXSCAN");
    expect(stages(inqPlan)).not.toContain("COLLSCAN");
    expect(stages(bkPlan)).toContain("IXSCAN");
    expect(stages(bkPlan)).not.toContain("COLLSCAN");
  });
});
