import "server-only";
import { Workspace, type PlanTier } from "@/lib/db/models";
import { pendingGrantUpdate, type PendingPromoGrant } from "@/lib/billing/pendingPromoGrant";

// Lazy enforcement for a non-Lemon-Squeezy plan grant (beta tester, promo
// code): if planGrantExpiresAt is set and in the past, downgrade to free.
// Runs at the 3 tenant-resolution gate helpers, right after the workspace
// loads and before the onboarding/subscription checks, so the REST of that
// same call sees the downgraded state — not just a fire-and-forget DB write.
// This is the highest-frequency of the transition-to-expired sites (runs on
// every gated page/action load, not just the daily sweep), so a queued promo
// grant must be consumed here too — otherwise a request landing between the
// grant lapsing and the next daily sweep would see a false "gated" tick.
export async function expireGrantIfPast<
  T extends {
    _id: unknown;
    plan: PlanTier;
    planGrantExpiresAt?: Date | null;
    lifecycle?: { lapsedAt?: Date | null } | null;
    pendingPromoGrant?: PendingPromoGrant | null;
  },
>(workspace: T): Promise<T> {
  if (workspace.planGrantExpiresAt && workspace.planGrantExpiresAt < new Date()) {
    const grantUpdate = pendingGrantUpdate(workspace.pendingPromoGrant, new Date());
    if (grantUpdate) {
      await Workspace.updateOne({ _id: workspace._id }, { $set: grantUpdate });
      workspace.plan = grantUpdate.plan as PlanTier;
      workspace.planGrantExpiresAt = grantUpdate.planGrantExpiresAt;
      return workspace;
    }

    const set: Record<string, unknown> = { plan: "free", planGrantExpiresAt: null };
    if (!workspace.lifecycle?.lapsedAt) {
      set["lifecycle.lapsedAt"] = new Date();
    }
    await Workspace.updateOne({ _id: workspace._id }, { $set: set });
    workspace.plan = "free";
    workspace.planGrantExpiresAt = null;
  }
  return workspace;
}
