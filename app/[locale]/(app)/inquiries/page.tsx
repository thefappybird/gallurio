import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { requireOrg } from "@/lib/auth/requireOrg";
import {
  listInquiries,
  getInquiryStatusCounts,
} from "@/lib/db/queries/inquiries";
import { InquiriesPageClient } from "./_components/inquiries-page-client";
import type { InquiryRow } from "./_components/inquiry-table";
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination";

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
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string | undefined, endOfDay = false): Date | null {
  if (!value || !DATE_RE.test(value)) return null;
  const d = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function compactSource(source: {
  utm_source?: string | null;
  referrer?: string | null;
} | null | undefined): string | null {
  if (!source) return null;
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

  const { workspace } = await requireOrg();

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

  const rows: InquiryRow[] = items.map((q) => ({
    id: q._id.toString(),
    name: q.name,
    email: q.email,
    status: q.status,
    eventDate: q.eventDate ? new Date(q.eventDate).toISOString() : null,
    eventType: q.eventType ?? "other",
    submittedAt: new Date(q.createdAt as unknown as Date).toISOString(),
    source: compactSource(q.source),
  }));

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
      />
    </div>
  );
}
