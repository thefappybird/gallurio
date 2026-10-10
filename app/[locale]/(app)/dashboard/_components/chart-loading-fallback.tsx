import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Minimal placeholder shown only while a dynamic-imported chart's client
 * chunk is still being fetched (page markup has already SSR'd once, so this
 * is a much smaller-stakes case than the route-level dashboard `loading.tsx`).
 */
export function ChartLoadingFallback({
  className,
  contentClassName = "min-h-48",
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
