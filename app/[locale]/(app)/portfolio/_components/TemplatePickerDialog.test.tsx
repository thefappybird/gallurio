import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { TemplatePickerDialog } from "./TemplatePickerDialog";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";

const templates = [
  { id: "minimal", label: "Minimal", description: "Clean", defaultBrandKit: DEFAULT_BRAND_KIT },
  { id: "bold", label: "Bold", description: "Loud", defaultBrandKit: DEFAULT_BRAND_KIT },
];

it("selects a template on click and applies only when Use this template is pressed; no warning dialog", () => {
  const onConfirm = vi.fn();
  renderWithProviders(
    <TemplatePickerDialog open onOpenChange={() => {}} templates={templates}
      currentTemplateId="minimal" switching={false} error={null} onConfirm={onConfirm} />
  );
  fireEvent.click(screen.getByRole("button", { name: /Bold/ }));
  expect(onConfirm).not.toHaveBeenCalled();
  expect(screen.queryByText("Switch template?")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Use this template" }));
  expect(onConfirm).toHaveBeenCalledWith("bold");
});

it("disables Use this template until a template is selected", () => {
  renderWithProviders(
    <TemplatePickerDialog open onOpenChange={() => {}} templates={templates}
      currentTemplateId="minimal" switching={false} error={null} onConfirm={() => {}} />
  );
  expect(screen.getByRole("button", { name: "Use this template" })).toBeDisabled();
});
