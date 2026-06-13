import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { PasswordSection } from "./_password-section";
import { updatePasswordAction } from "../_actions";
import { toast } from "sonner";

vi.mock("../_actions", () => ({
  updatePasswordAction: vi.fn(),
  sendSetPasswordEmailAction: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockUpdatePassword = vi.mocked(updatePasswordAction);

describe("PasswordSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("submits the filled-in values to updatePasswordAction", async () => {
    mockUpdatePassword.mockResolvedValue({ ok: true });
    renderWithProviders(<PasswordSection hasOAuth={false} />);

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "oldpassword" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "newpassword123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "newpassword123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Change password" }),
    );

    await waitFor(() => {
      expect(mockUpdatePassword).toHaveBeenCalledWith({
        currentPassword: "oldpassword",
        newPassword: "newpassword123",
        confirmPassword: "newpassword123",
      });
    });
  });

  it("shows an error toast when updatePasswordAction returns an error", async () => {
    mockUpdatePassword.mockResolvedValue({
      error: "Current password is incorrect.",
    });
    renderWithProviders(<PasswordSection hasOAuth={false} />);

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "wrongpassword" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "newpassword123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "newpassword123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Change password" }),
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Current password is incorrect.");
    });
  });
});
