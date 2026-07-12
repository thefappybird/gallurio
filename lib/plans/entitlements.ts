import type { PlanTier } from "@/lib/db/models";

export type PlanEntitlements = {
  maxTeams: number;
  maxMembersPerTeam: number;
};

export const PLAN_ENTITLEMENTS = {
  free: { maxTeams: 1, maxMembersPerTeam: 10 },
  starter: { maxTeams: 3, maxMembersPerTeam: 10 },
  pro: { maxTeams: 15, maxMembersPerTeam: 10 },
  beta: { maxTeams: 15, maxMembersPerTeam: 10 },
} satisfies Record<PlanTier, PlanEntitlements>;

export function planEntitlements(plan: PlanTier): PlanEntitlements {
  return PLAN_ENTITLEMENTS[plan];
}
