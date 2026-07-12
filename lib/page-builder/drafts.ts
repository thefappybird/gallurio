import type { PlanTier } from "@/lib/db/models/Workspace";

/** Name a brand-new, unsaved draft carries until the owner renames it. */
export const DEFAULT_DRAFT_NAME = "New Draft";

/** Max length of a draft name (matches the saved-theme name ceiling). */
export const DRAFT_NAME_MAX = 60;

/** Per-plan ceiling on the number of saved drafts a workspace may keep. */
export const DRAFT_CAP_BY_PLAN: Record<PlanTier, number> = {
  free: 5,
  starter: 15,
  pro: Number.POSITIVE_INFINITY,
  beta: Number.POSITIVE_INFINITY,
};

export function draftCapForPlan(plan: PlanTier): number {
  return DRAFT_CAP_BY_PLAN[plan] ?? DRAFT_CAP_BY_PLAN.free;
}
