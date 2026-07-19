import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render";
import { TableSkeleton } from "./table-skeleton";

describe("TableSkeleton", () => {
  it("uses a full-width fixed-layout table for desktop loading rows", () => {
    renderWithProviders(<TableSkeleton columns={4} rows={2} />);

    const loadingTable = screen.getByLabelText("Loading table data");
    const table = loadingTable.querySelector("table");

    expect(table).toHaveClass("w-full", "table-fixed");
    expect(table?.querySelectorAll("thead th")).toHaveLength(4);
    expect(table?.querySelectorAll("tbody tr")).toHaveLength(2);
  });
});
