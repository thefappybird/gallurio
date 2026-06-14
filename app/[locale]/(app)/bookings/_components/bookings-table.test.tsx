import { describe, expect, it } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { BookingsTable, type BookingRow } from "./bookings-table";

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
        workspaceTimezone={TEST_TZ}
      />
    );
    const cells = container.querySelectorAll("td");
    const cancelledTitleCell = Array.from(cells).find(
      (c) => c.textContent?.trim() === "Old Cancelled Event"
    );
    expect(cancelledTitleCell?.className).toMatch(/line-through/);
  });

  // ── Past-booking filter (server-side) ───────────────────────────────────────
  // Rows are now pre-filtered server-side by listBookings (includePast filter).
  // The table component renders whatever rows it receives — no client-side
  // filtering — so these tests verify render stability, not filtering logic.

  it("renders all rows it receives (server is responsible for pre-filtering past rows)", () => {
    // Simulates server passing only future rows when showPast=false.
    renderWithProviders(
      <BookingsTable
        rows={[futureRow]}
        locale="en"
        empty="No rows"
        workspaceTimezone={TEST_TZ}
      />
    );
    expect(screen.getByText("Carter Wedding")).toBeInTheDocument();
  });

  it("renders past rows when the server passes them (showPast=true on server)", () => {
    renderWithProviders(
      <BookingsTable
        rows={[futureRow, pastRow]}
        locale="en"
        empty="No rows"
        workspaceTimezone={TEST_TZ}
      />
    );
    expect(screen.getByText("Carter Wedding")).toBeInTheDocument();
    expect(screen.getByText("Old Completed Shoot")).toBeInTheDocument();
  });

  it("shows empty state when rows array is empty (server filtered everything out)", () => {
    renderWithProviders(
      <BookingsTable
        rows={[]}
        locale="en"
        empty="No bookings"
        workspaceTimezone={TEST_TZ}
      />
    );
    expect(screen.getByText("No bookings")).toBeInTheDocument();
  });

  // ── Past pill ────────────────────────────────────────────────────────────────

  it("shows 'Past' pill for fully-past rows", () => {
    renderWithProviders(
      <BookingsTable rows={[pastRow]} locale="en" empty="No rows" workspaceTimezone={TEST_TZ} />
    );
    // The pill text comes from the i18n key app.bookings.table.past
    expect(screen.getByText(/past/i)).toBeInTheDocument();
  });

  it("does NOT show 'Past' pill for future rows", () => {
    renderWithProviders(
      <BookingsTable rows={[futureRow]} locale="en" empty="No rows" workspaceTimezone={TEST_TZ} />
    );
    // There must be no element with text "Past" in the table rows
    const pastPills = screen.queryAllByText(/^past$/i);
    expect(pastPills).toHaveLength(0);
  });

  // ── opacity-60 on past rows ──────────────────────────────────────────────────

  it("applies opacity-60 to fully-past rows", () => {
    const { container } = renderWithProviders(
      <BookingsTable rows={[pastRow]} locale="en" empty="No rows" workspaceTimezone={TEST_TZ} />
    );
    const rows = container.querySelectorAll("tbody tr");
    expect(rows[0]?.className).toMatch(/opacity-60/);
  });

  it("does NOT apply opacity-60 to future rows", () => {
    const { container } = renderWithProviders(
      <BookingsTable rows={[futureRow]} locale="en" empty="No rows" workspaceTimezone={TEST_TZ} />
    );
    const rows = container.querySelectorAll("tbody tr");
    expect(rows[0]?.className).not.toMatch(/opacity-60/);
  });

  // ── Partially-past bookings — must NOT be treated as past ────────────────────

  it("does NOT apply opacity-60 to a partially-past booking (last session in future)", () => {
    const { container } = renderWithProviders(
      <BookingsTable
        rows={[partiallyPastRow]}
        locale="en"
        empty="No rows"
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
        workspaceTimezone="Asia/Manila"
      />
    );
    expect(screen.getByText("Carter Wedding")).toBeInTheDocument();
    expect(screen.getByText("Old Completed Shoot")).toBeInTheDocument();
  });

  it("defaults to UTC when workspaceTimezone is omitted (no crash)", () => {
    // Server pre-filters by tz; table just renders what it receives.
    renderWithProviders(
      <BookingsTable
        rows={[futureRow]}
        locale="en"
        empty="No rows"
      />
    );
    expect(screen.getByText("Carter Wedding")).toBeInTheDocument();
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

  // ── Row actions menu: Edit item (Task F) ─────────────────────────────────────

  it("renders a '⋯' menu trigger for each row", () => {
    renderWithProviders(
      <BookingsTable rows={[futureRow]} locale="en" empty="No rows" workspaceTimezone={TEST_TZ} />
    );
    const trigger = screen.getByRole("button", { name: /open booking actions/i });
    expect(trigger).toBeInTheDocument();
  });

  it("shows 'View' and 'Edit' items in the row actions menu", () => {
    renderWithProviders(
      <BookingsTable rows={[futureRow]} locale="en" empty="No rows" workspaceTimezone={TEST_TZ} />
    );
    const trigger = screen.getByRole("button", { name: /open booking actions/i });
    fireEvent.click(trigger);
    expect(screen.getByText("View")).toBeInTheDocument();
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });
});
