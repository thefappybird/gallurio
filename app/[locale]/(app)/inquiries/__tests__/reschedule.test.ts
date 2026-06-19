import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

const workspaceId = new Types.ObjectId();
const otherWorkspaceId = new Types.ObjectId();
let mockCtx: {
  userId: string;
  role: "owner" | "staff";
  workspaceId: Types.ObjectId;
  timezone?: string;
};

vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: async () => ({
    userId: mockCtx.userId,
    role: mockCtx.role,
    workspace: {
      _id: mockCtx.workspaceId,
      currency: "PHP",
      name: "Test",
      slug: "t",
      timezone: mockCtx.timezone ?? "Asia/Manila",
    },
  }),
}));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Inquiry, Booking, Client } from "@/lib/db/models";
import { rescheduleInquirySessionAction } from "../_actions";
import { wallTimeInTzToUtc } from "@/lib/utils/timezone";

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
  mockCtx = { userId: "user_owner", role: "owner", workspaceId };
});

async function seedInquiry(
  wid: Types.ObjectId,
  overrides: Partial<{ status: string }> = {}
) {
  const client = await Client.create({
    workspaceId: wid,
    name: "Test Client",
    email: "test@example.com",
    source: "form",
  });
  const sessions = [{ startDate: "2035-03-10", startTime: "09:00", endTime: "17:00" }];
  const utcStart = new Date("2035-03-10T01:00:00Z");
  const utcEnd = new Date("2035-03-10T09:00:00Z");
  const booking = await Booking.create({
    workspaceId: wid,
    clientId: client._id,
    clientName: "Test Client",
    title: "Test Client -- inquiry",
    status: "draft",
    sessions: [{ startAt: utcStart, endAt: utcEnd }],
    firstSessionStart: utcStart,
    lastSessionEnd: utcEnd,
    amount: { total: 0, deposit: 0, currency: "PHP" },
  });
  const inquiry = await Inquiry.create({
    workspaceId: wid,
    name: "Test Client",
    email: "test@example.com",
    status: overrides.status ?? "new",
    eventDate: utcStart,
    clientId: client._id,
    draftBookingId: booking._id,
    sessions,
  });
  return { client, booking, inquiry };
}

async function seedConflictingBooking(
  wid: Types.ObjectId,
  startDate: string,
  startTime: string,
  endTime: string,
  tz = "Asia/Manila"
) {
  const client = await Client.create({
    workspaceId: wid,
    name: "Conflict Client",
    email: "conflict@example.com",
    source: "form",
  });
  const startAt = new Date(wallTimeInTzToUtc(startDate, startTime, tz));
  const endAt = new Date(wallTimeInTzToUtc(startDate, endTime, tz));
  return Booking.create({
    workspaceId: wid,
    clientId: client._id,
    clientName: "Conflict Client",
    title: "Conflict Booking",
    status: "booked",
    sessions: [{ startAt, endAt }],
    firstSessionStart: startAt,
    lastSessionEnd: endAt,
    amount: { total: 0, deposit: 0, currency: "PHP" },
  });
}

