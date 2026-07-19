import mongoose, { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Invitation } from "@/lib/db/models/Invitation";
import { releaseTeamSeat } from "@/lib/auth/assertCanAddTeamMember";

export type ReleaseExpiredInviteSeatsReport = {
  scanned: number;
  released: number;
  skipped: number;
  failed: number;
};

const DEFAULT_BATCH_SIZE = 200;

type Candidate = {
  _id: Types.ObjectId;
  teamIds: Types.ObjectId[];
  workspaceId: Types.ObjectId;
};

// Hourly cron entry point. Sweeps Invitation rows that are still "pending"
// but past their expiresAt, atomically flips each to "expired", and releases
// one team seat per teamId so seat counters stay accurate.
//
// Flip + seat-release are coupled in a single Mongo transaction per
// invitation: if releaseTeamSeat throws, the "expired" flip rolls back too,
// so the row stays "pending" and the next sweep retries it — no seat leak on
// partial failure. The atomic findOneAndUpdate (scoped by status:"pending"
// inside the transaction) still prevents double-release when a concurrent
// accept/revoke has already transitioned the row off "pending".
//
// Cursor-paginated by _id (cap `batchSize`, default 200) so a large global
// backlog is never loaded into memory in one unbounded query.
export async function releaseExpiredInviteSeats(
  now: Date = new Date(),
  opts: { batchSize?: number } = {},
): Promise<ReleaseExpiredInviteSeatsReport> {
  await connectDB();
  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;

  let scanned = 0;
  let released = 0;
  let skipped = 0;
  let failed = 0;
  let lastId: Types.ObjectId | null = null;

  for (;;) {
    const filter: Record<string, unknown> = {
      status: "pending",
      expiresAt: { $lte: now },
    };
    if (lastId) filter._id = { $gt: lastId };

    const candidates = await Invitation.find(filter)
      .select({ _id: 1, teamIds: 1, workspaceId: 1 })
      .sort({ _id: 1 })
      .limit(batchSize)
      .lean<Candidate[]>();

    if (candidates.length === 0) break;
    scanned += candidates.length;
    lastId = candidates[candidates.length - 1]!._id;

    for (const inv of candidates) {
      let claimed = false;
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const flipped = await Invitation.findOneAndUpdate(
            { _id: inv._id, status: "pending" },
            { $set: { status: "expired" } },
            { new: true, session },
          )
            .select({ _id: 1 })
            .lean();

          if (!flipped) {
            claimed = false;
            return;
          }
          claimed = true;

          for (const teamId of inv.teamIds ?? []) {
            await releaseTeamSeat(teamId, inv.workspaceId, session);
          }
        });
      } catch (err) {
        // Seat release failed — transaction aborted, "expired" flip rolled
        // back, row is still "pending". Log and move on; next sweep retries.
        failed += 1;
        console.error(
          "[release-expired-invite-seats] seat release failed, will retry next sweep",
          err,
        );
        await session.endSession();
        continue;
      }
      await session.endSession();

      if (claimed) released += 1;
      else skipped += 1;
    }

    if (candidates.length < batchSize) break;
  }

  // Structured, PII-free per-run summary for a heartbeat/last-success metric.
  console.info(
    JSON.stringify({
      job: "release-expired-invite-seats",
      ranAt: now.toISOString(),
      scanned,
      released,
      skipped,
      failed,
    }),
  );

  return { scanned, released, skipped, failed };
}
