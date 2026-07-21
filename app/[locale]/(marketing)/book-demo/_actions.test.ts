import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "203.0.113.5" })),
}));

const rateLimit = vi.fn();
vi.mock("@/lib/server/rateLimit", () => ({ rateLimit: (...args: unknown[]) => rateLimit(...args) }));

const sendBookDemoNotification = vi.fn();
vi.mock("@/lib/email/bookDemoNotification", () => ({
  sendBookDemoNotification: (...args: unknown[]) => sendBookDemoNotification(...args),
}));

const sendBookDemoConfirmation = vi.fn();
vi.mock("@/lib/email/bookDemoConfirmation", () => ({
  sendBookDemoConfirmation: (...args: unknown[]) => sendBookDemoConfirmation(...args),
}));

import { submitBookDemoAction } from "./_actions";

function validInput() {
  return {
    name: "Emma Carter",
    email: "emma@example.com",
    businessName: "Studio Aurora",
    message: "Would love to see the calendar and gallery.",
  };
}

beforeEach(() => {
  rateLimit.mockReset();
  rateLimit.mockReturnValue({ ok: true, remaining: 4, resetAt: Date.now() + 60_000 });
  sendBookDemoNotification.mockReset();
  sendBookDemoNotification.mockResolvedValue({ ok: true, id: "msg_1" });
  sendBookDemoConfirmation.mockReset();
  sendBookDemoConfirmation.mockResolvedValue({ ok: true, id: "msg_2" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("submitBookDemoAction", () => {
  it("returns ok:true for a valid submission", async () => {
    const result = await submitBookDemoAction(validInput());
    expect(result).toEqual({ ok: true });
  });

  it("returns ok:true even when both email sends reject (best-effort)", async () => {
    sendBookDemoNotification.mockRejectedValueOnce(new Error("resend down"));
    sendBookDemoConfirmation.mockRejectedValueOnce(new Error("resend down"));

    const result = await submitBookDemoAction(validInput());
    expect(result).toEqual({ ok: true });
  });

  it("returns ok:false and sends no email for invalid input", async () => {
    const result = await submitBookDemoAction({ ...validInput(), email: "not-an-email" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Enter a valid email");
    expect(sendBookDemoNotification).not.toHaveBeenCalled();
    expect(sendBookDemoConfirmation).not.toHaveBeenCalled();
  });

  it("short-circuits with rate_limited before validation when rate limited", async () => {
    rateLimit.mockReturnValue({ ok: false, remaining: 0, resetAt: Date.now() + 60_000 });

    const result = await submitBookDemoAction({ garbage: true });
    expect(result).toEqual({ ok: false, error: "rate_limited" });
    expect(sendBookDemoNotification).not.toHaveBeenCalled();
    expect(sendBookDemoConfirmation).not.toHaveBeenCalled();
  });
});
