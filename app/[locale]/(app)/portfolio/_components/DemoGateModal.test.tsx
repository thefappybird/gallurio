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
  it("offers sign-up and sign-in, marking the demo intent for either path", () => {
    renderWithProviders(<DemoGateModal gate="publish" onClose={vi.fn()} />);
    const signUp = screen.getByRole("link", { name: /sign up|create.*account|get started/i });
    const signIn = screen.getByRole("link", { name: /sign in/i });

    expect(signUp).toHaveAttribute("href", "/sign-up");
    expect(signIn).toHaveAttribute("href", "/sign-in");

    fireEvent.click(signUp);
    fireEvent.click(signIn);
    expect(mockMarkDemoSignupIntent).toHaveBeenCalledTimes(2);
  });
});
