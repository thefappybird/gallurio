import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardInfoHint } from "./dashboard-info-hint";

export type DemandProfile = {
  eventTypeMix: { eventType: string; count: number }[];
  requestedMonths: { month: string; count: number }[];
  /** null when there is no completed lead-time data yet */
  medianLeadTimeDays: number | null;
};

type Props = {
  profile: DemandProfile;
  locale: string;
  labels: {
    title: string;
    eventTypeMix: string;
    requestedMonth: string;
    medianLeadTime: string;
    days: string;
    basedOn: string;
    empty: string;
    eventTypes: Record<string, string>;
  };
};

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

function formatMonth(month: string, locale: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString(locale, {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

export function PortfolioDemandProfileCard({ profile, locale, labels }: Props) {
  const { eventTypeMix, requestedMonths, medianLeadTimeDays } = profile;
  const isEmpty = eventTypeMix.length === 0 && requestedMonths.length === 0;
  const eventTotal = eventTypeMix.reduce((sum, e) => sum + e.count, 0);

  return (
    <Card className="h-full rounded-[var(--radius)]">
      <CardHeader className="flex flex-row items-center gap-1.5 pb-3">
        <CardTitle className="text-sm font-medium">{labels.title}</CardTitle><DashboardInfoHint hint="portfolioDemand" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-4 pt-0">
        {isEmpty ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{labels.empty}</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {labels.eventTypeMix}
              </span>
              <ul className="flex flex-col gap-2">
                {eventTypeMix.map((e) => (
                  <li key={e.eventType} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">{labels.eventTypes[e.eventType] ?? e.eventType}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {e.count} · {pct(e.count, eventTotal)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {labels.requestedMonth}
              </span>
              <ul className="flex items-end gap-1.5">
                {requestedMonths.map((m) => (
                  <li key={m.month} className="flex flex-1 flex-col items-center gap-1 text-[10px]">
                    <span className="tabular-nums">{m.count}</span>
                    <span className="text-muted-foreground">{formatMonth(m.month, locale)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {!isEmpty && (
          <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
            <span className="font-medium">{labels.medianLeadTime}</span>
            <span className="tabular-nums text-muted-foreground">
              {medianLeadTimeDays === null
                ? "—"
                : `${medianLeadTimeDays} ${labels.days}${
                    eventTotal > 0 ? ` · ${labels.basedOn} ${eventTotal}` : ""
                  }`}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
