import { describe, expect, it, vi } from "vitest";
import { type ReactNode, type ReactElement, createElement } from "react";
import { screen, fireEvent, within } from "@testing-library/react";
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
    onEdit: vi.fn(),
    onInvite: vi.fn(),
    onDeactivate: vi.fn(),
    onReactivate: vi.fn(),
    canManage: true,
  };
}

const ROWS: TeamRow[] = [
  { id: "t1", name: "Main", color: "#0d7377", isDefault: true, isActive: true, memberCount: 1, monthlyAverage: 1.5 },
  { id: "t2", name: "Wedding crew", color: "#7c5cff", isDefault: false, isActive: true, memberCount: 3, monthlyAverage: 2 },
];

describe("TeamsTable", () => {
  it("renders a row per team with name, default badge, and member count", () => {
    renderWithProviders(<TeamsTable rows={ROWS} empty="none" {...makeHandlers()} />);
    // Each field renders in both the mobile card list and the desktop table.
    expect(screen.getAllByText("Main").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Wedding crew").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Default").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 member").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3 members").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1.5 bookings/mo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2 bookings/mo").length).toBeGreaterThan(0);
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

  it("only offers Deactivate for non-default active teams", () => {
    renderWithProviders(<TeamsTable rows={ROWS} empty="none" {...makeHandlers()} />);
    // Main is the default team → no Deactivate item; Wedding crew → one Deactivate
    // item per rendering mode (card + desktop table) = 2 total.
    expect(screen.getAllByText("Deactivate")).toHaveLength(2);
  });

  it("fires edit / invite / deactivate handlers from the menu", () => {
    const handlers = makeHandlers();
    renderWithProviders(<TeamsTable rows={ROWS} empty="none" {...handlers} />);

    // First row (Main) menu items come first in DOM order.
    fireEvent.click(screen.getAllByText("Edit")[0]);
    expect(handlers.onEdit).toHaveBeenCalledWith(ROWS[0]);

    fireEvent.click(screen.getAllByText("Invite teammate")[0]);
    expect(handlers.onInvite).toHaveBeenCalledWith(ROWS[0]);

    // Deactivate exists only for the non-default Wedding crew row (card copy
    // comes first in DOM order).
    fireEvent.click(screen.getAllByText("Deactivate")[0]);
    expect(handlers.onDeactivate).toHaveBeenCalledWith(ROWS[1]);
  });

  it("opens details from the menu item AND from a row click", () => {
    const handlers = makeHandlers();
    renderWithProviders(<TeamsTable rows={ROWS} empty="none" {...handlers} />);

    fireEvent.click(screen.getAllByText("Details")[1]);
    expect(handlers.onDetails).toHaveBeenCalledWith(ROWS[1]);

    // Clicking anywhere on the row (e.g. the team name) also opens details.
    // Card copy comes first in DOM order.
    handlers.onDetails.mockClear();
    fireEvent.click(screen.getAllByText("Wedding crew")[0]);
    expect(handlers.onDetails).toHaveBeenCalledWith(ROWS[1]);
  });

  it("renders a mobile card list alongside the desktop table markup", () => {
    const { container } = renderWithProviders(
      <TeamsTable rows={ROWS} empty="none" {...makeHandlers()} />,
    );
    expect(screen.getByTestId("teams-card-list")).toBeInTheDocument();
    const cards = container.querySelectorAll('[data-testid="teams-card-list"] > article');
    expect(cards).toHaveLength(2);
  });

  it("shows the member count and badges in the card layout", () => {
    renderWithProviders(<TeamsTable rows={ROWS} empty="none" {...makeHandlers()} />);
    const cardList = screen.getByTestId("teams-card-list");
    expect(within(cardList).getByText("1 member")).toBeInTheDocument();
    expect(within(cardList).getByText("3 members")).toBeInTheDocument();
    expect(within(cardList).getByText("Default")).toBeInTheDocument();
    expect(within(cardList).getByText("1.5 bookings/mo")).toBeInTheDocument();
  });

  it("opens details from a card click and fires handlers from the card's actions menu", () => {
    const handlers = makeHandlers();
    renderWithProviders(<TeamsTable rows={ROWS} empty="none" {...handlers} />);
    const cardList = screen.getByTestId("teams-card-list");

    fireEvent.click(within(cardList).getByText("Wedding crew"));
    expect(handlers.onDetails).toHaveBeenCalledWith(ROWS[1]);

    // Deactivate only exists for the non-default Wedding crew row; its card
    // actions menu item should fire the same handler as the desktop table.
    handlers.onDeactivate.mockClear();
    fireEvent.click(within(cardList).getByText("Deactivate"));
    expect(handlers.onDeactivate).toHaveBeenCalledWith(ROWS[1]);
  });

  it("hides the actions menu entirely for non-owners, but row click still opens details", () => {
    const handlers = makeHandlers();
    renderWithProviders(<TeamsTable rows={ROWS} empty="none" {...handlers} canManage={false} />);

    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByText("Deactivate")).not.toBeInTheDocument();
    expect(screen.queryByText("Invite teammate")).not.toBeInTheDocument();

    const cardList = screen.getByTestId("teams-card-list");
    fireEvent.click(within(cardList).getByText("Wedding crew"));
    expect(handlers.onDetails).toHaveBeenCalledWith(ROWS[1]);
  });
});
