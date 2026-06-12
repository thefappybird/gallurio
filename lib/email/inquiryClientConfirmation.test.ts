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
  it("tells the submitter their inquiry was sent to the portfolio owner", async () => {
    await sendInquiryClientConfirmation({
      workspaceName: "Studio Aurora",
      clientEmail: "emma@example.com",
      clientName: "Emma Carter",
      ownerEmail: "owner@studio.test",
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.subject).toContain("Studio Aurora");
    expect(arg.text).toContain("Your inquiry has been sent to Studio Aurora.");
    expect(arg.html).toContain("Your inquiry has been sent to <strong>Studio Aurora</strong>.");
    expect(arg.replyTo).toBe("owner@studio.test");
  });
});
