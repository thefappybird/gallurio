"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { RevenueTrendChart as RevenueTrendChartComponent } from "./revenue-trend-chart";
import { ChartLoadingFallback } from "./chart-loading-fallback";

type Props = ComponentProps<typeof RevenueTrendChartComponent>;

// Server Components can't code-split a dynamic() import of a Client
// Component -- the chunk still ships in the initial bundle (see Next's
// lazy-loading docs). Moving the dynamic() call behind this Client Component
// boundary makes the code-split real. ssr stays true: only the client chunk
// boundary moves, the chart still server-renders on first paint.
const RevenueTrendChart = dynamic(
  () => import("./revenue-trend-chart").then((module) => module.RevenueTrendChart),
  { ssr: true, loading: () => <ChartLoadingFallback className="h-full rounded-[var(--radius)]" /> }
);

export function RevenueTrendChartClient(props: Props) {
  return <RevenueTrendChart {...props} />;
}
