import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { TemplatePickerDialog } from "./TemplatePickerDialog";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import type { EditorTemplateSummary } from "./EditorShell";

const templates: EditorTemplateSummary[] = [
  { id: "minimal", label: "Minimal", description: "Clean and simple", defaultBrandKit: DEFAULT_BRAND_KIT },
  { id: "bold", label: "Bold", description: "Loud", defaultBrandKit: DEFAULT_BRAND_KIT },
];

// Shared default props — override only what a test needs.
const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  templates,
  currentTemplateId: "minimal",
  switching: false,
  error: null,
  onConfirm: vi.fn(),
};

describe("TemplatePickerDialog", () => {
  it("renders all templates and marks the current one when open", () => {
    renderWithProviders(<TemplatePickerDialog {...defaultProps} />);
    expect(screen.getByText("Choose a template")).toBeTruthy();
    expect(screen.getByText("Minimal")).toBeTruthy();
    expect(screen.getByText("Bold")).toBeTruthy();
    expect(screen.getByText(/current/i)).toBeTruthy();
  });

  it("renders nothing when closed", () => {
    renderWithProviders(<TemplatePickerDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("Choose a template")).toBeNull();
  });

  it("calls onOpenChange(false) when Cancel is clicked", () => {
    const onOpenChange = vi.fn();
    renderWithProviders(
      <TemplatePickerDialog {...defaultProps} onOpenChange={onOpenChange} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows error text via role=alert when error prop is set", () => {
    renderWithProviders(
      <TemplatePickerDialog {...defaultProps} error="Could not switch the template. Please try again." />
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Could not switch the template. Please try again.")).toBeTruthy();
  });

  it("disables card buttons and Use this template while switching", () => {
    renderWithProviders(
      <TemplatePickerDialog {...defaultProps} switching={true} />
    );
    expect(screen.getByRole("button", { name: "Switching…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    // All template card buttons are disabled while switching.
    const boldCard = screen.getByRole("button", { name: /Bold/ });
    expect(boldCard).toBeDisabled();
  });

  it("selects a template on click and applies only when Use this template is pressed; no warning dialog", () => {
    const onConfirm = vi.fn();
    renderWithProviders(
      <TemplatePickerDialog {...defaultProps} onConfirm={onConfirm} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Bold/ }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByText("Switch template?")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use this template" }));
    expect(onConfirm).toHaveBeenCalledWith("bold");
  });

  it("disables Use this template until a template is selected", () => {
    renderWithProviders(<TemplatePickerDialog {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Use this template" })).toBeDisabled();
  });
});

describe("TemplatePickerDialog — welcome mode", () => {
  const welcomeProps = {
    ...defaultProps,
    welcome: true,
    onStartScratch: vi.fn(),
  };

  it("shows welcome heading and subtitle instead of the regular title", () => {
    renderWithProviders(<TemplatePickerDialog {...welcomeProps} />);
    expect(screen.getByText("Pick a template to start")).toBeTruthy();
    expect(screen.queryByText("Choose a template")).toBeNull();
  });

  it("shows Start from scratch button instead of Cancel", () => {
    renderWithProviders(<TemplatePickerDialog {...welcomeProps} />);
    expect(screen.getByRole("button", { name: "Start from scratch" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("calls onStartScratch when Start from scratch is clicked", () => {
    const onStartScratch = vi.fn();
    renderWithProviders(<TemplatePickerDialog {...welcomeProps} onStartScratch={onStartScratch} />);
    fireEvent.click(screen.getByRole("button", { name: "Start from scratch" }));
    expect(onStartScratch).toHaveBeenCalledTimes(1);
  });

  it("does not show the Current badge on any template card in welcome mode", () => {
    renderWithProviders(<TemplatePickerDialog {...welcomeProps} currentTemplateId="minimal" />);
    expect(screen.queryByText(/current/i)).toBeNull();
  });

  it("calls onConfirm with the selected template id when Use this template is pressed", () => {
    const onConfirm = vi.fn();
    renderWithProviders(<TemplatePickerDialog {...welcomeProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: /Bold/ }));
    fireEvent.click(screen.getByRole("button", { name: "Use this template" }));
    expect(onConfirm).toHaveBeenCalledWith("bold");
  });
});
