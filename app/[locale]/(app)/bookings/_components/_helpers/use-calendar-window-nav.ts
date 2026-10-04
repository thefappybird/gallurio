"use client";

import { useCallback, useEffect, useMemo, useRef, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { isRangeInsideWindow, visibleGridRange } from "@/lib/bookings/calendar-window";

export type CalendarVisible = { date: Date; view: string };

function localYmd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The server only loads candles inside a padded window around `?date`. When
 * navigation shows days outside it, `router.replace` the same URL with a new
 * `?date` inside a transition: the old props (events) stay rendered until the
 * fresh ones land, and `isPending` lets the caller dim them. Inside the window
 * nothing is requested. Also re-checks when the window prop changes (e.g. a
 * wizard closing dropped `?date`) so the grid can never sit on unloaded days.
 */
export function useCalendarWindowNav({
  window: win,
  tz,
}: {
  /** Absent = no windowing (everything is loaded); navigation never refetches. */
  window?: { start: string; end: string };
  tz: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const winStart = win?.start;
  const winEnd = win?.end;
  const bounds = useMemo(
    () => (winStart && winEnd ? { start: new Date(winStart), end: new Date(winEnd) } : null),
    [winStart, winEnd]
  );
  const visibleRef = useRef<CalendarVisible | null>(null);
  // Guards against re-requesting the same target for the same window.
  const requestedRef = useRef<string | null>(null);
  const searchRef = useRef(searchParams);
  useEffect(() => {
    searchRef.current = searchParams;
  });

  const ensureWindow = useCallback(
    (visible: CalendarVisible) => {
      if (!bounds) return;
      const range = visibleGridRange(visible.date, visible.view, tz);
      if (isRangeInsideWindow(range, bounds)) {
        requestedRef.current = null;
        return;
      }
      const date = localYmd(visible.date);
      const key = `${date}|${winStart}`;
      if (requestedRef.current === key) return;
      requestedRef.current = key;
      const params = new URLSearchParams(searchRef.current.toString());
      params.set("date", date);
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [tz, bounds, winStart, router, pathname]
  );

  const onVisibleChange = useCallback(
    (visible: CalendarVisible) => {
      visibleRef.current = visible;
      ensureWindow(visible);
    },
    [ensureWindow]
  );

  // Window changed underneath the current view (URL edited elsewhere).
  useEffect(() => {
    if (visibleRef.current) ensureWindow(visibleRef.current);
  }, [ensureWindow]);

  return { onVisibleChange, isPending };
}
