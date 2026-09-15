import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import type { UnmappedEnumValue } from "@/lib/bookings/import-mapping";
import { ImportValueMapping } from "./import-value-mapping";

const VALUES: UnmappedEnumValue[] = [
  { field: "status", value: "Confirmed", count: 14, suggestion: "booked" },
  { field: "status", value: "Pencilled in", count: 3, suggestion: null },
];

function render(overrides: Partial<Parameters<typeof ImportValueMapping>[0]> = {}) {
  const props = {
    unmapped: VALUES,
    valueMap: {} as Record<string, Record<string, string>>,
    onChange: vi.fn(),
    sourceColumns: { status: "Deal Status" },
    ...overrides,
  };
  return { ...renderWithProviders(<ImportValueMapping {...props} />), props };
}

describe("ImportValueMapping", () => {
  it("shows each unrecognized value with how many rows depend on it", () => {
    // The count is what makes the step feel worth doing: one choice, 14 rows.
    render();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("14 rows")).toBeInTheDocument();
    expect(screen.getByText("Pencilled in")).toBeInTheDocument();
    expect(screen.getByText("3 rows")).toBeInTheDocument();
  });

  it("names the column the values came from", () => {
    render();
    expect(screen.getAllByText("From Deal Status").length).toBeGreaterThan(0);
  });

  it("warns about how many values are still unmatched", () => {
    render();
    expect(screen.getByText("2 values are unmatched. Rows using them will be skipped.")).toBeInTheDocument();
  });

  it("stops warning once every value has been answered", () => {
    render({
      valueMap: { status: { Confirmed: "booked", "Pencilled in": "" } },
    });
    expect(screen.queryByText(/unmatched/)).not.toBeInTheDocument();
  });
});
