/**
 * Smoke tests for BillingPanel (Lemon Squeezy overlay version).
 *
 * lemon.js: loaded via a real <script> tag appended to document.body — we
 * intercept that by stubbing window.createLemonSqueezy/window.LemonSqueezy
 * directly and firing the script's onload handler manually (jsdom doesn't
 * execute remote script src, so we simulate the load callback).
 * fetch: mocked via vi.stubGlobal.
 * @/lib/i18n/navigation: aliased to stub via vitest.config.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { BillingPanel, type BillingPanelProps } from "./_panel";

vi.mock("@/lib/actions/billing", () => ({
  getSubscriptionManageUrlAction: vi.fn(),
}));

import { getSubscriptionManageUrlAction } from "@/lib/actions/billing";
const mockGetManageUrl = vi.mocked(getSubscriptionManageUrlAction);

const urlOpenMock = vi.fn();
const createLemonSqueezyMock = vi.fn();

// ── fetch mock ─────────────────────────────────────────────────────────────
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  urlOpenMock.mockReset();
  createLemonSqueezyMock.mockReset();
  mockGetManageUrl.mockReset();

  window.createLemonSqueezy = createLemonSqueezyMock.mockImplementation(() => {
    window.LemonSqueezy = {
      Setup: vi.fn(),
      Url: { Open: urlOpenMock },
    };
  });

  // jsdom doesn't fetch/execute the remote lemon.js script src — fire the
  // component's script.onload handler as soon as it appends the tag so
  // `lsReady` flips true synchronously in tests.
  const originalAppendChild = document.body.appendChild.bind(document.body);
  vi.spyOn(document.body, "appendChild").mockImplementation((node: Node) => {
    const result = originalAppendChild(node);
    if (node instanceof HTMLScriptElement && node.src.includes("lemon.js")) {
      node.onload?.(new Event("load"));
    }
    return result;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (window as { createLemonSqueezy?: unknown }).createLemonSqueezy;
  delete (window as { LemonSqueezy?: unknown }).LemonSqueezy;
});

const defaultProps: BillingPanelProps = {
  currentPlan: "free",
  lsSubscriptionStatus: null,
  lsCurrentPeriodEnd: null,
  workspaceId: "ws_test_123",
  customerEmail: "owner@example.com",
  proPricing: { currency: "PHP", monthly: 250, yearly: 2500 },
};

function renderPanel(overrides: Partial<BillingPanelProps> = {}) {
  return renderWithProviders(<BillingPanel {...defaultProps} {...overrides} />);
}

describe("BillingPanel — renders", () => {
  it("renders without crashing for a free plan user", () => {
    renderPanel();
    expect(screen.getByText(/current plan/i)).toBeInTheDocument();
  });

  it("shows the current plan name", () => {
    renderPanel({ currentPlan: "starter" });
    // The plan name badge shows "Starter"
    expect(screen.getByText("Starter")).toBeInTheDocument();
  });

  it("shows upgrade CTAs for a free plan user", () => {
    renderPanel({ currentPlan: "free" });
    // Buttons have aria-label "Upgrade to the {Plan} plan"
    expect(
      screen.getByRole("button", { name: /upgrade to the pro plan/i })
    ).toBeInTheDocument();
  });

  it("shows monthly and yearly Pro prices", () => {
    renderPanel({ currentPlan: "free" });
    expect(screen.getByText(/\/ month/i)).toBeInTheDocument();
    expect(screen.getByText(/\/ year/i)).toBeInTheDocument();
    expect(screen.getByText(/2,500/)).toBeInTheDocument();
  });

  it("does not show an upgrade button for the plan you're already on", () => {
    renderPanel({ currentPlan: "pro", lsSubscriptionStatus: "active" });
    expect(
      screen.queryByRole("button", { name: /upgrade to the pro plan/i })
    ).not.toBeInTheDocument();
  });

  it("shows subscription status badge when status is set", () => {
    renderPanel({ currentPlan: "starter", lsSubscriptionStatus: "active" });
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it("shows a renewal date when lsCurrentPeriodEnd is provided", () => {
    renderPanel({
      currentPlan: "starter",
      lsSubscriptionStatus: "active",
      lsCurrentPeriodEnd: new Date("2026-07-01"),
    });
    expect(screen.getByText(/renews on/i)).toBeInTheDocument();
  });

  it("shows a subscription issue warning for past_due status", () => {
    renderPanel({ currentPlan: "starter", lsSubscriptionStatus: "past_due" });
    expect(screen.getByText(/issue with your subscription/i)).toBeInTheDocument();
  });

  it("shows manage section for active subscribers on pro plan", () => {
    renderPanel({ currentPlan: "pro", lsSubscriptionStatus: "active" });
    expect(
      screen.getByRole("button", { name: /manage subscription/i })
    ).toBeInTheDocument();
  });
});

describe("BillingPanel — upgrade checkout", () => {
  it("calls /api/billing/checkout and opens the Lemon Squeezy overlay on success", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        checkoutUrl: "https://gallurio.lemonsqueezy.com/checkout/custom/abc123",
        workspaceId: "ws_test_123",
      }),
    });

    renderPanel({ currentPlan: "free" });

    await waitFor(() => {
      expect(createLemonSqueezyMock).toHaveBeenCalled();
    });

    const upgradeBtn = screen.getByRole("button", { name: /upgrade to the pro plan/i });
    fireEvent.click(upgradeBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/billing/checkout",
        expect.objectContaining({ method: "POST" })
      );
    });

    await waitFor(() => {
      expect(urlOpenMock).toHaveBeenCalledWith(
        "https://gallurio.lemonsqueezy.com/checkout/custom/abc123"
      );
    });
  });

  it("shows an inline error when checkout API fails", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "Plan not found" }),
    });

    renderPanel({ currentPlan: "free" });

    const upgradeBtn = screen.getByRole("button", { name: /upgrade to the pro plan/i });
    fireEvent.click(upgradeBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("shows an error and does not crash when lemon.js hasn't loaded yet", async () => {
    // Don't let the script's onload fire — simulate a still-loading overlay.
    vi.restoreAllMocks();
    delete (window as { createLemonSqueezy?: unknown }).createLemonSqueezy;
    delete (window as { LemonSqueezy?: unknown }).LemonSqueezy;

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        checkoutUrl: "https://gallurio.lemonsqueezy.com/checkout/custom/abc123",
        workspaceId: "ws_test_123",
      }),
    });

    renderPanel({ currentPlan: "free" });

    const upgradeBtn = screen.getByRole("button", { name: /upgrade to the pro plan/i });
    fireEvent.click(upgradeBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(urlOpenMock).not.toHaveBeenCalled();
  });
});

describe("BillingPanel — manage subscription", () => {
  it("opens the Lemon Squeezy customer portal URL on click", async () => {
    mockGetManageUrl.mockResolvedValueOnce({
      ok: true,
      url: "https://gallurio.lemonsqueezy.com/billing/portal/abc123",
    });
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    renderPanel({ currentPlan: "pro", lsSubscriptionStatus: "active" });

    fireEvent.click(screen.getByRole("button", { name: /manage subscription/i }));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        "https://gallurio.lemonsqueezy.com/billing/portal/abc123",
        "_blank",
        "noopener,noreferrer"
      );
    });
  });

  it("does not open a new tab when the action returns an error", async () => {
    mockGetManageUrl.mockResolvedValueOnce({ error: "no_subscription" });
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    renderPanel({ currentPlan: "pro", lsSubscriptionStatus: "active" });

    fireEvent.click(screen.getByRole("button", { name: /manage subscription/i }));

    await waitFor(() => {
      expect(mockGetManageUrl).toHaveBeenCalled();
    });
    expect(openSpy).not.toHaveBeenCalled();
  });
});

describe("BillingPanel — accessibility", () => {
  it("each upgrade button has an accessible aria-label", () => {
    renderPanel({ currentPlan: "free" });
    const btns = screen.getAllByRole("button", { name: /upgrade to the .+ plan/i });
    expect(btns.length).toBeGreaterThan(0);
    btns.forEach((btn) => {
      expect(btn).toHaveAttribute("aria-label");
    });
  });
});
