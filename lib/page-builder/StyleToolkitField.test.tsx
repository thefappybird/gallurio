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
    // Typography is the first drawer — it opens automatically (no click needed).
    expect(screen.getByRole("button", { name: "Bold" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Italic" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Underline" })).toBeTruthy();
  });

  it("switching to Layout tab shows Gap control", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    // Gap lives inside the collapsed "Layout" drawer (aria-expanded distinguishes it
    // from the "Layout" tab button which has no aria-expanded attribute).
    fireEvent.click(screen.getByRole("button", { name: "Layout", expanded: false }));
    expect(screen.getByText("Gap")).toBeTruthy();
  });

  it("Bold toggle calls onChange with bold: true when not set", () => {
    const onChange = vi.fn();
    render(<StyleToolkitField value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    // Typography is the first drawer — already open.
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(onChange).toHaveBeenCalledOnce();
    expect((onChange.mock.calls[0][0] as BlockStyle).bold).toBe(true);
  });

  it("Bold toggle calls onChange with bold: false when already set", () => {
    const onChange = vi.fn();
    render(<StyleToolkitField value={{ bold: true }} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    // Typography is the first drawer — already open.
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
    fireEvent.click(screen.getByRole("button", { name: "Layout", expanded: false }));
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
    fireEvent.click(screen.getByRole("button", { name: "Frame" }));
    expect(screen.getByRole("button", { name: "No shadow" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Small" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Medium" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Large" })).toBeTruthy();
  });

  it("Layout tab Spacing drawer does not show Top or Bottom spacing (removed from standard drawer)", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    fireEvent.click(screen.getByRole("button", { name: "Spacing" }));
    expect(screen.queryByText("Top spacing")).toBeNull();
    expect(screen.queryByText("Bottom spacing")).toBeNull();
  });

  it("Design tab does not show Margin section", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    expect(screen.queryByText("Margin")).toBeNull();
  });

  it("hides the Bold control for Heading blocks", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="Heading" />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    // Typography is the first drawer — already open.
    expect(screen.queryByRole("button", { name: "Bold" })).toBeNull();
    expect(screen.getByRole("button", { name: "Italic" })).toBeTruthy();
  });

  it("hides Frame and Typography for image-only gallery blocks (GalleryGrid)", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryGrid" />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    expect(screen.queryByText("Frame")).toBeNull();
    expect(screen.queryByText("Typography")).toBeNull();
    // Effects drawer remains available for entrance animations.
    expect(screen.getByText("Effects")).toBeTruthy();
  });

  it("hides Frame and the shared Typography for the GalleryCarousel (uses drawers)", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryCarousel" />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    expect(screen.queryByText("Frame")).toBeNull();
    expect(screen.queryByText("Typography")).toBeNull();
    // Per-target drawer headers are present (accordion buttons with aria-expanded).
    expect(screen.getAllByRole("button", { name: "Heading" }).length).toBeGreaterThanOrEqual(1);
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
  it("Heading drawer is open by default (first section auto-opens)", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryCarousel" />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    // Heading is the first section — it opens automatically. Bold is visible.
    expect(screen.getByRole("button", { name: "Bold" })).toBeTruthy();
  });

  it("Heading drawer reveals B/I/U, Level and the heading highlight when open", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryCarousel" />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    // Heading is already open — controls visible without extra click.
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
    // Heading drawer is already open — click the highlight toggle directly.
    fireEvent.click(screen.getByLabelText("Heading highlight"));
    expect((onChange.mock.calls[0][0] as BlockStyle).headingHighlight).toBe(true);
  });

  it("shows Shape and Size rows once a highlight is on and writes the picked shape", () => {
    const onChange = vi.fn();
    render(<StyleToolkitField value={{ headingHighlight: true }} onChange={onChange} blockType="GalleryCarousel" />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    // Heading drawer is already open — Shape and Size are visible.
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

import { CarouselTextPadding, CONTAINER_TYPES, FLEX_CONTAINER_BLOCKS, LayoutTabBody, DesignTab } from "./StyleToolkitField";

describe("CarouselTextPadding heading gap control", () => {
  it("renders a heading gap input and writes _style.headingGap", () => {
    const set = vi.fn();
    render(<CarouselTextPadding s={{}} set={set} />);
    // NumberInputRow uses a <span> for the label (no htmlFor/aria-label on the input),
    // so getByLabelText is not available. We verify the label text is present, then
    // fire change on the last spinbutton (X and Y DimensionInputs come first; the
    // new Heading gap NumberInputRow is last in the DOM).
    expect(screen.getByText(/heading gap/i)).toBeTruthy();
    const spinbuttons = screen.getAllByRole("spinbutton");
    const headingGapInput = spinbuttons[spinbuttons.length - 1];
    fireEvent.change(headingGapInput, { target: { value: "20" } });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ headingGap: 20 }));
  });
});

