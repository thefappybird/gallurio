import { afterEach, describe, it, expect, vi } from "vitest";
import { useEffect } from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { renderWithProviders } from "@/test-utils/render";
import { SignInForm } from "./_sign-in-form";

const { resetMock } = vi.hoisted(() => ({ resetMock: vi.fn() }));

vi.mock("../_actions", () => ({
  signInAction: vi.fn(),
  googleSignInAction: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
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

describe("SignInForm — bot check reset", () => {
  it("resets the Turnstile widget after a failed sign-in attempt", async () => {
    const { signInAction } = await import("../_actions");
    vi.mocked(signInAction).mockResolvedValue({ error: "Invalid email or password." });

    renderWithProviders(<SignInForm />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });

    const submitButton = screen.getByRole("button", { name: "Sign in" });
    fireEvent.submit(submitButton.closest("form")!);

    await waitFor(() => {
      expect(resetMock).toHaveBeenCalled();
    });
  });
});

describe("Google authorization", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses a top-level browser navigation for the cross-origin WorkOS URL", async () => {
    const { googleSignInAction } = await import("../_actions");
    vi.mocked(googleSignInAction).mockResolvedValue({ url: "https://api.workos.com/authorize" });
    const assign = vi.spyOn(window.location, "assign").mockImplementation(() => undefined);

    renderWithProviders(<SignInForm returnTo="/onboarding/plan" />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith("https://api.workos.com/authorize");
    });
  });
});

describe("expired verification session", () => {
  afterEach(() => vi.clearAllMocks());

  it("shows an expiry toast after being redirected to sign-in", () => {
    renderWithProviders(<SignInForm sessionExpired />);

    expect(toast.error).toHaveBeenCalledWith("Your session has expired. Please sign in again.");
  });
});

describe("SignInForm — field-level errors", () => {
  afterEach(() => vi.clearAllMocks());

  it("marks the email field invalid on a format-validation failure", async () => {
    const { signInAction } = await import("../_actions");
    vi.mocked(signInAction).mockResolvedValue({
      error: "Please check your input and try again.",
      fieldErrors: { email: "Enter a valid email address." },
    });

    renderWithProviders(<SignInForm />);

    const submitButton = screen.getByRole("button", { name: "Sign in" });
    fireEvent.submit(submitButton.closest("form")!);

    const emailInput = await screen.findByLabelText("Email");
    await waitFor(() => {
      expect(emailInput).toHaveAttribute("aria-invalid", "true");
    });
  });

  it("a wrong-password attempt shows only the generic error and marks no field invalid (no account enumeration)", async () => {
    const { signInAction } = await import("../_actions");
    vi.mocked(signInAction).mockResolvedValue({ error: "Invalid email or password." });

    renderWithProviders(<SignInForm />);

    const submitButton = screen.getByRole("button", { name: "Sign in" });
    fireEvent.submit(submitButton.closest("form")!);

    await screen.findByText("Invalid email or password.");

    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("Password")).not.toHaveAttribute("aria-invalid");
  });
});
