"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PageSizeSelect } from "@/components/app/page-size-select";
import { TableSkeleton } from "@/components/app/table-skeleton";
import { cn } from "@/lib/utils";
import { InquiryTable, type InquiryRow } from "./inquiry-table";
import type { InquiryStatusCounts } from "@/lib/db/queries/inquiries";
import { InquiryDetailModal, type InquiryDetailModalData } from "./inquiry-detail-modal";
import { InquiryViewToggle, type InquiriesView } from "./inquiry-view-toggle";
import { InquiriesCalendarManager } from "./inquiries-calendar-manager";
import type { CalendarEvent } from "../../bookings/_components/booking-calendar";

const INQUIRY_TABLE_COLUMNS = 6;

const TABS = ["all", "new", "approved", "booked", "archived"] as const;
type TabKey = (typeof TABS)[number];

type Props = {
  rows: InquiryRow[];
  total: number;
  page: number;
  limit: number;
  locale: string;
  status: string;
  counts: InquiryStatusCounts;
  from: string;
  to: string;
  empty: string;
  emptyHint: string;
  initialDetail: InquiryDetailModalData | null;
  view?: InquiriesView;
  events?: CalendarEvent[];
};

export function InquiriesPageClient({
  rows,
  total,
  page,
  limit,
  locale,
  status,
  counts,
  from,
  to,
  empty,
  emptyHint,
  initialDetail,
  view,
  events = [],
}: Props) {
  const t = useTranslations("app.inquiries");
  const tc = useTranslations("common.pagination");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [detail, setDetail] = useState(initialDetail);
  const [detailOpen, setDetailOpen] = useState(Boolean(initialDetail));
  const isCalendar = view === "calendar";

  const [syncedDeepLink, setSyncedDeepLink] = useState(initialDetail);
  if (initialDetail !== syncedDeepLink) {
    setSyncedDeepLink(initialDetail);
    if (initialDetail) {
      setDetail(initialDetail);
      setDetailOpen(true);
    }
  }

  const activeTab: TabKey = (TABS as readonly string[]).includes(status)
    ? (status as TabKey)
    : "all";

  function pushParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function selectTab(tab: TabKey) {
    pushParams((params) => {
      if (tab === "all") params.delete("status");
      else params.set("status", tab);
      params.delete("page");
    });
  }

  function setDate(key: "from" | "to", value: string) {
    pushParams((params) => {
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete("page");
    });
  }

  function clearDates() {
    pushParams((params) => {
      params.delete("from");
      params.delete("to");
      params.delete("page");
    });
  }

  function goToPage(p: number) {
    pushParams((params) => params.set("page", String(p)));
  }

  function stripInquiryParam() {
    if (!searchParams.has("inquiryId")) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("inquiryId");
    startTransition(() => {
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname);
    });
  }

  const totalPages = Math.ceil(total / limit);
  const fromRow = Math.min((page - 1) * limit + 1, total);
  const toRow = Math.min(page * limit, total);

  return (
    <>
      {/* View toggle — shown in both views */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <InquiryViewToggle view={isCalendar ? "calendar" : "table"} />
      </div>

      {isCalendar ? (
        <InquiriesCalendarManager events={events} locale={locale} />
      ) : (
        <>
          {/* Status tabs with counts */}
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label={t("title")}>
            {TABS.map((tab) => {
              const count = counts[tab];
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => selectTab(tab)}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-1.5 border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:min-h-9",
                    isActive
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:bg-accent/40"
                  )}
                >
                  <span>{t(`tabs.${tab}`)}</span>
                  <span
                    className={cn(
                      "tabular-nums text-xs",
                      isActive ? "text-background/70" : "text-muted-foreground/70"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Date range */}
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("toolbar.from")}
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setDate("from", e.target.value)}
                className="min-h-11 border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:min-h-9"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("toolbar.to")}
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setDate("to", e.target.value)}
                className="min-h-11 border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:min-h-9"
              />
            </label>
            {(from || to) && (
              <Button variant="ghost" size="sm" onClick={clearDates} className="min-h-11 sm:min-h-9">
                {t("toolbar.clear")}
              </Button>
            )}
          </div>

          {isPending ? (
            <TableSkeleton columns={INQUIRY_TABLE_COLUMNS} rows={Math.min(limit, 8)} />
          ) : (
            <InquiryTable rows={rows} locale={locale} empty={empty} emptyHint={emptyHint} />
          )}

          {total > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-muted-foreground">
                {tc("showing", { from: fromRow, to: toRow, total })}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <PageSizeSelect value={limit} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  className="min-h-11 sm:min-h-0"
                >
                  {tc("previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages}
                  className="min-h-11 sm:min-h-0"
                >
                  {tc("next")}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <InquiryDetailModal
        detail={detail}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          stripInquiryParam();
        }}
      />
    </>
  );
}
