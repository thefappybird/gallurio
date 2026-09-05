import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRedirect = vi.fn((..._args: unknown[]) => {
  throw new Error("redirect called");
});
vi.mock("next/navigation", () => ({ redirect: (...a: unknown[]) => mockRedirect(...a) }));

const mockLoadOnboardingContext = vi.fn();
vi.mock("@/lib/auth/onboardingStep", () => ({
  loadOnboardingContext: () => mockLoadOnboardingContext(),
}));

const mockHasDemoImportMarker = vi.fn();
vi.mock("@/lib/auth/demoImportMarker", () => ({
  hasDemoImportMarker: () => mockHasDemoImportMarker(),
}));

import OnboardingIndexPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OnboardingIndexPage", () => {
  it("redirects to /portfolio when onboarding is already complete and the demo-import marker is present", async () => {
    mockLoadOnboardingContext.mockResolvedValue({ user: { onboardingCompletedAt: new Date() } });
    mockHasDemoImportMarker.mockResolvedValue(true);

    await expect(OnboardingIndexPage()).rejects.toThrow("redirect called");
    expect(mockRedirect).toHaveBeenCalledWith("/portfolio");
  });

  it("redirects to /dashboard when onboarding is already complete and no marker is present", async () => {
    mockLoadOnboardingContext.mockResolvedValue({ user: { onboardingCompletedAt: new Date() } });
    mockHasDemoImportMarker.mockResolvedValue(false);

    await expect(OnboardingIndexPage()).rejects.toThrow("redirect called");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });
});
