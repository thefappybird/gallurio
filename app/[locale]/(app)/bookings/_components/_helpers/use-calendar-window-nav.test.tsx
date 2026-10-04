import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { calendarWindow } from "@/lib/bookings/calendar-window";
import { useCalendarWindowNav } from "./use-calendar-window-nav";

const mockReplace = vi.fn();
let mockSearch = "team=a&showPast=0";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
}));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/bookings",
}));

const TZ = "Asia/Manila";
const w = calendarWindow(new Date("2026-09-15T04:00:00Z"), TZ);
const windowIso = { start: w.start.toISOString(), end: w.end.toISOString() };

beforeEach(() => {
  vi.clearAllMocks();
  mockSearch = "team=a&showPast=0";
});

describe("useCalendarWindowNav", () => {
  it("makes no router call when the visible range stays inside the window", () => {
    const { result } = renderHook(() => useCalendarWindowNav({ window: windowIso, tz: TZ }));
    act(() => result.current.onVisibleChange({ date: new Date(2026, 9, 15, 12), view: "month" }));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("replaces the URL with ?date once, keeping other params, when the range leaves the window", () => {
    const { result } = renderHook(() => useCalendarWindowNav({ window: windowIso, tz: TZ }));
    act(() => result.current.onVisibleChange({ date: new Date(2027, 0, 10, 12), view: "month" }));
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/bookings?team=a&showPast=0&date=2027-01-10", { scroll: false });
    // Same target again while unresolved -> no duplicate request.
    act(() => result.current.onVisibleChange({ date: new Date(2027, 0, 10, 12), view: "month" }));
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it("re-requests a target after the user came back inside the window", () => {
    const { result } = renderHook(() => useCalendarWindowNav({ window: windowIso, tz: TZ }));
    const out = { date: new Date(2027, 0, 10, 12), view: "month" };
    act(() => result.current.onVisibleChange(out));
    act(() => result.current.onVisibleChange({ date: new Date(2026, 8, 15, 12), view: "month" }));
    act(() => result.current.onVisibleChange(out));
    expect(mockReplace).toHaveBeenCalledTimes(2);
  });
});
