import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { RootStyleField } from "./RootStyleField";

describe("RootStyleField", () => {
  it("shows only Design and Layout tabs", () => {
    render(<RootStyleField value={{}} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Design" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Layout" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Content" })).not.toBeInTheDocument();
  });

  it("writes a background opacity on the Design tab", () => {
    const onChange = vi.fn();
    render(<RootStyleField value={{ bgColorToken: "primary" }} onChange={onChange} />);
    // NumberInputRow has no accessible label; assert the label text shows and
    // drive the spinbutton directly.
    expect(screen.getByText(/background opacity/i)).toBeInTheDocument();
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "40" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ bgOpacity: 40 }));
  });

  it("shows collapsed Horizontal/Vertical padding and margin controls on the Layout tab", () => {
    render(<RootStyleField value={{}} onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    // Collapsed state shows Horizontal (X) / Vertical (Y) for both sections
    expect(screen.getAllByText(/horizontal \(x\)/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/vertical \(y\)/i).length).toBeGreaterThanOrEqual(2);
  });

  it("clicking padding Advanced reveals Top/Right/Bottom/Left inputs", () => {
    render(<RootStyleField value={{}} onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    fireEvent.click(screen.getByRole("button", { name: "Padding advanced options" }));
    expect(screen.getAllByText(/^top$/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^right$/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^bottom$/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^left$/i).length).toBeGreaterThanOrEqual(1);
  });

  it("clicking margin Advanced reveals Top/Right/Bottom/Left inputs", () => {
    render(<RootStyleField value={{}} onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    fireEvent.click(screen.getByRole("button", { name: "Margin advanced options" }));
    // margin advanced reveals Top/Right/Bottom/Left — these may overlap with
    // padding collapsed labels, so just check they exist
    expect(screen.getAllByText(/^top$/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^bottom$/i).length).toBeGreaterThanOrEqual(1);
  });

  it("collapsed padding Horizontal writes paddingLeft + paddingRight, clears paddingX", () => {
    const onChange = vi.fn();
    render(<RootStyleField value={{ paddingX: "16px" }} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    // DimensionInput renders type="number" spinbuttons; the first spinbutton
    // on the layout tab is the "Horizontal (X)" padding number input.
    // Entering a numeric value ("20") produces "20px" from compose().
    const inputs = screen.getAllByRole("spinbutton");
    fireEvent.change(inputs[0], { target: { value: "20" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ paddingLeft: "20px", paddingRight: "20px", paddingX: undefined }),
    );
  });

  it("advanced padding Top writes paddingTop", () => {
    const onChange = vi.fn();
    render(<RootStyleField value={{}} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    fireEvent.click(screen.getByRole("button", { name: "Padding advanced options" }));
    const inputs = screen.getAllByRole("spinbutton");
    // First input in the advanced padding block is Top (numeric value → "10px")
    fireEvent.change(inputs[0], { target: { value: "10" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ paddingTop: "10px" }));
  });
});
