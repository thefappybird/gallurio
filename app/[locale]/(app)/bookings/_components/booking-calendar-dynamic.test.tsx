import { describe, expect, it, vi } from "vitest";
import { isValidElement } from "react";
import { BOOKINGS_CALENDAR_FALLBACK, CalendarSkeleton, INQUIRIES_CALENDAR_FALLBACK } from "@/components/app/calendar-skeleton";

type Opts = { ssr?: boolean; loading?: () => unknown };
const captured = vi.hoisted(() => ({ calls: [] as Opts[] }));
vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<unknown>, options: Opts) => {
    void loader;
    captured.calls.push(options);
    return () => null;
  },
}));

import "./booking-calendar-dynamic";

describe("calendar lazy loaders", () => {
  it.each([
    ["BookingCalendarLazy", 0, BOOKINGS_CALENDAR_FALLBACK],
    ["InquiriesCalendarLazy", 1, INQUIRIES_CALENDAR_FALLBACK],
  ])("%s loads client-only with its per-page skeleton fallback", (_n, idx, cls) => {
    const opts = captured.calls[idx];
    expect(opts?.ssr).toBe(false);
    const loading = opts?.loading?.();
    expect(isValidElement(loading) && loading.type === CalendarSkeleton).toBe(true);
    expect((loading as { props: { fallbackClassName?: string } }).props.fallbackClassName).toBe(cls);
  });
});
