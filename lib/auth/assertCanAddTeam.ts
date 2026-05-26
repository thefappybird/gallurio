import type mongoose from "mongoose";
import { Team } from "@/lib/db/models/team";
import { planEntitlements } from "@/lib/plans/entitlements";
import type { PlanTier } from "@/lib/db/models";

export class TeamCapExceededError extends Error {
  constructor(
    public readonly plan: PlanTier,
    public readonly currentCount: number,
    public readonly max: number,
  ) {
    super(`Team cap exceeded for plan "${plan}": ${currentCount}/${max}`);
    this.name = "TeamCapExceededError";
  }
}

export async function assertCanAddTeam(
  workspaceId: mongoose.Types.ObjectId,
  plan: PlanTier,
): Promise<void> {
  const { maxTeams } = planEntitlements(plan);
  const currentCount = await Team.countDocuments({ workspaceId });
  if (currentCount >= maxTeams) {
    throw new TeamCapExceededError(plan, currentCount, maxTeams);
  }
}
