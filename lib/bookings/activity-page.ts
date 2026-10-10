import type { Types } from "mongoose";
import { ActivityLog } from "@/lib/db/models";
import { resolveActorNames } from "@/lib/users/actor-names";

/**
 * One page of a booking's activity log plus the display names of its actors.
 * Caller must have already verified the booking is in the caller's workspace
 * (and team scope); this only reads workspace-scoped activity.
 */
export async function loadBookingActivityPage(
  workspaceId: Types.ObjectId,
  bookingId: string,
  page: number,
  pageSize: number
) {
  const filter = {
    workspaceId,
    entity: "booking" as const,
    entityId: bookingId,
  };

  const [entries, total] = await Promise.all([
    ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    ActivityLog.countDocuments(filter),
  ]);

  const actorNames = await resolveActorNames(
    workspaceId,
    entries.map((e) => e.actorUserId).filter((id): id is string => typeof id === "string")
  );

  return { entries, total, page, pageSize, actorNames };
}
