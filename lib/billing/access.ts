// A workspace may use plan="free" only before it has ever subscribed. Once a
// workspace has ever had a paid/trialing Lemon Squeezy subscription that later
// lapses (expires, gets refunded, or fails payment down to a hard downgrade),
// it can never fall back to ordinary free-tier access — it must resubscribe.
// A workspace that has never subscribed is never gated, regardless of plan.
export type WorkspaceBillingFields = {
  plan: string;
  everSubscribed: boolean;
};

export function isWorkspaceGated(ws: WorkspaceBillingFields): boolean {
  return ws.plan === "free" && ws.everSubscribed === true;
}
