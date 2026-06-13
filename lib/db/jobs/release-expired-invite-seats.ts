import { connectDB } from "@/lib/db/mongoose";
import { Invitation } from "@/lib/db/models/Invitation";
import { releaseTeamSeat } from "@/lib/auth/assertCanAddTeamMember";

export type ReleaseExpiredInviteSeatsReport = {
  scanned: number;
  released: number;
  skipped: number;
};

// Hourly cron entry point. Sweeps Invitation rows that are still "pending"
// but past their expiresAt, atomically flips each to "expired", and releases
// one team seat per teamId so seat counters stay accurate. Atomic
// findOneAndUpdate prevents double-release when a concurrent accept or revoke
// has already transitioned the row off "pending".
export async function releaseExpiredInviteSeats(
  now: Date = new Date(),
): Promise<ReleaseExpiredInviteSeatsReport> {
  await connectDB();

  const candidates = await Invitation.find({
    status: "pending",
    expiresAt: { $lte: now },
  })
    .select({ _id: 1, teamIds: 1, workspaceId: 1 })
    .lean();

  let released = 0;
  let skipped = 0;

  for (const inv of candidates) {
    // Atomically claim the row by flipping status off "pending". If another
    // actor (accept, revoke) already transitioned it, claimed will be null
    // and we skip without touching seats.
    const claimed = await Invitation.findOneAndUpdate(
      { _id: inv._id, status: "pending" },
      { $set: { status: "expired" } },
      { new: true },
    )
      .select({ _id: 1 })
      .lean();

    if (!claimed) {
      skipped += 1;
      continue;
    }

    // Release one seat per teamId, scoped to the invitation's workspace.
    await Promise.all(
      (inv.teamIds ?? []).map((teamId) =>
        releaseTeamSeat(teamId, inv.workspaceId),
      ),
    );
    released += 1;
  }

  return { scanned: candidates.length, released, skipped };
}
