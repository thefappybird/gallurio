import { useEffect } from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render";
import { ForgotPasswordForm } from "./_forgot-password-form";

vi.mock("../_actions", () => ({
  forgotPasswordAction: vi.fn(),
}));

vi.mock("@/components/ui/turnstile-widget", () => ({
  TurnstileWidget: ({ onToken }: { onToken: (t: string) => void }) => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { onToken("test-token"); }, []);
    return <div data-testid="turnstile-widget" />;
  },
}));

describe("ForgotPasswordForm — field-level errors", () => {
  it("marks the email field invalid on a format-validation failure", async () => {
    const { forgotPasswordAction } = await import("../_actions");
    vi.mocked(forgotPasswordAction).mockResolvedValue({
      error: "Please check your input and try again.",
      fieldErrors: { email: "Enter a valid email address." },
    });

    renderWithProviders(<ForgotPasswordForm />);

    const submitButton = screen.getByRole("button", { name: "Send reset link" });
    fireEvent.submit(submitButton.closest("form")!);

    const emailInput = await screen.findByLabelText("Email");
    await waitFor(() => {
      expect(emailInput).toHaveAttribute("aria-invalid", "true");
    });
  });
});
