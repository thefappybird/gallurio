import { describe, expect, it } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { InquiryTable, type InquiryRow } from "./inquiry-table";

const baseRow: InquiryRow = {
  id: "inq-1",
  name: "Maria Santos",
  email: "maria@example.com",
  status: "inquiry",
  eventTitle: "Santos Wedding",
  eventDate: "2026-09-15T00:00:00.000Z",
  eventType: "wedding",
  submittedAt: "2026-06-01T10:00:00.000Z",
  source: "portfolio",
};

const rowNoSource: InquiryRow = {
  ...baseRow,
  id: "inq-2",
  source: null,
};

function renderTable(rows: InquiryRow[] = [baseRow]) {
  return renderWithProviders(
    <InquiryTable
      rows={rows}
      locale="en"
      empty="No inquiries yet."
      emptyHint="Submit a form to see inquiries."
    />
  );
}

describe("InquiryTable", () => {
  it("renders empty state when rows is empty", () => {
    renderTable([]);
    expect(screen.getByText("No inquiries yet.")).toBeInTheDocument();
  });

  it("renders client name and email", () => {
    renderTable();
    expect(screen.getAllByText("Maria Santos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("maria@example.com").length).toBeGreaterThan(0);
  });

  it("renders a mobile card list", () => {
    renderTable();
    expect(screen.getByTestId("inquiries-card-list")).toBeInTheDocument();
  });

  it("applies capitalize class to the desktop source cell", () => {
    const { container } = renderTable();
    const cells = container.querySelectorAll("td");
    const sourceCell = Array.from(cells).find(
      (cell) => cell.textContent?.trim() === "portfolio"
    );
    expect(sourceCell).toBeDefined();
    expect(sourceCell?.className).toMatch(/capitalize/);
  });

  it("renders Direct fallback with capitalize class when source is null", () => {
    const { container } = renderTable([rowNoSource]);
    const cells = container.querySelectorAll("td");
    const sourceCell = Array.from(cells).find(
      (cell) => cell.textContent?.trim() === "Direct"
    );
    expect(sourceCell).toBeDefined();
    expect(sourceCell?.className).toMatch(/capitalize/);
  });

  it("renders View icon buttons for the card and table variants", () => {
    renderTable();
    expect(screen.getAllByRole("button", { name: "View" }).length).toBeGreaterThanOrEqual(2);
  });

  it("View icon buttons are visible without opening any menu", () => {
    renderTable();
    expect(screen.getAllByRole("button", { name: "View" }).length).toBeGreaterThanOrEqual(2);
  });

  it("View icon button is clickable without throwing", () => {
    renderTable();
    const viewButtons = screen.getAllByRole("button", { name: "View" });
    expect(() => fireEvent.click(viewButtons[0])).not.toThrow();
  });

  it("keeps horizontal overflow scoped to the desktop table wrapper", () => {
    const { container } = renderTable();
    const wrapper = container.querySelector("div.overflow-x-auto");
    const table = container.querySelector("table");
    expect(wrapper?.className).toMatch(/min-w-0/);
    expect(wrapper?.className).toMatch(/max-w-full/);
    expect(table?.className).toMatch(/min-w-max/);
  });
});