describe("rescheduleInquirySessionAction", () => {
  // (a) Happy path
  it("updates the session and returns { ok: true }", async () => {
    const { inquiry } = await seedInquiry(workspaceId);
    const res = await rescheduleInquirySessionAction({
      inquiryId: String(inquiry._id),
      sessionIndex: 0,
      startDate: "2035-03-15",
      startTime: "10:00",
      endTime: "18:00",
    });
    expect(res).toEqual({ ok: true });

    const fresh = await Inquiry.findById(inquiry._id).lean();
    expect(fresh?.sessions?.[0]?.startDate).toBe("2035-03-15");
    expect(fresh?.sessions?.[0]?.startTime).toBe("10:00");
    expect(fresh?.sessions?.[0]?.endTime).toBe("18:00");
  });

  // (b) Conflict with a real Booking
  it("returns { error } when session conflicts with an existing booking and does NOT persist", async () => {
    const { inquiry } = await seedInquiry(workspaceId);
    await seedConflictingBooking(workspaceId, "2035-03-20", "08:00", "18:00");

    const res = await rescheduleInquirySessionAction({
      inquiryId: String(inquiry._id),
      sessionIndex: 0,
      startDate: "2035-03-20",
      startTime: "10:00",
      endTime: "16:00",
    });
    expect(res).toMatchObject({ error: expect.any(String) });

    // Session must be unchanged
    const fresh = await Inquiry.findById(inquiry._id).lean();
    expect(fresh?.sessions?.[0]?.startDate).toBe("2035-03-10");
    expect(fresh?.sessions?.[0]?.startTime).toBe("09:00");
  });

  // (c) Non-"new" inquiry rejected
  it("rejects rescheduling a booked inquiry", async () => {
    const { inquiry } = await seedInquiry(workspaceId, { status: "booked" });
    const res = await rescheduleInquirySessionAction({
      inquiryId: String(inquiry._id),
      sessionIndex: 0,
      startDate: "2035-03-15",
      startTime: "10:00",
      endTime: "18:00",
    });
    expect(res).toMatchObject({ error: expect.any(String) });
  });

  it("rejects rescheduling a converted inquiry", async () => {
    const { inquiry } = await seedInquiry(workspaceId, { status: "converted" });
    const res = await rescheduleInquirySessionAction({
      inquiryId: String(inquiry._id),
      sessionIndex: 0,
      startDate: "2035-03-15",
      startTime: "10:00",
      endTime: "18:00",
    });
    expect(res).toMatchObject({ error: expect.any(String) });
  });

  // (d) Tenant isolation
  it("does not find or mutate an inquiry belonging to another workspace", async () => {
    const { inquiry } = await seedInquiry(otherWorkspaceId);
    const res = await rescheduleInquirySessionAction({
      inquiryId: String(inquiry._id),
      sessionIndex: 0,
      startDate: "2035-03-15",
      startTime: "10:00",
      endTime: "18:00",
    });
    expect(res).toMatchObject({ error: expect.any(String) });

    // The other workspace's inquiry must remain unchanged
    const fresh = await Inquiry.findById(inquiry._id).lean();
    expect(fresh?.sessions?.[0]?.startDate).toBe("2035-03-10");
  });

  // (e) Idempotency
  it("applying the same payload twice yields identical stored state", async () => {
    const { inquiry } = await seedInquiry(workspaceId);
    const input = {
      inquiryId: String(inquiry._id),
      sessionIndex: 0,
      startDate: "2035-03-25",
      startTime: "11:00",
      endTime: "19:00",
    };
    const res1 = await rescheduleInquirySessionAction(input);
    const res2 = await rescheduleInquirySessionAction(input);

    expect(res1).toEqual({ ok: true });
    expect(res2).toEqual({ ok: true });

    const fresh = await Inquiry.findById(inquiry._id).lean();
    expect(fresh?.sessions?.[0]?.startDate).toBe("2035-03-25");
    expect(fresh?.sessions?.[0]?.startTime).toBe("11:00");
    expect(fresh?.sessions?.[0]?.endTime).toBe("19:00");
  });

  // Validation edge cases
  it("rejects invalid sessionIndex (out of bounds)", async () => {
    const { inquiry } = await seedInquiry(workspaceId);
    const res = await rescheduleInquirySessionAction({
      inquiryId: String(inquiry._id),
      sessionIndex: 5,
      startDate: "2035-03-15",
      startTime: "10:00",
      endTime: "18:00",
    });
    expect(res).toMatchObject({ error: expect.any(String) });
  });

  it("rejects when endTime <= startTime", async () => {
    const { inquiry } = await seedInquiry(workspaceId);
    const res = await rescheduleInquirySessionAction({
      inquiryId: String(inquiry._id),
      sessionIndex: 0,
      startDate: "2035-03-15",
      startTime: "17:00",
      endTime: "09:00",
    });
    expect(res).toMatchObject({ error: expect.any(String) });
  });

  it("rejects an invalid date format", async () => {
    const { inquiry } = await seedInquiry(workspaceId);
    const res = await rescheduleInquirySessionAction({
      inquiryId: String(inquiry._id),
      sessionIndex: 0,
      startDate: "not-a-date",
      startTime: "10:00",
      endTime: "18:00",
    });
    expect(res).toMatchObject({ error: expect.any(String) });
  });

  it("rejects an invalid (non-ObjectId) inquiryId via schema and returns an error", async () => {
    // The rescheduleSessionSchema now validates inquiryId as a valid ObjectId.
    const res = await rescheduleInquirySessionAction({
      inquiryId: "not-an-objectid",
      sessionIndex: 0,
      startDate: "2035-03-15",
      startTime: "10:00",
      endTime: "18:00",
    });
    expect(res).toMatchObject({ error: expect.any(String) });
    // Must not have touched the DB — no inquiries were created in this test.
    const count = await Inquiry.countDocuments({});
    expect(count).toBe(0);
  });

  // (f) Draft booking sync
  it("syncs the draft booking sessions, firstSessionStart, and lastSessionEnd after a successful reschedule", async () => {
    const { inquiry, booking } = await seedInquiry(workspaceId);
    const res = await rescheduleInquirySessionAction({
      inquiryId: String(inquiry._id),
      sessionIndex: 0,
      startDate: "2035-04-01",
      startTime: "10:00",
      endTime: "18:00",
    });
    expect(res).toEqual({ ok: true });

    const freshBooking = await Booking.findById(booking._id).lean();
    expect(freshBooking).not.toBeNull();

    // The rescheduled wall-clock time in Asia/Manila is UTC-8 (UTC+8 means -8h offset).
    // 2035-04-01 10:00 Asia/Manila = 2035-04-01T02:00:00Z
    // 2035-04-01 18:00 Asia/Manila = 2035-04-01T10:00:00Z
    const expectedStart = new Date(wallTimeInTzToUtc("2035-04-01", "10:00", "Asia/Manila"));
    const expectedEnd = new Date(wallTimeInTzToUtc("2035-04-01", "18:00", "Asia/Manila"));

    const sessions = freshBooking?.sessions as { startAt: Date; endAt: Date }[] | undefined;
    expect(sessions).toHaveLength(1);
    expect(new Date(sessions![0].startAt).toISOString()).toBe(expectedStart.toISOString());
    expect(new Date(sessions![0].endAt).toISOString()).toBe(expectedEnd.toISOString());
    expect(new Date(freshBooking!.firstSessionStart!).toISOString()).toBe(expectedStart.toISOString());
    expect(new Date(freshBooking!.lastSessionEnd!).toISOString()).toBe(expectedEnd.toISOString());
  });
});
