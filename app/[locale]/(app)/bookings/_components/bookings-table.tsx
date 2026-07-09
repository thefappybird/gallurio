"use client";

import type { KeyboardEvent, ReactNode } from "react";
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
  PencilIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatMoney } from "@/lib/utils/format-currency";
import { cn } from "@/lib/utils";
import { dayBoundInTz } from "@/lib/utils/timezone";
import { isoDateInTz } from "./_helpers/calendar-helpers";
import { STATUS_COLOR_VAR } from "@/lib/bookings/status-style";
import type { BookingStatus } from "@/lib/validators/booking";

export type BookingRow = {
  id: string;
  title: string;
  clientName: string;
  sessions: { startAt: string; endAt: string }[];
  /** ISO string of the latest session's endAt; used to compute isPast. */
  lastSessionEnd: string;
  status: BookingStatus;
  total: number;
  currency: string;
};

type Props = {
  rows: BookingRow[];
  locale: string;
  empty: string;
  workspaceTimezone?: string;
};

function computeIsPast(lastSessionEnd: string, tz: string): boolean {
  const todayStr = isoDateInTz(new Date(), tz);
  const todayStart = dayBoundInTz(todayStr, tz, 0, 0, 0, 0);
  return new Date(lastSessionEnd) < todayStart;
}

function CardField({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("text-sm text-foreground", valueClassName)}>{value}</dd>
    </div>
  );
}

function CardFieldStack({ children }: { children: ReactNode }) {
  return <div className="grid gap-3">{children}</div>;
}

export function BookingsTable({
  rows,
  locale,
  empty,
  workspaceTimezone = "UTC",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("app.bookings.table");
  const tActions = useTranslations("app.bookings.row");
  const tStatus = useTranslations("app.bookings.statusValues");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "sessions", desc: false },
  ]);

  const visibleRows = rows;

  const openDetail = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("detail", id);
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const openEdit = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("edit", id);
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const formatSessionSummary = useCallback(
    (sessions: { startAt: string; endAt: string }[]) => {
      const firstDate = sessions[0]?.startAt
        ? new Date(sessions[0].startAt).toLocaleDateString(locale, {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "-";
      const extra = sessions.length - 1;
      return (
        <span className="flex flex-wrap items-center gap-1.5">
          <span>{firstDate}</span>
          {extra > 0 ? (
            <span className="inline-block border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
              +{extra} sessions
            </span>
          ) : null}
        </span>
      );
    },
    [locale]
  );

  const renderStatus = useCallback(
    (status: BookingStatus, lastSessionEnd: string) => {
      const isPast = computeIsPast(lastSessionEnd, workspaceTimezone);
      return (
        <span className="flex flex-wrap items-center gap-1.5">
          <span
            className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-white"
            style={{
              backgroundColor: STATUS_COLOR_VAR[status] ?? "var(--muted)",
            }}
          >
            {typeof tStatus.has === "function" && !tStatus.has(status)
              ? status
              : tStatus(status)}
          </span>
          {isPast ? (
            <span className="inline-flex items-center border border-muted-foreground/40 bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("past")}
            </span>
          ) : null}
        </span>
      );
    },
    [t, tStatus, workspaceTimezone]
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
        cell: (info) =>
          formatSessionSummary(
            info.getValue<{ startAt: string; endAt: string }[]>()
          ),
        sortingFn: (a, b) => {
          const aDate = a.original.sessions[0]?.startAt ?? "";
          const bDate = b.original.sessions[0]?.startAt ?? "";
          return new Date(aDate).getTime() - new Date(bDate).getTime();
        },
      },
      {
        accessorKey: "status",
        header: () => t("col.status"),
        cell: (info) =>
          renderStatus(
            info.getValue<BookingStatus>(),
            info.row.original.lastSessionEnd
          ),
      },
      {
        accessorKey: "total",
        header: () => <span className="block text-end">{t("col.total")}</span>,
        cell: (info) => (
          <span className="tabular-nums">
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
                <DropdownMenuItem onClick={() => openEdit(info.row.original.id)}>
                  <PencilIcon className="size-4" />
                  {tActions("edit")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
        enableSorting: false,
      },
    ],
    [
      formatSessionSummary,
      locale,
      openDetail,
      openEdit,
      renderStatus,
      t,
      tActions,
    ]
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table's useReactTable returns non-memoizable functions; React Compiler skips this component intentionally
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
    <>
      <div
        data-testid="bookings-card-list"
        className="flex flex-col gap-3 lg:hidden"
      >
        {table.getRowModel().rows.map((row) => {
          const cancelled = row.original.status === "cancelled";
          const isPast = computeIsPast(
            row.original.lastSessionEnd,
            workspaceTimezone
          );
          const muted = cancelled || isPast;

          function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openDetail(row.original.id);
            }
          }

          return (
            <article
              key={row.id}
              role="button"
              tabIndex={0}
              aria-label={`${tActions("view")} ${row.original.title}`}
              onClick={() => openDetail(row.original.id)}
              onKeyDown={handleKeyDown}
              className={cn(
                "border border-border bg-card p-4 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                muted && "opacity-60"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "font-medium leading-snug text-foreground",
                      muted && "line-through"
                    )}
                  >
                    {row.original.title}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {row.original.clientName}
                  </p>
                </div>

                <div onClick={(event) => event.stopPropagation()}>
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
                        onClick={() => openDetail(row.original.id)}
                      >
                        <EyeIcon className="size-4" />
                        {tActions("view")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEdit(row.original.id)}>
                        <PencilIcon className="size-4" />
                        {tActions("edit")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <dl className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                <CardField
                  label={t("col.client")}
                  value={row.original.clientName}
                />
                <CardField
                  label={t("col.date")}
                  value={formatSessionSummary(row.original.sessions)}
                  valueClassName={muted ? "line-through" : undefined}
                />
                <CardFieldStack>
                  <CardField
                    label={t("col.status")}
                    value={renderStatus(
                      row.original.status,
                      row.original.lastSessionEnd
                    )}
                  />
                  <CardField
                    label={t("col.total")}
                    value={
                      <span className="tabular-nums">
                        {formatMoney(
                          row.original.total,
                          row.original.currency,
                          locale
                        )}
                      </span>
                    }
                  />
                </CardFieldStack>
              </dl>
            </article>
          );
        })}
      </div>

      <div className="hidden min-w-0 max-w-full overflow-x-auto border border-border bg-card lg:block">
        <table className="w-full min-w-max text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr
                key={hg.id}
                className="border-b border-border bg-muted/30 text-start text-xs uppercase tracking-wide text-muted-foreground"
              >
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "px-3 py-2 font-medium text-start",
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
              const isPast = computeIsPast(
                row.original.lastSessionEnd,
                workspaceTimezone
              );

              function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openDetail(row.original.id);
                }
              }

              return (
                <tr
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${tActions("view")} ${row.original.title}`}
                  onClick={() => openDetail(row.original.id)}
                  onKeyDown={handleRowKeyDown}
                  className={cn(
                    "cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset",
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
                      onClick={(event) => {
                        if (cell.column.id === "actions") event.stopPropagation();
                      }}
                      onKeyDown={(event) => {
                        if (cell.column.id === "actions") event.stopPropagation();
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
    </>
  );
}
