"use server";

import { ownerContext, type ActionResult } from "@/lib/auth/ownerContext";
import { getLemonSqueezySubscription } from "@/lib/lemonsqueezy/client";

// Lemon Squeezy's Customer Portal is a pre-signed, short-lived (24h) URL that
// lets the customer fully self-manage the subscription (cancel, update
// payment method, view invoices) without any custom UI on our side. Must be
// fetched fresh per click — never persisted.
export async function getSubscriptionManageUrlAction(): Promise<
  ActionResult & { url?: string }
> {
  const ctx = await ownerContext();
  if ("error" in ctx) return ctx;

  const subscriptionId = ctx.workspace.lsSubscriptionId;
  if (!subscriptionId) return { error: "no_subscription" };

  const { data, error } = await getLemonSqueezySubscription(subscriptionId);
  const url = data?.data.attributes.urls?.customer_portal_update_subscription;
  if (error || !url) return { error: "subscription_manage_unavailable" };

  return { ok: true, url };
}
