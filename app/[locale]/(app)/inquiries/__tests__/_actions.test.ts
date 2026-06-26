import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

const workspaceId = new Types.ObjectId();

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
import {
  approveInquiryBookingAction,
  archiveInquiryAction,
  editInquirySessionsAction,
  saveDraftBookingFieldsAction,
  updateInquiryPhoneAction,
} from "../_actions";

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

// ---------------------------------------------------------------------------
// ObjectId validation guards — all 6 affected actions must short-circuit
// with { error: "not_found" } before touching the DB when the id is invalid.
// ---------------------------------------------------------------------------

describe("ObjectId validation guards", () => {
  const INVALID_ID = "not-an-objectid";

  it("approveInquiryBookingAction returns not_found for invalid inquiryId", async () => {
    const res = await approveInquiryBookingAction(INVALID_ID);
    expect(res).toEqual({ error: "not_found" });
  });

  it("saveDraftBookingFieldsAction returns not_found for invalid inquiryId", async () => {
    const res = await saveDraftBookingFieldsAction(INVALID_ID, {});
    expect(res).toEqual({ error: "not_found" });
  });

  it("archiveInquiryAction returns not_found for invalid inquiryId", async () => {
    const res = await archiveInquiryAction(INVALID_ID);
    expect(res).toEqual({ error: "not_found" });
  });

  it("editInquirySessionsAction returns not_found for invalid inquiryId", async () => {
    const res = await editInquirySessionsAction(INVALID_ID, {
      sessions: [{ startDate: "2035-01-01", startTime: "09:00", endTime: "17:00" }],
    });
    expect(res).toEqual({ error: "not_found" });
  });

  it("updateInquiryPhoneAction returns not_found for invalid inquiryId", async () => {
    const res = await updateInquiryPhoneAction(INVALID_ID, "+63 912 345 6789");
    expect(res).toEqual({ error: "not_found" });
  });
});

// ---------------------------------------------------------------------------
// updateInquiryPhoneAction — phone validation
// ---------------------------------------------------------------------------

async function seedPhoneInquiry() {
  const client = await Client.create({
    workspaceId,
    name: "Test Client",
    email: "phone-test@example.com",
    source: "form",
  });
  const utcStart = new Date("2035-03-10T01:00:00Z");
  const utcEnd = new Date("2035-03-10T09:00:00Z");
  const booking = await Booking.create({
    workspaceId,
    clientId: client._id,
    clientName: "Test Client",
    title: "Test Client -- inquiry",
    status: "draft",
    sessions: [{ startAt: utcStart, endAt: utcEnd }],
    firstSessionStart: utcStart,
    lastSessionEnd: utcEnd,
    amount: { total: 0, deposit: 0, currency: "PHP" },
  });
  return Inquiry.create({
    workspaceId,
    name: "Test Client",
    email: "phone-test@example.com",
    status: "inquiry",
    eventDate: utcStart,
    clientId: client._id,
    draftBookingId: booking._id,
    sessions: [{ startDate: "2035-03-10", startTime: "09:00", endTime: "17:00" }],
  });
}

describe("updateInquiryPhoneAction phone validation", () => {
  it("accepts a valid phone number and persists it", async () => {
    const inquiry = await seedPhoneInquiry();
    const res = await updateInquiryPhoneAction(String(inquiry._id), "+63 912 345 6789");
    expect(res).toEqual({ ok: true });
    const fresh = await Inquiry.findById(inquiry._id).lean();
    expect(fresh?.phone).toBe("+63 912 345 6789");
  });

  it("accepts an empty string and clears the phone", async () => {
    const inquiry = await seedPhoneInquiry();
    const res = await updateInquiryPhoneAction(String(inquiry._id), "");
    expect(res).toEqual({ ok: true });
    const fresh = await Inquiry.findById(inquiry._id).lean();
    expect(fresh?.phone ?? null).toBeNull();
  });

  it("rejects a phone that is too short (< 7 chars) with invalid_input", async () => {
    const inquiry = await seedPhoneInquiry();
    const res = await updateInquiryPhoneAction(String(inquiry._id), "123");
    expect(res).toEqual({ error: "invalid_input" });
    const fresh = await Inquiry.findById(inquiry._id).lean();
    // phone field should not have been set
    expect(fresh?.phone ?? null).toBeNull();
  });

  it("rejects a phone exceeding 30 chars with invalid_input", async () => {
    const inquiry = await seedPhoneInquiry();
    const longPhone = "+63 912 " + "9".repeat(30);
    const res = await updateInquiryPhoneAction(String(inquiry._id), longPhone);
    expect(res).toEqual({ error: "invalid_input" });
  });
});
