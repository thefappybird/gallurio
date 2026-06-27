"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { CHART_TOOLTIP } from "@/lib/charts/tooltip";
import type { EventTypeBreakdown } from "../_data/dashboard-metrics";

type ActiveSectorProps = {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  fill: string;
};

const GROW_PX = 8;
const GROW_MS = 280;

function ActiveSector(props: unknown) {
  const p = props as ActiveSectorProps;
  const [grow, setGrow] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / GROW_MS, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setGrow(eased * GROW_PX);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <Sector
      cx={p.cx}
      cy={p.cy}
      innerRadius={p.innerRadius}
      outerRadius={p.outerRadius + grow}
      startAngle={p.startAngle}
      endAngle={p.endAngle}
      fill={p.fill}
    />
  );
}

type Props = {
  data: EventTypeBreakdown[];
  title: string;
  empty: string;
};

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function EventTypeDonut({ data, title, empty }: Props) {
  const t = useTranslations("app.dashboard");
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const slices = data.map((d, i) => ({
    name: capitalize(d.eventType),
    value: d.count,
    fill: PALETTE[i % PALETTE.length],
  }));

  return (
    <Card className="h-full rounded-[var(--radius)]">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <InfoHint label={t("hints.eventTypes")} />
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {total === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          // Legend sits beside the pie so the card height matches its neighbors.
          <div className="flex flex-col items-center gap-10 sm:flex-row sm:justify-center px-10">
            <div className="relative h-48 w-48 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="62%"
                    outerRadius="92%"
                    paddingAngle={1}
                    isAnimationActive
                    animationDuration={350}
                    animationEasing="ease-out"
                    activeShape={ActiveSector}
                    stroke="var(--background)"
                    strokeWidth={2}
                  >
                    {slices.map((s) => (
                      <Cell key={s.name} fill={s.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    {...CHART_TOOLTIP}
                    cursor={false}
                    formatter={(value, name) => [
                      `${value} · ${total > 0 ? Math.round((Number(value) / total) * 100) : 0}%`,
                      String(name ?? ""),
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
                <span className="text-2xl font-semibold leading-none tracking-tight">
                  {total}
                </span>
                <span className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("totalLabel")}
                </span>
              </div>
            </div>
            <ul className="flex w-full min-w-0 flex-1 flex-col gap-1.5">
              {slices.slice(0, 6).map((s) => {
                const pct = ((s.value / total) * 100).toFixed(0);
                return (
                  <li key={s.name} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: s.fill }}
                        aria-hidden
                      />
                      <span className="truncate">{s.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {s.value} · {pct}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
