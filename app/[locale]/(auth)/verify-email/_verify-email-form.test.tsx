import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render";
import { VerifyEmailForm } from "./_verify-email-form";
import { resendVerificationEmailAction } from "../_actions";

vi.mock("../_actions", () => ({
  verifyEmailAction: vi.fn(),
  resendVerificationEmailAction: vi.fn(),
}));

describe("VerifyEmailForm", () => {
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
});
