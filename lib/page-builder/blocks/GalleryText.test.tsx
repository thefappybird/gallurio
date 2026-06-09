import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GalleryHeader } from "./GalleryText";

describe("GalleryHeader — text styling", () => {
  it("uses the overlay default color when no token is given", () => {
    const { container } = render(<GalleryHeader heading="Hi" overlay />);
    const style = container.querySelector("h2")!.getAttribute("style") ?? "";
    expect(style).toContain("var(--pf-color-bg)");
  });

  it("applies the picked text color token to heading and description", () => {
    const { container } = render(
      <GalleryHeader heading="Hi" description="Yo" overlay textColorToken="primary" />
    );
    const h2 = container.querySelector("h2")!.getAttribute("style") ?? "";
    const p = container.querySelector("p")!.getAttribute("style") ?? "";
    expect(h2).toContain("var(--pf-color-primary)");
    expect(p).toContain("var(--pf-color-primary)");
  });

  it("applies bold / italic / underline to heading and description", () => {
    const { container } = render(
      <GalleryHeader heading="Hi" description="Yo" bold italic underline />
    );
    const h2 = container.querySelector("h2")!.getAttribute("style") ?? "";
    const p = container.querySelector("p")!.getAttribute("style") ?? "";
    expect(h2).toContain("font-weight: 700");
    expect(h2).toContain("font-style: italic");
    expect(h2).toContain("text-decoration: underline");
    expect(p).toContain("font-weight: 700");
  });

  it("wraps only the heading in a <mark> band when headingHighlight is on", () => {
    const { container } = render(
      <GalleryHeader
        heading="Hi"
        description="Yo"
        headingHighlight
        headingHighlightToken="accent"
      />
    );
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBe(1);
    expect(container.querySelector("h2 mark")).not.toBeNull();
    expect(container.querySelector("p mark")).toBeNull();
    expect(marks[0].getAttribute("style") ?? "").toContain("var(--pf-color-accent)");
  });

  it("wraps only the description in a <mark> band when descriptionHighlight is on", () => {
    const { container } = render(
      <GalleryHeader heading="Hi" description="Yo" descriptionHighlight descriptionHighlightToken="primary" />
    );
    expect(container.querySelector("h2 mark")).toBeNull();
    expect(container.querySelector("p mark")).not.toBeNull();
  });

  it("renders no <mark> when highlights are off", () => {
    const { container } = render(<GalleryHeader heading="Hi" description="Yo" />);
    expect(container.querySelector("mark")).toBeNull();
    expect(screen.getByText("Hi")).toBeInTheDocument();
    expect(screen.getByText("Yo")).toBeInTheDocument();
  });
});
