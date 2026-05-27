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
// is either missing, at cap, or scoped to a different workspace.
//
// CALLER MUST roll back the increment with `releaseTeamSeat(teamId, workspaceId)`
// if any downstream step (writing the TeamMembership, issuing the Clerk invite,
// upserting the pending assignment) fails. This is the contract that keeps
// `memberCount` honest under concurrent invites.
//
// `workspaceId` is optional only because some legacy callers (webhook drain
// for deleted-team cleanup) don't have it handy. New callers MUST pass it —
// the repo rule is that every tenant-scoped query includes workspaceId.
export async function assertCanAddTeamMember(
  teamId: mongoose.Types.ObjectId | string,
  plan: PlanTier,
  workspaceId?: mongoose.Types.ObjectId | string,
): Promise<void> {
  const { maxMembersPerTeam } = planEntitlements(plan);

  const filter: Record<string, unknown> = {
    _id: teamId,
    memberCount: { $lt: maxMembersPerTeam },
  };
  if (workspaceId !== undefined) filter.workspaceId = workspaceId;

  const updated = await Team.findOneAndUpdate(
    filter,
    { $inc: { memberCount: 1 } },
    { new: true },
  )
    .select({ _id: 1 })
    .lean();

  if (updated) return;

  const existsFilter: Record<string, unknown> = { _id: teamId };
  if (workspaceId !== undefined) existsFilter.workspaceId = workspaceId;
  const exists = await Team.exists(existsFilter);
  if (!exists) throw new TeamNotFoundError(String(teamId));
  throw new TeamSeatCapExceededError(String(teamId), plan, maxMembersPerTeam);
}

export async function releaseTeamSeat(
  teamId: mongoose.Types.ObjectId | string,
  workspaceId?: mongoose.Types.ObjectId | string,
): Promise<void> {
  const filter: Record<string, unknown> = {
    _id: teamId,
    memberCount: { $gt: 0 },
  };
  if (workspaceId !== undefined) filter.workspaceId = workspaceId;
  await Team.updateOne(filter, { $inc: { memberCount: -1 } });
}
