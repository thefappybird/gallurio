/**
 * Smoke tests for SubscribePanel — the /subscribe gate page's owner CTA.
 *
 * useLemonSqueezyCheckout is mocked directly (unlike _panel.test.tsx's
 * lemon.js script simulation) since this trimmed panel only needs `open()`
 * to be called with the returned checkoutUrl.
 * fetch: mocked via vi.stubGlobal.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { SubscribePanel, type SubscribePanelProps } from "./_panel";

const openMock = vi.fn();
const useLemonSqueezyCheckoutMock = vi.fn();

vi.mock("@/hooks/use-lemon-squeezy-checkout", () => ({
  useLemonSqueezyCheckout: (...args: unknown[]) => useLemonSqueezyCheckoutMock(...args),
}));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  openMock.mockReset();
  openMock.mockReturnValue(true);
  useLemonSqueezyCheckoutMock.mockReset();
  useLemonSqueezyCheckoutMock.mockReturnValue({ ready: true, open: openMock });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const defaultProps: SubscribePanelProps = {
  proPricing: { currency: "PHP", monthly: 250, yearly: 2500 },
};

function renderPanel(overrides: Partial<SubscribePanelProps> = {}) {
  return renderWithProviders(<SubscribePanel {...defaultProps} {...overrides} />);
}

describe("SubscribePanel — beta-only mode (billingAvailable=false)", () => {
  it("shows a not-yet-available message instead of the subscribe CTA, and never opens checkout", () => {
    renderPanel({ billingAvailable: false });

    expect(screen.queryByRole("button", { name: /subscribe/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /monthly/i })).not.toBeInTheDocument();
    expect(useLemonSqueezyCheckoutMock).toHaveBeenCalledWith(expect.any(Function), false);
  });
});

describe("SubscribePanel — renders", () => {
  it("defaults to monthly pricing", () => {
    renderPanel();
    expect(screen.getByText(/\/ month/i)).toBeInTheDocument();
    expect(screen.queryByText(/\/ year/i)).not.toBeInTheDocument();
  });

  it("switches to yearly pricing when the cadence toggle is clicked", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("tab", { name: /yearly/i }));
    expect(screen.getByText(/\/ year/i)).toBeInTheDocument();
    expect(screen.getByText(/2,500/)).toBeInTheDocument();
    expect(screen.queryByText(/\/ month/i)).not.toBeInTheDocument();
  });

  it("shows a subscribe button", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: /subscribe/i })).toBeInTheDocument();
  });
});

describe("SubscribePanel — checkout", () => {
  it("posts { plan: 'pro' } and opens the overlay on success", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        checkoutUrl: "https://gallurio.lemonsqueezy.com/checkout/custom/abc123",
      }),
    });

    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /subscribe/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/billing/checkout",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ plan: "pro", cadence: "monthly" }),
        })
      );
    });

    await waitFor(() => {
      expect(openMock).toHaveBeenCalledWith(
        "https://gallurio.lemonsqueezy.com/checkout/custom/abc123"
      );
    });
  });

  it("includes the selected cadence in the checkout body", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        checkoutUrl: "https://gallurio.lemonsqueezy.com/checkout/custom/abc123",
      }),
    });

    renderPanel();
    fireEvent.click(screen.getByRole("tab", { name: /yearly/i }));
    fireEvent.click(screen.getByRole("button", { name: /subscribe/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/billing/checkout",
        expect.objectContaining({
          body: JSON.stringify({ plan: "pro", cadence: "yearly" }),
        })
      );
    });
  });

  it("includes returnTo in the checkout body when present", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        checkoutUrl: "https://gallurio.lemonsqueezy.com/checkout/custom/abc123",
      }),
    });

    renderPanel({ returnTo: "/inquiries?inquiryId=abc123" });
    fireEvent.click(screen.getByRole("button", { name: /subscribe/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/billing/checkout",
        expect.objectContaining({
          body: JSON.stringify({
            plan: "pro",
            cadence: "monthly",
            returnTo: "/inquiries?inquiryId=abc123",
          }),
        })
      );
    });
  });

  it("shows an inline error when the checkout API fails", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ error: "checkout_init_failed" }),
    });

    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /subscribe/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(openMock).not.toHaveBeenCalled();
  });

  it("shows an error and does not crash when the overlay isn't ready", async () => {
    useLemonSqueezyCheckoutMock.mockReturnValue({ ready: false, open: () => false });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        checkoutUrl: "https://gallurio.lemonsqueezy.com/checkout/custom/abc123",
      }),
    });

    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /subscribe/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});
