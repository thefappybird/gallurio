import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

const workspaceId = new Types.ObjectId();
const otherWorkspaceId = new Types.ObjectId();
let mockCtx: { userId: string; role: "owner" | "staff"; workspaceId: Types.ObjectId; timezone?: string };

vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: async () => ({
    userId: mockCtx.userId,
    clerkOrgId: "org_test",
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

vi.mock("@/lib/bookings/shift-conflicts", () => ({
  getShiftsOnDate: vi.fn().mockResolvedValue([]),
}));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Inquiry, Booking, Client } from "@/lib/db/models";
import {
  approveInquiryBookingAction,
  saveDraftBookingFieldsAction,
  archiveInquiryAction,
  editInquirySessionsAction,
} from "./_actions";
import { getShiftsOnDate } from "@/lib/bookings/shift-conflicts";

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

async function seedDraft(wid: Types.ObjectId) {
  const client = await Client.create({
    workspaceId: wid,
    name: "Emma Carter",
    email: "emma@example.com",
    source: "form",
  });
  const start = new Date("2030-08-15T02:00:00Z");
  const booking = await Booking.create({
    workspaceId: wid,
    clientId: client._id,
    clientName: "Emma Carter",
    title: "Emma Carter — inquiry",
    status: "draft",
    sessions: [{ startAt: start, endAt: start }],
    firstSessionStart: start,
    lastSessionEnd: start,
    amount: { total: 0, deposit: 0, currency: "PHP" },
  });
  const inquiry = await Inquiry.create({
    workspaceId: wid,
    name: "Emma Carter",
    email: "emma@example.com",
    status: "new",
    eventDate: new Date("2030-08-15T00:00:00Z"),
    clientId: client._id,
    draftBookingId: booking._id,
  });
  return { client, booking, inquiry };
}

describe("approveInquiryBookingAction", () => {
  it("promotes the draft, applies edits, and marks the inquiry booked", async () => {
    const { booking, inquiry, client } = await seedDraft(workspaceId);

    const res = await approveInquiryBookingAction(String(inquiry._id), {
      total: 75000,
      deposit: 25000,
      notes: "VIP",
    });
    expect(res).toMatchObject({ ok: true, bookingId: String(booking._id) });

    const freshBooking = await Booking.findById(booking._id).lean();
    expect(freshBooking?.status).toBe("booked");
    expect(freshBooking?.amount?.total).toBe(75000);
    expect(freshBooking?.amount?.deposit).toBe(25000);
    expect(freshBooking?.notes).toBe("VIP");

    const freshInquiry = await Inquiry.findById(inquiry._id).lean();
    expect(freshInquiry?.status).toBe("booked");
    expect(String(freshInquiry?.convertedBookingId)).toBe(String(booking._id));
    expect(String(freshInquiry?.convertedClientId)).toBe(String(client._id));

    // The deposit was recorded against the client's financials.
    const freshClient = await Client.findById(client._id).lean();
    expect(freshClient?.totalSpent).toBe(25000);
    expect(freshClient?.bookingsCount).toBe(1);
  });

  it("is idempotent — re-approving does not double-count", async () => {
    const { booking, inquiry, client } = await seedDraft(workspaceId);
    await approveInquiryBookingAction(String(inquiry._id), { deposit: 10000 });

    const second = await approveInquiryBookingAction(String(inquiry._id));
    expect(second).toMatchObject({ ok: true, idempotent: true, bookingId: String(booking._id) });

    const freshClient = await Client.findById(client._id).lean();
    expect(freshClient?.bookingsCount).toBe(1); // not 2
    expect(freshClient?.totalSpent).toBe(10000);
  });

  it("treats a legacy converted inquiry as already booked", async () => {
    const { booking, inquiry } = await seedDraft(workspaceId);
    await Inquiry.updateOne(
      { _id: inquiry._id },
      { $set: { status: "converted", convertedBookingId: booking._id } }
    );

    const res = await approveInquiryBookingAction(String(inquiry._id));
    expect(res).toMatchObject({ ok: true, idempotent: true, bookingId: String(booking._id) });
  });

  it("refuses a non-owner (staff) and leaves the draft untouched", async () => {
    const { booking, inquiry } = await seedDraft(workspaceId);
    mockCtx.role = "staff";

    const res = await approveInquiryBookingAction(String(inquiry._id));
    expect(res).toEqual({ error: "owner_only" });
    expect((await Booking.findById(booking._id).lean())?.status).toBe("draft");
  });

  it("cannot approve another workspace's inquiry (tenant isolation)", async () => {
    const { inquiry } = await seedDraft(otherWorkspaceId);
    const res = await approveInquiryBookingAction(String(inquiry._id));
    expect(res).toEqual({ error: "not_found" });
  });

  it("returns missing_draft when the linked booking is gone", async () => {
    const { inquiry, booking } = await seedDraft(workspaceId);
    await Booking.deleteOne({ _id: booking._id });
    const res = await approveInquiryBookingAction(String(inquiry._id));
    expect(res).toEqual({ error: "missing_draft" });
  });

  it("rejects a deposit greater than the total", async () => {
    const { inquiry } = await seedDraft(workspaceId);
    const res = await approveInquiryBookingAction(String(inquiry._id), { total: 100, deposit: 200 });
    expect("error" in res).toBe(true);
  });
});

describe("saveDraftBookingFieldsAction", () => {
  it("persists edits to the draft without marking the inquiry booked", async () => {
    const { booking, inquiry } = await seedDraft(workspaceId);
    const res = await saveDraftBookingFieldsAction(String(inquiry._id), {
      total: 5000,
      notes: "hold",
    });
    expect(res).toEqual({ ok: true });

    const fresh = await Booking.findById(booking._id).lean();
    expect(fresh?.amount?.total).toBe(5000);
    expect(fresh?.notes).toBe("hold");
    expect(fresh?.status).toBe("draft"); // still a draft
    expect((await Inquiry.findById(inquiry._id).lean())?.status).toBe("new");
  });

  it("is owner-only", async () => {
    const { inquiry } = await seedDraft(workspaceId);
    mockCtx.role = "staff";
    const res = await saveDraftBookingFieldsAction(String(inquiry._id), { total: 1 });
    expect(res).toEqual({ error: "owner_only" });
  });
});


describe("archiveInquiryAction", () => {
  it("archives a new inquiry", async () => {
    const { inquiry } = await seedDraft(workspaceId);
    const res = await archiveInquiryAction(String(inquiry._id));
    expect(res).toEqual({ ok: true });
    expect((await Inquiry.findById(inquiry._id).lean())?.status).toBe("archived");
  });

  it("refuses to archive a booked inquiry", async () => {
    const { inquiry } = await seedDraft(workspaceId);
    await Inquiry.updateOne({ _id: inquiry._id }, { $set: { status: "booked" } });
    const res = await archiveInquiryAction(String(inquiry._id));
    expect(res).toEqual({ error: "not_found" });
  });

  it("cannot archive across workspaces", async () => {
    const { inquiry } = await seedDraft(otherWorkspaceId);
    const res = await archiveInquiryAction(String(inquiry._id));
    expect(res).toEqual({ error: "not_found" });
  });
});

// ---------------------------------------------------------------------------
// editInquirySessionsAction
// ---------------------------------------------------------------------------

// A future date far enough away to avoid past-date validation failures.
function futureDateStr(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function seedInquiryWithDraft(
  wid: Types.ObjectId,
  overrides: Partial<{
    status: string;
    sessions: Array<{ startDate: string; startTime: string; endTime: string }>;
  }> = {}
) {
  const client = await Client.create({
    workspaceId: wid,
    name: "Test Client",
    email: "test@example.com",
    source: "form",
  });
  const startDate = futureDateStr(10);
  const sessions = overrides.sessions ?? [
    { startDate, startTime: "09:00", endTime: "17:00" },
  ];
  // Use a UTC start corresponding to Manila wall time
  const utcStart = new Date(`${startDate}T01:00:00Z`); // 09:00 Manila
  const utcEnd = new Date(`${startDate}T09:00:00Z`);   // 17:00 Manila
  const booking = await Booking.create({
    workspaceId: wid,
    clientId: client._id,
    clientName: "Test Client",
    title: "Test Client — inquiry",
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

describe("editInquirySessionsAction", () => {
  beforeEach(() => {
    // Reset getShiftsOnDate mock to return no shifts by default
    vi.mocked(getShiftsOnDate).mockResolvedValue([]);
  });

  it("returns not_found when inquiry does not exist", async () => {
    const fakeId = new Types.ObjectId().toString();
    const res = await editInquirySessionsAction(fakeId, {
      sessions: [{ startDate: futureDateStr(10), startTime: "09:00", endTime: "17:00" }],
    });
    expect(res).toEqual({ error: "not_found" });
  });

  it("returns locked when inquiry status is booked", async () => {
    const { inquiry } = await seedInquiryWithDraft(workspaceId, { status: "booked" });
    const res = await editInquirySessionsAction(String(inquiry._id), {
      sessions: [{ startDate: futureDateStr(10), startTime: "09:00", endTime: "17:00" }],
    });
    expect(res).toEqual({ error: "locked" });
  });

  it("returns invalid when session date is in the past", async () => {
    const { inquiry } = await seedInquiryWithDraft(workspaceId);
    const res = await editInquirySessionsAction(String(inquiry._id), {
      sessions: [{ startDate: yesterdayStr(), startTime: "09:00", endTime: "17:00" }],
    });
    expect(res).toEqual({ error: "invalid" });
  });

  it("returns alter_only when session count changes", async () => {
    // Original inquiry has 1 session; we try to submit 2
    const { inquiry } = await seedInquiryWithDraft(workspaceId);
    const future = futureDateStr(10);
    const future2 = futureDateStr(12);
    const res = await editInquirySessionsAction(String(inquiry._id), {
      sessions: [
        { startDate: future, startTime: "09:00", endTime: "17:00" },
        { startDate: future2, startTime: "09:00", endTime: "17:00" },
      ],
    });
    expect(res).toEqual({ error: "alter_only" });
  });

  it("returns conflict when getShiftsOnDate returns an overlapping shift", async () => {
    const { inquiry } = await seedInquiryWithDraft(workspaceId);
    // Mock an overlapping shift: 08:00–18:00 overlaps 09:00–17:00
    vi.mocked(getShiftsOnDate).mockResolvedValue([
      {
        id: "other",
        bookingId: "other",
        sessionIndex: 0,
        title: "Other Booking",
        shiftStart: "08:00",
        shiftEnd: "18:00",
      },
    ]);
    const res = await editInquirySessionsAction(String(inquiry._id), {
      sessions: [{ startDate: futureDateStr(10), startTime: "09:00", endTime: "17:00" }],
    });
    expect(res).toEqual({ error: "conflict" });
  });

  it("returns ok and updates inquiry sessions and phone on success", async () => {
    const { inquiry } = await seedInquiryWithDraft(workspaceId);
    const newDate = futureDateStr(15);
    const res = await editInquirySessionsAction(String(inquiry._id), {
      sessions: [{ startDate: newDate, startTime: "10:00", endTime: "16:00" }],
      phone: "+63 900 111 2222",
    });
    expect(res).toEqual({ ok: true });

    const fresh = await Inquiry.findById(inquiry._id).lean();
    expect(fresh?.sessions?.[0]?.startDate).toBe(newDate);
    expect(fresh?.phone).toBe("+63 900 111 2222");
  });

  it("regenerates draft booking with updated firstSessionStart after successful edit", async () => {
    const { inquiry, booking } = await seedInquiryWithDraft(workspaceId);
    const newDate = futureDateStr(20);
    await editInquirySessionsAction(String(inquiry._id), {
      sessions: [{ startDate: newDate, startTime: "10:00", endTime: "16:00" }],
    });

    const freshBooking = await Booking.findById(booking._id).lean();
    // firstSessionStart must be after the original (which was futureDateStr(10))
    const originalStart = new Date(`${futureDateStr(10)}T01:00:00Z`);
    expect(freshBooking?.firstSessionStart?.getTime()).toBeGreaterThan(originalStart.getTime());
  });
});
