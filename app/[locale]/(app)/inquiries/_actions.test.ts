import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

const sendBookingConfirmedClientMock = vi.fn().mockResolvedValue(undefined);
const sendBookingConfirmedOwnerMock = vi.fn().mockResolvedValue(undefined);
const sendNotificationMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/email/booking/bookingConfirmed", () => ({
  sendBookingConfirmedClient: (...args: unknown[]) => sendBookingConfirmedClientMock(...args),
  sendBookingConfirmedOwner: (...args: unknown[]) => sendBookingConfirmedOwnerMock(...args),
}));

vi.mock("@/lib/notifications/send", () => ({
  sendNotification: (...args: unknown[]) => sendNotificationMock(...args),
}));

const workspaceId = new Types.ObjectId();
const otherWorkspaceId = new Types.ObjectId();
let mockCtx: {
  userId: string;
  role: "owner" | "staff";
  workspaceId: Types.ObjectId;
  timezone?: string;
  ownerUserId?: string;
  contactEmail?: string;
};

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
      ownerUserId: mockCtx.ownerUserId ?? "user_owner",
      contact: { email: mockCtx.contactEmail ?? "owner@studio.test" },
    },
  }),
}));

vi.mock("@/lib/bookings/shift-conflicts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bookings/shift-conflicts")>();
  return {
    ...actual,
    getShiftsOnDate: vi.fn().mockResolvedValue([]),
  };
});

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Inquiry, Booking, Client } from "@/lib/db/models";
const sendInquiryDeclineClientMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email/booking/inquiryDecline", () => ({
  sendInquiryDeclineClient: (...args: unknown[]) => sendInquiryDeclineClientMock(...args),
}));

import {
  approveInquiryBookingAction,
  saveDraftBookingFieldsAction,
  archiveInquiryAction,
  declineInquiryAction,
  editInquirySessionsAction,
  findInquiryClientMatchesAction,
  getInquiryDetailAction,
  resolveInquiryClientAction,
} from "./_actions";
import { getShiftsOnDate } from "@/lib/bookings/shift-conflicts";
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
  sendBookingConfirmedClientMock.mockReset();
  sendBookingConfirmedOwnerMock.mockReset();
  sendNotificationMock.mockReset();
  sendInquiryDeclineClientMock.mockReset();
  sendBookingConfirmedClientMock.mockResolvedValue(undefined);
  sendBookingConfirmedOwnerMock.mockResolvedValue(undefined);
  sendNotificationMock.mockResolvedValue(undefined);
  sendInquiryDeclineClientMock.mockResolvedValue(undefined);
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
    status: "inquiry",
    eventDate: new Date("2030-08-15T00:00:00Z"),
    clientId: client._id,
    draftBookingId: booking._id,
  });
  return { client, booking, inquiry };
}

/**
 * Seeds an inquiry with wall-clock sessions and a matching draft booking.
 */
async function seedDraftWithSessions(
  wid: Types.ObjectId,
  sessions: Array<{ startDate: string; startTime: string; endTime: string }>,
  tz = "Asia/Manila"
) {
  const client = await Client.create({
    workspaceId: wid,
    name: "Session Client",
    email: "session@example.com",
    source: "form",
  });
  const first = sessions[0];
  const utcStart = new Date(wallTimeInTzToUtc(first.startDate, first.startTime, tz));
  const utcEnd = new Date(wallTimeInTzToUtc(first.startDate, first.endTime, tz));
  const booking = await Booking.create({
    workspaceId: wid,
    clientId: client._id,
    clientName: "Session Client",
    title: "Session Client — inquiry",
    status: "draft",
    sessions: [{ startAt: utcStart, endAt: utcEnd }],
    firstSessionStart: utcStart,
    lastSessionEnd: utcEnd,
    amount: { total: 0, deposit: 0, currency: "PHP" },
  });
  const inquiry = await Inquiry.create({
    workspaceId: wid,
    name: "Session Client",
    email: "session@example.com",
    status: "inquiry",
    eventDate: utcStart,
    clientId: client._id,
    draftBookingId: booking._id,
    sessions,
  });
  return { client, booking, inquiry };
}

