import { NextResponse } from "next/server";
import { EventName } from "@paddle/paddle-node-sdk";
import type {
  SubscriptionNotification,
  TransactionNotification,
} from "@paddle/paddle-node-sdk";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace } from "@/lib/db/models";
import { Team } from "@/lib/db/models/team";
import { verifyAndParsePaddleEvent } from "@/lib/paddle/webhook";
import { planForPriceId } from "@/lib/paddle/plans";
import { planEntitlements } from "@/lib/plans/entitlements";
import { mapPaddleSubscriptionStatus } from "@/lib/paddle/status";
import { resumeHook } from "workflow/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// subscription.activated  &  subscription.updated
// ---------------------------------------------------------------------------
async function handleSubscriptionUpsert(
  data: SubscriptionNotification,
  isActivation: boolean
): Promise<void> {
  const workspaceIdFromCustomData =
    typeof data.customData?.workspaceId === "string"
      ? (data.customData.workspaceId as string)
      : null;

  // Defence-in-depth: when routing by customData.workspaceId, verify the
  // target workspace isn't already bound to a *different* subscription. This
  // guards against a stale client customData value mis-routing a new
  // subscription onto the wrong workspace doc.
  // Trust model: customData is Paddle-signature-gated (not attacker-forgeable),
  // but a wrong value from the client could still mismatch in production.
  let filter: Record<string, unknown>;
  if (workspaceIdFromCustomData) {
    // Check whether the target workspace has a different existing subscription.
    const existingWs = await Workspace.findOne({ _id: workspaceIdFromCustomData })
      .select({ _id: 1, paddleSubscriptionId: 1 })
      .lean();
    const existingSubId = existingWs?.paddleSubscriptionId ?? null;

    if (existingSubId && existingSubId !== data.id) {
      // The workspace is already bound to a different subscription. Log the
      // mismatch and prefer routing by the incoming subscription id instead.
      console.warn(
        `[paddle-webhook] customData.workspaceId ${workspaceIdFromCustomData} ` +
          `already has subscription ${existingSubId}, got ${data.id} — ` +
          `routing by paddleSubscriptionId instead`
      );
      filter = { paddleSubscriptionId: data.id };
    } else {
      filter = { _id: workspaceIdFromCustomData };
    }
  } else if (data.id) {
    filter = { paddleSubscriptionId: data.id };
  } else {
    filter = { paddleCustomerId: data.customerId };
  }

  const status = mapPaddleSubscriptionStatus(data.status);
  const priceId = data.items[0]?.price?.id ?? null;
  const periodEnd = data.currentBillingPeriod?.endsAt
    ? new Date(data.currentBillingPeriod.endsAt)
    : undefined;

  const update: Record<string, unknown> = {
    paddleSubscriptionId: data.id,
    paddleCustomerId: data.customerId,
  };
  if (status) update.paddleSubscriptionStatus = status;
  if (periodEnd) update.paddleCurrentPeriodEnd = periodEnd;

  // Resolve the new plan from the priceId. Only promote when the resolved tier
  // is paid — a priceId miss (e.g. env var unset in dev) must not silently
  // downgrade a workspace.
  const newTier = priceId ? planForPriceId(priceId) : "free";
  if (newTier !== "free") {
    // Team-cap guard: if the workspace currently has more teams than the new
    // tier allows, drop the plan from this update. The owner must delete teams
    // first before the downgrade can take effect (UI surfaces this).
    const ws = await Workspace.findOne(filter).select({ _id: 1, plan: 1 }).lean();
    if (ws) {
      const entitlements = planEntitlements(newTier);
      const currentTeamCount = await Team.countDocuments({ workspaceId: ws._id });
      if (currentTeamCount > entitlements.maxTeams) {
        console.warn(
          `[paddle-webhook] refused plan update for workspace ${String(ws._id)}: ` +
            `${currentTeamCount} teams > ${entitlements.maxTeams} maxTeams (${newTier})`
        );
        // Don't include plan in the update — keep existing value.
      } else {
        update.plan = newTier;
      }
    } else {
      // Workspace not yet found by filter; safe to include plan.
      update.plan = newTier;
    }
  }

  if (Object.keys(update).length === 0) return;
  await Workspace.updateOne(filter, { $set: update });

  // For activations: attempt to resume the in-flight checkout workflow hook.
  // If the run already completed (or never existed) the resumeHook call will
  // throw — that's a non-fatal condition because the DB update above already
  // persisted the subscription state. We swallow and log.
  if (isActivation && workspaceIdFromCustomData) {
    try {
      await resumeHook(`paddle-checkout-${workspaceIdFromCustomData}`, {
        subscriptionId: data.id,
        customerId: data.customerId,
        status: data.status,
        periodEnd: data.currentBillingPeriod?.endsAt ?? null,
      });
    } catch (e) {
      console.warn(
        `[paddle-webhook] resumeHook paddle-checkout-${workspaceIdFromCustomData} failed (non-fatal):`,
        e
      );
    }
  }
}

