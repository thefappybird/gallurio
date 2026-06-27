import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/lib/i18n/navigation";
import type { InquiryDoc } from "@/lib/db/models";
import { buildInquiryModalPath } from "@/lib/inquiries/links";
import { StatusChip } from "./status-chip";
import { DashboardInfoHint } from "./dashboard-info-hint";

type Props = {
  inquiries: InquiryDoc[];
  locale: string;
  title: string;
  empty: string;
  viewAll: string;
};

export function RecentInquiriesList({ inquiries, locale, title, empty, viewAll }: Props) {
  return (
    <Card className="h-full rounded-[var(--radius)]">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <span className="flex items-center gap-2">
          <Link
            href="/inquiries"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            {viewAll}
          </Link>
          <DashboardInfoHint hint="recentInquiries" />
        </span>
      </CardHeader>
      <CardContent>
        {inquiries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {inquiries.map((q) => (
              <li key={String(q._id)}>
                <Link
                  href={buildInquiryModalPath(String(q._id))}
                  className="flex items-start justify-between gap-2 py-2.5 transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring -mx-2 px-2"
                >
                  <div className="flex flex-1 flex-col min-w-0">
                    <span className="truncate text-sm font-medium">{q.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {new Date(q.createdAt as unknown as Date).toLocaleDateString(locale, {
                        month: "short",
                        day: "numeric",
                      })}
                      {" · "}
                      {q.eventType}
                    </span>
                  </div>
                  <StatusChip status={q.status} kind="inquiry" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
