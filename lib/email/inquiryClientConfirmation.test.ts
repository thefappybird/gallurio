import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendEmail = vi.fn();
vi.mock("./send", () => ({ sendEmail: (...args: unknown[]) => sendEmail(...args) }));

import { sendInquiryClientConfirmation } from "./inquiryClientConfirmation";

beforeEach(() => {
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ ok: true, id: "msg_1" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sendInquiryClientConfirmation", () => {
  it("sends a branded confirmation to the submitter with default en locale", async () => {
    await sendInquiryClientConfirmation({
      workspaceName: "Studio Aurora",
      clientEmail: "emma@example.com",
      clientName: "Emma Carter",
      ownerEmail: "owner@studio.test",
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.subject).toContain("Studio Aurora");
    expect(arg.html).toContain("Studio Aurora");
    expect(arg.replyTo).toBe("owner@studio.test");
    // No raw <strong> tags — the template escapes all caller strings
    expect(arg.html).not.toContain("<strong>");
    // Partner brand footer must contain Powered by Gallurio
    expect(arg.html).toContain("Powered by Gallurio");
  });

  it("uses ms locale copy when country is MY", async () => {
    await sendInquiryClientConfirmation({
      workspaceName: "Studio Aurora",
      clientEmail: "emma@example.com",
      clientName: "Emma Carter",
      ownerEmail: "owner@studio.test",
      country: "MY",
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    const arg = sendEmail.mock.calls[0][0];
    // ms locale: "Kami telah menerima pertanyaan anda"
    expect(arg.html).toContain("Kami telah menerima pertanyaan anda");
    expect(arg.html).toContain("Studio Aurora");
    expect(arg.html).toContain("Powered by Gallurio");
  });

  it("uses provided brand instead of resolving from workspaceName alone", async () => {
    const brand = {
      kind: "partner" as const,
      name: "Aurora Events",
      accentHex: "#ff5500",
      poweredByGallurio: true,
    };

    await sendInquiryClientConfirmation({
      workspaceName: "Studio Aurora",
      clientEmail: "emma@example.com",
      clientName: "Emma Carter",
      ownerEmail: "owner@studio.test",
      brand,
      country: "MY",
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    const arg = sendEmail.mock.calls[0][0];
    // Brand name takes precedence
    expect(arg.html).toContain("Aurora Events");
    expect(arg.html).toContain("Kami telah menerima pertanyaan anda");
    expect(arg.html).toContain("Powered by Gallurio");
  });

  it("is best-effort: returns error result without throwing when render fails", async () => {
    // Pass a bad brand that will cause no throw but returns error gracefully
    // Simulate by passing invalid brand kind to force an unusual path
    // Actually test that sendEmail not called and result is ok:false
    // We do this by making sendEmail throw
    sendEmail.mockRejectedValueOnce(new Error("transport down"));

    const result = await sendInquiryClientConfirmation({
      workspaceName: "Studio Aurora",
      clientEmail: "emma@example.com",
      clientName: "Emma Carter",
      ownerEmail: null,
    });

    // Should not throw; returns error result
    expect(result.ok).toBe(false);
  });
});
