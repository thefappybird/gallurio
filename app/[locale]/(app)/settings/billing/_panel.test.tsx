/**
 * Smoke tests for BillingPanel (Paddle overlay version).
 *
 * @paddle/paddle-js: initializePaddle mocked to return a stub Paddle object.
 * fetch: mocked via vi.stubGlobal.
 * @/lib/i18n/navigation: aliased to stub via vitest.config.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { BillingPanel, type BillingPanelProps } from "./_panel";

// ── Paddle mock ────────────────────────────────────────────────────────────
// vi.mock is hoisted to top-of-file, so we must use vi.hoisted() to create
// shared mocks that the factory can safely reference.
const { paddleCheckoutOpenMock } = vi.hoisted(() => ({
  paddleCheckoutOpenMock: vi.fn(),
}));

vi.mock("@paddle/paddle-js", () => ({
  initializePaddle: vi.fn().mockResolvedValue({
    Checkout: { open: paddleCheckoutOpenMock },
  }),
}));

// ── fetch mock ─────────────────────────────────────────────────────────────
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  paddleCheckoutOpenMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const defaultProps: BillingPanelProps = {
  currentPlan: "free",
  paddleSubscriptionStatus: null,
  paddleCurrentPeriodEnd: null,
  workspaceId: "ws_test_123",
  customerEmail: "owner@example.com",
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
      screen.getByRole("button", { name: /upgrade to the starter plan/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /upgrade to the pro plan/i })
    ).toBeInTheDocument();
  });

  it("does not show an upgrade button for the plan you're already on", () => {
    renderPanel({ currentPlan: "pro", paddleSubscriptionStatus: "active" });
    expect(
      screen.queryByRole("button", { name: /upgrade to the pro plan/i })
    ).not.toBeInTheDocument();
  });

  it("shows subscription status badge when status is set", () => {
    renderPanel({ currentPlan: "starter", paddleSubscriptionStatus: "active" });
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it("shows a renewal date when paddleCurrentPeriodEnd is provided", () => {
    renderPanel({
      currentPlan: "starter",
      paddleSubscriptionStatus: "active",
      paddleCurrentPeriodEnd: new Date("2026-07-01"),
    });
    expect(screen.getByText(/renews on/i)).toBeInTheDocument();
  });

  it("shows a subscription issue warning for past_due status", () => {
    renderPanel({ currentPlan: "starter", paddleSubscriptionStatus: "past_due" });
    expect(screen.getByText(/issue with your subscription/i)).toBeInTheDocument();
  });

  it("shows manage section for active subscribers on pro plan", () => {
    renderPanel({ currentPlan: "pro", paddleSubscriptionStatus: "active" });
    expect(screen.getByText(/manage subscription/i)).toBeInTheDocument();
  });
});

describe("BillingPanel — upgrade checkout", () => {
  beforeEach(() => {
    // Enable Paddle init by providing a token
    process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = "test_token";
    process.env.NEXT_PUBLIC_PADDLE_ENV = "sandbox";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    delete process.env.NEXT_PUBLIC_PADDLE_ENV;
  });

  it("calls /api/billing/checkout and opens Paddle overlay on success", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        priceId: "pri_starter_test",
        customerEmail: "owner@example.com",
        workspaceId: "ws_test_123",
      }),
    });

    const { initializePaddle } = await import("@paddle/paddle-js");

    renderPanel({ currentPlan: "free" });

    // Wait for Paddle init
    await waitFor(() => {
      expect(initializePaddle).toHaveBeenCalled();
    });

    const upgradeBtn = screen.getByRole("button", { name: /upgrade to the starter plan/i });
    fireEvent.click(upgradeBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/billing/checkout",
        expect.objectContaining({ method: "POST" })
      );
    });

    await waitFor(() => {
      expect(paddleCheckoutOpenMock).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [{ priceId: "pri_starter_test", quantity: 1 }],
        })
      );
    });
  });

  it("disables all upgrade buttons while one is loading", async () => {
    // Keep the fetch hanging to test loading state
    let resolveFetch!: (v: unknown) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    renderPanel({ currentPlan: "free" });

    const starterBtn = screen.getByRole("button", { name: /upgrade to the starter plan/i });
    const proBtn = screen.getByRole("button", { name: /upgrade to the pro plan/i });

    fireEvent.click(starterBtn);

    await waitFor(() => {
      expect(starterBtn).toBeDisabled();
      expect(proBtn).toBeDisabled();
    });

    // Resolve the fetch to clean up
    resolveFetch({
      ok: false,
      status: 500,
      json: async () => ({ error: "err" }),
    });
  });

  it("shows an inline error when checkout API fails", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "Plan not found" }),
    });

    renderPanel({ currentPlan: "free" });

    const upgradeBtn = screen.getByRole("button", { name: /upgrade to the starter plan/i });
    fireEvent.click(upgradeBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
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
