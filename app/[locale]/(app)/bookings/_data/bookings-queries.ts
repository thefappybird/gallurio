import "server-only";
import { Types } from "mongoose";
import { Booking, ActivityLog, type BookingDoc, type ActivityLogDoc } from "@/lib/db/models";
import { dayBoundInTz } from "@/lib/utils/timezone";

/** Returns YYYY-MM-DD for `d` as seen in `timeZone`. */
function isoDateInTz(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

type WorkspaceId = Types.ObjectId;

// Maps a list of team-id strings to ObjectIds, dropping any malformed entries
// (the team filter can originate from a URL searchParam in Phase 5).
function toTeamObjectIds(ids: readonly string[]): Types.ObjectId[] {
  return ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
}

export type BookingListFilters = {
  status?: string | null;
  q?: string | null;
  from?: Date | null;
  to?: Date | null;
  includeCancelled?: boolean;
  // Draft bookings are auto-created from public inquiries and stay hidden from
  // every owner-facing list until the inquiry is approved (Phase 6). The lead
  // inbox is the only caller that opts in.
  includeDrafts?: boolean;
  // Restricts results to bookings owned by these teams. `undefined` means no
  // team restriction (owner sees the whole workspace). An array — INCLUDING an
  // empty one — restricts via $in, so a member with no teams matches nothing
  // rather than everything. Callers resolve this from getTeamsForUser().
  teamIds?: readonly string[];
  // When false/undefined, excludes bookings whose lastSessionEnd is before
  // midnight today in `workspaceTimezone`. Applied BEFORE countDocuments/skip/limit
  // so pagination counts reflect the filtered set. Callers pass the workspace tz.
  includePast?: boolean;
  workspaceTimezone?: string;
};

export type BookingListPagination = {
  page?: number;
  limit?: number;
};

export type BookingListResult = {
  rows: BookingDoc[];
  total: number;
};

export async function listBookings(
  workspaceId: WorkspaceId,
  filters: BookingListFilters = {},
  pagination?: BookingListPagination
): Promise<BookingListResult> {
  const query: Record<string, unknown> = { workspaceId };

  // Team visibility scoping. `undefined` → no restriction; any array → $in
  // (empty array intentionally matches nothing).
  if (filters.teamIds !== undefined) {
    query.teamId = { $in: toTeamObjectIds(filters.teamIds) };
  }

  if (filters.status) {
    // Explicit status wins — lets the lead inbox ask for "draft" directly.
    query.status = filters.status;
  } else {
    const excluded: string[] = [];
    if (!filters.includeDrafts) excluded.push("draft");
    if (!filters.includeCancelled) excluded.push("cancelled");
    if (excluded.length === 1) query.status = { $ne: excluded[0] };
    else if (excluded.length > 1) query.status = { $nin: excluded };
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

  // Exclude fully-past bookings unless the caller explicitly requests them.
  // "Past" means lastSessionEnd < midnight today in the workspace timezone.
  // Filtering here (before countDocuments/skip/limit) keeps `total` and
  // page counts accurate so the server-side pagination is correct.
  if (!filters.includePast) {
    const tz = filters.workspaceTimezone ?? "UTC";
    const todayStr = isoDateInTz(new Date(), tz);
    const todayStart = dayBoundInTz(todayStr, tz, 0, 0, 0, 0);
    query.lastSessionEnd = { $gte: todayStart };
  }

  const baseQuery = Booking.find(query).sort({ firstSessionStart: 1 });

  if (pagination) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      baseQuery.skip(skip).limit(limit).lean(),
      Booking.countDocuments(query),
    ]);
    return { rows, total };
  }

  // No pagination: return all matching docs (used by calendar view and tests).
  const rows = await baseQuery.lean();
  return { rows, total: rows.length };
}

export async function getBookingById(
  workspaceId: WorkspaceId,
  id: string | Types.ObjectId,
  // When provided (non-owner callers), the booking's teamId must be in this set
  // or the lookup returns null — a member cannot fetch another team's booking by
  // id. `undefined` (owner) applies no team restriction.
  allowedTeamIds?: readonly string[]
): Promise<BookingDoc | null> {
  const query: Record<string, unknown> = { _id: id, workspaceId };
  if (allowedTeamIds !== undefined) {
    query.teamId = { $in: toTeamObjectIds(allowedTeamIds) };
  }
  query.status = { $ne: "draft" };
  return Booking.findOne(query).lean();
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
