import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { BookingsPendingShell, useBookingsToolbarPending } from "./bookings-pending-shell";

// BookingsPendingShell's own job is just OR-combining the view-toggle's
// pending state with the exposed toolbar-pending setter — ViewToggle's own
// transition wiring is covered by view-toggle.test.tsx. Stub it here with a
// button that lets the test drive onPendingChange directly.
vi.mock("./view-toggle", () => ({
  ViewToggle: ({ onPendingChange }: { onPendingChange?: (p: boolean) => void }) => (
    <div>
      <button onClick={() => onPendingChange?.(true)}>view-pending-on</button>
      <button onClick={() => onPendingChange?.(false)}>view-pending-off</button>
    </div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function ToolbarPendingTestHarness() {
  const setToolbarPending = useBookingsToolbarPending();
  return (
    <div>
      <button onClick={() => setToolbarPending(true)}>toolbar-pending-on</button>
      <button onClick={() => setToolbarPending(false)}>toolbar-pending-off</button>
      <div>widget content</div>
    </div>
  );
}

function renderShell() {
  render(
    <BookingsPendingShell title={<span>Bookings</span>} view="table">
      <ToolbarPendingTestHarness />
    </BookingsPendingShell>
  );
}

function childrenWrapper() {
  return screen.getByText("widget content").closest("[aria-busy]") as HTMLElement;
}

describe("BookingsPendingShell", () => {
  it("renders children normally, no dim/busy state, when nothing reports pending", () => {
    renderShell();
    const wrapperEl = childrenWrapper();

    expect(wrapperEl).toHaveAttribute("aria-busy", "false");
    expect(wrapperEl.className).not.toContain("opacity-60");
    expect(wrapperEl.className).not.toContain("pointer-events-none");
  });

  it("dims + marks aria-busy when the view-toggle reports pending", () => {
    renderShell();

    fireEvent.click(screen.getByText("view-pending-on"));

    const wrapperEl = childrenWrapper();
    expect(wrapperEl).toHaveAttribute("aria-busy", "true");
    expect(wrapperEl.className).toContain("opacity-60");
    expect(wrapperEl.className).toContain("pointer-events-none");
  });

  it("dims + marks aria-busy when the exposed toolbar-pending callback is invoked with true (OR-combination)", () => {
    renderShell();

    // view-toggle stays not-pending; only the toolbar callback goes pending.
    act(() => fireEvent.click(screen.getByText("toolbar-pending-on")));

    const wrapperEl = childrenWrapper();
    expect(wrapperEl).toHaveAttribute("aria-busy", "true");
    expect(wrapperEl.className).toContain("opacity-60");
    expect(wrapperEl.className).toContain("pointer-events-none");

    // Clearing toolbar pending (with view-toggle still not-pending) clears the dim.
    act(() => fireEvent.click(screen.getByText("toolbar-pending-off")));
    const wrapperElAfter = childrenWrapper();
    expect(wrapperElAfter).toHaveAttribute("aria-busy", "false");
    expect(wrapperElAfter.className).not.toContain("opacity-60");
  });
});
