"use client";

import { useTransition } from "react";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { BookingsTable, type BookingRow } from "./bookings-table";
import { PageSizeSelect } from "@/components/app/page-size-select";
import { TableSkeleton } from "@/components/app/table-skeleton";
import { Button } from "@/components/ui/button";

// BookingsTable columns: title, client, date, status, total, actions = 6
const BOOKINGS_TABLE_COLUMNS = 6;

type Props = {
  rows: BookingRow[];
  total: number;
  page: number;
  limit: number;
  locale: string;
  empty: string;
  workspaceTimezone?: string;
};

export function BookingsPageClient({
  rows,
  total,
  page,
  limit,
  locale,
  empty,
  workspaceTimezone,
}: Props) {
  const t = useTranslations("common.pagination");
  useLiveRefresh(["booking"]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.ceil(total / limit);
  const from = Math.min((page - 1) * limit + 1, total);
  const to = Math.min(page * limit, total);

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {isPending ? (
        <TableSkeleton
          columns={BOOKINGS_TABLE_COLUMNS}
          rows={limit}
          cardRows={Math.min(limit, 4)}
        />
      ) : (
        <BookingsTable
          rows={rows}
          locale={locale}
          empty={empty}
          workspaceTimezone={workspaceTimezone}
        />
      )}

      {/* Pagination footer */}
      {total > 0 && (
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {t("showing", { from, to, total })}
          </span>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <PageSizeSelect value={limit} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="min-h-11 sm:min-h-0"
            >
              {t("previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="min-h-11 sm:min-h-0"
            >
              {t("next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
