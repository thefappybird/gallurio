import "server-only";
import type { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Inquiry, Booking, type InquiryDoc, type BookingDoc } from "@/lib/db/models";
import { INQUIRY_STATUSES } from "@/lib/db/models/Inquiry";
import { getInquiryStatusFilter } from "@/lib/inquiries/status";

type WorkspaceId = Types.ObjectId;

export type InquiryListFilters = {
  status?: string | null;
  from?: Date | null;
  to?: Date | null;
};

export type InquiryListPagination = {
  page?: number;
  limit?: number;
};

export type InquiryListResult = {
  rows: InquiryDoc[];
  total: number;
};

// All inquiry reads are workspace-scoped (multi-tenant rule #2). `workspaceId`
// is always supplied by the caller from requireOrg() — never from user input.
export async function listInquiries(
  workspaceId: WorkspaceId,
  filters: InquiryListFilters = {},
  pagination?: InquiryListPagination
): Promise<InquiryListResult> {
  await connectDB();

  const query: Record<string, unknown> = { workspaceId };

  if (filters.status && (INQUIRY_STATUSES as readonly string[]).includes(filters.status)) {
    query.status = getInquiryStatusFilter(filters.status);
  }

  if (filters.from || filters.to) {
    const range: Record<string, Date> = {};
    if (filters.from) range.$gte = filters.from;
    if (filters.to) range.$lte = filters.to;
    query.createdAt = range;
  }

  const base = Inquiry.find(query).sort({ createdAt: -1 });

  if (pagination) {
    const { page = 1, limit = 25 } = pagination;
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      base.skip(skip).limit(limit).lean(),
      Inquiry.countDocuments(query),
    ]);
    return { rows, total };
  }

  const rows = await base.lean();
  return { rows, total: rows.length };
}

export type InquiryStatusCounts = {
  all: number;
  new: number;
  approved: number;
  booked: number;
  archived: number;
};

export async function getInquiryStatusCounts(
  workspaceId: WorkspaceId
): Promise<InquiryStatusCounts> {
  await connectDB();

  const rows = await Inquiry.aggregate<{ _id: string; count: number }>([
    { $match: { workspaceId } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const byStatus = new Map(rows.map((r) => [r._id, r.count]));
  const counts = {
    new: byStatus.get("new") ?? 0,
    // "contacted" is a legacy value migrated to "approved" — count both during
    // the transition window so the tab total stays accurate.
    approved: (byStatus.get("approved") ?? 0) + (byStatus.get("contacted") ?? 0),
    booked: (byStatus.get("booked") ?? 0) + (byStatus.get("converted") ?? 0),
    archived: byStatus.get("archived") ?? 0,
  };
  return {
    ...counts,
    all: counts.new + counts.approved + counts.booked + counts.archived,
  };
}

export async function getInquiryById(
  workspaceId: WorkspaceId,
  id: string | Types.ObjectId
): Promise<InquiryDoc | null> {
  await connectDB();
  return Inquiry.findOne({ _id: id, workspaceId }).lean();
}

export type InquiryWithDraft = {
  inquiry: InquiryDoc;
  booking: BookingDoc | null;
};

// Loads the inquiry plus its linked booking (the draft, or the promoted booking
// once approved). The booking is re-read workspace-scoped — the linked id is
// never trusted as a cross-tenant key.
export async function getInquiryWithDraft(
  workspaceId: WorkspaceId,
  id: string | Types.ObjectId
): Promise<InquiryWithDraft | null> {
  await connectDB();

  const inquiry = await Inquiry.findOne({ _id: id, workspaceId }).lean();
  if (!inquiry) return null;

  const bookingId = inquiry.draftBookingId ?? inquiry.convertedBookingId;
  const booking = bookingId
    ? await Booking.findOne({ _id: bookingId, workspaceId }).lean()
    : null;

  return { inquiry, booking };
}
