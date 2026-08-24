import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardInfoHint } from "./dashboard-info-hint";

export type ContactFunnel = {
  visitorDays: number;
  contactVisitorDays: number;
  inquiries: number;
  contactTracked: boolean;
};

type Props = {
  funnel: ContactFunnel;
  locale: string;
  labels: {
    title: string;
    visitorDays: string;
    contactOpened: string;
    inquirySubmitted: string;
    ofVisitors: string;
    ofOpened: string;
    ofTotal: string;
    collectingData: string;
    empty: string;
  };
};

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

export function PortfolioConversionFunnelCard({ funnel, labels }: Props) {
  const { visitorDays, contactVisitorDays, inquiries, contactTracked } = funnel;
  return (
    <Card className="h-full rounded-[var(--radius)]">
      <CardHeader className="flex flex-row items-center gap-1.5 pb-3">
        <CardTitle className="text-sm font-medium">{labels.title}</CardTitle><DashboardInfoHint hint="portfolioFunnel" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-4 pt-0">
        {visitorDays === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{labels.empty}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {[
              {
                label: labels.visitorDays,
                value: <span className="tabular-nums">{visitorDays}</span>,
                width: 100,
              },
              {
                label: labels.contactOpened,
                value: (
                  <span className="tabular-nums text-muted-foreground">
                    {contactTracked
                      ? `${contactVisitorDays} · ${pct(contactVisitorDays, visitorDays)}% ${labels.ofVisitors}`
                      : labels.collectingData}
                  </span>
                ),
                width: contactTracked ? pct(contactVisitorDays, visitorDays) : 0,
              },
              {
                label: labels.inquirySubmitted,
                value: (
                  <span className="tabular-nums text-muted-foreground">
                    {inquiries} ·{" "}
                    {contactTracked
                      ? `${Math.min(100, pct(inquiries, contactVisitorDays))}% ${labels.ofOpened} · `
                      : ""}
                    {Math.min(100, pct(inquiries, visitorDays))}% {labels.ofTotal}
                  </span>
                ),
                width: Math.min(100, pct(inquiries, visitorDays)),
              },
            ].map((stage, index) => (
              <div key={stage.label} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{stage.label}</span>
                  {stage.value}
                </div>
                {/* The stage bars are what make this read as a funnel rather
                    than three unrelated rows, and they give the card enough
                    body to sit beside the visitors chart without its content
                    being stretched apart to fill the height. */}
                <div className="h-1.5 w-full bg-muted">
                  <div
                    data-testid="funnel-bar"
                    className={
                      index === 0 ? "h-full bg-brand" : index === 1 ? "h-full bg-brand/70" : "h-full bg-brand/40"
                    }
                    style={{ width: `${stage.width}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
