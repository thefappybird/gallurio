import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { BookingsTable, type BookingRow } from "./bookings-table";

// ---------------------------------------------------------------------------
// Partial mock of @tanstack/react-table used only by the render-stability
// describe block below.  We keep the REAL useReactTable running so the table
// renders normally; we just intercept the `data` argument on each call.
//
// `capturedData` is declared via vi.hoisted so it exists before the vi.mock
// factory is executed (vi.mock is hoisted to the top of the compiled output).
// ---------------------------------------------------------------------------
const capturedData = vi.hoisted<unknown[]>(() => []);

vi.mock("@tanstack/react-table", async (importActual) => {
  const actual = await importActual<typeof import("@tanstack/react-table")>();
  return {
    ...actual,
    useReactTable: (opts: Parameters<typeof actual.useReactTable>[0]) => {
      capturedData.push(opts.data);
      return actual.useReactTable(opts);
    },
  };
});

const TEST_TZ = "UTC";

/** Returns a date ISO string relative to today by `offsetDays`. */
function relativeDate(offsetDays: number, hour = 10): string {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

const futureRow: BookingRow = {
  id: "1",
  title: "Carter Wedding",
  clientName: "Emma Carter",
  sessions: [
    { startAt: relativeDate(5), endAt: relativeDate(5, 18) },
  ],
  lastSessionEnd: relativeDate(5, 18),
  status: "booked",
  total: 75_000,
  currency: "PHP",
};

const pastRow: BookingRow = {
  id: "2",
  title: "Old Completed Shoot",
  clientName: "Priya Shah",
  sessions: [
    { startAt: relativeDate(-10), endAt: relativeDate(-10, 17) },
  ],
  lastSessionEnd: relativeDate(-10, 17),
  status: "completed",
  total: 25_000,
  currency: "PHP",
};

const cancelledRow: BookingRow = {
  id: "3",
  title: "Old Cancelled Event",
  clientName: "Sam Green",
  sessions: [
    { startAt: relativeDate(-3), endAt: relativeDate(-3, 17) },
  ],
  lastSessionEnd: relativeDate(-3, 17),
  status: "cancelled",
  total: 10_000,
  currency: "PHP",
};

/** A booking where one session is past and one is future (partially past). */
const partiallyPastRow: BookingRow = {
  id: "4",
  title: "Ongoing Multi-Day",
  clientName: "Lee Kim",
  sessions: [
    { startAt: relativeDate(-2), endAt: relativeDate(-2, 17) },
    { startAt: relativeDate(3), endAt: relativeDate(3, 17) },
  ],
  // lastSessionEnd is future → NOT fully past
  lastSessionEnd: relativeDate(3, 17),
  status: "booked",
  total: 50_000,
  currency: "PHP",
};

describe("BookingsTable", () => {
  it("renders rows with title, client, and money column", () => {
    renderWithProviders(
      <BookingsTable rows={[futureRow]} locale="en" empty="No rows" workspaceTimezone={TEST_TZ} />
    );
    expect(screen.getByText("Carter Wedding")).toBeInTheDocument();
    expect(screen.getByText("Emma Carter")).toBeInTheDocument();
    expect(screen.getByText(/75,000/)).toBeInTheDocument();
  });

  it("renders empty state when rows is empty", () => {
    renderWithProviders(<BookingsTable rows={[]} locale="en" empty="No rows" workspaceTimezone={TEST_TZ} />);
    expect(screen.getByText("No rows")).toBeInTheDocument();
  });

  it("applies line-through styling to the title cell of cancelled rows", () => {
    const { container } = renderWithProviders(
      <BookingsTable
        rows={[cancelledRow]}
        locale="en"
        empty="No rows"
        showPast
        workspaceTimezone={TEST_TZ}
      />
    );
    const cells = container.querySelectorAll("td");
    const cancelledTitleCell = Array.from(cells).find(
      (c) => c.textContent?.trim() === "Old Cancelled Event"
    );
    expect(cancelledTitleCell?.className).toMatch(/line-through/);
  });

  // ── Past-booking filter (default: OFF) ───────────────────────────────────────

  it("hides fully-past rows when showPast is false (default)", () => {
    renderWithProviders(
      <BookingsTable
        rows={[futureRow, pastRow]}
        locale="en"
        empty="No rows"
        workspaceTimezone={TEST_TZ}
      />
    );
    expect(screen.getByText("Carter Wedding")).toBeInTheDocument();
    expect(screen.queryByText("Old Completed Shoot")).not.toBeInTheDocument();
  });

  it("shows fully-past rows when showPast is true", () => {
    renderWithProviders(
      <BookingsTable
        rows={[futureRow, pastRow]}
        locale="en"
        empty="No rows"
        showPast
        workspaceTimezone={TEST_TZ}
      />
    );
    expect(screen.getByText("Carter Wedding")).toBeInTheDocument();
    expect(screen.getByText("Old Completed Shoot")).toBeInTheDocument();
  });

  it("shows empty state when all rows are past and showPast is false", () => {
    renderWithProviders(
      <BookingsTable
        rows={[pastRow]}
        locale="en"
        empty="No bookings"
        showPast={false}
        workspaceTimezone={TEST_TZ}
      />
    );
    expect(screen.getByText("No bookings")).toBeInTheDocument();
  });

  // ── Past pill ────────────────────────────────────────────────────────────────

  it("shows 'Past' pill for fully-past rows when showPast is true", () => {
    renderWithProviders(
      <BookingsTable rows={[pastRow]} locale="en" empty="No rows" showPast workspaceTimezone={TEST_TZ} />
    );
    // The pill text comes from the i18n key app.bookings.table.past
    expect(screen.getByText(/past/i)).toBeInTheDocument();
  });

  it("does NOT show 'Past' pill for future rows", () => {
    renderWithProviders(
      <BookingsTable rows={[futureRow]} locale="en" empty="No rows" showPast workspaceTimezone={TEST_TZ} />
    );
    // There must be no element with text "Past" in the table rows
    const pastPills = screen.queryAllByText(/^past$/i);
    expect(pastPills).toHaveLength(0);
  });

  // ── opacity-60 on past rows ──────────────────────────────────────────────────

  it("applies opacity-60 to fully-past rows", () => {
    const { container } = renderWithProviders(
      <BookingsTable rows={[pastRow]} locale="en" empty="No rows" showPast workspaceTimezone={TEST_TZ} />
    );
    const rows = container.querySelectorAll("tbody tr");
    expect(rows[0]?.className).toMatch(/opacity-60/);
  });

  it("does NOT apply opacity-60 to future rows", () => {
    const { container } = renderWithProviders(
      <BookingsTable rows={[futureRow]} locale="en" empty="No rows" showPast workspaceTimezone={TEST_TZ} />
    );
    const rows = container.querySelectorAll("tbody tr");
    expect(rows[0]?.className).not.toMatch(/opacity-60/);
  });

  // ── Partially-past bookings — must NOT be treated as past ────────────────────

  it("does NOT hide a partially-past booking (last session in future)", () => {
    renderWithProviders(
      <BookingsTable
        rows={[partiallyPastRow]}
        locale="en"
        empty="No rows"
        showPast={false}
        workspaceTimezone={TEST_TZ}
      />
    );
    expect(screen.getByText("Ongoing Multi-Day")).toBeInTheDocument();
  });

  it("does NOT apply opacity-60 to a partially-past booking", () => {
    const { container } = renderWithProviders(
      <BookingsTable
        rows={[partiallyPastRow]}
        locale="en"
        empty="No rows"
        showPast={false}
        workspaceTimezone={TEST_TZ}
      />
    );
    const rows = container.querySelectorAll("tbody tr");
    expect(rows[0]?.className).not.toMatch(/opacity-60/);
  });

  it("does NOT show 'Past' pill for a partially-past booking", () => {
    renderWithProviders(
      <BookingsTable
        rows={[partiallyPastRow]}
        locale="en"
        empty="No rows"
        showPast
        workspaceTimezone={TEST_TZ}
      />
    );
    const pastPills = screen.queryAllByText(/^past$/i);
    expect(pastPills).toHaveLength(0);
  });

  // ── workspaceTimezone prop ───────────────────────────────────────────────────

  it("accepts Asia/Manila as workspaceTimezone without crashing", () => {
    renderWithProviders(
      <BookingsTable
        rows={[futureRow, pastRow]}
        locale="en"
        empty="No rows"
        showPast
        workspaceTimezone="Asia/Manila"
      />
    );
    // Both rows visible when showPast is true
    expect(screen.getByText("Carter Wedding")).toBeInTheDocument();
    expect(screen.getByText("Old Completed Shoot")).toBeInTheDocument();
  });

  it("defaults to UTC when workspaceTimezone is omitted", () => {
    // Should not throw and should still correctly filter past rows
    renderWithProviders(
      <BookingsTable
        rows={[futureRow, pastRow]}
        locale="en"
        empty="No rows"
      />
    );
    expect(screen.getByText("Carter Wedding")).toBeInTheDocument();
    expect(screen.queryByText("Old Completed Shoot")).not.toBeInTheDocument();
  });

  // ── Status pill: translated label + status color ─────────────────────────────

  it("renders a status pill with the translated label and its status color", () => {
    renderWithProviders(
      <BookingsTable rows={[futureRow]} locale="en" empty="No rows" workspaceTimezone={TEST_TZ} />
    );
    // statusValues.booked → "Booked"
    const pill = screen.getByText("Booked");
    expect(pill).toBeInTheDocument();
    // Solid fill keyed off the shared status-color var (matches the calendar candle).
    expect(pill.getAttribute("style")).toContain("--event-booked");
  });

  // ── Total cell alignment (Task 7): cell is left-aligned to match the header ──

  it("does NOT right-align the Total cell value", () => {
    renderWithProviders(
      <BookingsTable rows={[futureRow]} locale="en" empty="No rows" workspaceTimezone={TEST_TZ} />
    );
    const totalValue = screen.getByText(/75,000/);
    expect(totalValue.className).not.toMatch(/text-right/);
    expect(totalValue.className).toMatch(/tabular-nums/);
  });
});

// ---------------------------------------------------------------------------
// Regression: infinite re-render loop caused by `visibleRows` being a fresh
// array reference every render.  The fix is the `useMemo` wrapping
// `visibleRows` in bookings-table.tsx.  This suite FAILS if that memo is
// removed because `.filter()` returns a new array on every call, causing
// TanStack's internal state update → re-render → another filter → ...
// ---------------------------------------------------------------------------
describe("render stability (regression: infinite re-render loop)", () => {
  beforeEach(() => {
    // Reset the capture array before each test in this suite so tests are
    // isolated even though the array lives at module scope.
    capturedData.length = 0;
  });

  it("passes the same `data` reference to useReactTable across re-renders triggered by sort toggle", () => {
    // futureRow is the only row that survives the showPast=false filter, so
    // the `.filter()` path is exercised (not the `rows` shortcut for showPast=true).
    renderWithProviders(
      <BookingsTable
        rows={[futureRow, pastRow]}
        locale="en"
        empty="No rows"
        showPast={false}
        workspaceTimezone={TEST_TZ}
      />
    );

    // Sanity: table rendered — at least the initial call captured data.
    expect(capturedData.length).toBeGreaterThanOrEqual(1);
    const firstDataRef = capturedData[0];

    // Click the "Date" column header to toggle sorting — this changes the
    // internal `sorting` state and causes a re-render without touching
    // `rows`, `showPast`, or `workspaceTimezone`.
    const dateHeader = screen.getByText(/date/i);
    fireEvent.click(dateHeader);

    // After the re-render at least one more call must have been captured.
    expect(capturedData.length).toBeGreaterThanOrEqual(2);

    // Every `data` reference captured must be the identical object: the
    // memoized `visibleRows` array.  A fresh `.filter()` on each render
    // would produce a different reference, making this assertion fail.
    for (const ref of capturedData) {
      expect(ref).toBe(firstDataRef);
    }
  });

  it("renders only non-past rows when showPast is false — memoization did not change filtering behaviour", () => {
    renderWithProviders(
      <BookingsTable
        rows={[futureRow, pastRow]}
        locale="en"
        empty="No rows"
        showPast={false}
        workspaceTimezone={TEST_TZ}
      />
    );

    // futureRow must be visible; pastRow must be hidden.
    expect(screen.getByText("Carter Wedding")).toBeInTheDocument();
    expect(screen.queryByText("Old Completed Shoot")).not.toBeInTheDocument();

    // Only the one surviving row should be in the table body.
    const rows = document.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(1);
  });
});
