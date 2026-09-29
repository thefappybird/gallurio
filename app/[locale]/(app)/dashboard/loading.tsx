import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the real dashboard's card chrome (Card/CardHeader/CardContent) so
// only the inner content is a pulsing placeholder — avoids the layout shift
// of a generic/mismatched skeleton when the real cards mount, and never
// leaves a section looking blank while its data loads.
function CardSkeleton({
  className,
  contentClassName = "h-48",
}: {
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center gap-1.5 pb-3">
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className={`w-full ${contentClassName}`} />
      </CardContent>
    </Card>
  );
}

function KpiTileSkeleton() {
  return (
    <Card className="rounded-[var(--radius)] border-border">
      <CardContent className="flex items-center gap-3 px-3 py-2">
        <Skeleton
          data-testid="kpi-icon-skeleton"
          className="hidden size-11 shrink-0 rounded-[var(--radius)] sm:flex"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-3" aria-busy="true">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Skeleton className="h-9 w-56" />
          <Skeleton data-testid="tabs-skeleton" className="h-11 w-full sm:h-9 sm:w-32" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiTileSkeleton key={i} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <CardSkeleton className="rounded-[var(--radius)] lg:col-span-2" contentClassName="h-64" />
        <CardSkeleton className="rounded-[var(--radius)]" contentClassName="h-64" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <CardSkeleton className="rounded-[var(--radius)] lg:col-span-2" contentClassName="min-h-56" />
        <CardSkeleton className="rounded-[var(--radius)]" contentClassName="min-h-56" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <CardSkeleton className="rounded-[var(--radius)] lg:col-span-2" contentClassName="min-h-64" />
        <CardSkeleton className="rounded-[var(--radius)] lg:col-span-2" contentClassName="min-h-64" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <CardSkeleton className="rounded-[var(--radius)] lg:col-span-2" contentClassName="min-h-56" />
        <CardSkeleton className="rounded-[var(--radius)]" contentClassName="min-h-56" />
      </div>

      <div className="mt-2 flex flex-col gap-3 border-t border-border pt-4">
        <Skeleton className="h-4 w-24" />

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <CardSkeleton className="rounded-[var(--radius)] lg:col-span-2" contentClassName="min-h-48" />
          <CardSkeleton className="rounded-[var(--radius)]" contentClassName="min-h-48" />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <CardSkeleton className="rounded-[var(--radius)] lg:col-span-2" contentClassName="min-h-40" />
          <CardSkeleton className="rounded-[var(--radius)] lg:row-span-2" contentClassName="min-h-[22rem]" />
          <CardSkeleton className="rounded-[var(--radius)] lg:col-span-2" contentClassName="min-h-40" />
        </div>
      </div>
    </div>
  );
}
