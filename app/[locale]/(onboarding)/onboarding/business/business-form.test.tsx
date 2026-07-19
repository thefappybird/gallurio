/**
 * Smoke tests for BusinessStepForm: icon-grid business-type picker and the
 * live slug URL preview.
 */
import { beforeEach, describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders, enMessages } from "@/test-utils/render";
import { BusinessStepForm } from "./business-form";
import type { BusinessStepInput } from "@/lib/validators/workspace";

// businessTypes.artists / businessTypeOtherLabel / businessTypeOtherPlaceholder
// are new locale keys not yet landed in messages/*.json (frontend agents don't
// edit locale files) — overlay them here so the component's real t() calls
// resolve during the test. See PR report for the exact keys to add.
const messagesWithArtists = {
  ...enMessages,
  onboarding: {
    ...enMessages.onboarding,
    business: {
      ...enMessages.onboarding.business,
      businessTypes: {
        ...enMessages.onboarding.business.businessTypes,
        artists: "Artists",
      },
      businessTypeOtherLabel: "What kind of business?",
      businessTypeOtherPlaceholder: "e.g. Tattoo studio, DJ, florist",
    },
  },
};

const { mockPush, mockRefresh } = vi.hoisted(() => ({ mockPush: vi.fn(), mockRefresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

vi.mock("@/lib/actions/onboarding", () => ({
  businessStepAction: vi.fn().mockResolvedValue({}),
}));

const defaults: BusinessStepInput = {
  firstName: "Sarah",
  lastName: "Bell",
  name: "Sarah Bell Photography",
  businessType: "photographer",
  businessTypeOther: "",
};

beforeEach(() => {
  vi.clearAllMocks();
});

function renderForm(
  overrides: Partial<BusinessStepInput> = {},
  furthestStep: "business" | "workspace" | "plan" | "done" = "business"
) {
  return renderWithProviders(
    <BusinessStepForm defaults={{ ...defaults, ...overrides }} furthestStep={furthestStep} />,
    { messages: messagesWithArtists }
  );
}

describe("BusinessStepForm — business type icon grid", () => {
  it("lays out the business-type picker as a grid, not a wrapping flex row", () => {
    renderForm();

    const group = screen.getByRole("group", { name: /business type/i });
    expect(group.className).toMatch(/\bgrid\b/);
    expect(group.className).not.toMatch(/\bflex\b/);
  });

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

describe("BusinessStepForm — artists type + other free text", () => {
  it("renders an Artists tile that selects businessType 'artists' on click", () => {
    renderForm();

    const artistsCard = screen.getByRole("button", { name: /artists/i });
    fireEvent.click(artistsCard);

    expect(artistsCard).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the free-text 'other' input only when 'other' is selected, and surfaces the required error", async () => {
    renderForm();

    expect(screen.queryByLabelText(/what kind of business/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^other$/i }));

    const otherInput = screen.getByLabelText(/what kind of business/i);
    expect(otherInput).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(await screen.findByText(/tell us your business type/i)).toBeInTheDocument();
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

  it("refreshes the router cache before navigating on a successful submit, so Back shows saved input", async () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await vi.waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/onboarding/workspace");
    });
    expect(mockRefresh).toHaveBeenCalled();
  });
});
