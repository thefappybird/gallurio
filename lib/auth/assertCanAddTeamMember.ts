import type mongoose from "mongoose";
import { Team } from "@/lib/db/models/team";
import { planEntitlements } from "@/lib/plans/entitlements";
import type { PlanTier } from "@/lib/db/models";

export class TeamSeatCapExceededError extends Error {
  constructor(
    public readonly teamId: string,
    public readonly plan: PlanTier,
    public readonly max: number,
  ) {
    super(`Team seat cap exceeded for team ${teamId} on plan "${plan}": ${max}/${max}`);
    this.name = "TeamSeatCapExceededError";
  }
}

export class TeamNotFoundError extends Error {
  constructor(public readonly teamId: string) {
    super(`Team not found: ${teamId}`);
    this.name = "TeamNotFoundError";
  }
}

// Atomically reserves a seat on the team by incrementing `memberCount`, only
// if it is still below the per-team cap. If the update returns null, the team
// is either missing or at cap.
//
// CALLER MUST roll back the increment with `releaseTeamSeat(teamId)` if any
// downstream step (writing the TeamMembership, issuing the Clerk invite,
// upserting the pending assignment) fails. This is the contract that keeps
// `memberCount` honest under concurrent invites.
export async function assertCanAddTeamMember(
  teamId: mongoose.Types.ObjectId | string,
  plan: PlanTier,
): Promise<void> {
  const { maxMembersPerTeam } = planEntitlements(plan);

  const updated = await Team.findOneAndUpdate(
    { _id: teamId, memberCount: { $lt: maxMembersPerTeam } },
    { $inc: { memberCount: 1 } },
    { new: true },
  )
    .select({ _id: 1 })
    .lean();

  if (updated) return;

  const exists = await Team.exists({ _id: teamId });
  if (!exists) throw new TeamNotFoundError(String(teamId));
  throw new TeamSeatCapExceededError(String(teamId), plan, maxMembersPerTeam);
}

export async function releaseTeamSeat(
  teamId: mongoose.Types.ObjectId | string,
): Promise<void> {
  await Team.updateOne(
    { _id: teamId, memberCount: { $gt: 0 } },
    { $inc: { memberCount: -1 } },
  );
}
