import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { clearDirtyRoutes, markRoutesDirty } from "@/lib/query/dirty-routes";
import { HistoryRefreshGuard } from "./history-refresh-guard";

const refresh = vi.fn();
let pathname = "/settings";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  usePathname: () => pathname,
}));

function go(next: string, viaHistory: boolean, view: ReturnType<typeof render>) {
  window.history.pushState({}, "", next);
  pathname = next;
  act(() => {
    if (viaHistory) window.dispatchEvent(new PopStateEvent("popstate"));
    vi.runAllTimers();
  });
  view.rerender(<HistoryRefreshGuard />);
}

describe("HistoryRefreshGuard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refresh.mockClear();
    clearDirtyRoutes();
    pathname = "/settings";
    window.history.pushState({}, "", "/settings");
  });

  it("refreshes once when Back lands on a dirty route", () => {
    const view = render(<HistoryRefreshGuard />);
    markRoutesDirty(["/bookings"], "/settings", false);
    go("/bookings", true, view);
    expect(refresh).toHaveBeenCalledTimes(1);
    go("/settings", true, view);
    go("/bookings", true, view);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("requests the refresh from the popstate tick, before the pathname re-renders", () => {
    render(<HistoryRefreshGuard />);
    markRoutesDirty(["/bookings"], "/settings", false);
    window.history.pushState({}, "", "/bookings");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(refresh).not.toHaveBeenCalled(); // deferred past Next's handler
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(refresh).toHaveBeenCalledTimes(1); // no pathname re-render happened
  });

  it("does nothing for a normal push navigation (the router already fetches fresh data)", () => {
    const view = render(<HistoryRefreshGuard />);
    markRoutesDirty(["/bookings"], "/settings", false);
    go("/bookings", false, view);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does nothing when the history route is clean", () => {
    const view = render(<HistoryRefreshGuard />);
    go("/clients", true, view);
    expect(refresh).not.toHaveBeenCalled();
  });
});
