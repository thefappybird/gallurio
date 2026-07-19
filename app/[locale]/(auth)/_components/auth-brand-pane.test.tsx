import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render";
import { AuthBrandPane } from "./auth-brand-pane";
import { usePathname } from "@/lib/i18n/navigation";

vi.mock("@/lib/i18n/navigation", () => ({
  usePathname: vi.fn(() => "/sign-in"),
}));

describe("AuthBrandPane", () => {
  it("renders the sign-in headline for the /sign-in route", () => {
    vi.mocked(usePathname).mockReturnValue("/sign-in");
    renderWithProviders(<AuthBrandPane />);

    expect(
      screen.getByRole("heading", { name: "Welcome back to the ledger." }),
    ).toBeInTheDocument();
  });

  it("renders the mfa headline for the /sign-in/mfa route", () => {
    vi.mocked(usePathname).mockReturnValue("/sign-in/mfa");
    renderWithProviders(<AuthBrandPane />);

    expect(
      screen.getByRole("heading", { name: "One more entry." }),
    ).toBeInTheDocument();
  });
});
