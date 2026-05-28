import { connectDB } from "@/lib/db/mongoose";
import {
  PendingTeamAssignment,
  PENDING_INVITE_TTL_SECONDS,
  PENDING_INVITE_CLAIM_TIMEOUT_MS,
} from "@/lib/db/models/pendingTeamAssignment";
import { claimAndReleasePendingInvite } from "./release-pending-invite-seats";

export type ReleaseExpiredInviteSeatsReport = {
  scanned: number;
  released: number;
  skipped: number;
};

// Hourly cron entry point. Mongo TTLs cannot run our seat-release logic, so
// this job owns the entire lifecycle for expired pending invites: it scans
// for rows older than the configured window and routes each through the
// shared idempotent claim helper. The helper handles concurrent revoke
// callers, stuck releases, and accept-vs-release races.
export async function releaseExpiredInviteSeats(
  now: Date = new Date(),
): Promise<ReleaseExpiredInviteSeatsReport> {
  await connectDB();

  const ttlCutoff = new Date(now.getTime() - PENDING_INVITE_TTL_SECONDS * 1000);
  const staleLeaseCutoff = new Date(
    now.getTime() - PENDING_INVITE_CLAIM_TIMEOUT_MS,
  );

  // Include rows whose lease is stale so a crashed prior release can be
  // retried. A row claimed for accept that's still within its lease is left
  // alone — the webhook is responsible for it.
  const expired = await PendingTeamAssignment.find({
    createdAt: { $lte: ttlCutoff },
    $or: [
      { claimedFor: null },
      { claimedAt: { $lte: staleLeaseCutoff } },
    ],
  })
    .select({ _id: 1 })
    .lean();

  let released = 0;
  let skipped = 0;

  for (const pending of expired) {
    const outcome = await claimAndReleasePendingInvite(pending._id);
    if (outcome.status === "released") released += 1;
    else skipped += 1;
  }

  return {
    scanned: expired.length,
    released,
    skipped,
  };
}
