/**
 * Smoke tests for DoneStepForm — the "Add sample clients and bookings" toggle
 * is dev-only (NODE_ENV === "development").
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { DoneStepForm } from "./done-form";

const {
  mockCompleteOnboardingAction,
  mockDetectImportableDemoSession,
  mockMarkDemoSignupIntent,
  mockClearDemoSignupIntent,
  mockWipeDemoLocalStorage,
} = vi.hoisted(() => ({
  mockCompleteOnboardingAction: vi.fn().mockResolvedValue({}),
  mockDetectImportableDemoSession: vi.fn(),
  mockMarkDemoSignupIntent: vi.fn(),
  mockClearDemoSignupIntent: vi.fn(),
  mockWipeDemoLocalStorage: vi.fn(),
}));

vi.mock("@/lib/actions/onboarding", () => ({
  completeOnboardingAction: () => mockCompleteOnboardingAction(),
}));

vi.mock("@/lib/page-builder/demoSession", () => ({
  detectImportableDemoSession: () => mockDetectImportableDemoSession(),
  markDemoSignupIntent: () => mockMarkDemoSignupIntent(),
  clearDemoSignupIntent: () => mockClearDemoSignupIntent(),
  wipeDemoLocalStorage: (sessionId: string) => mockWipeDemoLocalStorage(sessionId),
}));

function renderForm() {
  return renderWithProviders(
    <DoneStepForm workspaceName="Aperture & Co." plan="free" furthestStep="done" />
  );
}

function renderPortfolioForm() {
  return renderWithProviders(
    <DoneStepForm
      workspaceName="Aperture & Co."
      plan="free"
      furthestStep="done"
      finishDestination="portfolio"
    />
  );
}

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
beforeEach(() => {
  vi.clearAllMocks();
  mockCompleteOnboardingAction.mockResolvedValue({});
  mockDetectImportableDemoSession.mockReturnValue(null);
});

afterEach(() => {
  // @ts-expect-error — NODE_ENV is read-only in the types but writable at runtime
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
});

describe("DoneStepForm — celebration", () => {
  it("renders the confetti-scatter overlay and the 3-item footer", () => {
    renderForm();
    expect(screen.getByTestId("confetti-scatter")).toBeInTheDocument();
    expect(screen.getByText(/everything in one place/i)).toBeInTheDocument();
    expect(screen.getByText(/built to grow with you/i)).toBeInTheDocument();
    expect(screen.getByText(/support when you need it/i)).toBeInTheDocument();
  });

  it("uses the welcome copy without implying another onboarding task", () => {
    renderForm();
    expect(screen.getByText(/welcome to gallurio/i)).toBeInTheDocument();
    expect(screen.queryByText(/one last thing/i)).not.toBeInTheDocument();
  });

  it("labels the final action for Portfolio when onboarding came from the public builder", () => {
    renderPortfolioForm();
    expect(screen.getByRole("button", { name: /portfolio/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dashboard/i })).not.toBeInTheDocument();
  });

  it("passively detects a saved public-builder setup and applies it through Portfolio", async () => {
    mockDetectImportableDemoSession.mockReturnValue({
      sessionId: "saved-demo",
      buffer: {},
    });
    renderForm();

    expect(
      await screen.findByText("We detected a saved demo portfolio"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply saved setup" }));

    expect(mockMarkDemoSignupIntent).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mockCompleteOnboardingAction).toHaveBeenCalledTimes(1));
    expect(mockWipeDemoLocalStorage).not.toHaveBeenCalled();
  });

  it("discards a passively detected setup before completing to Dashboard", async () => {
    mockDetectImportableDemoSession.mockReturnValue({
      sessionId: "discard-demo",
      buffer: {},
    });
    renderForm();

    fireEvent.click(
      await screen.findByRole("button", { name: "Discard saved setup" }),
    );

    expect(mockWipeDemoLocalStorage).toHaveBeenCalledWith("discard-demo");
    expect(mockClearDemoSignupIntent).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mockCompleteOnboardingAction).toHaveBeenCalledTimes(1));
  });
});

describe("DoneStepForm — sample data toggle", () => {
  it("hides the sample-data toggle outside development", () => {
    // @ts-expect-error — NODE_ENV is read-only in the types but writable at runtime
    process.env.NODE_ENV = "production";
    renderForm();
    expect(screen.queryByText(/start with sample data/i)).not.toBeInTheDocument();
  });

  it("shows the sample-data toggle in development", () => {
    // @ts-expect-error — NODE_ENV is read-only in the types but writable at runtime
    process.env.NODE_ENV = "development";
    renderForm();
    expect(screen.queryByText(/start with sample data/i)).not.toBeInTheDocument();
  });
});
