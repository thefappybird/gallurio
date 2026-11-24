import type { FilterQuery } from "mongoose";

/**
 * Mongo mirror of `isEntitled` (lib/billing/access.ts), for queries that must
 * list only entitled workspaces. Keep in sync; the parity test enforces it.
 * `$nin: [null, ""]` excludes missing, null and empty ids, matching the
 * truthiness check on `lsSubscriptionId`.
 */
const ACTIVE_LS_STATUSES = ["active", "trialing", "past_due", "paused"];

export function entitledMatch(now: Date): FilterQuery<unknown> {
  const hasSubscription = { lsSubscriptionId: { $nin: [null, ""] } };
  return {
    $or: [
      { ...hasSubscription, lsSubscriptionStatus: { $in: ACTIVE_LS_STATUSES } },
      { ...hasSubscription, lsSubscriptionStatus: "canceled", lsCurrentPeriodEnd: { $gt: now } },
      { planGrantExpiresAt: { $gt: now } },
      { plan: "beta", planGrantExpiresAt: null },
    ],
  };
}
