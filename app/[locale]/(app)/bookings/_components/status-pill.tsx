"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { STATUS_COLOR_VAR } from "@/lib/bookings/status-style";
import type { BookingStatus } from "@/lib/validators/booking";

const KNOWN: Record<BookingStatus, true> = {
  inquiry: true,
  quoted: true,
  booked: true,
  completed: true,
  cancelled: true,
};

/**
 * Compact status pill — a bordered chip with the shared status color dot and
 * the localized status label. Reuses STATUS_COLOR_VAR so it never drifts from
 * the table pills, calendar candles, and legend. Square-cornered per design.
 */
export function StatusPill({
  status,
  className,
}: {
  status: BookingStatus | string;
  className?: string;
}) {
  const tStatus = useTranslations("app.bookings.statusValues");
  const isKnown = (status as BookingStatus) in KNOWN;
  const color = isKnown ? STATUS_COLOR_VAR[status as BookingStatus] : undefined;
  const label = isKnown ? tStatus(status as BookingStatus) : status;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 border border-border bg-card px-2 py-0.5 text-xs font-medium text-card-foreground",
        className
      )}
    >
      <span
        aria-hidden
        className="size-2 shrink-0"
        style={color ? { backgroundColor: color } : undefined}
      />
      {label}
    </span>
  );
}
