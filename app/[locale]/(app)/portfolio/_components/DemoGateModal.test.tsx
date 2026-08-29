import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";

const mockMarkDemoSignupIntent = vi.fn();
vi.mock("@/lib/page-builder/demoSession", () => ({
  DEMO_PROMO_CODE: "DEMOPRO2026",
  isDemoPromoClaimed: () => true,
  markDemoPromoClaimed: vi.fn(),
  markDemoSignupIntent: () => mockMarkDemoSignupIntent(),
}));

import { DemoGateModal } from "./DemoGateModal";

describe("DemoGateModal", () => {
  it("marks the demo-signup intent when the sign-up CTA is clicked", () => {
    renderWithProviders(<DemoGateModal gate="publish" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("link", { name: /sign up|create.*account|get started/i }));
    expect(mockMarkDemoSignupIntent).toHaveBeenCalled();
  });
});
