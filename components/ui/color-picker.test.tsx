import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorPicker } from "./color-picker";

// react-colorful relies on pointer/DOM geometry that happy-dom doesn't model,
// so stub it with controllable elements that let us assert the onChange wiring
// and the component's hex normalization.
vi.mock("react-colorful", () => ({
  HexColorPicker: ({ onChange }: { onChange: (c: string) => void }) => (
    <button data-testid="spectrum" onClick={() => onChange("#ABC")}>
      spectrum
    </button>
  ),
  HexColorInput: ({
    color,
    onChange,
    ...rest
  }: {
    color: string;
    onChange: (c: string) => void;
  } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      data-testid="hexinput"
      value={color}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    />
  ),
}));

const PRESETS = ["#0d7377", "#7c5cff"] as const;

describe("ColorPicker", () => {
  it("renders preset swatches and marks the current value as pressed", () => {
    render(<ColorPicker value="#0d7377" onChange={() => {}} presets={PRESETS} />);
    const selected = screen.getByRole("button", { name: "#0d7377" });
    expect(selected).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "#7c5cff" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("emits the chosen preset hex", () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#0d7377" onChange={onChange} presets={PRESETS} />);
    fireEvent.click(screen.getByRole("button", { name: "#7c5cff" }));
    expect(onChange).toHaveBeenCalledWith("#7c5cff");
  });

  it("normalizes a 3-digit spectrum value to 6 digits lowercase", () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#0d7377" onChange={onChange} presets={PRESETS} />);
    fireEvent.click(screen.getByTestId("spectrum"));
    expect(onChange).toHaveBeenCalledWith("#aabbcc");
  });

  it("normalizes typed hex casing", () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#0d7377" onChange={onChange} presets={PRESETS} />);
    fireEvent.change(screen.getByTestId("hexinput"), { target: { value: "#FFFFFF" } });
    expect(onChange).toHaveBeenCalledWith("#ffffff");
  });

  it("disables interaction when disabled", () => {
    render(
      <ColorPicker value="#0d7377" onChange={() => {}} presets={PRESETS} disabled />,
    );
    expect(screen.getByRole("button", { name: "#0d7377" })).toBeDisabled();
    expect(screen.getByTestId("hexinput")).toBeDisabled();
  });
});
