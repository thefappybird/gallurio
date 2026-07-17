import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

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
  "subscription_payment_refunded",
  "subscription_payment_recovered",
  "subscription_plan_changed",
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

// Runtime shape check for the verified-but-still-untrusted JSON body — see
// usage in app/api/webhooks/lemonsqueezy/route.ts.
export const lemonSqueezyEventEnvelopeSchema = z.object({
  meta: z.object({
    event_name: z.string().min(1),
    custom_data: z.record(z.string(), z.unknown()).nullish(),
    test_mode: z.boolean().optional(),
  }),
  data: z.object({
    id: z.string(),
    attributes: z.record(z.string(), z.unknown()),
  }),
});

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
    try {
      return JSON.parse(rawBody) as LemonSqueezyWebhookEvent;
    } catch (err) {
      console.error("[lemonsqueezy-webhook] failed to parse unsigned dev body", err);
      return null;
    }
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

// Lemon Squeezy webhook payloads carry no per-delivery event UUID — data.id
// is the resource's own id (subscription/invoice), reused by every event
// about that resource, and meta has no eventId field either. A genuine
// redelivery resends byte-identical content for the same logical event, so a
// content hash over the verified event's identifying fields is a stable
// dedupe key: same delivery -> same hash; a distinct event (even for the same
// resource) carries different attributes/status and hashes differently.
export function computeWebhookEventKey(event: LemonSqueezyWebhookEvent): string {
  const material = JSON.stringify({
    event_name: event.meta.event_name,
    data_id: event.data.id,
    attributes: event.data.attributes,
    custom_data: event.meta.custom_data ?? null,
  });
  return createHash("sha256").update(material).digest("hex");
}

// Attribute keys known to carry PII in Lemon Squeezy subscription payloads.
// None of the handlers in app/api/webhooks/lemonsqueezy/route.ts read these —
// safe to strip before persisting the event to the WebhookEvent ledger.
const PII_ATTRIBUTE_KEYS = ["user_email", "user_name"];

// Redacted copy of the verified event, safe to store on the WebhookEvent
// ledger for scripts/replay-lemonsqueezy-event.ts to resend later.
export function redactWebhookEventForStorage(
  event: LemonSqueezyWebhookEvent
): LemonSqueezyWebhookEvent {
  const attributes = { ...event.data.attributes };
  for (const key of PII_ATTRIBUTE_KEYS) delete attributes[key];
  return {
    meta: { ...event.meta },
    data: { ...event.data, attributes },
  };
}
