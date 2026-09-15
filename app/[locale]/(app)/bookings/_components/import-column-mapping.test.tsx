import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { autoMapColumns } from "@/lib/bookings/import-mapping";
import { ImportColumnMapping } from "./import-column-mapping";

const HEADERS = ["Customer", "Event", "Date", "Package Price", "Deal Status"];
const SAMPLE = {
  Customer: "Jane Smith",
  Event: "Smith Wedding",
  Date: "06/15/2026",
  "Package Price": "50000",
  "Deal Status": "Confirmed",
};

function render(overrides: Partial<Parameters<typeof ImportColumnMapping>[0]> = {}) {
  const props = {
    headers: HEADERS,
    sampleRow: SAMPLE,
    rowCount: 25,
    mapping: autoMapColumns(HEADERS),
    onChange: vi.fn(),
    dateOrder: "MDY" as const,
    onDateOrderChange: vi.fn(),
    ambiguousDateExample: null,
    loading: false,
    ...overrides,
  };
  return { ...renderWithProviders(<ImportColumnMapping {...props} />), props };
}

describe("ImportColumnMapping", () => {
  it("shows what was found in the file", () => {
    render();
    expect(screen.getByText("5 columns")).toBeInTheDocument();
    expect(screen.getByText("25 rows")).toBeInTheDocument();
  });

  it("shows a sample value so a wrong assignment is visible before importing", () => {
    // The single fastest way to catch mapping "Date" to endAt by mistake.
    render();
    expect(screen.getByText("First row: Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("First row: Smith Wedding")).toBeInTheDocument();
  });

  it("keeps the advanced round-trip columns collapsed", () => {
    // Six identity columns nobody migrating from another CRM will ever set.
    render();
    expect(screen.queryByText("payments")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /advanced and round-trip columns/i })
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("marks a required field that has no column yet", () => {
    const mapping = autoMapColumns(HEADERS);
    mapping.startAt = null;
    render({ mapping });
    expect(screen.getByText("Needs a column")).toBeInTheDocument();
  });

  it("renders a skeleton instead of the grid while the file is still being read", () => {
    // An XLSX round-trips to the server to be parsed, so the grid has nothing
    // to show yet and an empty one would read as "no columns found".
    render({ loading: true, headers: [], sampleRow: undefined });
    expect(screen.getByText("Reading your file")).toBeInTheDocument();
    expect(screen.queryByText("Required")).not.toBeInTheDocument();
  });
});
