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

  it("does not mark either background image as a priority fetch", () => {
    const { container } = render(<AmbientBackground />);
    const images = container.querySelectorAll("img");
    expect(images.length).toBe(2);
    images.forEach((img) => {
      expect(img.getAttribute("loading")).toBe("lazy");
    });
  });
});
