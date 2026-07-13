import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/app/table-skeleton";

// TeamsTable columns: color, name, memberCount, actions = 4
const TEAMS_TABLE_COLUMNS = 4;

export default async function TeamsLoading() {
  const t = await getTranslations("common");
  return (
    <div className="flex min-w-0 flex-col gap-4" aria-busy="true" role="status">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-4 w-full max-w-md" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-9 w-full sm:w-80" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <TableSkeleton columns={TEAMS_TABLE_COLUMNS} rows={6} cardRows={3} />
    </div>
  );
}
