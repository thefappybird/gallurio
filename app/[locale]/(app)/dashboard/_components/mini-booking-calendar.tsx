"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CalendarDayCount } from "../_data/dashboard-metrics";
import type { BookingTeamOption } from "../../bookings/_data/team-options";
import { DashboardInfoHint } from "./dashboard-info-hint";

type Props = {
  month: Date;
  /** Server-rendered first-paint counts for the initial month (all teams). */
  days: CalendarDayCount[];
  locale: string;
  title: string;
  /** Teams the owner can filter by; empty/1 hides the selector. */
  teams: BookingTeamOption[];
};

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function MiniBookingCalendar({
  month: initialMonth,
  days: initialDays,
  locale,
  title,
  teams,
}: Props) {
  const t = useTranslations("app.dashboard");
  const [month, setMonth] = useState<Date>(
    new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1)
  );
  const [days, setDays] = useState<CalendarDayCount[]>(initialDays);
  const [loading, setLoading] = useState(false);
  // "" = all teams (the server first-paint).
  const [teamId, setTeamId] = useState("");

  const initialKey = `${initialMonth.getFullYear()}-${initialMonth.getMonth()}`;
  const monthKey = `${month.getFullYear()}-${month.getMonth()}`;
  const isInitial = monthKey === initialKey;

  useEffect(() => {
    let cancelled = false;
    // The server first-paint covers only the initial month with all teams.
    const useServerPaint = isInitial && teamId === "";
    const days0 = initialDays;
    const year = month.getFullYear();
    const mon = month.getMonth();
    Promise.resolve().then(() => {
      if (cancelled) return;
      if (useServerPaint) {
        setDays(days0);
        return;
      }
      setLoading(true);
      const teamParam = teamId ? `&team=${encodeURIComponent(teamId)}` : "";
      fetch(`/api/bookings/by-day?year=${year}&month=${mon}${teamParam}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((rows: CalendarDayCount[]) => {
          if (cancelled) return;
          setDays(rows ?? []);
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [monthKey, isInitial, initialDays, month, teamId]);

  const counts = new Map(days.map((d) => [d.date, d.count]));
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const startWeekday = monthStart.getDay();
  const totalDays = monthEnd.getDate();
  const today = isoDate(new Date());

  const cells: Array<{
    key: string;
    iso: string | null;
    day: number | null;
    count: number;
  }> = [];
  for (let i = 0; i < startWeekday; i += 1) {
    cells.push({ key: `pad-${i}`, iso: null, day: null, count: 0 });
  }
  for (let d = 1; d <= totalDays; d += 1) {
    const date = new Date(month.getFullYear(), month.getMonth(), d);
    const iso = isoDate(date);
    cells.push({ key: iso, iso, day: d, count: counts.get(iso) ?? 0 });
  }

  const weekdayLabels = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(2024, 5, 2 + i); // 2024-06-02 was a Sunday
    return d.toLocaleDateString(locale, { weekday: "narrow" });
  });

  const totalBookings = days.reduce((s, d) => s + d.count, 0);

  function shiftMonth(delta: number) {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  function goToToday() {
    const now = new Date();
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  return (
    <Card className="h-full rounded-[var(--radius)]">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <span className="flex items-center gap-1.5">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <DashboardInfoHint hint="calendar" />
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => shiftMonth(-1)}
            disabled={loading}
            aria-label="Previous month"
          >
            <ChevronLeftIcon className="size-3.5" />
          </Button>
          <button
            type="button"
            onClick={goToToday}
            disabled={loading}
            className="min-w-20 text-center text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Jump to current month"
          >
            {month.toLocaleDateString(locale, { month: "short", year: "numeric" })}
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => shiftMonth(1)}
            disabled={loading}
            aria-label="Next month"
          >
            <ChevronRightIcon className="size-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {teams.length > 1 && (
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            disabled={loading}
            aria-label={t("calendarTeam.label")}
            className="mb-2 h-8 w-full rounded-[var(--radius)] border border-border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">{t("calendarTeam.all")}</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        )}
        <div
          className={`grid grid-cols-7 gap-px bg-border transition-opacity ${loading ? "opacity-60" : "opacity-100"}`}
        >
          {weekdayLabels.map((label, i) => (
            <div
              key={`wk-${i}`}
              className="bg-card py-0.5 text-center text-[9px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              {label}
            </div>
          ))}
          {cells.map((cell) => {
            if (!cell.iso) {
              return <div key={cell.key} className="bg-card h-8" />;
            }
            const isToday = cell.iso === today;
            const hasBookings = cell.count > 0;
            const content = (
              <div
                className={`group/cell relative flex h-full w-full items-center justify-center transition-colors ${
                  isToday
                    ? "bg-brand font-semibold text-brand-foreground hover:bg-foreground hover:text-background"
                    : hasBookings
                      ? "bg-brand-4 text-brand hover:bg-foreground hover:text-background"
                      : "bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className="text-[11px] leading-none">{cell.day}</span>
                {hasBookings ? (
                  <span
                    className={`absolute end-0.5 top-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center px-0.5 text-[8px] font-semibold leading-none transition-colors ${
                      isToday
                        ? "bg-brand-foreground text-brand"
                        : "bg-brand text-brand-foreground group-hover/cell:bg-background group-hover/cell:text-foreground"
                    }`}
                    aria-label={`${cell.count} ${cell.count === 1 ? "booking" : "bookings"}`}
                  >
                    {cell.count > 9 ? "9+" : cell.count}
                  </span>
                ) : null}
              </div>
            );
            return (
              <div key={cell.key} className="h-8">
                {hasBookings ? (
                  <Link
                    href={`/bookings?view=calendar&date=${cell.iso}`}
                    className="block h-full w-full"
                  >
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 bg-brand" aria-hidden /> {t("miniCalendar.today")}
          </span>
          <span>{t("miniCalendar.monthTotal", { count: totalBookings })}</span>
        </div>
      </CardContent>
    </Card>
  );
}
