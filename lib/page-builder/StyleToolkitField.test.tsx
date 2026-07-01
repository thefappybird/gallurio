import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import React from "react";
import { StyleToolkitField, ContainerBackgroundControls, CarouselTextPadding, CONTAINER_TYPES, FLEX_CONTAINER_BLOCKS, LayoutTabBody, DesignTab, RadiusButtons, ContentInputs, BRAND_RADIUS_TO_PRESET, BannerSection } from "./StyleToolkitField";
import type { BlockStyle } from "./styleToolkit";
import { BrandColorsContext, useBrandRadius, useEffectiveBrandRadius, useEffectiveBrandFont } from "./brandColors";
import type { BrandColorMap } from "./brandColors";
import { resolveEffectiveFonts } from "./fonts";

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

  it("Shadow IconRow shows 'No shadow' as effective (aria-pressed) when shadow is unset", () => {
    // When _style.shadow is unset, the effective default 'none' should be aria-pressed
    // (lighter treatment). The 'No shadow' button must be pressed even with no explicit value.
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Frame" }));
    expect(screen.getByRole("button", { name: "No shadow" })).toHaveAttribute("aria-pressed", "true");
  });

  it("Shadow IconRow — clicking 'Small' when shadow is unset writes shadow:'sm' (effectiveValue pattern)", () => {
    // With effectiveValue="none", shadow prop is unset (= following theme, shows lighter).
    // Clicking a real shadow option writes that value and decouples from theme.
    // If the field were materialized (s.shadow ?? "none"), 'Small' would need two clicks
    // to change (first click deselects 'none', second selects 'sm'). With effectiveValue,
    // 'Small' registers immediately.
    const onChange = vi.fn();
    render(<StyleToolkitField value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Frame" }));
    fireEvent.click(screen.getByRole("button", { name: "Small" }));
    const calls = onChange.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1][0]).toHaveProperty("shadow", "sm");
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

  it("hides Typography but shows Frame and Effects for image-only gallery blocks (GalleryGrid — container-like)", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryGrid" />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    // Gallery container blocks now get Frame (container-like) but no Typography (images-only).
    expect(screen.getByText("Frame")).toBeTruthy();
    expect(screen.queryByText("Typography")).toBeNull();
    // Effects drawer remains available for entrance animations.
    expect(screen.getByText("Effects")).toBeTruthy();
  });

  it("shows Frame and Typography for GalleryLandingPreset (container-typed)", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryLandingPreset" />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    expect(screen.getByText("Typography")).toBeTruthy();
    expect(screen.getByText("Frame")).toBeTruthy();
  });
});

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
  it("GalleryLandingPreset is a CONTAINER_TYPE and FLEX_CONTAINER_BLOCK", () => {
    expect(CONTAINER_TYPES.has("GalleryLandingPreset")).toBe(true);
    expect(FLEX_CONTAINER_BLOCKS.has("GalleryLandingPreset")).toBe(true);
  });
});

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

  it("shows the effective (theme) preset as aria-pressed when block radius is unset", () => {
    // effectiveValue=8 corresponds to the brand "rounded" preset (M button).
    render(<RadiusButtons value={undefined} onChange={vi.fn()} effectiveValue={8} />);
    expect(screen.getByRole("button", { name: "M" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "S" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "None" })).toHaveAttribute("aria-pressed", "false");
  });

  it("explicit block radius overrides the effective (theme) value display", () => {
    // Block has radius=4 (S), theme says 8 (M) — block wins.
    render(<RadiusButtons value={4} onChange={vi.fn()} effectiveValue={8} />);
    expect(screen.getByRole("button", { name: "S" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "M" })).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking a preset calls onChange even when effective display is active", () => {
    const onChange = vi.fn();
    render(<RadiusButtons value={undefined} onChange={onChange} effectiveValue={8} />);
    fireEvent.click(screen.getByRole("button", { name: "L" }));
    expect(onChange).toHaveBeenCalledWith(16);
  });

  it("does not force any preset active when effectiveValue is absent and value is unset", () => {
    render(<RadiusButtons value={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "None" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "S" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "M" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "L" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Full" })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("Button style section — corner radius picker", () => {
  it("LayoutTabBody for Button does NOT show Corner radius (moved to Design tab in Pass 2)", () => {
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
    // Corner radius moved to Design tab Button section in Pass 2.
    expect(screen.queryByText("Corner radius")).toBeNull();
  });

  it("LayoutTabBody for Button does NOT show 'Button style' picker in Layout (moved to Design)", () => {
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
    expect(screen.queryByText("Button style")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Pass 2: Button Design tab consolidation
// ---------------------------------------------------------------------------

describe("DesignTab — Button block shows consolidated button controls", () => {
  it("DesignTab for Button shows 'Button color' in the expanded Button section", () => {
    render(<DesignTab s={{}} set={vi.fn()} blockType="Button" />);
    // Button section is collapsed by default; expand it first.
    fireEvent.click(screen.getByRole("button", { name: "Button" }));
    expect(screen.getByText("Button color")).toBeTruthy();
  });

  it("DesignTab for Button shows a 'Button opacity' input in the expanded Button section", () => {
    render(<DesignTab s={{}} set={vi.fn()} blockType="Button" />);
    fireEvent.click(screen.getByRole("button", { name: "Button" }));
    expect(screen.getByText("Button opacity")).toBeTruthy();
  });

  it("DesignTab for Button does NOT show Frame section (border/shadow)", () => {
    render(<DesignTab s={{}} set={vi.fn()} blockType="Button" />);
    expect(screen.queryByText("Frame")).toBeNull();
    expect(screen.queryByText("Border width")).toBeNull();
    expect(screen.queryByText("Shadow")).toBeNull();
  });

  it("DesignTab for Button shows Corner radius in Design tab", () => {
    render(<DesignTab s={{}} set={vi.fn()} blockType="Button" />);
    fireEvent.click(screen.getByRole("button", { name: "Button" }));
    expect(screen.getByText("Corner radius")).toBeTruthy();
  });

  it("DesignTab for Button shows Button style picker (Solid/Outline/Soft) in the Button section", () => {
    render(<DesignTab s={{}} set={vi.fn()} blockType="Button" />);
    fireEvent.click(screen.getByRole("button", { name: "Button" }));
    expect(screen.getByText("Button style")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Solid" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Outline" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Soft" })).toBeTruthy();
  });
});

describe("StyleToolkitField — gallery container blocks (GalleryGrid/GalleryMasonry/FeaturedWork)", () => {
  it("GalleryGrid shows Frame drawer on Design tab (container-like)", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryGrid" />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    expect(screen.getByText("Frame")).toBeTruthy();
  });

  it("GalleryGrid Content tab shows Banner section (no fieldId standalone mode)", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryGrid" />);
    // Content tab is shown by default
    expect(screen.getByText("Banner")).toBeTruthy();
  });
});

describe("Sub-part 2 — gallery blocks hide bg-image picker, keep banner Color", () => {
  it("GalleryGrid Content tab does NOT render ContainerBackgroundControls (no bg-image picker)", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryGrid" />);
    // Content tab is default; "Background images" label from ContainerBackgroundControls must be absent
    expect(screen.queryByText("Background images")).toBeNull();
  });

  it("BannerSection with hideBgImage=true does NOT render Image picker", () => {
    render(<BannerSection s={{}} set={vi.fn()} hideBgImage={true} />);
    expect(screen.queryByText("Image")).toBeNull();
  });

  it("BannerSection without container shows compact 'Choose photo' button (not inline photo grid)", () => {
    // SingleImageControl renders a compact button picker; SingleImagePicker renders an inline grid/listbox.
    render(<BannerSection s={{}} set={vi.fn()} />);
    expect(screen.getByRole("button", { name: /choose photo/i })).toBeInTheDocument();
    expect(screen.queryByRole("listbox", { name: /photos/i })).toBeNull();
  });
});

describe("GalleryLayoutControls — writes _style.galleryColumns on click", () => {
  it("clicking column '2' calls onChange with _style.galleryColumns=2", () => {
    const onChange = vi.fn();
    render(
      <StyleToolkitField value={undefined} onChange={onChange} blockType="GalleryGrid" />
    );
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    // Gallery section drawer auto-opens (it is the first drawer in the group)
    // The "2" column button is visible after switching to Layout tab
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ galleryColumns: 2 }));
  });
});

describe("StyleToolkitField — Image block (F1 redesign)", () => {
  it("ContentInputs for Image shows an Alt text input wired to setProp", () => {
    const setProp = vi.fn();
    render(<ContentInputs type="Image" props={{ alt: "" }} setProp={setProp} />);
    const input = screen.getByLabelText("Alt text") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "A nice photo" } });
    expect(setProp).toHaveBeenCalledWith("alt", "A nice photo");
  });

  it("LayoutTabBody for Image shows Width and Height resize controls", () => {
    render(<LayoutTabBody s={{}} set={vi.fn()} isGridChild={false} showJustify={false} blockType="Image" />);
    expect(screen.getByText("Width")).toBeTruthy();
    expect(screen.getByText("Height")).toBeTruthy();
  });

  it("LayoutTabBody for Image shows Column span / Row span when it is a Columns grid child", () => {
    render(<LayoutTabBody s={{}} set={vi.fn()} isGridChild={true} showJustify={false} blockType="Image" />);
    expect(screen.getByText("Column span")).toBeTruthy();
    expect(screen.getByText("Row span")).toBeTruthy();
  });

  it("LayoutTabBody for Image does NOT show Background image opacity when no image is set", () => {
    render(<LayoutTabBody s={{}} set={vi.fn()} isGridChild={false} showJustify={false} blockType="Image" />);
    expect(screen.queryByText("Background image opacity")).toBeNull();
  });

  it("LayoutTabBody for Image shows Background image opacity once a background image is set", () => {
    render(
      <LayoutTabBody
        s={{ bgImagePublicId: "ws/photo.jpg" }}
        set={vi.fn()}
        isGridChild={false}
        showJustify={false}
        blockType="Image"
      />
    );
    expect(screen.getByText("Background image opacity")).toBeTruthy();
  });

  it("DesignTab for Image hides the Typography section (no on-page text)", () => {
    render(<DesignTab s={{}} set={vi.fn()} blockType="Image" />);
    expect(screen.queryByText("Typography")).toBeNull();
  });
});

