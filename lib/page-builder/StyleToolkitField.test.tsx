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

/**
 * Active state on a ToolbarPopover trigger adds the bare class `ring-1`.
 * The base class (`toolbarButtonBase`) only has `focus-visible:ring-1` — never
 * a space-delimited bare `ring-1` token — so splitting on whitespace is the
 * reliable discriminator.
 */
function isActive(el: HTMLElement): boolean {
  return el.className.split(/\s+/).includes("ring-1");
}

describe("StyleToolkitField", () => {
  it("renders the Section style heading", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText("Section style")).toBeTruthy();
  });

  it("renders all six context-group popover triggers", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Background" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Borders" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Text" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Layout" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Container" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Animations" })).toBeTruthy();
  });

  it("renders the inline text-formatting toggles (Bold/Italic/Underline)", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Bold" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Italic" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Underline" })).toBeTruthy();
  });

  it("clicking Bold calls onChange with bold: true when bold is not yet set", () => {
    const onChange = vi.fn();
    render(<StyleToolkitField value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(onChange).toHaveBeenCalledOnce();
    const arg = onChange.mock.calls[0][0] as BlockStyle;
    expect(arg.bold).toBe(true);
  });

  it("clicking Bold again calls onChange with bold: false (toggle off)", () => {
    const onChange = vi.fn();
    render(<StyleToolkitField value={{ bold: true }} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(onChange).toHaveBeenCalledOnce();
    const arg = onChange.mock.calls[0][0] as BlockStyle;
    expect(arg.bold).toBe(false);
  });

  // ── Borders active state ──────────────────────────────────────────────────

  it("marks the Borders trigger active when borderWidth is set", () => {
    render(<StyleToolkitField value={{ borderWidth: 4 }} onChange={vi.fn()} />);
    expect(isActive(screen.getByRole("button", { name: "Borders" }))).toBe(true);
  });

  it("marks the Borders trigger active when shadow is set (not 'none')", () => {
    render(<StyleToolkitField value={{ shadow: "md" }} onChange={vi.fn()} />);
    expect(isActive(screen.getByRole("button", { name: "Borders" }))).toBe(true);
  });

  it("marks the Borders trigger active when radius is set", () => {
    render(<StyleToolkitField value={{ radius: 8 }} onChange={vi.fn()} />);
    expect(isActive(screen.getByRole("button", { name: "Borders" }))).toBe(true);
  });

  it("does NOT mark Borders trigger active when no border/radius/shadow set", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} />);
    expect(isActive(screen.getByRole("button", { name: "Borders" }))).toBe(false);
  });

  // ── Layout active state ───────────────────────────────────────────────────

  it("marks the Layout trigger active when selfAlign is set", () => {
    render(<StyleToolkitField value={{ selfAlign: "center" }} onChange={vi.fn()} />);
    expect(isActive(screen.getByRole("button", { name: "Layout" }))).toBe(true);
  });

  it("marks the Layout trigger active when marginTop is set", () => {
    render(<StyleToolkitField value={{ marginTop: "16px" }} onChange={vi.fn()} />);
    expect(isActive(screen.getByRole("button", { name: "Layout" }))).toBe(true);
  });

  it("marks the Layout trigger active when paddingLeft is set", () => {
    render(<StyleToolkitField value={{ paddingLeft: "24px" }} onChange={vi.fn()} />);
    expect(isActive(screen.getByRole("button", { name: "Layout" }))).toBe(true);
  });

  it("marks the Layout trigger active when width is set", () => {
    render(<StyleToolkitField value={{ width: "50%" }} onChange={vi.fn()} />);
    expect(isActive(screen.getByRole("button", { name: "Layout" }))).toBe(true);
  });

  // ── Animations active state ───────────────────────────────────────────────

  it("marks the Animations trigger active when animation is set (not 'none')", () => {
    render(<StyleToolkitField value={{ animation: "fade" }} onChange={vi.fn()} />);
    expect(isActive(screen.getByRole("button", { name: "Animations" }))).toBe(true);
  });

  it("marks the Animations trigger active when hover effect is set (not 'none')", () => {
    render(<StyleToolkitField value={{ hover: "scale" }} onChange={vi.fn()} />);
    expect(isActive(screen.getByRole("button", { name: "Animations" }))).toBe(true);
  });

  it("does NOT mark Animations trigger active when animation is 'none'", () => {
    render(<StyleToolkitField value={{ animation: "none" }} onChange={vi.fn()} />);
    expect(isActive(screen.getByRole("button", { name: "Animations" }))).toBe(false);
  });

  it("does NOT mark Animations trigger active when hover is 'none'", () => {
    render(<StyleToolkitField value={{ hover: "none" }} onChange={vi.fn()} />);
    expect(isActive(screen.getByRole("button", { name: "Animations" }))).toBe(false);
  });

  // ── Container active state ────────────────────────────────────────────────

  it("marks the Container trigger active when colSpan is set", () => {
    render(<StyleToolkitField value={{ colSpan: 3 }} onChange={vi.fn()} />);
    expect(isActive(screen.getByRole("button", { name: "Container" }))).toBe(true);
  });

  it("marks the Container trigger active when rowSpan is set", () => {
    render(<StyleToolkitField value={{ rowSpan: 2 }} onChange={vi.fn()} />);
    expect(isActive(screen.getByRole("button", { name: "Container" }))).toBe(true);
  });

  // ── Background active state ───────────────────────────────────────────────

  it("marks the Background trigger active when bgColorToken is set", () => {
    render(<StyleToolkitField value={{ bgColorToken: "primary" }} onChange={vi.fn()} />);
    expect(isActive(screen.getByRole("button", { name: "Background" }))).toBe(true);
  });

  it("marks the Background trigger active when bgImagePublicId is set", () => {
    render(<StyleToolkitField value={{ bgImagePublicId: "some/image" }} onChange={vi.fn()} />);
    expect(isActive(screen.getByRole("button", { name: "Background" }))).toBe(true);
  });

  it("does NOT mark Background trigger active when nothing is set", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} />);
    expect(isActive(screen.getByRole("button", { name: "Background" }))).toBe(false);
  });
});
