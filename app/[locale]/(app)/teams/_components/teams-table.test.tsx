import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { TeamsTable } from "./teams-table";
import type { TeamRow } from "../_types";

const noop = vi.fn();

const handlers = {
  onDetails: noop,
  onRename: noop,
  onChangeColor: noop,
  onInvite: noop,
  onDelete: noop,
};

const ROWS: TeamRow[] = [
  { id: "t1", name: "Main", color: "#0d7377", isDefault: true, memberCount: 1 },
  { id: "t2", name: "Wedding crew", color: "#7c5cff", isDefault: false, memberCount: 3 },
];

describe("TeamsTable", () => {
  it("renders a row per team with name, default badge, and member count", () => {
    renderWithProviders(<TeamsTable rows={ROWS} empty="none" {...handlers} />);
    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(screen.getByText("Wedding crew")).toBeInTheDocument();
    // Main team carries the Default badge; Wedding crew does not.
    expect(screen.getByText("Default")).toBeInTheDocument();
    expect(screen.getByText("1 member")).toBeInTheDocument();
    expect(screen.getByText("3 members")).toBeInTheDocument();
  });

  it("renders a color swatch carrying each team's color", () => {
    const { container } = renderWithProviders(
      <TeamsTable rows={ROWS} empty="none" {...handlers} />,
    );
    const swatches = container.querySelectorAll('span[style*="background-color"]');
    const colors = Array.from(swatches).map((s) => s.getAttribute("style") ?? "");
    expect(colors.some((s) => s.includes("#0d7377"))).toBe(true);
    expect(colors.some((s) => s.includes("#7c5cff"))).toBe(true);
  });

  it("shows the empty state when there are no rows", () => {
    renderWithProviders(
      <TeamsTable rows={[]} empty="No teams match your search." {...handlers} />,
    );
    expect(screen.getByText("No teams match your search.")).toBeInTheDocument();
  });
});
