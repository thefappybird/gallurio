import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Props = {
  columns: number;
  rows?: number;
  className?: string;
};

// Slight width variance per column position makes the skeleton feel more natural.
const COL_WIDTHS = ["w-2/5", "w-1/3", "w-1/4", "w-1/5", "w-1/6", "w-1/6", "w-1/6"];

export function TableSkeleton({ columns, rows = 8, className }: Props) {
  return (
    <div
      className={cn("border border-border bg-card overflow-x-auto", className)}
      aria-busy="true"
      aria-label="Loading table data"
    >
      {/* Header row */}
      <div className="flex border-b border-border bg-muted/30 px-3 py-2 gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-16 shrink-0" />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex items-center gap-4 border-b border-border px-3 py-2.5 last:border-b-0"
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Skeleton
              key={colIdx}
              className={cn(
                "h-5 shrink-0",
                COL_WIDTHS[colIdx % COL_WIDTHS.length]
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
