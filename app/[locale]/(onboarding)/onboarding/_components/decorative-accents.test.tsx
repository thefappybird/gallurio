import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { OnboardingCornerAccents } from "./decorative-accents";

const { mockUsePathname } = vi.hoisted(() => ({
  mockUsePathname: vi.fn(() => "/en/onboarding/business"),
}));
vi.mock("next/navigation", () => ({ usePathname: mockUsePathname }));

describe("OnboardingCornerAccents", () => {
  it("renders a decorative, non-interactive overlay that screen readers skip", () => {
    const { container } = render(<OnboardingCornerAccents />);
    const root = container.firstElementChild;
    expect(root).toHaveAttribute("aria-hidden");
    expect(root).toHaveClass("pointer-events-none");
  });

  it("swaps the per-step corner motif to match the current onboarding step", () => {
    mockUsePathname.mockReturnValue("/en/onboarding/workspace");
    const { container } = render(<OnboardingCornerAccents />);
    expect(container.querySelector('[data-motif="workspace"]')).not.toBeNull();
  });
});
