import "server-only";
import { Types } from "mongoose";
import { PageviewRollup, Inquiry, Client } from "@/lib/db/models";
import { BOOKED_INQUIRY_STATUS, CONVERTED_INQUIRY_STATUS } from "@/lib/inquiries/status";

type WorkspaceId = Types.ObjectId;

export type DateRange = { from: Date | null; to: Date | null };

// Build a `date` match clause from an open/closed range.
function dateClause(range: DateRange): Record<string, Date> | undefined {
  const clause: Record<string, Date> = {};
  if (range.from) clause.$gte = range.from;
  if (range.to) clause.$lte = range.to;
  return Object.keys(clause).length ? clause : undefined;
}

function siteMatch(workspaceId: WorkspaceId, range: DateRange) {
  const match: Record<string, unknown> = { workspaceId, page: "_site" };
  const date = dateClause(range);
  if (date) match.date = date;
  return match;
}

export type AnalyticsTotals = {
  views: number;
  visitors: number;
  inquiries: number;
  conversionRate: number;
};

export async function getAnalyticsTotals(
  workspaceId: WorkspaceId,
  range: DateRange
): Promise<AnalyticsTotals> {
  const [row] = await PageviewRollup.aggregate<{
    views: number;
    visitors: number;
    inquiries: number;
  }>([
    { $match: siteMatch(workspaceId, range) },
    {
      $group: {
        _id: null,
        views: { $sum: "$views" },
        visitors: { $sum: "$visitors" },
        inquiries: { $sum: "$inquiries" },
      },
    },
  ]);

  const views = row?.views ?? 0;
  const visitors = row?.visitors ?? 0;
  const inquiries = row?.inquiries ?? 0;
  return {
    views,
    visitors,
    inquiries,
    conversionRate: inquiries / Math.max(visitors, 1),
  };
}

const REAL_PAGES = ["home", "gallery", "contact"] as const;

export type PageBreakdown = { page: string; views: number; visitors: number };

export async function getPerPageBreakdown(
  workspaceId: WorkspaceId,
  range: DateRange
): Promise<PageBreakdown[]> {
  const match: Record<string, unknown> = {
    workspaceId,
    page: { $in: REAL_PAGES },
  };
  const date = dateClause(range);
  if (date) match.date = date;

  const rows = await PageviewRollup.aggregate<{
    _id: string;
    views: number;
    visitors: number;
  }>([
    { $match: match },
    {
      $group: {
        _id: "$page",
        views: { $sum: "$views" },
        visitors: { $sum: "$visitors" },
      },
    },
    { $sort: { views: -1 } },
  ]);

  return rows.map((r) => ({ page: r._id, views: r.views, visitors: r.visitors }));
}

export type PageviewPoint = { date: string; views: number; visitors: number };

export async function getPageviewTimeSeries(
  workspaceId: WorkspaceId,
  range: DateRange
): Promise<PageviewPoint[]> {
  // Each _site doc is already one day, so just project + sort ascending.
  const rows = await PageviewRollup.find(siteMatch(workspaceId, range))
    .select({ date: 1, views: 1, visitors: 1 })
    .sort({ date: 1 })
    .lean<{ date: Date; views: number; visitors: number }[]>();

  return rows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    views: r.views ?? 0,
    visitors: r.visitors ?? 0,
  }));
}

export type InquiryInsights = {
  totalInquiries: number;
  bookedCount: number;
  inquiryToBookingRate: number;
  newClientsFromForm: number;
};

export async function getInquiryInsights(
  workspaceId: WorkspaceId,
  range: DateRange
): Promise<InquiryInsights> {
  const created = dateClause(range);
  const inquiryMatch: Record<string, unknown> = { workspaceId };
  if (created) inquiryMatch.createdAt = created;
  const clientMatch: Record<string, unknown> = { workspaceId, source: "form" };
  if (created) clientMatch.createdAt = created;

  const [totalInquiries, bookedCount, newClientsFromForm] = await Promise.all([
    Inquiry.countDocuments(inquiryMatch),
    Inquiry.countDocuments({
      ...inquiryMatch,
      status: { $in: [BOOKED_INQUIRY_STATUS, CONVERTED_INQUIRY_STATUS] },
    }),
    Client.countDocuments(clientMatch),
  ]);

  return {
    totalInquiries,
    bookedCount,
    inquiryToBookingRate: bookedCount / Math.max(totalInquiries, 1),
    newClientsFromForm,
  };
}

export type SourceCount = { source: string; visitors: number };

export async function getTopSources(
  workspaceId: WorkspaceId,
  range: DateRange,
  limit = 8
): Promise<SourceCount[]> {
  const rows = await PageviewRollup.aggregate<{ _id: string; visitors: number }>([
    { $match: siteMatch(workspaceId, range) },
    { $project: { kv: { $objectToArray: "$sources" } } },
    { $unwind: "$kv" },
    { $group: { _id: "$kv.k", visitors: { $sum: "$kv.v" } } },
    { $sort: { visitors: -1 } },
    { $limit: limit },
  ]);
  return rows.map((r) => ({ source: r._id, visitors: r.visitors }));
}
