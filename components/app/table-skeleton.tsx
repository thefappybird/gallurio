import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Props = {
  columns: number;
  rows?: number;
  cardRows?: number;
  className?: string;
};

// Slight width variance per column position makes the skeleton feel more natural.
const COL_WIDTHS = ["w-2/5", "w-1/3", "w-1/4", "w-1/5", "w-1/6", "w-1/6", "w-1/6"];

function CardCollectionSkeleton({ rows }: { rows: number }) {
  return (
    <div
      className="flex flex-col gap-3 lg:hidden"
      aria-busy="true"
      aria-label="Loading card data"
    >
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Skeleton className="h-5 w-18" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
            <Skeleton className="size-8 shrink-0" />
          </div>
          <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((__, fieldIdx) => (
              <div key={fieldIdx} className="flex flex-col gap-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton
                  className={cn(
                    "h-4",
                    fieldIdx % 2 === 0 ? "w-5/6" : "w-2/3"
                  )}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({
  columns,
  rows = 8,
  cardRows,
  className,
}: Props) {
  const showResponsiveCards = typeof cardRows === "number" && cardRows > 0;

  return (
    <>
      {showResponsiveCards ? <CardCollectionSkeleton rows={cardRows} /> : null}
      <div
        className={cn(
          "border border-border bg-card overflow-x-auto",
          showResponsiveCards ? "hidden lg:block" : "",
          className
        )}
        aria-busy="true"
        aria-label="Loading table data"
      >
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-3 py-2 text-start">
                  <Skeleton className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIdx) => (
              <tr key={rowIdx} className="border-b border-border last:border-b-0">
                {Array.from({ length: columns }).map((_, colIdx) => (
                  <td key={colIdx} className="px-3 py-2.5 align-middle">
                    <Skeleton
                      className={cn("h-5 w-full", COL_WIDTHS[colIdx % COL_WIDTHS.length])}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
