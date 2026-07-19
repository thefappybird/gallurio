import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

// Full-bleed shell placeholder matching EditorShell's toolbar + rail + canvas
// layout (see page.tsx's `-m-6 h-svh` wrapper).
export default async function PortfolioLoading() {
  const t = await getTranslations("common");
  return (
    <div className="-m-6 flex h-svh flex-col" aria-busy="true" role="status">
      <span className="sr-only">{t("loading")}</span>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <Skeleton className="h-8 w-40" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-64 shrink-0 border-e border-border p-3 lg:block">
          <Skeleton className="h-full w-full" />
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    </div>
  );
}
