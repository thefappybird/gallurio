import "server-only";

// grantMonths/queuedAt are `| undefined` too because Mongoose's inferred
// lean() type marks nested-optional subdocument fields as optional, not just
// nullable — matches the shape callers actually pass from a .lean() read.
export type PendingPromoGrant = {
  grantMonths?: number | null;
  queuedAt?: Date | null;
};

// Concrete (not Record<string, unknown>) so callers that also need to mirror
// this $set into an in-memory object (e.g. checkGrantExpiry.ts mutating the
// workspace it was handed) can read `.plan`/`.planGrantExpiresAt` typed,
// instead of re-deriving "now + grantMonths months" a second time.
export type PendingGrantSet = {
  plan: "pro";
  planGrantExpiresAt: Date;
  lsSubscriptionStatus: null;
  lsSubscriptionId: null;
  lsCustomerId: null;
  lsCurrentPeriodEnd: null;
  "pendingPromoGrant.grantMonths": null;
  "pendingPromoGrant.queuedAt": null;
};

// Returns the $set fragment that applies a queued promo grant, or null if
// none is queued. Used everywhere a workspace transitions toward
// expired/free, so a queued grant is consumed atomically in the SAME update
// instead of the workspace briefly (or permanently) reading as gated.
export function pendingGrantUpdate(
  pending: PendingPromoGrant | null | undefined,
  now: Date
): PendingGrantSet | null {
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
