import mongoose from "mongoose";
import { Team, type TeamDoc } from "@/lib/db/models/team";
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

// Preflight check — fast path that rejects an obvious cap breach BEFORE we do
// any insert. Two concurrent passers can still both clear this check; the
// authoritative atomicity must come from `createTeamWithCapEnforcement` below.
export async function assertCanAddTeam(
  workspaceId: mongoose.Types.ObjectId,
  plan: PlanTier,
): Promise<void> {
  const { maxTeams } = planEntitlements(plan);
  // Only ACTIVE teams count toward the cap — a deactivated team's history is
  // preserved but never blocks creating new ones. `$ne: false` so legacy teams
  // created before the isActive field (missing field) count as active.
  const currentCount = await Team.countDocuments({ workspaceId, isActive: { $ne: false } });
  if (currentCount >= maxTeams) {
    throw new TeamCapExceededError(plan, currentCount, maxTeams);
  }
}

export type CreateTeamInputForCap = {
  workspaceId: mongoose.Types.ObjectId;
  name: string;
  color: string;
  isDefault: boolean;
  memberCount: number;
  createdByClerkUserId: string;
};

// Atomic create-with-cap-enforcement: inserts the team, then re-counts. If the
// post-insert count exceeds the cap (two concurrent creates raced past the
// preflight check), the over-cap rows are deleted deterministically by _id
// order — older (lower _id) survives, newer (higher _id) loses. This gives us
// "at least one survives" under contention without needing transactions
// (mongodb-memory-server doesn't run as a replica set by default).
// The {workspaceId, name} unique index handles the dup-name case.
export async function createTeamWithCapEnforcement(
  doc: CreateTeamInputForCap,
  plan: PlanTier,
): Promise<TeamDoc> {
  const { maxTeams } = planEntitlements(plan);

  await assertCanAddTeam(doc.workspaceId, plan);

  const created = await Team.create(doc);

  // Re-count ACTIVE teams only (the new team defaults to active). Deactivated
  // teams never consume cap, so they're excluded from the survivor set.
  // `$ne: false` so legacy teams (missing isActive) still count as active.
  const all = await Team.find({ workspaceId: doc.workspaceId, isActive: { $ne: false } })
    .sort({ _id: 1 })
    .select({ _id: 1 })
    .lean();
  if (all.length > maxTeams) {
    const survivorIds = new Set(all.slice(0, maxTeams).map((t) => String(t._id)));
    if (!survivorIds.has(String(created._id))) {
      await Team.deleteOne({ _id: created._id });
      throw new TeamCapExceededError(plan, all.length - 1, maxTeams);
    }
  }
  return created;
}
