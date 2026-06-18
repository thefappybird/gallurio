import { describe, it, expect, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { screen, fireEvent } from "@testing-library/react";
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
    status: "new",
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
  it("renders rows with a link to the detail page", () => {
    renderWithProviders(
      <InquiryTable rows={rows} locale="en" empty="No inquiries yet." emptyHint="hint" />
    );
    // Name appears in both mobile card + desktop table layouts.
    expect(screen.getAllByText("Emma Carter").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Emma & Noah Wedding").length).toBeGreaterThan(0);
    // Source text is rendered as-is in DOM; CSS capitalize handles display.
    expect(screen.getAllByText("portfolio").length).toBeGreaterThan(0);
    const links = screen.getAllByRole("link", { name: /Open inquiry from Emma Carter/i });
    expect(links[0]).toHaveAttribute("href", "/inquiries?inquiryId=111111111111111111111111");
  });

  it("renders the empty state when there are no rows", () => {
    renderWithProviders(
      <InquiryTable rows={[]} locale="en" empty="No inquiries yet." emptyHint="Submit to see them." />
    );
    expect(screen.getByText("No inquiries yet.")).toBeInTheDocument();
    expect(screen.getByText("Submit to see them.")).toBeInTheDocument();
  });

  it("renders a View (eye) icon button for each row", () => {
    renderWithProviders(
      <InquiryTable rows={rows} locale="en" empty="No inquiries yet." emptyHint="hint" />
    );
    // aria-label is t("table.actions.view") = "View"; mobile + desktop = 2 per row
    const viewButtons = screen.getAllByRole("button", { name: "View" });
    expect(viewButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("navigates to the detail modal URL when the View icon button is clicked", () => {
    mockPush.mockClear();
    renderWithProviders(
      <InquiryTable rows={rows} locale="en" empty="No inquiries yet." emptyHint="hint" />
    );
    // Click the first View icon button (mobile card layout).
    const viewButtons = screen.getAllByRole("button", { name: "View" });
    fireEvent.click(viewButtons[0]);
    expect(mockPush).toHaveBeenCalledWith("/inquiries?inquiryId=111111111111111111111111");
  });

  it("applies the capitalize CSS class to the source cell", () => {
    renderWithProviders(
      <InquiryTable rows={rows} locale="en" empty="No inquiries yet." emptyHint="hint" />
    );
    // The desktop source <td> must carry the capitalize class.
    const sourceCells = document.querySelectorAll("td.capitalize");
    expect(sourceCells.length).toBeGreaterThan(0);
  });
});
