"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { BookingsTable, type BookingRow } from "./bookings-table";
import { PageSizeSelect } from "@/components/app/page-size-select";
import { Pagination } from "@/components/app/pagination";
import { TableSkeleton } from "@/components/app/table-skeleton";
import { MobileSortControl } from "@/components/app/table-sort";
import { useTableFitCookie } from "@/hooks/use-table-fit-cookie";
import { BOOKINGS_SKELETON } from "@/lib/tables/skeleton-metrics";
import type { SortDir } from "@/lib/tables/sort";

// BookingsTable columns: title, client, date, booked, status, total, actions = 7
const BOOKINGS_TABLE_COLUMNS = 7;

const SORT_OPTION_KEYS = [
  ["bookedAt", "booked"],
  ["date", "date"],
  ["title", "title"],
  ["client", "client"],
  ["status", "status"],
  ["total", "total"],
] as const;

type Props = {
  rows: BookingRow[];
  total: number;
  page: number;
  limit: number;
  pageSizeOptions: number[];
  sortKey: string;
  sortDir: SortDir;
  locale: string;
  empty: string;
  emptyHint?: string;
  workspaceTimezone?: string;
};

export function BookingsPageClient({
  rows,
  total,
  page,
  limit,
  pageSizeOptions,
  sortKey,
  sortDir,
  locale,
  empty,
  emptyHint,
  workspaceTimezone,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("app.bookings.table");
  const fitRef = useTableFitCookie<HTMLDivElement>("bookings", BOOKINGS_SKELETON.rowHeight);

  const totalPages = Math.ceil(total / limit);
  const from = Math.min((page - 1) * limit + 1, total);
  const to = Math.min(page * limit, total);

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    params.set("limit", String(limit));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function changeSort(key: string, dir: SortDir) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", key);
    params.set("dir", dir);
    params.set("page", "1");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {total > 0 && (
        <MobileSortControl
          table="bookings"
          options={SORT_OPTION_KEYS.map(([key, label]) => ({
            key,
            label: t(`col.${label}`),
          }))}
          sortKey={sortKey}
          sortDir={sortDir}
          onSortChange={changeSort}
        />
      )}
      <div ref={fitRef} className="min-w-0">
        {isPending ? (
          <TableSkeleton
            columns={BOOKINGS_TABLE_COLUMNS}
            rows={limit}
            cardRows={Math.min(limit, 4)}
            {...BOOKINGS_SKELETON}
          />
        ) : (
          <BookingsTable
            rows={rows}
            locale={locale}
            empty={empty}
            emptyHint={emptyHint}
            workspaceTimezone={workspaceTimezone}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortChange={changeSort}
          />
        )}
      </div>

      {/* Pagination footer */}
      {total > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          from={from}
          to={to}
          total={total}
          onPageChange={goToPage}
          className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          actionsClassName="flex min-w-0 flex-wrap items-center gap-2"
        >
          <PageSizeSelect value={limit} options={pageSizeOptions} />
        </Pagination>
      )}
    </div>
  );
}
