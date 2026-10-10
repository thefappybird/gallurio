"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { BookingEventTypeTrendChart as BookingEventTypeTrendChartComponent } from "./booking-event-type-trend-chart";
import { ChartLoadingFallback } from "./chart-loading-fallback";

type Props = ComponentProps<typeof BookingEventTypeTrendChartComponent>;

// Server Components can't code-split a dynamic() import of a Client
// Component -- the chunk still ships in the initial bundle (see Next's
// lazy-loading docs). Moving the dynamic() call behind this Client Component
// boundary makes the code-split real. ssr stays true: only the client chunk
// boundary moves, the chart still server-renders on first paint.
const BookingEventTypeTrendChart = dynamic(
  () =>
    import("./dashboard-charts").then(
      (module) => module.BookingEventTypeTrendChart
    ),
  { ssr: true, loading: () => <ChartLoadingFallback className="rounded-[var(--radius)]" /> }
);

export function BookingEventTypeTrendChartClient(props: Props) {
  return <BookingEventTypeTrendChart {...props} />;
}
