import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

const sendInquiryNotification = vi.fn().mockResolvedValue({ ok: true, id: null, skipped: true });
vi.mock("@/lib/email/inquiryNotification", () => ({
  sendInquiryNotification: (...args: unknown[]) => sendInquiryNotification(...args),
}));

const sendInquiryClientConfirmation = vi.fn().mockResolvedValue({
  ok: true,
  id: null,
  skipped: true,
});
vi.mock("@/lib/email/inquiryClientConfirmation", () => ({
  sendInquiryClientConfirmation: (...args: unknown[]) => sendInquiryClientConfirmation(...args),
}));

const sendNotification = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/notifications/send", () => ({
  sendNotification: (...args: unknown[]) => sendNotification(...args),
}));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Workspace, Client, Inquiry, Booking, PageviewRollup } from "@/lib/db/models";
import { localDayStart } from "@/lib/utils/timezone";
import { submitInquiry } from "./inquirySubmission";
import type { InquirySubmissionInput } from "@/lib/validators/inquiry";

function makeWorkspace(overrides: Record<string, unknown> = {}) {
  return {
    slug: "studio-aurora",
    name: "Studio Aurora",
    ownerUserId: "user_owner",
    clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`,
    currency: "PHP",
    timezone: "Asia/Manila",
    publicPage: { publishedAt: new Date(), inquiryRecipientEmail: "owner@studio.test" },
    ...overrides,
  };
}

function makePayload(overrides: Partial<InquirySubmissionInput> = {}): InquirySubmissionInput {
  return {
    name: "Emma Carter",
    email: "emma@example.com",
    phone: "+63 900 000 0000",
    preferredContact: "email",
    eventTitle: "Emma & Noah Wedding",
    sessions: [{ startDate: "2030-08-15", startTime: "10:00", endTime: "18:00" }],
    eventType: "wedding",
    location: {
      label: "Tagaytay Highlands",
      address: "Tagaytay, Cavite, Philippines",
      placeId: "place_tagaytay",
      lat: 14.1154,
      lng: 120.9621,
    },
    description: "Looking for full-day coverage.",
    company_name: "",
    ...overrides,
  } as InquirySubmissionInput;
}

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
  sendInquiryNotification.mockClear();
  sendInquiryClientConfirmation.mockClear();
  sendNotification.mockClear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("submitInquiry", () => {
  it("bumps the portfolio analytics inquiry counter for the workspace-local day", async () => {
    const ws = await Workspace.create(makeWorkspace());
    const res = await submitInquiry({ workspaceSlug: "studio-aurora", payload: makePayload() });
    expect(res.ok).toBe(true);

    const day = localDayStart("Asia/Manila", new Date());
    const site = await PageviewRollup.findOne({
      workspaceId: ws._id,
      date: day,
      page: "_site",
    }).lean();
    expect(site?.inquiries).toBe(1);
  });

  it("creates one inquiry, one client, and one linked draft booking", async () => {
    const ws = await Workspace.create(makeWorkspace());
    const res = await submitInquiry({ workspaceSlug: "studio-aurora", payload: makePayload() });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const inquiries = await Inquiry.find({ workspaceId: ws._id }).lean();
    const clients = await Client.find({ workspaceId: ws._id }).lean();
    const bookings = await Booking.find({ workspaceId: ws._id }).lean();

    expect(inquiries).toHaveLength(1);
    expect(clients).toHaveLength(1);
    expect(bookings).toHaveLength(1);

    const inquiry = inquiries[0];
    const client = clients[0];
    const booking = bookings[0];

    expect(booking.status).toBe("draft");
    expect(String(booking.createdFromInquiryId)).toBe(String(inquiry._id));
    expect(String(inquiry.draftBookingId)).toBe(String(booking._id));
    expect(String(inquiry.clientId)).toBe(String(client._id));
    expect(String(booking.clientId)).toBe(String(client._id));
    expect(client.source).toBe("form");
    expect(client.email).toBe("emma@example.com");
    expect(inquiry.status).toBe("inquiry");
    expect(inquiry.convertedBookingId).toBeNull();
    expect(inquiry.eventTitle).toBe("Emma & Noah Wedding");
    expect(booking.title).toBe("Emma & Noah Wedding");
    expect(booking.location).toMatchObject({
      address: "Tagaytay, Cavite, Philippines",
      lat: 14.1154,
      lng: 120.9621,
    });
    expect(inquiry.source).toMatchObject({ kind: "portfolio" });
    // Sessions converted to UTC instants on the booking.
    expect(booking.sessions).toHaveLength(1);
  });

  it("reuses an existing client with the same email in the same workspace", async () => {
    const ws = await Workspace.create(makeWorkspace());
    await Client.create({
      workspaceId: ws._id,
      name: "Emma C.",
      email: "emma@example.com",
      phone: null,
      source: "manual",
    });

    const res = await submitInquiry({
      workspaceSlug: "studio-aurora",
      payload: makePayload({ phone: "+63 111 222 3333" }),
    });
    expect(res.ok).toBe(true);

    const clients = await Client.find({ workspaceId: ws._id }).lean();
    expect(clients).toHaveLength(1);
    // Phone backfilled because the existing client had none.
    expect(clients[0].phone).toBe("+63 111 222 3333");
    // Existing name is preserved (not overwritten by the inquiry name).
    expect(clients[0].name).toBe("Emma C.");
  });

  it("does not overwrite an existing client's phone", async () => {
    const ws = await Workspace.create(makeWorkspace());
    await Client.create({
      workspaceId: ws._id,
      name: "Emma C.",
      email: "emma@example.com",
      phone: "+63 999 999 9999",
      source: "manual",
    });

    await submitInquiry({
      workspaceSlug: "studio-aurora",
      payload: makePayload({ phone: "+63 111 222 3333" }),
    });

    const client = await Client.findOne({ workspaceId: ws._id }).lean();
    expect(client?.phone).toBe("+63 999 999 9999");
  });

  it("keeps clients separate across workspaces (tenant isolation)", async () => {
    const wsA = await Workspace.create(makeWorkspace({ slug: "studio-a" }));
    const wsB = await Workspace.create(makeWorkspace({ slug: "studio-b" }));

    await submitInquiry({ workspaceSlug: "studio-a", payload: makePayload() });
    await submitInquiry({ workspaceSlug: "studio-b", payload: makePayload() });

    const clientsA = await Client.find({ workspaceId: wsA._id }).lean();
    const clientsB = await Client.find({ workspaceId: wsB._id }).lean();
    expect(clientsA).toHaveLength(1);
    expect(clientsB).toHaveLength(1);
    expect(String(clientsA[0]._id)).not.toBe(String(clientsB[0]._id));
  });

  it("rejects an unpublished workspace before any write", async () => {
    await Workspace.create(makeWorkspace({ publicPage: { publishedAt: null } }));
    const res = await submitInquiry({ workspaceSlug: "studio-aurora", payload: makePayload() });

    expect(res).toEqual({ ok: false, error: "workspace_not_found" });
    expect(await Inquiry.countDocuments({})).toBe(0);
    expect(await Client.countDocuments({})).toBe(0);
    expect(await Booking.countDocuments({})).toBe(0);
  });

  it("rejects an unknown slug", async () => {
    const res = await submitInquiry({ workspaceSlug: "nope", payload: makePayload() });
    expect(res).toEqual({ ok: false, error: "workspace_not_found" });
  });

  it("rolls back every write when the booking create fails", async () => {
    const ws = await Workspace.create(makeWorkspace());
    const spy = vi.spyOn(Booking, "create").mockRejectedValueOnce(new Error("boom") as never);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await submitInquiry({
      workspaceSlug: "studio-aurora",
      payload: makePayload({ email: "fresh@example.com" }),
    });

    expect(res).toEqual({ ok: false, error: "submission_failed" });
    // The newly-created client and inquiry must have rolled back.
    expect(await Inquiry.countDocuments({ workspaceId: ws._id })).toBe(0);
    expect(await Client.countDocuments({ workspaceId: ws._id })).toBe(0);
    expect(await Booking.countDocuments({ workspaceId: ws._id })).toBe(0);
    spy.mockRestore();
  });

  it("sets eventDate to the earliest session startDate", async () => {
    await Workspace.create(makeWorkspace());
    const res = await submitInquiry({
      workspaceSlug: "studio-aurora",
      payload: makePayload({
        sessions: [
          { startDate: "2030-08-20", startTime: "10:00", endTime: "18:00" },
          { startDate: "2030-08-15", startTime: "09:00", endTime: "17:00" },
          { startDate: "2030-08-22", startTime: "10:00", endTime: "18:00" },
        ],
      }),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const inquiry = await Inquiry.findById(res.inquiryId).lean();
    expect(inquiry?.eventDate).toBeTruthy();
    // Earliest session is 2030-08-15. The stored value is derived from the UTC
    // instant of the first session start converted from Asia/Manila (UTC+8),
    // so eventDate < "2030-08-15T16:00:00Z". Just verify the date part.
    expect(inquiry!.eventDate!.toISOString().startsWith("2030-08-15")).toBe(true);
  });

  it("sends an owner notification when a recipient is configured", async () => {
    await Workspace.create(makeWorkspace());
    await submitInquiry({ workspaceSlug: "studio-aurora", payload: makePayload() });
    expect(sendInquiryNotification).toHaveBeenCalledOnce();
    expect(sendInquiryNotification.mock.calls[0][0].recipientEmail).toBe("owner@studio.test");
    expect(sendInquiryNotification.mock.calls[0][0].isRecipientGated).toBe(false);
    expect(sendInquiryClientConfirmation).toHaveBeenCalledOnce();
    expect(sendInquiryClientConfirmation.mock.calls[0][0].workspaceName).toBe("Studio Aurora");
  });

  it("marks the owner notification as gated when the workspace has lapsed to gated free", async () => {
    await Workspace.create(makeWorkspace({ plan: "free", everSubscribed: true }));
    await submitInquiry({ workspaceSlug: "studio-aurora", payload: makePayload() });
    expect(sendInquiryNotification).toHaveBeenCalledOnce();
    expect(sendInquiryNotification.mock.calls[0][0].isRecipientGated).toBe(true);
  });

  it("keeps the inquiry submission committed when email delivery fails", async () => {
    sendInquiryNotification.mockRejectedValueOnce(new Error("mail down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const ws = await Workspace.create(makeWorkspace());
    const res = await submitInquiry({ workspaceSlug: "studio-aurora", payload: makePayload() });

    expect(res.ok).toBe(true);
    expect(await Inquiry.countDocuments({ workspaceId: ws._id })).toBe(1);
    expect(await Client.countDocuments({ workspaceId: ws._id })).toBe(1);
    expect(await Booking.countDocuments({ workspaceId: ws._id })).toBe(1);
  });

  it("skips notification when no recipient email is configured", async () => {
    await Workspace.create(
      makeWorkspace({ publicPage: { publishedAt: new Date(), inquiryRecipientEmail: "" }, contact: { email: "" } })
    );
    await submitInquiry({ workspaceSlug: "studio-aurora", payload: makePayload() });
    expect(sendInquiryNotification).not.toHaveBeenCalled();
  });

  it("falls back to the workspace contact email for notifications", async () => {
    await Workspace.create(
      makeWorkspace({
        publicPage: { publishedAt: new Date(), inquiryRecipientEmail: "" },
        contact: { email: "fallback@studio.test" },
      })
    );
    await submitInquiry({ workspaceSlug: "studio-aurora", payload: makePayload() });
    expect(sendInquiryNotification).toHaveBeenCalledOnce();
    expect(sendInquiryNotification.mock.calls[0][0].recipientEmail).toBe("fallback@studio.test");
  });

  it("fires sendNotification for the owner even when contact.email is empty", async () => {
    // inquiryRecipientEmail is set (so the rich owner email fires via sendInquiryNotification)
    // but contact.email is absent — the in-app + socket notification must still be sent.
    const ws = await Workspace.create(
      makeWorkspace({
        publicPage: { publishedAt: new Date(), inquiryRecipientEmail: "owner@studio.test" },
        contact: { email: "" },
      })
    );
    await submitInquiry({ workspaceSlug: "studio-aurora", payload: makePayload() });

    expect(sendNotification).toHaveBeenCalledOnce();
    const call = sendNotification.mock.calls[0][0] as {
      recipients: { workosUserId: string }[];
      type: string;
    };
    expect(call.recipients[0].workosUserId).toBe(ws.ownerUserId);
    expect(call.type).toBe("inquiry.created");
  });
});
