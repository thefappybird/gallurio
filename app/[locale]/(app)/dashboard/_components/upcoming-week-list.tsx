import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/lib/i18n/navigation";
import type { BookingDoc } from "@/lib/db/models";

type Props = {
  bookings: BookingDoc[];
  locale: string;
  title: string;
  empty: string;
  viewAll: string;
};

export function UpcomingWeekList({ bookings, locale, title, empty, viewAll }: Props) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Link
          href="/bookings"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          {viewAll}
        </Link>
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
                    {b.firstSessionStart
                      ? new Date(b.firstSessionStart).toLocaleDateString(locale, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                    {" · "}
                    {b.clientName}
                  </span>
                </Link>
                <Badge variant="outline" className="font-normal">
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
