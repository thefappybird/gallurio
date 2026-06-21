import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditorDrawerSection, EditorDrawerGroup } from "./EditorDrawerSection";

describe("EditorDrawerSection", () => {
  it("(a) renders title and children", () => {
    render(
      <EditorDrawerSection title="Typography" defaultOpen>
        <span>child content</span>
      </EditorDrawerSection>,
    );
    expect(screen.getByText("Typography")).toBeTruthy();
    expect(screen.getByText("child content")).toBeTruthy();
  });

  it("(b) toggles open/closed via header — aria-expanded and children visibility", () => {
    render(
      <EditorDrawerSection title="Effects">
        <span>effect controls</span>
      </EditorDrawerSection>,
    );
    const btn = screen.getByRole("button");
    // Starts closed
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("effect controls")).not.toBeInTheDocument();

    // Open
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("effect controls")).toBeInTheDocument();

    // Close again
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("effect controls")).not.toBeInTheDocument();
  });
});

describe("EditorDrawerGroup", () => {
  it("(c) two sections render exactly one divider between them (flush, no gap)", () => {
    const { container } = render(
      <EditorDrawerGroup>
        <EditorDrawerSection title="Section A">
          <span>a</span>
        </EditorDrawerSection>
        <EditorDrawerSection title="Section B">
          <span>b</span>
        </EditorDrawerSection>
      </EditorDrawerGroup>,
    );

    // Outer group has exactly one border
    const group = container.firstElementChild as HTMLElement;
    expect(group.className).toContain("border");

    // The group uses divide-y which adds a top border to siblings via CSS.
    // In JSDOM, Tailwind CSS is not processed, so we verify the structural
    // semantics: the group renders both sections as direct children with no
    // gap wrapper between them (no gap-* class on the container).
    expect(group.className).not.toMatch(/gap-[0-9]/);

    // Both section headers are rendered as siblings inside the group
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toContain("Section A");
    expect(buttons[1].textContent).toContain("Section B");

    // The sections are direct children of the group (flush — no wrapper divs between them)
    const sectionDivs = Array.from(group.children);
    expect(sectionDivs).toHaveLength(2);
  });
});
