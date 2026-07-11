/**
 * Smoke tests for StepShell's ProgressBar: marker height must vary by step
 * state (locked/visited/active) so state isn't color-only.
 */
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { StepShell } from "./step-shell";

function getMarker(labelText: string) {
  const label = screen.getByText(labelText);
  const row = label.parentElement as HTMLElement;
  const marker = row.querySelector('span[aria-hidden="true"]');
  if (!marker) throw new Error(`marker not found for "${labelText}"`);
  return marker as HTMLElement;
}

describe("StepShell — ProgressBar marker height by state", () => {
  it("gives locked, visited, and active steps distinct height classes", () => {
    // step === furthestStep === "plan": business/workspace are visited,
    // plan is active (and not visited), done is locked.
    renderWithProviders(
      <StepShell step="plan" furthestStep="plan" title="Title" description="Description">
        <div />
      </StepShell>
    );

    expect(getMarker("Business")).toHaveClass("h-3", "bg-brand");
    expect(getMarker("Workspace")).toHaveClass("h-3", "bg-brand");
    expect(getMarker("Plan")).toHaveClass("h-4", "bg-brand");
    expect(getMarker("Finish")).toHaveClass("h-2", "bg-border");
  });
});
