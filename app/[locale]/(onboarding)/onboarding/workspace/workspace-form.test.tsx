/**
 * Smoke tests for WorkspaceStepForm: country/timezone selects and the
 * 12h/24h time-format toggle.
 */
import { beforeEach, describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { WorkspaceStepForm } from "./workspace-form";
import type { WorkspaceSetupInput } from "@/lib/validators/workspace";

const { mockPush, mockRefresh } = vi.hoisted(() => ({ mockPush: vi.fn(), mockRefresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

vi.mock("@/lib/actions/onboarding", () => ({
  workspaceStepAction: vi.fn().mockResolvedValue({}),
}));

const { mockUseSlugAvailability } = vi.hoisted(() => ({
  mockUseSlugAvailability: vi.fn(() => ({ status: "idle" })),
}));
vi.mock("@/hooks/useSlugAvailability", () => ({
  useSlugAvailability: mockUseSlugAvailability,
}));

const defaults: WorkspaceSetupInput = {
  slug: "sarah-bell",
  country: "PH",
  timezone: "Asia/Manila",
  timeFormat: "24h",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseSlugAvailability.mockReturnValue({ status: "idle" });
});

function renderForm(
  overrides: Partial<WorkspaceSetupInput> = {},
  furthestStep: "business" | "workspace" | "plan" | "done" = "workspace"
) {
  return renderWithProviders(
    <WorkspaceStepForm defaults={{ ...defaults, ...overrides }} furthestStep={furthestStep} />
  );
}

describe("WorkspaceStepForm", () => {
  it("renders country and timezone selects with the 24h option active by default", () => {
    renderForm();

    expect(screen.getByLabelText(/country/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/timezone/i)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /24h/i })).toHaveAttribute("aria-selected", "true");
  });

  it("shows a live gallurio.com/w/<slug> preview as the slug input changes", () => {
    renderForm();

    expect(screen.getByText(/gallurio\.com\/w\/sarah-bell/)).toBeInTheDocument();

    const slugInput = screen.getByLabelText(/workspace url/i);
    fireEvent.change(slugInput, { target: { value: "new-slug" } });

    expect(screen.getByText(/gallurio\.com\/w\/new-slug/)).toBeInTheDocument();
  });

  it("marks the slug input invalid and wires aria-describedby to the role=alert error on a blocked submit", async () => {
    renderForm();

    const slugInput = screen.getByLabelText(/workspace url/i);
    fireEvent.change(slugInput, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    const alert = await screen.findByRole("alert");
    expect(slugInput).toHaveAttribute("aria-invalid", "true");
    const describedBy = slugInput.getAttribute("aria-describedby")!.split(" ");
    expect(describedBy).toContain(alert.id);
  });

  it("disables submit while the slug is being checked or unavailable", () => {
    mockUseSlugAvailability.mockReturnValue({ status: "taken" });
    renderForm();

    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("wires the slug input's aria-describedby to the live slug-status region even with no error", () => {
    renderForm();

    const slugInput = screen.getByLabelText(/workspace url/i);
    const describedBy = slugInput.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const ids = describedBy!.split(" ");
    // At least one id must resolve to an element in the document (the
    // SlugStatusIndicator's live region), even before any error exists.
    expect(ids.some((id) => document.getElementById(id))).toBe(true);
  });

  it("checks and saves the generated slug before continuing from a completed step", async () => {
    const { workspaceStepAction } = await import("@/lib/actions/onboarding");
    renderForm({}, "plan");

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await vi.waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/onboarding/plan");
    });
    expect(workspaceStepAction).toHaveBeenCalledWith(defaults);
  });

  it("checks the auto-generated slug when the step opens", () => {
    renderForm();
    expect(mockUseSlugAvailability).toHaveBeenCalledWith(defaults.slug);
  });

  it("refreshes the router cache before navigating on a successful submit, so Back shows saved input", async () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await vi.waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/onboarding/plan");
    });
    expect(mockRefresh).toHaveBeenCalled();
  });
});
