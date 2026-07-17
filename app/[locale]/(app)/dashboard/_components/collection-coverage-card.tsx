import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils/format-currency";

export type CollectionCoverage = {
  confirmedValue: number;
  collected: number;
  remaining: number;
  coveragePct: number;
};

type Props = {
  coverage: CollectionCoverage;
  currency: string;
  locale: string;
  labels: {
    title: string;
    asOf?: string;
    confirmedValue: string;
    confirmedHint: string;
    paid: string;
    paidHint: string;
    remaining: string;
    remainingHint: string;
    coverage: string; // template, must contain a "{pct}" token
    empty: string;
  };
};

function formatTemplate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match
  );
}

export function CollectionCoverageCard({ coverage, currency, locale, labels }: Props) {
  const header = (
    <CardHeader className="flex flex-row items-center justify-between pb-3">
      <CardTitle className="text-sm font-medium">{labels.title}</CardTitle>
      {labels.asOf ? (
        <span className="text-xs text-muted-foreground">
          {labels.asOf}{" "}
          {new Date().toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })}
        </span>
      ) : null}
    </CardHeader>
  );

  if (coverage.confirmedValue === 0) {
    return (
      <Card className="h-full rounded-[var(--radius)]">
        {header}
        <CardContent>
          <p className="py-6 text-center text-sm text-muted-foreground">{labels.empty}</p>
        </CardContent>
      </Card>
    );
  }
  const pct = Math.max(0, Math.min(100, Math.round(coverage.coveragePct)));
  return (
    <Card className="h-full rounded-[var(--radius)]">
      {header}
      <CardContent className="flex flex-col gap-4">
        <dl className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <div className="min-w-0">
              <dt className="text-sm font-medium">{labels.confirmedValue}</dt>
              <dd className="text-xs text-muted-foreground">{labels.confirmedHint}</dd>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {formatMoney(coverage.confirmedValue, currency, locale)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <div className="min-w-0">
              <dt className="text-sm font-medium">{labels.paid}</dt>
              <dd className="text-xs text-muted-foreground">{labels.paidHint}</dd>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {formatMoney(coverage.collected, currency, locale)}{" "}
              <span className="text-muted-foreground">({pct}%)</span>
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <div className="min-w-0">
              <dt className="text-sm font-medium">{labels.remaining}</dt>
              <dd className="text-xs text-muted-foreground">{labels.remainingHint}</dd>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {formatMoney(coverage.remaining, currency, locale)}{" "}
              <span className="text-muted-foreground">({100 - pct}%)</span>
            </span>
          </div>
        </dl>
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={labels.coverage}
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">{formatTemplate(labels.coverage, { pct })}</p>
      </CardContent>
    </Card>
  );
}
