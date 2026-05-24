"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WeeklyBookingsPoint } from "../_data/dashboard-metrics";

type Props = {
  data: WeeklyBookingsPoint[];
  title: string;
};

export function WeeklyBookingsBar({ data, title }: Props) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                width={28}
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
              />
              <Bar
                dataKey="count"
                fill="var(--chart-1)"
                radius={0}
                isAnimationActive
                animationDuration={300}
                animationEasing="ease-out"
                activeBar={{
                  fill: "var(--brand)",
                  stroke: "var(--foreground)",
                  strokeWidth: 1,
                  style: {
                    transform: "scaleY(1.05) translateY(-2px)",
                    transformOrigin: "bottom",
                    transition: "transform 200ms ease-out",
                  },
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
