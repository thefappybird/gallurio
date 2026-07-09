import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DashboardPendingShell } from "./dashboard-pending-shell";

// DashboardPendingShell's own job is just OR-combining the two children's
// onPendingChange callbacks — their own transition wiring is covered by
// dashboard-date-filter.test.tsx / dashboard-tabs.test.tsx. Stub them here
// with buttons that let the test drive onPendingChange directly.
vi.mock("./dashboard-date-filter", () => ({
  DashboardDateFilter: ({ onPendingChange }: { onPendingChange?: (p: boolean) => void }) => (
    <div>
      <button onClick={() => onPendingChange?.(true)}>date-pending-on</button>
      <button onClick={() => onPendingChange?.(false)}>date-pending-off</button>
    </div>
  ),
}));

vi.mock("./dashboard-tabs", () => ({
  DashboardTabs: ({ onPendingChange }: { onPendingChange?: (p: boolean) => void }) => (
    <div>
      <button onClick={() => onPendingChange?.(true)}>tabs-pending-on</button>
      <button onClick={() => onPendingChange?.(false)}>tabs-pending-off</button>
    </div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function renderShell() {
  return render(
    <DashboardPendingShell
      greeting={<span>Hi</span>}
      today="2026-07-09"
      currentMonth="2026-07"
      currentYear={2026}
      tab="bookings"
    >
      <div>widget content</div>
    </DashboardPendingShell>
  );
}

function childrenWrapper() {
  return screen.getByText("widget content").parentElement as HTMLElement;
}

describe("DashboardPendingShell", () => {
  it("renders children normally, no dim/busy state, when neither child reports pending", () => {
    renderShell();
    const wrapperEl = childrenWrapper();

    expect(wrapperEl).toHaveAttribute("aria-busy", "false");
    expect(wrapperEl.className).not.toContain("opacity-60");
    expect(wrapperEl.className).not.toContain("pointer-events-none");
  });

  it("dims + marks aria-busy when the date filter reports pending", () => {
    renderShell();

    fireEvent.click(screen.getByText("date-pending-on"));

    const wrapperEl = childrenWrapper();
    expect(wrapperEl).toHaveAttribute("aria-busy", "true");
    expect(wrapperEl.className).toContain("opacity-60");
    expect(wrapperEl.className).toContain("pointer-events-none");
  });

  it("dims + marks aria-busy when the tabs component reports pending (OR-combination)", () => {
    renderShell();

    // date-filter stays not-pending; only tabs goes pending.
    fireEvent.click(screen.getByText("tabs-pending-on"));

    const wrapperEl = childrenWrapper();
    expect(wrapperEl).toHaveAttribute("aria-busy", "true");
    expect(wrapperEl.className).toContain("opacity-60");
    expect(wrapperEl.className).toContain("pointer-events-none");

    // Clearing tabs pending (with date-filter still not-pending) clears the dim.
    fireEvent.click(screen.getByText("tabs-pending-off"));
    const wrapperElAfter = childrenWrapper();
    expect(wrapperElAfter).toHaveAttribute("aria-busy", "false");
    expect(wrapperElAfter.className).not.toContain("opacity-60");
  });
});
