import "server-only";
import type { Types } from "mongoose";
import { Booking, ActivityLog, type BookingDoc, type ActivityLogDoc } from "@/lib/db/models";

type WorkspaceId = Types.ObjectId;

export type BookingListFilters = {
  status?: string | null;
  q?: string | null;
  from?: Date | null;
  to?: Date | null;
  includeCancelled?: boolean;
};

export async function listBookings(
  workspaceId: WorkspaceId,
  filters: BookingListFilters = {}
): Promise<BookingDoc[]> {
  const query: Record<string, unknown> = { workspaceId };

  if (filters.status) {
    query.status = filters.status;
  } else if (!filters.includeCancelled) {
    query.status = { $ne: "cancelled" };
  }

  // Use denormalized bounds for the range filter — a booking "overlaps" the
  // requested window if its first session starts before the window end and its
  // last session ends after the window start.
  if (filters.from || filters.to) {
    const rangeFilter: Record<string, Date> = {};
    if (filters.from) rangeFilter.$gte = filters.from;
    if (filters.to) rangeFilter.$lte = filters.to;
    query.firstSessionStart = rangeFilter;
  }

  if (filters.q && filters.q.trim()) {
    const term = filters.q.trim();
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");
    query.$or = [{ title: rx }, { clientName: rx }, { "location.address": rx }];
  }

  return Booking.find(query).sort({ firstSessionStart: 1 }).lean();
}

export async function getBookingById(
  workspaceId: WorkspaceId,
  id: string | Types.ObjectId
): Promise<BookingDoc | null> {
  return Booking.findOne({ _id: id, workspaceId }).lean();
}

export async function getBookingActivity(
  workspaceId: WorkspaceId,
  id: string | Types.ObjectId,
  limit = 50
): Promise<ActivityLogDoc[]> {
  return ActivityLog.find({
    workspaceId,
    entity: "booking",
    entityId: id,
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}
