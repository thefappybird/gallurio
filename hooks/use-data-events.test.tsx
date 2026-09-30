import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { AppQueryProvider } from "@/components/app/app-query-provider";
import { useInvalidateFor } from "./use-data-events";

const refresh = vi.fn();
let pathname = "/fil/bookings/123";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  usePathname: () => pathname,
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppQueryProvider workspaceId="w1">{children}</AppQueryProvider>
);

describe("useInvalidateFor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refresh.mockClear();
    pathname = "/fil/bookings/123";
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

  it("does not refresh when the pathname is unaffected", () => {
    pathname = "/settings";
    const { result } = renderHook(() => useInvalidateFor(), { wrapper });
    act(() => {
      result.current({ type: "booking.updated", bookingId: "b1" });
      vi.advanceTimersByTime(300);
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});
