import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{labels.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-4 pt-0">
        {visitorDays === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{labels.empty}</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">{labels.visitorDays}</span>
              <span className="tabular-nums">{visitorDays}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">{labels.contactOpened}</span>
              <span className="tabular-nums text-muted-foreground">
                {contactTracked
                  ? `${contactVisitorDays} · ${pct(contactVisitorDays, visitorDays)}% ${labels.ofVisitors}`
                  : labels.collectingData}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">{labels.inquirySubmitted}</span>
              <span className="tabular-nums text-muted-foreground">
                {inquiries} · {pct(inquiries, contactVisitorDays)}% {labels.ofOpened} ·{" "}
                {pct(inquiries, visitorDays)}% {labels.ofTotal}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
