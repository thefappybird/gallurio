import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import React from "react";
import { CollectionsPopupPanelDialog } from "./CollectionsPopupPanelDialog";
import { __resetLayoutPreview } from "@/lib/page-builder/layoutPreviewStore";
import type {
  PortfolioCollectionsPopupConfig,
  PortfolioBrandKit,
} from "@/lib/page-builder/types";

// The dialog also mounts the single shared LayoutPreviewCard, which fetches
// the workspace's gallery photos on mount regardless of whether a preview is
// open. Stub fetch so every test here stays deterministic/offline, and reset
// the (module-level) preview store so an opened tile from one test can't
// leak into the next.
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  __resetLayoutPreview();
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
});

const stubBrandKit: PortfolioBrandKit = {
  themePreset: "minimal",
  fontPair: "merriweather-only",
  headingFont: "merriweather",
  bodyFont: "merriweather",
  primaryColor: "#111111",
  secondaryColor: "#f5f5f5",
  accentColor: "#2f5d56",
  backgroundColor: "#ffffff",
  foregroundColor: "#111111",
  radius: "sharp",
  buttonStyle: "solid",
};

const baseConfig: PortfolioCollectionsPopupConfig = {
  backgroundColor: undefined,
  borderColor: undefined,
  borderWidth: undefined,
  radius: undefined,
};

describe("CollectionsPopupPanelDialog", () => {
  it("renders background color, border, and radius controls inside the Popup section", () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CollectionsPopupPanelDialog
        config={baseConfig}
        onChange={onChange}
        brandKit={stubBrandKit}
      />,
    );

    // Expand the Popup EditorDrawerSection
    fireEvent.click(screen.getByRole("button", { name: /popup/i }));

    // Background label
    expect(screen.getByText(/background/i)).toBeInTheDocument();

    // Border width control — NumberInputRow uses a span label (no htmlFor), so
    // the spinbutton has no accessible name; find by its presence alongside the label text.
    expect(screen.getByText(/^border$/i)).toBeInTheDocument();
    expect(screen.getAllByRole("spinbutton").length).toBeGreaterThanOrEqual(1);

    // Radius buttons (sharp / subtle / rounded)
    expect(screen.getByRole("button", { name: /sharp/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /subtle/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rounded/i })).toBeInTheDocument();
  });

  it("calls onChange with updated radius when a radius button is clicked", () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CollectionsPopupPanelDialog
        config={baseConfig}
        onChange={onChange}
        brandKit={stubBrandKit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^popup$/i }));
    fireEvent.click(screen.getByRole("button", { name: /subtle/i }));
    expect(onChange).toHaveBeenCalledWith({ ...baseConfig, radius: "subtle" });
  });

  it("clears radius to '' when the active radius is clicked again", () => {
    const onChange = vi.fn();
    const configWithRadius: PortfolioCollectionsPopupConfig = {
      ...baseConfig,
      radius: "subtle",
    };
    renderWithProviders(
      <CollectionsPopupPanelDialog
        config={configWithRadius}
        onChange={onChange}
        brandKit={stubBrandKit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^popup$/i }));
    fireEvent.click(screen.getByRole("button", { name: /subtle/i }));
    expect(onChange).toHaveBeenCalledWith({ ...configWithRadius, radius: "" });
  });

  it("calls onChange with updated borderWidth when the border input changes", () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CollectionsPopupPanelDialog
        config={baseConfig}
        onChange={onChange}
        brandKit={stubBrandKit}
      />,
    );

    // Expand Popup section to reveal border controls
    fireEvent.click(screen.getByRole("button", { name: /^popup$/i }));
    // NumberInputRow renders a spinbutton without htmlFor linkage
    const borderInput = screen.getAllByRole("spinbutton")[0];
    fireEvent.change(borderInput, { target: { value: "3" } });
    expect(onChange).toHaveBeenCalledWith({ ...baseConfig, borderWidth: 3 });
  });

  // The tiny inline preview has been removed; live preview lives in the left pane.
  it("does not render the inline preview swatch", () => {
    renderWithProviders(
      <CollectionsPopupPanelDialog
        config={baseConfig}
        onChange={vi.fn()}
        brandKit={stubBrandKit}
      />,
    );
    expect(screen.queryByTestId("collections-popup-preview")).not.toBeInTheDocument();
  });

  it("accepts onSaved and onCancel callbacks without error", () => {
    const onSaved = vi.fn();
    const onCancel = vi.fn();
    expect(() =>
      renderWithProviders(
        <CollectionsPopupPanelDialog
          config={baseConfig}
          onChange={vi.fn()}
          brandKit={stubBrandKit}
          onSaved={onSaved}
          onCancel={onCancel}
        />,
      ),
    ).not.toThrow();
  });
});

