import { describe, expect, it, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { BookingStatusLegend } from "./booking-status-legend";
import { BOOKING_STATUSES } from "@/lib/validators/booking";

describe("BookingStatusLegend", () => {
  it("renders one chip per booking status with a translated label", () => {
    renderWithProviders(
      <BookingStatusLegend activeStatus={null} onToggle={() => {}} />
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(BOOKING_STATUSES.length);
    // statusValues translations
    expect(screen.getByText("Inquiry")).toBeInTheDocument();
    expect(screen.getByText("Booked")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("calls onToggle with the clicked status", () => {
    const onToggle = vi.fn();
    renderWithProviders(
      <BookingStatusLegend activeStatus={null} onToggle={onToggle} />
    );
    fireEvent.click(screen.getByText("Booked"));
    expect(onToggle).toHaveBeenCalledWith("booked");
  });

  it("marks the active chip with aria-pressed and dims the rest", () => {
    renderWithProviders(
      <BookingStatusLegend activeStatus="quoted" onToggle={() => {}} />
    );
    const active = screen.getByText("Quoted").closest("button");
    const other = screen.getByText("Booked").closest("button");
    expect(active).toHaveAttribute("aria-pressed", "true");
    expect(other).toHaveAttribute("aria-pressed", "false");
    expect(other?.className).toMatch(/opacity-60/);
    expect(active?.className).not.toMatch(/opacity-60/);
  });
});
