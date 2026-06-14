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
import type { KpiSnapshot } from "../_data/dashboard-metrics";

type Trend = { value: number; positiveIsGood: boolean };

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
  // Mock trends — real comparison-to-last-period wiring is a follow-up.
  trends?: {
    revenue?: Trend;
    activeBookings?: Trend;
    newInquiries?: Trend;
    outstandingBalance?: Trend;
  };
};

function TrendBadge({ trend }: { trend?: Trend }) {
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
  trend?: Trend;
}) {
  return (
    <Card className="border-border">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <span className="flex size-9 items-center justify-center border border-brand/30 bg-brand-4 text-brand">
            <Icon className="size-4" />
          </span>
          <TrendBadge trend={trend} />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <span className="text-2xl font-semibold tracking-tight">{value}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function KpiStrip({ snapshot, currency, locale, labels, trends }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiCard
        label={labels.revenueThisMonth}
        value={formatMoney(snapshot.revenueThisMonth, currency, locale)}
        icon={WalletIcon}
        trend={trends?.revenue}
      />
      <KpiCard
        label={labels.activeBookings}
        value={snapshot.activeBookingsThisMonth.toString()}
        icon={CalendarCheck2Icon}
        trend={trends?.activeBookings}
      />
      <KpiCard
        label={labels.newInquiries}
        value={snapshot.newInquiries.toString()}
        icon={MessageSquareIcon}
        trend={trends?.newInquiries}
      />
      <KpiCard
        label={labels.outstandingBalance}
        value={formatMoney(snapshot.outstandingBalance, currency, locale)}
        icon={CircleDollarSignIcon}
        trend={trends?.outstandingBalance}
      />
    </div>
  );
}
