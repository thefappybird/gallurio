import { connectDB } from "@/lib/db/mongoose";
import { PendingTeamAssignment } from "@/lib/db/models";
import { PENDING_INVITE_TTL_SECONDS } from "@/lib/db/models/pendingTeamAssignment";
import { claimAndReleasePendingInvite } from "./release-pending-invite-seats";

export type ReleaseExpiredInviteSeatsReport = {
  scanned: number;
  released: number;
  alreadyReleased: number;
};

// Hourly cron entry point. Mongo TTLs cannot run our seat-release logic, so
// this job owns the entire lifecycle for expired pending invites: it scans
// for rows older than the configured window and routes each through the
// shared idempotent claim helper. The atomic claim in
// claimAndReleasePendingInvite guarantees seats are only refunded once even
// if a concurrent owner-revoke races against this scan.
export async function releaseExpiredInviteSeats(
  now: Date = new Date(),
): Promise<ReleaseExpiredInviteSeatsReport> {
  await connectDB();

  const cutoff = new Date(now.getTime() - PENDING_INVITE_TTL_SECONDS * 1000);

  // Only consider rows that have not yet been claimed. A row with releasedAt
  // set is mid-deletion or stuck — leave it alone.
  const expired = await PendingTeamAssignment.find({
    createdAt: { $lte: cutoff },
    releasedAt: null,
  })
    .select({ _id: 1 })
    .lean();

  let released = 0;
  let alreadyReleased = 0;

  for (const pending of expired) {
    const outcome = await claimAndReleasePendingInvite(pending._id);
    if (outcome.status === "released") released += 1;
    else if (outcome.status === "already-released") alreadyReleased += 1;
  }

  return {
    scanned: expired.length,
    released,
    alreadyReleased,
  };
}
