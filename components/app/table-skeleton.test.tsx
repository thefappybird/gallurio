import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render";
import { calculateTableSkeletonRows, TableSkeleton } from "./table-skeleton";

describe("TableSkeleton", () => {
  it("fills only the whole rows that fit in the remaining viewport height", () => {
    const rows = calculateTableSkeletonRows({
      availableHeight: 326,
      headerHeight: 32,
      rowHeight: 41,
    });

    expect(rows).toBe(7);
    expect(32 + rows * 41).toBeLessThanOrEqual(326);
    expect(32 + (rows + 1) * 41).toBeGreaterThan(326);
  });

  it("does not add a row when the measured space is shorter than a row", () => {
    expect(
      calculateTableSkeletonRows({
        availableHeight: 24,
        headerHeight: 32,
        rowHeight: 41,
      })
    ).toBe(0);
  });

  it("applies a custom rowHeight to each body row and keeps 41px by default", () => {
    const { rerender } = renderWithProviders(
      <TableSkeleton columns={2} rows={2} rowHeight={56} />
    );
    const rowsOf = () =>
      screen.getByLabelText("Loading table data").querySelectorAll("tbody tr");
    expect((rowsOf()[0] as HTMLElement).style.height).toBe("56px");

    rerender(<TableSkeleton columns={2} rows={2} />);
    expect((rowsOf()[0] as HTMLElement).style.height).toBe("41px");
  });

  it("renders cardFields label/value pairs per mobile card (default 4)", () => {
    const { container, rerender } = renderWithProviders(
      <TableSkeleton columns={2} rows={1} cardRows={1} cardFields={3} />
    );
    const fieldCount = () =>
      container.querySelectorAll("[aria-label='Loading card data'] .border-t > div")
        .length;
    expect(fieldCount()).toBe(3);

    rerender(<TableSkeleton columns={2} rows={1} cardRows={1} />);
    expect(fieldCount()).toBe(4);
  });

  it("uses a full-width fixed-layout table for desktop loading rows", () => {
    renderWithProviders(<TableSkeleton columns={4} rows={2} />);

    const loadingTable = screen.getByLabelText("Loading table data");
    const table = loadingTable.querySelector("table");

    expect(table).toHaveClass("w-full", "table-fixed");
    expect(table?.querySelectorAll("thead th")).toHaveLength(4);
    expect(table?.querySelectorAll("tbody tr")).toHaveLength(2);
  });
});
