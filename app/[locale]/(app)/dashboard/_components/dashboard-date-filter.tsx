"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateFilterMode } from "@/lib/dashboard/date-range";

type Props = {
  /** Workspace-local current day / month / year — picker defaults + future cap. */
  today: string; // YYYY-MM-DD
  currentMonth: string; // YYYY-MM
  currentYear: number;
  /** Notifies the parent when a filter-change navigation is pending, so it can
   *  reflect the wait (e.g. dim the widget area below). */
  onPendingChange?: (pending: boolean) => void;
};

type Mode = DateFilterMode;

const MODE_KEYS: Mode[] = ["day", "month", "year", "custom", "all"];

export function DashboardDateFilter({ today, currentMonth, currentYear, onPendingChange }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const t = useTranslations("app.dashboard.dateFilter");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    onPendingChange?.(isPending);
  }, [isPending, onPendingChange]);

  const [open, setOpen] = useState(false);

  // Active filter from the URL (defaults to the current month when absent).
  const activeMode = (sp.get("df") as Mode | null) ?? "month";

  // Draft state seeded from the URL or the current period.
  const [mode, setMode] = useState<Mode>(activeMode);
  const [day, setDay] = useState(sp.get("d") || today);
  const [month, setMonth] = useState(sp.get("m") || currentMonth);
  const [year, setYear] = useState(Number(sp.get("y")) || currentYear);
  const [from, setFrom] = useState(sp.get("from") || "");
  const [to, setTo] = useState(sp.get("to") || today);

  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  function apply() {
    const params = new URLSearchParams(sp.toString());
    for (const k of ["df", "d", "m", "y", "from", "to"]) params.delete(k);
    if (mode === "day") {
      params.set("df", "day");
      params.set("d", day);
    } else if (mode === "month") {
      params.set("df", "month");
      params.set("m", month);
    } else if (mode === "year") {
      params.set("df", "year");
      params.set("y", String(year));
    } else if (mode === "custom") {
      params.set("df", "custom");
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    } else {
      params.set("df", "all");
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
    setOpen(false);
  }

  function clear() {
    // Back to the default view (current month) by dropping all filter params.
    const params = new URLSearchParams(sp.toString());
    for (const k of ["df", "d", "m", "y", "from", "to"]) params.delete(k);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
    setMode("month");
    setOpen(false);
  }

  // Custom range is invalid until both ends exist and from <= to.
  const customInvalid = mode === "custom" && (!from || !to || from > to);

  const inputClass =
    "h-9 w-full rounded-[var(--radius)] border border-border bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="flex items-center gap-2">
      <span className="truncate text-sm text-muted-foreground max-w-[45vw] sm:max-w-none">
        {formatActiveLabel(sp, locale, currentMonth, t)}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius)] border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring">
          <CalendarIcon className="size-4" />
          {t("filter")}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 flex flex-col gap-3">
          {/* Mode buttons */}
          <div className="grid grid-cols-3 gap-1" role="tablist" aria-label={t("label")}>
            {MODE_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={mode === k}
                onClick={() => setMode(k)}
                className={`h-8 rounded-[var(--radius)] px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                  mode === k
                    ? "bg-brand text-brand-foreground"
                    : "border border-border bg-background text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                }`}
              >
                {t(k)}
              </button>
            ))}
          </div>

          {/* Per-mode picker */}
          {mode === "day" && (
            <input
              type="date"
              aria-label={t("day")}
              value={day}
              max={today}
              onChange={(e) => setDay(e.target.value)}
              className={inputClass}
            />
          )}
          {mode === "month" && (
            <input
              type="month"
              aria-label={t("month")}
              value={month}
              max={currentMonth}
              onChange={(e) => setMonth(e.target.value)}
              className={inputClass}
            />
          )}
          {mode === "year" && (
            <select
              aria-label={t("year")}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className={inputClass}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          )}
          {mode === "custom" && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>{t("from")}</span>
                <span>{t("to")}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  aria-label={t("from")}
                  value={from}
                  max={to || today}
                  onChange={(e) => setFrom(e.target.value)}
                  className={inputClass}
                />
                <input
                  type="date"
                  aria-label={t("to")}
                  value={to}
                  min={from || undefined}
                  max={today}
                  onChange={(e) => setTo(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          )}
          {mode === "all" && (
            <p className="text-xs text-muted-foreground">{t("allTimeHint")}</p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={clear}
              disabled={isPending}
              className="h-8 rounded-[var(--radius)] px-3 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-accent/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {t("clear")}
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={customInvalid || isPending}
              className="h-8 rounded-[var(--radius)] bg-brand px-4 text-xs font-medium text-brand-foreground outline-none transition-colors hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {t("apply")}
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Human label for the currently-applied filter (shown beside the trigger). */
function formatActiveLabel(
  sp: URLSearchParams,
  locale: string,
  currentMonth: string,
  t: ReturnType<typeof useTranslations>
): string {
  const df = sp.get("df") ?? "month";
  const dayFmt = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const monthFmt = (m: string) =>
    new Date(`${m}-01T00:00:00`).toLocaleDateString(locale, {
      month: "long",
      year: "numeric",
    });

  if (df === "all") return t("all");
  if (df === "day") return dayFmt(sp.get("d") || "");
  if (df === "year") return sp.get("y") || "";
  if (df === "custom") {
    const from = sp.get("from");
    const to = sp.get("to");
    if (from && to) return `${dayFmt(from)} – ${dayFmt(to)}`;
    if (from) return `${t("since")} ${dayFmt(from)}`;
    if (to) return `${t("until")} ${dayFmt(to)}`;
    return t("custom");
  }
  // month (explicit or default)
  return monthFmt(sp.get("m") || currentMonth);
}
