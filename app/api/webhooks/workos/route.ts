import { NextResponse } from "next/server";
import { workos } from "@/lib/workos";
import { connectDB } from "@/lib/db/mongoose";
import { WebhookEvent } from "@/lib/db/models";
import type { WebhookEventDoc } from "@/lib/db/models";
import { renderBrandedEmail } from "@/lib/email/layout";
import { gallurioBrand } from "@/lib/email/brand";
import { sendEmail, logEmailFailure } from "@/lib/email/send";
import { EMAIL_COPY } from "@/lib/email/messages";

// This route is public but signature-gated — the HMAC verification below IS
// the identity/auth check for this endpoint (satisfies "auth on every route").
export const runtime = "nodejs"; // Signature crypto requires Node, not Edge.
export const dynamic = "force-dynamic";

// email_verification.created fires during sign-up, before the user has any
// workspace, so there is no reliable locale signal. Resolve to "en" — the
// established convention for platform emails (sendInquiryNotification,
// sendBookingConfirmedOwner). No User/Workspace lookup needed.
function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === 11000;
}

async function handleEmailVerificationCreated(data: { id: string }) {
  const copy = EMAIL_COPY.verification.en;
  const verification = await workos.userManagement.getEmailVerification(data.id);
  const { html, text } = renderBrandedEmail({
    brand: gallurioBrand(),
    locale: "en",
    preheader: copy.intro,
    title: "Verify your email",
    blocks: [
      { type: "p", text: copy.greeting },
      { type: "p", text: copy.intro },
      { type: "p", text: copy.codeLabel },
      { type: "heading", text: verification.code },
      { type: "p", text: copy.expiry },
      { type: "spacer" },
      { type: "p", text: copy.ignore },
    ],
  });
  const result = await sendEmail({
    to: verification.email,
    subject: copy.subject,
    html,
    text,
  });
  if (!result.ok) {
    logEmailFailure("email_verification", verification.email, result);
    // Throw so the outer dispatch try/catch marks the ledger row "failed"
    // and returns a retryable 5xx — WorkOS redelivers and this handler
    // re-sends the code (recovery path for a transient Resend outage).
    throw new Error(`email_verification send failed: ${result.error}`);
  }
}

export async function POST(req: Request) {
  const payload = await req.text();

  const sig = req.headers.get("workos-signature");
  if (!sig) {
    return new NextResponse("Missing WorkOS-Signature header", { status: 400 });
  }

  let event: Awaited<ReturnType<typeof workos.webhooks.constructEvent>>;
  try {
    event = await workos.webhooks.constructEvent({
      payload,
      sigHeader: sig,
      secret: process.env.WORKOS_WEBHOOK_SECRET!,
    });
  } catch {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  await connectDB();

  // Atomic dedupe gate, mirroring the Lemon Squeezy webhook ledger pattern:
  // WorkOS events carry a stable per-delivery id (unlike LS), used directly
  // as eventKey. First delivery inserts via $setOnInsert (unique index on
  // provider+eventKey enforces this under concurrent redelivery); every
  // subsequent delivery for the same id matches the existing row. Two
  // concurrent first deliveries can still race the unique index — the
  // loser's upsert throws E11000; treat that as "already received" and
  // re-fetch the row the winner just inserted instead of 500ing.
  const eventId = (event as { id: string }).id;
  let ledger: WebhookEventDoc;
  try {
    ledger = await WebhookEvent.findOneAndUpdate(
      { provider: "workos", eventKey: eventId },
      {
        $setOnInsert: {
          provider: "workos",
          eventKey: eventId,
          eventName: event.event,
          status: "received",
        },
        $inc: { attemptCount: 1 },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    const existing = await WebhookEvent.findOne({ provider: "workos", eventKey: eventId });
    if (!existing) throw err;
    ledger = existing;
  }

  if (ledger.status === "processed") {
    // Already durably applied — ack without reprocessing.
    return NextResponse.json({ received: true, deduped: true });
  }

  // Dispatch by event type. Each case can be filled in as new event handlers
  // are added (e.g. Task 18 adds "email_verification.created").
  try {
    switch (event.event) {
      case "email_verification.created":
        await handleEmailVerificationCreated(event.data as { id: string });
        break;
      default:
        // Unhandled event types are acknowledged and logged — no retry needed.
        console.log(`[workos-webhook] unhandled event: ${event.event}`);
        break;
    }
  } catch (err) {
    console.error(`[workos-webhook] handler failed for ${event.event}`, err);
    const message = err instanceof Error ? err.message : String(err);
    await WebhookEvent.updateOne(
      { _id: ledger._id },
      { $set: { status: "failed", failedAt: new Date(), lastError: message.slice(0, 500) } }
    );
    // Retryable 5xx — never ack 200 on a failed handler. WorkOS redelivers;
    // the ledger row's status !== "processed" lets the dedupe gate above
    // re-run the handler on retry instead of skipping it as already-applied.
    return NextResponse.json({ received: false, error: "handler failed" }, { status: 500 });
  }

  await WebhookEvent.updateOne(
    { _id: ledger._id },
    { $set: { status: "processed", processedAt: new Date() } }
  );

  return NextResponse.json({ received: true });
}
