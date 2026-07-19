import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/app/table-skeleton";

// BookingsTable columns: title, client, date, status, total, actions = 6
const BOOKINGS_TABLE_COLUMNS = 6;

export default function BookingsLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-4" aria-busy="true">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-9 w-full sm:w-72" />
        <Skeleton className="h-9 w-28" />
      </div>
      <TableSkeleton columns={BOOKINGS_TABLE_COLUMNS} rows={8} cardRows={4} />
    </div>
  );
}
