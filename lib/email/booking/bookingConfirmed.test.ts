import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendEmail = vi.fn();
vi.mock("../send", () => ({ sendEmail: (...args: unknown[]) => sendEmail(...args) }));

import {
  sendBookingConfirmedClient,
  sendBookingConfirmedOwner,
} from "./bookingConfirmed";
import type { Brand } from "../brand";

const ORIGINAL_ENV = { ...process.env };

const partnerBrand: Brand = {
  kind: "partner",
  name: "Studio Aurora",
  accentHex: "#0d8fa1",
  poweredByGallurio: true,
};

beforeEach(() => {
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ ok: true, id: "msg_1" });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("sendBookingConfirmedClient", () => {
  it("sends a partner-branded email with business name and event title in the html", async () => {
    await sendBookingConfirmedClient({
      brand: partnerBrand,
      locale: "PH",
      clientName: "Emma Carter",
      clientEmail: "emma@example.com",
      businessName: "Studio Aurora",
      eventTitle: "Emma & Noah Wedding",
      sessions: [{ startDate: "2026-08-15", startTime: "10:00", endTime: "18:00" }],
      replyTo: "owner@studio.test",
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.html).toContain("Studio Aurora");
    expect(arg.html).toContain("Emma &amp; Noah Wedding");
  });

  it("includes localized confirmation copy resolved from locale/country", async () => {
    await sendBookingConfirmedClient({
      brand: partnerBrand,
      locale: "MY",
      clientName: "Ali Hassan",
      clientEmail: "ali@example.com",
      businessName: "Studio Aurora",
      eventTitle: "Ali Wedding",
      sessions: [],
      replyTo: null,
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    const arg = sendEmail.mock.calls[0][0];
    // ms locale copy should appear
    expect(arg.html).toContain("Studio Aurora");
  });

  it("shows Powered by Gallurio in the footer", async () => {
    await sendBookingConfirmedClient({
      brand: partnerBrand,
      locale: null,
      clientName: "Emma Carter",
      clientEmail: "emma@example.com",
      businessName: "Studio Aurora",
      eventTitle: "Event",
      sessions: [],
      replyTo: null,
    });

    const arg = sendEmail.mock.calls[0][0];
    expect(arg.html).toContain("Powered by Gallurio");
  });

  it("escapes HTML in client-supplied fields (XSS guard)", async () => {
    await sendBookingConfirmedClient({
      brand: partnerBrand,
      locale: null,
      clientName: "<script>alert(1)</script>",
      clientEmail: "xss@example.com",
      businessName: "Studio Aurora",
      eventTitle: "<b>Bad</b>",
      sessions: [],
      replyTo: null,
    });

    const arg = sendEmail.mock.calls[0][0];
    expect(arg.html).not.toContain("<script>");
    expect(arg.html).toContain("&lt;script&gt;");
    expect(arg.html).not.toContain("<b>Bad</b>");
  });

  it("is best-effort: does not throw and skips send when clientEmail is falsy", async () => {
    await sendBookingConfirmedClient({
      brand: partnerBrand,
      locale: null,
      clientName: "Emma Carter",
      clientEmail: "",
      businessName: "Studio Aurora",
      eventTitle: "Event",
      sessions: [],
      replyTo: null,
    });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("catches send errors without throwing", async () => {
    sendEmail.mockRejectedValueOnce(new Error("network down"));

    await expect(
      sendBookingConfirmedClient({
        brand: partnerBrand,
        locale: null,
        clientName: "Emma Carter",
        clientEmail: "emma@example.com",
        businessName: "Studio Aurora",
        eventTitle: "Event",
        sessions: [],
        replyTo: null,
      })
    ).resolves.not.toThrow();
  });
});

describe("sendBookingConfirmedOwner", () => {
  it("sends a platform-branded email with the booking deep-link when NEXT_PUBLIC_APP_URL is set", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.gallurio.test";

    await sendBookingConfirmedOwner({
      locale: "en",
      ownerEmail: "owner@studio.test",
      clientName: "Emma Carter",
      eventTitle: "Emma & Noah Wedding",
      bookingId: "abc123",
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.html).toContain("/bookings?detail=abc123");
    expect(arg.to).toBe("owner@studio.test");
  });

  it("omits CTA when NEXT_PUBLIC_APP_URL is unset", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    await sendBookingConfirmedOwner({
      locale: "en",
      ownerEmail: "owner@studio.test",
      clientName: "Emma Carter",
      eventTitle: "Event",
      bookingId: "abc123",
    });

    const arg = sendEmail.mock.calls[0][0];
    expect(arg.html).not.toContain("/bookings?detail=");
  });

  it("includes the client name in the owner email body", async () => {
    await sendBookingConfirmedOwner({
      locale: "en",
      ownerEmail: "owner@studio.test",
      clientName: "Emma Carter",
      eventTitle: "Emma & Noah Wedding",
      bookingId: "bk1",
    });

    const arg = sendEmail.mock.calls[0][0];
    expect(arg.html).toContain("Emma Carter");
  });

  it("uses Gallurio platform brand (no Powered by Gallurio footer for platform brand)", async () => {
    await sendBookingConfirmedOwner({
      locale: "en",
      ownerEmail: "owner@studio.test",
      clientName: "Emma Carter",
      eventTitle: "Event",
      bookingId: "bk2",
    });

    const arg = sendEmail.mock.calls[0][0];
    // Platform brand: poweredByGallurio = false, so footer is absent
    expect(arg.html).not.toContain("Powered by Gallurio");
  });

  it("catches send errors without throwing", async () => {
    sendEmail.mockRejectedValueOnce(new Error("smtp error"));

    await expect(
      sendBookingConfirmedOwner({
        locale: "en",
        ownerEmail: "owner@studio.test",
        clientName: "Emma Carter",
        eventTitle: "Event",
        bookingId: "bk3",
      })
    ).resolves.not.toThrow();
  });
});
