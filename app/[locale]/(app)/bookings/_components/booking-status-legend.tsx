"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { STATUS_COLOR_VAR, STATUS_ORDER } from "@/lib/bookings/status-style";
import type { BookingStatus } from "@/lib/validators/booking";

type Props = {
  /** Currently filtered status, or null when showing all. */
  activeStatus: BookingStatus | null;
  /** Toggle a status: selecting the active one again clears the filter. */
  onToggle: (status: BookingStatus) => void;
};

/**
 * Calendar status legend that doubles as a single-select status filter. Each
 * chip's color matches its calendar candle (and table pill) via the shared
 * STATUS_COLOR_VAR. Clicking a chip filters the calendar to that status;
 * clicking the active chip again clears the filter.
 */
export function BookingStatusLegend({ activeStatus, onToggle }: Props) {
  const tStatus = useTranslations("app.bookings.statusValues");
  const tCalendar = useTranslations("app.bookings.calendar");

  return (
    <div
      role="group"
      aria-label={tCalendar("filterByStatus")}
      className="flex flex-wrap items-center gap-x-2 gap-y-1.5"
    >
      {STATUS_ORDER.map((status) => {
        const isActive = activeStatus === status;
        const dimmed = activeStatus !== null && !isActive;
        return (
          <button
            key={status}
            type="button"
            onClick={() => onToggle(status)}
            aria-pressed={isActive}
            title={
              isActive
                ? tCalendar("filterActive", { status: tStatus(status) })
                : undefined
            }
            className={cn(
              "inline-flex min-h-8 items-center gap-1.5 border px-2 py-1 text-xs font-medium transition-colors",
              "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "border-foreground text-foreground"
                : "border-border text-muted-foreground",
              dimmed && "opacity-60"
            )}
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0"
              style={{ backgroundColor: STATUS_COLOR_VAR[status] }}
            />
            {tStatus(status)}
          </button>
        );
      })}
    </div>
  );
}
