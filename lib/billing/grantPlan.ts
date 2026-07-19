import "server-only";
import { Types, type ClientSession } from "mongoose";
import { Workspace, type PlanTier } from "@/lib/db/models";

// Provider-agnostic plan grant: sets plan + planGrantExpiresAt and CLEARS
// every Lemon Squeezy field. A grantPlan call means "this plan is not backed
// by an LS subscription" — a workspace that had a real subscription before
// (e.g. pro -> beta via the dev toggle, or a future promo redemption on a
// lapsed subscriber) must not keep stale ls* fields around: they'd make the
// billing panel show a contradictory "active subscription" badge, and worse,
// a later Lemon Squeezy webhook for that old lsSubscriptionId could still
// resolve to this workspace and silently overwrite the grant. Shared by the
// dev beta toggle and (future) promo-code redemption — keep generic, no
// dev-only or promo-specific logic here. Does NOT touch everSubscribed: that
// flag's "must resubscribe once gated" policy (lib/billing/access.ts) should
// still apply once/if this grant expires back to free.
export async function grantPlan(
  workspaceId: string | Types.ObjectId,
  opts: { plan: PlanTier; expiresAt: Date | null; session?: ClientSession }
): Promise<void> {
  await Workspace.updateOne(
    { _id: workspaceId },
    {
      $set: {
        plan: opts.plan,
        planGrantExpiresAt: opts.expiresAt,
        lsSubscriptionStatus: null,
        lsSubscriptionId: null,
        lsCustomerId: null,
        lsCurrentPeriodEnd: null,
      },
    },
    opts.session ? { session: opts.session } : undefined
  );
}
