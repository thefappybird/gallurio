import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockSendEmail } = vi.hoisted(() => ({
  mockSendEmail: vi.fn().mockResolvedValue({ ok: true, id: "email_1" }),
}));
vi.mock("@/lib/email/send", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email/send")>("@/lib/email/send");
  return { ...actual, sendEmail: mockSendEmail };
});

import { sendLifecycleEmail } from "./lifecycle";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sendLifecycleEmail", () => {
  it("sends the preExpiry stage email with a CTA linking to /subscribe", async () => {
    await sendLifecycleEmail("preExpiry", "owner@example.com", "xx");

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const arg = mockSendEmail.mock.calls[0]![0]!;
    expect(arg.to).toBe("owner@example.com");
    expect(arg.html).toContain("https://app.example.com/subscribe");
  });

  it("uses the fil-locale copy for a PH workspace country", async () => {
    await sendLifecycleEmail("preExpiry", "owner@example.com", "PH");

    const arg = mockSendEmail.mock.calls[0]![0]!;
    expect(arg.subject).toBe(
      "Magtatapos sa isang linggo ang access mo sa Gallurio Pro",
    );
  });

  it("uses the expired-stage copy (distinct from preExpiry)", async () => {
    await sendLifecycleEmail("expired", "owner@example.com", "xx");

    const arg = mockSendEmail.mock.calls[0]![0]!;
    expect(arg.subject).toBe("Your Gallurio Pro access has ended");
  });

  it("uses the remind1-stage copy", async () => {
    await sendLifecycleEmail("remind1", "owner@example.com", "xx");

    const arg = mockSendEmail.mock.calls[0]![0]!;
    expect(arg.subject).toBe("Your portfolio is still saved on Gallurio");
  });

  it("uses the remind2-stage copy", async () => {
    await sendLifecycleEmail("remind2", "owner@example.com", "xx");

    const arg = mockSendEmail.mock.calls[0]![0]!;
    expect(arg.subject).toBe("Last week to keep your portfolio online");
  });

  it("uses Arabic copy and RTL markup for a Gulf workspace country", async () => {
    await sendLifecycleEmail("preExpiry", "owner@example.com", "AE");

    const arg = mockSendEmail.mock.calls[0]![0]!;
    expect(arg.subject).toBe("وصولك إلى Gallurio Pro ينتهي خلال أسبوع");
    expect(arg.html).toContain('dir="rtl"');
    expect(arg.html).toContain('lang="ar"');
  });

  it("logs a redacted failure and propagates it when sendEmail fails", async () => {
    mockSendEmail.mockResolvedValue({ ok: false, error: "resend_500" });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await sendLifecycleEmail("preExpiry", "owner@example.com", "xx");

    expect(result).toEqual({ ok: false, error: "resend_500" });
    expect(errorSpy).toHaveBeenCalledOnce();
    const [msg] = errorSpy.mock.calls[0];
    expect(msg).not.toContain("owner@example.com");
    expect(msg).toContain("resend_500");
  });
});
