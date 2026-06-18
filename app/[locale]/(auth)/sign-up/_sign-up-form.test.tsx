import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render";
import { SignUpForm } from "./_sign-up-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("../_actions", () => ({
  signUpAction: vi.fn(),
  googleSignInAction: vi.fn(),
}));

vi.mock("../_components/turnstile-widget", () => ({
  TurnstileWidget: () => <div data-testid="turnstile-widget" />,
}));

describe("SignUpForm", () => {
  it("prefills and disables the email field when invite email is locked", () => {
    renderWithProviders(<SignUpForm lockedEmail="invitee@example.com" />);

    const emailInput = screen.getByLabelText("Email") as HTMLInputElement;
    expect(emailInput.value).toBe("invitee@example.com");
    expect(emailInput).toBeDisabled();

    const hiddenEmail = document.querySelector(
      'input[type="hidden"][name="email"]',
    ) as HTMLInputElement | null;
    expect(hiddenEmail?.value).toBe("invitee@example.com");
  });

  it("keeps the email field editable when no invite email is provided", () => {
    renderWithProviders(<SignUpForm />);

    const emailInput = screen.getByLabelText("Email");
    expect(emailInput).toBeEnabled();
    expect(emailInput).toHaveAttribute("name", "email");
  });
});
