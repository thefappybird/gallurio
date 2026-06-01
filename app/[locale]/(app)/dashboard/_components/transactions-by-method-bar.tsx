"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils/format-currency";
import type { TransactionsByMethod } from "../_data/dashboard-metrics";

type Props = {
  data: TransactionsByMethod[];
  currency: string;
  locale: string;
  title: string;
  empty: string;
};

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
];

function labelForMethod(m: string) {
  if (m === "paddle") return "Paddle";
  return m.charAt(0).toUpperCase() + m.slice(1);
}

export function TransactionsByMethodBar({ data, currency, locale, title, empty }: Props) {
  const rows = data.map((d) => ({ name: labelForMethod(d.method), total: d.total }));
  const total = data.reduce((s, d) => s + d.total, 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 p-4 pt-0">
        {total === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          <>
            <span className="text-2xl font-semibold tracking-tight">
              {formatMoney(total, currency, locale)}
            </span>
            <div className="h-32 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickFormatter={(v: number) =>
                      Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : v.toString()
                    }
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", fillOpacity: 0.4 }}
                    wrapperStyle={{ zIndex: 50, outline: "none" }}
                    contentStyle={{
                      background: "var(--popover)",
                      color: "var(--popover-foreground)",
                      border: "1px solid var(--border)",
                      borderRadius: 0,
                      fontSize: 12,
                    }}
                    formatter={(value) => formatMoney(Number(value), currency, locale)}
                  />
                  <Bar
                    dataKey="total"
                    radius={0}
                    isAnimationActive
                    animationDuration={300}
                    animationEasing="ease-out"
                    activeBar={{
                      stroke: "var(--foreground)",
                      strokeWidth: 1,
                      fillOpacity: 0.85,
                      style: {
                        transform: "scaleY(1.05) translateY(-2px)",
                        transformOrigin: "bottom",
                        transition: "transform 200ms ease-out",
                      },
                    }}
                  >
                    {rows.map((r, i) => (
                      <Cell key={r.name} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
