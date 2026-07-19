import type { PlanTier } from "@/lib/db/models";

export type PlanEntitlements = {
  maxTeams: number;
  maxMembersPerTeam: number;
};

export const PLAN_ENTITLEMENTS = {
  free: { maxTeams: 10, maxMembersPerTeam: 10 },
  pro: { maxTeams: 10, maxMembersPerTeam: 10 },
  beta: { maxTeams: 10, maxMembersPerTeam: 10 },
} satisfies Record<PlanTier, PlanEntitlements>;

export function planEntitlements(plan: PlanTier): PlanEntitlements {
  return PLAN_ENTITLEMENTS[plan];
}
