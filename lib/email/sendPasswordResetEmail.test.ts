import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSendEmail } = vi.hoisted(() => ({
  mockSendEmail: vi.fn().mockResolvedValue({ ok: true, id: "email_1" }),
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: mockSendEmail }));

import { sendPasswordResetEmail } from "./sendPasswordResetEmail";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
  process.env.NEXT_PUBLIC_APP_NAME = "Gallurio";
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
});