// ---------------------------------------------------------------------------
// subscription.canceled
// ---------------------------------------------------------------------------
async function handleSubscriptionCanceled(data: SubscriptionNotification): Promise<void> {
  const workspaceIdFromCustomData =
    typeof data.customData?.workspaceId === "string"
      ? (data.customData.workspaceId as string)
      : null;

  const filter: Record<string, unknown> = workspaceIdFromCustomData
    ? { _id: workspaceIdFromCustomData }
    : data.id
      ? { paddleSubscriptionId: data.id }
      : { paddleCustomerId: data.customerId };

  // Cancellations ALWAYS downgrade to free — bypassing the team-cap guard.
  // Over-cap teams are surfaced in the UI; leaving cancelled accounts on paid
  // entitlements is a billing leak and is never acceptable.
  await Workspace.updateOne(filter, {
    $set: {
      plan: "free",
      paddleSubscriptionStatus: "canceled",
      paddleCurrentPeriodEnd: null,
    },
  });
}

// ---------------------------------------------------------------------------
// subscription.past_due  /  subscription.paused
// ---------------------------------------------------------------------------
async function handleSubscriptionStatusOnly(
  data: SubscriptionNotification
): Promise<void> {
  const status = mapPaddleSubscriptionStatus(data.status);
  if (!status) return;

  const filter: Record<string, unknown> = data.id
    ? { paddleSubscriptionId: data.id }
    : { paddleCustomerId: data.customerId };

  await Workspace.updateOne(filter, { $set: { paddleSubscriptionStatus: status } });
}

// ---------------------------------------------------------------------------
// transaction.completed
// ---------------------------------------------------------------------------
async function handleTransactionCompleted(data: TransactionNotification): Promise<void> {
  // We only care about recurring subscription renewals — skip one-off charges.
  if (!data.subscriptionId) return;

  const update: Record<string, unknown> = {
    paddleSubscriptionStatus: "active",
  };
  // billingPeriod.endsAt carries the just-renewed period end.
  if (data.billingPeriod?.endsAt) {
    update.paddleCurrentPeriodEnd = new Date(data.billingPeriod.endsAt);
  }

  await Workspace.updateOne(
    { paddleSubscriptionId: data.subscriptionId },
    { $set: update }
  );
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("paddle-signature");

  const event = await verifyAndParsePaddleEvent(rawBody, signature);
  if (!event) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  await connectDB();

  try {
    switch (event.eventType) {
      case EventName.SubscriptionActivated:
        await handleSubscriptionUpsert(
          event.data as SubscriptionNotification,
          true
        );
        break;

      case EventName.SubscriptionUpdated:
        await handleSubscriptionUpsert(
          event.data as SubscriptionNotification,
          false
        );
        break;

      case EventName.SubscriptionCanceled:
        await handleSubscriptionCanceled(event.data as SubscriptionNotification);
        break;

      case EventName.SubscriptionPastDue:
      case EventName.SubscriptionPaused:
        await handleSubscriptionStatusOnly(event.data as SubscriptionNotification);
        break;

      case EventName.TransactionCompleted:
        await handleTransactionCompleted(event.data as TransactionNotification);
        break;

      default:
        // Acknowledge unmodelled events so Paddle doesn't retry forever.
        break;
    }
  } catch (err) {
    console.error(`[paddle-webhook] handler failed for ${event.eventType}`, err);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
