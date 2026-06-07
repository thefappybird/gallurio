import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { redirect } from "@/lib/i18n/navigation";
import { requireOrg } from "@/lib/auth/requireOrg";
import {
  listInquiries,
  getInquiryStatusCounts,
  getInquiryWithDraft,
} from "@/lib/db/queries/inquiries";
import { InquiriesPageClient } from "./_components/inquiries-page-client";
import type { InquiryRow } from "./_components/inquiry-table";
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import type { InquiryDetailModalData } from "./_components/inquiry-detail-modal";
import { isValidObjectId } from "mongoose";

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

export default async function InquiriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app.inquiries");

  const { workspace, role } = await requireOrg();

  const sp = await searchParams;
  const parsedPage = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const parsedLimit = Number.parseInt(sp.limit ?? "25", 10);
  const limit = PAGE_SIZE_OPTIONS.includes(parsedLimit) ? parsedLimit : 25;

  const from = parseDate(sp.from);
  const to = parseDate(sp.to, true);

  const [{ rows: items, total }, counts] = await Promise.all([
    listInquiries(
      workspace._id,
      { status: sp.status ?? null, from, to },
      { page, limit }
    ),
    getInquiryStatusCounts(workspace._id),
  ]);

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
  }));

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
    };
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
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
        empty={t("table.empty")}
        emptyHint={t("table.emptyHint")}
        initialDetail={initialDetail}
      />
    </div>
  );
}
