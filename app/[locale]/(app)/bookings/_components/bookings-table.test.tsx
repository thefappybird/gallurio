import { describe, expect, it } from "vitest";
import { screen, fireEvent, within } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { BookingsTable, type BookingRow } from "./bookings-table";

const TEST_TZ = "UTC";

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
  sessions: [{ startAt: relativeDate(5), endAt: relativeDate(5, 18) }],
  lastSessionEnd: relativeDate(5, 18),
  status: "booked",
  total: 75_000,
  currency: "PHP",
};

const pastRow: BookingRow = {
  id: "2",
  title: "Old Completed Shoot",
  clientName: "Priya Shah",
  sessions: [{ startAt: relativeDate(-10), endAt: relativeDate(-10, 17) }],
  lastSessionEnd: relativeDate(-10, 17),
  status: "completed",
  total: 25_000,
  currency: "PHP",
};

const cancelledRow: BookingRow = {
  id: "3",
  title: "Old Cancelled Event",
  clientName: "Sam Green",
  sessions: [{ startAt: relativeDate(-3), endAt: relativeDate(-3, 17) }],
  lastSessionEnd: relativeDate(-3, 17),
  status: "cancelled",
  total: 10_000,
  currency: "PHP",
};

const partiallyPastRow: BookingRow = {
  id: "4",
  title: "Ongoing Multi-Day",
  clientName: "Lee Kim",
  sessions: [
    { startAt: relativeDate(-2), endAt: relativeDate(-2, 17) },
    { startAt: relativeDate(3), endAt: relativeDate(3, 17) },
  ],
  lastSessionEnd: relativeDate(3, 17),
  status: "booked",
  total: 50_000,
  currency: "PHP",
};

