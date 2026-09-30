import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { redirect } from "@/lib/i18n/navigation";
import { requireOrg } from "@/lib/auth/requireOrg";
import {
  listInquiries,
  getInquiryStatusCounts,
  getInquiryWithDraft,
} from "@/lib/db/queries/inquiries";
import { parseCalendarDate } from "../bookings/_data/calendar-events";
import { calendarWindow } from "@/lib/bookings/calendar-window";
import { loadInquiriesCalendarData } from "./_data/calendar-data";
import { resolveBookingTeamScope } from "@/lib/auth/bookingTeamScope";
import { getBookingTeamOptions } from "../bookings/_data/team-options";
import { InquiriesPageClient } from "./_components/inquiries-page-client";
import { BookingDetailModal } from "../bookings/_components/booking-detail-modal";
import type { InquiryRow } from "./_components/inquiry-table";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import type { InquiryDetailModalData } from "./_components/inquiry-detail-modal";
import { isValidObjectId } from "mongoose";
import type { CalendarEvent } from "../bookings/_components/booking-calendar";
import type { InquiryDoc } from "@/lib/db/models";
import { computeInquiryConflicts } from "@/lib/db/queries/inquiry-conflicts";
import { isBookedInquiryStatus } from "@/lib/inquiries/status";
import { FALLBACK_TZ } from "@/lib/utils/timezone";
import { CalendarSkeleton } from "@/components/app/calendar-skeleton";
import { TableSkeleton } from "@/components/app/table-skeleton";
import { INQUIRIES_SKELETON } from "@/lib/tables/skeleton-metrics";
import { InquiriesHeaderSkeleton } from "./_components/inquiries-page-skeleton";
import { INQUIRIES_VIEW_COOKIE_NAME } from "@/lib/view-preferences";
import { resolveStoredCollectionView } from "@/lib/view-preferences.server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app.inquiries");
  return { title: t("title") };
}

type SearchParams = {
  status?: string;
  from?: string;
  to?: string;
  page?: string;
  limit?: string;
  inquiryId?: string;
  view?: string;
  detail?: string;
  date?: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string | undefined, endOfDay = false): Date | null {
  if (!value || !DATE_RE.test(value)) return null;
  const d = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function compactSource(source: {
  kind?: string | null;
  utm_source?: string | null;
  referrer?: string | null;
} | null | undefined): string | null {
  if (!source) return "portfolio";
  if (source.kind) return source.kind;
  if (source.utm_source) return source.utm_source;
  if (source.referrer) {
    try {
      return new URL(source.referrer).hostname.replace(/^www\./, "");
    } catch {
      return source.referrer.slice(0, 40);
    }
  }
  return null;
}

// InquiryTable columns match INQUIRY_TABLE_COLUMNS in inquiries-page-client.tsx
const INQUIRY_TABLE_COLUMNS = 6;

export default async function InquiriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const view = await resolveStoredCollectionView(
    sp.view,
    INQUIRIES_VIEW_COOKIE_NAME
  );

  // Data-dependent content streams behind a per-view boundary so a table <->
  // calendar switch shows the matching skeleton immediately.
  return (
    <Suspense
      key={view}
      fallback={
        <div className="flex min-w-0 flex-col gap-4" aria-busy="true">
          <InquiriesHeaderSkeleton />
          {view === "calendar" ? (
            <CalendarSkeleton />
          ) : (
            <TableSkeleton columns={INQUIRY_TABLE_COLUMNS} rows={DEFAULT_PAGE_SIZE} cardRows={4} {...INQUIRIES_SKELETON} />
          )}
        </div>
      }
    >
      <InquiriesContent locale={locale} sp={sp} view={view} />
    </Suspense>
  );
}

