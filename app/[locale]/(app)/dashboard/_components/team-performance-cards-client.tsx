"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { TeamPerformanceCards as TeamPerformanceCardsComponent } from "./team-performance-cards";
import { ChartLoadingFallback } from "./chart-loading-fallback";

type Props = ComponentProps<typeof TeamPerformanceCardsComponent>;

// Server Components can't code-split a dynamic() import of a Client
// Component -- the chunk still ships in the initial bundle (see Next's
// lazy-loading docs). Moving the dynamic() call behind this Client Component
// boundary makes the code-split real. ssr stays true: only the client chunk
// boundary moves, the cards still server-render on first paint.
const TeamPerformanceCards = dynamic(
  () => import("./team-performance-cards").then((module) => module.TeamPerformanceCards),
  {
    ssr: true,
    loading: () => (
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <ChartLoadingFallback className="rounded-[var(--radius)] lg:col-span-2" />
        <ChartLoadingFallback className="rounded-[var(--radius)] lg:col-span-2" />
      </div>
    ),
  }
);

export function TeamPerformanceCardsClient(props: Props) {
  return <TeamPerformanceCards {...props} />;
}
