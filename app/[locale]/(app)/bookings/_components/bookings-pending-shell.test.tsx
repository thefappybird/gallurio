import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { BookingsPendingShell } from "./bookings-pending-shell";

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

function renderShell() {
  let toolbarSetter: (pending: boolean) => void = () => {};
  render(
    <BookingsPendingShell title={<span>Bookings</span>} view="table">
      {(onToolbarPendingChange) => {
        toolbarSetter = onToolbarPendingChange;
        return <div>widget content</div>;
      }}
    </BookingsPendingShell>
  );
  return {
    setToolbarPending: (p: boolean) => toolbarSetter(p),
  };
}

function childrenWrapper() {
  return screen.getByText("widget content").parentElement as HTMLElement;
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
    const { setToolbarPending } = renderShell();

    // view-toggle stays not-pending; only the toolbar callback goes pending.
    act(() => setToolbarPending(true));

    const wrapperEl = childrenWrapper();
    expect(wrapperEl).toHaveAttribute("aria-busy", "true");
    expect(wrapperEl.className).toContain("opacity-60");
    expect(wrapperEl.className).toContain("pointer-events-none");

    // Clearing toolbar pending (with view-toggle still not-pending) clears the dim.
    act(() => setToolbarPending(false));
    const wrapperElAfter = childrenWrapper();
    expect(wrapperElAfter).toHaveAttribute("aria-busy", "false");
    expect(wrapperElAfter.className).not.toContain("opacity-60");
  });
});
