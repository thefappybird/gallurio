import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendEmail = vi.fn();
vi.mock("./send", () => ({ sendEmail: (...args: unknown[]) => sendEmail(...args) }));

import { sendBookDemoNotification, type BookDemoNotificationData } from "./bookDemoNotification";
import { SUPPORT_EMAIL } from "./brand";

function makeData(overrides: Partial<BookDemoNotificationData> = {}): BookDemoNotificationData {
  return {
    name: "Emma Carter",
    email: "emma@example.com",
    businessName: "Studio Aurora",
    message: "Would love to see the calendar and gallery.",
    ...overrides,
  };
}

beforeEach(() => {
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ ok: true, id: "msg_1" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sendBookDemoNotification", () => {
  it("sends to SUPPORT_EMAIL with the submitter as reply-to", async () => {
    await sendBookDemoNotification(makeData());
    expect(sendEmail).toHaveBeenCalledOnce();
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.to).toBe(SUPPORT_EMAIL);
    expect(arg.replyTo).toBe("emma@example.com");
    expect(arg.subject).toContain("Emma Carter");
    expect(arg.subject).toContain("Studio Aurora");
  });

  it("includes the submitted fields in the body", async () => {
    await sendBookDemoNotification(makeData());
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.text).toContain("Emma Carter");
    expect(arg.text).toContain("emma@example.com");
    expect(arg.text).toContain("Studio Aurora");
    expect(arg.text).toContain("Would love to see the calendar and gallery.");
    expect(arg.html).toContain("Studio Aurora");
  });

  it("escapes HTML in user-supplied content", async () => {
    await sendBookDemoNotification(
      makeData({ name: "<script>alert(1)</script>", message: "a & b < c" })
    );
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.html).not.toContain("<script>alert(1)</script>");
    expect(arg.html).toContain("&lt;script&gt;");
    expect(arg.html).toContain("a &amp; b &lt; c");
  });
});
