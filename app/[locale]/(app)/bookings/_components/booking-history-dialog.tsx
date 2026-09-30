"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAppWorkspaceId } from "@/components/app/app-query-provider";
import { queryKeys } from "@/lib/query/keys";
import { useTranslations } from "next-intl";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { XIcon } from "lucide-react";
import type { ActivityEntry } from "./activity-types";
import { ActivityTimeline } from "./activity-timeline";

type Props = {
  bookingId: string;
  open: boolean;
  onClose: () => void;
  locale: string;
  /** Currency for formatting money diffs — defaults to "PHP" if not provided. */
  currency?: string;
};

const PAGE_SIZE = 5;

type ActivityPage = {
  entries: ActivityEntry[];
  total: number;
  actorNames?: Record<string, string>;
};

export function BookingHistoryDialog({
  bookingId,
  open,
  onClose,
  locale,
  currency = "PHP",
}: Props) {
  const t = useTranslations("app.bookings.detail.history");
  const ws = useAppWorkspaceId();
  const [page, setPage] = useState(1);
  // Back to page 1 whenever the dialog re-opens.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setPage(1);
  }

  // Actor names ride along on each page (no separate names request). The
  // previous page stays on screen while the next one loads.
  const query = useQuery({
    queryKey: queryKeys(ws).bookingActivity(bookingId, page),
    queryFn: async (): Promise<ActivityPage> => {
      const res = await fetch(`/api/bookings/${bookingId}/activity?page=${page}&pageSize=${PAGE_SIZE}`);
      if (!res.ok) throw new Error(`activity_load_failed_${res.status}`);
      return res.json();
    },
    enabled: open,
    placeholderData: keepPreviousData,
  });
  const entries = query.data?.entries ?? [];
  const total = query.data?.total ?? 0;
  const actorNames = query.data?.actorNames ?? {};
  const loading = query.isPending || query.isPlaceholderData;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showPagination = total > PAGE_SIZE;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[calc(100vh-3rem)] w-full max-w-xl flex-col gap-0 p-0"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <DialogTitle>{t("title")}</DialogTitle>
            <p className="text-xs text-muted-foreground">
              {t("totalCount", { count: total })}
            </p>
          </div>
          <DialogClose
            render={
              <Button variant="ghost" size="icon-sm" onClick={onClose}>
                <XIcon className="size-4" />
              </Button>
            }
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {query.isError && !query.data ? (
            <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
              <p>{t("loadError")}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>
                {t("retry")}
              </Button>
            </div>
          ) : loading ? (
            <div className="flex flex-col gap-2" aria-busy="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <ActivityTimeline
              entries={entries}
              locale={locale}
              currency={currency}
              actorNames={actorNames}
            />
          )}
        </div>

        {showPagination ? (
          <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-2">
            <span className="text-xs text-muted-foreground">
              {t("pageOf", { page, total: totalPages })}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                aria-label={t("previous")}
              >
                <ChevronLeftIcon className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                aria-label={t("next")}
              >
                <ChevronRightIcon className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
