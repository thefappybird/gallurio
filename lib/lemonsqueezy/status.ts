// Zero-dependency leaf module — safe to import from the workflow step bundler.
// Defines LemonSqueezySubscriptionStatus inline (not imported from @/lib/db/models)
// so that the @workflow/vitest builder does not externalise a project-local file
// chain at runtime. The values are identical to LS_SUBSCRIPTION_STATUSES in
// Workspace.ts; keep them in sync.

export type LemonSqueezySubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "paused"
  | "trialing";

// Maps raw Lemon Squeezy status strings onto our internal enum. Returns null
// for any unrecognised value so the DB field is never poisoned with an
// unknown string.
export function mapLemonSqueezySubscriptionStatus(
  raw: string | null | undefined
): LemonSqueezySubscriptionStatus | null {
  switch (raw) {
    case "on_trial":
      return "trialing";
    case "active":
      return "active";
    case "paused":
      return "paused";
    case "past_due":
      return "past_due";
    case "unpaid":
      return "past_due";
    case "cancelled":
      return "canceled";
    case "expired":
      return "canceled";
    default:
      return null;
  }
}
