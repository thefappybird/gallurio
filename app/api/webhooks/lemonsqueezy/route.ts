import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace } from "@/lib/db/models";
import { Team } from "@/lib/db/models/team";
import {
  verifyAndParseLemonSqueezyEvent,
  type LemonSqueezyWebhookEvent,
} from "@/lib/lemonsqueezy/webhook";
import { planForVariantId } from "@/lib/lemonsqueezy/plans";
import { planEntitlements } from "@/lib/plans/entitlements";
import { mapLemonSqueezySubscriptionStatus } from "@/lib/lemonsqueezy/status";
import { resumeHook } from "workflow/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function workspaceIdFromEvent(event: LemonSqueezyWebhookEvent): string | null {
  const raw = event.meta.custom_data?.workspaceId;
  return typeof raw === "string" ? raw : null;
}

function stringAttr(attrs: Record<string, unknown>, key: string): string | null {
  const v = attrs[key];
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return null;
}

// Shared routing precedence for every handler except handleSubscriptionUpsert
// (which additionally needs the mismatch-guard DB read): custom_data.workspaceId,
// then the Lemon Squeezy subscription id, then the customer id. Returns null when
// none are usable so callers can no-op instead of falling through to a filter
// like { lsCustomerId: null } that could match an unrelated workspace.
function resolveWorkspaceFilter(event: LemonSqueezyWebhookEvent): Record<string, unknown> | null {
  const wsIdFromCustomData = workspaceIdFromEvent(event);
  if (wsIdFromCustomData) return { _id: wsIdFromCustomData };

  // subscription_payment_* events are "subscription-invoices" resources:
  // event.data.id is the invoice's own id, and the subscription id lives in
  // attributes.subscription_id instead. Subscription-typed events (created/
  // updated/cancelled/expired/paused/...) have no subscription_id attribute,
  // so this only takes effect for invoice events — event.data.id remains the
  // correct subscription id for every other event this handler routes.
  const attrSubscriptionId = stringAttr(event.data.attributes, "subscription_id");
  const subscriptionId = attrSubscriptionId ?? event.data.id;
  if (subscriptionId) return { lsSubscriptionId: subscriptionId };

  const customerId = stringAttr(event.data.attributes, "customer_id");
  if (customerId) return { lsCustomerId: customerId };

  return null;
}

