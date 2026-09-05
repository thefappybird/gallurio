import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRedirect = vi.fn((..._args: unknown[]) => {
  throw new Error("redirect called");
});
vi.mock("next/navigation", () => ({ redirect: (...a: unknown[]) => mockRedirect(...a) }));

const mockLoadOnboardingContext = vi.fn();
vi.mock("@/lib/auth/onboardingStep", () => ({
  loadOnboardingContext: () => mockLoadOnboardingContext(),
  stepIndex: (s: string) => (s === "plan" ? 3 : 0),
}));

const mockHasDemoImportMarker = vi.fn();
vi.mock("@/lib/auth/demoImportMarker", () => ({
  hasDemoImportMarker: () => mockHasDemoImportMarker(),
}));

vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/actions/onboarding", () => ({
  reconcileLemonSqueezySubscription: vi.fn().mockResolvedValue(undefined),
}));

import DoneStepPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DoneStepPage", () => {
  it("redirects to /portfolio when onboarding is already complete and the demo-import marker is present", async () => {
    mockLoadOnboardingContext.mockResolvedValue({ user: { onboardingCompletedAt: new Date() } });
    mockHasDemoImportMarker.mockResolvedValue(true);

    await expect(DoneStepPage()).rejects.toThrow("redirect called");
    expect(mockRedirect).toHaveBeenCalledWith("/portfolio");
  });

  it("redirects to /dashboard when onboarding is already complete and no marker is present", async () => {
    mockLoadOnboardingContext.mockResolvedValue({ user: { onboardingCompletedAt: new Date() } });
    mockHasDemoImportMarker.mockResolvedValue(false);

    await expect(DoneStepPage()).rejects.toThrow("redirect called");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });
});
