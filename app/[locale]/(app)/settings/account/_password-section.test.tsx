import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { PasswordSection } from "./_password-section";

vi.mock("../_actions", () => ({
  updatePasswordAction: vi.fn(),
  sendSetPasswordEmailAction: vi.fn(),
}));

describe("PasswordSection", () => {
  it("renders the change-password form for password users", () => {
    renderWithProviders(<PasswordSection hasOAuth={false} />);
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Change password" }),
    ).toBeInTheDocument();
  });

  it("renders the set-password card for OAuth users", () => {
    renderWithProviders(<PasswordSection hasOAuth={true} />);
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Set a password" }),
    ).toBeInTheDocument();
  });
});
