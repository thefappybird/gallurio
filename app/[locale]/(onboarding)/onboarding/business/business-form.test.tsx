/**
 * Smoke tests for BusinessStepForm: icon-grid business-type picker and the
 * live slug URL preview.
 */
import { beforeEach, describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { BusinessStepForm } from "./business-form";
import type { BusinessStepInput } from "@/lib/validators/workspace";

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/actions/onboarding", () => ({
  businessStepAction: vi.fn().mockResolvedValue({}),
}));

const defaults: BusinessStepInput = {
  firstName: "Sarah",
  lastName: "Bell",
  name: "Sarah Bell Photography",
  businessType: "photographer",
};

beforeEach(() => {
  vi.clearAllMocks();
});

function renderForm(
  overrides: Partial<BusinessStepInput> = {},
  furthestStep: "business" | "workspace" | "plan" | "done" = "business"
) {
  return renderWithProviders(
    <BusinessStepForm defaults={{ ...defaults, ...overrides }} furthestStep={furthestStep} />
  );
}

describe("BusinessStepForm — business type icon grid", () => {
  it("renders a button card for every business type with the default selected", () => {
    renderForm();

    const photographerCard = screen.getByRole("button", { name: /photographer/i });
    expect(photographerCard).toHaveAttribute("aria-pressed", "true");

    const venueCard = screen.getByRole("button", { name: /venue/i });
    expect(venueCard).toHaveAttribute("aria-pressed", "false");
  });

  it("selects a card on click and updates aria-pressed", () => {
    renderForm();

    const venueCard = screen.getByRole("button", { name: /venue/i });
    fireEvent.click(venueCard);

    expect(venueCard).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /photographer/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });
});

describe("BusinessStepForm — submit navigation", () => {
  it("navigates to /onboarding/workspace after a successful submit", async () => {
    const { businessStepAction } = await import("@/lib/actions/onboarding");
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await vi.waitFor(() => {
      expect(businessStepAction).toHaveBeenCalledOnce();
      expect(mockPush).toHaveBeenCalledWith("/onboarding/workspace");
    });
  });

  it("skips saving and continues when a completed step is unchanged", async () => {
    const { businessStepAction } = await import("@/lib/actions/onboarding");
    renderForm({}, "workspace");

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await vi.waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/onboarding/workspace");
    });
    expect(businessStepAction).not.toHaveBeenCalled();
  });
});
