import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Resend webhooks are Svix-based (https://resend.com/docs/webhooks/introduction).
// Confirmed payload shape (Resend docs + Svix blog — no public example gives
// the full bounce/complaint sub-fields, so only the top-level shape below is
// relied on):
//   { type: "email.bounced", created_at: "2026-...Z", data: { email_id, from, to, subject, ... } }
// Headers per delivery: svix-id (stable per-delivery id), svix-timestamp,
// svix-signature (one-or-more space-separated "v1,<base64-hmac>" tokens).
export type ResendWebhookEvent = {
  type: string;
  created_at: string;
  data: Record<string, unknown>;
};

// No `resend`/`svix` npm packages (see lib/email/send.ts — zero-dependency
// policy) — verify manually with node:crypto, mirroring
// lib/lemonsqueezy/webhook.ts's manual-HMAC convention.
export async function verifyAndParseResendEvent(
  rawBody: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignature: string | null
): Promise<ResendWebhookEvent | null> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing env var RESEND_WEBHOOK_SECRET");
    }
    // Dev convenience: allow unsigned posts without round-tripping Resend's
    // dashboard, matching lib/lemonsqueezy/webhook.ts's dev fallback.
    console.warn(
      "[resend-webhook] RESEND_WEBHOOK_SECRET unset — accepting unsigned dev event"
    );
    return JSON.parse(rawBody) as ResendWebhookEvent;
  }

  if (!svixId || !svixTimestamp || !svixSignature) return null;

  // whsec_<base64> -> raw HMAC key.
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = createHmac("sha256", secretBytes).update(signedContent).digest("base64");
  const expectedBuf = Buffer.from(expected, "base64");

  // svix-signature can carry multiple space-separated "v1,<sig>" tokens
  // (secret rotation) — a match against any one is valid.
  const matched = svixSignature
    .split(" ")
    .filter(Boolean)
    .some((token) => {
      const [version, sig] = token.split(",");
      if (version !== "v1" || !sig) return false;
      let sigBuf: Buffer;
      try {
        sigBuf = Buffer.from(sig, "base64");
      } catch {
        return false;
      }
      if (sigBuf.length !== expectedBuf.length) return false;
      return timingSafeEqual(sigBuf, expectedBuf);
    });

  if (!matched) return null;

  try {
    return JSON.parse(rawBody) as ResendWebhookEvent;
  } catch (err) {
    console.error("[resend-webhook] failed to parse verified body", err);
    return null;
  }
}

// Resend/Svix deliveries carry a stable per-delivery id (the svix-id header
// itself) — use it directly as the dedupe key, no content hash needed (unlike
// Lemon Squeezy, which has no per-delivery id). Only falls back to a content
// hash for the dev-unsigned path, where a request could arrive without the
// header at all.
export function computeResendEventKey(
  svixId: string | null,
  event: ResendWebhookEvent
): string {
  if (svixId) return svixId;
  const material = `${event.type}:${event.created_at}:${JSON.stringify(event.data)}`;
  return createHash("sha256").update(material).digest("hex");
}
