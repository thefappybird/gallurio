import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { MfaSection } from "./_mfa-section";
import { toast } from "sonner";

vi.mock("../_actions", () => ({
  enrollMfaAction: vi.fn(),
  verifyMfaEnrollmentAction: vi.fn(),
  disableMfaAction: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// next/image is an <img> in tests
vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img {...props} />
  ),
}));

const { enrollMfaAction, disableMfaAction } = await import("../_actions");
const mockEnroll = vi.mocked(enrollMfaAction);
const mockDisable = vi.mocked(disableMfaAction);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MfaSection — not enabled", () => {
  it("renders the not-enabled status badge and Set Up button", () => {
    renderWithProviders(<MfaSection mfaEnabled={false} />);

    // Status badge shows not-enabled text
    expect(
      screen.getByText("Two-factor authentication is not enabled."),
    ).toBeInTheDocument();

    // Set Up button ("Set up authenticator")
    expect(
      screen.getByRole("button", { name: /Set up authenticator/i }),
    ).toBeInTheDocument();

    // Disable button must NOT be present
    expect(
      screen.queryByRole("button", {
        name: "Disable two-factor authentication for your account",
      }),
    ).not.toBeInTheDocument();
  });

  it("calls enrollMfaAction and shows QR step on Set Up click", async () => {
    mockEnroll.mockResolvedValue({
      qrCode: "data:image/png;base64,abc",
      secret: "JBSWY3DPEHPK3PXP",
      expiresAt: Date.now() + 600_000,
    });

    renderWithProviders(<MfaSection mfaEnabled={false} />);

    fireEvent.click(screen.getByRole("button", { name: /Set up authenticator/i }));

    await waitFor(() => {
      expect(mockEnroll).toHaveBeenCalledOnce();
    });

    // QR step heading
    await waitFor(() => {
      expect(screen.getByText("Scan this QR code")).toBeInTheDocument();
    });

    // Secret key is visible
    expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument();

    // Countdown + refresh controls are present
    expect(screen.getByText(/Expires in/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Refresh code/i }),
    ).toBeInTheDocument();
  });

  it("re-enrolls when the Refresh code button is clicked", async () => {
    mockEnroll.mockResolvedValue({
      qrCode: "data:image/png;base64,abc",
      secret: "JBSWY3DPEHPK3PXP",
      expiresAt: Date.now() + 600_000,
    });

    renderWithProviders(<MfaSection mfaEnabled={false} />);

    fireEvent.click(screen.getByRole("button", { name: /Set up authenticator/i }));

    const refresh = await screen.findByRole("button", {
      name: /Refresh code/i,
    });
    // Wait until the initial enrollment transition settles (button re-enabled).
    await waitFor(() => expect(refresh).not.toBeDisabled());

    fireEvent.click(refresh);

    // First call was the initial Set Up; the refresh click adds a second.
    await waitFor(() => {
      expect(mockEnroll).toHaveBeenCalledTimes(2);
    });
  });

  it("shows error toast when enrollMfaAction returns an error", async () => {
    mockEnroll.mockResolvedValue({ error: "mfa_start_failed" });

    renderWithProviders(<MfaSection mfaEnabled={false} />);

    fireEvent.click(screen.getByRole("button", { name: /Set up authenticator/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Couldn't start authenticator setup. Please try again.");
    });
  });
});

describe("MfaSection — enabled", () => {
  it("renders the enabled badge and Disable button", () => {
    renderWithProviders(<MfaSection mfaEnabled={true} />);

    // Enabled badge ("Enabled")
    expect(screen.getByText("Enabled")).toBeInTheDocument();

    // Disable button (aria-label)
    expect(
      screen.getByRole("button", {
        name: "Disable two-factor authentication for your account",
      }),
    ).toBeInTheDocument();

    // Set Up button must NOT be present
    expect(
      screen.queryByRole("button", { name: /Set up authenticator/i }),
    ).not.toBeInTheDocument();
  });

  it("calls disableMfaAction and shows success toast on Disable", async () => {
    mockDisable.mockResolvedValue({ ok: true });

    renderWithProviders(<MfaSection mfaEnabled={true} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Disable two-factor authentication for your account",
      }),
    );

    await waitFor(() => {
      expect(mockDisable).toHaveBeenCalledOnce();
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Two-factor authentication disabled.",
      );
    });

    // After disable, the Set Up button should now be visible
    expect(
      screen.getByRole("button", { name: /Set up authenticator/i }),
    ).toBeInTheDocument();
  });

  it("shows error toast when disableMfaAction returns an error", async () => {
    mockDisable.mockResolvedValue({ error: "mfa_disable_failed" });

    renderWithProviders(<MfaSection mfaEnabled={true} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Disable two-factor authentication for your account",
      }),
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Couldn't turn off two-factor. Please try again.");
    });
  });
});
