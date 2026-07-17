"use client";

import { Line, LineChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsRtl } from "@/lib/i18n/rtl";
import { CHART_TOOLTIP } from "@/lib/charts/tooltip";
import { formatMoney } from "@/lib/utils/format-currency";

export type ValueCollectedPoint = {
  bucket: string; // week-start "YYYY-MM-DD"
  scheduledValue: number;
  collected: number;
};

type Props = {
  data: ValueCollectedPoint[];
  currency: string;
  locale: string;
  labels: {
    title?: string;
    bookedValue: string;
    collectedRevenue: string;
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

export function BookingValueCollectionChart({ data, currency, locale, labels }: Props) {
  const isRtl = useIsRtl();
  const header = labels.title ? (
    <CardHeader className="pb-3">
      <CardTitle className="text-sm font-medium">{labels.title}</CardTitle>
    </CardHeader>
  ) : null;

  const isEmpty =
    data.length === 0 || data.every((d) => d.scheduledValue === 0 && d.collected === 0);

  if (isEmpty) {
    return (
      <Card className="h-full rounded-[var(--radius)]">
        {header}
        <CardContent>
          <p className="py-12 text-center text-sm text-muted-foreground">{labels.empty}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full rounded-[var(--radius)]">
      {header}
      <CardContent className="h-64 p-0 pl-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
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
              width={40}
            />
            <Tooltip
              {...CHART_TOOLTIP}
              formatter={(value) => formatMoney(Number(value), currency, locale)}
              labelFormatter={(label) => formatWeek(String(label), locale)}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />
            <Line
              type="monotone"
              dataKey="scheduledValue"
              name={labels.bookedValue}
              stroke="var(--chart-1)"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="collected"
              name={labels.collectedRevenue}
              stroke="var(--chart-2)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
