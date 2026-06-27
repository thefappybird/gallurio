import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/lib/i18n/navigation";
import type { BookingDoc } from "@/lib/db/models";
import { formatTime, type TimeMode } from "@/lib/utils/time-format";
import { StatusChip } from "./status-chip";
import { DashboardInfoHint } from "./dashboard-info-hint";
import { PagedList } from "./paged-list";

type Props = {
  bookings: BookingDoc[];
  locale: string;
  title: string;
  empty: string;
  timeMode: TimeMode;
};

export function TodaysEventsList({ bookings, title, empty, timeMode }: Props) {
  return (
    <Card className="h-full rounded-[var(--radius)]">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <DashboardInfoHint hint="todaysEvents" />
      </CardHeader>
      <CardContent>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <PagedList
            items={bookings.map((b) => (
              <li key={String(b._id)} className="flex items-center justify-between gap-3 py-2.5">
                <Link
                  href={`/bookings/${b._id.toString()}`}
                  className="flex flex-1 flex-col min-w-0"
                >
                  <span className="truncate text-sm font-medium">{b.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {(b.sessions as { startAt: Date }[])[0]?.startAt
                      ? formatTime(new Date((b.sessions as { startAt: Date }[])[0].startAt), timeMode)
                      : "—"}
                    {" · "}
                    {b.clientName}
                  </span>
                </Link>
                <StatusChip status={b.status} kind="booking" />
              </li>
            ))}
          />
        )}
      </CardContent>
    </Card>
  );
}
