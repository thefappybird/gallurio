"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { BookingValueCollectionChart as BookingValueCollectionChartComponent } from "./booking-value-collection-chart";
import { ChartLoadingFallback } from "./chart-loading-fallback";

type Props = ComponentProps<typeof BookingValueCollectionChartComponent>;

// Server Components can't code-split a dynamic() import of a Client
// Component -- the chunk still ships in the initial bundle (see Next's
// lazy-loading docs). Moving the dynamic() call behind this Client Component
// boundary makes the code-split real. ssr stays true: only the client chunk
// boundary moves, the chart still server-renders on first paint.
const BookingValueCollectionChart = dynamic(
  () =>
    import("./booking-value-collection-chart").then(
      (module) => module.BookingValueCollectionChart
    ),
  {
    ssr: true,
    // Real card content is h-64 (see booking-value-collection-chart.tsx);
    // the default min-h-48 fallback would undershoot it.
    loading: () => (
      <ChartLoadingFallback className="rounded-[var(--radius)]" contentClassName="min-h-64" />
    ),
  }
);

export function BookingValueCollectionChartClient(props: Props) {
  return <BookingValueCollectionChart {...props} />;
}
