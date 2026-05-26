import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { ClientsToolbar } from "./clients-toolbar";

// Mock navigation
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/clients",
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const defaultProps = {
  availableTags: ["vip", "wedding"],
  onAddClient: vi.fn(),
};

describe("ClientsToolbar", () => {
  it("renders search input", () => {
    renderWithProviders(<ClientsToolbar {...defaultProps} />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it("renders source filter select", () => {
    renderWithProviders(<ClientsToolbar {...defaultProps} />);
    expect(screen.getByText(/all sources/i)).toBeInTheDocument();
  });

  it("renders Show Inactive switch", () => {
    renderWithProviders(<ClientsToolbar {...defaultProps} />);
    expect(screen.getByText(/show inactive/i)).toBeInTheDocument();
  });

  it("renders Add Client button and calls onAddClient on click", () => {
    const onAddClient = vi.fn();
    renderWithProviders(<ClientsToolbar {...defaultProps} onAddClient={onAddClient} />);
    fireEvent.click(screen.getByRole("button", { name: /add client/i }));
    expect(onAddClient).toHaveBeenCalledOnce();
  });

  it("does not render tags popover when availableTags is empty", () => {
    renderWithProviders(<ClientsToolbar {...defaultProps} availableTags={[]} />);
    expect(screen.queryByLabelText(/all tags/i)).not.toBeInTheDocument();
  });
});
