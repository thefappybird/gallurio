import { connectDB } from "@/lib/db/mongoose";
import { PendingTeamAssignment, Team } from "@/lib/db/models";
import { PENDING_INVITE_TTL_SECONDS } from "@/lib/db/models/pendingTeamAssignment";
import { releaseTeamSeat } from "@/lib/auth/assertCanAddTeamMember";

export type ReleaseExpiredInviteSeatsReport = {
  scanned: number;
  released: number;
  pendingRowsDeleted: number;
};

// Backstop for the TTL index: Mongo TTLs are best-effort and removing a doc
// does not run our seat-release logic. This job scans for any pending invite
// older than the TTL (or already TTL'd if Mongo lags) and refunds the
// reservations atomically. Safe to run hourly.
export async function releaseExpiredInviteSeats(
  now: Date = new Date(),
): Promise<ReleaseExpiredInviteSeatsReport> {
  await connectDB();

  const cutoff = new Date(now.getTime() - PENDING_INVITE_TTL_SECONDS * 1000);

  const expired = await PendingTeamAssignment.find({
    createdAt: { $lte: cutoff },
  })
    .select({ _id: 1, teamIds: 1, workspaceId: 1 })
    .lean();

  let released = 0;
  let pendingRowsDeleted = 0;

  for (const pending of expired) {
    for (const teamId of pending.teamIds ?? []) {
      const team = await Team.exists({ _id: teamId });
      if (!team) continue;
      await releaseTeamSeat(teamId);
      released += 1;
    }
    const result = await PendingTeamAssignment.deleteOne({ _id: pending._id });
    if (result.deletedCount > 0) pendingRowsDeleted += 1;
  }

  return {
    scanned: expired.length,
    released,
    pendingRowsDeleted,
  };
}
