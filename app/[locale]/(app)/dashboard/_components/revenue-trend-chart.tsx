"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils/format-currency";
import { CHART_TOOLTIP } from "@/lib/charts/tooltip";
import type { RevenuePoint } from "../_data/dashboard-metrics";
import { DashboardInfoHint } from "./dashboard-info-hint";

type Props = {
  data: RevenuePoint[];
  currency: string;
  locale: string;
  title: string;
};

export function RevenueTrendChart({ data, currency, locale, title }: Props) {
  return (
    <Card className="h-full rounded-[var(--radius)] px-4">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <DashboardInfoHint hint="revenueTrend" />
      </CardHeader>
      <CardContent className="h-48 p-0 pl-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => {
                const date = new Date(d);
                return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
              }}
              interval={Math.floor(data.length / 6)}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickFormatter={(v: number) => {
                if (v === 0) return "0";
                if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
                return v.toString();
              }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              {...CHART_TOOLTIP}
              formatter={(value) => formatMoney(Number(value), currency, locale)}
              labelFormatter={(label) =>
                new Date(String(label)).toLocaleDateString(locale, {
                  month: "long",
                  day: "numeric",
                })
              }
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="var(--chart-1)"
              strokeWidth={1.5}
              fill="url(#revGradient)"
              isAnimationActive={false}
              activeDot={{
                r: 5,
                stroke: "var(--background)",
                strokeWidth: 2,
                fill: "var(--chart-1)",
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
