import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GalleryHeader } from "./GalleryText";

describe("GalleryHeader — per-target text styling", () => {
  it("uses the overlay default color when no token is given", () => {
    const { container } = render(<GalleryHeader heading="Hi" overlay />);
    expect(container.querySelector("h2")!.getAttribute("style") ?? "").toContain("var(--pf-color-bg)");
  });

  it("applies heading and description colors independently", () => {
    const { container } = render(
      <GalleryHeader
        heading="Hi"
        description="Yo"
        overlay
        headingStyle={{ colorToken: "primary" }}
        descriptionStyle={{ colorToken: "secondary" }}
      />
    );
    expect(container.querySelector("h2")!.getAttribute("style") ?? "").toContain("var(--pf-color-primary)");
    expect(container.querySelector("p")!.getAttribute("style") ?? "").toContain("var(--pf-color-secondary)");
  });

  it("applies bold/italic/underline only to the targeted text", () => {
    const { container } = render(
      <GalleryHeader heading="Hi" description="Yo" headingStyle={{ bold: true, italic: true, underline: true }} />
    );
    const h2 = container.querySelector("h2")!.getAttribute("style") ?? "";
    const p = container.querySelector("p")!.getAttribute("style") ?? "";
    expect(h2).toContain("font-weight: 700");
    expect(h2).toContain("font-style: italic");
    expect(h2).toContain("text-decoration: underline");
    expect(p).not.toContain("font-weight: 700");
  });

  it("renders the heading at the chosen level tag and size", () => {
    const { container } = render(<GalleryHeader heading="Big" headingStyle={{ level: "h1" }} />);
    const h1 = container.querySelector("h1");
    expect(h1).not.toBeNull();
    expect(container.querySelector("h2")).toBeNull();
    expect(h1!.getAttribute("style") ?? "").toContain("font-size: 3rem");
  });

  it("applies a custom description font size", () => {
    const { container } = render(<GalleryHeader description="Yo" descriptionStyle={{ fontSize: 20 }} />);
    expect(container.querySelector("p")!.getAttribute("style") ?? "").toContain("font-size: 20px");
  });

  it("aligns heading and description independently", () => {
    const { container } = render(
      <GalleryHeader
        heading="Hi"
        description="Yo"
        align="center"
        headingStyle={{ align: "left" }}
        descriptionStyle={{ align: "right" }}
      />
    );
    expect(container.querySelector("h2")!.getAttribute("style") ?? "").toContain("text-align: left");
    expect(container.querySelector("p")!.getAttribute("style") ?? "").toContain("text-align: right");
  });

  it("wraps only the heading in a <mark> band when its highlight is on", () => {
    const { container } = render(
      <GalleryHeader heading="Hi" description="Yo" headingStyle={{ highlight: true, highlightToken: "accent" }} />
    );
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBe(1);
    expect(container.querySelector("h2 mark")).not.toBeNull();
    expect(container.querySelector("p mark")).toBeNull();
    expect(marks[0].getAttribute("style") ?? "").toContain("var(--pf-color-accent)");
  });

  it("applies highlight shape and size to the band", () => {
    const { container } = render(
      <GalleryHeader heading="Hi" headingStyle={{ highlight: true, highlightShape: "rounded", highlightSize: "lg" }} />
    );
    const mark = container.querySelector("mark")!.getAttribute("style") ?? "";
    expect(mark).toContain("border-radius: 0.6em");
    expect(mark).toContain("padding: 0.2em 0.45em");
  });

  it("renders no <mark> when highlights are off", () => {
    const { container } = render(<GalleryHeader heading="Hi" description="Yo" />);
    expect(container.querySelector("mark")).toBeNull();
    expect(screen.getByText("Hi")).toBeInTheDocument();
    expect(screen.getByText("Yo")).toBeInTheDocument();
  });
});

describe("GalleryHeader gap", () => {
  it("defaults the description top margin to 0.5rem when no gap given", () => {
    const { container } = render(
      <GalleryHeader heading="Title" description="Desc" align="center" />,
    );
    const p = container.querySelector("p")!;
    expect(p.style.margin).toContain("0.5rem");
  });

  it("uses the provided gap (px) for the description top margin", () => {
    const { container } = render(
      <GalleryHeader heading="Title" description="Desc" align="center" gap={24} />,
    );
    const p = container.querySelector("p")!;
    expect(p.style.margin).toContain("24px");
  });
});
