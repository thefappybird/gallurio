import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import React from "react";
import { StyleToolkitField, ContainerBackgroundControls, CarouselTextPadding, CONTAINER_TYPES, FLEX_CONTAINER_BLOCKS, LayoutTabBody, DesignTab, RadiusButtons, ContentInputs, BRAND_RADIUS_TO_PRESET, BannerSection } from "./StyleToolkitField";
import type { BlockStyle } from "./styleToolkit";
import { BrandColorsContext, useBrandRadius, useEffectiveBrandRadius, useEffectiveBrandFont } from "./brandColors";
import type { BrandColorMap } from "./brandColors";
import { resolveEffectiveFonts } from "./fonts";
import { SECTION_PRESET_KEYS, NAV_PRESET_KEYS } from "./blocks/sectionPresets";
import { SingleCollectionControl } from "./galleryPicker/MediaField";
import { DemoPickerContext } from "./demoPickerContext";

vi.mock("next-intl", () => ({
  useTranslations: () =>
    Object.assign((key: string) => key, {
      has: () => true,
    }),
}));

// Replaces the real dialog-based collections picker with two buttons that fire
// onChange directly — this suite tests the mapping/trim logic (Multi/Single
// CollectionControl + the CollectionCard Content-tab branch), not the picker's
// own dialog UI (covered by galleryPicker/MediaField.test.tsx and friends).
vi.mock("./galleryPicker/MediaPicker", async () => {
  const React = await import("react");
  return {
    MediaPicker: (props: {
      mode: string;
      open: boolean;
      onChange: (next: unknown) => void;
    }) => {
      if (!props.open || props.mode !== "collections") return null;
      return React.createElement(
        "div",
        null,
        React.createElement("button", { type: "button", onClick: () => props.onChange([]) }, "mock-select-none"),
        React.createElement(
          "button",
          {
            type: "button",
            onClick: () =>
              props.onChange([
                { id: "1", name: "One", coverPublicId: "c1", itemCount: 2 },
                { id: "2", name: "Two", coverPublicId: "c2", itemCount: 5 },
              ]),
          },
          "mock-select-many"
        )
      );
    },
  };
});

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

  it("Layout tab hides unsupported alignment controls when no block is selected", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    fireEvent.click(screen.getByRole("button", { name: "Layout", expanded: false }));
    expect(screen.queryByText("Content alignment")).toBeNull();
    expect(screen.queryByText("Content distribution")).toBeNull();
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
        overlayOpacity={undefined}
        overlayColorToken={undefined}
        onOverlayOpacityChange={noop}
        onOverlayColorChange={noop}
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
        overlayOpacity={undefined}
        overlayColorToken={undefined}
        onOverlayOpacityChange={noop}
        onOverlayColorChange={noop}
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
        overlayOpacity={undefined}
        overlayColorToken={undefined}
        onOverlayOpacityChange={noop}
        onOverlayColorChange={noop}
      />
    );
    fireEvent.change(screen.getByLabelText("Background animation"), { target: { value: "slide" } });
    expect(onAnimationChange).toHaveBeenCalledWith("slide");
  });
});

