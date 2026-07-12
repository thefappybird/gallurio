/**
 * Smoke tests for StepShell's ProgressBar: the per-step icon marker must
 * vary in shape (not just color) by state (locked/visited/active).
 */
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { StepShell } from "./step-shell";

describe("StepShell — ProgressBar marker shape by state", () => {
  it("gives locked, visited, and active steps distinct icon markers", () => {
    // step === furthestStep === "plan": business/workspace are visited,
    // plan is active (and not visited), done is locked.
    renderWithProviders(
      <StepShell step="plan" furthestStep="plan" title="Title" description="Description">
        <div />
      </StepShell>
    );

    expect(screen.getAllByTestId("step-icon-visited")).toHaveLength(2); // business, workspace
    expect(screen.getByTestId("step-icon-active")).toBeInTheDocument(); // plan
    expect(screen.getByTestId("step-icon-locked")).toBeInTheDocument(); // done
  });

  it("still exposes step names to assistive tech even when visually icon-only", () => {
    renderWithProviders(
      <StepShell step="plan" furthestStep="plan" title="Title" description="Description">
        <div />
      </StepShell>
    );

    expect(screen.getByText("Business")).toBeInTheDocument();
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("Plan")).toBeInTheDocument();
    expect(screen.getByText("Finish")).toBeInTheDocument();
  });
});