describe("StyleToolkitField — Container background image opacity (F4)", () => {
  it("does NOT show Background image opacity when Container has no backgroundImages", () => {
    render(
      <LayoutTabBody s={{}} set={vi.fn()} isGridChild={false} showJustify={false} blockType="Container" p={{ backgroundImages: [] }} setProp={vi.fn()} />
    );
    expect(screen.queryByText("Background image opacity")).toBeNull();
  });

  it("shows Background image opacity once Container has a backgroundImages entry", () => {
    render(
      <LayoutTabBody
        s={{}}
        set={vi.fn()}
        isGridChild={false}
        showJustify={false}
        blockType="Container"
        p={{ backgroundImages: [{ id: "a", publicId: "ws/a" }] }}
        setProp={vi.fn()}
      />
    );
    // "Spacing" is the first drawer (auto-open); "Layout" must be expanded explicitly.
    fireEvent.click(screen.getByRole("button", { name: "Layout", expanded: false }));
    expect(screen.getByText("Background image opacity")).toBeTruthy();
  });
});

describe("BRAND_RADIUS_TO_PRESET mapping", () => {
  it("maps sharp to 0 (None preset)", () => {
    expect(BRAND_RADIUS_TO_PRESET.sharp).toBe(0);
  });

  it("maps subtle to 4 (S preset, 0.25rem = 4px)", () => {
    expect(BRAND_RADIUS_TO_PRESET.subtle).toBe(4);
  });

  it("maps rounded to 8 (M preset, 0.5rem = 8px)", () => {
    expect(BRAND_RADIUS_TO_PRESET.rounded).toBe(8);
  });
});

