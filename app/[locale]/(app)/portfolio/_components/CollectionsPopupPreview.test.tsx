import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import React from "react";
import { CollectionsPopupPreview } from "./CollectionsPopupPreview";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";

describe("CollectionsPopupPreview", () => {
  it("renders the popup chrome with a sample title and close button", () => {
    renderWithProviders(<CollectionsPopupPreview config={{}} brandKit={DEFAULT_BRAND_KIT} />);
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  it("reflects a title override", () => {
    renderWithProviders(
      <CollectionsPopupPreview config={{ titleText: "My Galleries" }} brandKit={DEFAULT_BRAND_KIT} />,
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("My Galleries");
  });

  it("renders the immersive layout without the chrome (no title heading/close button)", () => {
    renderWithProviders(
      <CollectionsPopupPreview config={{ popupLayout: "immersive" }} brandKit={DEFAULT_BRAND_KIT} />,
    );
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /close/i })).not.toBeInTheDocument();
  });

  it("still renders the chrome for the justified layout", () => {
    renderWithProviders(
      <CollectionsPopupPreview config={{ popupLayout: "justified" }} brandKit={DEFAULT_BRAND_KIT} />,
    );
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });
});

describe("CollectionsPopupPreview popup columns", () => {
  it("Contact Sheet: defaults to 3 columns and grids all 5 sample swatches", () => {
    const { container } = renderWithProviders(
      <CollectionsPopupPreview config={{ popupLayout: "contact-sheet" }} brandKit={DEFAULT_BRAND_KIT} />,
    );
    const grid = container.querySelector('[data-popup-preview-columns="3"]') as HTMLElement;
    expect(grid).not.toBeNull();
    expect(grid.style.gridTemplateColumns).toContain("repeat(3,");
    expect(grid.children).toHaveLength(5);
  });

  it("Contact Sheet: honors an explicit popupColumns value", () => {
    const { container } = renderWithProviders(
      <CollectionsPopupPreview
        config={{ popupLayout: "contact-sheet", popupColumns: 4 }}
        brandKit={DEFAULT_BRAND_KIT}
      />,
    );
    const grid = container.querySelector('[data-popup-preview-columns="4"]') as HTMLElement;
    expect(grid).not.toBeNull();
    expect(grid.style.gridTemplateColumns).toContain("repeat(4,");
  });

  it("Justified: groups the 5 samples into rows sized by popupColumns", () => {
    const { container } = renderWithProviders(
      <CollectionsPopupPreview
        config={{ popupLayout: "justified", popupColumns: 3 }}
        brandKit={DEFAULT_BRAND_KIT}
      />,
    );
    const rowsContainer = container.querySelector('[data-popup-preview-columns="3"]') as HTMLElement;
    expect(rowsContainer).not.toBeNull();
    const rowSizes = Array.from(rowsContainer.children).map((row) => row.children.length);
    expect(rowSizes).toEqual([3, 2]);
  });

  it("Split Index: applies popupColumns to the image-index grid only", () => {
    const { container } = renderWithProviders(
      <CollectionsPopupPreview
        config={{ popupLayout: "split-index", popupColumns: 2 }}
        brandKit={DEFAULT_BRAND_KIT}
      />,
    );
    const grid = container.querySelector('[data-popup-preview-columns="2"]') as HTMLElement;
    expect(grid).not.toBeNull();
    expect(grid.style.gridTemplateColumns).toContain("repeat(2,");
    expect(grid.children).toHaveLength(5);
  });
});