describe("CollectionsPopupPanelDialog shared EditorDrawerSection structure", () => {
  it("renders Popup, Title styles, and Button styles as EditorDrawerSection headings (shared panel structure)", () => {
    renderWithProviders(
      <CollectionsPopupPanelDialog
        config={baseConfig}
        onChange={vi.fn()}
        brandKit={stubBrandKit}
      />,
    );
    // The shared EditorDrawerSection renders each section heading as a button
    expect(screen.getByRole("button", { name: /popup/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /title styles/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /button styles/i })).toBeInTheDocument();
  });

  it("shows title color Text swatch as effective (aria-pressed, following-theme) when titleColorToken is unset", () => {
    renderWithProviders(
      <CollectionsPopupPanelDialog
        config={baseConfig}
        onChange={vi.fn()}
        brandKit={stubBrandKit}
      />,
    );
    // Expand Title styles section to reveal its controls
    fireEvent.click(screen.getByRole("button", { name: /title styles/i }));
    // effectiveValue="foreground" → COLOR_LABEL["foreground"] = "Text"
    // When value is unset, the Text swatch should be aria-pressed=true (following theme)
    const textSwatch = screen.getByRole("button", { name: "Text" });
    expect(textSwatch).toHaveAttribute("aria-pressed", "true");
  });
});

describe("CollectionsPopupPanelDialog effective-default: field (a) popup background color", () => {
  it("shows Background swatch as effective (aria-pressed=true) when backgroundColor is unset", () => {
    renderWithProviders(
      <CollectionsPopupPanelDialog
        config={baseConfig}
        onChange={vi.fn()}
        brandKit={stubBrandKit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^popup$/i }));
    const bgSwatch = screen.getByRole("button", { name: "Background" });
    expect(bgSwatch).toHaveAttribute("aria-pressed", "true");
  });
});

