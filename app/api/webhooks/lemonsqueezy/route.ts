import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { connectDB } from "@/lib/db/mongoose";
import { WebhookEvent } from "@/lib/db/models";
import type { WebhookEventDoc } from "@/lib/db/models";
import { WEBHOOK_CLAIM_LEASE_MS } from "@/lib/db/models/WebhookEvent";
import {
  verifyAndParseLemonSqueezyEvent,
  lemonSqueezyEventEnvelopeSchema,
  computeWebhookEventKey,
  redactWebhookEventForStorage,
  type LemonSqueezyWebhookEvent,
  type HandledLemonSqueezyEvent,
} from "@/lib/lemonsqueezy/webhook";
import { resolveProviderEventTimestamp } from "@/lib/billing/webhookOrdering";
import { LEMONSQUEEZY_WEBHOOK_HANDLERS } from "@/lib/lemonsqueezy/webhookHandlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === 11000;
}

// ---------------------------------------------------------------------------
// Route handler
//
// Delivery guarantee: Lemon Squeezy delivers at-least-once (redelivers on any
// non-2xx response or timeout). The claim-lease protocol below makes handler
// APPLICATION idempotent/effectively-once, not mathematically exactly-once
// execution: the unique (provider, eventKey) index plus a per-claim token
// ensures at most one live worker ever applies a given logical event, and a
// worker whose 2-minute lease has already expired can never overwrite a
// newer claimant's outcome (the completion/failure writes below filter on
// {_id, claimToken} together).
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature");

  // verifyAndParseLemonSqueezyEvent throws (not returns null) when the
  // signing secret itself is missing in production — a startup misconfig,
  // not a bad request. Beta-only production mode legitimately allows
  // startup with no Lemon Squeezy secret configured (see lib/env.ts), which
  // makes that throw reachable here for the first time; return the
  // ledger's normal retryable-5xx instead of an uncaught exception.
  let verified: Awaited<ReturnType<typeof verifyAndParseLemonSqueezyEvent>>;
  try {
    verified = await verifyAndParseLemonSqueezyEvent(rawBody, signature);
  } catch (err) {
    console.error("[lemonsqueezy-webhook] verification failed", err);
    return NextResponse.json({ error: "webhook_verification_failed" }, { status: 500 });
  }
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // HMAC verification only proves the bytes came from Lemon Squeezy, not that
  // they parse into the envelope shape every handler assumes.
  const parsed = lemonSqueezyEventEnvelopeSchema.safeParse(verified);
  if (!parsed.success) {
    console.warn(
      "[lemonsqueezy-webhook] malformed verified payload",
      parsed.error.flatten()
    );
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const event = parsed.data as LemonSqueezyWebhookEvent;

  // Lemon Squeezy signs test-mode and live-mode events with the same webhook
  // secret, unlike Paddle's separate sandbox/production credentials. A prod
  // misconfiguration that leaves checkout creation in test mode (see
  // lib/lemonsqueezy/client.ts isTestMode(), which defaults ON) would
  // otherwise let a real customer complete a fake test-mode payment and still
  // have this handler grant them a paid plan. Never let a test-mode event
  // mutate billing state in production.
  if (process.env.NODE_ENV === "production" && event.meta.test_mode === true) {
    console.warn(
      `[lemonsqueezy-webhook] ignoring test-mode event in production: ${event.meta.event_name}`
    );
    return NextResponse.json({ received: true, ignored: "test_mode" });
  }

  await connectDB();

  const eventKey = computeWebhookEventKey(event);
  const now = new Date();
  const claimToken = randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + WEBHOOK_CLAIM_LEASE_MS);

  // Atomic claim: matches a genuinely-new eventKey (upsert path), a "failed"
  // row (retry), or a "processing" row whose lease has expired (reclaim).
  // A "processed" row or a "processing" row with a live lease matches
  // nothing here, so Mongo attempts an insert — which collides on the
  // unique (provider, eventKey) index and throws E11000; that's the signal
  // this delivery did NOT win the claim (caught below).
  let ledger: WebhookEventDoc;
  let claimed = true;
  try {
    ledger = await WebhookEvent.findOneAndUpdate(
      {
        provider: "lemonsqueezy",
        eventKey,
        $or: [{ status: "failed" }, { status: "processing", leaseExpiresAt: { $lt: now } }],
      },
      {
        $setOnInsert: {
          provider: "lemonsqueezy",
          eventKey,
          eventName: event.meta.event_name,
          resourceId: event.data.id || null,
          payload: redactWebhookEventForStorage(event),
        },
        $set: {
          status: "processing",
          claimToken,
          claimedAt: now,
          leaseExpiresAt,
        },
        $inc: { attemptCount: 1 },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    const existing = await WebhookEvent.findOne({ provider: "lemonsqueezy", eventKey });
    if (!existing) throw err;
    ledger = existing;
    claimed = false;
  }

  if (!claimed) {
    if (ledger.status === "processed") {
      // Already durably applied — ack without reprocessing.
      return NextResponse.json({ received: true, deduped: true });
    }
    // Someone else currently holds a live claim on this eventKey.
    return NextResponse.json({ received: true, processing: true });
  }

  const eventTimestamp = resolveProviderEventTimestamp(event.data.attributes);
  const handler =
    LEMONSQUEEZY_WEBHOOK_HANDLERS[event.meta.event_name as HandledLemonSqueezyEvent];

  try {
    // Acknowledge unmodelled events so Lemon Squeezy doesn't retry forever —
    // no handler means no billing mutation is performed.
    if (handler) await handler(event, eventTimestamp);
  } catch (err) {
    console.error(`[lemonsqueezy-webhook] handler failed for ${event.meta.event_name}`, err);
    const message = err instanceof Error ? err.message : String(err);
    await WebhookEvent.updateOne(
      { _id: ledger._id, claimToken },
      { $set: { status: "failed", failedAt: new Date(), lastError: message.slice(0, 500) } }
    );
    // Retryable 5xx — never ack 200 on a failed authoritative update. Lemon
    // Squeezy will redeliver; the ledger row's status !== "processed" lets
    // the claim gate above reclaim it (status "failed" is reclaimable
    // unconditionally, no lease wait needed).
    return NextResponse.json({ received: false, error: "handler failed" }, { status: 500 });
  }

  // Filtered on claimToken too: if our lease expired and someone else
  // reclaimed this row while the handler above was running, this update
  // matches nothing and silently no-ops instead of clobbering their result.
  await WebhookEvent.updateOne(
    { _id: ledger._id, claimToken },
    { $set: { status: "processed", processedAt: new Date() } }
  );

  return NextResponse.json({ received: true });
}
