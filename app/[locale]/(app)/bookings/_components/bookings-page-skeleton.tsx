import { Skeleton } from "@/components/ui/skeleton";

/**
 * Static page header + toolbar placeholder shared by `loading.tsx` (no data,
 * prefetchable) and the per-view Suspense fallback in `page.tsx`. Identical in
 * table and calendar views so the route-level skeleton never flashes the wrong
 * layout.
 */
export function BookingsHeaderSkeleton() {
  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-9 w-full sm:w-72" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-11 w-full sm:w-64" />
        <Skeleton className="h-11 w-24" />
        <Skeleton className="h-11 w-24" />
      </div>
    </>
  );
}
