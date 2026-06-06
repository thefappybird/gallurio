import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendEmail = vi.fn();
vi.mock("./send", () => ({ sendEmail: (...args: unknown[]) => sendEmail(...args) }));

import { sendInquiryNotification, type InquiryNotificationData } from "./inquiryNotification";

const ORIGINAL_ENV = { ...process.env };

function makeData(overrides: Partial<InquiryNotificationData> = {}): InquiryNotificationData {
  return {
    workspaceName: "Studio Aurora",
    recipientEmail: "owner@studio.test",
    inquiryId: "inq_1",
    clientName: "Emma Carter",
    clientEmail: "emma@example.com",
    clientPhone: "+63 900 000 0000",
    preferredContact: "email",
    eventType: "wedding",
    guestCount: 120,
    location: "Tagaytay",
    description: "Looking for full-day coverage.",
    sessions: [{ startDate: "2026-08-15", startTime: "10:00", endTime: "18:00" }],
    ...overrides,
  };
}

beforeEach(() => {
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ ok: true, id: "msg_1" });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("sendInquiryNotification", () => {
  it("sends to the recipient with the client as reply-to", async () => {
    await sendInquiryNotification(makeData());
    expect(sendEmail).toHaveBeenCalledOnce();
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.to).toBe("owner@studio.test");
    expect(arg.replyTo).toBe("emma@example.com");
    expect(arg.subject).toContain("Emma Carter");
    expect(arg.subject).toContain("Studio Aurora");
  });

  it("includes session, guest, and location details in the body", async () => {
    await sendInquiryNotification(makeData());
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.text).toContain("2026-08-15 · 10:00–18:00");
    expect(arg.text).toContain("120");
    expect(arg.text).toContain("Tagaytay");
    expect(arg.html).toContain("Tagaytay");
  });

  it("renders em-dashes for missing optional fields", async () => {
    await sendInquiryNotification(makeData({ clientPhone: null, guestCount: null, location: null }));
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.text).toContain("Phone: —");
    expect(arg.text).toContain("Guests: —");
    expect(arg.text).toContain("Location: —");
  });

  it("escapes HTML in user-supplied content", async () => {
    await sendInquiryNotification(
      makeData({ clientName: "<script>alert(1)</script>", description: "a & b < c" })
    );
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.html).not.toContain("<script>alert(1)</script>");
    expect(arg.html).toContain("&lt;script&gt;");
    expect(arg.html).toContain("a &amp; b &lt; c");
  });

  it("adds a review link when NEXT_PUBLIC_APP_URL is set", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.gallurio.test/";
    await sendInquiryNotification(makeData({ inquiryId: "inq_42" }));
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.text).toContain("https://app.gallurio.test/inquiries/inq_42");
    expect(arg.html).toContain("https://app.gallurio.test/inquiries/inq_42");
  });
});
