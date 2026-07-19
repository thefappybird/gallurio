import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";

process.env.RESEND_WEBHOOK_SECRET = "whsec_dGVzdHNlY3JldGJ5dGVzMTIzNDU2Nzg5MA==";

function sign(secret: string, svixId: string, svixTimestamp: string, rawBody: string): string {
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const mac = createHmac("sha256", secretBytes)
    .update(`${svixId}.${svixTimestamp}.${rawBody}`)
    .digest("base64");
  return `v1,${mac}`;
}

describe("verifyAndParseResendEvent", () => {
  it("returns null when all three svix headers are missing", async () => {
    const { verifyAndParseResendEvent } = await import("./verify");
    const result = await verifyAndParseResendEvent(
      JSON.stringify({ type: "email.bounced", created_at: "2026-07-14T00:00:00.000Z", data: {} }),
      null,
      null,
      null
    );
    expect(result).toBeNull();
  });

  it("returns the parsed event when the signature is valid", async () => {
    const { verifyAndParseResendEvent } = await import("./verify");
    const rawBody = JSON.stringify({
      type: "email.bounced",
      created_at: "2026-07-14T00:00:00.000Z",
      data: { email_id: "em_123" },
    });
    const svixId = "msg_test_01";
    const svixTimestamp = "1752451200";
    const signature = sign(process.env.RESEND_WEBHOOK_SECRET!, svixId, svixTimestamp, rawBody);

    const result = await verifyAndParseResendEvent(rawBody, svixId, svixTimestamp, signature);
    expect(result).toEqual({
      type: "email.bounced",
      created_at: "2026-07-14T00:00:00.000Z",
      data: { email_id: "em_123" },
    });
  });

  it("returns null when the body has been tampered with after signing", async () => {
    const { verifyAndParseResendEvent } = await import("./verify");
    const rawBody = JSON.stringify({ type: "email.bounced", created_at: "t", data: {} });
    const svixId = "msg_tamper";
    const svixTimestamp = "1752451200";
    const signature = sign(process.env.RESEND_WEBHOOK_SECRET!, svixId, svixTimestamp, rawBody);

    const result = await verifyAndParseResendEvent(
      rawBody + "x",
      svixId,
      svixTimestamp,
      signature
    );
    expect(result).toBeNull();
  });

  it("returns null when signed with the wrong secret", async () => {
    const { verifyAndParseResendEvent } = await import("./verify");
    const rawBody = JSON.stringify({ type: "email.bounced", created_at: "t", data: {} });
    const svixId = "msg_wrong_secret";
    const svixTimestamp = "1752451200";
    const wrongSecret = "whsec_d3JvbmdzZWNyZXRieXRlczEyMzQ1Njc4OQ==";
    const signature = sign(wrongSecret, svixId, svixTimestamp, rawBody);

    const result = await verifyAndParseResendEvent(rawBody, svixId, svixTimestamp, signature);
    expect(result).toBeNull();
  });
});

describe("verifyAndParseResendEvent — missing secret", () => {
  it("returns parsed JSON in development when RESEND_WEBHOOK_SECRET is missing", async () => {
    const origSecret = process.env.RESEND_WEBHOOK_SECRET;
    process.env.RESEND_WEBHOOK_SECRET = "";

    vi.resetModules();
    const mod = await import("./verify");

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rawBody = JSON.stringify({ type: "email.bounced", created_at: "t", data: {} });
    const result = await mod.verifyAndParseResendEvent(rawBody, null, null, null);
    expect(result).toEqual({ type: "email.bounced", created_at: "t", data: {} });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("RESEND_WEBHOOK_SECRET unset")
    );

    consoleSpy.mockRestore();
    process.env.RESEND_WEBHOOK_SECRET = origSecret;
    vi.resetModules();
  });

  it("throws in production when RESEND_WEBHOOK_SECRET is missing", async () => {
    const origSecret = process.env.RESEND_WEBHOOK_SECRET;
    const origEnv = process.env.NODE_ENV;
    process.env.RESEND_WEBHOOK_SECRET = "";
    // @ts-expect-error — NODE_ENV is read-only in the types but writable at runtime
    process.env.NODE_ENV = "production";

    vi.resetModules();
    const mod = await import("./verify");

    await expect(
      mod.verifyAndParseResendEvent("{}", null, null, null)
    ).rejects.toThrow("Missing env var RESEND_WEBHOOK_SECRET");

    process.env.RESEND_WEBHOOK_SECRET = origSecret;
    // @ts-expect-error — restore
    process.env.NODE_ENV = origEnv;
    vi.resetModules();
  });
});

describe("computeResendEventKey", () => {
  it("returns the svix-id directly when present", async () => {
    const { computeResendEventKey } = await import("./verify");
    const event = { type: "email.bounced", created_at: "t", data: {} };
    expect(computeResendEventKey("msg_abc123", event)).toBe("msg_abc123");
  });

  it("falls back to a content hash when svix-id is null, stable across identical events", async () => {
    const { computeResendEventKey } = await import("./verify");
    const eventA = { type: "email.bounced", created_at: "t", data: { email_id: "em_1" } };
    const eventB = { type: "email.bounced", created_at: "t", data: { email_id: "em_1" } };
    const eventC = { type: "email.complained", created_at: "t", data: { email_id: "em_1" } };
    expect(computeResendEventKey(null, eventA)).toBe(computeResendEventKey(null, eventB));
    expect(computeResendEventKey(null, eventA)).not.toBe(computeResendEventKey(null, eventC));
  });
});
