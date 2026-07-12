import { Skeleton } from "@/components/ui/skeleton";

// Mirrors SettingsUserProfile's real shape: a workspace-name bar, then a
// bordered shell with the top tab rail (icon-over-label chips below sm,
// icon-beside-label from sm up) and the panel below it — not the old
// desktop-sidebar layout this settings surface no longer uses.
export default function SettingsLoading() {
  return (
    <div className="flex w-full flex-col gap-0" aria-busy="true">
      <div className="flex w-full items-center border border-b-0 border-border bg-card px-4 py-3">
        <Skeleton className="h-4 w-32" />
      </div>

      <div className="flex w-full flex-col border border-border">
        <div className="flex w-full gap-1 overflow-x-auto border-b border-border bg-card px-2 sm:gap-2 sm:px-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex min-h-14 shrink-0 items-center gap-2 px-3 py-2 sm:min-h-11 sm:px-4 sm:py-3">
              <Skeleton className="size-4 shrink-0 rounded-full" />
              <Skeleton className="hidden h-3 w-14 sm:block" />
            </div>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4 p-6">
          <Skeleton className="h-7 w-48" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
