import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CountControl } from "./CountControl";

describe("CountControl — quick-pick buttons", () => {
  it("renders a button for each quickValues entry", () => {
    render(<CountControl value={1} onChange={vi.fn()} quickValues={[1, 2, 3]} />);
    expect(screen.getByRole("button", { name: "1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "3" })).toBeTruthy();
  });

  it("renders Auto button when allowAuto=true and active when value is undefined", () => {
    render(<CountControl value={undefined} onChange={vi.fn()} allowAuto />);
    const auto = screen.getByRole("button", { name: "Auto" });
    expect(auto).toBeTruthy();
    expect(auto.getAttribute("aria-pressed")).toBe("true");
  });

  it("clamped number input: typing a value above max calls onChange with max", () => {
    const onChange = vi.fn();
    render(<CountControl value={2} onChange={onChange} min={1} max={6} />);
    const input = screen.getByRole("spinbutton", { name: "Custom count" });
    fireEvent.change(input, { target: { value: "9" } });
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it("hides the number input when hideInput is true", () => {
    render(<CountControl value={1} onChange={vi.fn()} quickValues={[1, 2]} hideInput />);
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("still renders quick-value buttons when hideInput is true", () => {
    render(<CountControl value={1} onChange={vi.fn()} quickValues={[1, 2]} hideInput />);
    expect(screen.getByRole("button", { name: "1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "2" })).toBeTruthy();
  });

  it("calls onChange when a quick button is clicked with hideInput", () => {
    const onChange = vi.fn();
    render(<CountControl value={1} onChange={onChange} quickValues={[1, 2]} hideInput />);
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
