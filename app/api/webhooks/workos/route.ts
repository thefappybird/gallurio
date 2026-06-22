import { NextResponse } from "next/server";
import { workos } from "@/lib/workos";
import { renderBrandedEmail } from "@/lib/email/layout";
import { gallurioBrand } from "@/lib/email/brand";
import { sendEmail } from "@/lib/email/send";
import { EMAIL_COPY } from "@/lib/email/messages";

// This route is public but signature-gated — the HMAC verification below IS
// the identity/auth check for this endpoint (satisfies "auth on every route").
export const runtime = "nodejs"; // Signature crypto requires Node, not Edge.
export const dynamic = "force-dynamic";

// email_verification.created fires during sign-up, before the user has any
// workspace, so there is no reliable locale signal. Resolve to "en" — the
// established convention for platform emails (sendInquiryNotification,
// sendBookingConfirmedOwner). No User/Workspace lookup needed.
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
      { type: "heading", text: verification.code },
      { type: "p", text: copy.expiry },
      { type: "spacer" },
      { type: "p", text: copy.ignore },
    ],
  });
  await sendEmail({
    to: verification.email,
    subject: copy.subject,
    html,
    text,
  });
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

  // Dispatch by event type. Each case can be filled in as new event handlers
  // are added (e.g. Task 18 adds "email_verification.created").
  // The entire dispatch is wrapped so a handler failure never propagates a 500
  // into WorkOS's retry loop — always ack with 200 after verified.
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
    // Still return 200: ack to WorkOS so it doesn't retry. The error is logged.
  }

  return new NextResponse(null, { status: 200 });
}
