/**
 * Smoke tests for PlanStepForm (Lemon Squeezy overlay version).
 *
 * lemon.js: loaded via a real <script> tag appended to document.body — we
 * intercept that by stubbing window.createLemonSqueezy/window.LemonSqueezy
 * directly and firing the script's onload handler manually (jsdom doesn't
 * execute remote script src, so we simulate the load callback).
 * fetch: mocked via vi.stubGlobal to simulate checkout API responses.
 * Server actions (selectFreePlanAction, devActivatePlanAction): mocked.
 * @/lib/i18n/navigation: aliased to stub via vitest.config.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { PlanStepForm } from "./plan-form";

const { mockRouterPush } = vi.hoisted(() => ({
  mockRouterPush: vi.fn(),
}));

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

// ── Server action mocks ────────────────────────────────────────────────────
vi.mock("@/lib/actions/onboarding", () => ({
  selectFreePlanAction: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/actions/dev", () => ({
  devActivatePlanAction: vi.fn().mockResolvedValue({}),
}));

const urlOpenMock = vi.fn();
const createLemonSqueezyMock = vi.fn();

// ── fetch mock ─────────────────────────────────────────────────────────────
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  urlOpenMock.mockReset();
  createLemonSqueezyMock.mockReset();
  mockRouterPush.mockReset();

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

function renderForm(props: { currentPlan?: string; furthestStep?: "business" | "workspace" | "plan" | "done" } = {}) {
  return renderWithProviders(
    <PlanStepForm
      currentPlan={props.currentPlan ?? "free"}
      furthestStep={props.furthestStep ?? "plan"}
      proPricing={{ currency: "PHP", monthly: 250, yearly: 2500 }}
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

  it("skips saving and continues when a completed plan step is unchanged", async () => {
    const { selectFreePlanAction } = await import("@/lib/actions/onboarding");

    renderForm({ currentPlan: "free", furthestStep: "done" });

    const cta = screen.getByRole("button", { name: /continue with free/i });
    fireEvent.click(cta);

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith("/onboarding/done");
    });
    expect(selectFreePlanAction).not.toHaveBeenCalled();
  });
});

describe("PlanStepForm — paid plan checkout", () => {
  it("calls /api/billing/checkout and opens the Lemon Squeezy overlay on success", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        checkoutUrl: "https://gallurio.lemonsqueezy.com/checkout/custom/abc123",
        workspaceId: "ws_abc",
      }),
    });

    renderForm({ currentPlan: "pro" });

    await waitFor(() => {
      expect(createLemonSqueezyMock).toHaveBeenCalled();
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
      expect(urlOpenMock).toHaveBeenCalledWith(
        "https://gallurio.lemonsqueezy.com/checkout/custom/abc123"
      );
    });
  });

  it("sends the selected cadence in the checkout request body", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        checkoutUrl: "https://gallurio.lemonsqueezy.com/checkout/custom/abc123",
        workspaceId: "ws_abc",
      }),
    });

    renderForm({ currentPlan: "pro" });

    await waitFor(() => {
      expect(createLemonSqueezyMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("tab", { name: /yearly/i }));

    const cta = screen.getByRole("button", { name: /subscribe/i });
    fireEvent.click(cta);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/billing/checkout",
        expect.objectContaining({
          body: JSON.stringify({ plan: "pro", cadence: "yearly", onboarding: true }),
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

  it("shows an error and does not crash when lemon.js hasn't loaded yet", async () => {
    // Don't let the script's onload fire — simulate a still-loading overlay.
    vi.restoreAllMocks();
    delete (window as { createLemonSqueezy?: unknown }).createLemonSqueezy;
    delete (window as { LemonSqueezy?: unknown }).LemonSqueezy;

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        checkoutUrl: "https://gallurio.lemonsqueezy.com/checkout/custom/abc123",
        workspaceId: "ws_abc",
      }),
    });

    renderForm({ currentPlan: "pro" });

    const cta = screen.getByRole("button", { name: /subscribe/i });
    fireEvent.click(cta);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(urlOpenMock).not.toHaveBeenCalled();
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

  it("calls devActivatePlanAction with beta when the beta dev button is clicked, regardless of selected card", async () => {
    const { devActivatePlanAction } = await import("@/lib/actions/dev");

    renderForm({ currentPlan: "free" });

    const betaBtn = screen.getByRole("button", { name: /beta/i });
    fireEvent.click(betaBtn);

    await waitFor(() => {
      expect(devActivatePlanAction).toHaveBeenCalledWith("beta");
    });
  });
});

describe("PlanStepForm — cadence toggle", () => {
  it("toggling to yearly updates the Pro card price and shows the save badge", async () => {
    renderForm({ currentPlan: "pro" });

    const proCard = screen.getByRole("heading", { name: "Pro" }).closest("button")!;
    expect(within(proCard).getByText("₱250")).toBeInTheDocument();
    expect(screen.queryByText(/save 2 months/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /yearly/i }));

    await waitFor(() => {
      expect(within(proCard).getByText("₱2,500")).toBeInTheDocument();
    });
    expect(within(proCard).getByText("₱3,000")).toHaveClass("line-through");
    expect(screen.getByText(/save 2 months/i)).toBeInTheDocument();
  });
});
