import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors inquiries/[id]/page.tsx: same header, same two-column grid, same
// cards in the same order (client info, event request | booking draft,
// history) so loading -> page does not shift. Keep in sync with the page.

function FieldSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <Skeleton className="h-4 w-16" />
      <Skeleton className={wide ? "h-5 w-full" : "h-5 w-2/3"} />
    </div>
  );
}

export default function InquiryDetailLoading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-16" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="h-8 w-40" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card data-skeleton-card="client-info">
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="py-2 first:pt-0 last:pb-0">
                  <FieldSkeleton />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card data-skeleton-card="event-request">
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <FieldSkeleton />
                <FieldSkeleton />
              </div>
              <FieldSkeleton wide />
              <div className="flex flex-col gap-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-3/4" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card data-skeleton-card="booking-draft">
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Skeleton className="h-5 w-full" />
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-full" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-[4.75rem] w-full" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-11 w-full" />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Skeleton className="h-8 w-full sm:flex-1" />
                <Skeleton className="h-8 w-full sm:w-20" />
              </div>
            </CardContent>
          </Card>
          <Card data-skeleton-card="history">
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between gap-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-28" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
