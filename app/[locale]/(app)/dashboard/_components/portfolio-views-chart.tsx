"use client";

import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_TOOLTIP } from "@/lib/charts/tooltip";
import type { PageviewPoint } from "../_data/portfolio-analytics";

type Props = {
  data: PageviewPoint[];
  locale: string;
  labels: { views: string; visitors: string };
};

export function PortfolioViewsChart({ data, locale, labels }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barGap={2}>
        <XAxis
          dataKey="date"
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
        <Bar dataKey="views" name={labels.views} fill="var(--chart-1)" radius={[2, 2, 0, 0]} />
        <Bar dataKey="visitors" name={labels.visitors} fill="var(--chart-2)" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
