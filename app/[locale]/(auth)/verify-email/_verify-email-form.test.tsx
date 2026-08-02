import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render";
import { VerifyEmailForm } from "./_verify-email-form";
import { resendVerificationEmailAction, verifyEmailAction } from "../_actions";

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));

vi.mock("../_actions", () => ({
  verifyEmailAction: vi.fn(),
  resendVerificationEmailAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

describe("VerifyEmailForm", () => {
  it("does not resend a code merely because the page was opened", async () => {
    renderWithProviders(<VerifyEmailForm />);

    await Promise.resolve();

    expect(resendVerificationEmailAction).not.toHaveBeenCalled();
  });

  it("shows the remaining verification-session time", () => {
    renderWithProviders(<VerifyEmailForm expiresAt={Date.now() + 65_000} />);

    expect(screen.getByRole("status")).toHaveTextContent("Code expires in 1:05.");
  });

  it("shows the shared Button's loading spinner while resend is pending", async () => {
    let resolveResend: (v: { ok: true }) => void = () => {};
    vi.mocked(resendVerificationEmailAction).mockImplementation(
      () => new Promise((res) => { resolveResend = res; })
    );

    renderWithProviders(<VerifyEmailForm />);
    const resendButton = screen.getByRole("button", { name: "Resend code" });
    fireEvent.click(resendButton);

    await waitFor(() => expect(resendButton).toBeDisabled());
    expect(resendButton.querySelector(".animate-spin")).toBeInTheDocument();

    resolveResend({ ok: true });
  });

  it("marks the code field invalid on a bad code", async () => {
    vi.mocked(verifyEmailAction).mockResolvedValue({
      error: "Invalid or expired code. Please try again.",
      fieldErrors: { code: "Enter the 6-digit code." },
    });

    renderWithProviders(<VerifyEmailForm />);

    const submitButton = screen.getByRole("button", { name: "Verify email" });
    fireEvent.submit(submitButton.closest("form")!);

    const codeInput = await screen.findByLabelText("Verification code");
    await waitFor(() => {
      expect(codeInput).toHaveAttribute("aria-invalid", "true");
    });
  });
});
