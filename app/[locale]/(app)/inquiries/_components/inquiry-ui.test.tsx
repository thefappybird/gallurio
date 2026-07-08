import { describe, it, expect, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { screen, fireEvent, within } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";

const mockPush = vi.fn();

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) =>
    createElement("a", { href, ...rest }, children),
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
}));

import { InquiryStatusBadge } from "./inquiry-status-badge";
import { InquiryTable, type InquiryRow } from "./inquiry-table";

const rows: InquiryRow[] = [
  {
    id: "111111111111111111111111",
    name: "Emma Carter",
    email: "emma@example.com",
    status: "inquiry",
    eventTitle: "Emma & Noah Wedding",
    eventDate: "2030-08-15T00:00:00.000Z",
    eventType: "wedding",
    submittedAt: "2026-05-30T10:00:00.000Z",
    source: "portfolio",
  },
];

describe("InquiryStatusBadge", () => {
  it("renders Booked for the booked status", () => {
    renderWithProviders(<InquiryStatusBadge status="booked" />);
    expect(screen.getByText("Booked")).toBeInTheDocument();
  });

  it("renders Converted To Booking for the converted status", () => {
    renderWithProviders(<InquiryStatusBadge status="converted" />);
    expect(screen.getByText("Converted To Booking")).toBeInTheDocument();
  });
});

describe("InquiryTable", () => {
  it("renders rows in both card and table layouts", () => {
    renderWithProviders(
      <InquiryTable
        rows={rows}
        locale="en"
        empty="No inquiries yet."
        emptyHint="hint"
      />
    );
    expect(screen.getAllByText("Emma Carter").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Emma & Noah Wedding").length).toBeGreaterThan(0);
    expect(screen.getAllByText("portfolio").length).toBeGreaterThan(0);
    expect(screen.getByTestId("inquiries-card-list")).toBeInTheDocument();
  });

  it("renders the event type as a pill beside the status pill in the card layout", () => {
    renderWithProviders(
      <InquiryTable
        rows={rows}
        locale="en"
        empty="No inquiries yet."
        emptyHint="hint"
      />
    );
    const cardList = screen.getByTestId("inquiries-card-list");
    const [typePill] = within(cardList).getAllByText("Wedding");
    expect(typePill.className).toContain("border");
    expect(typePill.className).toContain("px-2");
  });

  it("renders the empty state when there are no rows", () => {
    renderWithProviders(
      <InquiryTable
        rows={[]}
        locale="en"
        empty="No inquiries yet."
        emptyHint="Submit to see them."
      />
    );
    expect(screen.getByText("No inquiries yet.")).toBeInTheDocument();
    expect(screen.getByText("Submit to see them.")).toBeInTheDocument();
  });

  it("renders View icon buttons for the card and table variants", () => {
    renderWithProviders(
      <InquiryTable
        rows={rows}
        locale="en"
        empty="No inquiries yet."
        emptyHint="hint"
      />
    );
    expect(screen.getAllByRole("button", { name: "View" }).length).toBeGreaterThanOrEqual(2);
  });

  it("navigates to the detail modal URL when a View icon button is clicked", () => {
    mockPush.mockClear();
    renderWithProviders(
      <InquiryTable
        rows={rows}
        locale="en"
        empty="No inquiries yet."
        emptyHint="hint"
      />
    );
    fireEvent.click(screen.getAllByRole("button", { name: "View" })[0]);
    expect(mockPush).toHaveBeenCalledWith(
      "/inquiries?inquiryId=111111111111111111111111"
    );
  });

  it("applies the capitalize CSS class to the desktop source cell", () => {
    renderWithProviders(
      <InquiryTable
        rows={rows}
        locale="en"
        empty="No inquiries yet."
        emptyHint="hint"
      />
    );
    const sourceCells = document.querySelectorAll("td.capitalize");
    expect(sourceCells.length).toBeGreaterThan(0);
  });
});
