import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render";
import { ResetPasswordForm } from "./_reset-password-form";

vi.mock("../_actions", () => ({
  resetPasswordAction: vi.fn(),
}));

describe("ResetPasswordForm — field-level errors", () => {
  it("shows a short-password error on the password field, not only the form header", async () => {
    const { resetPasswordAction } = await import("../_actions");
    vi.mocked(resetPasswordAction).mockResolvedValue({
      error: "Please check your input and try again.",
      fieldErrors: { password: "Password must be between 8 and 128 characters." },
    });

    renderWithProviders(<ResetPasswordForm token="test-token" />);

    const submitButton = screen.getByRole("button", { name: "Set new password" });
    fireEvent.submit(submitButton.closest("form")!);

    const passwordInput = await screen.findByLabelText("New password");
    await waitFor(() => {
      expect(passwordInput).toHaveAttribute("aria-invalid", "true");
    });
  });

  it("shows a password mismatch on confirmPassword and does not duplicate the sentence up top", async () => {
    const { resetPasswordAction } = await import("../_actions");
    vi.mocked(resetPasswordAction).mockResolvedValue({
      error: "Passwords do not match.",
      fieldErrors: { confirmPassword: "Passwords do not match." },
    });

    renderWithProviders(<ResetPasswordForm token="test-token" />);

    const submitButton = screen.getByRole("button", { name: "Set new password" });
    fireEvent.submit(submitButton.closest("form")!);

    const confirmInput = await screen.findByLabelText("Confirm password");
    await waitFor(() => {
      expect(confirmInput).toHaveAttribute("aria-invalid", "true");
    });

    expect(screen.getAllByText("Passwords do not match.")).toHaveLength(1);
  });
});
