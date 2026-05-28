import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState, type ReactNode, type ReactElement, createElement } from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { ClientsPageClient } from "./clients-page-client";
import type { ClientRow } from "./clients-table";

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

// Capture the router so individual tests can assert on push/refresh.
const routerPush = vi.fn();
const routerRefresh = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
  usePathname: () => "/clients",
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

// Stub server actions — only reactivate is invoked by these smoke tests.
const reactivateMock = vi.fn();
vi.mock("@/lib/actions/clients", () => ({
  reactivateClientAction: (...args: unknown[]) => reactivateMock(...args),
}));

// Sonner toasts have no DOM side-effect we care about here; capture the mock so
// the error path can assert the failure toast fires.
import { toast } from "sonner";
vi.mock("sonner", () => ({
  toast: { loading: vi.fn(() => "toast-id"), success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

const sampleRows: ClientRow[] = [
  {
    id: "c-active",
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
    id: "c-inactive",
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

function build(overrides: Partial<React.ComponentProps<typeof ClientsPageClient>> = {}) {
  return {
    rows: sampleRows,
    total: 2,
    page: 1,
    limit: 25,
    locale: "en",
    availableTags: ["vip", "wedding"],
    empty: "No clients",
    ...overrides,
  };
}

describe("ClientsPageClient", () => {
  beforeEach(() => {
    routerPush.mockClear();
    routerRefresh.mockClear();
    reactivateMock.mockReset();
    vi.mocked(toast.error).mockClear();
  });

  it("renders toolbar, table rows, and pagination summary together", () => {
    renderWithProviders(<ClientsPageClient {...build()} />);
    // toolbar
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    // table rows
    expect(screen.getByText("Maria Santos")).toBeInTheDocument();
    expect(screen.getByText("John Dela Cruz")).toBeInTheDocument();
    // pagination summary
    expect(screen.getByText(/showing 1–2 of 2/i)).toBeInTheDocument();
  });

  it("hides pagination summary when there are no clients", () => {
    renderWithProviders(<ClientsPageClient {...build({ rows: [], total: 0 })} />);
    expect(screen.getByText("No clients")).toBeInTheDocument();
    expect(screen.queryByText(/showing/i)).not.toBeInTheDocument();
  });

  it("pagination Next button pushes a page=N URL", () => {
    renderWithProviders(
      <ClientsPageClient {...build({ total: 60, page: 1, limit: 25 })} />
    );
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(String(routerPush.mock.calls[0][0])).toMatch(/page=2/);
  });

  it("Previous button is disabled on page 1", () => {
    renderWithProviders(<ClientsPageClient {...build()} />);
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
  });

  it("reactivation calls server action and refreshes the list on success", async () => {
    reactivateMock.mockResolvedValue({ ok: true });
    renderWithProviders(<ClientsPageClient {...build()} />);

    // Inactive row menu → Reactivate. After sorting by name asc, John Dela Cruz
    // (inactive) is the first row, so its action menu is the first one.
    const menuButtons = screen.getAllByRole("button", { name: /open client actions/i });
    fireEvent.click(menuButtons[0]);
    fireEvent.click(await screen.findByText(/reactivate/i));

    await waitFor(() => expect(reactivateMock).toHaveBeenCalledWith("c-inactive"));
    await waitFor(() => expect(routerRefresh).toHaveBeenCalledTimes(1));
  });

  it("reactivation surfaces an error toast and does not refresh on server error", async () => {
    reactivateMock.mockResolvedValue({ error: "boom" });

    renderWithProviders(<ClientsPageClient {...build()} />);

    const menuButtons = screen.getAllByRole("button", { name: /open client actions/i });
    fireEvent.click(menuButtons[0]);
    fireEvent.click(await screen.findByText(/reactivate/i));

    await waitFor(() => expect(reactivateMock).toHaveBeenCalled());
    // The guarded action handles the failure via toast and never throws, so
    // there is no unhandled rejection to suppress here.
    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("boom", { id: "toast-id" })
    );
    expect(routerRefresh).not.toHaveBeenCalled();
  });
});
