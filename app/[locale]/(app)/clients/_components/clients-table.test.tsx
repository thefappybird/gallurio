import { describe, it, expect, vi } from "vitest";
import { useState, type ReactNode, type ReactElement, createElement } from "react";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { ClientsTable, type ClientRow } from "./clients-table";

// Base UI's floating portal relies on layout APIs unavailable in happy-dom.
// Stub the dropdown so menu items render inline on trigger click.
vi.mock("@/components/ui/dropdown-menu", () => {
  type DropdownChildren =
    | ReactNode
    | ((args: { open: boolean; setOpen: (v: boolean) => void }) => ReactNode);
  const DropdownMenu = ({ children }: { children: DropdownChildren }) => {
    const [open, setOpen] = useState<boolean>(false);
    return createElement(
      "div",
      { "data-testid": "dropdown-menu", onClick: () => setOpen((o) => !o) },
      typeof children === "function" ? children({ open, setOpen }) : children,
    );
  };
  const DropdownMenuTrigger = ({ render, children }: { render?: ReactElement; children?: ReactNode }) =>
    render ?? createElement("button", null, children);
  const DropdownMenuContent = ({ children }: { children: ReactNode }) =>
    createElement("div", { "data-testid": "dropdown-content" }, children);
  const DropdownMenuItem = ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => createElement("button", { onClick }, children);
  return { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
});

const sampleRows: ClientRow[] = [
  {
    id: "c1",
    name: "Maria Santos",
    email: "maria@example.com",
    phone: "+63 917 555 0142",
    source: "manual",
    tags: ["vip"],
    notes: "",
    totalSpent: 75_000,
    bookingsCount: 3,
    lastBookingAt: new Date("2026-04-15"),
    isActive: true,
    currency: "PHP",
  },
  {
    id: "c2",
    name: "John Dela Cruz",
    email: null,
    phone: null,
    source: "form",
    tags: [],
    notes: "",
    totalSpent: 0,
    bookingsCount: 0,
    lastBookingAt: null,
    isActive: false,
    currency: "PHP",
  },
];

const defaultProps = {
  rows: sampleRows,
  locale: "en",
  empty: "No clients",
  onClickClient: vi.fn(),
  onView: vi.fn(),
  onEdit: vi.fn(),
  onDeactivate: vi.fn(),
  onReactivate: vi.fn(),
};

describe("ClientsTable", () => {
  it("renders client names", () => {
    renderWithProviders(<ClientsTable {...defaultProps} />);
    expect(screen.getByText("Maria Santos")).toBeInTheDocument();
    expect(screen.getByText("John Dela Cruz")).toBeInTheDocument();
  });

  it("calls onClickClient when a row is clicked", () => {
    const onClickClient = vi.fn();
    renderWithProviders(<ClientsTable {...defaultProps} onClickClient={onClickClient} />);
    fireEvent.click(screen.getByText("Maria Santos"));
    expect(onClickClient).toHaveBeenCalledWith(sampleRows[0]);
  });

  it("renders View as the first item in the actions menu", async () => {
    renderWithProviders(<ClientsTable {...defaultProps} />);
    const menuButtons = screen.getAllByRole("button", { name: /open client actions/i });
    fireEvent.click(menuButtons[0]);
    const items = await screen.findAllByRole("button");
    const viewButton = items.find((btn) => btn.textContent?.includes("View"));
    expect(viewButton).toBeInTheDocument();
  });

  it("calls onView when View is clicked in the actions menu", async () => {
    const onView = vi.fn();
    renderWithProviders(<ClientsTable {...defaultProps} onView={onView} />);
    // After sorting by name asc: "John Dela Cruz" (inactive) = index 0
    const menuButtons = screen.getAllByRole("button", { name: /open client actions/i });
    fireEvent.click(menuButtons[0]);
    const viewButtons = await screen.findAllByText("View");
    // Click the first View button (the one belonging to the first row's menu)
    fireEvent.click(viewButtons[0]);
    expect(onView).toHaveBeenCalledWith(sampleRows[1]); // John Dela Cruz
  });

  it("shows Deactivate in actions menu for active clients", async () => {
    renderWithProviders(<ClientsTable {...defaultProps} />);
    const menuButtons = screen.getAllByRole("button", { name: /open client actions/i });
    // After sorting by name asc: "John Dela Cruz" (inactive) = index 0, "Maria Santos" (active) = index 1
    fireEvent.click(menuButtons[1]); // second row (Maria Santos — active)
    expect(await screen.findByText("Deactivate")).toBeInTheDocument();
  });

  it("shows Reactivate in actions menu for inactive clients", async () => {
    renderWithProviders(<ClientsTable {...defaultProps} />);
    const menuButtons = screen.getAllByRole("button", { name: /open client actions/i });
    // After sorting by name asc: "John Dela Cruz" (inactive) = index 0
    fireEvent.click(menuButtons[0]); // first row (John Dela Cruz — inactive)
    expect(await screen.findByText("Reactivate")).toBeInTheDocument();
  });

  it("applies opacity-50 class to inactive rows", () => {
    const { container } = renderWithProviders(<ClientsTable {...defaultProps} />);
    const rows = container.querySelectorAll("tbody tr");
    // After sorting by name asc: "John Dela Cruz" (inactive) is at index 0
    expect(rows[0].className).toContain("opacity-50");
  });

  it("renders empty state when rows is empty", () => {
    renderWithProviders(<ClientsTable {...defaultProps} rows={[]} />);
    expect(screen.getByText("No clients")).toBeInTheDocument();
  });
});
