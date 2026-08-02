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

  it("uses a full-width fixed-layout table for desktop loading rows", () => {
    renderWithProviders(<TableSkeleton columns={4} rows={2} />);

    const loadingTable = screen.getByLabelText("Loading table data");
    const table = loadingTable.querySelector("table");

    expect(table).toHaveClass("w-full", "table-fixed");
    expect(table?.querySelectorAll("thead th")).toHaveLength(4);
    expect(table?.querySelectorAll("tbody tr")).toHaveLength(2);
  });
});
