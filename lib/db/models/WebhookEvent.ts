import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

// Durable ledger + dedupe gate + processing-claim lease for inbound provider
// webhooks. Webhooks are workspace-independent (a delivery may arrive before
// we can even resolve a tenant), so this collection is never scoped by
// workspaceId — the unique index is (provider, eventKey) only.
//
// Delivery guarantee: at-least-once (Lemon Squeezy redelivers on non-2xx/
// timeout). The claim-lease protocol below makes handler APPLICATION
// idempotent/effectively-once — not mathematically exactly-once execution —
// by ensuring only one live worker holds the claim for a given eventKey at a
// time, and completion/failure writes are fenced by a per-claim token so a
// worker whose lease already expired can never clobber a newer claimant's
// result.
export const WEBHOOK_EVENT_STATUSES = ["received", "processing", "processed", "failed"] as const;
export type WebhookEventStatus = (typeof WEBHOOK_EVENT_STATUSES)[number];

// How long a claim is honored before another delivery may reclaim the row
// (e.g. the original worker crashed/hung mid-handler). Synchronous handlers
// finish in milliseconds, so 2 minutes is a generous ceiling, not a target.
export const WEBHOOK_CLAIM_LEASE_MS = 2 * 60_000;

const webhookEventSchema = new Schema(
  {
    provider: { type: String, required: true, default: "lemonsqueezy" },
    eventKey: { type: String, required: true },
    eventName: { type: String, required: true },
    resourceId: { type: String, default: null },
    status: {
      type: String,
      enum: WEBHOOK_EVENT_STATUSES,
      required: true,
      default: "received",
    },
    attemptCount: { type: Number, default: 1 },
    // Opaque per-claim token — regenerated on every successful claim/reclaim.
    // Completion/failure writes filter on {_id, claimToken} together so a
    // worker whose lease has since expired and been reclaimed by someone
    // else can never overwrite that newer claimant's outcome.
    claimToken: { type: String, default: null },
    claimedAt: { type: Date, default: null },
    // Claim expiry — a delivery may atomically reclaim a row once this is in
    // the past (see the lease-recovery index below) even if status is still
    // "processing" (the original worker never got to mark it processed/failed).
    leaseExpiresAt: { type: Date, default: null },
    processedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    // Truncated error message only (see route.ts) — never a raw stack/secret.
    lastError: { type: String, default: null },
    // Redacted copy of the verified event (PII attribute keys like
    // user_email/user_name stripped — see redactWebhookEventForStorage) kept
    // so scripts/replay-lemonsqueezy-event.ts can resend it through the real
    // webhook endpoint without a round-trip to Lemon Squeezy, which has no
    // replay API.
    payload: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

// Dedupe gate: Lemon Squeezy delivers no per-delivery event UUID (data.id is
// the resource's own id, reused by every event about that resource) —
// eventKey is a content hash computed by lib/lemonsqueezy/webhook.ts. The
// unique index is the atomic gate a duplicate/redelivered event bounces off.
webhookEventSchema.index({ provider: 1, eventKey: 1 }, { unique: true });

// Lease-recovery index: supports the reclaim query's shape — atomically find
// a row for this provider whose lease has expired (findOneAndUpdate filters
// on provider + eventKey + status + leaseExpiresAt together; provider/status
// narrow first, leaseExpiresAt is the range predicate). Not unique — many
// rows can share provider+status, this only speeds up the reclaim scan.
webhookEventSchema.index({ provider: 1, status: 1, leaseExpiresAt: 1 });

export type WebhookEventDoc = InferSchemaType<typeof webhookEventSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const WebhookEvent: Model<WebhookEventDoc> =
  (mongoose.models.WebhookEvent as Model<WebhookEventDoc>) ??
  mongoose.model<WebhookEventDoc>("WebhookEvent", webhookEventSchema);
