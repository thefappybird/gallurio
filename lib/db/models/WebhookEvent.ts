import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

// Durable ledger + dedupe gate for inbound provider webhooks. Webhooks are
// workspace-independent (a delivery may arrive before we can even resolve a
// tenant), so this collection is never scoped by workspaceId — the unique
// index is (provider, eventKey) only.
export const WEBHOOK_EVENT_STATUSES = ["received", "processed", "failed"] as const;
export type WebhookEventStatus = (typeof WEBHOOK_EVENT_STATUSES)[number];

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

export type WebhookEventDoc = InferSchemaType<typeof webhookEventSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const WebhookEvent: Model<WebhookEventDoc> =
  (mongoose.models.WebhookEvent as Model<WebhookEventDoc>) ??
  mongoose.model<WebhookEventDoc>("WebhookEvent", webhookEventSchema);
