import "server-only";
import { Workspace } from "@/lib/db/models";
import { Team } from "@/lib/db/models/team";
import { planForVariantId } from "@/lib/lemonsqueezy/plans";
import { mapLemonSqueezySubscriptionStatus } from "@/lib/lemonsqueezy/status";
import { planEntitlements } from "@/lib/plans/entitlements";
import { lifecycleResetFields } from "@/lib/billing/lifecycle";
import { applyOrderedWorkspaceUpdate } from "@/lib/billing/webhookOrdering";

export type SubscriptionSnapshotInput = {
  // Workspace query to route the update to — caller-resolved (webhook
  // routing precedence, or reconciliation's { _id: workspaceId }).
  filter: Record<string, unknown>;
  subscriptionId: string;
  customerId: string | null;
  rawStatus: string | null | undefined;
  variantId: string | null;
  renewsAt: string | null | undefined;
  // Provider timestamp for the ordering guard — null applies unconditionally
  // (degraded fallback). See lib/billing/webhookOrdering.ts.
  eventTimestamp: Date | null;
};

// Single application path for a Lemon Squeezy subscription snapshot — shared
// by the webhook's created/updated/plan_changed handler and the onboarding
// done-page reconciliation safety net, so the two can never drift on the
// team-cap guard, the no-downgrade-on-variant-miss rule, or the
// terminal-status-refuses-promotion rule.
export async function applySubscriptionSnapshot(input: SubscriptionSnapshotInput): Promise<void> {
  const { filter, subscriptionId, customerId, rawStatus, variantId, renewsAt, eventTimestamp } =
    input;

  const status = mapLemonSqueezySubscriptionStatus(rawStatus);
  const periodEnd = renewsAt ? new Date(renewsAt) : undefined;

  const set: Record<string, unknown> = {
    lsSubscriptionId: subscriptionId,
    lsCustomerId: customerId,
  };
  if (status) set.lsSubscriptionStatus = status;
  if (periodEnd) set.lsCurrentPeriodEnd = periodEnd;
  // Entitled again (active/trialing) - clear every lapse-lifecycle timestamp
  // so a previously-gated workspace gets a fresh start.
  if (status === "active" || status === "trialing") {
    Object.assign(set, lifecycleResetFields());
  }

  // Resolve the new plan from the variantId. Only promote when the resolved
  // tier is paid — a variantId miss (e.g. env var unset in dev) must not
  // silently downgrade a workspace. Also refuse to promote on a terminal
  // status: subscription_updated fires on ANY attribute change, so a
  // trailing update carrying a cancelled/expired status (variant_id is still
  // populated on those) must not re-promote a workspace the dedicated
  // cancelled/expired handlers already settled.
  const newTier = variantId ? planForVariantId(variantId) : "free";
  if (newTier !== "free" && status !== "canceled") {
    const ws = await Workspace.findOne(filter).select({ _id: 1, plan: 1 }).lean();
    if (ws) {
      const entitlements = planEntitlements(newTier);
      const currentTeamCount = await Team.countDocuments({ workspaceId: ws._id });
      if (currentTeamCount > entitlements.maxTeams) {
        console.warn(
          `[subscriptionSnapshot] refused plan update for workspace ${String(ws._id)}: ` +
            `${currentTeamCount} teams > ${entitlements.maxTeams} maxTeams (${newTier})`
        );
        // Don't include plan in the update — keep existing value.
      } else {
        set.plan = newTier;
        set.everSubscribed = true;
      }
    } else {
      // Workspace not yet found by filter; safe to include plan.
      set.plan = newTier;
      set.everSubscribed = true;
    }
  }

  await applyOrderedWorkspaceUpdate(filter, set, eventTimestamp);
}
