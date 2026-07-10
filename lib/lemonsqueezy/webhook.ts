import { createHmac, timingSafeEqual } from "node:crypto";

// Events we act on. Anything else gets a 200 so Lemon Squeezy doesn't retry
// forever.
export const HANDLED_LEMONSQUEEZY_EVENTS = [
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  "subscription_resumed",
  "subscription_unpaused",
  "subscription_paused",
  "subscription_expired",
  "subscription_payment_success",
  "subscription_payment_failed",
] as const;

export type HandledLemonSqueezyEvent = (typeof HANDLED_LEMONSQUEEZY_EVENTS)[number];

export type LemonSqueezyWebhookEvent = {
  meta: {
    event_name: string;
    custom_data?: Record<string, unknown> | null;
    test_mode?: boolean;
  };
  data: {
    id: string;
    attributes: Record<string, unknown>;
  };
};

// Lemon Squeezy's SDK has no webhook-verification helper — verify manually:
// HMAC-SHA256 of the raw body against the signing secret, compared to the
// X-Signature header with a timing-safe equality check.
export async function verifyAndParseLemonSqueezyEvent(
  rawBody: string,
  signature: string | null
): Promise<LemonSqueezyWebhookEvent | null> {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing env var LEMONSQUEEZY_WEBHOOK_SECRET");
    }
    // Dev convenience: allow unsigned posts without round-tripping the LS
    // sandbox dashboard.
    console.warn(
      "[lemonsqueezy-webhook] LEMONSQUEEZY_WEBHOOK_SECRET unset — accepting unsigned dev event"
    );
    return JSON.parse(rawBody) as LemonSqueezyWebhookEvent;
  }

  if (!signature) return null;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== actualBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, actualBuf)) return null;

  try {
    return JSON.parse(rawBody) as LemonSqueezyWebhookEvent;
  } catch (err) {
    console.error("[lemonsqueezy-webhook] failed to parse verified body", err);
    return null;
  }
}
