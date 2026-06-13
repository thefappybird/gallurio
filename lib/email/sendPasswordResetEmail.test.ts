import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockSendEmail } = vi.hoisted(() => ({
  mockSendEmail: vi.fn().mockResolvedValue({ ok: true, id: "email_1" }),
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: mockSendEmail }));

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

  it("falls back to default app url and name when env vars are unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_NAME", "");
    await sendPasswordResetEmail("user@example.com", "tok_abc");
    const arg = mockSendEmail.mock.calls[0]![0]!;
    expect(arg.html).toContain("https://gallurio.app/reset-password");
    expect(arg.subject).toContain("Gallurio");
  });
});
