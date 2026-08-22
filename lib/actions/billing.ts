"use server";

import { ownerContext, type ActionResult } from "@/lib/auth/ownerContext";
import { isPaidBillingAvailable } from "@/lib/billing/availability";
import { isEntitled } from "@/lib/billing/access";
import { Workspace } from "@/lib/db/models";
import { getLemonSqueezySubscription } from "@/lib/lemonsqueezy/client";
import { reconcileLemonSqueezySubscription } from "@/lib/actions/onboarding";

// Lemon Squeezy's Customer Portal is a pre-signed, short-lived (24h) URL that
// lets the customer fully self-manage the subscription (cancel, update
// payment method, view invoices) without any custom UI on our side. Must be
// fetched fresh per click — never persisted.
export async function getSubscriptionManageUrlAction(): Promise<
  ActionResult & { url?: string }
> {
  // Cheap, zero-I/O check first — avoids an owner session decrypt + 2 Mongo
  // round trips on every call for as long as beta-only mode is on.
  if (!isPaidBillingAvailable()) return { error: "billing_unavailable" };

  const ctx = await ownerContext();
  if ("error" in ctx) return ctx;

  const subscriptionId = ctx.workspace.lsSubscriptionId;
  if (!subscriptionId) return { error: "no_subscription" };

  const { data, error } = await getLemonSqueezySubscription(subscriptionId);
  const url = data?.data.attributes.urls?.customer_portal_update_subscription;
  if (error || !url) return { error: "subscription_manage_unavailable" };

  return { ok: true, url };
}

// Called only from the hosted-checkout return page. It permits a currently
// gated owner to reconcile their own current Lemon Squeezy subscription, then
// proves entitlement from the freshly-read workspace document before the
// browser can proceed to a protected route.
export async function verifyCheckoutReturnAction(): Promise<{ ok: boolean }> {
  if (!isPaidBillingAvailable()) return { ok: false };

  const ctx = await ownerContext({ allowDuringOnboarding: true, allowWhenGated: true });
  if ("error" in ctx) return { ok: false };

  await reconcileLemonSqueezySubscription(ctx.workspaceId);
  const workspace = await Workspace.findById(ctx.workspaceId).lean();
  return { ok: !!workspace && isEntitled(workspace) };
}
