"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PageSizeSelect } from "@/components/app/page-size-select";
import { TableSkeleton } from "@/components/app/table-skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { InquiryTable, type InquiryRow } from "./inquiry-table";
import { applyOptimisticPatch, type InquiryOptimisticPatch } from "@/lib/inquiries/optimistic-patch";
import type { InquiryStatusCounts } from "@/lib/db/queries/inquiries";
import { InquiryDetailModal, type InquiryDetailModalData } from "./inquiry-detail-modal";
import { InquiryViewToggle, type InquiriesView } from "./inquiry-view-toggle";
import { InquiriesCalendarManager } from "./inquiries-calendar-manager";
import type { CalendarEvent } from "../../bookings/_components/booking-calendar";
import type { BookingTeamOption } from "../../bookings/_data/team-options";

const INQUIRY_TABLE_COLUMNS = 6;

const TABS = ["all", "new", "booked", "archived"] as const;
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
  teams?: BookingTeamOption[];
  isOwner?: boolean;
  workspaceTz?: string;
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
  teams = [],
  isOwner = false,
  workspaceTz,
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

  // Optimistic patch map: covers all editable fields; only status is rendered in the table.
  // Reconciles automatically when server data arrives via router.refresh().
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, InquiryOptimisticPatch>>({});

  // Ref tracks whether any change was made while the modal was open so onClose
  // can skip router.refresh() when nothing changed.
  const hasChanges = useRef(false);

  const localRows = applyOptimisticPatch(rows, optimisticUpdates);

  function handleInquiryChanged(inquiryId: string, patch: InquiryOptimisticPatch) {
    setOptimisticUpdates((prev) => ({
      ...prev,
      [inquiryId]: { ...(prev[inquiryId] ?? {}), ...patch },
    }));
    hasChanges.current = true;
  }

  function handleConverted() {
    if (detail) {
      handleInquiryChanged(detail.inquiryId, { status: "booked" });
    }
    setDetailOpen(false);
  }

  function handleConvertFailed() {
    if (detail) {
      setOptimisticUpdates((prev) => {
        const next = { ...prev };
        delete next[detail.inquiryId];
        return next;
      });
    }
  }

  // Date popover
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  function handleDatePopoverOpenChange(open: boolean) {
    if (open) {
      setDraftFrom(from);
      setDraftTo(to);
    }
    setDatePopoverOpen(open);
  }

  function handleApplyDates() {
    pushParams((params) => {
      if (draftFrom) params.set("from", draftFrom); else params.delete("from");
      if (draftTo) params.set("to", draftTo); else params.delete("to");
      params.delete("page");
    });
    setDatePopoverOpen(false);
  }

  function handleClearDates() {
    setDraftFrom("");
    setDraftTo("");
    pushParams((params) => {
      params.delete("from");
      params.delete("to");
      params.delete("page");
    });
    setDatePopoverOpen(false);
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
  const hasActiveDates = Boolean(from || to);

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <InquiryViewToggle view={isCalendar ? "calendar" : "table"} />
      </div>

      {isCalendar ? (
        <InquiriesCalendarManager events={events} locale={locale} teams={teams} isOwner={isOwner} workspaceTz={workspaceTz} />
      ) : (
        <>
          {/* Status tabs + Date popover tab */}
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
                  <span className={cn("tabular-nums text-xs", isActive ? "text-background/70" : "text-muted-foreground/70")}>
                    {count}
                  </span>
                </button>
              );
            })}

            {/* Date filter popover tab */}
            <Popover open={datePopoverOpen} onOpenChange={handleDatePopoverOpenChange}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className={cn(
                      "inline-flex min-h-11 items-center gap-1.5 border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:min-h-9",
                      hasActiveDates
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card text-muted-foreground hover:bg-accent/40"
                    )}
                  />
                }
              >
                <span>{t("toolbar.date")}</span>
                {hasActiveDates && (
                  <span className={cn("tabular-nums text-xs", hasActiveDates ? "text-background/70" : "text-muted-foreground/70")}>
                    {[from, to].filter(Boolean).join(" – ")}
                  </span>
                )}
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto min-w-56 p-3">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">{t("toolbar.from")}</label>
                    <input
                      type="date"
                      value={draftFrom}
                      max={draftTo || undefined}
                      onChange={(e) => setDraftFrom(e.target.value)}
                      className="border border-border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">{t("toolbar.to")}</label>
                    <input
                      type="date"
                      value={draftTo}
                      min={draftFrom || undefined}
                      onChange={(e) => setDraftTo(e.target.value)}
                      className="border border-border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleApplyDates}
                      className="flex-1 border border-foreground bg-foreground px-3 py-1.5 text-sm text-background transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {t("toolbar.apply")}
                    </button>
                    {(draftFrom || draftTo) && (
                      <button
                        type="button"
                        onClick={handleClearDates}
                        className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                      >
                        {t("toolbar.clear")}
                      </button>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {isPending ? (
            <TableSkeleton columns={INQUIRY_TABLE_COLUMNS} rows={Math.min(limit, 8)} />
          ) : (
            <InquiryTable rows={localRows} locale={locale} empty={empty} emptyHint={emptyHint} />
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
        teams={teams}
        onClose={() => {
          setDetailOpen(false);
          stripInquiryParam();
          if (hasChanges.current) {
            hasChanges.current = false;
            router.refresh();
          }
        }}
        onConverted={handleConverted}
        onConvertFailed={handleConvertFailed}
        onInquiryChanged={handleInquiryChanged}
      />
    </>
  );
}
