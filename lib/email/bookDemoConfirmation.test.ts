import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendEmail = vi.fn();
vi.mock("./send", () => ({ sendEmail: (...args: unknown[]) => sendEmail(...args) }));

import { sendBookDemoConfirmation } from "./bookDemoConfirmation";

beforeEach(() => {
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ ok: true, id: "msg_1" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sendBookDemoConfirmation", () => {
  it("sends a branded confirmation to the submitter with default en locale", async () => {
    await sendBookDemoConfirmation({ email: "emma@example.com", name: "Emma Carter" });

    expect(sendEmail).toHaveBeenCalledOnce();
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.to).toBe("emma@example.com");
    expect(arg.subject).toBe("Your Gallurio demo request");
    expect(arg.html).toContain("Emma Carter");
    expect(arg.html).toContain("support@gallurio.com");
  });

  it("renders bilingual content when country resolves to a non-en locale", async () => {
    await sendBookDemoConfirmation({
      email: "emma@example.com",
      name: "Emma Carter",
      country: "TH",
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.html).toContain("Thanks for requesting a demo of Gallurio");
    expect(arg.html).toContain("คำขอทดลองใช้งาน Gallurio ของคุณ");
    expect(arg.subject).toBe("Your Gallurio demo request");
  });

  it("is best-effort: returns error result without throwing when sending fails", async () => {
    sendEmail.mockRejectedValueOnce(new Error("transport down"));

    const result = await sendBookDemoConfirmation({
      email: "emma@example.com",
      name: "Emma Carter",
    });

    expect(result.ok).toBe(false);
  });
});