// ---------------------------------------------------------------------------
// subscription_created  &  subscription_updated
// ---------------------------------------------------------------------------
async function handleSubscriptionUpsert(
  event: LemonSqueezyWebhookEvent,
  isActivation: boolean
): Promise<void> {
  const subscriptionId = event.data.id;
  const attrs = event.data.attributes;
  const wsIdFromCustomData = workspaceIdFromEvent(event);

  // Defence-in-depth: when routing by customData.workspaceId, verify the
  // target workspace isn't already bound to a *different* subscription. This
  // guards against a stale client customData value mis-routing a new
  // subscription onto the wrong workspace doc.
  let filter: Record<string, unknown>;
  if (wsIdFromCustomData) {
    const existingWs = await Workspace.findOne({ _id: wsIdFromCustomData })
      .select({ _id: 1, lsSubscriptionId: 1 })
      .lean();
    const existingSubId = existingWs?.lsSubscriptionId ?? null;

    if (existingSubId && existingSubId !== subscriptionId) {
      console.warn(
        `[lemonsqueezy-webhook] customData.workspaceId ${wsIdFromCustomData} ` +
          `already has subscription ${existingSubId}, got ${subscriptionId} — ` +
          `routing by lsSubscriptionId instead`
      );
      filter = { lsSubscriptionId: subscriptionId };
    } else {
      filter = { _id: wsIdFromCustomData };
    }
  } else if (subscriptionId) {
    filter = { lsSubscriptionId: subscriptionId };
  } else {
    // Same null-filter hazard resolveWorkspaceFilter guards against: an empty
    // customer_id here would build { lsCustomerId: null }, which matches any
    // never-billed workspace and could promote an unrelated tenant to paid.
    const customerId = stringAttr(attrs, "customer_id");
    if (!customerId) {
      console.warn(
        `[lemonsqueezy-webhook] ${event.meta.event_name} has no usable identifier ` +
          "(no custom_data.workspaceId, subscription id, or customer_id) — skipping"
      );
      return;
    }
    filter = { lsCustomerId: customerId };
  }

  const rawStatus = stringAttr(attrs, "status");
  const status = mapLemonSqueezySubscriptionStatus(rawStatus);
  const variantId = stringAttr(attrs, "variant_id");
  const renewsAt = stringAttr(attrs, "renews_at");
  const periodEnd = renewsAt ? new Date(renewsAt) : undefined;

  const update: Record<string, unknown> = {
    lsSubscriptionId: subscriptionId,
    lsCustomerId: stringAttr(attrs, "customer_id"),
  };
  if (status) update.lsSubscriptionStatus = status;
  if (periodEnd) update.lsCurrentPeriodEnd = periodEnd;

  // Resolve the new plan from the variantId. Only promote when the resolved
  // tier is paid — a variantId miss (e.g. env var unset in dev) must not
  // silently downgrade a workspace. Also refuse to promote on a terminal
  // status: subscription_updated fires on ANY attribute change, so a trailing
  // update carrying a cancelled/expired status (variant_id is still populated
  // on those) must not re-promote a workspace the dedicated
  // subscription_cancelled/subscription_expired handlers already settled —
  // those handlers are authoritative for terminal transitions, this one isn't.
  const newTier = variantId ? planForVariantId(variantId) : "free";
  if (newTier !== "free" && status !== "canceled") {
    // Team-cap guard: if the workspace currently has more teams than the new
    // tier allows, drop the plan from this update. The owner must delete teams
    // first before the downgrade can take effect (UI surfaces this).
    const ws = await Workspace.findOne(filter).select({ _id: 1, plan: 1 }).lean();
    if (ws) {
      const entitlements = planEntitlements(newTier);
      const currentTeamCount = await Team.countDocuments({ workspaceId: ws._id });
      if (currentTeamCount > entitlements.maxTeams) {
        console.warn(
          `[lemonsqueezy-webhook] refused plan update for workspace ${String(ws._id)}: ` +
            `${currentTeamCount} teams > ${entitlements.maxTeams} maxTeams (${newTier})`
        );
        // Don't include plan in the update — keep existing value.
      } else {
        update.plan = newTier;
        update.everSubscribed = true;
      }
    } else {
      // Workspace not yet found by filter; safe to include plan.
      update.plan = newTier;
      update.everSubscribed = true;
    }
  }

  // update always carries at least lsSubscriptionId/lsCustomerId (set above).
  await Workspace.updateOne(filter, { $set: update });

  // For activations: attempt to resume the in-flight checkout workflow hook.
  // If the run already completed (or never existed) the resumeHook call will
  // throw — that's a non-fatal condition because the DB update above already
  // persisted the subscription state. We swallow and log.
  if (isActivation && wsIdFromCustomData) {
    try {
      await resumeHook(`ls-checkout-${wsIdFromCustomData}`, {
        subscriptionId,
        customerId: stringAttr(attrs, "customer_id") ?? "",
        status: rawStatus ?? "",
        periodEnd: renewsAt,
      });
    } catch (e) {
      console.warn(
        `[lemonsqueezy-webhook] resumeHook ls-checkout-${wsIdFromCustomData} failed (non-fatal):`,
        e
      );
    }
  }
}

// ---------------------------------------------------------------------------
// subscription_cancelled — cancel is NOT immediate. Access continues until
// `ends_at`; only mark status, never downgrade plan here.
// ---------------------------------------------------------------------------
async function handleSubscriptionCancelled(event: LemonSqueezyWebhookEvent): Promise<void> {
  const filter = resolveWorkspaceFilter(event);
  if (!filter) return;

  const attrs = event.data.attributes;
  const update: Record<string, unknown> = { lsSubscriptionStatus: "canceled" };
  const endsAt = stringAttr(attrs, "ends_at");
  if (endsAt) update.lsCurrentPeriodEnd = new Date(endsAt);

  await Workspace.updateOne(filter, { $set: update });
}

