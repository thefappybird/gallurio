import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/lib/i18n/navigation";
import type { BookingDoc } from "@/lib/db/models";
import { formatTime, type TimeMode } from "@/lib/utils/time-format";

type Props = {
  bookings: BookingDoc[];
  locale: string;
  title: string;
  empty: string;
  timeMode: TimeMode;
};

export function TodaysEventsList({ bookings, title, empty, timeMode }: Props) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {bookings.map((b) => (
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
                <Badge
                  variant={b.status === "booked" ? "default" : "outline"}
                  className={
                    "font-normal capitalize" +
                    (b.status === "booked"
                      ? " bg-brand text-brand-foreground"
                      : "")
                  }
                >
                  {b.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
