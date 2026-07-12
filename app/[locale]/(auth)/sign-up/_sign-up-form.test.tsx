import { useEffect } from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render";
import { SignUpForm } from "./_sign-up-form";

const { resetMock } = vi.hoisted(() => ({ resetMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("../_actions", () => ({
  signUpAction: vi.fn(),
  googleSignInAction: vi.fn(),
}));

vi.mock("../_components/turnstile-widget", () => ({
  TurnstileWidget: ({
    ref,
    onToken,
  }: {
    ref?: { current: unknown } | null;
    onToken: (t: string) => void;
  }) => {
    if (ref) ref.current = { reset: resetMock };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { onToken("test-token"); }, []);
    return <div data-testid="turnstile-widget" />;
  },
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

describe("SignUpForm — bot check reset", () => {
  it("resets the Turnstile widget after a failed sign-up attempt", async () => {
    const { signUpAction } = await import("../_actions");
    vi.mocked(signUpAction).mockResolvedValue({ error: "That email is already registered." });

    renderWithProviders(<SignUpForm />);

    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Password1!" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "Password1!" } });

    const submitButton = screen.getByRole("button", { name: "Create account" });
    fireEvent.submit(submitButton.closest("form")!);

    await waitFor(() => {
      expect(resetMock).toHaveBeenCalled();
    });
  });
});
