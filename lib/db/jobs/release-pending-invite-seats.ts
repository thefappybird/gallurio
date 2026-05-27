import type mongoose from "mongoose";
import {
  PendingTeamAssignment,
  PENDING_INVITE_CLAIM_TIMEOUT_MS,
} from "@/lib/db/models/pendingTeamAssignment";
import { Team } from "@/lib/db/models/team";

export type ClaimAndReleaseOutcome =
  | { status: "released"; teamsRefunded: number }
  | { status: "claimed-for-accept" }
  | { status: "not-found" };

// Atomic, exactly-once refund of a single (teamId, pendingId) pair.
//
// Both the decrement and the journal entry happen in one Mongo write:
//   $inc memberCount: -1 AND $addToSet pendingReleaseAcks: pendingId
// Filter requires pendingId to NOT already be in the journal, so a retry
// after a partial crash, a stale-lease re-claim, or a concurrent winner all
// reduce to a no-op for this team. memberCount > 0 keeps the counter honest
// even if seat accounting drifts elsewhere.
//
// Returns true if this call actually decremented the seat, false otherwise.
async function refundSeatForPending(
  teamId: mongoose.Types.ObjectId,
  pendingId: mongoose.Types.ObjectId,
): Promise<boolean> {
  const result = await Team.findOneAndUpdate(
    {
      _id: teamId,
      pendingReleaseAcks: { $ne: pendingId },
      memberCount: { $gt: 0 },
    },
    {
      $inc: { memberCount: -1 },
      $addToSet: { pendingReleaseAcks: pendingId },
    },
    { new: false },
  )
    .select({ _id: 1 })
    .lean();
  return result !== null;
}

// One-shot, idempotent release of a pending invite's reserved seats.
//
// Concurrency model:
// - Owner-revoke, the hourly cron, the invite-rollback path, and a crashed
//   worker retrying after a stale lease all enter through this helper.
// - The lease (claimedFor + claimedAt) gates exclusive access for the
//   duration of one release pass. If a worker crashes mid-release, the lease
//   expires after PENDING_INVITE_CLAIM_TIMEOUT_MS and another worker can
//   re-claim and finish the work.
// - The Team-side `pendingReleaseAcks` journal makes seat refunds
//   exactly-once per (teamId, pendingId). Multiple successful claims (e.g.
//   after lease expiry) cannot double-refund.
//
// If the row was already claimed by the accept path (webhook drain), this
// helper returns `claimed-for-accept` and does NOT touch seats — the seat
// will be consumed by the TeamMembership the webhook creates, so the
// reservation must NOT also be refunded.
export async function claimAndReleasePendingInvite(
  pendingId: mongoose.Types.ObjectId,
): Promise<ClaimAndReleaseOutcome> {
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - PENDING_INVITE_CLAIM_TIMEOUT_MS);

  const claimed = await PendingTeamAssignment.findOneAndUpdate(
    {
      _id: pendingId,
      $or: [
        { claimedFor: null },
        { claimedFor: "release" }, // re-claim our own stale lease unconditionally
        { claimedFor: "accept", claimedAt: { $lte: staleCutoff } },
      ],
    },
    { $set: { claimedFor: "release", claimedAt: now } },
    { new: true },
  )
    .select({ teamIds: 1 })
    .lean();

  if (!claimed) {
    const existing = await PendingTeamAssignment.findById(pendingId)
      .select({ claimedFor: 1 })
      .lean();
    if (!existing) return { status: "not-found" };
    if (existing.claimedFor === "accept") return { status: "claimed-for-accept" };
    return { status: "not-found" };
  }

  let teamsRefunded = 0;
  for (const teamId of claimed.teamIds ?? []) {
    const refunded = await refundSeatForPending(teamId, pendingId);
    if (refunded) teamsRefunded += 1;
  }

  await PendingTeamAssignment.deleteOne({ _id: pendingId });
  return { status: "released", teamsRefunded };
}

// Used by the Clerk webhook on organizationMembership.created. Atomically
// claims the pending row for the accept path so a concurrent release can't
// refund seats that are about to become real TeamMembership rows. Returns
// the claimed teamIds + leadOnTeamIds the caller should use to write rows.
//
// If the row was already claimed for release (the owner revoked between the
// invite being sent and the user clicking accept), returns null and the
// caller should NOT create TeamMembership rows — the seats have been or are
// being refunded.
export async function claimPendingInviteForAccept(
  workspaceId: mongoose.Types.ObjectId,
  email: string,
): Promise<{
  _id: mongoose.Types.ObjectId;
  teamIds: mongoose.Types.ObjectId[];
  leadOnTeamIds: mongoose.Types.ObjectId[];
} | null> {
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - PENDING_INVITE_CLAIM_TIMEOUT_MS);

  const claimed = await PendingTeamAssignment.findOneAndUpdate(
    {
      workspaceId,
      email,
      $or: [
        { claimedFor: null },
        { claimedFor: "accept" },
        { claimedFor: "release", claimedAt: { $lte: staleCutoff } },
      ],
    },
    { $set: { claimedFor: "accept", claimedAt: now } },
    { new: true },
  )
    .select({ _id: 1, teamIds: 1, leadOnTeamIds: 1 })
    .lean();

  if (!claimed) return null;
  return {
    _id: claimed._id,
    teamIds: (claimed.teamIds ?? []) as mongoose.Types.ObjectId[],
    leadOnTeamIds: (claimed.leadOnTeamIds ?? []) as mongoose.Types.ObjectId[],
  };
}
