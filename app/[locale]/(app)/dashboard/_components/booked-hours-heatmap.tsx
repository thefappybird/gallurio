import { Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type BookedHoursCell = { weekStart: string; weekday: number; hours: number };

type Props = {
  cells: BookedHoursCell[];
  locale: string;
  labels: {
    title: string;
    weekOf: string;
    bookedHours: string;
    weekdays: string[]; // length 7, Mon..Sun
    legend: string[]; // length 5: ["0", "1-4", "5-9", "10-14", "15+"]
    empty: string;
  };
};

const BUCKET_PCT = [12, 35, 60, 80, 100];

function bucketIndex(hours: number): number {
  if (hours <= 0) return 0;
  if (hours <= 4) return 1;
  if (hours <= 9) return 2;
  if (hours <= 14) return 3;
  return 4;
}

function formatCol(weekStart: string, locale: string) {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function BookedHoursHeatmap({ cells, locale, labels }: Props) {
  if (cells.length === 0) {
    return (
      <Card className="h-full rounded-[var(--radius)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{labels.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-6 text-center text-sm text-muted-foreground">{labels.empty}</p>
        </CardContent>
      </Card>
    );
  }

  const weekStarts = Array.from(new Set(cells.map((c) => c.weekStart))).sort();
  const byKey = new Map<string, number>();
  for (const c of cells) byKey.set(`${c.weekStart}|${c.weekday}`, c.hours);

  return (
    <Card className="h-full rounded-[var(--radius)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{labels.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="overflow-x-auto" aria-label={labels.bookedHours}>
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `max-content repeat(${weekStarts.length}, minmax(2.25rem, 1fr))`,
            }}
          >
            <div />
            {weekStarts.map((ws) => (
              <div
                key={ws}
                className="pb-1 text-center text-[10px] font-medium text-muted-foreground"
              >
                {formatCol(ws, locale)}
              </div>
            ))}
            {labels.weekdays.map((wd, weekday) => (
              <Fragment key={weekday}>
                <div className="flex items-center pe-2 text-xs text-muted-foreground">{wd}</div>
                {weekStarts.map((ws) => {
                  const hours = byKey.get(`${ws}|${weekday}`) ?? 0;
                  const bucket = bucketIndex(hours);
                  const title = `${labels.weekOf} ${formatCol(ws, locale)}, ${wd}: ${hours}h`;
                  return (
                    <div
                      key={`${ws}-${weekday}`}
                      title={title}
                      aria-label={title}
                      className="aspect-square rounded-[2px]"
                      style={{
                        backgroundColor: `color-mix(in srgb, var(--chart-1) ${BUCKET_PCT[bucket]}%, transparent)`,
                      }}
                    />
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {labels.legend.map((l, i) => (
            <span key={l} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                className="size-2.5 rounded-[2px]"
                style={{
                  backgroundColor: `color-mix(in srgb, var(--chart-1) ${BUCKET_PCT[i]}%, transparent)`,
                }}
                aria-hidden
              />
              {l}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
