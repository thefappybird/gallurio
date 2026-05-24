"use client";

import { useEffect, useState } from "react";
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

type Props = {
  bookingId: string;
  open: boolean;
  onClose: () => void;
  locale: string;
};

const PAGE_SIZE = 5;

export function BookingHistoryDialog({
  bookingId,
  open,
  onClose,
  locale,
}: Props) {
  const t = useTranslations("app.bookings.detail.history");
  const tFields = useTranslations("app.bookings.detail.fields");
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const url = `/api/bookings/${bookingId}/activity?page=${page}&pageSize=${PAGE_SIZE}`;
    Promise.resolve()
      .then(() => {
        if (cancelled) return;
        setLoading(true);
        return fetch(url)
          .then((r) => (r.ok ? r.json() : { entries: [], total: 0 }))
          .then(({ entries, total }) => {
            if (cancelled) return;
            setEntries(entries ?? []);
            setTotal(total ?? 0);
            setLoading(false);
          })
          .catch(() => {
            if (cancelled) return;
            setLoading(false);
          });
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId, page, open]);

  // Reset to page 1 whenever the dialog re-opens.
  useEffect(() => {
    if (!open) return;
    Promise.resolve().then(() => setPage(1));
  }, [open]);

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
          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {tFields("activityEmpty")}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {entries.map((entry) => (
                <li
                  key={entry._id}
                  className="flex items-start justify-between gap-3 py-2.5"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm capitalize">
                      {entry.action.replace("_", " ")}
                    </span>
                    {entry.diff?.changes ? (
                      <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                        {Object.entries(entry.diff.changes).map(([k]) => (
                          <li key={k} className="capitalize">
                            · {k.replace(".", " · ")}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {new Date(entry.createdAt).toLocaleString(locale, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
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
