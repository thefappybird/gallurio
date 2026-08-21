import { Card, CardContent } from "@/components/ui/card";
import {
  WalletIcon,
  CalendarCheck2Icon,
  MessageSquareIcon,
  CircleDollarSignIcon,
  ArrowUpRightIcon,
  ArrowDownRightIcon,
  MinusIcon,
  type LucideIcon,
} from "lucide-react";
import { formatMoney } from "@/lib/utils/format-currency";
import type { KpiSnapshot, KpiTrend, KpiTrends } from "../_data/dashboard-metrics";
import { DashboardInfoHint } from "./dashboard-info-hint";

type Props = {
  snapshot: KpiSnapshot;
  currency: string;
  locale: string;
  labels: {
    revenueThisMonth: string;
    activeBookings: string;
    newInquiries: string;
    outstandingBalance: string;
  };
  // Real period-over-period deltas; a metric is null when there's no prior
  // baseline (badge hidden) or when it's a point-in-time snapshot.
  trends: KpiTrends;
};

function TrendBadge({ trend }: { trend: KpiTrend }) {
  if (!trend) return null;
  const isFlat = Math.abs(trend.value) < 0.5;
  const Icon = isFlat ? MinusIcon : trend.value > 0 ? ArrowUpRightIcon : ArrowDownRightIcon;
  const goodDirection = trend.value > 0 === trend.positiveIsGood;
  const tone = isFlat
    ? "text-muted-foreground"
    : goodDirection
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-destructive";
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${tone}`}>
      <Icon className="size-3" />
      {Math.abs(trend.value).toFixed(1)}%
    </span>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  trend: KpiTrend;
}) {
  // Compact: icon on the left, label + trend on row 1, value on row 2. Two
  // cards share a 375px row, which leaves ~100px of text column — too little
  // for both the icon and a six-figure amount, so the icon only appears once
  // there is room for it. The label wraps rather than truncating: a KPI whose
  // label reads "OUTSTANDING BALA…" is not a KPI.
  return (
    <Card className="rounded-[var(--radius)] border-border">
      <CardContent className="flex items-center gap-3 px-3 py-2">
        <span className="hidden size-11 shrink-0 items-center justify-center rounded-[var(--radius)] border border-brand/30 bg-brand-4 text-brand sm:flex">
          <Icon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-start gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span className="min-w-0 flex-1 leading-tight">{label}</span>
            <span className="flex shrink-0 items-center gap-1.5">
              <DashboardInfoHint hint="kpi" />
              <TrendBadge trend={trend} />
            </span>
          </span>
          <span className="text-lg font-semibold tracking-tight tabular-nums lg:text-xl">
            {value}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function KpiStrip({ snapshot, currency, locale, labels, trends }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        label={labels.revenueThisMonth}
        value={formatMoney(snapshot.revenueThisMonth, currency, locale)}
        icon={WalletIcon}
        trend={trends.revenue}
      />
      <KpiCard
        label={labels.activeBookings}
        value={snapshot.activeBookingsThisMonth.toString()}
        icon={CalendarCheck2Icon}
        trend={trends.activeBookings}
      />
      <KpiCard
        label={labels.newInquiries}
        value={snapshot.newInquiries.toString()}
        icon={MessageSquareIcon}
        trend={trends.newInquiries}
      />
      <KpiCard
        label={labels.outstandingBalance}
        value={formatMoney(snapshot.outstandingBalance, currency, locale)}
        icon={CircleDollarSignIcon}
        trend={trends.outstandingBalance}
      />
    </div>
  );
}
