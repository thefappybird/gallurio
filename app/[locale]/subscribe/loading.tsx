import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

export default async function SubscribeLoading() {
  const t = await getTranslations("common");
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted/40 px-4 py-12"
      aria-busy="true"
      role="status"
    >
      <span className="sr-only">{t("loading")}</span>
      <div className="w-full max-w-md border border-border bg-background p-8">
        <Skeleton className="mb-2 h-6 w-40" />
        <Skeleton className="mb-6 h-4 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="mt-3 h-24 w-full" />
      </div>
    </div>
  );
}
