import "server-only";
import { Workspace } from "@/lib/db/models";
import { mapLemonSqueezySubscriptionStatus } from "@/lib/lemonsqueezy/status";
import { lifecycleResetFields, addDays } from "@/lib/billing/lifecycle";
import { pendingGrantUpdate } from "@/lib/billing/pendingPromoGrant";
import { applyOrderedWorkspaceUpdate } from "@/lib/billing/webhookOrdering";
import { applySubscriptionSnapshot } from "@/lib/billing/subscriptionSnapshot";
import type { HandledLemonSqueezyEvent, LemonSqueezyWebhookEvent } from "@/lib/lemonsqueezy/webhook";

// Days of free-plan grace after a paid subscription's access ends (expiry or
// refund) — a deliberate generous buffer on top of Lemon Squeezy already
// having flagged the payment failure, applied even to a workspace that
// already used a free grant before.
const POST_EXPIRY_FREE_GRANT_DAYS = 15;

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
// subscription_created / subscription_updated / subscription_plan_changed —
// the catch-all subscription snapshot. subscription_updated fires on ANY
// attribute change, so its status must converge cancellation/expiry/pause/
// dunning/activation/plan changes even if the granular companion event is
// delayed — applySubscriptionSnapshot already encodes that policy.
// ---------------------------------------------------------------------------
async function handleSubscriptionUpsert(
  event: LemonSqueezyWebhookEvent,
  eventTimestamp: Date | null
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

  await applySubscriptionSnapshot({
    filter,
    subscriptionId,
    customerId: stringAttr(attrs, "customer_id"),
    rawStatus: stringAttr(attrs, "status"),
    variantId: stringAttr(attrs, "variant_id"),
    renewsAt: stringAttr(attrs, "renews_at"),
    eventTimestamp,
  });
}

// ---------------------------------------------------------------------------
// subscription_cancelled — cancel is NOT immediate. Access continues until
// `ends_at`; only mark status, never downgrade plan here.
// ---------------------------------------------------------------------------
async function handleSubscriptionCancelled(
  event: LemonSqueezyWebhookEvent,
  eventTimestamp: Date | null
): Promise<void> {
  const filter = resolveWorkspaceFilter(event);
  if (!filter) return;

  const attrs = event.data.attributes;
  const set: Record<string, unknown> = { lsSubscriptionStatus: "canceled" };
  const endsAt = stringAttr(attrs, "ends_at");
  if (endsAt) set.lsCurrentPeriodEnd = new Date(endsAt);

  await applyOrderedWorkspaceUpdate(filter, set, eventTimestamp);
}

// ---------------------------------------------------------------------------
// subscription_expired / subscription_payment_refunded — hard access-ended
// boundaries: always downgrade, bypassing the team-cap guard. Over-cap teams
// are surfaced in the UI; leaving an expired-or-refunded account on paid
// entitlements is a billing leak and is never acceptable. A refund (full or
// partial) means the customer got money back, so they lose paid access
// immediately rather than waiting for a separate cancellation.
//
// A queued promo grant is consumed here (not a downgrade) so a paying-
// through-their-promo user never reads as gated even for one tick. Otherwise
// the workspace lands on plan:"free" with a 15-day grace grant — a
// deliberate generous buffer, applied even if the workspace already used a
// free grant before. lifecycle.lapsedAt is NOT stamped here anymore; the
// lazy grant-expiry path (lib/billing/checkGrantExpiry.ts) stamps it once
// that 15-day buffer actually lapses.
// everSubscribed is never reset here — a workspace that has ever paid stays
// locked out of ordinary free-tier access after the buffer lapses (see
// lib/billing/access.ts).
// ---------------------------------------------------------------------------
async function handleSubscriptionExpired(
  event: LemonSqueezyWebhookEvent,
  eventTimestamp: Date | null
): Promise<void> {
  const filter = resolveWorkspaceFilter(event);
  if (!filter) return;

  // Read _id + pendingPromoGrant first (rather than mutating via `filter`
  // directly) because this update clears lsSubscriptionId — a second update
  // keyed on the original filter (which may itself be { lsSubscriptionId })
  // would no longer match once that field is nulled.
  const ws = await Workspace.findOne(filter).select({ _id: 1, pendingPromoGrant: 1 }).lean();
  if (!ws) return;

  const now = new Date();
  const grantUpdate = pendingGrantUpdate(ws.pendingPromoGrant, now);
  if (grantUpdate) {
    await applyOrderedWorkspaceUpdate({ _id: ws._id }, grantUpdate, eventTimestamp);
    return;
  }

  const set: Record<string, unknown> = {
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
    planGrantExpiresAt: addDays(now, POST_EXPIRY_FREE_GRANT_DAYS),
  };

  await applyOrderedWorkspaceUpdate({ _id: ws._id }, set, eventTimestamp);
}

