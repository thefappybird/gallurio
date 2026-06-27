"use client";

import { useTranslations } from "next-intl";

// Reuse the canonical event-status colors (globals.css, theme-invariant) so the
// dashboard status vocabulary matches the bookings/inquiries tables and calendar.
const BOOKING_COLOR: Record<string, string> = {
  booked: "var(--event-booked)",
  completed: "var(--event-completed)",
  cancelled: "var(--event-cancelled)",
};

const INQUIRY_COLOR: Record<string, string> = {
  inquiry: "var(--event-inquiry)",
  booked: "var(--event-booked)",
  converted: "var(--event-booked)",
  archived: "var(--muted-foreground)",
};

type Props = {
  status: string;
  kind: "booking" | "inquiry";
};

export function StatusChip({ status, kind }: Props) {
  const t = useTranslations(
    kind === "booking" ? "app.bookings.statusValues" : "app.inquiries.statusValues"
  );
  const palette = kind === "booking" ? BOOKING_COLOR : INQUIRY_COLOR;
  const color = palette[status] ?? "var(--muted-foreground)";
  // Labels (incl. capitalization) come from the message catalog, not CSS.
  const label = t.has(status) ? t(status) : status;

  return (
    <span
      style={{ background: color }}
      className="inline-flex shrink-0 items-center rounded-[var(--radius)] px-2 py-0.5 text-[11px] font-medium text-white"
    >
      {label}
    </span>
  );
}
