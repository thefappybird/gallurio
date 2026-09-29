import { Skeleton } from "@/components/ui/skeleton";

// Mirrors SettingsUserProfile's real shape: a workspace-name bar, then a
// bordered shell with the top tab rail (icon-over-label chips below sm,
// icon-beside-label from sm up) and the account panel below it — the
// default `/settings` entry, so its skeleton is modeled on
// account/_panel.tsx (avatar, name form, password, MFA sections).
export default function SettingsLoading() {
  return (
    <div className="flex w-full flex-col gap-0" aria-busy="true">
      <div className="flex w-full items-center justify-between border border-b-0 border-border bg-card px-4 py-3">
        <Skeleton className="h-5 w-32" />
      </div>

      <div className="flex w-full flex-col border border-border">
        <div className="flex w-full gap-1 overflow-x-auto border-b border-border bg-card px-2 sm:gap-2 sm:px-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              data-testid="settings-tab-chip-skeleton"
              className="flex min-h-14 shrink-0 flex-col items-center justify-center gap-1 border-b-2 border-transparent px-3 py-2 sm:min-h-11 sm:flex-row sm:gap-2 sm:px-4 sm:py-3"
            >
              <Skeleton className="size-4 shrink-0 rounded-full" />
              <Skeleton className="h-2 w-8 sm:h-3 sm:w-14" />
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1 p-6">
          <div className="flex w-full flex-col gap-8">
            {/* Avatar section */}
            <section className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-4 w-64" />
              </div>
              <div className="flex items-start gap-4">
                <Skeleton className="size-14 shrink-0 rounded-full" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                  <div className="flex gap-2">
                    <Skeleton className="h-9 w-24" />
                  </div>
                </div>
              </div>
            </section>

            {/* Name form section */}
            <section className="flex flex-col gap-4 border-t border-border pt-8">
              <Skeleton className="h-7 w-40" />
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                </div>
                <Skeleton className="h-11 w-28" />
              </div>
            </section>

            {/* Password section — modeled on the collapsed change-password form */}
            <section className="flex flex-col gap-4 border-t border-border pt-8">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-7 w-36" />
                <Skeleton className="h-4 w-56" />
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-9 w-full" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                </div>
                <Skeleton className="h-11 w-28" />
              </div>
            </section>

            {/* MFA section — modeled on the collapsed not-enrolled state */}
            <section className="flex flex-col gap-4 border-t border-border pt-8">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-4 w-64" />
              </div>
              <div className="flex flex-col gap-4">
                <Skeleton className="h-11 w-56" />
                <Skeleton className="h-11 w-32" />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