const DEFAULT_COLORS: BrandColorMap = {
  primary: "#111",
  secondary: "#f5f5f5",
  accent: "#2f5d56",
  background: "#fff",
  foreground: "#111",
};

describe("DesignTab — RadiusButtons shows brand theme radius when block radius is unset", () => {
  it("shows M (8) as aria-pressed in Frame section when brand radius is 'rounded' and block radius unset", () => {
    render(
      <BrandColorsContext.Provider value={{ ...DEFAULT_COLORS, brandRadius: "rounded" }}>
        <StyleToolkitField value={undefined} onChange={vi.fn()} />
      </BrandColorsContext.Provider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    // Open the Frame drawer to reveal RadiusButtons.
    fireEvent.click(screen.getByRole("button", { name: "Frame" }));
    expect(screen.getByRole("button", { name: "M" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "S" })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("ContentInputs — ContactDetails type", () => {
  it("renders Email floating-label input for ContactDetails type", () => {
    render(
      <ContentInputs
        type="ContactDetails"
        props={{}}
        setProp={vi.fn()}
      />
    );
    expect(screen.getByText("Email")).toBeTruthy();
  });

  it("renders Phone floating-label input for ContactDetails type", () => {
    render(
      <ContentInputs
        type="ContactDetails"
        props={{}}
        setProp={vi.fn()}
      />
    );
    expect(screen.getByText("Phone")).toBeTruthy();
  });

  it("renders a Columns section for ContactDetails type", () => {
    render(
      <ContentInputs
        type="ContactDetails"
        props={{}}
        setProp={vi.fn()}
      />
    );
    expect(screen.getByText(/columns/i)).toBeTruthy();
  });
});

describe("useBrandRadius hook", () => {
  it("returns brandRadius from BrandColorsContext", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BrandColorsContext.Provider value={{ ...DEFAULT_COLORS, brandRadius: "rounded" }}>
        {children}
      </BrandColorsContext.Provider>
    );
    const { result } = renderHook(() => useBrandRadius(), { wrapper });
    expect(result.current).toBe("rounded");
  });

  it("returns undefined when no brandRadius in context", () => {
    const { result } = renderHook(() => useBrandRadius());
    expect(result.current).toBeUndefined();
  });
});

describe("useEffectiveBrandRadius hook", () => {
  it("returns undefined when brandRadius is '' (empty string)", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      // Cast needed: BrandColorMap.brandRadius is BrandKitRadius | undefined at the type level,
      // but at runtime it can arrive as "" from PortfolioBrandKit fields that allow BrandKitRadius | "".
      <BrandColorsContext.Provider value={{ ...DEFAULT_COLORS, brandRadius: "" as never }}>
        {children}
      </BrandColorsContext.Provider>
    );
    const { result } = renderHook(() => useEffectiveBrandRadius(), { wrapper });
    expect(result.current).toBeUndefined();
  });
});

describe("BrandColorMap — headingFont and bodyFont fields", () => {
  it("BrandColorMap accepts headingFont and bodyFont (type and value check)", () => {
    // Verify BrandColorMap can hold font keys — this guards the EditorShell wiring.
    const map: BrandColorMap = {
      ...DEFAULT_COLORS,
      headingFont: "playfair",
      bodyFont: "inter",
    };
    expect(map.headingFont).toBe("playfair");
    expect(map.bodyFont).toBe("inter");
  });

  it("useEffectiveBrandFont returns headingFont from a BrandColorMap built like EditorShell does", () => {
    // Simulates the EditorShell brandColors object construction including font fields.
    const brandColors: BrandColorMap = {
      ...DEFAULT_COLORS,
      brandRadius: "subtle",
      headingFont: "fraunces",
      bodyFont: "dm-sans",
    };
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BrandColorsContext.Provider value={brandColors}>
        {children}
      </BrandColorsContext.Provider>
    );
    const { result } = renderHook(() => useEffectiveBrandFont("heading"), { wrapper });
    expect(result.current).toBe("fraunces");
  });
});

describe("useEffectiveBrandFont hook", () => {
  it("returns the heading font key from context when kind is 'heading'", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BrandColorsContext.Provider value={{ ...DEFAULT_COLORS, headingFont: "playfair", bodyFont: "inter" }}>
        {children}
      </BrandColorsContext.Provider>
    );
    const { result } = renderHook(() => useEffectiveBrandFont("heading"), { wrapper });
    expect(result.current).toBe("playfair");
  });

  it("returns the body font key from context when kind is 'body'", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BrandColorsContext.Provider value={{ ...DEFAULT_COLORS, headingFont: "playfair", bodyFont: "inter" }}>
        {children}
      </BrandColorsContext.Provider>
    );
    const { result } = renderHook(() => useEffectiveBrandFont("body"), { wrapper });
    expect(result.current).toBe("inter");
  });

  it("returns undefined when outside the editor (no fonts in context)", () => {
    const { result } = renderHook(() => useEffectiveBrandFont("heading"));
    expect(result.current).toBeUndefined();
  });
});

