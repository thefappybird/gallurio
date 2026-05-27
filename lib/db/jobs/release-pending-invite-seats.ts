import type mongoose from "mongoose";
import { PendingTeamAssignment } from "@/lib/db/models/pendingTeamAssignment";
import { releaseTeamSeat } from "@/lib/auth/assertCanAddTeamMember";

export type ClaimAndReleaseOutcome =
  | { status: "released"; teamsReleased: number }
  | { status: "already-released" }
  | { status: "not-found" };

// One-shot, idempotent release of a pending invite's reserved seats.
//
// Race surface: the owner-revoke server action and the hourly cleanup cron
// can both target the same PendingTeamAssignment. Without a claim step, both
// would decrement Team.memberCount, double-refunding seats and corrupting the
// cap accounting.
//
// Atomic claim: findOneAndUpdate({ _id, releasedAt: null }, { releasedAt: now })
// returns the previous null-state doc only to the first caller; everyone else
// sees `null` (no match) and returns "already-released" without touching seats.
// After releasing seats, we delete the row so the listing UI stops showing it.
//
// IMPORTANT: callers must NEVER call releaseTeamSeat themselves on a pending
// invite's teams — go through this helper to keep the exactly-once invariant.
export async function claimAndReleasePendingInvite(
  pendingId: mongoose.Types.ObjectId,
): Promise<ClaimAndReleaseOutcome> {
  const claimed = await PendingTeamAssignment.findOneAndUpdate(
    { _id: pendingId, releasedAt: null },
    { $set: { releasedAt: new Date() } },
    { new: true },
  )
    .select({ _id: 1, teamIds: 1 })
    .lean();

  if (!claimed) {
    // Either the row was already claimed by another caller or never existed.
    // Distinguish the two for telemetry.
    const exists = await PendingTeamAssignment.exists({ _id: pendingId });
    return exists ? { status: "already-released" } : { status: "not-found" };
  }

  let teamsReleased = 0;
  for (const teamId of claimed.teamIds ?? []) {
    await releaseTeamSeat(teamId);
    teamsReleased += 1;
  }

  await PendingTeamAssignment.deleteOne({ _id: pendingId });

  return { status: "released", teamsReleased };
}
