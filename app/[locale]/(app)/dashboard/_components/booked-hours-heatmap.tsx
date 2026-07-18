"use client";

import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { DashboardInfoHint } from "./dashboard-info-hint";

export type BookedHoursCell = { weekStart: string; weekday: number; hours: number };

type Labels = {
  title: string;
  weekOf: string;
  bookedHours: string;
  weekdays: string[];
  legend: string[];
  empty: string;
  previous: string;
  today: string;
  next: string;
};

type Props = {
  cells: BookedHoursCell[];
  earliestWeek: string;
  latestWeek: string;
  todayWeek: string;
  todayWeekday: number;
  locale: string;
  labels: Labels;
};

const BUCKET_PCT = [12, 35, 60, 80, 100];
const PREFERRED_CELL_SIZE = 28;
const MIN_CELL_SIZE = 18;
const CELL_GAP = 4;
const WEEKDAY_COLUMN_WIDTH = 48;
const DEFAULT_VISIBLE_WEEKS = 20;
const MIN_PREFERRED_WEEKS = 12;

function bucketIndex(hours: number): number {
  if (hours <= 0) return 0;
  if (hours <= 4) return 1;
  if (hours <= 9) return 2;
  if (hours <= 14) return 3;
  return 4;
}

function formatCol(weekStart: string, locale: string) {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString(locale, {
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  });
}

function shiftWeek(weekStart: string, weeks: number) {
  const date = new Date(`${weekStart}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

export function BookedHoursHeatmap({ cells, earliestWeek, latestWeek, todayWeek, todayWeekday, locale, labels }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const allWeekStarts = Array.from(new Set(cells.map((c) => c.weekStart))).sort();
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);
  useEffect(() => {
    const element = gridRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setGridWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const usableWidth = Math.max(0, gridWidth - WEEKDAY_COLUMN_WIDTH);
  const atPreferredSize = Math.floor((usableWidth + CELL_GAP) / (PREFERRED_CELL_SIZE + CELL_GAP));
  const atMinimumSize = Math.max(1, Math.floor((usableWidth + CELL_GAP) / (MIN_CELL_SIZE + CELL_GAP)));
  // Keep cells at their preferred size whenever a useful baseline window
  // fits. Only then shrink cells, and finally reduce columns, on narrow cards.
  const responsiveWeekCount =
    atPreferredSize >= MIN_PREFERRED_WEEKS ? atPreferredSize : atMinimumSize;
  const visibleCount = Math.min(
    allWeekStarts.length,
    gridWidth === 0 ? DEFAULT_VISIBLE_WEEKS : responsiveWeekCount
  );
  const weekStarts = allWeekStarts.slice(-visibleCount);
  const lastVisibleWeek = weekStarts.at(-1);
  const cellSize = Math.min(
    PREFERRED_CELL_SIZE,
    Math.max(MIN_CELL_SIZE, (usableWidth - Math.max(0, visibleCount - 1) * CELL_GAP) / visibleCount)
  );
  const hasPrevious = Boolean(weekStarts[0] && weekStarts[0] > earliestWeek);
  const hasNext = Boolean(lastVisibleWeek && lastVisibleWeek < latestWeek);
  // A numeric date needs roughly 34 px to remain legible. If cells become
  // tighter, retain clear labels at regular intervals instead of letting them overlap.
  const labelEvery = Math.max(1, Math.ceil(34 / (cellSize + CELL_GAP)));
  const byKey = new Map(cells.map((cell) => [`${cell.weekStart}|${cell.weekday}`, cell.hours]));

  function goTo(endWeek?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (endWeek) params.set("hm", endWeek);
    else params.delete("hm");
    const query = params.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
  }

  return (
    <Card className="h-full rounded-[var(--radius)]">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <span className="flex items-center gap-1.5"><CardTitle className="text-sm font-medium">{labels.title}</CardTitle><DashboardInfoHint hint="bookedHoursHeatmap" /></span>
        <HeatmapControls
          labels={labels}
          disabled={isPending}
          previous={hasPrevious}
          next={hasNext}
          onGo={goTo}
          firstWeek={weekStarts[0]}
          lastWeek={lastVisibleWeek}
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {cells.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{labels.empty}</p>
        ) : (
          <div className="overflow-x-auto" aria-label={labels.bookedHours}>
            <div
              ref={gridRef}
              className="grid w-full gap-1"
              style={{
                gridTemplateColumns: `max-content repeat(${weekStarts.length}, ${cellSize}px)`,
                justifyContent: "space-between",
              }}
            >
              <div />
              {weekStarts.map((ws, index) => (
                <div
                  key={ws}
                  className={`pb-1 text-center text-[9px] font-medium whitespace-nowrap ${
                    ws === todayWeek ? "text-brand" : "text-muted-foreground"
                  }`}
                >
                  {index % labelEvery === 0 || ws === todayWeek ? formatCol(ws, locale) : ""}
                </div>
              ))}
              {labels.weekdays.map((wd, weekday) => (
                <Fragment key={weekday}>
                  <div className="flex items-center pe-2 text-xs text-muted-foreground">{wd}</div>
                  {weekStarts.map((ws) => {
                    const hours = byKey.get(`${ws}|${weekday}`) ?? 0;
                    const title = `${labels.weekOf} ${formatCol(ws, locale)}, ${wd}: ${hours}h`;
                    const isToday = ws === todayWeek && weekday === todayWeekday;
                    return (
                      <div
                        key={`${ws}-${weekday}`}
                        title={title}
                        aria-label={title}
                        className={`aspect-square rounded-[2px] ${
                          isToday ? "ring-1 ring-brand/80 ring-offset-1 ring-offset-card" : ""
                        }`}
                        style={{
                          backgroundColor: `color-mix(in srgb, var(--chart-1) ${BUCKET_PCT[bucketIndex(hours)]}%, transparent)`,
                        }}
                      />
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {labels.legend.map((label, i) => (
            <span key={label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                className="size-2.5 rounded-[2px]"
                style={{ backgroundColor: `color-mix(in srgb, var(--chart-1) ${BUCKET_PCT[i]}%, transparent)` }}
                aria-hidden
              />
              {label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function HeatmapControls({ labels, disabled, previous, next, onGo, firstWeek, lastWeek }: {
  labels: Pick<Labels, "previous" | "today" | "next">;
  disabled: boolean;
  previous: boolean;
  next: boolean;
  onGo: (endWeek?: string) => void;
  firstWeek?: string;
  lastWeek?: string;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <Button type="button" variant="ghost" size="icon-xs" disabled={disabled || !previous} onClick={() => firstWeek && onGo(shiftWeek(firstWeek, -1))} aria-label={labels.previous}>
        <ChevronLeftIcon className="size-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="xs" disabled={disabled || !next} onClick={() => onGo()}>
        {labels.today}
      </Button>
      <Button type="button" variant="ghost" size="icon-xs" disabled={disabled || !next} onClick={() => lastWeek && onGo(shiftWeek(lastWeek, visiblePageSize(firstWeek, lastWeek)))} aria-label={labels.next}>
        <ChevronRightIcon className="size-3.5" />
      </Button>
    </div>
  );
}

function visiblePageSize(firstWeek?: string, lastWeek?: string) {
  if (!firstWeek || !lastWeek) return 1;
  const start = new Date(`${firstWeek}T00:00:00Z`).getTime();
  const end = new Date(`${lastWeek}T00:00:00Z`).getTime();
  return Math.round((end - start) / 604_800_000) + 1;
}
