import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  it("renders background color, border, and radius controls", () => {
    const onChange = vi.fn();
    render(
      <CollectionsPopupPanelDialog
        config={baseConfig}
        onChange={onChange}
        brandKit={stubBrandKit}
      />,
    );

    // Background label
    expect(screen.getByText(/background/i)).toBeInTheDocument();

    // Border width control — NumberInputRow uses a span label (no htmlFor), so
    // the spinbutton has no accessible name; find by its presence alongside the label text.
    expect(screen.getByText(/border/i)).toBeInTheDocument();
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

    // NumberInputRow renders a spinbutton without htmlFor linkage
    const borderInput = screen.getAllByRole("spinbutton")[0];
    fireEvent.change(borderInput, { target: { value: "3" } });
    expect(onChange).toHaveBeenCalledWith({ ...baseConfig, borderWidth: 3 });
  });

  it("renders a live preview element that reflects the borderWidth config", () => {
    const config: PortfolioCollectionsPopupConfig = {
      ...baseConfig,
      borderWidth: 4,
      borderColor: "primary",
    };
    render(
      <CollectionsPopupPanelDialog
        config={config}
        onChange={vi.fn()}
        brandKit={stubBrandKit}
      />,
    );

    const preview = screen.getByTestId("collections-popup-preview");
    expect(preview).toBeInTheDocument();
    // Preview border reflects the configured width
    expect(preview.style.borderWidth).toBe("4px");
  });

  it("preview border-radius is non-empty when radius is 'rounded'", () => {
    const config: PortfolioCollectionsPopupConfig = {
      ...baseConfig,
      radius: "rounded",
    };
    render(
      <CollectionsPopupPanelDialog
        config={config}
        onChange={vi.fn()}
        brandKit={stubBrandKit}
      />,
    );

    const preview = screen.getByTestId("collections-popup-preview");
    // Should have some non-zero border-radius
    expect(preview.style.borderRadius).toBeTruthy();
    expect(preview.style.borderRadius).not.toBe("0px");
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
