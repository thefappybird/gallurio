import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AmbientBackground } from "./ambient-background";

describe("AmbientBackground", () => {
  it("renders a decorative, non-interactive overlay that screen readers skip", () => {
    const { container } = render(<AmbientBackground />);
    const root = container.firstElementChild;
    expect(root).toHaveAttribute("aria-hidden");
    expect(root).toHaveClass("pointer-events-none");
    expect(root).toHaveClass("overflow-hidden");
  });
});