// ---------------------------------------------------------------------------
// subscription_expired / subscription_payment_refunded — hard access-ended
// boundaries: always downgrade to free, bypassing the team-cap guard. Over-cap
// teams are surfaced in the UI; leaving an expired-or-refunded account on paid
// entitlements is a billing leak and is never acceptable. A refund (full or
// partial) means the customer got money back, so they lose paid access
// immediately rather than waiting for a separate cancellation.
// everSubscribed is never reset here — a workspace that has ever paid stays
// locked out of free-tier access after expiry until it resubscribes (see
// lib/billing/access.ts).
// ---------------------------------------------------------------------------
async function handleSubscriptionExpired(event: LemonSqueezyWebhookEvent): Promise<void> {
  const filter = resolveWorkspaceFilter(event);
  if (!filter) return;

  await Workspace.updateOne(filter, {
    $set: {
      plan: "free",
      lsSubscriptionStatus: "canceled",
      lsCurrentPeriodEnd: null,
      // Clear lsSubscriptionId — otherwise a later resubscribe's
      // subscription_created event finds this workspace already "bound" to
      // the expired subscription id, trips handleSubscriptionUpsert's
      // mismatch guard, and reroutes to a filter matching zero documents
      // (the new subscription id was never persisted), silently failing to
      // promote the plan.
      lsSubscriptionId: null,
    },
  });
}

// ---------------------------------------------------------------------------
// subscription_paused / subscription_unpaused / subscription_resumed /
// subscription_payment_failed — status-only update.
// ---------------------------------------------------------------------------
async function handleSubscriptionStatusOnly(event: LemonSqueezyWebhookEvent): Promise<void> {
  const status = mapLemonSqueezySubscriptionStatus(stringAttr(event.data.attributes, "status"));
  if (!status) return;

  const filter = resolveWorkspaceFilter(event);
  if (!filter) return;

  await Workspace.updateOne(filter, { $set: { lsSubscriptionStatus: status } });
}

// ---------------------------------------------------------------------------
// subscription_payment_success — best-effort bump to active. Only touch
// periodEnd when the payload actually carries a usable renewal date;
// subscription_updated is the authoritative periodEnd source since Lemon
// Squeezy also fires it on renewal.
// ---------------------------------------------------------------------------
async function handleSubscriptionPaymentSuccess(event: LemonSqueezyWebhookEvent): Promise<void> {
  const filter = resolveWorkspaceFilter(event);
  if (!filter) return;

  const attrs = event.data.attributes;
  const update: Record<string, unknown> = { lsSubscriptionStatus: "active" };
  const renewsAt = stringAttr(attrs, "renews_at");
  if (renewsAt) update.lsCurrentPeriodEnd = new Date(renewsAt);

  await Workspace.updateOne(filter, { $set: update });
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature");

  const event = await verifyAndParseLemonSqueezyEvent(rawBody, signature);
  if (!event) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

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

  try {
    switch (event.meta.event_name) {
      case "subscription_created":
        await handleSubscriptionUpsert(event, true);
        break;

      case "subscription_updated":
        await handleSubscriptionUpsert(event, false);
        break;

      case "subscription_cancelled":
        await handleSubscriptionCancelled(event);
        break;

      case "subscription_expired":
      case "subscription_payment_refunded":
        await handleSubscriptionExpired(event);
        break;

      case "subscription_paused":
      case "subscription_unpaused":
      case "subscription_resumed":
      case "subscription_payment_failed":
        await handleSubscriptionStatusOnly(event);
        break;

      case "subscription_payment_success":
        await handleSubscriptionPaymentSuccess(event);
        break;

      default:
        // Acknowledge unmodelled events so Lemon Squeezy doesn't retry forever.
        break;
    }
  } catch (err) {
    // Ack 200 after signature verification even when a handler fails — never
    // 500 into a provider retry loop (a deterministic bug would otherwise get
    // retried forever). Log for follow-up instead of dead-lettering to a queue,
    // since none exists yet.
    console.error(`[lemonsqueezy-webhook] handler failed for ${event.meta.event_name}`, err);
    return NextResponse.json({ received: true, error: "handler failed" });
  }

  return NextResponse.json({ received: true });
}
