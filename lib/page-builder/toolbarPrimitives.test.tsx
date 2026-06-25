import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorSwatchRow } from "./toolbarPrimitives";

// Mock brandColors so tests don't need the full provider
vi.mock("./brandColors", () => ({
  useBrandColors: () => ({
    primary: "#007bff",
    secondary: "#6c757d",
    accent: "#fd7e14",
    background: "#ffffff",
    foreground: "#111111",
  }),
}));

describe("ColorSwatchRow — extraSwatches", () => {
  it("renders an extra swatch after the token swatches", () => {
    render(
      <ColorSwatchRow
        value={undefined}
        onChange={vi.fn()}
        extraSwatches={[{ value: "#e7000b", label: "Error" }]}
      />
    );
    expect(screen.getByTitle("Error")).toBeInTheDocument();
  });

  it("shows extra swatch as effective (aria-pressed, opacity-70) when value unset and effectiveValue matches", () => {
    render(
      <ColorSwatchRow
        value={undefined}
        onChange={vi.fn()}
        effectiveValue="#e7000b"
        extraSwatches={[{ value: "#e7000b", label: "Error" }]}
      />
    );
    const swatch = screen.getByTitle("Error");
    expect(swatch).toHaveAttribute("aria-pressed", "true");
    expect(swatch).toHaveClass("opacity-70");
  });

  it("shows extra swatch as explicitly selected (ring-2) when value equals it", () => {
    render(
      <ColorSwatchRow
        value="#e7000b"
        onChange={vi.fn()}
        extraSwatches={[{ value: "#e7000b", label: "Error" }]}
      />
    );
    const swatch = screen.getByTitle("Error");
    expect(swatch).toHaveAttribute("aria-pressed", "true");
    expect(swatch).toHaveClass("ring-2");
    // custom-hex picker should NOT also show ring-2 (extraSwatches value excluded)
    const customPicker = screen.getByLabelText("Custom color");
    expect(customPicker).not.toHaveClass("ring-2");
  });
});
