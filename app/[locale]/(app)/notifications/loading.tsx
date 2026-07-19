import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

const NOTIFICATION_ROWS = 6;

export default async function NotificationsLoading() {
  const t = await getTranslations("common");
  return (
    <div className="flex flex-col gap-0" aria-busy="true" role="status">
      <span className="sr-only">{t("loading")}</span>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <Skeleton className="h-6 w-32" />
      </div>
      <ul className="divide-y">
        {Array.from({ length: NOTIFICATION_ROWS }).map((_, i) => (
          <li key={i} className="flex items-start gap-3 px-4 py-3">
            <Skeleton className="size-8 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full max-w-sm" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