describe("ContainerBackgroundControls — scrim gating", () => {
  const noop = () => {};

  it("hides Overlay opacity + color controls with zero background images", () => {
    render(
      <ContainerBackgroundControls
        images={[]}
        onImagesChange={noop}
        animation="crossfade"
        speed="medium"
        onAnimationChange={noop}
        onSpeedChange={noop}
        overlayOpacity={undefined}
        overlayColorToken={undefined}
        onOverlayOpacityChange={noop}
        onOverlayColorChange={noop}
      />
    );
    expect(screen.queryByText("Overlay opacity")).toBeNull();
    expect(screen.queryByText("Overlay color")).toBeNull();
  });

  it("shows Overlay opacity + color controls with one background image", () => {
    render(
      <ContainerBackgroundControls
        images={[{ id: "a", publicId: "p" }]}
        onImagesChange={noop}
        animation="crossfade"
        speed="medium"
        onAnimationChange={noop}
        onSpeedChange={noop}
        overlayOpacity={undefined}
        overlayColorToken={undefined}
        onOverlayOpacityChange={noop}
        onOverlayColorChange={noop}
      />
    );
    expect(screen.getByText("Overlay opacity")).toBeTruthy();
    expect(screen.getByText("Overlay color")).toBeTruthy();
  });

  it("changing the overlay color swatch calls onOverlayColorChange with the token", () => {
    const onOverlayColorChange = vi.fn();
    render(
      <ContainerBackgroundControls
        images={[{ id: "a", publicId: "p" }]}
        onImagesChange={noop}
        animation="crossfade"
        speed="medium"
        onAnimationChange={noop}
        onSpeedChange={noop}
        overlayOpacity={0}
        overlayColorToken={undefined}
        onOverlayOpacityChange={noop}
        onOverlayColorChange={onOverlayColorChange}
      />
    );
    const overlayColorLabel = screen.getByText("Overlay color");
    const overlaySection = overlayColorLabel.parentElement!;
    fireEvent.click(within(overlaySection).getByRole("button", { name: "Accent" }));
    expect(onOverlayColorChange).toHaveBeenCalledWith("accent");
  });

  it("clearing the overlay color swatch calls onOverlayColorChange with undefined", () => {
    const onOverlayColorChange = vi.fn();
    render(
      <ContainerBackgroundControls
        images={[{ id: "a", publicId: "p" }]}
        onImagesChange={noop}
        animation="crossfade"
        speed="medium"
        onAnimationChange={noop}
        onSpeedChange={noop}
        overlayOpacity={0}
        overlayColorToken="accent"
        onOverlayOpacityChange={noop}
        onOverlayColorChange={onOverlayColorChange}
      />
    );
    const overlayColorLabel = screen.getByText("Overlay color");
    const overlaySection = overlayColorLabel.parentElement!;
    fireEvent.click(within(overlaySection).getByRole("button", { name: "Reset color" }));
    expect(onOverlayColorChange).toHaveBeenCalledWith(undefined);
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

describe("CONTAINER_TYPES / FLEX_CONTAINER_BLOCKS — derived from the preset registry", () => {
  it("contains every Container-shaped registry key plus Container, nothing hand-listed", () => {
    for (const key of SECTION_PRESET_KEYS) {
      const isNav = (NAV_PRESET_KEYS as readonly string[]).includes(key);
      expect(CONTAINER_TYPES.has(key)).toBe(!isNav);
      expect(FLEX_CONTAINER_BLOCKS.has(key)).toBe(!isNav);
    }
    expect(CONTAINER_TYPES.has("Container")).toBe(true);
    expect(FLEX_CONTAINER_BLOCKS.has("Container")).toBe(true);
    expect(CONTAINER_TYPES.size).toBe(SECTION_PRESET_KEYS.length - NAV_PRESET_KEYS.length + 1);
    expect(FLEX_CONTAINER_BLOCKS.size).toBe(SECTION_PRESET_KEYS.length - NAV_PRESET_KEYS.length + 1);
  });

  it("includes VideoPreset — the hand-listed sets omitted it (live bug)", () => {
    expect(CONTAINER_TYPES.has("VideoPreset")).toBe(true);
    expect(FLEX_CONTAINER_BLOCKS.has("VideoPreset")).toBe(true);
  });

  // Regression: the nav group's 3 keys are NOT Container-shaped (they render
  // through NavigationBlock and carry no `_style`) — a prior version of this
  // parity test iterated ALL of SECTION_PRESET_KEYS (nav included) and both
  // sides grew by 3 in lockstep, so the bug went undetected.
  it("excludes every NAV_PRESET_KEYS entry — Navigation blocks are not containers", () => {
    for (const key of NAV_PRESET_KEYS) {
      expect(CONTAINER_TYPES.has(key)).toBe(false);
      expect(FLEX_CONTAINER_BLOCKS.has(key)).toBe(false);
    }
  });
});

describe("ContentInputs — CollectionCard", () => {
  it("renders a collection picker control on the Content tab", () => {
    render(<ContentInputs type="CollectionCard" props={{}} setProp={vi.fn()} />);
    expect(screen.getByText("Collection")).toBeTruthy();
    expect(screen.getByRole("button", { name: /choose collection/i })).toBeTruthy();
  });

  it("picking a collection writes the collection prop", () => {
    const setProp = vi.fn();
    render(<ContentInputs type="CollectionCard" props={{}} setProp={setProp} />);
    fireEvent.click(screen.getByRole("button", { name: /choose collection/i }));
    fireEvent.click(screen.getByText("mock-select-many"));
    expect(setProp).toHaveBeenCalledWith("collection", {
      id: "1",
      name: "One",
      coverPublicId: "c1",
      itemCount: 2,
    });
  });

  it("keeps crop and caption settings in the Content tab", () => {
    const setProp = vi.fn();
    render(<ContentInputs type="CollectionCard" props={{}} setProp={setProp} />);

    fireEvent.click(screen.getByRole("button", { name: "3/2" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));

    expect(setProp).toHaveBeenCalledWith("aspectRatio", "3 / 2");
    expect(setProp).toHaveBeenCalledWith("showCaption", false);
  });

  it("shows the demo explanation instead of the picker in demo mode", () => {
    render(
      <DemoPickerContext.Provider value={{ demoSessionId: "s", onImageCapHit: vi.fn() }}>
        <ContentInputs type="CollectionCard" props={{}} setProp={vi.fn()} />
      </DemoPickerContext.Provider>
    );
    expect(screen.getByText(/collections aren.t available in this demo/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /choose collection/i })).toBeNull();
  });
});

describe("DesignTab — CollectionCard", () => {
  it("uses its dedicated caption drawers without a disconnected Typography drawer", () => {
    render(<DesignTab s={{}} set={vi.fn()} blockType="CollectionCard" />);

    expect(screen.getByRole("button", { name: "Collection title" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Photo count" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Typography" })).toBeNull();
  });
});

describe("ContentInputs — Navigation", () => {
  // Sections are collapsible (EditorDrawerGroup, first section open by
  // default) — open the one under test the same way a real user would.
  function openSection(name: string) {
    fireEvent.click(screen.getByRole("button", { name }));
  }

  it.each(NAV_PRESET_KEYS)("renders the Navigation field panel for %s", (type) => {
    render(<ContentInputs type={type} props={{}} setProp={vi.fn()} />);

    // "Brand" is open by default.
    expect(screen.getByText("Navbar size")).toBeInTheDocument();
    expect(screen.getByText("Upload logo")).toBeInTheDocument();

    openSection("Banner");
    expect(screen.getByText("Background color")).toBeInTheDocument();
    expect(screen.getByText("Shadow")).toBeInTheDocument();

    openSection("Links");
    expect(screen.getByText("Font size")).toBeInTheDocument();
    expect(screen.getByText("Scale active link")).toBeInTheDocument();

    openSection("Contact button");
    expect(screen.getByText("Fill color")).toBeInTheDocument();
  });

  it("writes background color via setProp", () => {
    const setProp = vi.fn();
    render(<ContentInputs type="NavBorderedPreset" props={{}} setProp={setProp} />);

    openSection("Banner");
    const bgRow = screen.getByText("Background color").closest("div") as HTMLElement;
    fireEvent.click(within(bgRow).getByRole("button", { name: "Primary" }));
    expect(setProp).toHaveBeenCalledWith("backgroundColor", "primary");
  });

  it("shows the highlight color/opacity/radius controls only when activeLinkHighlight is on", () => {
    const { rerender } = render(
      <ContentInputs type="NavBorderedPreset" props={{}} setProp={vi.fn()} />
    );
    openSection("Links");
    expect(screen.queryByText("Highlight opacity")).not.toBeInTheDocument();

    rerender(
      <ContentInputs
        type="NavBorderedPreset"
        props={{ activeLinkHighlight: true }}
        setProp={vi.fn()}
      />
    );
    expect(screen.getByText("Highlight opacity")).toBeInTheDocument();
    expect(screen.getByText("Highlight radius")).toBeInTheDocument();
  });

  it("shows the detach toggle enabled with no navDetach context", () => {
    render(<ContentInputs type="NavBorderedPreset" props={{}} setProp={vi.fn()} />);
    openSection("Sync");
    const toggle = screen.getByRole("switch", { name: /detach header/i });
    expect(toggle).not.toBeDisabled();
  });

  it("disables the detach toggle and shows the hint naming the other page when navDetach.disabled is true", () => {
    render(
      <ContentInputs
        type="NavBorderedPreset"
        props={{}}
        setProp={vi.fn()}
        navDetach={{ zoneLabel: "Gallery", otherZoneLabel: "Home", disabled: true }}
      />
    );
    openSection("Sync");
    const toggle = screen.getByRole("switch", { name: "Detach header on Gallery" });
    expect(toggle).toBeDisabled();
    expect(screen.getByText(/Home already has a detached header/i)).toBeInTheDocument();
  });

  it("toggling the detach switch calls setProp('detached', ...)", () => {
    const setProp = vi.fn();
    render(
      <ContentInputs
        type="NavBorderedPreset"
        props={{ detached: false }}
        setProp={setProp}
        navDetach={{ zoneLabel: "Home", otherZoneLabel: "Gallery", disabled: false }}
      />
    );
    openSection("Sync");
    fireEvent.click(screen.getByRole("switch", { name: "Detach header on Home" }));
    expect(setProp).toHaveBeenCalledWith("detached", true);
  });
});

describe("ContentInputs — Button", () => {
  it("offers Home, Gallery, and Contact actions", () => {
    render(<ContentInputs type="Button" props={{ action: "open-contact" }} setProp={vi.fn()} />);

    const options = within(screen.getByRole("combobox", { name: "Action" }))
      .getAllByRole("option")
      .map((option) => (option as HTMLOptionElement).value);

    expect(options).toEqual(["open-contact", "go-to-gallery", "go-to-home"]);
  });

  it("writes the go-to-home action", () => {
    const setProp = vi.fn();
    render(<ContentInputs type="Button" props={{ action: "open-contact" }} setProp={setProp} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Action" }), {
      target: { value: "go-to-home" },
    });

    expect(setProp).toHaveBeenCalledWith("action", "go-to-home");
  });
});

describe("ContentInputs slot galleries", () => {
  it.each(["GalleryGrid", "GalleryMasonry"])("shows one parent photo picker for %s", (type) => {
    render(
      <ContentInputs
        type={type}
        props={{ id: `${type}-1`, images: [], masonryLayout: "columns", _style: { galleryColumns: 3 }, content: [], column1: [], column2: [], column3: [] }}
        setProp={vi.fn()}
        setProps={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Choose photos" })).toBeInTheDocument();
  });

  it("keeps legacy image-array galleries read-only", () => {
    const { container } = render(
      <ContentInputs
        type="GalleryGrid"
        props={{ images: [{ id: "legacy", publicId: "asset/legacy" }] }}
        setProp={vi.fn()}
        setProps={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("SingleCollectionControl", () => {
  it("clears to undefined on an empty selection", () => {
    const onChange = vi.fn();
    render(
      <SingleCollectionControl
        value={{ id: "1", name: "One", coverPublicId: "c1", itemCount: 2 }}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /change collection/i }));
    fireEvent.click(screen.getByText("mock-select-none"));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("keeps only the first entry when the picker returns several", () => {
    const onChange = vi.fn();
    render(<SingleCollectionControl value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /choose collection/i }));
    fireEvent.click(screen.getByText("mock-select-many"));
    expect(onChange).toHaveBeenCalledWith({ id: "1", name: "One", coverPublicId: "c1", itemCount: 2 });
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
    render(<DesignTab s={{ buttonStyle: "solid" }} set={vi.fn()} blockType="Button" />);
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

  it("floats the legacy outline style and foreground button color when style is unset", () => {
    render(<DesignTab s={{}} set={vi.fn()} blockType="Button" />);
    fireEvent.click(screen.getByRole("button", { name: "Button" }));
    expect(screen.getByRole("button", { name: "Outline" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const colorRow = screen.getByText("Button color").parentElement!.parentElement!;
    expect(within(colorRow).getByRole("button", { name: "Text" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("floats primary as the rendered color for an explicit named button style", () => {
    render(<DesignTab s={{ buttonStyle: "solid" }} set={vi.fn()} blockType="Button" />);
    fireEvent.click(screen.getByRole("button", { name: "Button" }));
    const colorRow = screen.getByText("Button color").parentElement!.parentElement!;
    expect(within(colorRow).getByRole("button", { name: "Primary" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("link style hides controls that its renderer ignores", () => {
    render(<DesignTab s={{ buttonStyle: "link" }} set={vi.fn()} blockType="Button" />);
    fireEvent.click(screen.getByRole("button", { name: "Button" }));

    expect(screen.queryByText("Button color")).toBeNull();
    expect(screen.queryByText("Button opacity")).toBeNull();
    expect(screen.queryByText("Corner radius")).toBeNull();
    expect(screen.getByText("Button text color")).toBeTruthy();
    expect(screen.getByText("Button style")).toBeTruthy();
  });

  it.each(["outline", "soft"] as const)("%s style hides solid-only opacity", (buttonStyle) => {
    render(<DesignTab s={{ buttonStyle }} set={vi.fn()} blockType="Button" />);
    fireEvent.click(screen.getByRole("button", { name: "Button" }));
    expect(screen.queryByText("Button opacity")).toBeNull();
  });

  it("does not float Outline when legacy buttonColorToken data uses the filled render branch", () => {
    render(<DesignTab s={{ buttonColorToken: "accent" }} set={vi.fn()} blockType="Button" />);
    fireEvent.click(screen.getByRole("button", { name: "Button" }));
    expect(screen.getByRole("button", { name: "Outline" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
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

  it("GalleryGrid shows the theme background as its effective banner color", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryGrid" />);
    const colorLabel = screen.getByText("Color");
    const colorSection = colorLabel.closest("div")!;
    expect(within(colorSection).getByRole("button", { name: "Background" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("does not show a generic section Gap control that the gallery render ignores", () => {
    render(
      <LayoutTabBody
        s={{}}
        set={vi.fn()}
        isGridChild={false}
        showJustify={false}
        blockType="GalleryGrid"
        p={{}}
        setProp={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Layout", expanded: false }));
    expect(screen.queryByText("Gap")).toBeNull();
  });
});

describe("Sub-part 2 — gallery blocks hide bg-image picker, keep banner Color", () => {
  it("GalleryGrid Content tab does NOT render ContainerBackgroundControls (no bg-image picker)", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryGrid" />);
    // Content tab is default; "Background images" label from ContainerBackgroundControls must be absent
    expect(screen.queryByText("Background images")).toBeNull();
    // Photo Grid dropped background images entirely — the compact "Choose photo"
    // single-image picker (BannerSection's fallback branch) must be absent too.
    expect(screen.queryByRole("button", { name: /choose photo/i })).toBeNull();
  });

  it("GalleryMasonry Content tab does NOT render the background-image picker", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryMasonry" />);
    expect(screen.queryByText("Background images")).toBeNull();
    expect(screen.queryByRole("button", { name: /choose photo/i })).toBeNull();
  });

  it("Container Content tab still renders the background-image picker", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="Container" />);
    expect(screen.getByRole("button", { name: /choose photo/i })).toBeInTheDocument();
  });

  it("FeaturedWork Content tab still renders the background-image picker", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="FeaturedWork" />);
    expect(screen.getByRole("button", { name: /choose photo/i })).toBeInTheDocument();
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
    // The font field should show "Playfair Display" as its value (effective heading font).
    // Typography drawer is auto-open (first drawer).
    const fontInput = screen.getByPlaceholderText("Type or choose a font…") as HTMLInputElement;
    expect(fontInput.value).toBe("Playfair Display");
  });

  it("explicit fontFamily on the block wins over the effective brand font", () => {
    render(
      <BrandColorsContext.Provider value={{ ...DEFAULT_COLORS, headingFont: "playfair", bodyFont: "inter" }}>
        <DesignTab s={{ fontFamily: "cormorant" }} set={vi.fn()} blockType="Heading" />
      </BrandColorsContext.Provider>
    );
    const fontInput = screen.getByPlaceholderText("Type or choose a font…") as HTMLInputElement;
    expect(fontInput.value).toBe("Cormorant Garamond");
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

  it("uses the selected Button size's real rendered font size", () => {
    render(<DesignTab s={{}} set={vi.fn()} blockType="Button" p={{ size: "sm" }} />);
    const fontSizeLabel = screen.getByText("Font size");
    const row = fontSizeLabel.closest("div")!;
    expect(within(row).getByRole("spinbutton")).toHaveAttribute("placeholder", "13");
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

  it("choosing a border side makes a 1px border visible when width is unset", () => {
    const set = vi.fn();
    render(<DesignTab s={{}} set={set} blockType="Container" />);
    fireEvent.click(screen.getByRole("button", { name: "Frame" }));
    fireEvent.click(screen.getByRole("button", { name: "Left border" }));
    expect(set).toHaveBeenCalledWith({ borderSides: ["left"], borderPreset: undefined, borderWidth: 1 });
  });

  it("adds another side without replacing the current selection", () => {
    const set = vi.fn();
    render(<DesignTab s={{ borderWidth: 4, borderSides: ["left"] }} set={set} blockType="Container" />);
    fireEvent.click(screen.getByRole("button", { name: "Frame" }));
    fireEvent.click(screen.getByRole("button", { name: "Bottom border" }));
    expect(set).toHaveBeenCalledWith({ borderSides: ["left", "bottom"], borderPreset: undefined });
  });

  it("replaces a full border with the first explicitly selected side", () => {
    const set = vi.fn();
    render(<DesignTab s={{ borderWidth: 4 }} set={set} blockType="Container" />);
    fireEvent.click(screen.getByRole("button", { name: "Frame" }));
    fireEvent.click(screen.getByRole("button", { name: "Bottom border" }));
    expect(set).toHaveBeenCalledWith({ borderSides: ["bottom"], borderPreset: undefined });
  });

  it("full border overwrites an existing partial selection", () => {
    const set = vi.fn();
    render(<DesignTab s={{ borderWidth: 4, borderSides: ["left", "bottom"] }} set={set} blockType="Container" />);
    fireEvent.click(screen.getByRole("button", { name: "Frame" }));
    fireEvent.click(screen.getByRole("button", { name: "Full border" }));
    expect(set).toHaveBeenCalledWith({ borderSides: ["top", "right", "bottom", "left"], borderPreset: undefined });
  });
});

describe("LayoutTabBody — content controls preserve legacy effective values", () => {
  it("Content start is active when the container has no explicit or legacy alignment", () => {
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
    expect(screen.getByRole("button", { name: "Content start" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Content center" })).toHaveAttribute("aria-pressed", "false");
  });

  it("reflects legacy container alignment props until the style controls are edited", () => {
    render(
      <LayoutTabBody
        s={{}}
        set={() => {}}
        isGridChild={false}
        showJustify={true}
        blockType="HeroPreset"
        p={{ alignX: "center", alignY: "bottom" }}
        setProp={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Layout", expanded: false }));
    expect(screen.getByRole("button", { name: "Content center" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Content bottom" })).toHaveAttribute("aria-pressed", "true");
  });

  it("writes only dedicated content fields when an option is selected", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Content middle" }));
    expect(set).toHaveBeenCalledWith({ contentVerticalDistribution: "center" });
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

describe("LayoutTabBody — cell placement controls", () => {
  it("writes only dedicated cell fields when a Columns child is placed", () => {
    const set = vi.fn();
    render(
      <LayoutTabBody
        s={{}}
        set={set}
        isGridChild
        showJustify={true}
        blockType="Image"
        p={{}}
        setProp={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Cell middle" }));
    expect(set).toHaveBeenCalledWith({ cellVerticalAlign: "center" });
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

  it("Button buttonStyle='solid' → foreground swatch is aria-pressed as effective text color", () => {
    render(
      <BrandColorsContext.Provider value={{ ...DEFAULT_COLORS, brandRadius: "subtle" }}>
        <DesignTab s={{ buttonStyle: "solid" }} set={vi.fn()} blockType="Button" />
      </BrandColorsContext.Provider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Button" }));
    const btnTextLabel = screen.getByText("Button text color");
    const btnTextSection = btnTextLabel.closest("div")!.parentElement!;
    const foregroundSwatches = within(btnTextSection as HTMLElement).getAllByRole("button", { name: "Text" });
    expect(foregroundSwatches[0]).toHaveAttribute("aria-pressed", "true");
  });

  it("Button soft with buttonColorToken='accent' → foreground swatch is aria-pressed as effective text color", () => {
    render(
      <BrandColorsContext.Provider value={{ ...DEFAULT_COLORS, brandRadius: "subtle" }}>
        <DesignTab s={{ buttonStyle: "soft", buttonColorToken: "accent" }} set={vi.fn()} blockType="Button" />
      </BrandColorsContext.Provider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Button" }));
    const btnTextLabel = screen.getByText("Button text color");
    const btnTextSection = btnTextLabel.closest("div")!.parentElement!;
    const foregroundSwatches = within(btnTextSection as HTMLElement).getAllByRole("button", { name: "Text" });
    expect(foregroundSwatches[0]).toHaveAttribute("aria-pressed", "true");
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

  it("shows the same effective 24px padding for Container-based presets", () => {
    render(
      <LayoutTabBody
        s={{}}
        set={() => {}}
        isGridChild={false}
        showJustify={true}
        blockType="HeroPreset"
        p={{}}
        setProp={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Padding advanced options" }));
    const spinbuttons = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    expect(spinbuttons[0].placeholder).toBe("24");
  });

  it("shows the gallery blocks' own effective 64px top padding, not a blank control", () => {
    render(
      <LayoutTabBody
        s={{}}
        set={() => {}}
        isGridChild={false}
        showJustify={true}
        blockType="GalleryGrid"
        p={{}}
        setProp={() => {}}
      />,
    );
    // "Gallery" is the first drawer here, so Spacing starts collapsed and its
    // children are unmounted — open it before reaching the padding inputs.
    fireEvent.click(screen.getByRole("button", { name: "Spacing", expanded: false }));
    fireEvent.click(screen.getByRole("button", { name: "Padding advanced options" }));
    const spinbuttons = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    expect(spinbuttons[0].placeholder).toBe("64");
  });
});

describe("Font select — Google Fonts", () => {
  it("selecting a Google Fonts shortlist entry calls the setter with a google: selection", () => {
    const set = vi.fn();
    render(<DesignTab s={{}} set={set} blockType="Heading" />);
    const fontInput = screen.getByPlaceholderText("Type or choose a font…");
    fireEvent.change(fontInput, { target: { value: "Poppins" } });
    fireEvent.blur(fontInput);
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
    // Typography drawer is auto-open; font field shows effective heading font (Playfair Display)
    const fontInput = screen.getByPlaceholderText("Type or choose a font…");
    fireEvent.change(fontInput, { target: { value: "Cormorant Garamond" } });
    fireEvent.blur(fontInput);
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
    const fontInput = screen.getByPlaceholderText("Type or choose a font…") as HTMLInputElement;
    expect(fontInput.value).toBe("Cormorant Garamond");
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

describe("DesignTab — ContactDetails Icon align (Icons section)", () => {
  // The Icons drawer is the 2nd section under ContactDetails' Design tab, so
  // (per EditorDrawerGroup) it starts collapsed — only the 1st (Typography)
  // auto-opens. Open it before asserting its contents.
  function openIconsDrawer() {
    fireEvent.click(screen.getByRole("button", { name: "Icons" }));
  }

  it("both unset: floats center as the effective (following-theme) value", () => {
    render(<DesignTab s={{}} set={vi.fn()} blockType="ContactDetails" />);
    openIconsDrawer();
    expect(screen.getByRole("button", { name: "Align icons left" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Align icons center" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Align icons right" })).toHaveAttribute("aria-pressed", "false");
  });

  it("contactIconAlign unset, valueAlign='left': floats left as effective (legacy fallback)", () => {
    render(<DesignTab s={{ valueAlign: "left" }} set={vi.fn()} blockType="ContactDetails" />);
    openIconsDrawer();
    expect(screen.getByRole("button", { name: "Align icons left" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Align icons center" })).toHaveAttribute("aria-pressed", "false");
  });

  it("explicit contactIconAlign wins over valueAlign and reads as pressed", () => {
    render(<DesignTab s={{ contactIconAlign: "right", valueAlign: "left" }} set={vi.fn()} blockType="ContactDetails" />);
    openIconsDrawer();
    expect(screen.getByRole("button", { name: "Align icons right" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Align icons left" })).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking Align icons right calls set with contactIconAlign:'right'", () => {
    const set = vi.fn();
    render(<DesignTab s={{}} set={set} blockType="ContactDetails" />);
    openIconsDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Align icons right" }));
    expect(set).toHaveBeenCalledWith({ contactIconAlign: "right" });
  });

  it("clicking the already-explicit option again clears it back to undefined", () => {
    const set = vi.fn();
    render(<DesignTab s={{ contactIconAlign: "right" }} set={set} blockType="ContactDetails" />);
    openIconsDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Align icons right" }));
    expect(set).toHaveBeenCalledWith({ contactIconAlign: undefined });
  });
});

describe("StyleToolkitField — GalleryMasonry flow", () => {
  it("does not offer the obsolete Masonry stagger toggle", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryMasonry" />);
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    expect(screen.queryByText("Masonry stagger")).toBeNull();
  });

  it("does not show the obsolete control for GalleryGrid", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryGrid" />);
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    expect(screen.queryByText("Masonry stagger")).toBeNull();
  });

  it("enables the configurable alternating tile-height rhythm", () => {
    const onChange = vi.fn();
    render(<StyleToolkitField value={undefined} onChange={onChange} blockType="GalleryMasonry" />);
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    fireEvent.click(screen.getByRole("button", { name: "Alternate" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ masonryHeightPattern: "alternating" }));
  });

  it("uses column lanes without exposing the retired flow choice and offers odd/even column rhythms", () => {
    render(<StyleToolkitField value={{ masonryHeightPattern: "alternating" }} onChange={vi.fn()} blockType="GalleryMasonry" />);
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    expect(screen.queryByRole("button", { name: "Flow" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Column lanes" })).toBeNull();
    expect(screen.getByText("Odd columns")).toBeInTheDocument();
    expect(screen.getByText("Even columns")).toBeInTheDocument();
    expect(screen.getAllByText("Odd tile")).toHaveLength(2);
    expect(screen.getAllByText("Even tile")).toHaveLength(2);
  });

  it("explains that the loop needs three images in every column", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryMasonry" />);
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    expect(screen.getByText(/add at least 3 images to each active column/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "On" })).toBeDisabled();
  });
});
