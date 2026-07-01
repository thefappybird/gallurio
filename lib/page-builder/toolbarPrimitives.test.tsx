import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorSwatchRow, DimensionInput, FloatingLabelInput, IconRow, FontFamilyRow } from "./toolbarPrimitives";
import { AlignHorizontalJustifyStart, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, Maximize2 } from "lucide-react";

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

const STUB_OPTIONS = [
  { value: "start" as const, label: "Start", Icon: AlignHorizontalJustifyStart },
];

const ALIGN_OPTIONS = [
  { value: "start" as const,   label: "Left",           Icon: AlignHorizontalJustifyStart },
  { value: "center" as const,  label: "Center",         Icon: AlignHorizontalJustifyCenter },
  { value: "end" as const,     label: "Right",          Icon: AlignHorizontalJustifyEnd },
  { value: "stretch" as const, label: "Stretch to fill", Icon: Maximize2 },
];

describe("IconRow — onReset prop (A6)", () => {
  it("shows a Reset button when onReset is provided and value is set (A6)", () => {
    render(
      <IconRow
        label="Align"
        value="start"
        options={STUB_OPTIONS}
        onChange={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Reset Align" })).toBeTruthy();
  });

  it("renders all options in the DOM when given a 4-item ALIGN_OPTIONS list (overflow fix: no option clipped)", () => {
    render(
      <IconRow
        label="Align"
        value={undefined}
        options={ALIGN_OPTIONS}
        onChange={vi.fn()}
        onReset={vi.fn()}
      />
    );
    // All 4 icon buttons and the reset must be in the DOM — previously they could
    // overflow the narrow properties panel and be unreachable without flex-wrap.
    expect(screen.getByRole("button", { name: "Left" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Center" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Right" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stretch to fill" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset Align" })).toBeInTheDocument();
  });
});

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

describe("FontFamilyRow", () => {
  it("selecting a curated font key from the dropdown calls onChange with that key", () => {
    const onChange = vi.fn();
    render(<FontFamilyRow value={undefined} onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "cormorant" } });
    expect(onChange).toHaveBeenCalledWith("cormorant");
  });

  it("selecting a Google Fonts shortlist entry from the dropdown calls onChange with a google: selection", () => {
    const onChange = vi.fn();
    render(<FontFamilyRow value={undefined} onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "google:Poppins" } });
    expect(onChange).toHaveBeenCalledWith("google:Poppins");
  });

  it("typing a custom family name in the free-text field calls onChange with a google: selection", () => {
    const onChange = vi.fn();
    render(<FontFamilyRow value={undefined} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText("Or type any Google Fonts name…"), {
      target: { value: "Bebas Neue" },
    });
    expect(onChange).toHaveBeenCalledWith("google:Bebas Neue");
  });

  it("shows a custom google: value's family name in the free-text field", () => {
    render(<FontFamilyRow value="google:Bebas Neue" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText("Or type any Google Fonts name…")).toHaveValue("Bebas Neue");
  });

  it("shows the effective value as selected (opacity-60) when value is unset", () => {
    render(<FontFamilyRow value={undefined} effectiveValue="playfair" onChange={vi.fn()} />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("playfair");
    expect(select.className).toContain("opacity-60");
  });

  it("clicking the reset button calls onChange with undefined", () => {
    const onChange = vi.fn();
    render(<FontFamilyRow value="cormorant" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Reset Font" }));
    expect(onChange).toHaveBeenCalledWith(undefined);
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
