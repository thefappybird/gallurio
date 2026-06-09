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

describe("StyleToolkitField — 3-tab panel", () => {
  it("renders three tab buttons: Content, Design, Layout", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Content" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Design" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Layout" })).toBeTruthy();
  });

  it("shows Content tab by default", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText("Banner")).toBeTruthy();
  });

  it("switching to Design tab shows typography section", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    expect(screen.getByText("Typography")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bold" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Italic" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Underline" })).toBeTruthy();
  });

  it("switching to Layout tab shows Gap control", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    expect(screen.getByText("Gap")).toBeTruthy();
  });

  it("Bold toggle calls onChange with bold: true when not set", () => {
    const onChange = vi.fn();
    render(<StyleToolkitField value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(onChange).toHaveBeenCalledOnce();
    expect((onChange.mock.calls[0][0] as BlockStyle).bold).toBe(true);
  });

  it("Bold toggle calls onChange with bold: false when already set", () => {
    const onChange = vi.fn();
    render(<StyleToolkitField value={{ bold: true }} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(onChange).toHaveBeenCalledOnce();
    expect((onChange.mock.calls[0][0] as BlockStyle).bold).toBe(false);
  });

  it("Design tab does not show Padding for non-container blocks (standalone blockType is '')", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    expect(screen.queryByText("Padding")).toBeNull();
  });

  it("Layout tab shows Align and Justify when no fieldId (no Puck provider)", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    expect(screen.getByText("Align")).toBeTruthy();
    expect(screen.getByText("Justify")).toBeTruthy();
  });

  it("Content tab shows Banner section without fieldId", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText("Banner")).toBeTruthy();
    expect(screen.getByText("Color")).toBeTruthy();
    expect(screen.getByText("Image")).toBeTruthy();
  });

  it("Design tab shows Frame section with Shadow options", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    expect(screen.getByText("Frame")).toBeTruthy();
    expect(screen.getByRole("button", { name: "No shadow" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Small" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Medium" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Large" })).toBeTruthy();
  });

  it("Layout tab shows Top spacing and Bottom spacing controls", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    expect(screen.getByText("Top spacing")).toBeTruthy();
    expect(screen.getByText("Bottom spacing")).toBeTruthy();
  });

  it("Design tab does not show Margin section", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    expect(screen.queryByText("Margin")).toBeNull();
  });

  it("hides the Bold control for Heading blocks", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="Heading" />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    expect(screen.queryByRole("button", { name: "Bold" })).toBeNull();
    expect(screen.getByRole("button", { name: "Italic" })).toBeTruthy();
  });

  it("hides Frame and Typography for image-only gallery blocks (GalleryGrid)", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryGrid" />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    expect(screen.queryByText("Frame")).toBeNull();
    expect(screen.queryByText("Typography")).toBeNull();
    // Animations remain available.
    expect(screen.getByText("Animations")).toBeTruthy();
  });

  it("hides Frame and the shared Typography for the GalleryCarousel (uses drawers)", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryCarousel" />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    expect(screen.queryByText("Frame")).toBeNull();
    expect(screen.queryByText("Typography")).toBeNull();
    expect(screen.getByRole("button", { name: "Heading" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Description" })).toBeTruthy();
  });
});

import { ContainerBackgroundControls } from "./StyleToolkitField";

describe("ContainerBackgroundControls — animation gating", () => {
  const noop = () => {};

  it("hides animation + speed selects with fewer than 2 images", () => {
    render(
      <ContainerBackgroundControls
        images={[{ id: "a", publicId: "p" }]}
        onImagesChange={noop}
        animation="crossfade"
        speed="medium"
        onAnimationChange={noop}
        onSpeedChange={noop}
      />
    );
    expect(screen.getByText("Background images")).toBeTruthy();
    expect(screen.queryByLabelText("Background animation")).toBeNull();
    expect(screen.queryByLabelText("Animation speed")).toBeNull();
  });

  it("shows animation + speed selects at 2 or more images", () => {
    render(
      <ContainerBackgroundControls
        images={[{ id: "a", publicId: "p" }, { id: "b", publicId: "q" }]}
        onImagesChange={noop}
        animation="crossfade"
        speed="medium"
        onAnimationChange={noop}
        onSpeedChange={noop}
      />
    );
    expect(screen.getByLabelText("Background animation")).toBeTruthy();
    expect(screen.getByLabelText("Animation speed")).toBeTruthy();
  });

  it("fires onAnimationChange when the animation select changes", () => {
    const onAnimationChange = vi.fn();
    render(
      <ContainerBackgroundControls
        images={[{ id: "a", publicId: "p" }, { id: "b", publicId: "q" }]}
        onImagesChange={noop}
        animation="crossfade"
        speed="medium"
        onAnimationChange={onAnimationChange}
        onSpeedChange={noop}
      />
    );
    fireEvent.change(screen.getByLabelText("Background animation"), { target: { value: "slide" } });
    expect(onAnimationChange).toHaveBeenCalledWith("slide");
  });
});

describe("StyleToolkitField — carousel per-target drawers", () => {
  it("keeps both drawers collapsed by default (inner controls hidden)", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryCarousel" />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    expect(screen.queryByRole("button", { name: "Bold" })).toBeNull();
  });

  it("expanding the Heading drawer reveals B/I/U, Level and the heading highlight", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryCarousel" />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Heading" }));
    expect(screen.getByRole("button", { name: "Bold" })).toBeTruthy();
    expect(screen.getByText("Level")).toBeTruthy();
    expect(screen.getByLabelText("Heading highlight")).toBeTruthy();
  });

  it("expanding the Description drawer reveals a Font size control", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryCarousel" />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Description" }));
    expect(screen.getByText("Font size")).toBeTruthy();
    expect(screen.getByLabelText("Description highlight")).toBeTruthy();
  });

  it("toggling the heading highlight writes headingHighlight: true", () => {
    const onChange = vi.fn();
    render(<StyleToolkitField value={undefined} onChange={onChange} blockType="GalleryCarousel" />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Heading" }));
    fireEvent.click(screen.getByLabelText("Heading highlight"));
    expect((onChange.mock.calls[0][0] as BlockStyle).headingHighlight).toBe(true);
  });

  it("shows Shape and Size rows once a highlight is on and writes the picked shape", () => {
    const onChange = vi.fn();
    render(<StyleToolkitField value={{ headingHighlight: true }} onChange={onChange} blockType="GalleryCarousel" />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Heading" }));
    expect(screen.getByText("Shape")).toBeTruthy();
    expect(screen.getByText("Size")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Rounded" }));
    expect((onChange.mock.calls[0][0] as BlockStyle).headingHighlightShape).toBe("rounded");
  });
});

describe("StyleToolkitField — carousel Layout tab", () => {
  it("shows the shared Text padding control on the Layout tab", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryCarousel" />);
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    expect(screen.getByText("Text padding")).toBeTruthy();
  });

  it("does not show Text padding on the Design tab for the carousel", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryCarousel" />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    expect(screen.queryByText("Text padding")).toBeNull();
  });
});
