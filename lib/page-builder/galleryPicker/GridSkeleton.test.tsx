import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GridSkeleton } from "./GridSkeleton";

describe("GridSkeleton", () => {
  it("announces loading via role=status and renders the requested tile count", () => {
    render(<GridSkeleton gridClassName="grid grid-cols-2" count={4} label="Loading collections…" />);
    const status = screen.getByRole("status", { name: "Loading collections…" });
    expect(status.querySelectorAll("li")).toHaveLength(4);
  });

  it("defaults to 8 tiles when count is omitted", () => {
    render(<GridSkeleton gridClassName="grid grid-cols-4" label="Loading…" />);
    expect(screen.getByRole("status").querySelectorAll("li")).toHaveLength(8);
  });
});