/** Seed a real (non-draft, non-cancelled) booking that occupies a time slot. */
async function seedConflictingBooking(
  wid: Types.ObjectId,
  startDate: string,
  startTime: string,
  endTime: string,
  tz = "Asia/Manila"
) {
  const conflictClient = await Client.create({
    workspaceId: wid,
    name: "Conflict Client",
    email: "conflict@example.com",
    source: "form",
  });
  const startAt = new Date(wallTimeInTzToUtc(startDate, startTime, tz));
  const endAt = new Date(wallTimeInTzToUtc(startDate, endTime, tz));
  return Booking.create({
    workspaceId: wid,
    clientId: conflictClient._id,
    clientName: "Conflict Client",
    title: "Conflict Booking",
    status: "booked",
    sessions: [{ startAt, endAt }],
    firstSessionStart: startAt,
    lastSessionEnd: endAt,
    amount: { total: 0, deposit: 0, currency: "PHP" },
  });
}

describe("getInquiryDetailAction", () => {
  it("returns only the selected workspace inquiry for a client-side detail open", async () => {
    const { inquiry, booking } = await seedDraftWithSessions(workspaceId, [
      { startDate: "2030-08-15", startTime: "10:00", endTime: "12:00" },
    ]);

    const result = await getInquiryDetailAction(String(inquiry._id), "en");

    expect(result).toMatchObject({
      ok: true,
      detail: {
        inquiryId: String(inquiry._id),
        locale: "en",
        booking: { id: String(booking._id), teamId: null },
        hasConflict: false,
      },
    });
  });
});

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
    await approveInquiryBookingAction(String(inquiry._id), { total: 50000, deposit: 10000 });

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

  it("rejects a deposit-only edit when the booking has no total set (deposit requires total invariant)", async () => {
    const { inquiry } = await seedDraft(workspaceId); // booking seeded with total: 0
    const res = await approveInquiryBookingAction(String(inquiry._id), { deposit: 1000 });
    expect(res).toEqual({ error: "Cannot add a deposit without setting a price" });
  });

  it("returns { error: 'conflict' } and does NOT convert when the inquiry session conflicts with a real booking", async () => {
    const { inquiry, booking } = await seedDraftWithSessions(workspaceId, [
      { startDate: "2035-06-20", startTime: "09:00", endTime: "17:00" },
    ]);
    await seedConflictingBooking(workspaceId, "2035-06-20", "08:00", "18:00");

    const res = await approveInquiryBookingAction(String(inquiry._id));
    expect(res).toEqual({ error: "conflict" });

    const freshBooking = await Booking.findById(booking._id).lean();
    expect(freshBooking?.status).toBe("draft");

    const freshInquiry = await Inquiry.findById(inquiry._id).lean();
    expect(freshInquiry?.status).toBe("inquiry");
    expect(freshInquiry?.convertedBookingId).toBeNull();
  });

  it("converts successfully when there is no conflict", async () => {
    const { inquiry, booking } = await seedDraftWithSessions(workspaceId, [
      { startDate: "2035-07-10", startTime: "09:00", endTime: "17:00" },
    ]);
    const res = await approveInquiryBookingAction(String(inquiry._id));
    expect(res).toMatchObject({ ok: true, bookingId: String(booking._id) });
    const freshBooking = await Booking.findById(booking._id).lean();
    expect(freshBooking?.status).toBe("booked");
  });

  it("does not self-conflict: approval succeeds when only the inquiry's own draft occupies the slot", async () => {
    // No other booking seeded — only the draft booking itself is on that date.
    const { inquiry } = await seedDraftWithSessions(workspaceId, [
      { startDate: "2035-08-05", startTime: "10:00", endTime: "18:00" },
    ]);
    const res = await approveInquiryBookingAction(String(inquiry._id));
    expect(res).toMatchObject({ ok: true });
  });

  it("fires sendBookingConfirmedClient with the client email after successful approval", async () => {
    const { inquiry } = await seedDraft(workspaceId);
    await approveInquiryBookingAction(String(inquiry._id));
    expect(sendBookingConfirmedClientMock).toHaveBeenCalledOnce();
    const arg = sendBookingConfirmedClientMock.mock.calls[0][0];
    expect(arg.clientEmail).toBe("emma@example.com");
  });

  it("fires sendBookingConfirmedOwner with the booking id after successful approval", async () => {
    const { inquiry, booking } = await seedDraft(workspaceId);
    await approveInquiryBookingAction(String(inquiry._id));
    expect(sendBookingConfirmedOwnerMock).toHaveBeenCalledOnce();
    const arg = sendBookingConfirmedOwnerMock.mock.calls[0][0];
    expect(arg.bookingId).toBe(String(booking._id));
    expect(arg.ownerEmail).toBe("owner@studio.test");
  });

  it("fires sendNotification with booking.team_assigned and the booking id", async () => {
    const { inquiry, booking } = await seedDraft(workspaceId);
    await approveInquiryBookingAction(String(inquiry._id));
    // Poll until the fire-and-forget notification settles (robust under load).
    await vi.waitFor(() => expect(sendNotificationMock).toHaveBeenCalledOnce());
    const arg = sendNotificationMock.mock.calls[0][0];
    expect(arg.type).toBe("booking.team_assigned");
    expect(arg.entityId).toBe(String(booking._id));
  });

  it("falls back to owner notification when booking has no teamId", async () => {
    const { inquiry } = await seedDraft(workspaceId);
    mockCtx.ownerUserId = "user_owner";
    await approveInquiryBookingAction(String(inquiry._id));
    await vi.waitFor(() => expect(sendNotificationMock).toHaveBeenCalledOnce());
    const arg = sendNotificationMock.mock.calls[0][0];
    // Owner fallback: single recipient with the owner's workosUserId
    expect(arg.recipients).toHaveLength(1);
    expect(arg.recipients[0].workosUserId).toBe("user_owner");
  });

  it("returns needs_client_resolution when an unresolved matching client exists", async () => {
    const { inquiry, booking } = await seedDraft(workspaceId); // Emma Carter, emma@example.com
    await Client.create({
      workspaceId,
      name: "Someone Else",
      email: "emma@example.com", // same email -> unresolved match
      source: "form",
    });

    const res = await approveInquiryBookingAction(String(inquiry._id));
    expect(res).toEqual({ error: "needs_client_resolution" });

    const freshBooking = await Booking.findById(booking._id).lean();
    expect(freshBooking?.status).toBe("draft");
  });

  it("stops gating once the owner has resolved, even if another same-name client still matches", async () => {
    // Two legitimately distinct clients share a name — a state this branch
    // explicitly supports. Recomputing the match on every approve means
    // resolving to one leaves the other matching, and the inquiry can never
    // be approved at all.
    const { inquiry } = await seedDraft(workspaceId); // Emma Carter
    const chosen = await Client.create({ workspaceId, name: "Emma Carter", source: "manual" });
    await Client.create({ workspaceId, name: "Emma Carter", source: "manual" });

    expect(await approveInquiryBookingAction(String(inquiry._id))).toEqual({
      error: "needs_client_resolution",
    });

    await resolveInquiryClientAction(String(inquiry._id), {
      clientId: String(chosen._id),
      picks: {},
    });

    expect(await approveInquiryBookingAction(String(inquiry._id))).toMatchObject({ ok: true });
  });

  it("credits the resolved (chosen) client, not the auto-created one, once resolveInquiryClientAction relinks it", async () => {
    const { inquiry, booking } = await seedDraft(workspaceId); // auto-created: Emma Carter
    // A pre-existing CRM client sharing the inquiry's email — the real duplicate
    // the owner picks instead of the inquiry's auto-created client.
    const chosen = await Client.create({
      workspaceId,
      name: "Emma Carter",
      email: "emma@example.com",
      source: "manual",
    });

    // Unresolved -> gated.
    expect(await approveInquiryBookingAction(String(inquiry._id))).toEqual({
      error: "needs_client_resolution",
    });

    await resolveInquiryClientAction(String(inquiry._id), {
      clientId: String(chosen._id),
      picks: {},
    });

    const res = await approveInquiryBookingAction(String(inquiry._id), { total: 20000, deposit: 5000 });
    expect(res).toMatchObject({ ok: true, bookingId: String(booking._id) });

    const freshChosen = await Client.findById(chosen._id).lean();
    expect(freshChosen?.bookingsCount).toBe(1);
    expect(freshChosen?.totalSpent).toBe(5000);
  });

  it("does not fire email side-effects on idempotent re-approval", async () => {
    const { inquiry } = await seedDraft(workspaceId);
    await approveInquiryBookingAction(String(inquiry._id));
    sendBookingConfirmedClientMock.mockReset();
    sendBookingConfirmedOwnerMock.mockReset();
    sendNotificationMock.mockReset();
    // Re-approve — hits the early idempotent return
    await approveInquiryBookingAction(String(inquiry._id));
    expect(sendBookingConfirmedClientMock).not.toHaveBeenCalled();
    expect(sendBookingConfirmedOwnerMock).not.toHaveBeenCalled();
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });
});