async function InquiriesContent({
  locale,
  sp,
  view,
}: {
  locale: string;
  sp: SearchParams;
  view: Awaited<ReturnType<typeof resolveStoredCollectionView>>;
}) {
  const t = await getTranslations("app.inquiries");

  const { workspace, role, userId } = await requireOrg();

  const parsedPage = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const parsedLimit = Number.parseInt(sp.limit ?? String(DEFAULT_PAGE_SIZE), 10);
  const limit = PAGE_SIZE_OPTIONS.includes(parsedLimit) ? parsedLimit : DEFAULT_PAGE_SIZE;

  const from = parseDate(sp.from);
  const to = parseDate(sp.to, true);
  const hasFilters = Boolean((sp.status && sp.status !== "all") || from || to);

  // Team scope is only needed for the calendar booking fetch.
  const allowedTeamIds = view === "calendar"
    ? await resolveBookingTeamScope({ role, userId, workspace })
    : undefined;

  // Calendar view renders only candles: skip the paged list and status counts.
  const isCalendar = view === "calendar";
  const [{ rows: items, total }, counts] = isCalendar
    ? [{ rows: [] as InquiryDoc[], total: 0 }, { all: 0, inquiry: 0, booked: 0, archived: 0 }]
    : await Promise.all([
        listInquiries(workspace._id, { status: sp.status ?? null, from, to }, { page, limit }),
        getInquiryStatusCounts(workspace._id),
      ]);

  // Compute conflicts for non-booked inquiries in the current page
  // (hoisted before calendar so candles carry hasConflict).
  const tz = (workspace as { timezone?: string | null }).timezone ?? FALLBACK_TZ;
  const conflictInputs = items
    .filter((inq) => !isBookedInquiryStatus(inq.status))
    .map((inq) => ({
      _id: inq._id.toString(),
      sessions: (inq.sessions ?? []).map((s) => ({
        startDate: (s as { startDate: string }).startDate,
        startTime: (s as { startTime: string }).startTime,
        endTime: (s as { endTime: string }).endTime,
      })),
    }));
  const conflictSet = await computeInquiryConflicts(workspace._id, conflictInputs, tz);

  // Calendar data: windowed inquiries + bookings (1 query each).
  const calendarDate = parseCalendarDate(sp.date);
  const eventsWindow = calendarWindow(calendarDate, tz);
  let events: CalendarEvent[] = [];
  let calendarTeams: Awaited<ReturnType<typeof getBookingTeamOptions>> = [];
  if (isCalendar) {
    [events, calendarTeams] = await Promise.all([
      loadInquiriesCalendarData({
        workspaceId: workspace._id,
        tz,
        date: calendarDate,
        allowedTeamIds,
      }),
      getBookingTeamOptions({ role, userId, workspace }),
    ]);
  }

  // Stale/over-range page (e.g. after archiving the last row on a page): send the
  // owner to the last valid page instead of an empty table that looks like a dead end.
  if (total > 0 && page > 1) {
    const totalPages = Math.ceil(total / limit);
    if (page > totalPages) {
      const next = new URLSearchParams();
      if (sp.status) next.set("status", sp.status);
      if (sp.from) next.set("from", sp.from);
      if (sp.to) next.set("to", sp.to);
      if (sp.limit) next.set("limit", sp.limit);
      next.set("page", String(totalPages));
      redirect({
        href: { pathname: "/inquiries", query: Object.fromEntries(next.entries()) },
        locale,
      });
    }
  }

  const rows: InquiryRow[] = items.map((q) => ({
    id: q._id.toString(),
    name: q.name,
    email: q.email,
    status: q.status,
    eventTitle: q.eventTitle ?? null,
    eventDate: q.eventDate ? new Date(q.eventDate).toISOString() : null,
    eventType: q.eventType ?? "other",
    submittedAt: q.createdAt.toISOString(),
    source: compactSource(q.source),
    hasConflict: conflictSet.has(q._id.toString()),
  }));

  // ?detail=<bookingId> — read-only booking detail modal (calendar view).
  // A malformed id is stripped here (no DB query): the modal handles 404 itself
  // via GET /api/bookings/[id] but treats 400 as a load error.
  if (sp.detail && !isValidObjectId(sp.detail)) {
    const clean = new URLSearchParams(
      Object.entries(sp).filter(([k, v]) => k !== "detail" && v !== undefined) as [string, string][]
    );
    redirect({
      href: { pathname: "/inquiries", query: Object.fromEntries(clean.entries()) },
      locale,
    });
  }

  // Track whether the detail inquiry's conflict was already covered by the page-level query.
  const detailInPageConflicts = sp.inquiryId
    ? conflictInputs.some((ci) => ci._id === sp.inquiryId)
    : false;

  let initialDetail: InquiryDetailModalData | null = null;
  if (sp.inquiryId) {
    const cleanParams = new URLSearchParams(
      Object.entries(sp).filter(([key, value]) => key !== "inquiryId" && value !== undefined) as [
        string,
        string,
      ][]
    );

    if (!isValidObjectId(sp.inquiryId)) {
      redirect({
        href: { pathname: "/inquiries", query: Object.fromEntries(cleanParams.entries()) },
        locale,
      });
    }

    const detailResult = await getInquiryWithDraft(workspace._id, sp.inquiryId);
    if (!detailResult) {
      redirect({
        href: { pathname: "/inquiries", query: Object.fromEntries(cleanParams.entries()) },
        locale,
      });
    }
    const detail = detailResult!;

    initialDetail = {
      inquiryId: String(detail.inquiry._id),
      locale,
      name: detail.inquiry.name,
      email: detail.inquiry.email,
      phone: detail.inquiry.phone ?? null,
      preferredContact: detail.inquiry.preferredContact ?? "email",
      status: detail.inquiry.status,
      eventType: detail.inquiry.eventType ?? "other",
      guestCount: detail.inquiry.guestCount ?? null,
      location: detail.inquiry.location ?? null,
      message: detail.inquiry.message ?? "",
      sessions: detail.inquiry.sessions ?? [],
      submittedAt: detail.inquiry.createdAt.toISOString(),
      updatedAt: detail.inquiry.updatedAt.toISOString(),
      bookingMissing: detail.booking === null,
      booking: detail.booking
        ? {
            id: String(detail.booking._id),
            currency: detail.booking.amount?.currency ?? workspace.currency ?? "PHP",
            total: detail.booking.amount?.total ?? 0,
            deposit: detail.booking.amount?.deposit ?? 0,
            notes: detail.booking.notes ?? "",
          }
        : null,
      isOwner: role === "owner",
      hasConflict: await (async () => {
        const detailId = String(detail.inquiry._id);
        // If this inquiry was already included in the page-level conflict query, use that result.
        if (detailInPageConflicts) return conflictSet.has(detailId);
        // If it's booked/converted, conflicts are irrelevant.
        if (isBookedInquiryStatus(detail.inquiry.status)) return false;
        // Compute conflict for this single inquiry separately.
        const detailConflictSet = await computeInquiryConflicts(
          workspace._id,
          [
            {
              _id: detailId,
              sessions: (detail.inquiry.sessions ?? []).map((s) => ({
                startDate: (s as { startDate: string }).startDate,
                startTime: (s as { startTime: string }).startTime,
                endTime: (s as { endTime: string }).endTime,
              })),
            },
          ],
          tz
        );
        return detailConflictSet.has(detailId);
      })(),
    };
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <InquiriesPageClient
        rows={rows}
        total={total}
        page={page}
        limit={limit}
        locale={locale}
        status={sp.status ?? "all"}
        counts={counts}
        from={DATE_RE.test(sp.from ?? "") ? sp.from! : ""}
        to={DATE_RE.test(sp.to ?? "") ? sp.to! : ""}
        empty={hasFilters ? t("table.filteredEmpty") : t("table.empty")}
        emptyHint={hasFilters ? "" : t("table.emptyHint")}
        initialDetail={initialDetail}
        view={view}
        events={events}
        teams={calendarTeams}
        isOwner={role === "owner"}
        workspaceTz={tz}
        calendarWindow={{ start: eventsWindow.start.toISOString(), end: eventsWindow.end.toISOString() }}
        calendarDate={calendarDate}
      />
      {sp.detail ? (
        <BookingDetailModal
          bookingId={sp.detail}
          locale={locale}
          readOnly={true}
        />
      ) : null}
    </div>
  );
}
