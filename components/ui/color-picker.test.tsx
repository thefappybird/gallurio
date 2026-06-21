import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
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
    vi.useFakeTimers();
    try {
      const onChange = vi.fn();
      render(<ColorPicker value="#0d7377" onChange={onChange} presets={PRESETS} />);
      fireEvent.click(screen.getByTestId("spectrum"));
      // Spectrum uses debounce; advance past the 120ms window to flush.
      act(() => { vi.advanceTimersByTime(120); });
      expect(onChange).toHaveBeenCalledWith("#aabbcc");
    } finally {
      vi.useRealTimers();
    }
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

  it("flushes pending debounced value on unmount so no change is lost on popover close", () => {
    vi.useFakeTimers();
    try {
      const onChange = vi.fn();
      const { unmount } = render(<ColorPicker value="#0d7377" onChange={onChange} presets={PRESETS} />);

      act(() => { fireEvent.click(screen.getByTestId("spectrum")); });
      expect(onChange).not.toHaveBeenCalled();

      // Unmount before timer fires — simulates popover close mid-drag
      act(() => { unmount(); });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("#aabbcc");

      // Timer should not fire a second time after unmount
      act(() => { vi.advanceTimersByTime(200); });
      expect(onChange).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("debounces spectrum drags: multiple rapid onChange calls commit once after 120ms", () => {
    vi.useFakeTimers();
    try {
      const onChange = vi.fn();
      render(<ColorPicker value="#0d7377" onChange={onChange} presets={PRESETS} />);
      const spectrum = screen.getByTestId("spectrum");

      // Simulate 3 rapid drag ticks
      act(() => {
        fireEvent.click(spectrum); // emits #ABC (normalized to #aabbcc)
        fireEvent.click(spectrum);
        fireEvent.click(spectrum);
      });

      // Not committed yet — still within the debounce window
      expect(onChange).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(120);
      });

      // Only one commit with the last value
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("#aabbcc");
    } finally {
      vi.useRealTimers();
    }
  });
});
