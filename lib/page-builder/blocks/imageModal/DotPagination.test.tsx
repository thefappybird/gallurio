import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DotPagination } from "./DotPagination";

describe("DotPagination", () => {
  it("renders one button per total, marking currentIndex as aria-current", () => {
    render(
      <DotPagination total={3} currentIndex={1} dotLabelTemplate="Photo {current} of {total}" onSelect={vi.fn()} />
    );

    const dots = [
      screen.getByRole("button", { name: "Photo 1 of 3" }),
      screen.getByRole("button", { name: "Photo 2 of 3" }),
      screen.getByRole("button", { name: "Photo 3 of 3" }),
    ];
    expect(dots).toHaveLength(3);
    expect(dots[1]).toHaveAttribute("aria-current", "true");
    expect(dots[0]).not.toHaveAttribute("aria-current");
    expect(dots[2]).not.toHaveAttribute("aria-current");
  });

  it("fires onSelect with the clicked dot's index", () => {
    const onSelect = vi.fn();
    render(
      <DotPagination total={4} currentIndex={0} dotLabelTemplate="Photo {current} of {total}" onSelect={onSelect} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Photo 3 of 4" }));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("substitutes {current}/{total} per dot using the given template", () => {
    render(
      <DotPagination total={2} currentIndex={0} dotLabelTemplate="Slide {current}/{total}" onSelect={vi.fn()} />
    );

    expect(screen.getByRole("button", { name: "Slide 1/2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Slide 2/2" })).toBeInTheDocument();
  });

  it("gives each dot a 24x24px WCAG-2.5.8 tap target while the visible dot stays 8px", () => {
    const { container } = render(
      <DotPagination total={2} currentIndex={0} dotLabelTemplate="Photo {current} of {total}" onSelect={vi.fn()} />
    );

    const dot = screen.getByRole("button", { name: "Photo 1 of 2" });
    const style = getComputedStyle(dot);
    expect(style.width).toBe("24px");
    expect(style.height).toBe("24px");
    // The visible dot itself is a centered ::before pseudo-element (jsdom
    // doesn't compute pseudo-element styles, so assert it's authored in the
    // injected stylesheet instead of the button's own box).
    const css = container.querySelector("style")!.textContent!;
    expect(css).toMatch(/\.pf-modal-dot::before\s*\{[^}]*width:\s*8px/);
    expect(css).toMatch(/\.pf-modal-dot::before\s*\{[^}]*height:\s*8px/);
  });
});
