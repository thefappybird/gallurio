import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

const workspaceId = new Types.ObjectId();
const otherWorkspaceId = new Types.ObjectId();
let mockCtx: { userId: string; role: "owner" | "staff"; workspaceId: Types.ObjectId };

vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: async () => ({
    userId: mockCtx.userId,
    clerkOrgId: "org_test",
    role: mockCtx.role,
    workspace: { _id: mockCtx.workspaceId, currency: "PHP", name: "Test", slug: "t" },
  }),
}));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Inquiry, Booking, Client } from "@/lib/db/models";
import {
  approveInquiryBookingAction,
  saveDraftBookingFieldsAction,
  markContactedAction,
  archiveInquiryAction,
} from "./_actions";

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
    clientId: client._id,
    draftBookingId: booking._id,
  });
  return { client, booking, inquiry };
}

describe("approveInquiryBookingAction", () => {
  it("promotes the draft, applies edits, and converts the inquiry", async () => {
    const { booking, inquiry, client } = await seedDraft(workspaceId);

    const res = await approveInquiryBookingAction(String(inquiry._id), {
      total: 75000,
      deposit: 25000,
      notes: "VIP",
    });
    expect(res).toMatchObject({ ok: true, bookingId: String(booking._id) });

    const freshBooking = await Booking.findById(booking._id).lean();
    expect(freshBooking?.status).toBe("inquiry");
    expect(freshBooking?.amount?.total).toBe(75000);
    expect(freshBooking?.amount?.deposit).toBe(25000);
    expect(freshBooking?.notes).toBe("VIP");

    const freshInquiry = await Inquiry.findById(inquiry._id).lean();
    expect(freshInquiry?.status).toBe("converted");
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
  it("persists edits to the draft without converting", async () => {
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

describe("markContactedAction", () => {
  it("moves a new inquiry to contacted", async () => {
    const { inquiry } = await seedDraft(workspaceId);
    const res = await markContactedAction(String(inquiry._id));
    expect(res).toEqual({ ok: true });
    expect((await Inquiry.findById(inquiry._id).lean())?.status).toBe("contacted");
  });

  it("will not re-open a converted inquiry", async () => {
    const { inquiry } = await seedDraft(workspaceId);
    await Inquiry.updateOne({ _id: inquiry._id }, { $set: { status: "converted" } });
    const res = await markContactedAction(String(inquiry._id));
    expect(res).toEqual({ error: "not_found" });
  });
});

describe("archiveInquiryAction", () => {
  it("archives a new inquiry", async () => {
    const { inquiry } = await seedDraft(workspaceId);
    const res = await archiveInquiryAction(String(inquiry._id));
    expect(res).toEqual({ ok: true });
    expect((await Inquiry.findById(inquiry._id).lean())?.status).toBe("archived");
  });

  it("refuses to archive a converted inquiry", async () => {
    const { inquiry } = await seedDraft(workspaceId);
    await Inquiry.updateOne({ _id: inquiry._id }, { $set: { status: "converted" } });
    const res = await archiveInquiryAction(String(inquiry._id));
    expect(res).toEqual({ error: "not_found" });
  });

  it("cannot archive across workspaces", async () => {
    const { inquiry } = await seedDraft(otherWorkspaceId);
    const res = await archiveInquiryAction(String(inquiry._id));
    expect(res).toEqual({ error: "not_found" });
  });
});
