import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockSendEmail } = vi.hoisted(() => ({
  mockSendEmail: vi.fn().mockResolvedValue({ ok: true, id: "email_1" }),
}));
vi.mock("@/lib/email/send", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email/send")>("@/lib/email/send");
  return { ...actual, sendEmail: mockSendEmail };
});

import { sendPasswordResetEmail } from "./sendPasswordResetEmail";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
  vi.stubEnv("NEXT_PUBLIC_APP_NAME", "Gallurio");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sendPasswordResetEmail", () => {
  it("sends a reset link containing the token to the given email", async () => {
    await sendPasswordResetEmail("user@example.com", "tok_abc");

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const arg = mockSendEmail.mock.calls[0]![0]!;
    expect(arg.to).toBe("user@example.com");
    expect(arg.html).toContain(
      "https://app.example.com/reset-password?token=tok_abc",
    );
    expect(arg.text).toContain("tok_abc");
    expect(arg.subject).toContain("Gallurio");
  });

  it("percent-encodes URL-unsafe characters in the token", async () => {
    await sendPasswordResetEmail("user@example.com", "tok+abc/def=");

    const arg = mockSendEmail.mock.calls[0]![0]!;
    expect(arg.html).toContain(
      "https://app.example.com/reset-password?token=tok%2Babc%2Fdef%3D",
    );
    expect(arg.html).not.toContain("token=tok+abc/def=");
  });

  it("falls back to default app url and name when env vars are unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_NAME", "");
    await sendPasswordResetEmail("user@example.com", "tok_abc");
    const arg = mockSendEmail.mock.calls[0]![0]!;
    expect(arg.html).toContain("https://gallurio.app/reset-password");
    expect(arg.subject).toContain("Gallurio");
  });

  it("renders the fil locale CTA label in the html", async () => {
    await sendPasswordResetEmail("user@example.com", "tok_fil", "fil");

    const arg = mockSendEmail.mock.calls[0]![0]!;
    // CTA label should be the Filipino translation
    expect(arg.html).toContain("I-reset ang password");
    // Reset URL must still be present
    expect(arg.html).toContain(
      "https://app.example.com/reset-password?token=tok_fil",
    );
  });

  it("is platform-branded (Gallurio teal header, Gallurio name)", async () => {
    await sendPasswordResetEmail("user@example.com", "tok_brand");

    const arg = mockSendEmail.mock.calls[0]![0]!;
    // Platform brand uses gallurioBrand() — teal accent in header background
    expect(arg.html).toContain("#0d8fa1");
    // Brand name appears in the email
    expect(arg.html).toContain("Gallurio");
  });

  it("uses localized subject for ms locale", async () => {
    await sendPasswordResetEmail("user@example.com", "tok_ms", "ms");

    const arg = mockSendEmail.mock.calls[0]![0]!;
    expect(arg.subject).toBe("Tetapkan semula kata laluan Gallurio anda");
  });

  it("uses localized subject for id locale", async () => {
    await sendPasswordResetEmail("user@example.com", "tok_id", "id");

    const arg = mockSendEmail.mock.calls[0]![0]!;
    expect(arg.subject).toBe("Reset kata sandi Gallurio Anda");
  });

  it("includes expiry/ignore line in plain text", async () => {
    await sendPasswordResetEmail("user@example.com", "tok_expiry");

    const arg = mockSendEmail.mock.calls[0]![0]!;
    expect(arg.text).toContain("expires");
    expect(arg.text).toContain("ignore");
  });

  it("propagates a redacted failure to the caller when sendEmail fails", async () => {
    mockSendEmail.mockResolvedValue({ ok: false, error: "resend_500" });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await sendPasswordResetEmail("user@example.com", "tok_abc");

    expect(result).toEqual({ ok: false, error: "resend_500" });
    expect(errorSpy).toHaveBeenCalledOnce();
    const [msg] = errorSpy.mock.calls[0];
    expect(msg).not.toContain("user@example.com");
    expect(msg).toContain("resend_500");
  });
});
