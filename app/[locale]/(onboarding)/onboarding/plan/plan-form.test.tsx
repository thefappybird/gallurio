/**
 * Smoke tests for PlanStepForm (Paddle overlay version).
 *
 * @paddle/paddle-js: initializePaddle mocked to return a stub Paddle object.
 * fetch: mocked via vi.stubGlobal to simulate checkout API responses.
 * Server actions (selectFreePlanAction, devActivatePlanAction): mocked.
 * @/lib/i18n/navigation: aliased to stub via vitest.config.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { PlanStepForm } from "./plan-form";

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

// ── Server action mocks ────────────────────────────────────────────────────
vi.mock("@/lib/actions/onboarding", () => ({
  selectFreePlanAction: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/actions/dev", () => ({
  devActivatePlanAction: vi.fn().mockResolvedValue({}),
}));

// ── fetch mock ─────────────────────────────────────────────────────────────
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  paddleCheckoutOpenMock.mockReset();
  // Set the Paddle token env var so initializePaddle is invoked.
  // (In real test env this is empty so the token-missing branch fires.)
  process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = "test_paddle_token";
  process.env.NEXT_PUBLIC_PADDLE_ENV = "sandbox";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  delete process.env.NEXT_PUBLIC_PADDLE_ENV;
});

function renderForm(props: { currentPlan?: string } = {}) {
  return renderWithProviders(
    <PlanStepForm
      currentPlan={props.currentPlan ?? "free"}
      furthestStep="plan"
    />
  );
}

describe("PlanStepForm — renders", () => {
  it("renders without crashing", () => {
    renderForm();
    // Plan card headings are <h3> — use role heading to avoid SVG text duplication
    expect(screen.getByRole("heading", { name: "Free" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pro" })).toBeInTheDocument();
  });

  it("shows the main CTA button", () => {
    renderForm();
    expect(screen.getByRole("button", { name: /continue with free/i })).toBeInTheDocument();
  });

  it("pre-selects Free when currentPlan is free", () => {
    renderForm({ currentPlan: "free" });
    expect(screen.getByRole("button", { name: /continue with free/i })).toBeInTheDocument();
  });

  it("shows a paid CTA when a paid plan is selected", async () => {
    renderForm({ currentPlan: "pro" });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /subscribe/i })).toBeInTheDocument();
    });
  });

  it("shows dev escape hatch in non-production environment", () => {
    renderForm();
    expect(screen.getByText(/dev shortcut/i)).toBeInTheDocument();
  });
});

describe("PlanStepForm — plan card selection", () => {
  it("switching to Pro changes the CTA to paid text", async () => {
    renderForm({ currentPlan: "free" });

    // Find the Pro plan card specifically by its heading
    const proHeading = screen.getByRole("heading", { name: "Pro" });
    // The heading is inside the card button — click the closest button ancestor
    const proCard = proHeading.closest("button");
    expect(proCard).not.toBeNull();
    fireEvent.click(proCard!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /subscribe.*₱/i })).toBeInTheDocument();
    });
  });
});

describe("PlanStepForm — free plan submission", () => {
  it("calls selectFreePlanAction and navigates on success", async () => {
    const { selectFreePlanAction } = await import("@/lib/actions/onboarding");

    renderForm({ currentPlan: "free" });

    const cta = screen.getByRole("button", { name: /continue with free/i });
    fireEvent.click(cta);

    await waitFor(() => {
      expect(selectFreePlanAction).toHaveBeenCalledOnce();
    });
  });
});

describe("PlanStepForm — paid plan checkout", () => {
  it("calls /api/billing/checkout and opens Paddle overlay on success", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        priceId: "pri_test_123",
        customerEmail: "test@example.com",
        workspaceId: "ws_abc",
      }),
    });

    const { initializePaddle } = await import("@paddle/paddle-js");

    renderForm({ currentPlan: "pro" });

    // Wait for Paddle to init (useEffect + async initializePaddle)
    await waitFor(() => {
      expect(initializePaddle).toHaveBeenCalled();
    });

    const cta = screen.getByRole("button", { name: /subscribe/i });
    fireEvent.click(cta);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/billing/checkout",
        expect.objectContaining({ method: "POST" })
      );
    });

    await waitFor(() => {
      expect(paddleCheckoutOpenMock).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [{ priceId: "pri_test_123", quantity: 1 }],
        })
      );
    });
  });

  it("shows an inline error and re-enables button when checkout API fails", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Server error" }),
    });

    renderForm({ currentPlan: "pro" });

    const cta = screen.getByRole("button", { name: /subscribe/i });
    fireEvent.click(cta);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // Button should be re-enabled after error
    await waitFor(() => {
      expect(cta).not.toBeDisabled();
    });
  });

  it("does not call fetch for free plan selection", async () => {
    renderForm({ currentPlan: "free" });

    const cta = screen.getByRole("button", { name: /continue with free/i });
    fireEvent.click(cta);

    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("PlanStepForm — dev activate", () => {
  it("calls devActivatePlanAction when dev button is clicked", async () => {
    const { devActivatePlanAction } = await import("@/lib/actions/dev");

    renderForm({ currentPlan: "free" });

    const devBtn = screen.getByRole("button", { name: /activate.*dev/i });
    fireEvent.click(devBtn);

    await waitFor(() => {
      expect(devActivatePlanAction).toHaveBeenCalledWith("free");
    });
  });
});

