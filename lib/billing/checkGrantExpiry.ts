import "server-only";
import { Workspace, type PlanTier } from "@/lib/db/models";

// Lazy enforcement for a non-Lemon-Squeezy plan grant (beta tester, promo
// code): if planGrantExpiresAt is set and in the past, downgrade to free.
// Runs at the 3 tenant-resolution gate helpers, right after the workspace
// loads and before the onboarding/subscription checks, so the REST of that
// same call sees the downgraded state — not just a fire-and-forget DB write.
export async function expireGrantIfPast<
  T extends {
    _id: unknown;
    plan: PlanTier;
    planGrantExpiresAt?: Date | null;
    lifecycle?: { lapsedAt?: Date | null } | null;
  },
>(workspace: T): Promise<T> {
  if (workspace.planGrantExpiresAt && workspace.planGrantExpiresAt < new Date()) {
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
