import { Skeleton } from "@/components/ui/skeleton";

/**
 * Static page header placeholder shared by `loading.tsx` (no data,
 * prefetchable) and the per-view Suspense fallback in `page.tsx`.
 */
export function InquiriesHeaderSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <Skeleton className="h-9 w-28" />
    </div>
  );
}
