/**
 * Smoke tests for DoneStepForm — the "Add sample clients and bookings" toggle
 * is dev-only (NODE_ENV === "development").
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { DoneStepForm } from "./done-form";

vi.mock("@/lib/actions/onboarding", () => ({
  completeOnboardingAction: vi.fn().mockResolvedValue({}),
}));

function renderForm() {
  return renderWithProviders(
    <DoneStepForm workspaceName="Aperture & Co." plan="free" furthestStep="done" />
  );
}

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
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
    expect(screen.getByText(/start with sample data/i)).toBeInTheDocument();
  });
});
