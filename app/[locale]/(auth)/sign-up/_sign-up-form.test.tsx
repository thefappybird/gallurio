import { useEffect } from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render";
import { SignUpForm } from "./_sign-up-form";

const { resetMock } = vi.hoisted(() => ({ resetMock: vi.fn() }));

vi.mock("../_actions", () => ({
  signUpAction: vi.fn(),
  googleSignInAction: vi.fn(),
}));

vi.mock("@/components/ui/turnstile-widget", () => ({
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

describe("Google authorization", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses a top-level browser navigation for the cross-origin WorkOS URL", async () => {
    const { googleSignInAction } = await import("../_actions");
    vi.mocked(googleSignInAction).mockResolvedValue({ url: "https://api.workos.com/authorize" });
    const assign = vi.spyOn(window.location, "assign").mockImplementation(() => undefined);

    renderWithProviders(<SignUpForm />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith("https://api.workos.com/authorize");
    });
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

describe("SignUpForm — field-level errors", () => {
  it("shows a short-password error on the password field, not only the form header", async () => {
    const { signUpAction } = await import("../_actions");
    vi.mocked(signUpAction).mockResolvedValue({
      error: "Please check your input and try again.",
      fieldErrors: { password: "Password must be between 8 and 128 characters." },
    });

    renderWithProviders(<SignUpForm />);

    const submitButton = screen.getByRole("button", { name: "Create account" });
    fireEvent.submit(submitButton.closest("form")!);

    const passwordInput = await screen.findByLabelText("Password");
    await waitFor(() => {
      expect(passwordInput).toHaveAttribute("aria-invalid", "true");
    });

    const describedBy = passwordInput.getAttribute("aria-describedby")!;
    const messageId = describedBy.split(" ").find((id) => id.endsWith("-error"));
    const message = document.getElementById(messageId!);
    expect(message).toHaveAttribute("role", "alert");
    expect(message).toHaveTextContent("Password must be between 8 and 128 characters.");
  });

  it("shows a password mismatch on confirmPassword and does not duplicate the sentence up top", async () => {
    const { signUpAction } = await import("../_actions");
    vi.mocked(signUpAction).mockResolvedValue({
      error: "Passwords do not match.",
      fieldErrors: { confirmPassword: "Passwords do not match." },
    });

    renderWithProviders(<SignUpForm />);

    const submitButton = screen.getByRole("button", { name: "Create account" });
    fireEvent.submit(submitButton.closest("form")!);

    const confirmInput = await screen.findByLabelText("Confirm password");
    await waitFor(() => {
      expect(confirmInput).toHaveAttribute("aria-invalid", "true");
    });

    expect(screen.getAllByText("Passwords do not match.")).toHaveLength(1);
  });
});
