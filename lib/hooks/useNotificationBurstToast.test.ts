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
  it("bundles a burst of arrivals within the 5s window into one toast with the total count, without resetting the timer", () => {
    const { result, rerender } = renderHook(
      ({ tick }) => useNotificationBurstToast(tick),
      { initialProps: { tick: 0 } },
    );

    expect(result.current.showToast).toBe(false);

    // First arrival arms the 5s timer.
    rerender({ tick: 1 });
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Two more arrivals land within the window — must NOT reset/extend the timer.
    rerender({ tick: 2 });
    rerender({ tick: 3 });

    expect(result.current.showToast).toBe(false);

    act(() => {
      vi.advanceTimersByTime(3000); // total elapsed since first arrival: 5000ms
    });

    expect(result.current.showToast).toBe(true);
    expect(result.current.count).toBe(3);
  });
});