describe("padding lives in the Layout tab", () => {
  it("LayoutTabBody shows Padding for a Container — Spacing drawer auto-opens", () => {
    render(
      <LayoutTabBody
        s={{}}
        set={() => {}}
        isGridChild={false}
        showJustify
        blockType="Container"
        p={{}}
        setProp={() => {}}
      />,
    );
    // Spacing is the first drawer and opens automatically — Padding is visible.
    expect(screen.getByText("Padding")).toBeInTheDocument();
  });

  it("DesignTab no longer shows Padding for a Container", () => {
    render(<DesignTab s={{}} set={() => {}} blockType="Container" />);
    expect(screen.queryByText("Padding")).not.toBeInTheDocument();
  });
});

describe("gallery section presets are container-typed", () => {
  for (const t of ["GalleryGridPreset", "GalleryMasonryPreset", "FeaturedWorkPreset"]) {
    it(`${t} is a CONTAINER_TYPE`, () => {
      expect(CONTAINER_TYPES.has(t)).toBe(true);
    });
    it(`${t} is a FLEX_CONTAINER_BLOCK`, () => {
      expect(FLEX_CONTAINER_BLOCKS.has(t)).toBe(true);
    });
  }
  it("does not treat the standalone GalleryCarousel as a container", () => {
    expect(CONTAINER_TYPES.has("GalleryCarousel")).toBe(false);
  });
});

import { RadiusButtons } from "./StyleToolkitField";

describe("RadiusButtons", () => {
  it("renders 5 preset buttons (None, S, M, L, Full)", () => {
    render(<RadiusButtons value={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "None" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "S" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "M" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "L" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Full" })).toBeTruthy();
  });

  it("marks the matching preset as pressed when value matches", () => {
    render(<RadiusButtons value={8} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "M" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "S" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with the preset value when a button is clicked", () => {
    const onChange = vi.fn();
    render(<RadiusButtons value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "L" }));
    expect(onChange).toHaveBeenCalledWith(16);
  });

  it("calls onChange with undefined when the active preset is clicked again (deselect)", () => {
    const onChange = vi.fn();
    render(<RadiusButtons value={4} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "S" }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});

describe("Button style section — corner radius picker", () => {
  it("LayoutTabBody for Button shows a Corner radius picker (flat single-section, always visible)", () => {
    render(
      <LayoutTabBody
        s={{}}
        set={() => {}}
        isGridChild={false}
        showJustify={false}
        blockType="Button"
        p={{}}
        setProp={() => {}}
      />,
    );
    // Button has one Layout section — rendered flat (no accordion), Corner radius always visible.
    expect(screen.getByText("Corner radius")).toBeTruthy();
  });
});

import { ContentInputs } from "./StyleToolkitField";

describe("ContentInputs — emoji button integration", () => {
  it("Heading block shows Insert emoji button beside the text input", () => {
    render(<ContentInputs type="Heading" props={{ text: "Hello", level: "h2" }} setProp={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Insert emoji" })).toBeTruthy();
  });
});
