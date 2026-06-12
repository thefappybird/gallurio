import { describe, it, expect, beforeAll, vi } from "vitest";
import { createHmac } from "node:crypto";

// Set required env vars before any module import
process.env.PADDLE_API_KEY = "test_api_key";
process.env.PADDLE_WEBHOOK_SECRET = "pdl_ntfset_test";
// Ensure we're not in production so getPaddle doesn't blow up with sandbox
process.env.NEXT_PUBLIC_PADDLE_ENV = "sandbox";

// Build a valid Paddle-Signature header for a given body using a current timestamp.
// The SDK checks: now > (ts + 5) * 1000ms, so ts must be within ~5s of now.
function buildSignature(rawBody: string, secret: string): string {
  const ts = Math.floor(Date.now() / 1000);
  const payload = `${ts}:${rawBody}`;
  const h1 = createHmac("sha256", secret).update(payload).digest("hex");
  return `ts=${ts};h1=${h1}`;
}

// Use customer.created — the CustomerNotification shape is flat and simple.
// SubscriptionActivatedEvent requires a deeply-nested billing_cycle shape that
// makes test fixtures impractical to maintain.
const RAW_BODY = JSON.stringify({
  event_type: "customer.created",
  notification_id: "ntf_test_01",
  occurred_at: new Date().toISOString(),
  data: {
    id: "ctm_test_01",
    name: "Test User",
    email: "test@example.com",
    marketing_consent: false,
    status: "active",
    custom_data: null,
    locale: "en",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    import_meta: null,
  },
});

describe("verifyAndParsePaddleEvent", () => {
  let verifyAndParsePaddleEvent: typeof import("@/lib/paddle/webhook").verifyAndParsePaddleEvent;

  beforeAll(async () => {
    // Import after env vars are set
    const mod = await import("@/lib/paddle/webhook");
    verifyAndParsePaddleEvent = mod.verifyAndParsePaddleEvent;
  });

  it("returns a parsed event when the signature is valid", async () => {
    const signature = buildSignature(RAW_BODY, process.env.PADDLE_WEBHOOK_SECRET!);
    const result = await verifyAndParsePaddleEvent(RAW_BODY, signature);
    expect(result).not.toBeNull();
    // The SDK's fromJson returns a typed event; eventType property is present
    expect(result).toHaveProperty("eventType");
  });

  it("returns null when the signature header is null", async () => {
    const result = await verifyAndParsePaddleEvent(RAW_BODY, null);
    expect(result).toBeNull();
  });

  it("returns null when the signature header is an empty string", async () => {
    const result = await verifyAndParsePaddleEvent(RAW_BODY, "");
    expect(result).toBeNull();
  });

  it("returns null when the body has been tampered with", async () => {
    const goodSignature = buildSignature(RAW_BODY, process.env.PADDLE_WEBHOOK_SECRET!);
    const tamperedBody = RAW_BODY + "x";
    const result = await verifyAndParsePaddleEvent(tamperedBody, goodSignature);
    expect(result).toBeNull();
  });

  it("returns null when the secret is wrong", async () => {
    const badSignature = buildSignature(RAW_BODY, "wrong_secret");
    const result = await verifyAndParsePaddleEvent(RAW_BODY, badSignature);
    expect(result).toBeNull();
  });

  it("returns null for a stale timestamp (>5s old)", async () => {
    const staleTs = Math.floor(Date.now() / 1000) - 10;
    const payload = `${staleTs}:${RAW_BODY}`;
    const h1 = createHmac("sha256", process.env.PADDLE_WEBHOOK_SECRET!)
      .update(payload)
      .digest("hex");
    const staleSignature = `ts=${staleTs};h1=${h1}`;
    const result = await verifyAndParsePaddleEvent(RAW_BODY, staleSignature);
    expect(result).toBeNull();
  });
});

describe("verifyAndParsePaddleEvent — missing secret", () => {
  it("throws in production when PADDLE_WEBHOOK_SECRET is missing", async () => {
    const origSecret = process.env.PADDLE_WEBHOOK_SECRET;
    const origEnv = process.env.NODE_ENV;
    process.env.PADDLE_WEBHOOK_SECRET = "";
    // @ts-expect-error — write to read-only in test context
    process.env.NODE_ENV = "production";

    // We need a fresh module to pick up the new env state — use dynamic import
    // with a fresh module registry via vi.resetModules
    vi.resetModules();
    const mod = await import("@/lib/paddle/webhook");

    await expect(
      mod.verifyAndParsePaddleEvent(RAW_BODY, "any-sig")
    ).rejects.toThrow("Missing env var PADDLE_WEBHOOK_SECRET");

    process.env.PADDLE_WEBHOOK_SECRET = origSecret;
    // @ts-expect-error NODE_ENV is typed readonly but we restore it after the test
    process.env.NODE_ENV = origEnv;
    vi.resetModules();
  });

  it("returns parsed JSON in development when PADDLE_WEBHOOK_SECRET is missing", async () => {
    const origSecret = process.env.PADDLE_WEBHOOK_SECRET;
    process.env.PADDLE_WEBHOOK_SECRET = "";

    vi.resetModules();
    const mod = await import("@/lib/paddle/webhook");

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await mod.verifyAndParsePaddleEvent(RAW_BODY, "any-sig");
    expect(result).toMatchObject({ event_type: "customer.created" });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("PADDLE_WEBHOOK_SECRET unset")
    );

    consoleSpy.mockRestore();
    process.env.PADDLE_WEBHOOK_SECRET = origSecret;
    vi.resetModules();
  });
});

describe("HANDLED_PADDLE_EVENTS", () => {
  it("contains the six expected event names", async () => {
    const { HANDLED_PADDLE_EVENTS } = await import("@/lib/paddle/webhook");
    expect(HANDLED_PADDLE_EVENTS).toContain("subscription.activated");
    expect(HANDLED_PADDLE_EVENTS).toContain("subscription.updated");
    expect(HANDLED_PADDLE_EVENTS).toContain("subscription.canceled");
    expect(HANDLED_PADDLE_EVENTS).toContain("subscription.past_due");
    expect(HANDLED_PADDLE_EVENTS).toContain("subscription.paused");
    expect(HANDLED_PADDLE_EVENTS).toContain("transaction.completed");
    expect(HANDLED_PADDLE_EVENTS).toHaveLength(6);
  });
});
