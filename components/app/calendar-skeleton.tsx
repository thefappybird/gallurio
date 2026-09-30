"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useViewportRemainingHeight } from "@/hooks/use-viewport-remaining-height";

const WEEKDAY_COLS = 7;
const WEEK_ROWS = 6;

/**
 * Placeholder for the bookings/inquiries calendar: toolbar row + a 6x7 month
 * grid at the calendar's real height (same class + measured height as
 * BookingCalendar's container) so swapping in the real calendar never shifts
 * the layout.
 */
export function CalendarSkeleton() {
  const { ref, remainingHeight } = useViewportRemainingHeight<HTMLDivElement>();
  return (
    <div
      ref={ref}
      aria-busy="true"
      aria-label="Loading calendar"
      className="flex h-[calc(100dvh-14rem)] min-h-0 w-full min-w-0 flex-col gap-2"
      style={remainingHeight === null ? undefined : { height: `${remainingHeight}px` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-11 w-11 sm:w-24" />
          <Skeleton className="h-11 w-36" />
        </div>
        <Skeleton className="h-11 w-44" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-[auto_repeat(6,minmax(0,1fr))] border border-border bg-card">
        {Array.from({ length: WEEKDAY_COLS }).map((_, i) => (
          <div key={`h${i}`} className="flex justify-center border-b border-border p-2">
            <Skeleton className="h-3 w-8" />
          </div>
        ))}
        {Array.from({ length: WEEK_ROWS * WEEKDAY_COLS }).map((_, i) => (
          <div
            key={i}
            data-calendar-skeleton-cell
            className="border-e border-b border-border p-1.5"
          >
            <Skeleton className="h-3 w-4" />
          </div>
        ))}
      </div>
    </div>
  );
}