// ---------------------------------------------------------------------------
// subscription_paused / subscription_unpaused / subscription_resumed /
// subscription_payment_failed — status-only update.
// ---------------------------------------------------------------------------
async function handleSubscriptionStatusOnly(
  event: LemonSqueezyWebhookEvent,
  eventTimestamp: Date | null,
  resetLifecycle: boolean
): Promise<void> {
  const status = mapLemonSqueezySubscriptionStatus(stringAttr(event.data.attributes, "status"));
  if (!status) return;

  const filter = resolveWorkspaceFilter(event);
  if (!filter) return;

  const set: Record<string, unknown> = { lsSubscriptionStatus: status };
  // resumed/unpaused mean entitled again - clear the lapse-lifecycle timestamps
  // (paused/payment_failed stay entitled the whole time, so lifecycle is
  // untouched for those).
  if (resetLifecycle) Object.assign(set, lifecycleResetFields());

  await applyOrderedWorkspaceUpdate(filter, set, eventTimestamp);
}

// ---------------------------------------------------------------------------
// subscription_payment_success / subscription_payment_recovered — best-effort
// bump to active (a recovered dunning payment means the subscription is
// caught up again, same handling as a plain success). Only touch periodEnd
// when the payload actually carries a usable renewal date; subscription_updated
// is the authoritative periodEnd source since Lemon Squeezy also fires it on
// renewal.
// ---------------------------------------------------------------------------
async function handleSubscriptionPaymentSuccess(
  event: LemonSqueezyWebhookEvent,
  eventTimestamp: Date | null
): Promise<void> {
  const filter = resolveWorkspaceFilter(event);
  if (!filter) return;

  const attrs = event.data.attributes;
  const set: Record<string, unknown> = {
    lsSubscriptionStatus: "active",
    ...lifecycleResetFields(),
  };
  const renewsAt = stringAttr(attrs, "renews_at");
  if (renewsAt) set.lsCurrentPeriodEnd = new Date(renewsAt);

  await applyOrderedWorkspaceUpdate(filter, set, eventTimestamp);
}

export type LemonSqueezyWebhookHandler = (
  event: LemonSqueezyWebhookEvent,
  eventTimestamp: Date | null
) => Promise<void>;

// Typed registry of every supported Lemon Squeezy subscription event — the
// route dispatches through this instead of a switch. Lemon-Squeezy-specific
// by design; do not generalize to other providers.
export const LEMONSQUEEZY_WEBHOOK_HANDLERS: Record<HandledLemonSqueezyEvent, LemonSqueezyWebhookHandler> = {
  subscription_created: (event, ts) => handleSubscriptionUpsert(event, ts),
  subscription_updated: (event, ts) => handleSubscriptionUpsert(event, ts),
  subscription_plan_changed: (event, ts) => handleSubscriptionUpsert(event, ts),
  subscription_cancelled: (event, ts) => handleSubscriptionCancelled(event, ts),
  subscription_expired: (event, ts) => handleSubscriptionExpired(event, ts),
  subscription_payment_refunded: (event, ts) => handleSubscriptionExpired(event, ts),
  subscription_paused: (event, ts) => handleSubscriptionStatusOnly(event, ts, false),
  subscription_payment_failed: (event, ts) => handleSubscriptionStatusOnly(event, ts, false),
  subscription_unpaused: (event, ts) => handleSubscriptionStatusOnly(event, ts, true),
  subscription_resumed: (event, ts) => handleSubscriptionStatusOnly(event, ts, true),
  subscription_payment_success: (event, ts) => handleSubscriptionPaymentSuccess(event, ts),
  subscription_payment_recovered: (event, ts) => handleSubscriptionPaymentSuccess(event, ts),
};
