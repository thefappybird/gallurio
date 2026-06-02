import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TemplatePickerDialog } from "./TemplatePickerDialog";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import type { EditorTemplateSummary } from "./EditorShell";

const templates: EditorTemplateSummary[] = [
  { id: "minimal", label: "Minimal", description: "Clean and simple", defaultBrandKit: DEFAULT_BRAND_KIT },
  { id: "planner", label: "Planner", description: "For event planners", defaultBrandKit: DEFAULT_BRAND_KIT },
];

describe("TemplatePickerDialog", () => {
  it("lists templates and marks the current one when open", () => {
    render(
      <TemplatePickerDialog
        open
        onOpenChange={vi.fn()}
        templates={templates}
        currentTemplateId="minimal"
        switching={false}
        error={null}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText("Choose a template")).toBeTruthy();
    expect(screen.getByText("Minimal")).toBeTruthy();
    expect(screen.getByText("Planner")).toBeTruthy();
    expect(screen.getByText(/current/i)).toBeTruthy();
  });

  it("requires confirmation before switching", () => {
    const onConfirm = vi.fn();
    render(
      <TemplatePickerDialog
        open
        onOpenChange={vi.fn()}
        templates={templates}
        currentTemplateId="minimal"
        switching={false}
        error={null}
        onConfirm={onConfirm}
      />
    );

    // Choosing a template opens a confirm step, not an immediate switch.
    fireEvent.click(screen.getByText("Planner"));
    expect(screen.getByText(/switch template\?/i)).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^switch template$/i }));
    expect(onConfirm).toHaveBeenCalledWith("planner");
  });

  it("renders nothing when closed", () => {
    render(
      <TemplatePickerDialog
        open={false}
        onOpenChange={vi.fn()}
        templates={templates}
        currentTemplateId="minimal"
        switching={false}
        error={null}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.queryByText("Choose a template")).toBeNull();
  });
});
