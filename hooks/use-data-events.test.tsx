import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { AppQueryProvider } from "@/components/app/app-query-provider";
import { isLocalEcho } from "@/lib/query/invalidation";
import { useInvalidateFor } from "./use-data-events";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppQueryProvider workspaceId="w1">{children}</AppQueryProvider>
);

describe("useInvalidateFor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refresh.mockClear();
    window.history.pushState({}, "", "/fil/bookings/123");
  });
  afterEach(() => vi.useRealTimers());

  it("coalesces refreshes within 250ms into one", () => {
    const { result } = renderHook(() => useInvalidateFor(), { wrapper });
    act(() => {
      result.current({ type: "booking.updated", bookingId: "b1" });
      vi.advanceTimersByTime(100);
      result.current({ type: "booking.updated", bookingId: "b2" });
      vi.advanceTimersByTime(300);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("skips router.refresh but still marks local when refresh:false", () => {
    const { result } = renderHook(() => useInvalidateFor(), { wrapper });
    act(() => {
      result.current({ type: "booking.updated", bookingId: "b7" }, { refresh: false });
      vi.advanceTimersByTime(300);
    });
    expect(refresh).not.toHaveBeenCalled();
    expect(isLocalEcho({ type: "booking.updated", bookingId: "b7" })).toBe(true);
  });

  it("does not refresh when the pathname is unaffected", () => {
    window.history.pushState({}, "", "/settings");
    const { result } = renderHook(() => useInvalidateFor(), { wrapper });
    act(() => {
      result.current({ type: "booking.updated", bookingId: "b1" });
      vi.advanceTimersByTime(300);
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});
