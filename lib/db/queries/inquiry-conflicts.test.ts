import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Booking } from "@/lib/db/models";
import { computeInquiryConflicts, type InquiryConflictInput } from "./inquiry-conflicts";

// Asia/Manila = UTC+8. A booking 01:00–09:00 UTC is 09:00–17:00 Manila.
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

async function seedBooking(
  sessions: { startAt: Date; endAt: Date }[],
  overrides: { status?: string } = {}
) {
  const firstSessionStart = sessions.reduce(
    (min, s) => (s.startAt < min ? s.startAt : min),
    sessions[0].startAt
  );
  const lastSessionEnd = sessions.reduce(
    (max, s) => (s.endAt > max ? s.endAt : max),
    sessions[0].endAt
  );
  return Booking.create({
    workspaceId,
    clientId,
    clientName: "Test Client",
    title: "Test Booking",
    status: overrides.status ?? "booked",
    sessions,
    firstSessionStart,
    lastSessionEnd,
    amount: { total: 0, deposit: 0, currency: "PHP" },
  });
}

function makeInquiry(id: string, sessions: InquiryConflictInput["sessions"]): InquiryConflictInput {
  return { _id: id, sessions };
}

describe("computeInquiryConflicts", () => {
  it("returns empty Set when inquiries array is empty", async () => {
    const result = await computeInquiryConflicts(workspaceId, [], TZ);
    expect(result.size).toBe(0);
  });

  it("returns empty Set when no bookings exist (no conflicts possible)", async () => {
    const inquiries = [
      makeInquiry("inq1", [{ startDate: "2030-08-15", startTime: "09:00", endTime: "17:00" }]),
    ];
    const result = await computeInquiryConflicts(workspaceId, inquiries, TZ);
    expect(result.size).toBe(0);
  });

  it("marks inquiry as conflicting when session overlaps active booking on same date and time", async () => {
    // Booking 09:00–17:00 Manila = 01:00–09:00 UTC on Aug 15
    await seedBooking([
      { startAt: new Date("2030-08-15T01:00:00Z"), endAt: new Date("2030-08-15T09:00:00Z") },
    ]);
    const inquiries = [
      // Inquiry overlaps: 10:00–15:00 Manila on Aug 15 conflicts with 09:00–17:00
      makeInquiry("inq1", [{ startDate: "2030-08-15", startTime: "10:00", endTime: "15:00" }]),
    ];
    const result = await computeInquiryConflicts(workspaceId, inquiries, TZ);
    expect(result.has("inq1")).toBe(true);
  });

  it("does not conflict when booking is on a different date", async () => {
    // Booking on Aug 16
    await seedBooking([
      { startAt: new Date("2030-08-16T01:00:00Z"), endAt: new Date("2030-08-16T09:00:00Z") },
    ]);
    const inquiries = [
      // Inquiry on Aug 15 — different day, no conflict
      makeInquiry("inq1", [{ startDate: "2030-08-15", startTime: "09:00", endTime: "17:00" }]),
    ];
    const result = await computeInquiryConflicts(workspaceId, inquiries, TZ);
    expect(result.has("inq1")).toBe(false);
  });

  it("draft bookings do not cause conflicts", async () => {
    await seedBooking(
      [{ startAt: new Date("2030-08-15T01:00:00Z"), endAt: new Date("2030-08-15T09:00:00Z") }],
      { status: "draft" }
    );
    const inquiries = [
      makeInquiry("inq1", [{ startDate: "2030-08-15", startTime: "10:00", endTime: "15:00" }]),
    ];
    const result = await computeInquiryConflicts(workspaceId, inquiries, TZ);
    expect(result.has("inq1")).toBe(false);
  });

  it("cancelled bookings do not cause conflicts", async () => {
    await seedBooking(
      [{ startAt: new Date("2030-08-15T01:00:00Z"), endAt: new Date("2030-08-15T09:00:00Z") }],
      { status: "cancelled" }
    );
    const inquiries = [
      makeInquiry("inq1", [{ startDate: "2030-08-15", startTime: "10:00", endTime: "15:00" }]),
    ];
    const result = await computeInquiryConflicts(workspaceId, inquiries, TZ);
    expect(result.has("inq1")).toBe(false);
  });

  it("returns only the conflicting inquiry when multiple inquiries exist", async () => {
    // Booking on Aug 15, 09:00–17:00 Manila
    await seedBooking([
      { startAt: new Date("2030-08-15T01:00:00Z"), endAt: new Date("2030-08-15T09:00:00Z") },
    ]);
    const inquiries = [
      // inq1 conflicts (same date, overlapping time)
      makeInquiry("inq1", [{ startDate: "2030-08-15", startTime: "10:00", endTime: "14:00" }]),
      // inq2 does not conflict (different date)
      makeInquiry("inq2", [{ startDate: "2030-08-20", startTime: "09:00", endTime: "17:00" }]),
    ];
    const result = await computeInquiryConflicts(workspaceId, inquiries, TZ);
    expect(result.has("inq1")).toBe(true);
    expect(result.has("inq2")).toBe(false);
  });
});
