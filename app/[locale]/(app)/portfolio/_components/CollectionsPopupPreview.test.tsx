import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { CollectionsPopupPreview } from "./CollectionsPopupPreview";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";

describe("CollectionsPopupPreview", () => {
  it("renders the popup chrome with a sample title and close button", () => {
    render(<CollectionsPopupPreview config={{}} brandKit={DEFAULT_BRAND_KIT} />);
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  it("reflects a title override", () => {
    render(
      <CollectionsPopupPreview config={{ titleText: "My Galleries" }} brandKit={DEFAULT_BRAND_KIT} />,
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("My Galleries");
  });
});
