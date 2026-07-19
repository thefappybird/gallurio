import type { BookingStatus } from "@/lib/validators/booking";

// Single source of truth for booking-status colors. The CSS vars are defined in
// app/globals.css and are theme-invariant by design (same value in light and
// dark) so the status vocabulary stays stable across themes. White text always
// contrasts these mid-luminance fills. Consumed by the table pills, the
// calendar candles, and the calendar legend so all three never drift apart.
export const STATUS_COLOR_VAR: Record<BookingStatus, string> = {
  booked: "var(--event-booked)",
  completed: "var(--event-completed)",
  cancelled: "var(--event-cancelled)",
};

export const STATUS_ORDER: BookingStatus[] = [
  "booked",
  "completed",
  "cancelled",
];

export const CONFLICT_COLOR_VAR = "var(--danger)";
