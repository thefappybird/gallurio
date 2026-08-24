"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { useTranslations } from "next-intl";
import { useIsRtl } from "@/lib/i18n/rtl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { CHART_TOOLTIP } from "@/lib/charts/tooltip";
import { formatMoney } from "@/lib/utils/format-currency";
import type {
  TransactionsByTeam,
  TeamBookingsCount,
} from "../_data/dashboard-metrics";

type Props = {
  revenueByTeam: TransactionsByTeam[];
  bookingsByTeam: TeamBookingsCount[];
  currency: string;
  locale: string;
};

type Row = {
  teamId: string;
  name: string;
  color: string;
  isActive: boolean;
  revenue: number;
  bookings: number;
};

function mergeTeams(
  revenue: TransactionsByTeam[],
  bookings: TeamBookingsCount[]
): Row[] {
  const map = new Map<string, Row>();
  for (const r of revenue) {
    map.set(r.teamId, {
      teamId: r.teamId,
      name: r.name,
      color: r.color,
      isActive: r.isActive,
      revenue: r.total,
      bookings: 0,
    });
  }
  for (const b of bookings) {
    const existing = map.get(b.teamId);
    if (existing) existing.bookings = b.count;
    else
      map.set(b.teamId, {
        teamId: b.teamId,
        name: b.name,
        color: b.color,
        isActive: b.isActive,
        revenue: 0,
        bookings: b.count,
      });
  }
  // Most successful first: revenue, then booking volume.
  return [...map.values()].sort(
    (a, b) => b.revenue - a.revenue || b.bookings - a.bookings
  );
}

export function TeamPerformanceCards({
  revenueByTeam,
  bookingsByTeam,
  currency,
  locale,
}: Props) {
  const reduceMotion = usePrefersReducedMotion();
  const t = useTranslations("app.dashboard");
  const isRtl = useIsRtl();
  const rows = mergeTeams(revenueByTeam, bookingsByTeam);
  if (rows.length === 0) return null;

  const maxRevenue = Math.max(...rows.map((r) => r.revenue), 1);
  const barData = rows.map((r) => ({ name: r.name, bookings: r.bookings, color: r.color }));

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
      <Card className="rounded-[var(--radius)] lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-medium">
            {t("sections.teamPerformance")}
          </CardTitle>
          <InfoHint label={t("hints.teamPerformance")} />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {rows.map((r) => (
            <div key={r.teamId} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: r.color }}
                    aria-hidden
                  />
                  <span
                    className={`truncate font-medium ${
                      r.isActive ? "" : "text-muted-foreground line-through"
                    }`}
                  >
                    {r.name}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3 tabular-nums">
                  <span className="font-semibold">
                    {formatMoney(r.revenue, currency, locale)}
                  </span>
                  <span className="text-muted-foreground">
                    {t("team.bookingsCount", { count: r.bookings })}
                  </span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round((r.revenue / maxRevenue) * 100)}%`,
                    background: r.color,
                  }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-[var(--radius)] lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-medium">
            {t("sections.bookingsPerTeam")}
          </CardTitle>
          <InfoHint label={t("hints.bookingsPerTeam")} />
        </CardHeader>
        <CardContent className="min-h-48 flex-1" style={{ minHeight: barData.length * 28 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={barData}
              layout="vertical"
              margin={{ top: 0, right: isRtl ? 0 : 8, bottom: 0, left: isRtl ? 8 : 0 }}
            >
              <XAxis
                type="number"
                hide
                allowDecimals={false}
                domain={[0, "dataMax"]}
                reversed={isRtl}
              />
              <YAxis
                type="category"
                dataKey="name"
                orientation={isRtl ? "right" : "left"}
                width={72}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip {...CHART_TOOLTIP} />
              <Bar isAnimationActive={!reduceMotion} dataKey="bookings" radius={[0, 2, 2, 0]}>
                {barData.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
