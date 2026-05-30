import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "./send";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("sendEmail", () => {
  it("skips (logs) and succeeds when no API key is configured", async () => {
    delete process.env.RESEND_API_KEY;
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const res = await sendEmail({
      to: "owner@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(res).toEqual({ ok: true, id: null, skipped: true });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledOnce();
  });

  it("posts to Resend with bearer auth and returns the message id", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "Gallurio <hello@gallurio.test>";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "msg_123" }), { status: 200 })
    );

    const res = await sendEmail({
      to: ["owner@example.com"],
      subject: "New inquiry",
      html: "<p>x</p>",
      text: "x",
      replyTo: "client@example.com",
    });

    expect(res).toEqual({ ok: true, id: "msg_123" });
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer re_test_key"
    );
    const body = JSON.parse(init?.body as string);
    expect(body.from).toBe("Gallurio <hello@gallurio.test>");
    expect(body.to).toEqual(["owner@example.com"]);
    expect(body.reply_to).toBe("client@example.com");
  });

  it("returns an error result (never throws) when Resend rejects", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("forbidden", { status: 403 })
    );

    const res = await sendEmail({
      to: "owner@example.com",
      subject: "x",
      html: "x",
      text: "x",
    });

    expect(res).toEqual({ ok: false, error: "resend_403" });
  });

  it("returns an error result when the transport throws", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const res = await sendEmail({
      to: "owner@example.com",
      subject: "x",
      html: "x",
      text: "x",
    });

    expect(res).toEqual({ ok: false, error: "transport_error" });
  });
});
