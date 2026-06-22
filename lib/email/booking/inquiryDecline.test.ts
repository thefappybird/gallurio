import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendEmail = vi.fn();
vi.mock("../send", () => ({ sendEmail: (...args: unknown[]) => sendEmail(...args) }));

import { sendInquiryDeclineClient } from "./inquiryDecline";
import type { Brand } from "../brand";

const partnerBrand: Brand = {
  kind: "partner",
  name: "Studio Lumen",
  accentHex: "#0d8fa1",
  poweredByGallurio: true,
};

beforeEach(() => {
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ ok: true, id: "msg_1" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sendInquiryDeclineClient", () => {
  it("sends a partner-branded email with business name in the html", async () => {
    await sendInquiryDeclineClient({
      brand: partnerBrand,
      locale: "PH",
      clientName: "Emma Carter",
      clientEmail: "emma@example.com",
      businessName: "Studio Lumen",
      replyTo: "owner@studio.test",
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.html).toContain("Studio Lumen");
    expect(arg.subject).toContain("Studio Lumen");
  });

  it("escapes HTML in client name (XSS guard)", async () => {
    await sendInquiryDeclineClient({
      brand: partnerBrand,
      locale: null,
      clientName: "<script>alert(1)</script>",
      clientEmail: "xss@example.com",
      businessName: "Studio Lumen",
      replyTo: null,
    });

    const arg = sendEmail.mock.calls[0][0];
    expect(arg.html).not.toContain("<script>");
    expect(arg.html).toContain("&lt;script&gt;");
  });

  it("skips send when clientEmail is falsy", async () => {
    await sendInquiryDeclineClient({
      brand: partnerBrand,
      locale: null,
      clientName: "Emma Carter",
      clientEmail: "",
      businessName: "Studio Lumen",
      replyTo: null,
    });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("catches send errors without throwing", async () => {
    sendEmail.mockRejectedValueOnce(new Error("network down"));

    await expect(
      sendInquiryDeclineClient({
        brand: partnerBrand,
        locale: null,
        clientName: "Emma Carter",
        clientEmail: "emma@example.com",
        businessName: "Studio Lumen",
        replyTo: null,
      })
    ).resolves.not.toThrow();
  });

  it("uses ms locale copy when country is MY", async () => {
    await sendInquiryDeclineClient({
      brand: partnerBrand,
      locale: "MY",
      clientName: "Ali Hassan",
      clientEmail: "ali@example.com",
      businessName: "Studio Lumen",
      replyTo: null,
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    const arg = sendEmail.mock.calls[0][0];
    // MY country resolves to ms locale — assert ms-specific copy
    expect(arg.html).toContain("tidak dapat memenuhi");
    expect(arg.subject).toContain("Kemaskini mengenai pertanyaan anda");
  });
});