describe("BookingsTable", () => {
  it("renders rows with title, client, and money column", () => {
    renderWithProviders(
      <BookingsTable
        rows={[futureRow]}
        locale="en"
        empty="No rows"
        workspaceTimezone={TEST_TZ}
      />
    );
    expect(screen.getAllByText("Carter Wedding").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Emma Carter").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/75,000/).length).toBeGreaterThan(0);
  });

  it("renders empty state when rows is empty", () => {
    renderWithProviders(
      <BookingsTable
        rows={[]}
        locale="en"
        empty="No rows"
        workspaceTimezone={TEST_TZ}
      />
    );
    expect(screen.getByText("No rows")).toBeInTheDocument();
  });

  it("renders a mobile card list alongside the desktop table markup", () => {
    renderWithProviders(
      <BookingsTable
        rows={[futureRow]}
        locale="en"
        empty="No rows"
        workspaceTimezone={TEST_TZ}
      />
    );
    expect(screen.getByTestId("bookings-card-list")).toBeInTheDocument();
  });

  it("keeps status and total visible together in the card layout", () => {
    renderWithProviders(
      <BookingsTable
        rows={[futureRow]}
        locale="en"
        empty="No rows"
        workspaceTimezone={TEST_TZ}
      />
    );
    const cardList = screen.getByTestId("bookings-card-list");
    expect(within(cardList).getByText("Booked")).toBeInTheDocument();
    expect(within(cardList).getByText(/75,000/)).toBeInTheDocument();
  });

  it("applies line-through styling to the desktop title cell of cancelled rows", () => {
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
      (cell) => cell.textContent?.trim() === "Old Cancelled Event"
    );
    expect(cancelledTitleCell?.className).toMatch(/line-through/);
  });

  it("renders all rows it receives", () => {
    renderWithProviders(
      <BookingsTable
        rows={[futureRow, pastRow]}
        locale="en"
        empty="No rows"
        workspaceTimezone={TEST_TZ}
      />
    );
    expect(screen.getAllByText("Carter Wedding").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Old Completed Shoot").length).toBeGreaterThan(
      0
    );
  });

  it("shows empty state when rows array is empty", () => {
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

  it("shows Past pill for fully past rows", () => {
    renderWithProviders(
      <BookingsTable
        rows={[pastRow]}
        locale="en"
        empty="No rows"
        workspaceTimezone={TEST_TZ}
      />
    );
    expect(screen.getAllByText(/^past$/i).length).toBeGreaterThan(0);
  });

  it("does not show Past pill for future rows", () => {
    renderWithProviders(
      <BookingsTable
        rows={[futureRow]}
        locale="en"
        empty="No rows"
        workspaceTimezone={TEST_TZ}
      />
    );
    expect(screen.queryAllByText(/^past$/i)).toHaveLength(0);
  });

  it("applies opacity-60 to fully past desktop rows", () => {
    const { container } = renderWithProviders(
      <BookingsTable
        rows={[pastRow]}
        locale="en"
        empty="No rows"
        workspaceTimezone={TEST_TZ}
      />
    );
    const rows = container.querySelectorAll("tbody tr");
    expect(rows[0]?.className).toMatch(/opacity-60/);
  });

  it("does not apply opacity-60 to future desktop rows", () => {
    const { container } = renderWithProviders(
      <BookingsTable
        rows={[futureRow]}
        locale="en"
        empty="No rows"
        workspaceTimezone={TEST_TZ}
      />
    );
    const rows = container.querySelectorAll("tbody tr");
    expect(rows[0]?.className).not.toMatch(/opacity-60/);
  });

  it("does not apply opacity-60 to a partially past booking", () => {
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

  it("does not show Past pill for a partially past booking", () => {
    renderWithProviders(
      <BookingsTable
        rows={[partiallyPastRow]}
        locale="en"
        empty="No rows"
        workspaceTimezone={TEST_TZ}
      />
    );
    expect(screen.queryAllByText(/^past$/i)).toHaveLength(0);
  });

  it("accepts Asia/Manila as workspaceTimezone without crashing", () => {
    renderWithProviders(
      <BookingsTable
        rows={[futureRow, pastRow]}
        locale="en"
        empty="No rows"
        workspaceTimezone="Asia/Manila"
      />
    );
    expect(screen.getAllByText("Carter Wedding").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Old Completed Shoot").length).toBeGreaterThan(
      0
    );
  });

  it("defaults to UTC when workspaceTimezone is omitted", () => {
    renderWithProviders(
      <BookingsTable rows={[futureRow]} locale="en" empty="No rows" />
    );
    expect(screen.getAllByText("Carter Wedding").length).toBeGreaterThan(0);
  });

  it("renders a status pill with the translated label and status color", () => {
    renderWithProviders(
      <BookingsTable
        rows={[futureRow]}
        locale="en"
        empty="No rows"
        workspaceTimezone={TEST_TZ}
      />
    );
    const [pill] = screen.getAllByText("Booked");
    expect(pill).toBeInTheDocument();
    expect(pill.getAttribute("style")).toContain("--event-booked");
  });

  it("does not right-align the Total cell value", () => {
    renderWithProviders(
      <BookingsTable
        rows={[futureRow]}
        locale="en"
        empty="No rows"
        workspaceTimezone={TEST_TZ}
      />
    );
    const [totalValue] = screen.getAllByText(/75,000/);
    expect(totalValue.className).not.toMatch(/text-right/);
    expect(totalValue.className).toMatch(/tabular-nums/);
  });

  it("renders a row action trigger", () => {
    renderWithProviders(
      <BookingsTable
        rows={[futureRow]}
        locale="en"
        empty="No rows"
        workspaceTimezone={TEST_TZ}
      />
    );
    expect(
      screen.getAllByRole("button", { name: /open booking actions/i }).length
    ).toBeGreaterThan(0);
  });

  it("shows View and Edit items in the row actions menu", () => {
    renderWithProviders(
      <BookingsTable
        rows={[futureRow]}
        locale="en"
        empty="No rows"
        workspaceTimezone={TEST_TZ}
      />
    );
    const trigger = screen.getAllByRole("button", {
      name: /open booking actions/i,
    })[0];
    fireEvent.click(trigger);
    expect(screen.getByText("View")).toBeInTheDocument();
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });
});