describe("DesignTab — font family dropdown pre-selects effective brand font when block fontFamily is unset", () => {
  it("shows the brand heading font as selected in the Font dropdown for Heading block when fontFamily is unset", () => {
    render(
      <BrandColorsContext.Provider value={{ ...DEFAULT_COLORS, headingFont: "playfair", bodyFont: "inter" }}>
        <DesignTab s={{}} set={vi.fn()} blockType="Heading" />
      </BrandColorsContext.Provider>
    );
    // The font select should show "playfair" as the selected value (effective heading font).
    // Typography drawer is auto-open (first drawer).
    const fontSelect = screen.getByRole("combobox") as HTMLSelectElement;
    expect(fontSelect.value).toBe("playfair");
  });

  it("explicit fontFamily on the block wins over the effective brand font", () => {
    render(
      <BrandColorsContext.Provider value={{ ...DEFAULT_COLORS, headingFont: "playfair", bodyFont: "inter" }}>
        <DesignTab s={{ fontFamily: "cormorant" }} set={vi.fn()} blockType="Heading" />
      </BrandColorsContext.Provider>
    );
    const fontSelect = screen.getByRole("combobox") as HTMLSelectElement;
    expect(fontSelect.value).toBe("cormorant");
  });
});

describe("LayoutTabBody — gap input shows effective default 16 as placeholder when gap is unset", () => {
  it("Gap input shows placeholder '16' when _style.gap is undefined", () => {
    render(
      <LayoutTabBody
        s={{}}
        set={() => {}}
        isGridChild={false}
        showJustify={true}
        blockType="Container"
        p={{}}
        setProp={() => {}}
      />
    );
    // Layout drawer is the second drawer; open it to see Gap.
    fireEvent.click(screen.getByRole("button", { name: "Layout", expanded: false }));
    // Find the "Gap" label text node's parent row, then find the spinbutton within it.
    const gapLabel = screen.getByText("Gap");
    const gapRow = gapLabel.closest("div")!;
    const gapInput = within(gapRow).getByRole("spinbutton");
    // When gap is unset, the input value is empty but placeholder shows the effective default.
    expect(gapInput).toHaveAttribute("placeholder", "16");
  });
});

