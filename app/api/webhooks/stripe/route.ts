import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, planForPriceId } from "@/lib/stripe/client";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace } from "@/lib/db/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: Request) {
  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET not configured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: `Webhook signature verification failed: ${msg}` }, { status: 400 });
  }

  await connectDB();

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpsert(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      default:
        // Ignore unhandled event types — Stripe expects a 2xx.
        break;
    }
  } catch (err) {
    console.error(`[stripe-webhook] handler failed for ${event.type}`, err);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const workspaceId = session.client_reference_id ?? session.metadata?.workspaceId;
  if (!workspaceId) return;
  if (!session.subscription) return;

  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription.id;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  await applySubscriptionToWorkspace(workspaceId, subscription);
}

async function handleSubscriptionUpsert(subscription: Stripe.Subscription) {
  const workspaceId = await resolveWorkspaceId(subscription);
  if (!workspaceId) return;
  await applySubscriptionToWorkspace(workspaceId, subscription);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const workspaceId = await resolveWorkspaceId(subscription);
  if (!workspaceId) return;

  await Workspace.updateOne(
    { _id: workspaceId },
    {
      $set: {
        plan: "free",
        stripeSubscriptionId: null,
        stripePriceId: null,
        stripeStatus: subscription.status,
        stripeCurrentPeriodEnd: null,
      },
    }
  );
}

async function applySubscriptionToWorkspace(workspaceId: string, subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  const priceId = item?.price.id;
  if (!priceId) return;

  const plan = planForPriceId(priceId);
  const currentPeriodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000)
    : null;

  await Workspace.updateOne(
    { _id: workspaceId },
    {
      $set: {
        plan,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        stripeStatus: subscription.status,
        stripeCurrentPeriodEnd: currentPeriodEnd,
      },
    }
  );
}

async function resolveWorkspaceId(subscription: Stripe.Subscription): Promise<string | null> {
  const fromMetadata = subscription.metadata?.workspaceId;
  if (fromMetadata) return fromMetadata;

  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const ws = await Workspace.findOne({ stripeCustomerId: customerId }).select({ _id: 1 }).lean();
  return ws ? ws._id.toString() : null;
}
