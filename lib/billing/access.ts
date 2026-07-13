// Entitlement model: a workspace is entitled when it has an active/near-active
// Lemon Squeezy subscription (active/trialing/past_due/paused, or canceled but
// still inside its paid period), an unexpired plan grant (planGrantExpiresAt in
// the future), or perpetual beta access (plan="beta" with no grant expiry).
// Anything else — including a never-subscribed workspace whose free-month
// grant has expired — is gated (isWorkspaceGated === !isEntitled). Gating no
// longer depends on ever having subscribed; a lapsed grant gates exactly like
// a lapsed subscription. `everSubscribed` is retained on the Workspace doc for
// reporting/analytics only and is never read here.
export type WorkspaceBillingFields = {
  plan: string;
  everSubscribed: boolean;
  lsSubscriptionId?: string | null;
  lsSubscriptionStatus?: string | null;
  lsCurrentPeriodEnd?: Date | null;
  planGrantExpiresAt?: Date | null;
};

const ACTIVE_LS_STATUSES = ["active", "trialing", "past_due", "paused"];

export function isEntitled(ws: WorkspaceBillingFields): boolean {
  const now = new Date();
  if (ws.lsSubscriptionId) {
    if (ws.lsSubscriptionStatus && ACTIVE_LS_STATUSES.includes(ws.lsSubscriptionStatus)) {
      return true;
    }
    if (
      ws.lsSubscriptionStatus === "canceled" &&
      ws.lsCurrentPeriodEnd &&
      ws.lsCurrentPeriodEnd > now
    ) {
      return true;
    }
  }

  if (ws.planGrantExpiresAt && ws.planGrantExpiresAt > now) return true;

  if (ws.plan === "beta" && ws.planGrantExpiresAt == null) return true;

  return false;
}

export function isWorkspaceGated(ws: WorkspaceBillingFields): boolean {
  return !isEntitled(ws);
}
