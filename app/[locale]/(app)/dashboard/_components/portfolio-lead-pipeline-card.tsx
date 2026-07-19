import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardInfoHint } from "./dashboard-info-hint";

export type InquiryPipeline = {
  total: number;
  newCount: number;
  booked: number;
  archived: number;
};

type Props = {
  pipeline: InquiryPipeline;
  locale: string;
  labels: {
    title: string;
    new: string;
    booked: string;
    archived: string;
    total: string;
    empty: string;
  };
};

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

const COLORS = { newCount: "var(--chart-1)", booked: "var(--chart-2)", archived: "var(--chart-3)" } as const;

export function PortfolioLeadPipelineCard({ pipeline, locale, labels }: Props) {
  const { total, newCount, booked, archived } = pipeline;
  const stages = [
    { key: "newCount" as const, label: labels.new, count: newCount },
    { key: "booked" as const, label: labels.booked, count: booked },
    { key: "archived" as const, label: labels.archived, count: archived },
  ];

  return (
    <Card className="h-full rounded-[var(--radius)]">
      <CardHeader className="flex flex-row items-center gap-1.5 pb-3">
        <CardTitle className="text-sm font-medium">{labels.title}</CardTitle><DashboardInfoHint hint="portfolioPipeline" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-4 pt-0">
        {total === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{labels.empty}</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {stages.map((s) => {
                const share = pct(s.count, total);
                return (
                  <div key={s.key} className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                    <span className="text-2xl font-semibold tabular-nums">{s.count}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{share}%</span>
                    <div className="h-1.5 w-full rounded-[var(--radius)] bg-muted">
                      <div
                        className="h-full rounded-[var(--radius)]"
                        style={{ width: `${Math.max(2, share)}%`, backgroundColor: COLORS[s.key] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
              <span className="font-medium">{labels.total}</span>
              <span className="tabular-nums">{total.toLocaleString(locale)}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
