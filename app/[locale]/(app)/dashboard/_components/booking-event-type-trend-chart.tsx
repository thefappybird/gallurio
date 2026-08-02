"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsRtl } from "@/lib/i18n/rtl";
import { CHART_TOOLTIP } from "@/lib/charts/tooltip";
import { formatMoney } from "@/lib/utils/format-currency";
import { DashboardInfoHint } from "./dashboard-info-hint";

export type EventTypeValueTrend = {
  eventTypes: string[];
  points: { bucket: string; values: Record<string, number> }[];
};

type Props = {
  trend: EventTypeValueTrend;
  currency: string;
  locale: string;
  labels: {
    title?: string;
    eventTypes: Record<string, string>;
    empty: string;
  };
};

function formatWeek(bucket: string, locale: string) {
  return new Date(`${bucket}T00:00:00Z`).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function BookingEventTypeTrendChart({ trend, currency, locale, labels }: Props) {
  const isRtl = useIsRtl();
  const header = labels.title ? (
    <CardHeader className="flex flex-row items-center gap-1.5 pb-3">
      <CardTitle className="text-sm font-medium">{labels.title}</CardTitle><DashboardInfoHint hint="eventTypeTrend" />
    </CardHeader>
  ) : null;

  if (trend.points.length === 0 || trend.eventTypes.length === 0) {
    return (
      <Card className="h-full rounded-[var(--radius)]">
        {header}
        <CardContent>
          <p className="py-12 text-center text-sm text-muted-foreground">{labels.empty}</p>
        </CardContent>
      </Card>
    );
  }

  const data = trend.points.map((p) => {
    const row: Record<string, number | string> = { bucket: p.bucket };
    for (const type of trend.eventTypes) row[type] = p.values[type] ?? 0;
    return row;
  });

  return (
    <Card className="h-full rounded-[var(--radius)]">
      {header}
      <CardContent className="flex flex-col justify-center h-full gap-3">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: isRtl ? 0 : 12, bottom: 0, left: isRtl ? 12 : 0 }}
            >
              <XAxis
                dataKey="bucket"
                reversed={isRtl}
                tickFormatter={(d: string) => formatWeek(d, locale)}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
              />
              <YAxis
                orientation={isRtl ? "right" : "left"}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickFormatter={(v: number) =>
                  new Intl.NumberFormat(locale, {
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(v)
                }
                axisLine={false}
                tickLine={false}
                // Self-sizing: compact numerals are far wider in some locales
                // ("800 ألف" vs "800K") and a fixed width clips them.
                width="auto"
              />
              <Tooltip
                {...CHART_TOOLTIP}
                formatter={(value, name) => [
                  formatMoney(Number(value), currency, locale),
                  labels.eventTypes[String(name)] ?? String(name),
                ]}
                labelFormatter={(label) => formatWeek(String(label), locale)}
              />
              {trend.eventTypes.map((type, i) => (
                <Bar
                  key={type}
                  dataKey={type}
                  name={labels.eventTypes[type] ?? type}
                  stackId="v"
                  fill={`var(--chart-${(i % 8) + 1})`}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
          {trend.eventTypes.map((type, i) => (
            <li key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="size-2.5 rounded-full"
                style={{ background: `var(--chart-${(i % 8) + 1})` }}
                aria-hidden
              />
              {labels.eventTypes[type] ?? type}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
