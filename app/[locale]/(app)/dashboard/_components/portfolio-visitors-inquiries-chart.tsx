"use client";

import {
  Bar,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { useIsRtl } from "@/lib/i18n/rtl";
import { CHART_TOOLTIP } from "@/lib/charts/tooltip";

export type VisitorInquiryPoint = {
  /** "YYYY-MM-DD" */
  date: string;
  visitors: number;
  inquiries: number;
};

type Props = {
  data: VisitorInquiryPoint[];
  locale: string;
  labels: { visitors: string; inquiries: string; empty: string };
};

export function PortfolioVisitorsInquiriesChart({ data, locale, labels }: Props) {
  const reduceMotion = usePrefersReducedMotion();
  const isRtl = useIsRtl();
  const isEmpty =
    data.length === 0 || data.every((d) => d.visitors === 0 && d.inquiries === 0);

  if (isEmpty) {
    return (
      <div className="flex h-full min-h-48 items-center justify-center text-sm text-muted-foreground">
        {labels.empty}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 12 }}>
        <XAxis
          dataKey="date"
          reversed={isRtl}
          tickFormatter={(d: string) =>
            new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, {
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            })
          }
          interval={data.length > 12 ? Math.floor(data.length / 8) : 0}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
        />
        <YAxis
          yAxisId="visitors"
          orientation={isRtl ? "right" : "left"}
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <YAxis
          yAxisId="inquiries"
          orientation={isRtl ? "left" : "right"}
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip
          {...CHART_TOOLTIP}
          labelFormatter={(d) =>
            new Date(`${String(d)}T00:00:00Z`).toLocaleDateString(locale, {
              month: "long",
              day: "numeric",
              timeZone: "UTC",
            })
          }
        />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
        <Bar isAnimationActive={!reduceMotion}
          yAxisId="inquiries"
          dataKey="inquiries"
          name={labels.inquiries}
          fill="var(--chart-2)"
          radius={[2, 2, 0, 0]}
        />
        <Line isAnimationActive={!reduceMotion}
          yAxisId="visitors"
          type="monotone"
          dataKey="visitors"
          name={labels.visitors}
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
