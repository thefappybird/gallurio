"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpDownIcon,
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

export type ClientRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  tags: string[];
  notes: string;
  totalSpent: number;
  bookingsCount: number;
  lastBookingAt: Date | string | null;
  isActive: boolean;
  currency: string;
};

type Props = {
  rows: ClientRow[];
  locale: string;
  empty: string;
  onClickClient: (row: ClientRow) => void;
  onEdit: (row: ClientRow) => void;
  onDeactivate: (row: ClientRow) => void;
  onReactivate: (row: ClientRow) => void;
};

// Source badge colors — semantic borders, no raw color values
const SOURCE_BADGE_CLASS: Record<string, string> = {
  form: "border-brand text-brand",
  manual: "border-muted-foreground text-muted-foreground",
  referral: "border-foreground text-foreground",
  import: "border-muted-foreground text-muted-foreground",
};

export function ClientsTable({
  rows,
  locale,
  empty,
  onClickClient,
  onEdit,
  onDeactivate,
  onReactivate,
}: Props) {
  const t = useTranslations("app.clients");
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);

  const columns = useMemo<ColumnDef<ClientRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: () => t("table.col.name"),
        cell: (info) => {
          const row = info.row.original;
          const date = row.lastBookingAt
            ? new Date(row.lastBookingAt).toLocaleDateString(locale, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : null;
          return (
            <div className="flex flex-col">
              <span className="font-semibold leading-snug">{row.name}</span>
              <span className="text-xs text-muted-foreground">
                {row.bookingsCount > 0
                  ? t("table.bookings", { count: row.bookingsCount }) +
                    (date ? ` · ${t("table.lastBooking", { date })}` : "")
                  : t("table.noBookings")}
              </span>
            </div>
          );
        },
      },
      {
        id: "contact",
        header: () => t("table.col.contact"),
        cell: (info) => {
          const { email, phone } = info.row.original;
          return (
            <div className="flex flex-col text-xs">
              <span>{email ?? "—"}</span>
              <span className="text-muted-foreground">{phone ?? "—"}</span>
            </div>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: "source",
        header: () => t("table.col.source"),
        cell: (info) => {
          const src = info.getValue<string>();
          return (
            <Badge
              variant="outline"
              className={cn("font-normal capitalize", SOURCE_BADGE_CLASS[src] ?? "")}
            >
              {t(`sourceValues.${src}` as Parameters<typeof t>[0])}
            </Badge>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: "totalSpent",
        header: () => (
          <span className="block text-right">{t("table.col.totalSpent")}</span>
        ),
        cell: (info) => (
          <span className="block text-right tabular-nums text-brand">
            {formatMoney(info.getValue<number>(), info.row.original.currency, locale)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("table.col.actions")}</span>,
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("table.openMenu")}
                      className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
                    >
                      <MoreHorizontalIcon className="size-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(row)}>
                    {t("table.edit")}
                  </DropdownMenuItem>
                  {row.isActive ? (
                    <DropdownMenuItem onClick={() => onDeactivate(row)}>
                      {t("table.deactivate")}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => onReactivate(row)}>
                      {t("table.reactivate")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
        enableSorting: false,
      },
    ],
    [locale, t, onEdit, onDeactivate, onReactivate]
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (rows.length === 0) {
    return (
      <div className="border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-border bg-card">
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
                const ariaSort: "ascending" | "descending" | "none" | undefined = canSort
                  ? sorted === "asc"
                    ? "ascending"
                    : sorted === "desc"
                    ? "descending"
                    : "none"
                  : undefined;
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={ariaSort}
                    className="px-3 py-2 font-medium"
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === "asc" ? (
                          <ArrowUpIcon className="size-3" />
                        ) : sorted === "desc" ? (
                          <ArrowDownIcon className="size-3" />
                        ) : (
                          <ArrowUpDownIcon className="size-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              tabIndex={0}
              role="button"
              aria-label={t("table.openClient", { name: row.original.name })}
              onClick={() => onClickClient(row.original)}
              onKeyDown={(e) => {
                // Enter or Space activates the row, mirroring native button behavior.
                // Ignore key events bubbling up from interactive children (action menu).
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClickClient(row.original);
                }
              }}
              className={cn(
                "cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                !row.original.isActive && "opacity-50"
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className="px-3 py-2.5 align-middle"
                  onClick={(e) => {
                    if (cell.column.id === "actions") e.stopPropagation();
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
