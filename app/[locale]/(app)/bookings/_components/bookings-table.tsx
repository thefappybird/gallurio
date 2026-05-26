"use client";

import { useCallback, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpDownIcon,
  EyeIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatMoney } from "@/lib/utils/format-currency";
import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/lib/validators/booking";

export type BookingRow = {
  id: string;
  title: string;
  clientName: string;
  sessions: { startAt: string; endAt: string }[];
  /** ISO string of the latest session's endAt — used to compute isPast. */
  lastSessionEnd: string;
  status: BookingStatus;
  total: number;
  currency: string;
};

type Props = {
  rows: BookingRow[];
  locale: string;
  empty: string;
  showPast?: boolean;
};

/** Returns true when ALL sessions of a booking ended before today (midnight). */
function computeIsPast(lastSessionEnd: string): boolean {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return new Date(lastSessionEnd) < startOfToday;
}

export function BookingsTable({ rows, locale, empty, showPast = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("app.bookings.table");
  const tActions = useTranslations("app.bookings.row");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "sessions", desc: false },
  ]);

  // Client-side filter: hide fully-past bookings unless showPast is enabled.
  const visibleRows = showPast
    ? rows
    : rows.filter((r) => !computeIsPast(r.lastSessionEnd));

  const openDetail = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("detail", id);
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname]
  );

  const columns = useMemo<ColumnDef<BookingRow>[]>(
    () => [
      {
        accessorKey: "title",
        header: () => t("col.title"),
        cell: (info) => (
          <span className="font-medium">{info.getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "clientName",
        header: () => t("col.client"),
      },
      {
        accessorKey: "sessions",
        header: () => t("col.date"),
        cell: (info) => {
          const sessions = info.getValue<{ startAt: string; endAt: string }[]>();
          const firstDate = sessions[0]?.startAt
            ? new Date(sessions[0].startAt).toLocaleDateString(locale, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "—";
          const extra = sessions.length - 1;
          return (
            <span className="flex items-center gap-1.5">
              {firstDate}
              {extra > 0 ? (
                <span className="inline-block border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                  +{extra} sessions
                </span>
              ) : null}
            </span>
          );
        },
        sortingFn: (a, b) => {
          const aDate = a.original.sessions[0]?.startAt ?? "";
          const bDate = b.original.sessions[0]?.startAt ?? "";
          return new Date(aDate).getTime() - new Date(bDate).getTime();
        },
      },
      {
        accessorKey: "status",
        header: () => t("col.status"),
        cell: (info) => {
          const v = info.getValue<BookingStatus>();
          const isBooked = v === "booked";
          const isPast = computeIsPast(info.row.original.lastSessionEnd);
          return (
            <span className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant={isBooked ? "default" : "outline"}
                className={
                  "font-normal capitalize" +
                  (isBooked ? " bg-brand text-brand-foreground" : "")
                }
              >
                {v}
              </Badge>
              {isPast && (
                <span className="inline-flex items-center border border-muted-foreground/40 bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("past")}
                </span>
              )}
            </span>
          );
        },
      },
      {
        accessorKey: "total",
        header: () => <span className="block text-right">{t("col.total")}</span>,
        cell: (info) => (
          <span className="block text-right tabular-nums">
            {formatMoney(
              info.getValue<number>(),
              info.row.original.currency,
              locale
            )}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("col.actions")}</span>,
        cell: (info) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={tActions("openMenu")}
                  >
                    <MoreHorizontalIcon className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => openDetail(info.row.original.id)}
                >
                  <EyeIcon className="size-4" />
                  {tActions("view")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
        enableSorting: false,
      },
    ],
    [locale, t, tActions, openDetail]
  );

  const table = useReactTable({
    data: visibleRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (visibleRows.length === 0) {
    return (
      <div className="border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    );
  }

  return (
    <div className="border border-border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr
              key={hg.id}
              className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground"
            >
              {hg.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    className={cn(
                      "px-3 py-2 font-medium",
                      canSort && "cursor-pointer select-none"
                    )}
                    onClick={
                      canSort
                        ? header.column.getToggleSortingHandler()
                        : undefined
                    }
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {canSort &&
                        (sorted === "asc" ? (
                          <ArrowUpIcon className="size-3" />
                        ) : sorted === "desc" ? (
                          <ArrowDownIcon className="size-3" />
                        ) : (
                          <ArrowUpDownIcon className="size-3 opacity-40" />
                        ))}
                    </span>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const cancelled = row.original.status === "cancelled";
            const isPast = computeIsPast(row.original.lastSessionEnd);
            return (
              <tr
                key={row.id}
                onClick={() => openDetail(row.original.id)}
                className={cn(
                  "cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-accent/40",
                  (cancelled || isPast) && "opacity-60"
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={cn(
                      "px-3 py-2.5 align-middle",
                      (cancelled || isPast) &&
                        (cell.column.id === "title" ||
                          cell.column.id === "sessions") &&
                        "line-through"
                    )}
                    onClick={(e) => {
                      if (cell.column.id === "actions") e.stopPropagation();
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
