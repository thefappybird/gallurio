import { describe, expect, it, vi } from "vitest";
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
  bookedAt: null,
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

const preloadSpy = vi.hoisted(() => vi.fn());
vi.mock("./inquiry-detail-dynamic", () => ({ preloadInquiryDetailModal: preloadSpy }));

describe("InquiryTable", () => {
  it("warms the detail modal chunk on row pointer-enter and focus", () => {
    renderTable();
    const row = screen.getAllByRole("button", { name: /open.*maria santos/i })[0];
    fireEvent.pointerEnter(row);
    expect(preloadSpy).toHaveBeenCalledTimes(1);
    fireEvent.focus(row);
    expect(preloadSpy).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["Asia/Manila", "Oct 9, 2026"],
    ["Pacific/Pago_Pago", "Oct 8, 2026"],
  ])("formats the event date in workspace tz %s regardless of runner TZ", (tz, expected) => {
    const prev = process.env.TZ;
    process.env.TZ = "UTC";
    try {
      renderWithProviders(
        <InquiryTable
          rows={[{ ...baseRow, eventDate: "2026-10-08T23:30:00Z" }]}
          locale="en"
          workspaceTz={tz}
          empty="x"
          emptyHint="y"
        />
      );
      expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
    } finally {
      if (prev === undefined) delete process.env.TZ;
      else process.env.TZ = prev;
    }
  });

  it("desktop table does not force max-content width", () => {
    renderTable();
    expect(screen.getByRole("table")).not.toHaveClass("min-w-max");
  });

  it("desktop table has no Source column; source pill sits in the title cell", () => {
    renderTable();
    const table = screen.getByRole("table");
    expect(table.querySelectorAll("th[aria-sort]")).toHaveLength(7);
    const pill = table.querySelector('tbody [data-testid="source-pill"]');
    expect(pill).toHaveTextContent("portfolio");
    expect(pill).toHaveClass("shrink-0", "capitalize");
    expect(pill?.parentElement).toHaveClass("flex", "min-w-0");
    expect(pill?.closest("td")).toHaveTextContent("Santos Wedding");
  });

  it("desktop name cell truncates and exposes the full name", () => {
    renderTable();
    expect(screen.getByRole("table").querySelector('[title="Maria Santos"]')).toHaveClass("truncate", "max-w-[10rem]");
  });

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

  it("shows source pill in the mobile card pill row, Direct when null", () => {
    renderTable([baseRow, rowNoSource]);
    const pills = screen.getByTestId("inquiries-card-list").querySelectorAll('[data-testid="source-pill"]');
    expect(pills[0]).toHaveTextContent("portfolio");
    expect(pills[0].parentElement).toContainElement(screen.getAllByText("Inquiry")[0]);
    expect(pills[1]).toHaveTextContent("Direct");
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

  it("marks the active sort column with aria-sort and leaves actions unsortable", () => {
    const { container } = renderWithProviders(
      <InquiryTable
        rows={[baseRow]}
        locale="en"
        empty="x"
        emptyHint="y"
        sortKey="submitted"
        sortDir="desc"
      />
    );
    const ths = Array.from(container.querySelectorAll("thead th"));
    expect(ths.map((th) => th.getAttribute("aria-sort"))).toEqual([
      "none", "none", "none", "none", "none", "descending", "none", null,
    ]);
  });

  it("fires onSortChange with the flipped dir when the active header is clicked", () => {
    const onSortChange = vi.fn();
    const { container } = renderWithProviders(
      <InquiryTable
        rows={[baseRow]}
        locale="en"
        empty="x"
        emptyHint="y"
        sortKey="submitted"
        sortDir="desc"
        onSortChange={onSortChange}
      />
    );
    const th = container.querySelectorAll("thead th")[5] as HTMLElement;
    fireEvent.click(th.querySelector("button") as HTMLElement);
    expect(onSortChange).toHaveBeenCalledWith("submitted", "asc");
  });

  it("shows the booked date, or a dash when never booked", () => {
    renderWithProviders(
      <InquiryTable
        rows={[{ ...baseRow, bookedAt: "2026-07-04T10:00:00.000Z" }, { ...rowNoSource, bookedAt: null }]}
        locale="en"
        workspaceTz="UTC"
        empty="x"
        emptyHint="y"
      />
    );
    expect(screen.getAllByText("Jul 4, 2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("keeps horizontal overflow scoped to the desktop table wrapper", () => {
    const { container } = renderTable();
    const wrapper = container.querySelector("div.overflow-x-auto");
    const table = container.querySelector("table");
    expect(wrapper?.className).toMatch(/min-w-0/);
    expect(wrapper?.className).toMatch(/max-w-full/);
    expect(table?.className).not.toMatch(/min-w-max/);
  });
});
