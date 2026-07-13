import { describe, it, expect, beforeAll, vi } from "vitest";
import { createHmac } from "node:crypto";

process.env.LEMONSQUEEZY_WEBHOOK_SECRET = "whsec_test_secret";

function sign(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

const RAW_BODY = JSON.stringify({
  meta: {
    event_name: "subscription_created",
    custom_data: { workspaceId: "ws_test_01" },
  },
  data: {
    id: "sub_test_01",
    attributes: {
      status: "active",
      variant_id: 1001,
      customer_id: 555,
      renews_at: "2026-08-01T00:00:00Z",
    },
  },
});

describe("verifyAndParseLemonSqueezyEvent", () => {
  let verifyAndParseLemonSqueezyEvent: typeof import("./webhook").verifyAndParseLemonSqueezyEvent;

  beforeAll(async () => {
    const mod = await import("./webhook");
    verifyAndParseLemonSqueezyEvent = mod.verifyAndParseLemonSqueezyEvent;
  });

  it("returns a parsed event when the signature is valid", async () => {
    const signature = sign(RAW_BODY, process.env.LEMONSQUEEZY_WEBHOOK_SECRET!);
    const result = await verifyAndParseLemonSqueezyEvent(RAW_BODY, signature);
    expect(result).not.toBeNull();
    expect(result?.meta.event_name).toBe("subscription_created");
    expect(result?.data.id).toBe("sub_test_01");
  });

  it("returns null when the signature header is null", async () => {
    const result = await verifyAndParseLemonSqueezyEvent(RAW_BODY, null);
    expect(result).toBeNull();
  });

  it("returns null when the signature header is an empty string", async () => {
    const result = await verifyAndParseLemonSqueezyEvent(RAW_BODY, "");
    expect(result).toBeNull();
  });

  it("returns null when the body has been tampered with", async () => {
    const goodSignature = sign(RAW_BODY, process.env.LEMONSQUEEZY_WEBHOOK_SECRET!);
    const tamperedBody = RAW_BODY + "x";
    const result = await verifyAndParseLemonSqueezyEvent(tamperedBody, goodSignature);
    expect(result).toBeNull();
  });

  it("returns null when the secret is wrong", async () => {
    const badSignature = sign(RAW_BODY, "wrong_secret");
    const result = await verifyAndParseLemonSqueezyEvent(RAW_BODY, badSignature);
    expect(result).toBeNull();
  });
});

describe("verifyAndParseLemonSqueezyEvent — missing secret", () => {
  it("throws in production when LEMONSQUEEZY_WEBHOOK_SECRET is missing", async () => {
    const origSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    const origEnv = process.env.NODE_ENV;
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = "";
    // @ts-expect-error — write to read-only in test context
    process.env.NODE_ENV = "production";

    vi.resetModules();
    const mod = await import("./webhook");

    await expect(
      mod.verifyAndParseLemonSqueezyEvent(RAW_BODY, "any-sig")
    ).rejects.toThrow("Missing env var LEMONSQUEEZY_WEBHOOK_SECRET");

    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = origSecret;
    // @ts-expect-error NODE_ENV is typed readonly but we restore it after the test
    process.env.NODE_ENV = origEnv;
    vi.resetModules();
  });

  it("returns parsed JSON in development when LEMONSQUEEZY_WEBHOOK_SECRET is missing", async () => {
    const origSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = "";

    vi.resetModules();
    const mod = await import("./webhook");

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await mod.verifyAndParseLemonSqueezyEvent(RAW_BODY, "any-sig");
    expect(result).toMatchObject({ meta: { event_name: "subscription_created" } });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("LEMONSQUEEZY_WEBHOOK_SECRET unset")
    );

    consoleSpy.mockRestore();
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = origSecret;
    vi.resetModules();
  });
});

describe("computeWebhookEventKey", () => {
  it("returns the same key for two structurally identical events (redelivery)", async () => {
    const { computeWebhookEventKey } = await import("./webhook");
    const eventA = {
      meta: { event_name: "subscription_created", custom_data: { workspaceId: "ws_1" } },
      data: { id: "sub_1", attributes: { status: "active" } },
    };
    const eventB = {
      meta: { event_name: "subscription_created", custom_data: { workspaceId: "ws_1" } },
      data: { id: "sub_1", attributes: { status: "active" } },
    };
    expect(computeWebhookEventKey(eventA)).toBe(computeWebhookEventKey(eventB));
  });

  it("returns a different key when attributes differ (a distinct event, not a redelivery)", async () => {
    const { computeWebhookEventKey } = await import("./webhook");
    const eventA = {
      meta: { event_name: "subscription_updated", custom_data: null },
      data: { id: "sub_1", attributes: { status: "active" } },
    };
    const eventB = {
      meta: { event_name: "subscription_updated", custom_data: null },
      data: { id: "sub_1", attributes: { status: "paused" } },
    };
    expect(computeWebhookEventKey(eventA)).not.toBe(computeWebhookEventKey(eventB));
  });
});

describe("redactWebhookEventForStorage", () => {
  it("strips user_email and user_name from data.attributes", async () => {
    const { redactWebhookEventForStorage } = await import("./webhook");
    const event = {
      meta: { event_name: "subscription_created", custom_data: { workspaceId: "ws_1" } },
      data: {
        id: "sub_1",
        attributes: {
          status: "active",
          user_email: "customer@example.com",
          user_name: "Jane Customer",
          customer_id: 555,
        },
      },
    };

    const redacted = redactWebhookEventForStorage(event);

    expect(redacted.data.attributes.user_email).toBeUndefined();
    expect(redacted.data.attributes.user_name).toBeUndefined();
    expect(redacted.data.attributes.status).toBe("active");
    expect(redacted.data.attributes.customer_id).toBe(555);
    // Original event is untouched.
    expect(event.data.attributes.user_email).toBe("customer@example.com");
  });
});

describe("HANDLED_LEMONSQUEEZY_EVENTS", () => {
  it("contains the ten expected event names", async () => {
    const { HANDLED_LEMONSQUEEZY_EVENTS } = await import("./webhook");
    expect(HANDLED_LEMONSQUEEZY_EVENTS).toContain("subscription_created");
    expect(HANDLED_LEMONSQUEEZY_EVENTS).toContain("subscription_updated");
    expect(HANDLED_LEMONSQUEEZY_EVENTS).toContain("subscription_cancelled");
    expect(HANDLED_LEMONSQUEEZY_EVENTS).toContain("subscription_resumed");
    expect(HANDLED_LEMONSQUEEZY_EVENTS).toContain("subscription_unpaused");
    expect(HANDLED_LEMONSQUEEZY_EVENTS).toContain("subscription_paused");
    expect(HANDLED_LEMONSQUEEZY_EVENTS).toContain("subscription_expired");
    expect(HANDLED_LEMONSQUEEZY_EVENTS).toContain("subscription_payment_success");
    expect(HANDLED_LEMONSQUEEZY_EVENTS).toContain("subscription_payment_failed");
    expect(HANDLED_LEMONSQUEEZY_EVENTS).toContain("subscription_payment_refunded");
    expect(HANDLED_LEMONSQUEEZY_EVENTS).toHaveLength(10);
  });
});
