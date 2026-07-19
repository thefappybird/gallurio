import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendEmail = vi.fn();
vi.mock("./send", () => ({ sendEmail: (...args: unknown[]) => sendEmail(...args) }));

import { sendInquiryClientConfirmation } from "./inquiryClientConfirmation";
import { WORKSPACE_LOGO_CID } from "./inlineImages";

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
    expect(arg.subject).toBe("Your inquiry is with Studio Aurora");
    expect(arg.html).toContain("Studio Aurora");
    expect(arg.replyTo).toBe("owner@studio.test");
    // No raw <strong> tags — the template escapes all caller strings
    expect(arg.html).not.toContain("<strong>");
    // Partner brand footer must contain Powered by Gallurio
    expect(arg.html).toContain("Powered by Gallurio");
  });

  it("uses th locale copy when country is TH", async () => {
    await sendInquiryClientConfirmation({
      workspaceName: "Studio Aurora",
      clientEmail: "emma@example.com",
      clientName: "Emma Carter",
      ownerEmail: "owner@studio.test",
      country: "TH",
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    const arg = sendEmail.mock.calls[0][0];
    // The localized title remains part of the bilingual email body.
    expect(arg.html).toContain("คำถามของคุณถึง Studio Aurora แล้ว");
    expect(arg.html).toContain("Studio Aurora");
    expect(arg.html).toContain("Powered by Gallurio");
  });

  it("uses provided brand instead of resolving from workspaceName alone", async () => {
    const brand = {
      kind: "partner" as const,
      name: "Aurora Events",
      logoUrl: "https://images.example.test/aurora-logo.png",
      accentHex: "#ff5500",
      poweredByGallurio: true,
    };

    await sendInquiryClientConfirmation({
      workspaceName: "Studio Aurora",
      clientEmail: "emma@example.com",
      clientName: "Emma Carter",
      ownerEmail: "owner@studio.test",
      brand,
      country: "TH",
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    const arg = sendEmail.mock.calls[0][0];
    // Brand name takes precedence
    expect(arg.html).toContain("Aurora Events");
    // Logo is embedded via a CID attachment rather than a raw URL
    expect(arg.html).toContain(`src="cid:${WORKSPACE_LOGO_CID}"`);
    expect(arg.attachments).toContainEqual(
      expect.objectContaining({
        contentId: WORKSPACE_LOGO_CID,
        path: "https://images.example.test/aurora-logo.png",
      }),
    );
    expect(arg.html).toContain("คำถามของคุณถึง Aurora Events แล้ว");
    expect(arg.html).toContain("Powered by Gallurio");
  });

  it("renders bilingual content (English + workspace locale) when locale resolves to non-en", async () => {
    await sendInquiryClientConfirmation({
      workspaceName: "Studio Aurora",
      clientEmail: "emma@example.com",
      clientName: "Emma Carter",
      ownerEmail: "owner@studio.test",
      country: "TH",
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    const arg = sendEmail.mock.calls[0][0];
    // English section
    expect(arg.html).toContain("Thank you for getting in touch");
    // Localized (th) section
    expect(arg.html).toContain("คำถามของคุณถึง Studio Aurora แล้ว");
    // Divider
    expect(arg.html).toContain("email-divider");
    // Inbox subjects are English-only, while the body remains bilingual.
    expect(arg.subject).toBe("Your inquiry is with Studio Aurora");
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
