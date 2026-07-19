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
    ownerEmail: "owner@studio.test",
    clientName: "Emma Carter",
    clientEmail: "emma@example.com",
    clientPhone: "+63 900 000 0000",
    preferredContact: "email",
    eventTitle: "Emma & Noah Wedding",
    eventType: "wedding",
    location: {
      label: "Tagaytay Highlands",
      address: "Tagaytay, Cavite, Philippines",
      placeId: "place_tagaytay",
      lat: 14.1154,
      lng: 120.9621,
    },
    description: "Looking for full-day coverage.",
    sessions: [{ startDate: "2026-08-15", startTime: "10:00", endTime: "18:00" }],
    isRecipientGated: false,
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

  it("includes the event title and structured location in the body", async () => {
    await sendInquiryNotification(makeData());
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.text).toContain("Emma & Noah Wedding");
    expect(arg.text).toContain("Tagaytay, Cavite, Philippines");
    expect(arg.html).toContain("Tagaytay, Cavite, Philippines");
  });

  it("renders em dashes for missing optional fields", async () => {
    await sendInquiryNotification(
      makeData({
        clientPhone: null,
        location: { label: null, address: null, placeId: null, lat: null, lng: null },
      })
    );
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.text).toContain("Phone: ");
    expect(arg.text).toContain("Location: ");
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

  it("adds a direct deep-link when NEXT_PUBLIC_APP_URL is set", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.gallurio.test/";
    await sendInquiryNotification(makeData({ inquiryId: "inq_42" }));
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.text).toContain("https://app.gallurio.test/inquiry-redirect?inquiryId=inq_42");
    expect(arg.html).toContain("https://app.gallurio.test/inquiry-redirect?inquiryId=inq_42");
    expect(arg.text).not.toContain("sign-in?redirect_url");
    expect(arg.html).not.toContain("sign-in?redirect_url");
  });

  it("html is a full branded document with <!DOCTYPE html> and client name in rows", async () => {
    await sendInquiryNotification(makeData({ clientName: "Emma Carter" }));
    const { html } = sendEmail.mock.calls[0][0];
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Emma Carter");
  });

  it("html contains the inquiry direct deep-link href when NEXT_PUBLIC_APP_URL is set", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.gallurio.test";
    await sendInquiryNotification(makeData({ inquiryId: "inq_77" }));
    const { html } = sendEmail.mock.calls[0][0];
    expect(html).toContain("https://app.gallurio.test/inquiry-redirect?inquiryId=inq_77");
    expect(html).not.toContain("sign-in?redirect_url");
  });

  it("omits the CTA and deep-link when NEXT_PUBLIC_APP_URL is unset", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    await sendInquiryNotification(makeData({ inquiryId: "inq_55" }));
    const { html, text } = sendEmail.mock.calls[0][0];
    expect(html).not.toContain("/inquiry-redirect");
    expect(text).not.toContain("/inquiry-redirect");
  });

  it("omits the CTA and deep-link when NEXT_PUBLIC_APP_URL is unset, even when gated", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    await sendInquiryNotification(makeData({ inquiryId: "inq_56", isRecipientGated: true }));
    const { html, text } = sendEmail.mock.calls[0][0];
    expect(html).not.toContain("/inquiry-redirect");
    expect(text).not.toContain("/inquiry-redirect");
    expect(html).not.toContain("Subscribe and View");
  });

  describe("gated recipient", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_APP_URL = "https://app.gallurio.test";
    });

    it("uses the Subscribe and View CTA label and links through the resolver", async () => {
      await sendInquiryNotification(makeData({ inquiryId: "inq_99", isRecipientGated: true }));
      const { html, text } = sendEmail.mock.calls[0][0];
      expect(html).toContain("Subscribe and View");
      expect(html).not.toContain("Review &amp; approve");
      expect(html).toContain("https://app.gallurio.test/inquiry-redirect?inquiryId=inq_99");
      expect(text).toContain("https://app.gallurio.test/inquiry-redirect?inquiryId=inq_99");
    });

    it("includes the subscribe copy in the body", async () => {
      await sendInquiryNotification(makeData({ isRecipientGated: true }));
      const { html, text } = sendEmail.mock.calls[0][0];
      expect(html).toContain("Subscribe to Gallurio Pro to view the inquiry.");
      expect(text).toContain("Subscribe to Gallurio Pro to view the inquiry.");
    });
  });

  describe("non-gated recipient (unchanged behavior)", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_APP_URL = "https://app.gallurio.test";
    });

    it("keeps the Review & approve CTA label", async () => {
      await sendInquiryNotification(makeData({ inquiryId: "inq_100", isRecipientGated: false }));
      const { html } = sendEmail.mock.calls[0][0];
      expect(html).toContain("Review &amp; approve");
      expect(html).not.toContain("Subscribe and View");
      expect(html).not.toContain("Subscribe to Gallurio Pro to view the inquiry.");
    });

    it("still links through the /inquiry-redirect resolver", async () => {
      await sendInquiryNotification(makeData({ inquiryId: "inq_101", isRecipientGated: false }));
      const { html } = sendEmail.mock.calls[0][0];
      expect(html).toContain("https://app.gallurio.test/inquiry-redirect?inquiryId=inq_101");
    });
  });
});
