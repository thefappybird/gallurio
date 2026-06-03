import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StyleToolkitField } from "./StyleToolkitField";
import type { BlockStyle } from "./styleToolkit";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ collections: [], items: [] }),
  } as unknown as Response);
});

describe("StyleToolkitField", () => {
  it("renders the block-level (section) style controls", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText("Section style")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Background" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Border" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Corner radius" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Shadow" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Padding" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Margin" })).toBeTruthy();
  });

  it("renders text-formatting controls (section-wide) alongside section controls", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Bold" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Italic" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Underline" })).toBeTruthy();
    // The "Text" popover trigger bundles font/size/color/highlight/alignment
    expect(screen.getByRole("button", { name: "Text" })).toBeTruthy();
  });

  it("clicking Bold calls onChange with bold: true when bold is not yet set", () => {
    const onChange = vi.fn();
    render(<StyleToolkitField value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(onChange).toHaveBeenCalledOnce();
    const arg = onChange.mock.calls[0][0] as BlockStyle;
    expect(arg.bold).toBe(true);
  });

  it("marks the Border trigger active when a border width is set", () => {
    const value: BlockStyle = { borderWidth: 4 };
    render(<StyleToolkitField value={value} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Border" }).className).toContain("ring-ring");
  });
});
