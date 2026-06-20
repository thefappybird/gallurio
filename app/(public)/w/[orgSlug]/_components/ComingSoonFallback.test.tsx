import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComingSoonFallback } from "./ComingSoonFallback";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ComingSoonFallback", () => {
  it("renders without crashing", () => {
    const { container } = render(<ComingSoonFallback workspace={{ name: "Test Studio" }} />);
    expect(container.firstChild).not.toBeNull();
  });

  it("displays the workspace name", () => {
    render(<ComingSoonFallback workspace={{ name: "Luna Photography" }} />);
    expect(screen.getByText("Luna Photography")).toBeInTheDocument();
  });

  it("renders the 'Coming soon' message", () => {
    render(<ComingSoonFallback workspace={{ name: "Test Studio" }} />);
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });

  it("shows 'Powered by Gallurio' attribution", () => {
    render(<ComingSoonFallback workspace={{ name: "Test Studio" }} />);
    expect(screen.getByText("Powered by Gallurio")).toBeInTheDocument();
  });

  it("applies brand-kit CSS variables via the main element style", () => {
    const { container } = render(<ComingSoonFallback workspace={{ name: "Test Studio" }} />);
    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    expect(main?.getAttribute("style")).toContain("--pf-font-body");
  });

  it("accepts custom labels", () => {
    render(
      <ComingSoonFallback
        workspace={{ name: "Test Studio" }}
        labels={{ comingSoon: "Halos na!", poweredBy: "Pinapagana ng Gallurio" }}
      />
    );
    expect(screen.getByText("Halos na!")).toBeInTheDocument();
    expect(screen.getByText("Pinapagana ng Gallurio")).toBeInTheDocument();
  });
});
