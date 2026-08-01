import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { BookingsExportDialog } from "./bookings-export-dialog";
import type { BookingTeamOption } from "../_data/team-options";

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ render }: { render: React.ReactNode }) => <>{render}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const TEAMS: BookingTeamOption[] = [
  { id: "6a6c72fb0b6272bc938ef801", name: "Alpha", color: "#0ea5e9", isActive: true, isLead: true },
  { id: "6a6c72fb0b6272bc938ef802", name: "Beta", color: "#f59e0b", isActive: true, isLead: false },
];

function renderDialog(overrides: Partial<Parameters<typeof BookingsExportDialog>[0]> = {}) {
  return renderWithProviders(
    <BookingsExportDialog
      open
      onClose={vi.fn()}
      baseParams=""
      teams={TEAMS}
      {...overrides}
    />
  );
}

describe("BookingsExportDialog", () => {
  it("downloads every team, all time, as CSV by default", () => {
    renderDialog();
    // Button renders an anchor with role="button", so query by that role.
    expect(screen.getByRole("button", { name: /download/i })).toHaveAttribute(
      "href",
      "/api/bookings/export"
    );
  });

  it("narrows the download to every selected team", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /^alpha$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^beta$/i }));
    expect(screen.getByRole("button", { name: /download/i })).toHaveAttribute(
      "href",
      `/api/bookings/export?teamId=${TEAMS[0].id}&teamId=${TEAMS[1].id}`
    );
  });

  it("sends a from/to pair once a date range is filled in", () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText(/date range/i));
    fireEvent.change(screen.getByLabelText(/^from$/i), { target: { value: "2026-08-01" } });
    fireEvent.change(screen.getByLabelText(/^to$/i), { target: { value: "2026-08-31" } });
    expect(screen.getByRole("button", { name: /download/i })).toHaveAttribute(
      "href",
      "/api/bookings/export?from=2026-08-01&to=2026-08-31"
    );
  });

  it("switches the download to XLSX", () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText(/excel/i));
    expect(screen.getByRole("button", { name: /download/i })).toHaveAttribute(
      "href",
      "/api/bookings/export?format=xlsx"
    );
  });

  it("refuses to download a half-filled range rather than exporting nothing", () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText(/date range/i));
    fireEvent.change(screen.getByLabelText(/^from$/i), { target: { value: "2026-08-01" } });
    // No end date yet: an unbounded href would quietly export the wrong set.
    const button = screen.getByRole("button", { name: /download/i });
    expect(button).not.toHaveAttribute("href");
    expect(button).toBeDisabled();
  });

  it("says so when the list's own filters will narrow the export too", () => {
    // A download that quietly differs from the choices above is worse than
    // one extra line of copy.
    const { rerender } = renderDialog();
    expect(screen.queryByText(/status and search filters/i)).toBeNull();

    rerender(
      <BookingsExportDialog open onClose={vi.fn()} baseParams="status=cancelled" teams={TEAMS} />
    );
    expect(screen.getByText(/status and search filters/i)).toBeDefined();
  });
});