describe("findInquiryClientMatchesAction", () => {
  it("returns clients matching the inquiry's email, excluding the currently linked client", async () => {
    const { inquiry } = await seedDraft(workspaceId); // linked to Emma Carter / emma@example.com
    const otherMatch = await Client.create({
      workspaceId,
      name: "Someone Else",
      email: "emma@example.com", // same email as the inquiry -> match
      source: "form",
    });
    await Client.create({
      workspaceId,
      name: "Unrelated Person",
      email: "unrelated@example.com",
      source: "form",
    });

    const res = await findInquiryClientMatchesAction(String(inquiry._id));
    expect(res).toMatchObject({ ok: true });
    if (!("ok" in res)) throw new Error("expected ok result");
    const ids = res.matches.map((m) => m._id);
    expect(ids).toContain(String(otherMatch._id));
    expect(ids).not.toContain(String(inquiry.clientId));
    expect(ids).toHaveLength(1);
  });

  it("carries the candidate's notes so a notes-only conflict is visible before resolving", async () => {
    // Without notes on the card the dialog computes no conflict for it, so the
    // user is never asked and the stored note silently wins.
    const { inquiry } = await seedDraft(workspaceId);
    await Client.create({
      workspaceId,
      name: "Someone Else",
      email: "emma@example.com",
      notes: "Prefers morning shoots",
      source: "form",
    });

    const res = await findInquiryClientMatchesAction(String(inquiry._id));
    if (!("ok" in res)) throw new Error("expected ok result");
    expect(res.matches[0].notes).toBe("Prefers morning shoots");
  });
});

