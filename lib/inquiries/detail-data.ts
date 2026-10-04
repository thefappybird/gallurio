import type mongoose from "mongoose";
import { Client } from "@/lib/db/models";
import { isClientMatch } from "@/lib/clients/nameMatch";
import { computeInquiryConflicts } from "@/lib/db/queries/inquiry-conflicts";
import type { InquiryWithDraft } from "@/lib/db/queries/inquiries";
import { isBookedInquiryStatus } from "@/lib/inquiries/status";
import type { InquiryDetailModalData } from "@/app/[locale]/(app)/inquiries/_components/inquiry-detail-modal";

export type InquiryClientMatch = {
  _id: string;
  name: string;
  email: string | null;
  phone: string | null;
  /** Carried so the resolve dialog can surface a notes conflict, not just email/phone. */
  notes: string | null;
  tags: string[];
  source: "form" | "manual" | "referral" | "import";
  bookingsCount: number;
  totalSpent: number;
  createdAt: string;
};

/**
 * Clients that plausibly describe the same person as the inquiry's typed
 * contact details, excluding whoever the inquiry already points at. Computed
 * live — no stored flag, nothing to invalidate. Caller enforces owner-only.
 */
export async function findClientMatchesForInquiry(
  workspaceId: mongoose.Types.ObjectId,
  inquiry: { name: string; email: string; phone?: string | null; clientId?: unknown }
): Promise<InquiryClientMatch[]> {
  // The reversed-name ordering isn't expressible as a Mongo query — fetch
  // active clients and filter in memory.
  const candidates = await Client.find(
    { workspaceId, isActive: true },
    { name: 1, email: 1, phone: 1, notes: 1, tags: 1, source: 1, bookingsCount: 1, totalSpent: 1, createdAt: 1 }
  )
    .limit(5000)
    .lean();

  return candidates
    .filter((c) => String(c._id) !== String(inquiry.clientId ?? ""))
    .filter((c) =>
      isClientMatch(
        { name: inquiry.name, email: inquiry.email, phone: inquiry.phone },
        { name: c.name, email: c.email, phone: c.phone }
      )
    )
    .map((c) => ({
      _id: String(c._id),
      name: c.name,
      email: c.email ?? null,
      phone: c.phone ?? null,
      notes: c.notes ?? null,
      tags: c.tags ?? [],
      source: c.source ?? "manual",
      bookingsCount: c.bookingsCount ?? 0,
      totalSpent: c.totalSpent ?? 0,
      createdAt: c.createdAt.toISOString(),
    }));
}

/** Matches are only actionable for an owner on an unlocked inquiry. */
export function canResolveClientMatches(role: string, status: string): boolean {
  return role === "owner" && !isBookedInquiryStatus(status) && status !== "archived";
}

/**
 * Shared shape for the inquiry detail modal (action refetch + deep-link SSR).
 * `knownConflict` lets a caller reuse an already-computed conflict result.
 */
export async function buildInquiryDetail(args: {
  workspace: { _id: mongoose.Types.ObjectId; currency?: string | null };
  tz: string;
  role: string;
  locale: string;
  data: InquiryWithDraft;
  knownConflict?: boolean;
}): Promise<InquiryDetailModalData> {
  const { workspace, tz, role, locale, data, knownConflict } = args;
  const { inquiry, booking } = data;
  const detailId = String(inquiry._id);

  const [hasConflict, clientMatches] = await Promise.all([
    knownConflict !== undefined
      ? knownConflict
      : isBookedInquiryStatus(inquiry.status)
        ? false
        : computeInquiryConflicts(
            workspace._id,
            [
              {
                _id: detailId,
                sessions: (inquiry.sessions ?? []).map((session) => ({
                  startDate: (session as { startDate: string }).startDate,
                  startTime: (session as { startTime: string }).startTime,
                  endTime: (session as { endTime: string }).endTime,
                })),
              },
            ],
            tz
          ).then((set) => set.has(detailId)),
    canResolveClientMatches(role, inquiry.status)
      ? findClientMatchesForInquiry(workspace._id, inquiry)
      : undefined,
  ]);

  return {
    inquiryId: detailId,
    locale,
    workspaceTz: tz,
    name: inquiry.name,
    email: inquiry.email,
    phone: inquiry.phone ?? null,
    preferredContact: inquiry.preferredContact ?? "email",
    status: inquiry.status,
    eventType: inquiry.eventType ?? "other",
    guestCount: inquiry.guestCount ?? null,
    location: inquiry.location ?? null,
    message: inquiry.message ?? "",
    sessions: inquiry.sessions ?? [],
    submittedAt: inquiry.createdAt.toISOString(),
    updatedAt: inquiry.updatedAt.toISOString(),
    bookingMissing: booking === null,
    booking: booking
      ? {
          id: String(booking._id),
          currency: booking.amount?.currency ?? workspace.currency ?? "PHP",
          total: booking.amount?.total ?? 0,
          deposit: booking.amount?.deposit ?? 0,
          notes: booking.notes ?? "",
          teamId: booking.teamId ? String(booking.teamId) : null,
        }
      : null,
    isOwner: role === "owner",
    hasConflict,
    ...(clientMatches ? { clientMatches } : {}),
  };
}
