import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { CollectionsPopupPanelDialog } from "./CollectionsPopupPanelDialog";
import type {
  PortfolioCollectionsPopupConfig,
  PortfolioBrandKit,
} from "@/lib/page-builder/types";

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
    render(
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
    render(
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
    render(
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
    render(
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
    render(
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
      render(
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
    render(
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
    render(
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

describe("CollectionsPopupPanelDialog header styles", () => {
  function setup(config: Partial<PortfolioCollectionsPopupConfig> = {}) {
    const onChange = vi.fn();
    render(
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
