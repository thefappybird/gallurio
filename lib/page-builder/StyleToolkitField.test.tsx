import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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

  it("no longer renders text-formatting controls (moved to per-text RichTextField)", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Bold" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Italic" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Underline" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Text color" })).toBeNull();
  });

  it("marks the Border trigger active when a border width is set", () => {
    const value: BlockStyle = { borderWidth: 4 };
    render(<StyleToolkitField value={value} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Border" }).className).toContain("ring-ring");
  });
});
