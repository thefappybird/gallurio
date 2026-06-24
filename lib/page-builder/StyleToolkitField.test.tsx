import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import React from "react";
import { StyleToolkitField, ContainerBackgroundControls, CarouselTextPadding, CONTAINER_TYPES, FLEX_CONTAINER_BLOCKS, LayoutTabBody, DesignTab, RadiusButtons, ContentInputs, BRAND_RADIUS_TO_PRESET } from "./StyleToolkitField";
import type { BlockStyle } from "./styleToolkit";
import { BrandColorsContext, useBrandRadius, useEffectiveBrandRadius, useEffectiveBrandFont } from "./brandColors";
import type { BrandColorMap } from "./brandColors";

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

describe("ContentInputs — emoji button integration", () => {
  it("Heading block shows Insert emoji button beside the text input", () => {
    render(<ContentInputs type="Heading" props={{ text: "Hello", level: "h2" }} setProp={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Insert emoji" })).toBeTruthy();
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
});

describe("LayoutTabBody Button — RadiusButtons shows brand theme radius when block radius is unset", () => {
  it("shows None as aria-pressed for Button block when brand radius is 'sharp' and block radius unset", () => {
    // Uses "None" preset (value=0) which is unique in the LayoutTabBody Button — unlike "S"/"M"/"L"
    // which collide with the size picker buttons.
    render(
      <BrandColorsContext.Provider value={{ ...DEFAULT_COLORS, brandRadius: "sharp" }}>
        <LayoutTabBody
          s={{}}
          set={() => {}}
          isGridChild={false}
          showJustify={false}
          blockType="Button"
          p={{}}
          setProp={() => {}}
        />
      </BrandColorsContext.Provider>
    );
    // "None" appears only in RadiusButtons (the size picker uses S/M/L), so this is unique.
    expect(screen.getByRole("button", { name: "None" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Full" })).toHaveAttribute("aria-pressed", "false");
  });
});
