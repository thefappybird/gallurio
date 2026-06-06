import "server-only";
import { Types } from "mongoose";
import { Booking, Client, Inquiry, Transaction, ActivityLog, Team } from "@/lib/db/models";
import { INACTIVE_TEAM_COLOR } from "@/lib/teams/team-colors";

type WorkspaceId = Types.ObjectId;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfMonth(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  return x;
}

function endOfMonth(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return x;
}

export type KpiSnapshot = {
  revenueThisMonth: number;
  activeBookingsThisMonth: number;
  newInquiries: number;
  outstandingBalance: number;
};

export async function getKpiSnapshot(workspaceId: WorkspaceId): Promise<KpiSnapshot> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [revenueAgg, activeBookings, newInquiries, outstandingAgg] = await Promise.all([
    Transaction.aggregate<{ _id: null; total: number }>([
      {
        $match: {
          workspaceId,
          paidAt: { $gte: monthStart, $lte: monthEnd },
          type: { $in: ["deposit", "balance", "refund"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    // "Starts this month" — firstSessionStart in range.
    Booking.countDocuments({
      workspaceId,
      firstSessionStart: { $gte: monthStart, $lte: monthEnd },
      status: "booked",
    }),
    Inquiry.countDocuments({ workspaceId, status: "new" }),
    Booking.aggregate<{ _id: null; total: number; paid: number }>([
      { $match: { workspaceId, status: "booked" } },
      {
        $lookup: {
          from: "transactions",
          let: { bookingId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$bookingId", "$$bookingId"] },
                type: { $in: ["deposit", "balance"] },
              },
            },
            { $group: { _id: null, sum: { $sum: "$amount" } } },
          ],
          as: "tx",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount.total" },
          paid: { $sum: { $ifNull: [{ $arrayElemAt: ["$tx.sum", 0] }, 0] } },
        },
      },
    ]),
  ]);

  return {
    revenueThisMonth: revenueAgg[0]?.total ?? 0,
    activeBookingsThisMonth: activeBookings,
    newInquiries,
    outstandingBalance: Math.max(
      0,
      (outstandingAgg[0]?.total ?? 0) - (outstandingAgg[0]?.paid ?? 0)
    ),
  };
}

export async function getTodaysEvents(workspaceId: WorkspaceId) {
  const now = new Date();
  // "Starts today" — firstSessionStart within today's bounds.
  return Booking.find({
    workspaceId,
    status: { $ne: "draft" },
    firstSessionStart: { $gte: startOfDay(now), $lte: endOfDay(now) },
  })
    .sort({ firstSessionStart: 1 })
    .limit(10)
    .lean();
}

export async function getUpcomingWeek(workspaceId: WorkspaceId, limit = 6) {
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return Booking.find({
    workspaceId,
    firstSessionStart: { $gt: endOfDay(now), $lte: weekEnd },
    status: { $in: ["booked", "inquiry"] },
  })
    .sort({ firstSessionStart: 1 })
    .limit(limit)
    .lean();
}

export async function getRecentInquiries(workspaceId: WorkspaceId, limit = 5) {
  return Inquiry.find({ workspaceId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

export async function getActivityFeed(workspaceId: WorkspaceId, limit = 10) {
  return ActivityLog.find({ workspaceId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

export type PipelineCounts = {
  inquiries: number;
  booked: number;
};

export async function getPipelineCounts(workspaceId: WorkspaceId): Promise<PipelineCounts> {
  const [inquiries, booked] = await Promise.all([
    Inquiry.countDocuments({ workspaceId, status: { $in: ["new", "contacted"] } }),
    Booking.countDocuments({ workspaceId, status: "booked" }),
  ]);
  return { inquiries, booked };
}

export type RevenuePoint = { date: string; amount: number };

export async function getRevenueTrend(
  workspaceId: WorkspaceId,
  days = 30
): Promise<RevenuePoint[]> {
  // Bucket by UTC day. Workspace-local-timezone bucketing is a follow-up — we
  // need to thread workspace.timezone through to $dateToString.
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);

  const rows = await Transaction.aggregate<{ _id: string; total: number }>([
    {
      $match: {
        workspaceId,
        paidAt: { $gte: start, $lte: end },
        type: { $in: ["deposit", "balance", "refund"] },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } },
        total: { $sum: "$amount" },
      },
    },
  ]);

  const byDate = new Map(rows.map((r) => [r._id, r.total]));
  const out: RevenuePoint[] = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, amount: byDate.get(key) ?? 0 });
  }
  return out;
}

export type CalendarDayCount = { date: string; count: number };

export async function getBookingsByDay(
  workspaceId: WorkspaceId,
  month: Date,
  teamIds?: readonly string[]
): Promise<CalendarDayCount[]> {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const matchStage: Record<string, unknown> = {
    workspaceId,
    firstSessionStart: { $lte: end },
    lastSessionEnd: { $gte: start },
  };
  if (teamIds !== undefined) {
    // Aggregation $match does NOT auto-cast like find() does — cast the string
    // team ids to ObjectId or the $in matches zero ObjectId-typed documents.
    matchStage.teamId = {
      $in: teamIds
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id)),
    };
  }
  // Unwind sessions so each session contributes its own days to the count.
  const rows = await Booking.aggregate<{ _id: string; count: number }>([
    {
      $match: {
        ...matchStage,
        status: { $ne: "draft" },
      },
    },
    { $unwind: "$sessions" },
    {
      $match: {
        "sessions.startAt": { $lte: end },
        "sessions.endAt": { $gte: start },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$sessions.startAt" } },
        count: { $sum: 1 },
      },
    },
  ]);
  return rows.map((r) => ({ date: r._id, count: r.count }));
}

export async function getTopClients(workspaceId: WorkspaceId, limit = 5) {
  return Client.find({ workspaceId })
    .sort({ totalSpent: -1 })
    .limit(limit)
    .lean();
}

export type EventTypeBreakdown = { eventType: string; count: number };

export async function getEventTypeBreakdown(
  workspaceId: WorkspaceId
): Promise<EventTypeBreakdown[]> {
  const rows = await Booking.aggregate<{ _id: string; count: number }>([
    { $match: { workspaceId, status: { $ne: "draft" } } },
    { $group: { _id: "$eventType", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  return rows.map((r) => ({ eventType: r._id ?? "other", count: r.count }));
}

export type TransactionsByMethod = { method: string; total: number };

export async function getTransactionsByMethod(
  workspaceId: WorkspaceId,
  days = 90
): Promise<TransactionsByMethod[]> {
  const start = new Date();
  start.setDate(start.getDate() - days);
  const rows = await Transaction.aggregate<{ _id: string; total: number }>([
    {
      $match: {
        workspaceId,
        paidAt: { $gte: start },
        type: { $in: ["deposit", "balance"] },
      },
    },
    { $group: { _id: "$method", total: { $sum: "$amount" } } },
    { $sort: { total: -1 } },
  ]);
  return rows.map((r) => ({ method: r._id ?? "other", total: r.total }));
}

export type TransactionsByTeam = {
  teamId: string;
  name: string;
  color: string;
  isActive: boolean;
  total: number;
};

export async function getTransactionsByTeam(
  workspaceId: WorkspaceId,
  days = 90
): Promise<TransactionsByTeam[]> {
  const start = new Date();
  start.setDate(start.getDate() - days);

  const rows = await Transaction.aggregate<{ _id: Types.ObjectId | null; total: number }>([
    {
      $match: {
        workspaceId,
        paidAt: { $gte: start },
        type: { $in: ["deposit", "balance"] },
      },
    },
    { $group: { _id: "$teamId", total: { $sum: "$amount" } } },
    { $sort: { total: -1 } },
  ]);

  // Drop the null-teamId bucket — only show real teams.
  const withTeam = rows.filter((r) => r._id != null) as { _id: Types.ObjectId; total: number }[];
  if (withTeam.length === 0) return [];

  const teamIds = withTeam.map((r) => r._id);
  const teams = await Team.find({ workspaceId, _id: { $in: teamIds } })
    .select({ _id: 1, name: 1, color: 1, isActive: 1 })
    .lean();

  const teamMap = new Map(teams.map((t) => [t._id.toString(), t]));

  return withTeam.flatMap((r) => {
    const team = teamMap.get(r._id.toString());
    if (!team) return [];
    return [
      {
        teamId: r._id.toString(),
        name: team.name,
        color: team.isActive ? team.color : INACTIVE_TEAM_COLOR,
        isActive: team.isActive,
        total: r.total,
      },
    ];
  });
}

export type RevenueComparison = {
  thisMonth: number;
  lastMonth: number;
  deltaPct: number;
};

export async function getRevenueComparison(
  workspaceId: WorkspaceId
): Promise<RevenueComparison> {
  const now = new Date();
  const thisStart = startOfMonth(now);
  const thisEnd = endOfMonth(now);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastStart = startOfMonth(lastMonthDate);
  const lastEnd = endOfMonth(lastMonthDate);

  const [thisAgg, lastAgg] = await Promise.all([
    Transaction.aggregate<{ total: number }>([
      {
        $match: {
          workspaceId,
          paidAt: { $gte: thisStart, $lte: thisEnd },
          type: { $in: ["deposit", "balance", "refund"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Transaction.aggregate<{ total: number }>([
      {
        $match: {
          workspaceId,
          paidAt: { $gte: lastStart, $lte: lastEnd },
          type: { $in: ["deposit", "balance", "refund"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  const thisMonth = thisAgg[0]?.total ?? 0;
  const lastMonth = lastAgg[0]?.total ?? 0;
  const deltaPct = lastMonth === 0 ? 0 : ((thisMonth - lastMonth) / lastMonth) * 100;
  return { thisMonth, lastMonth, deltaPct };
}

export type WeeklyBookingsPoint = { day: string; count: number };
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function getBookingsByWeekday(
  workspaceId: WorkspaceId
): Promise<WeeklyBookingsPoint[]> {
  const rows = await Booking.aggregate<{ _id: number; count: number }>([
    { $match: { workspaceId, status: { $ne: "draft" } } },
    {
      $group: {
        _id: { $dayOfWeek: "$firstSessionStart" }, // 1=Sun .. 7=Sat (Mongo)
        count: { $sum: 1 },
      },
    },
  ]);
  const counts = new Map(rows.map((r) => [r._id - 1, r.count]));
  return WEEKDAY_LABELS.map((day, i) => ({ day, count: counts.get(i) ?? 0 }));
}
