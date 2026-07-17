import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail, logEmailFailure } from "./send";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("sendEmail", () => {
  it("skips and succeeds without sending when no API key is configured", async () => {
    delete process.env.RESEND_API_KEY;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await sendEmail({
      to: "owner@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(res).toEqual({ ok: true, id: null, skipped: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns ok:false, error:no_transport when no API key is configured in production", async () => {
    delete process.env.RESEND_API_KEY;
    vi.stubEnv("NODE_ENV", "production");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const res = await sendEmail({
      to: "owner@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(res).toEqual({ ok: false, error: "no_transport" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it("logs the full body only in development, never the PII in other envs", async () => {
    delete process.env.RESEND_API_KEY;
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Non-dev (test) env: envelope-only warning, no body.
    vi.stubEnv("NODE_ENV", "test");
    await sendEmail({ to: "owner@example.com", subject: "S", html: "x", text: "SECRET BODY" });
    expect(info).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).not.toContain("SECRET BODY");

    // Development: full body logged for local testing.
    vi.stubEnv("NODE_ENV", "development");
    await sendEmail({ to: "owner@example.com", subject: "S", html: "x", text: "SECRET BODY" });
    expect(info).toHaveBeenCalledOnce();
    expect(info.mock.calls[0][0]).toContain("SECRET BODY");
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
      attachments: [
        { filename: "gallurio-logo.png", content: "aGVsbG8=", contentId: "gallurio-logo" },
      ],
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
    expect(body.attachments).toEqual([
      { filename: "gallurio-logo.png", content: "aGVsbG8=", content_id: "gallurio-logo" },
    ]);
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

describe("logEmailFailure", () => {
  it("logs a redacted error with email type, recipient count, and error code — no PII body", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logEmailFailure("password_reset", ["a@example.com", "b@example.com"], {
      ok: false,
      error: "resend_403",
    });

    expect(errorSpy).toHaveBeenCalledOnce();
    const [msg] = errorSpy.mock.calls[0];
    expect(msg).toContain("password_reset");
    expect(msg).toContain("2");
    expect(msg).toContain("resend_403");
    expect(msg).not.toContain("a@example.com");
    expect(msg).not.toContain("b@example.com");
  });

  it("is a no-op when the result is ok", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logEmailFailure("password_reset", "a@example.com", { ok: true, id: "msg_1" });
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
