import "server-only";

// grantMonths/queuedAt are `| undefined` too because Mongoose's inferred
// lean() type marks nested-optional subdocument fields as optional, not just
// nullable — matches the shape callers actually pass from a .lean() read.
export type PendingPromoGrant = {
  grantMonths?: number | null;
  queuedAt?: Date | null;
};

// Returns the $set fragment that applies a queued promo grant, or null if
// none is queued. Used everywhere a workspace transitions toward
// expired/free, so a queued grant is consumed atomically in the SAME update
// instead of the workspace briefly (or permanently) reading as gated.
export function pendingGrantUpdate(
  pending: PendingPromoGrant | null | undefined,
  now: Date
): Record<string, unknown> | null {
  if (!pending?.queuedAt || !pending.grantMonths) return null;
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + pending.grantMonths);
  return {
    plan: "pro",
    planGrantExpiresAt: expiresAt,
    lsSubscriptionStatus: null,
    lsSubscriptionId: null,
    lsCustomerId: null,
    lsCurrentPeriodEnd: null,
    "pendingPromoGrant.grantMonths": null,
    "pendingPromoGrant.queuedAt": null,
  };
}
