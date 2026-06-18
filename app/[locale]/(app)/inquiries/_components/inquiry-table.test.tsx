import { describe, expect, it } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { InquiryTable, type InquiryRow } from "./inquiry-table";

const baseRow: InquiryRow = {
  id: "inq-1",
  name: "Maria Santos",
  email: "maria@example.com",
  status: "new",
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

  // ── Task E: source capitalize ──────────────────────────────────────────────

  it("applies capitalize class to the desktop source cell", () => {
    const { container } = renderTable();
    const cells = container.querySelectorAll("td");
    const sourceCell = Array.from(cells).find(
      (c) => c.textContent?.trim() === "portfolio"
    );
    expect(sourceCell).toBeDefined();
    expect(sourceCell?.className).toMatch(/capitalize/);
  });

  it("renders 'Direct' fallback with capitalize class when source is null", () => {
    const { container } = renderTable([rowNoSource]);
    const cells = container.querySelectorAll("td");
    const sourceCell = Array.from(cells).find(
      (c) => c.textContent?.trim() === "Direct"
    );
    expect(sourceCell).toBeDefined();
    expect(sourceCell?.className).toMatch(/capitalize/);
  });

  // ── Task C: view icon buttons ──────────────────────────────────────────────

  it("renders View (eye) icon buttons (mobile + desktop) per row", () => {
    renderTable();
    // aria-label is t("table.actions.view") = "View"
    const viewButtons = screen.getAllByRole("button", { name: "View" });
    // One in mobile card list, one in desktop table per row
    expect(viewButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("View icon button is already visible without opening any menu", () => {
    renderTable();
    expect(screen.getAllByRole("button", { name: "View" }).length).toBeGreaterThanOrEqual(1);
  });

  it("View icon button is clickable without throwing", () => {
    renderTable();
    const viewButtons = screen.getAllByRole("button", { name: "View" });
    expect(() => fireEvent.click(viewButtons[0])).not.toThrow();
  });
});
