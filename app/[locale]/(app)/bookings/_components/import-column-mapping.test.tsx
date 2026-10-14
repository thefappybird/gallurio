import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";

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
    timeZone: "Asia/Manila",
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

  it("labels fields in plain words, not by their column key", () => {
    render();
    expect(screen.getByText("Client name")).toBeInTheDocument();
    expect(screen.queryByText("clientName")).not.toBeInTheDocument();
  });

  it("opens a second picker when combining with another column", async () => {
    render();
    expect(screen.queryByLabelText("Client name, column 2")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Combine with another column" })[0]);
    expect(screen.getByLabelText("Client name, column 2")).toBeInTheDocument();
  });

  it("shows the joined first-row value for a combined field", () => {
    const mapping = autoMapColumns(HEADERS);
    mapping.clientName = { sources: ["Customer", "Event"] };
    render({ mapping });
    expect(screen.getByText("First row: Jane Smith Smith Wedding")).toBeInTheDocument();
  });

  it("removes an extra column and writes a single source again", async () => {
    const mapping = autoMapColumns(HEADERS);
    mapping.clientName = { sources: ["Customer", "Event"] };
    const { props } = render({ mapping });
    fireEvent.click(screen.getByRole("button", { name: "Remove this column" }));
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ clientName: { source: "Customer" } })
    );
  });

  it("reads the sample date back and lets the day/month order be swapped", () => {
    const sampleRow = { ...SAMPLE, Date: "03/04/2026" };
    const { props } = render({ sampleRow, ambiguousDateExample: "03/04/2026" });
    expect(screen.getByText(/First row: 03\/04\/2026 → Mar 4, 2026/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Swap day and month" }));
    expect(props.onDateOrderChange).toHaveBeenCalledWith("DMY");
  });

  it("keeps the advanced round-trip columns collapsed", () => {
    // Six identity columns nobody migrating from another CRM will ever set.
    render();
    expect(screen.queryByText("payments")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /re-importing a gallurio export/i })
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
