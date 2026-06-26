import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorSwatchRow, DimensionInput, FloatingLabelInput } from "./toolbarPrimitives";

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

describe("FloatingLabelInput", () => {
  it("renders an input associated to its label via htmlFor/id", () => {
    render(<FloatingLabelInput label="Email" value="" onChange={vi.fn()} />);
    const input = screen.getByRole("textbox");
    expect(input).toBeInTheDocument();
    const label = screen.getByText("Email");
    expect(label.tagName).toBe("LABEL");
    expect(label).toHaveAttribute("for", input.id);
  });

  it("uses the provided placeholder string when supplied", () => {
    render(<FloatingLabelInput label="Handle" value="" onChange={vi.fn()} placeholder="yourhandle" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("placeholder", "yourhandle");
  });

  it("applies transparent-at-rest classes when a custom placeholder is given", () => {
    render(<FloatingLabelInput label="Handle" value="" onChange={vi.fn()} placeholder="yourhandle" />);
    const input = screen.getByRole("textbox");
    expect(input.className).toContain("placeholder:text-transparent");
    expect(input.className).toContain("focus:placeholder:text-muted-foreground");
  });
});

describe("DimensionInput — rem→px display conversion", () => {
  it("effectiveValue '1.5rem' → placeholder shows '24' under px unit", () => {
    render(
      <DimensionInput label="Padding" value={undefined} onChange={vi.fn()} effectiveValue="1.5rem" />
    );
    expect(screen.getByRole("spinbutton")).toHaveAttribute("placeholder", "24");
  });

  it("effectiveValue '1rem' → placeholder shows '16'", () => {
    render(
      <DimensionInput label="Padding" value={undefined} onChange={vi.fn()} effectiveValue="1rem" />
    );
    expect(screen.getByRole("spinbutton")).toHaveAttribute("placeholder", "16");
  });

  it("effectiveValue '0.875rem' → placeholder shows '14'", () => {
    render(
      <DimensionInput label="Padding" value={undefined} onChange={vi.fn()} effectiveValue="0.875rem" />
    );
    expect(screen.getByRole("spinbutton")).toHaveAttribute("placeholder", "14");
  });

  it("explicit value '1.5rem' → input displays 24 under px unit", () => {
    render(
      <DimensionInput label="Padding" value="1.5rem" onChange={vi.fn()} />
    );
    expect(screen.getByRole("spinbutton")).toHaveValue(24);
  });

  it("px effectiveValue '20px' → placeholder passes through as '20'", () => {
    render(
      <DimensionInput label="Padding" value={undefined} onChange={vi.fn()} effectiveValue="20px" />
    );
    expect(screen.getByRole("spinbutton")).toHaveAttribute("placeholder", "20");
  });

  it("% effectiveValue '50%' → placeholder passes through as '50'", () => {
    render(
      <DimensionInput label="Padding" value={undefined} onChange={vi.fn()} effectiveValue="50%" />
    );
    expect(screen.getByRole("spinbutton")).toHaveAttribute("placeholder", "50");
  });

  it("typing a number when effectiveValue is rem writes px value to onChange", () => {
    const onChange = vi.fn();
    render(
      <DimensionInput label="Padding" value={undefined} onChange={onChange} effectiveValue="1.5rem" />
    );
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "30" } });
    expect(onChange).toHaveBeenCalledWith("30px");
  });
});
