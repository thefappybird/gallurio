"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type RowData,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpDownIcon,
  EyeIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  PowerOffIcon,
  RotateCcwIcon,
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
import { SourceBadge } from "./source-badge";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: "left" | "right";
  }
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
  onView: (row: ClientRow) => void;
  onEdit: (row: ClientRow) => void;
  onDeactivate: (row: ClientRow) => void;
  onReactivate: (row: ClientRow) => void;
  /** Id of the client currently being reactivated — disables/loads only that row. */
  reactivatingId?: string | null;
};

export function ClientsTable({
  rows,
  locale,
  empty,
  onClickClient,
  onView,
  onEdit,
  onDeactivate,
  onReactivate,
  reactivatingId = null,
}: Props) {
  const t = useTranslations("app.clients");
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);

  function bookingsSubtext(row: ClientRow): string {
    const date = row.lastBookingAt
      ? new Date(row.lastBookingAt).toLocaleDateString(locale, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;
    return row.bookingsCount > 0
      ? t("table.bookings", { count: row.bookingsCount }) +
          (date ? ` · ${t("table.lastBooking", { date })}` : "")
      : t("table.noBookings");
  }

  function renderActionsMenu(row: ClientRow) {
    const isRowReactivating = reactivatingId === row.id;
    return (
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
          <DropdownMenuItem onClick={() => onView(row)}>
            <EyeIcon className="size-3" />
            {t("table.view")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(row)}>
            <PencilIcon className="size-3" />
            {t("table.edit")}
          </DropdownMenuItem>
          {row.isActive ? (
            <DropdownMenuItem onClick={() => onDeactivate(row)}>
              <PowerOffIcon className="size-3" />
              {t("table.deactivate")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => onReactivate(row)}
              disabled={isRowReactivating}
            >
              {isRowReactivating ? (
                <Loader2Icon className="size-3 animate-spin" />
              ) : (
                <RotateCcwIcon className="size-3" />
              )}
              {t("table.reactivate")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const columns = useMemo<ColumnDef<ClientRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: () => t("table.col.name"),
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex flex-col">
              <span className="font-semibold leading-snug">{row.name}</span>
              <span className="text-xs text-muted-foreground">
                {bookingsSubtext(row)}
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
        cell: (info) => <SourceBadge source={info.getValue<string>()} />,
        enableSorting: false,
      },
      {
        accessorKey: "totalSpent",
        header: () => t("table.col.totalSpent"),
        cell: (info) => (
          <span className="block tabular-nums text-brand">
            {formatMoney(info.getValue<number>(), info.row.original.currency, locale)}
          </span>
        ),
        meta: { align: "right" },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("table.col.actions")}</span>,
        cell: (info) => (
          <div className="flex justify-end">
            {renderActionsMenu(info.row.original)}
          </div>
        ),
        enableSorting: false,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bookingsSubtext/renderActionsMenu close over these same deps every render
    [locale, t, onView, onEdit, onDeactivate, onReactivate, reactivatingId]
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
    <>
      <div data-testid="clients-card-list" className="flex flex-col gap-3 lg:hidden">
        {table.getRowModel().rows.map((row) => {
          const client = row.original;
          return (
            <article
              key={client.id}
              role="button"
              tabIndex={0}
              aria-label={t("table.openClient", { name: client.name })}
              onClick={() => onClickClient(client)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClickClient(client);
                }
              }}
              className={cn(
                "border border-border bg-card p-4 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                !client.isActive && "opacity-50"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold leading-snug">{client.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {bookingsSubtext(client)}
                  </p>
                </div>

                <div onClick={(event) => event.stopPropagation()}>
                  {renderActionsMenu(client)}
                </div>
              </div>

              <dl className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                <CardField
                  label={t("table.col.contact")}
                  value={
                    <span className="flex flex-col">
                      <span>{client.email ?? "—"}</span>
                      <span className="text-muted-foreground">{client.phone ?? "—"}</span>
                    </span>
                  }
                />
                <CardField
                  label={t("table.col.source")}
                  value={<SourceBadge source={client.source} />}
                />
                <CardField
                  label={t("table.col.totalSpent")}
                  value={formatMoney(client.totalSpent, client.currency, locale)}
                  valueClassName="tabular-nums text-brand"
                />
              </dl>
            </article>
          );
        })}
      </div>

      <div className="hidden min-w-0 max-w-full overflow-x-auto border border-border bg-card lg:block">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr
                key={hg.id}
                className="border-b border-border bg-muted/30 text-start text-xs uppercase tracking-wide text-muted-foreground"
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
                  const alignRight = header.column.columnDef.meta?.align === "right";
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={ariaSort}
                      className={cn("px-3 py-2 font-medium", alignRight ? "text-end" : "text-start")}
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "inline-flex items-center gap-1 font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                            alignRight && "w-full justify-end"
                          )}
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
                        <span
                          className={cn(
                            "inline-flex items-center gap-1",
                            alignRight && "w-full justify-end"
                          )}
                        >
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
                    className={cn(
                      "px-3 py-2.5 align-middle",
                      cell.column.columnDef.meta?.align === "right" && "text-end"
                    )}
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
    </>
  );
}
