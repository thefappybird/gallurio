/**
 * SuppressedActionBar suppresses Puck's built-in floating action bar so it
 * no longer competes with BlockActionsToolbar (our always-visible toolbar).
 * The component depends on ActionBar from @measured/puck — mocked here.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@measured/puck", () => ({
  ActionBar: Object.assign(
    ({ children }: { children: React.ReactNode }) => <div data-testid="action-bar">{children}</div>,
    {
      Action: ({ children, label }: { children: React.ReactNode; label?: string }) => (
        <button aria-label={label}>{children}</button>
      ),
    }
  ),
}));

const { SuppressedActionBar } = await import("./SuppressedActionBar");

describe("SuppressedActionBar", () => {
  it("renders no action buttons (suppresses Puck floating bar)", () => {
    render(<SuppressedActionBar label="Hero" parentAction={null}>{null}</SuppressedActionBar>);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
