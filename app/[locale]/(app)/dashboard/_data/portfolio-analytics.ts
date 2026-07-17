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

export type VisitorInquiryPoint = { date: string; visitors: number; inquiries: number };

function localDayKey(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export async function getVisitorInquirySeries(
  workspaceId: WorkspaceId,
  range: DateRange,
  timezone: string
): Promise<VisitorInquiryPoint[]> {
  const rows = await PageviewRollup.find(siteMatch(workspaceId, range))
    .select({ date: 1, visitors: 1, inquiries: 1 })
    .lean<{ date: Date; visitors: number; inquiries: number }[]>();

  const byDate = new Map(
    rows.map((r) => [localDayKey(r.date, timezone), { visitors: r.visitors ?? 0, inquiries: r.inquiries ?? 0 }])
  );

  let startKey: string;
  let endKey: string;
  if (range.from && range.to) {
    startKey = localDayKey(range.from, timezone);
    endKey = localDayKey(range.to, timezone);
  } else {
    const keys = [...byDate.keys()].sort();
    if (!keys.length) return [];
    startKey = keys[0];
    endKey = keys[keys.length - 1];
  }

  const out: VisitorInquiryPoint[] = [];
  const [sy, sm, sd] = startKey.split("-").map(Number);
  const cursor = new Date(Date.UTC(sy, sm - 1, sd));
  let key = startKey;
  while (key <= endKey) {
    const v = byDate.get(key);
    out.push({ date: key, visitors: v?.visitors ?? 0, inquiries: v?.inquiries ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    key = cursor.toISOString().slice(0, 10);
  }
  return out;
}

export type InquiryPipeline = { total: number; newCount: number; booked: number; archived: number };

export async function getInquiryPipeline(
  workspaceId: WorkspaceId,
  range: DateRange
): Promise<InquiryPipeline> {
  const created = dateClause(range);
  const match: Record<string, unknown> = { workspaceId };
  if (created) match.createdAt = created;

  const [total, newCount, booked, archived] = await Promise.all([
    Inquiry.countDocuments(match),
    Inquiry.countDocuments({ ...match, status: "inquiry" }),
    Inquiry.countDocuments({
      ...match,
      status: { $in: [BOOKED_INQUIRY_STATUS, CONVERTED_INQUIRY_STATUS] },
    }),
    Inquiry.countDocuments({ ...match, status: "archived" }),
  ]);

  return { total, newCount, booked, archived };
}

export type ContactFunnel = {
  visitorDays: number;
  contactVisitorDays: number;
  inquiries: number;
  contactTracked: boolean;
};

export async function getContactFunnel(
  workspaceId: WorkspaceId,
  range: DateRange
): Promise<ContactFunnel> {
  const date = dateClause(range);
  const contactMatch: Record<string, unknown> = { workspaceId, page: "contact" };
  if (date) contactMatch.date = date;

  const [siteAgg, contactAgg] = await Promise.all([
    PageviewRollup.aggregate<{ visitors: number; inquiries: number }>([
      { $match: siteMatch(workspaceId, range) },
      { $group: { _id: null, visitors: { $sum: "$visitors" }, inquiries: { $sum: "$inquiries" } } },
    ]),
    PageviewRollup.aggregate<{ visitors: number; count: number }>([
      { $match: contactMatch },
      { $group: { _id: null, visitors: { $sum: "$visitors" }, count: { $sum: 1 } } },
    ]),
  ]);

  const site = siteAgg[0];
  const contact = contactAgg[0];
  return {
    visitorDays: site?.visitors ?? 0,
    contactVisitorDays: contact?.visitors ?? 0,
    inquiries: site?.inquiries ?? 0,
    contactTracked: (contact?.count ?? 0) > 0,
  };
}

export type DemandProfile = {
  eventTypeMix: { eventType: string; count: number }[];
  requestedMonths: { month: string; count: number }[];
  medianLeadTimeDays: number | null;
};

export async function getDemandProfile(
  workspaceId: WorkspaceId,
  range: DateRange,
  timezone: string
): Promise<DemandProfile> {
  const created = dateClause(range);
  const match: Record<string, unknown> = { workspaceId };
  if (created) match.createdAt = created;

  const [eventTypeRows, monthRows, leadRows] = await Promise.all([
    Inquiry.aggregate<{ _id: string; count: number }>([
      { $match: match },
      { $group: { _id: "$eventType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Inquiry.aggregate<{ _id: string; count: number }>([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$eventDate", timezone } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Inquiry.find(match)
      .select({ eventDate: 1, createdAt: 1 })
      .lean<{ eventDate: Date; createdAt: Date }[]>(),
  ]);

  // ponytail: median in JS, fine at CRM inquiry volume
  const leadTimes = leadRows
    .map((r) => Math.round((r.eventDate.getTime() - r.createdAt.getTime()) / 86_400_000))
    .sort((a, b) => a - b);
  let medianLeadTimeDays: number | null = null;
  if (leadTimes.length) {
    const mid = Math.floor(leadTimes.length / 2);
    medianLeadTimeDays =
      leadTimes.length % 2 === 0 ? (leadTimes[mid - 1] + leadTimes[mid]) / 2 : leadTimes[mid];
  }

  return {
    eventTypeMix: eventTypeRows.map((r) => ({ eventType: r._id, count: r.count })),
    requestedMonths: monthRows.map((r) => ({ month: r._id, count: r.count })),
    medianLeadTimeDays,
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