describe("DesignTab — Border color swatch pre-selects 'foreground' when borderColorToken is unset", () => {
  it("foreground swatch (Text) in Border color row is aria-pressed when borderColorToken is unset", () => {
    render(<DesignTab s={{}} set={vi.fn()} blockType="Container" />);
    fireEvent.click(screen.getByRole("button", { name: "Frame" }));
    // The Frame drawer contains a "Border color" label; the swatch row below it
    // should show the foreground token as effective-active. Use the label to scope.
    const borderColorLabel = screen.getByText("Border color");
    const borderColorRow = borderColorLabel.closest("div")!.querySelector("div")!;
    // The first "Text" button in this row should be aria-pressed (foreground = effective).
    const textSwatches = within(borderColorRow as HTMLElement).getAllByRole("button", { name: "Text" });
    expect(textSwatches[0]).toHaveAttribute("aria-pressed", "true");
  });
});

describe("DesignTab — Font size input shows effective default 16 as placeholder when fontSize is unset", () => {
  it("Font size input has placeholder '16' for a Text block when fontSize is unset", () => {
    render(<DesignTab s={{}} set={vi.fn()} blockType="Text" />);
    // Typography drawer is auto-open.
    const fontSizeLabel = screen.getByText("Font size");
    const row = fontSizeLabel.closest("div")!;
    const input = within(row).getByRole("spinbutton");
    expect(input).toHaveAttribute("placeholder", "16");
  });
});

describe("DesignTab — Border width input shows effective default 0 as placeholder when borderWidth is unset", () => {
  it("Border width input has placeholder '0' for a framed block when borderWidth is unset", () => {
    render(<DesignTab s={{}} set={vi.fn()} blockType="Container" />);
    // Open Frame drawer.
    fireEvent.click(screen.getByRole("button", { name: "Frame" }));
    const borderWidthLabel = screen.getByText("Border width");
    const row = borderWidthLabel.closest("div")!;
    const input = within(row).getByRole("spinbutton");
    expect(input).toHaveAttribute("placeholder", "0");
  });
});

