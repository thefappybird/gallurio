import { describe, expect, it, vi } from "vitest";
import { isValidElement } from "react";
import { CalendarSkeleton } from "@/components/app/calendar-skeleton";

const captured = vi.hoisted(() => ({} as { loader?: () => Promise<unknown>; options?: { ssr?: boolean; loading?: () => unknown } }));
vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<unknown>, options: { ssr?: boolean; loading?: () => unknown }) => {
    captured.loader = loader;
    captured.options = options;
    return () => null;
  },
}));

import "./booking-calendar-dynamic";

describe("BookingCalendarLazy", () => {
  it("loads react-big-calendar client-only with the calendar skeleton as loading state", () => {
    expect(captured.options?.ssr).toBe(false);
    const loading = captured.options?.loading?.();
    expect(isValidElement(loading) && loading.type === CalendarSkeleton).toBe(true);
  });
});
