import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNotificationBurstToast } from "./useNotificationBurstToast";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useNotificationBurstToast", () => {
  it("shows immediately on arrival and keeps a running count while visible", () => {
    const { result, rerender } = renderHook(
      ({ tick }) => useNotificationBurstToast(tick),
      { initialProps: { tick: 0 } },
    );

    expect(result.current.showToast).toBe(false);

    // First arrival shows the cue alongside the bell nudge.
    rerender({ tick: 1 });
    expect(result.current.showToast).toBe(true);
    expect(result.current.count).toBe(1);

    // Two more arrivals land within the window — must NOT reset/extend the timer.
    rerender({ tick: 2 });
    rerender({ tick: 3 });

    expect(result.current.showToast).toBe(true);
    expect(result.current.count).toBe(3);

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.showToast).toBe(false);
  });
});