describe("LayoutTabBody — Align icon row shows effective default 'stretch' when alignItems is unset", () => {
  it("Stretch to fill icon is marked active (aria-pressed=true) when alignItems is unset", () => {
    render(
      <LayoutTabBody
        s={{}}
        set={() => {}}
        isGridChild={false}
        showJustify={true}
        blockType="Container"
        p={{}}
        setProp={() => {}}
      />
    );
    // Open the Layout drawer.
    fireEvent.click(screen.getByRole("button", { name: "Layout", expanded: false }));
    expect(screen.getByRole("button", { name: "Stretch to fill" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Left" })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("LayoutTabBody — Min height buttons show effective default 'auto' when minHeight prop is unset", () => {
  it("Auto button is aria-pressed when p.minHeight is undefined (effective default)", () => {
    render(
      <LayoutTabBody
        s={{}}
        set={() => {}}
        isGridChild={false}
        showJustify={true}
        blockType="Container"
        p={{}}
        setProp={() => {}}
      />
    );
    // Open the Layout drawer to reveal min height controls.
    fireEvent.click(screen.getByRole("button", { name: "Layout", expanded: false }));
    expect(screen.getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "true");
  });

  it("renders all 5 min-height options including Custom (overflow fix: all options must be in the DOM)", () => {
    render(
      <LayoutTabBody
        s={{}}
        set={() => {}}
        isGridChild={false}
        showJustify={true}
        blockType="Container"
        p={{}}
        setProp={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Layout", expanded: false }));
    // All 5 options must be reachable — previously "Custom" was clipped by panel overflow.
    expect(screen.getByRole("button", { name: "Auto" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Short" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Medium" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tall" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Custom" })).toBeInTheDocument();
  });
});

describe("A5: LayoutTabBody — Container min-height Custom option shows DimensionInput", () => {
  it("selecting Custom reveals a Custom value DimensionInput (A5)", () => {
    render(
      <LayoutTabBody
        s={{}}
        set={() => {}}
        isGridChild={false}
        showJustify={true}
        blockType="Container"
        p={{ minHeight: "custom" }}
        setProp={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Layout", expanded: false }));
    expect(screen.getByRole("button", { name: "Custom" })).toHaveAttribute("aria-pressed", "true");
    // DimensionInput should be visible when "custom" is active.
    expect(screen.getByText("Custom value")).toBeTruthy();
  });
});

describe("A7: LayoutTabBody — Columns Overall Width control", () => {
  it("shows Page fit and Full buttons for Columns block in Layout tab (A7)", () => {
    render(
      <LayoutTabBody
        s={{}}
        set={() => {}}
        isGridChild={false}
        showJustify={false}
        blockType="Columns"
        p={{ overallWidth: "page-fit" }}
        setProp={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Layout", expanded: false }));
    expect(screen.getByRole("button", { name: "Page fit" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Full" })).toBeTruthy();
  });
});

describe("A6: LayoutTabBody — Align/Justify IconRow shows Reset button when value set", () => {
  it("Align Reset button appears when alignItems is explicitly set (A6)", () => {
    render(
      <LayoutTabBody
        s={{ alignItems: "center" }}
        set={vi.fn()}
        isGridChild={false}
        showJustify={true}
        blockType="Container"
        p={{}}
        setProp={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Layout", expanded: false }));
    expect(screen.getByRole("button", { name: "Reset Align" })).toBeTruthy();
  });
});

describe("DesignTab Button — RadiusButtons shows brand theme radius when block radius is unset", () => {
  it("shows None as aria-pressed for Button block when brand radius is 'sharp' and block radius unset", () => {
    // Radius moved from LayoutTabBody to DesignTab Button section in Pass 2.
    render(
      <BrandColorsContext.Provider value={{ ...DEFAULT_COLORS, brandRadius: "sharp" }}>
        <DesignTab s={{}} set={vi.fn()} blockType="Button" />
      </BrandColorsContext.Provider>
    );
    // Expand the Button section to reveal RadiusButtons.
    fireEvent.click(screen.getByRole("button", { name: "Button" }));
    // "None" is unique (the size picker S/M/L has no overlap with RadiusButtons' None/S/M/L/Full).
    expect(screen.getAllByRole("button", { name: "None" })[0]).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("button", { name: "Full" })[0]).toHaveAttribute("aria-pressed", "false");
  });
});

describe("resolveEffectiveFonts — legacy fontPair fallback", () => {
  it("falls back to legacy fontPair mapping when headingFont/bodyFont are absent", () => {
    const result = resolveEffectiveFonts({ fontPair: "playfair-inter" });
    expect(result.headingFont).toBe("playfair");
    expect(result.bodyFont).toBe("inter");
  });

  it("prefers explicit headingFont/bodyFont over the legacy fontPair when both are set", () => {
    const result = resolveEffectiveFonts({ fontPair: "playfair-inter", headingFont: "fraunces", bodyFont: "montserrat" });
    expect(result.headingFont).toBe("fraunces");
    expect(result.bodyFont).toBe("montserrat");
  });
});

describe("DesignTab — Border color swatch effective state is visually distinct", () => {
  it("effective-but-unset swatch has a lighter ring class (ring-1) but not the explicit ring-2", () => {
    render(<DesignTab s={{}} set={vi.fn()} blockType="Container" />);
    fireEvent.click(screen.getByRole("button", { name: "Frame" }));
    const borderColorLabel = screen.getByText("Border color");
    const borderColorRow = borderColorLabel.closest("div")!.querySelector("div")!;
    const textSwatches = within(borderColorRow as HTMLElement).getAllByRole("button", { name: "Text" });
    const effectiveSwatch = textSwatches[0];
    // aria-pressed confirms it's the effective swatch, not just any swatch
    expect(effectiveSwatch).toHaveAttribute("aria-pressed", "true");
    // effective state uses a lighter unconditional ring (ring-1 without a variant prefix),
    // not the explicit ring (ring-2). focus-visible:ring-1 is always present; we want
    // the bare class to also appear as a space-delimited token.
    const classes = effectiveSwatch.className.split(/\s+/);
    expect(classes).toContain("ring-1");
    expect(classes).not.toContain("ring-2");
  });
});

describe("DesignTab — text color swatch effective state (Text/Heading blocks)", () => {
  it("foreground swatch is aria-pressed when textColorToken is unset on a Text block", () => {
    render(<DesignTab s={{}} set={vi.fn()} blockType="Text" />);
    // Typography drawer is auto-open — text color row is visible
    const textColorLabel = screen.getByText("Text color");
    const textColorSection = textColorLabel.closest("div")!.parentElement!;
    const foregroundSwatches = within(textColorSection as HTMLElement).getAllByRole("button", { name: "Text" });
    expect(foregroundSwatches[0]).toHaveAttribute("aria-pressed", "true");
  });

  it("effective text color swatch has lighter ring class (ring-1) not explicit ring-2", () => {
    render(<DesignTab s={{}} set={vi.fn()} blockType="Text" />);
    const textColorLabel = screen.getByText("Text color");
    const textColorSection = textColorLabel.closest("div")!.parentElement!;
    const foregroundSwatch = within(textColorSection as HTMLElement).getAllByRole("button", { name: "Text" })[0];
    const classes = foregroundSwatch.className.split(/\s+/);
    expect(classes).toContain("ring-1");
    expect(classes).not.toContain("ring-2");
  });

  it("explicit primary token on Text block — primary swatch is ring-2 (explicit, not effective)", () => {
    render(<DesignTab s={{ textColorToken: "primary" }} set={vi.fn()} blockType="Text" />);
    const textColorLabel = screen.getByText("Text color");
    const textColorSection = textColorLabel.closest("div")!.parentElement!;
    const primarySwatch = within(textColorSection as HTMLElement).getAllByRole("button", { name: "Primary" })[0];
    const classes = primarySwatch.className.split(/\s+/);
    expect(primarySwatch).toHaveAttribute("aria-pressed", "true");
    expect(classes).toContain("ring-2");
    expect(classes).not.toContain("opacity-70");
  });
});

describe("DesignTab — button text color swatch effective state", () => {
  it("Button with no buttonStyle → foreground swatch is aria-pressed in Button text color row", () => {
    render(
      <BrandColorsContext.Provider value={{ ...DEFAULT_COLORS, brandRadius: "subtle" }}>
        <DesignTab s={{}} set={vi.fn()} blockType="Button" />
      </BrandColorsContext.Provider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Button" }));
    const btnTextLabel = screen.getByText("Button text color");
    const btnTextSection = btnTextLabel.closest("div")!.parentElement!;
    const foregroundSwatches = within(btnTextSection as HTMLElement).getAllByRole("button", { name: "Text" });
    expect(foregroundSwatches[0]).toHaveAttribute("aria-pressed", "true");
  });

  it("Button buttonStyle='solid' → background swatch is aria-pressed as effective text color", () => {
    render(
      <BrandColorsContext.Provider value={{ ...DEFAULT_COLORS, brandRadius: "subtle" }}>
        <DesignTab s={{ buttonStyle: "solid" }} set={vi.fn()} blockType="Button" />
      </BrandColorsContext.Provider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Button" }));
    const btnTextLabel = screen.getByText("Button text color");
    const btnTextSection = btnTextLabel.closest("div")!.parentElement!;
    const backgroundSwatches = within(btnTextSection as HTMLElement).getAllByRole("button", { name: "Background" });
    expect(backgroundSwatches[0]).toHaveAttribute("aria-pressed", "true");
  });

  it("Button soft with buttonColorToken='accent' → accent swatch is aria-pressed as effective text color", () => {
    render(
      <BrandColorsContext.Provider value={{ ...DEFAULT_COLORS, brandRadius: "subtle" }}>
        <DesignTab s={{ buttonStyle: "soft", buttonColorToken: "accent" }} set={vi.fn()} blockType="Button" />
      </BrandColorsContext.Provider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Button" }));
    const btnTextLabel = screen.getByText("Button text color");
    const btnTextSection = btnTextLabel.closest("div")!.parentElement!;
    const accentSwatches = within(btnTextSection as HTMLElement).getAllByRole("button", { name: "Accent" });
    expect(accentSwatches[0]).toHaveAttribute("aria-pressed", "true");
  });
});

describe("NumberInputRow (gap) — edit writes real value", () => {
  it("typing a value into the gap input calls the style setter with the real typed number", () => {
    const set = vi.fn();
    render(
      <LayoutTabBody
        s={{}}
        set={set}
        isGridChild={false}
        showJustify={true}
        blockType="Container"
        p={{}}
        setProp={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Layout", expanded: false }));
    const gapLabel = screen.getByText("Gap");
    const gapRow = gapLabel.closest("div")!;
    const gapInput = within(gapRow).getByRole("spinbutton");
    fireEvent.change(gapInput, { target: { value: "24" } });
    // style setter is called with { gap: 24 } — the real typed value, not the effective default (16)
    expect(set).toHaveBeenCalled();
    const lastCall = set.mock.calls[set.mock.calls.length - 1][0] as Record<string, unknown>;
    expect(lastCall.gap).toBe(24);
  });

  it("resetting the gap input calls the style setter with gap: undefined (reverts to effective)", () => {
    const set = vi.fn();
    render(
      <LayoutTabBody
        s={{ gap: 24 }}
        set={set}
        isGridChild={false}
        showJustify={true}
        blockType="Container"
        p={{}}
        setProp={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Layout", expanded: false }));
    const gapLabel = screen.getByText("Gap");
    const gapRow = gapLabel.closest("div")!;
    const resetBtn = within(gapRow).getByRole("button", { name: /Reset Gap/i });
    fireEvent.click(resetBtn);
    // After reset, gap is cleared so the effective default (placeholder "16") re-appears
    expect(set).toHaveBeenCalled();
    const lastCall = set.mock.calls[set.mock.calls.length - 1][0] as Record<string, unknown>;
    expect(lastCall.gap).toBeUndefined();
  });
});

describe("B2a: Container padding — effective-default display (placeholder)", () => {
  it("LayoutTabBody for Container shows placeholder '24' on padding Top input when _style has no padding", () => {
    render(
      <LayoutTabBody
        s={{}}
        set={() => {}}
        isGridChild={false}
        showJustify={true}
        blockType="Container"
        p={{ minHeight: "auto" }}
        setProp={() => {}}
      />,
    );
    // Spacing drawer auto-opens; click Advanced to show per-side inputs
    fireEvent.click(screen.getByRole("button", { name: "Padding advanced options" }));
    // DimensionInput uses a <span> label, so we query all spinbuttons; Top is first.
    const spinbuttons = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    // First spinbutton is the Top padding number input.
    // DimensionInput converts the effective rem value ("1.5rem") to px for display
    // (1.5 × 16 = 24). See commit that introduced rem→px conversion.
    expect(spinbuttons[0].placeholder).toBe("24");
  });
});

describe("Font select — Google Fonts", () => {
  it("selecting a Google Fonts shortlist entry calls the setter with a google: selection", () => {
    const set = vi.fn();
    render(<DesignTab s={{}} set={set} blockType="Heading" />);
    const fontSelect = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(fontSelect, { target: { value: "google:Poppins" } });
    const lastCall = set.mock.calls[set.mock.calls.length - 1][0] as Record<string, unknown>;
    expect(lastCall.fontFamily).toBe("google:Poppins");
  });
});

describe("Font select — edit writes real selected font key", () => {
  it("selecting a font from the dropdown calls the setter with the real fontFamily key", () => {
    const set = vi.fn();
    render(
      <BrandColorsContext.Provider value={{ ...DEFAULT_COLORS, headingFont: "playfair", bodyFont: "inter" }}>
        <DesignTab s={{}} set={set} blockType="Heading" />
      </BrandColorsContext.Provider>
    );
    // Typography drawer is auto-open; font select shows effective heading font (playfair)
    const fontSelect = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(fontSelect, { target: { value: "cormorant" } });
    // setter is called with the real selected key, not the effective default
    expect(set).toHaveBeenCalled();
    const lastCall = set.mock.calls[set.mock.calls.length - 1][0] as Record<string, unknown>;
    expect(lastCall.fontFamily).toBe("cormorant");
  });

  it("resetting font clears fontFamily to undefined and re-shows effective font in dropdown", () => {
    const set = vi.fn();
    render(
      <BrandColorsContext.Provider value={{ ...DEFAULT_COLORS, headingFont: "playfair", bodyFont: "inter" }}>
        <DesignTab s={{ fontFamily: "cormorant" }} set={set} blockType="Heading" />
      </BrandColorsContext.Provider>
    );
    // Typography drawer is auto-open; explicit cormorant is set
    const fontSelect = screen.getByRole("combobox") as HTMLSelectElement;
    expect(fontSelect.value).toBe("cormorant");
    // Click the Reset Font button
    fireEvent.click(screen.getByRole("button", { name: /Reset Font/i }));
    // setter is called with fontFamily: undefined — effective heading font re-shows
    expect(set).toHaveBeenCalled();
    const lastCall = set.mock.calls[set.mock.calls.length - 1][0] as Record<string, unknown>;
    expect(lastCall.fontFamily).toBeUndefined();
  });
});

describe("DesignTab — ContactDetails", () => {
  it("renders Labels and Inputs sub-tabs for ContactDetails", () => {
    render(
      <DesignTab
        s={{}}
        set={vi.fn()}
        blockType="ContactDetails"
      />
    );
    expect(screen.getByText("Labels")).toBeTruthy();
    expect(screen.getByText("Inputs")).toBeTruthy();
  });
});
