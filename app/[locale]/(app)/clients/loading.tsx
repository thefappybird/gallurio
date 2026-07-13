import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/app/table-skeleton";

// ClientsTable columns: name, contact, source, totalSpent, actions = 5
const CLIENTS_TABLE_COLUMNS = 5;

export default async function ClientsLoading() {
  const t = await getTranslations("common");
  return (
    <div className="flex min-w-0 flex-col gap-4" aria-busy="true" role="status">
      <span className="sr-only">{t("loading")}</span>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-9 w-full sm:w-72" />
        <Skeleton className="h-9 w-28" />
      </div>
      <TableSkeleton columns={CLIENTS_TABLE_COLUMNS} rows={8} cardRows={4} />
    </div>
  );
}
