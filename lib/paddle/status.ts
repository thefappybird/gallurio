// Zero-dependency leaf module — safe to import from the workflow step bundler.
// Defines PaddleSubscriptionStatus inline (not imported from @/lib/db/models)
// so that the @workflow/vitest builder does not externalise a project-local file
// chain at runtime. The values are identical to PADDLE_SUBSCRIPTION_STATUSES in
// Workspace.ts; keep them in sync.

export type PaddleSubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "paused"
  | "trialing";

// Maps raw Paddle status strings (including both cancel spellings) onto our
// internal enum. Returns null for any unrecognised value so the DB field is
// never poisoned with an unknown string.
export function mapPaddleSubscriptionStatus(
  raw: string | null | undefined
): PaddleSubscriptionStatus | null {
  switch (raw) {
    case "active":
      return "active";
    case "canceled":
    case "cancelled":
      return "canceled";
    case "past_due":
      return "past_due";
    case "paused":
      return "paused";
    case "trialing":
      return "trialing";
    default:
      return null;
  }
}
