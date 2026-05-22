import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace, type HitpayRecurringStatus } from "@/lib/db/models";
import { verifyHitpayCallback } from "@/lib/hitpay/webhook";
import { planForAmount } from "@/lib/hitpay/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// HitPay event payloads. The wrapper shape varies slightly across event
// types — we type loosely and pull only the fields we actually use.
type HitpayEvent = {
  type?: string;
  event?: string; // some payloads use `type`, some use `event` — accept both
  data?: Record<string, unknown>;
};

export async function POST(req: Request) {
  // Webhook auth must be computed against the raw body — never JSON.parse
  // first or the HMAC will mismatch on byte-perfect-but-differently-formatted
  // payloads. Read text(), verify, then parse.
  const rawBody = await req.text();
  const signature = req.headers.get("hitpay-signature");
  if (!verifyHitpayCallback(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: HitpayEvent;
  try {
    body = JSON.parse(rawBody) as HitpayEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = body.type ?? body.event ?? "";
  await connectDB();

  try {
    switch (event) {
      case "recurring_billing.subscription_updated":
        await handleSubscriptionUpdated(body.data);
        break;
      case "charge.created":
        await handleChargeCreated(body.data);
        break;
      default:
        // Acknowledge unknown events so HitPay doesn't retry forever.
        break;
    }
  } catch (err) {
    console.error(`[hitpay-webhook] handler failed for ${event}`, err);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

function pickString(data: Record<string, unknown> | undefined, key: string): string | null {
  const v = data?.[key];
  return typeof v === "string" ? v : null;
}

function pickNumber(data: Record<string, unknown> | undefined, key: string): number | null {
  const v = data?.[key];
  if (typeof v === "number") return v;
  if (typeof v === "string" && v !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// Map HitPay's status string onto our internal enum. Unknown statuses fall
// through to null so we don't poison the workspace doc.
function mapStatus(raw: string | null): HitpayRecurringStatus | null {
  switch (raw) {
    case "scheduled":
    case "pending":
      return "pending";
    case "active":
      return "active";
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "completed":
      return "completed";
    case "closed":
      return "closed";
    case "failed":
      return "failed";
    default:
      return null;
  }
}

async function handleSubscriptionUpdated(data: Record<string, unknown> | undefined) {
  if (!data) return;
  const billingId = pickString(data, "id") ?? pickString(data, "recurring_billing_id");
  const reference = pickString(data, "reference");
  if (!billingId && !reference) return;

  const rawStatus = pickString(data, "status");
  const status = mapStatus(rawStatus);
  const amount = pickNumber(data, "amount");
  const periodEndRaw =
    pickString(data, "next_billing_at") ??
    pickString(data, "next_payment_at") ??
    pickString(data, "current_period_end");
  const periodEnd = periodEndRaw ? new Date(periodEndRaw) : null;

  const filter = billingId
    ? { hitpayRecurringBillingId: billingId }
    : { hitpayRecurringReference: reference! };

  const update: Record<string, unknown> = {};
  if (status) update.hitpayRecurringStatus = status;
  if (periodEnd) update.hitpayCurrentPeriodEnd = periodEnd;
  if (billingId) update.hitpayRecurringBillingId = billingId;

  // Active subscriptions also promote the plan tier; cancelled/closed/failed
  // drop the workspace back to free.
  if (status === "active" && amount != null) {
    const tier = planForAmount(amount);
    if (tier !== "free") update.plan = tier;
  } else if (status === "cancelled" || status === "closed" || status === "failed") {
    update.plan = "free";
    update.hitpayCurrentPeriodEnd = null;
  }

  if (Object.keys(update).length === 0) return;
  await Workspace.updateOne(filter, { $set: update });
}

async function handleChargeCreated(data: Record<string, unknown> | undefined) {
  if (!data) return;
  // On each successful recurring cycle, HitPay fires charge.created with a
  // pointer back to the recurring-billing row. Use it to bump the period-end
  // anchor without waiting for the next subscription_updated event.
  const recurringBillingId =
    pickString(data, "recurring_billing_id") ?? pickString(data, "subscription_id");
  if (!recurringBillingId) return;

  const nextRaw =
    pickString(data, "next_billing_at") ?? pickString(data, "next_payment_at");
  const update: Record<string, unknown> = { hitpayRecurringStatus: "active" };
  if (nextRaw) update.hitpayCurrentPeriodEnd = new Date(nextRaw);

  await Workspace.updateOne(
    { hitpayRecurringBillingId: recurringBillingId },
    { $set: update }
  );
}
