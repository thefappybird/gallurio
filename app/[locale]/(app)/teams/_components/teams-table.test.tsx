import { describe, expect, it, vi } from "vitest";
import { type ReactNode, type ReactElement, createElement } from "react";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { TeamsTable } from "./teams-table";
import type { TeamRow } from "../_types";

// Base UI's floating menu relies on layout APIs unavailable in happy-dom.
// Stub the dropdown so menu items render inline as buttons — this also pins the
// item handler to `onClick` (base-ui's selection event), guarding against the
// `onSelect` regression where items silently did nothing.
vi.mock("@/components/ui/dropdown-menu", () => {
  const DropdownMenu = ({ children }: { children: ReactNode }) =>
    createElement("div", { "data-testid": "dropdown-menu" }, children);
  const DropdownMenuTrigger = ({
    render,
    children,
  }: {
    render?: ReactElement;
    children?: ReactNode;
  }) => render ?? createElement("button", null, children);
  const DropdownMenuContent = ({ children }: { children: ReactNode }) =>
    createElement("div", { "data-testid": "dropdown-content" }, children);
  const DropdownMenuItem = ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => createElement("button", { onClick }, children);
  const DropdownMenuSeparator = () => createElement("hr");
  return {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
  };
});

function makeHandlers() {
  return {
    onDetails: vi.fn(),
    onRename: vi.fn(),
    onChangeColor: vi.fn(),
    onInvite: vi.fn(),
    onDelete: vi.fn(),
  };
}

const ROWS: TeamRow[] = [
  { id: "t1", name: "Main", color: "#0d7377", isDefault: true, memberCount: 1 },
  { id: "t2", name: "Wedding crew", color: "#7c5cff", isDefault: false, memberCount: 3 },
];

describe("TeamsTable", () => {
  it("renders a row per team with name, default badge, and member count", () => {
    renderWithProviders(<TeamsTable rows={ROWS} empty="none" {...makeHandlers()} />);
    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(screen.getByText("Wedding crew")).toBeInTheDocument();
    expect(screen.getByText("Default")).toBeInTheDocument();
    expect(screen.getByText("1 member")).toBeInTheDocument();
    expect(screen.getByText("3 members")).toBeInTheDocument();
  });

  it("renders a color swatch carrying each team's color", () => {
    const { container } = renderWithProviders(
      <TeamsTable rows={ROWS} empty="none" {...makeHandlers()} />,
    );
    const swatches = container.querySelectorAll('span[style*="background-color"]');
    const colors = Array.from(swatches).map((s) => s.getAttribute("style") ?? "");
    expect(colors.some((s) => s.includes("#0d7377"))).toBe(true);
    expect(colors.some((s) => s.includes("#7c5cff"))).toBe(true);
  });

  it("shows the empty state when there are no rows", () => {
    renderWithProviders(
      <TeamsTable rows={[]} empty="No teams match your search." {...makeHandlers()} />,
    );
    expect(screen.getByText("No teams match your search.")).toBeInTheDocument();
  });

  it("only offers Delete for non-default teams", () => {
    renderWithProviders(<TeamsTable rows={ROWS} empty="none" {...makeHandlers()} />);
    // Main is the default team → no Delete item; Wedding crew → one Delete item.
    expect(screen.getAllByText("Delete")).toHaveLength(1);
  });

  it("fires rename / change-color / invite / delete handlers from the menu", () => {
    const handlers = makeHandlers();
    renderWithProviders(<TeamsTable rows={ROWS} empty="none" {...handlers} />);

    // First row (Main) menu items come first in DOM order.
    fireEvent.click(screen.getAllByText("Rename")[0]);
    expect(handlers.onRename).toHaveBeenCalledWith(ROWS[0]);

    fireEvent.click(screen.getAllByText("Change color")[0]);
    expect(handlers.onChangeColor).toHaveBeenCalledWith(ROWS[0]);

    fireEvent.click(screen.getAllByText("Invite teammate")[0]);
    expect(handlers.onInvite).toHaveBeenCalledWith(ROWS[0]);

    // Delete exists only for the non-default Wedding crew row.
    fireEvent.click(screen.getByText("Delete"));
    expect(handlers.onDelete).toHaveBeenCalledWith(ROWS[1]);
  });

  it("opens details from the menu item", () => {
    const handlers = makeHandlers();
    renderWithProviders(<TeamsTable rows={ROWS} empty="none" {...handlers} />);
    fireEvent.click(screen.getAllByText("Details")[1]);
    expect(handlers.onDetails).toHaveBeenCalledWith(ROWS[1]);
  });
});
