import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render";
import { MfaForm } from "./_mfa-form";

vi.mock("../../_actions", () => ({
  mfaChallengeAction: vi.fn(),
}));

describe("MfaForm — field-level errors", () => {
  it("marks the code field invalid on a bad code", async () => {
    const { mfaChallengeAction } = await import("../../_actions");
    vi.mocked(mfaChallengeAction).mockResolvedValue({
      error: "Invalid or expired code. Please try again.",
      fieldErrors: { code: "Enter the 6-digit code." },
    });

    renderWithProviders(<MfaForm />);

    const submitButton = screen.getByRole("button", { name: "Verify" });
    fireEvent.submit(submitButton.closest("form")!);

    const codeInput = await screen.findByLabelText("Verification code");
    await waitFor(() => {
      expect(codeInput).toHaveAttribute("aria-invalid", "true");
    });
  });
});
