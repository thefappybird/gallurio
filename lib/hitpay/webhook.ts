import { createHmac, timingSafeEqual } from "node:crypto";

// HitPay webhook authentication. Unlike Xendit's static-token compare, HitPay
// uses HMAC-SHA256 of the *raw* JSON body, secret = the dashboard "salt"
// value, compared against the Hitpay-Signature header.
//
// IMPORTANT: the signature must be computed over the raw body bytes — never
// JSON-re-serialize before verifying.
//
// Reference: https://docs.hitpayapp.com/apis/guide/events

export function verifyHitpayCallback(rawBody: string, signatureHeader: string | null): boolean {
  const expectedSalt = process.env.HITPAY_WEBHOOK_SALT;
  if (!expectedSalt) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing env var HITPAY_WEBHOOK_SALT");
    }
    // Dev convenience: allow unsigned posts (e.g., curl, hitpay-sim) but log it.
    console.warn("[hitpay-webhook] HITPAY_WEBHOOK_SALT unset — accepting unsigned dev callback");
    return true;
  }

  if (!signatureHeader) return false;

  const computed = createHmac("sha256", expectedSalt).update(rawBody).digest("hex");
  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(signatureHeader, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// The events we actually act on. Anything else is acknowledged with 200 so
// HitPay doesn't retry forever, but is otherwise ignored.
export const HANDLED_EVENTS = [
  // Subscription lifecycle (Gallurio billing the tenant)
  "recurring_billing.subscription_updated",
  // Each successful recurring cycle (the renewal payment)
  "charge.created",
] as const;

export type HandledEvent = (typeof HANDLED_EVENTS)[number];