describe("CollectionsPopupPanelDialog effective-default: field (a) explicit wins", () => {
  it("Background swatch NOT effective when backgroundColor explicitly set to accent", () => {
    renderWithProviders(
      <CollectionsPopupPanelDialog
        config={{ ...baseConfig, backgroundColor: "accent" }}
        onChange={vi.fn()}
        brandKit={stubBrandKit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^popup$/i }));
    expect(screen.getByRole("button", { name: "Background" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Accent" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("CollectionsPopupPanelDialog effective-default: field (b) title font size", () => {
  it("titleFontSize spinner shows placeholder 18 when size is unset (effective default)", () => {
    renderWithProviders(
      <CollectionsPopupPanelDialog
        config={baseConfig}
        onChange={vi.fn()}
        brandKit={stubBrandKit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /title styles/i }));
    const spinners = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    const fontSizeInput = spinners.find((el) => el.placeholder === "18");
    expect(fontSizeInput).toBeDefined();
  });
});

describe("CollectionsPopupPanelDialog popup and close-button rendered defaults", () => {
  it("floats the rendered 1px popup border", () => {
    renderWithProviders(
      <CollectionsPopupPanelDialog
        config={baseConfig}
        onChange={vi.fn()}
        brandKit={stubBrandKit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^popup$/i }));
    expect(screen.getByRole("spinbutton")).toHaveAttribute("placeholder", "1");
  });

  it("floats the rendered theme background and 1px border for the close button", () => {
    renderWithProviders(
      <CollectionsPopupPanelDialog
        config={baseConfig}
        onChange={vi.fn()}
        brandKit={stubBrandKit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /button styles/i }));
    const spinners = screen.getAllByRole("spinbutton");
    expect(spinners.some((input) => input.getAttribute("placeholder") === "1")).toBe(true);
    expect(screen.getByRole("button", { name: "Background" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("CollectionsPopupPanelDialog effective-default: field (b) explicit wins", () => {
  it("titleFontSize spinner shows explicit value (24) when size is set", () => {
    renderWithProviders(
      <CollectionsPopupPanelDialog
        config={{ ...baseConfig, titleFontSize: 24 }}
        onChange={vi.fn()}
        brandKit={stubBrandKit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /title styles/i }));
    const spinners = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    const fontSizeInput = spinners.find((el) => el.value === "24");
    expect(fontSizeInput).toBeDefined();
  });
});

describe("CollectionsPopupPanelDialog effective-default: field (c) close button radius", () => {
  it("shows Rounded as effective (aria-pressed=true) in Button styles when closeButtonRadius is unset", () => {
    renderWithProviders(
      <CollectionsPopupPanelDialog
        config={baseConfig}
        onChange={vi.fn()}
        brandKit={stubBrandKit}
      />,
    );
    // Expand only Button styles so only its RadiusRow is visible (no Popup section ambiguity)
    fireEvent.click(screen.getByRole("button", { name: /button styles/i }));
    const roundedBtn = screen.getByRole("button", { name: /^rounded$/i });
    expect(roundedBtn).toHaveAttribute("aria-pressed", "true");
  });
});

describe("CollectionsPopupPanelDialog effective-default: field (c) explicit wins", () => {
  it("Rounded NOT effective when closeButtonRadius explicitly set to sharp", () => {
    renderWithProviders(
      <CollectionsPopupPanelDialog
        config={{ ...baseConfig, closeButtonRadius: "sharp" }}
        onChange={vi.fn()}
        brandKit={stubBrandKit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /button styles/i }));
    expect(screen.getByRole("button", { name: /^rounded$/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /^sharp$/i })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("CollectionsPopupPanelDialog header styles", () => {
  function setup(config: Partial<PortfolioCollectionsPopupConfig> = {}) {
    const onChange = vi.fn();
    renderWithProviders(
      <CollectionsPopupPanelDialog
        config={config as PortfolioCollectionsPopupConfig}
        onChange={onChange}
        brandKit={stubBrandKit}
      />,
    );
    return { onChange };
  }

  it("exposes Title styles and Button styles as top-level EditorDrawerSection headings", () => {
    setup();
    // After restructure, these are direct EditorDrawerSection headings — no parent "Header styles" click needed
    expect(screen.getByRole("button", { name: /title styles/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /button styles/i })).toBeInTheDocument();
  });

  it("writes a title text override", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: /title styles/i }));
    const input = screen.getByLabelText(/header text/i);
    fireEvent.change(input, { target: { value: "Galleries" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ titleText: "Galleries" }));
  });

  it("writes a close button size", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /button styles/i }));
    expect(screen.getByText(/button size/i)).toBeInTheDocument();
  });
});

describe("CollectionsPopupPanelDialog layout pickers", () => {
  it("renders a Layout section with a popup-layout and an image-modal-layout radiogroup", () => {
    renderWithProviders(
      <CollectionsPopupPanelDialog
        config={baseConfig}
        onChange={vi.fn()}
        brandKit={stubBrandKit}
      />,
    );
    expect(screen.getByText(/^layout$/i)).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: /featured work layout/i })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: /image preview layout/i })).toBeInTheDocument();
  });

  it("defaults to contact-sheet / caption as checked when the config fields are unset", () => {
    renderWithProviders(
      <CollectionsPopupPanelDialog
        config={baseConfig}
        onChange={vi.fn()}
        brandKit={stubBrandKit}
      />,
    );
    expect(screen.getByRole("radio", { name: /^contact sheet$/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /^caption$/i })).toHaveAttribute("aria-checked", "true");
  });

  it("writes only popupLayout when a popup layout tile is clicked, leaving every other field untouched", () => {
    const onChange = vi.fn();
    const configWithExtras: PortfolioCollectionsPopupConfig = {
      ...baseConfig,
      titleText: "My Gallery",
      closeButtonSize: 48,
      imageModalLayout: "sidebar",
    };
    renderWithProviders(
      <CollectionsPopupPanelDialog
        config={configWithExtras}
        onChange={onChange}
        brandKit={stubBrandKit}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /^justified$/i }));
    expect(onChange).toHaveBeenCalledWith({ ...configWithExtras, popupLayout: "justified" });
  });

  it("writes only imageModalLayout when an image-modal tile is clicked", () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CollectionsPopupPanelDialog
        config={baseConfig}
        onChange={onChange}
        brandKit={stubBrandKit}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /^sidebar$/i }));
    expect(onChange).toHaveBeenCalledWith({ ...baseConfig, imageModalLayout: "sidebar" });
  });

  it("keeps the image-modal picker enabled with an inline scope note when popupLayout is immersive, and still writes on click", () => {
    const onChange = vi.fn();
    const configImmersive: PortfolioCollectionsPopupConfig = {
      ...baseConfig,
      popupLayout: "immersive",
      imageModalLayout: "sidebar",
    };
    renderWithProviders(
      <CollectionsPopupPanelDialog
        config={configImmersive}
        onChange={onChange}
        brandKit={stubBrandKit}
      />,
    );

    // Every image-modal tile stays enabled — immersive only replaces the
    // featured-popup's own modal, not grid/masonry/Image-block modals.
    const sidebarRadio = screen.getByRole("radio", { name: /^sidebar$/i });
    expect(sidebarRadio).not.toBeDisabled();
    expect(sidebarRadio).toHaveAttribute("aria-checked", "true");

    // Inline scope note is visible.
    expect(
      screen.getByText(/applies to image blocks, photo grids and masonry/i),
    ).toBeInTheDocument();

    // Clicking a tile still fires onChange normally.
    fireEvent.click(screen.getByRole("radio", { name: /^caption$/i }));
    expect(onChange).toHaveBeenCalledWith({ ...configImmersive, imageModalLayout: "caption" });
  });

  it("annotates Popup, Title styles, and Button styles as not used by the current layout when popupLayout is immersive", () => {
    renderWithProviders(
      <CollectionsPopupPanelDialog
        config={{ ...baseConfig, popupLayout: "immersive" }}
        onChange={vi.fn()}
        brandKit={stubBrandKit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^popup$/i }));
    fireEvent.click(screen.getByRole("button", { name: /title styles/i }));
    fireEvent.click(screen.getByRole("button", { name: /button styles/i }));
    expect(screen.getAllByText(/not used by this layout/i)).toHaveLength(3);
  });

  it("does not show the 'not used' annotation for contact-sheet (every section applies)", () => {
    renderWithProviders(
      <CollectionsPopupPanelDialog
        config={{ ...baseConfig, popupLayout: "contact-sheet" }}
        onChange={vi.fn()}
        brandKit={stubBrandKit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^popup$/i }));
    fireEvent.click(screen.getByRole("button", { name: /title styles/i }));
    fireEvent.click(screen.getByRole("button", { name: /button styles/i }));
    expect(screen.queryByText(/not used by this layout/i)).not.toBeInTheDocument();
  });
});
