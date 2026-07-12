// A workspace may use plan="free" only before it has ever subscribed. Once a
// workspace has ever had a paid/trialing Lemon Squeezy subscription that later
// lapses (expires, gets refunded, or fails payment down to a hard downgrade),
// it can never fall back to ordinary free-tier access — it must resubscribe.
// A workspace that has never subscribed is never gated, regardless of plan.
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
