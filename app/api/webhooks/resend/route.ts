import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { WebhookEvent } from "@/lib/db/models";
import type { WebhookEventDoc } from "@/lib/db/models";
import {
  verifyAndParseResendEvent,
  computeResendEventKey,
  type ResendWebhookEvent,
} from "./verify";

// This route is public but signature-gated — the svix HMAC verification below
// IS the identity/auth check for this endpoint. Monitoring only: reacts to
// async delivery-outcome events (bounce/complaint) that arrive after a send
// already succeeded via lib/email/send.ts. Does not build a suppression list
// or block future sends — that's a larger feature, not implemented here.
export const runtime = "nodejs"; // Signature crypto requires Node, not Edge.
export const dynamic = "force-dynamic";

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === 11000;
}

// Redacted, structured log — never the recipient address (mirrors
// lib/email/send.ts's logEmailFailure "count/type only, never the address"
// rule). emailId is Resend's own message id, not PII.
function logDeliveryProblem(event: ResendWebhookEvent): void {
  const emailId = typeof event.data.email_id === "string" ? event.data.email_id : null;
  console.warn("[email-webhook] bounce/complaint", {
    type: event.type,
    emailId,
    at: event.created_at,
  });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  const event = await verifyAndParseResendEvent(rawBody, svixId, svixTimestamp, svixSignature);
  if (!event) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  await connectDB();

  const eventKey = computeResendEventKey(svixId, event);

  // Atomic dedupe gate, mirroring the Lemon Squeezy / WorkOS webhook ledger
  // pattern: first delivery inserts via $setOnInsert (unique index on
  // provider+eventKey enforces this under concurrent redelivery); every
  // subsequent delivery for the same key matches the existing row instead of
  // erroring. Two concurrent first deliveries can still race the unique
  // index — the loser's upsert throws E11000; treat that as "already
  // received" and re-fetch the row the winner just inserted instead of 500ing.
  let ledger: WebhookEventDoc;
  try {
    ledger = await WebhookEvent.findOneAndUpdate(
      { provider: "resend", eventKey },
      {
        $setOnInsert: {
          provider: "resend",
          eventKey,
          eventName: event.type,
          resourceId: typeof event.data.email_id === "string" ? event.data.email_id : null,
          status: "received",
        },
        $inc: { attemptCount: 1 },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    const existing = await WebhookEvent.findOne({ provider: "resend", eventKey });
    if (!existing) throw err;
    ledger = existing;
  }

  if (ledger.status === "processed") {
    // Already durably applied — ack without reprocessing.
    return NextResponse.json({ received: true, deduped: true });
  }

  try {
    switch (event.type) {
      case "email.bounced":
      case "email.complained":
        logDeliveryProblem(event);
        break;
      default:
        // email.sent / email.delivered / email.delivery_delayed / anything
        // unmodelled — acknowledge, no action needed.
        break;
    }
  } catch (err) {
    console.error(`[resend-webhook] handler failed for ${event.type}`, err);
    const message = err instanceof Error ? err.message : String(err);
    await WebhookEvent.updateOne(
      { _id: ledger._id },
      { $set: { status: "failed", failedAt: new Date(), lastError: message.slice(0, 500) } }
    );
    // Retryable 5xx — Resend/Svix redelivers; the ledger row's status !==
    // "processed" lets the dedupe gate above re-run the handler on retry
    // instead of skipping it as already-applied.
    return NextResponse.json({ received: false, error: "handler failed" }, { status: 500 });
  }

  await WebhookEvent.updateOne(
    { _id: ledger._id },
    { $set: { status: "processed", processedAt: new Date() } }
  );

  return NextResponse.json({ received: true });
}
