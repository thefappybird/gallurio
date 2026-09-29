"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { PortfolioVisitorsInquiriesChart as PortfolioVisitorsInquiriesChartComponent } from "./portfolio-visitors-inquiries-chart";

type Props = ComponentProps<typeof PortfolioVisitorsInquiriesChartComponent>;

// Server Components can't code-split a dynamic() import of a Client
// Component -- the chunk still ships in the initial bundle (see Next's
// lazy-loading docs). Moving the dynamic() call behind this Client Component
// boundary makes the code-split real. ssr stays true: only the client chunk
// boundary moves, the chart still server-renders on first paint. Fallback
// sits inside a fixed-height CardContent (h-56), so h-full correctly fills
// the already-reserved space.
const PortfolioVisitorsInquiriesChart = dynamic(
  () =>
    import("./portfolio-visitors-inquiries-chart").then(
      (module) => module.PortfolioVisitorsInquiriesChart
    ),
  { ssr: true, loading: () => <Skeleton className="h-full w-full" /> }
);

export function PortfolioVisitorsInquiriesChartClient(props: Props) {
  return <PortfolioVisitorsInquiriesChart {...props} />;
}