describe("resolveInquiryClientAction", () => {
  it("relinks the inquiry and its draft booking to the target client, applying reconciliation picks", async () => {
    const { inquiry, booking } = await seedDraft(workspaceId); // linked to Emma Carter, emma@example.com
    const target = await Client.create({
      workspaceId,
      name: "Emma C.",
      email: null,
      phone: "0999",
      notes: "",
      source: "manual",
    });

    const res = await resolveInquiryClientAction(String(inquiry._id), {
      clientId: String(target._id),
      picks: {},
    });
    expect(res).toMatchObject({ ok: true, clientId: String(target._id) });

    const freshInquiry = await Inquiry.findById(inquiry._id).lean();
    expect(String(freshInquiry?.clientId)).toBe(String(target._id));

    const freshBooking = await Booking.findById(booking._id).lean();
    expect(String(freshBooking?.clientId)).toBe(String(target._id));
    expect(freshBooking?.clientName).toBe("Emma C.");

    // Additive reconciliation: target had no email, inquiry's email fills it in.
    const freshTarget = await Client.findById(target._id).lean();
    expect(freshTarget?.email).toBe("emma@example.com");
  });

  it("applies the caller's pick when a reconciled field genuinely conflicts", async () => {
    const { inquiry } = await seedDraft(workspaceId); // inquiry.phone is null in this fixture
    await Inquiry.updateOne({ _id: inquiry._id }, { $set: { phone: "0917 000 1111" } });
    const target = await Client.create({
      workspaceId,
      name: "Emma C.",
      email: "emma@example.com",
      phone: "0917 999 8888", // differs from the inquiry's phone -> conflict
      source: "manual",
    });

    const res = await resolveInquiryClientAction(String(inquiry._id), {
      clientId: String(target._id),
      picks: { phone: "typed" },
    });
    expect(res).toMatchObject({ ok: true });

    const freshTarget = await Client.findById(target._id).lean();
    expect(freshTarget?.phone).toBe("0917 000 1111");
  });

  it("rejects a clientId from another workspace and writes nothing", async () => {
    const { inquiry, booking, client } = await seedDraft(workspaceId);
    const foreignClient = await Client.create({
      workspaceId: otherWorkspaceId,
      name: "Foreign Client",
      email: "foreign@example.com",
      source: "manual",
    });

    const res = await resolveInquiryClientAction(String(inquiry._id), {
      clientId: String(foreignClient._id),
      picks: {},
    });
    expect(res).toEqual({ error: "not_found" });

    const freshInquiry = await Inquiry.findById(inquiry._id).lean();
    expect(String(freshInquiry?.clientId)).toBe(String(client._id));
    const freshBooking = await Booking.findById(booking._id).lean();
    expect(String(freshBooking?.clientId)).toBe(String(client._id));
  });

  it("creates a fresh client from the inquiry's details when createNew is requested", async () => {
    const { inquiry, booking } = await seedDraft(workspaceId);

    const res = await resolveInquiryClientAction(String(inquiry._id), { createNew: true });
    expect(res).toMatchObject({ ok: true });
    if (!("ok" in res) || !res.clientId) throw new Error("expected ok result with clientId");

    const newClient = await Client.findById(res.clientId).lean();
    expect(newClient?.name).toBe("Emma Carter");
    expect(newClient?.email).toBe("emma@example.com");
    expect(newClient?.source).toBe("form");

    const freshInquiry = await Inquiry.findById(inquiry._id).lean();
    expect(String(freshInquiry?.clientId)).toBe(res.clientId);
    const freshBooking = await Booking.findById(booking._id).lean();
    expect(String(freshBooking?.clientId)).toBe(res.clientId);
  });

  it("deletes the previously-linked auto-created client once the inquiry is relinked away from it", async () => {
    const { inquiry, client } = await seedDraft(workspaceId); // Emma Carter, source: "form", untouched
    const target = await Client.create({
      workspaceId,
      name: "Someone Else",
      email: "someone@example.com",
      source: "manual",
    });

    const res = await resolveInquiryClientAction(String(inquiry._id), {
      clientId: String(target._id),
      picks: {},
    });
    expect(res).toMatchObject({ ok: true });

    const orphan = await Client.findById(client._id).lean();
    expect(orphan).toBeNull();
  });

  it("does NOT delete the previously-linked client when it has accumulated bookings/spend", async () => {
    const { inquiry, client } = await seedDraft(workspaceId);
    await Client.updateOne({ _id: client._id }, { $set: { bookingsCount: 1, totalSpent: 5000 } });
    const target = await Client.create({
      workspaceId,
      name: "Someone Else",
      email: "someone2@example.com",
      source: "manual",
    });

    const res = await resolveInquiryClientAction(String(inquiry._id), {
      clientId: String(target._id),
      picks: {},
    });
    expect(res).toMatchObject({ ok: true });

    const stillThere = await Client.findById(client._id).lean();
    expect(stillThere).not.toBeNull();
  });

  it("does NOT delete the previously-linked client when it has a transaction entry", async () => {
    const { inquiry, client, booking } = await seedDraft(workspaceId);
    await Client.updateOne(
      { _id: client._id },
      {
        $set: {
          transactions: [
            {
              bookingId: booking._id,
              amount: 100,
              currency: "PHP",
              type: "other",
              occurredAt: new Date(),
              source: "manual",
            },
          ],
        },
      }
    );
    const target = await Client.create({
      workspaceId,
      name: "Someone Else",
      email: "someone3@example.com",
      source: "manual",
    });

    const res = await resolveInquiryClientAction(String(inquiry._id), {
      clientId: String(target._id),
      picks: {},
    });
    expect(res).toMatchObject({ ok: true });

    const stillThere = await Client.findById(client._id).lean();
    expect(stillThere).not.toBeNull();
  });

  it("does NOT delete the previously-linked client when another inquiry still references it", async () => {
    const { inquiry, client } = await seedDraft(workspaceId);
    // A second, unrelated inquiry also points at the same auto-created client.
    await Inquiry.create({
      workspaceId,
      name: "Emma Carter",
      email: "emma@example.com",
      status: "inquiry",
      eventDate: new Date("2030-09-01T00:00:00Z"),
      clientId: client._id,
    });
    const target = await Client.create({
      workspaceId,
      name: "Someone Else",
      email: "someone4@example.com",
      source: "manual",
    });

    const res = await resolveInquiryClientAction(String(inquiry._id), {
      clientId: String(target._id),
      picks: {},
    });
    expect(res).toMatchObject({ ok: true });

    const stillThere = await Client.findById(client._id).lean();
    expect(stillThere).not.toBeNull();
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
    expect((await Inquiry.findById(inquiry._id).lean())?.status).toBe("inquiry");
  });

  it("is owner-only", async () => {
    const { inquiry } = await seedDraft(workspaceId);
    mockCtx.role = "staff";
    const res = await saveDraftBookingFieldsAction(String(inquiry._id), { total: 1 });
    expect(res).toEqual({ error: "owner_only" });
  });

  it("rejects a deposit-only patch when the booking total is zero (deposit requires total invariant)", async () => {
    const { inquiry } = await seedDraft(workspaceId); // booking seeded with total: 0
    const res = await saveDraftBookingFieldsAction(String(inquiry._id), { deposit: 1000 });
    expect(res).toEqual({ error: "Cannot add a deposit without setting a price" });
  });

  it("accepts a deposit-only patch when the existing booking already has a non-zero total", async () => {
    const { inquiry, booking } = await seedDraft(workspaceId);
    await Booking.updateOne({ _id: booking._id }, { $set: { "amount.total": 5000 } });
    const res = await saveDraftBookingFieldsAction(String(inquiry._id), { deposit: 1000 });
    expect(res).toEqual({ ok: true });
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

  it("cancels the orphan draft booking when archiving", async () => {
    const { inquiry, booking } = await seedDraft(workspaceId);
    const res = await archiveInquiryAction(String(inquiry._id));
    expect(res).toEqual({ ok: true });
    const freshBooking = await Booking.findById(booking._id).lean();
    expect(freshBooking?.status).toBe("cancelled");
  });

  it("does NOT call the decline email sender when archiving", async () => {
    const { inquiry } = await seedDraft(workspaceId);
    await archiveInquiryAction(String(inquiry._id));
    expect(sendInquiryDeclineClientMock).not.toHaveBeenCalled();
  });
});

describe("declineInquiryAction", () => {
  it("sets inquiry to archived and draft booking to cancelled", async () => {
    const { inquiry, booking } = await seedDraft(workspaceId);
    const res = await declineInquiryAction(String(inquiry._id));
    expect(res).toEqual({ ok: true });
    expect((await Inquiry.findById(inquiry._id).lean())?.status).toBe("archived");
    const freshBooking = await Booking.findById(booking._id).lean();
    expect(freshBooking?.status).toBe("cancelled");
  });

  it("calls the decline email sender with the client email", async () => {
    const { inquiry } = await seedDraft(workspaceId);
    await declineInquiryAction(String(inquiry._id));
    // Poll until the fire-and-forget email settles (robust under load).
    await vi.waitFor(() => expect(sendInquiryDeclineClientMock).toHaveBeenCalledOnce());
    const arg = sendInquiryDeclineClientMock.mock.calls[0][0];
    expect(arg.clientEmail).toBe("emma@example.com");
    expect(arg.clientName).toBe("Emma Carter");
  });

  it("refuses to decline a booked inquiry", async () => {
    const { inquiry } = await seedDraft(workspaceId);
    await Inquiry.updateOne({ _id: inquiry._id }, { $set: { status: "booked" } });
    const res = await declineInquiryAction(String(inquiry._id));
    expect(res).toEqual({ error: "not_found" });
  });

  it("cannot decline across workspaces", async () => {
    const { inquiry } = await seedDraft(otherWorkspaceId);
    const res = await declineInquiryAction(String(inquiry._id));
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
    status: overrides.status ?? "inquiry",
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

  it("allows a past session date so an overdue inquiry can still be corrected", async () => {
    const { inquiry } = await seedInquiryWithDraft(workspaceId);
    const sessions = [{ startDate: yesterdayStr(), startTime: "09:00", endTime: "17:00" }];
    const res = await editInquirySessionsAction(String(inquiry._id), {
      sessions,
    });
    expect(res).toEqual({ ok: true });
    expect((await Inquiry.findById(inquiry._id).lean())?.sessions).toEqual(sessions);
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
