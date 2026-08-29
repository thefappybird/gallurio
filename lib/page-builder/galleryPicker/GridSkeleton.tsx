"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder tile grid shown while gallery-picker data loads. Holds the
 * populated grid's shape (same column classes + aspect-square tiles) so the
 * dialog body never collapses to near-nothing mid-fetch — pass the SAME grid
 * utility classes the populated `<ul>` uses so columns/gaps match exactly.
 * `role="status"` + `label` announce the loading state to assistive tech; the
 * tile list itself is `aria-hidden` (decorative).
 */
export function GridSkeleton({
  gridClassName,
  count = 8,
  label,
}: {
  gridClassName: string;
  count?: number;
  label: string;
}) {
  return (
    <div role="status" aria-label={label}>
      <ul className={gridClassName} aria-hidden="true">
        {Array.from({ length: count }).map((_, i) => (
          <li key={i}>
            <Skeleton className="aspect-square w-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}
