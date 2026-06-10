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

  it("shows padding controls on the Layout tab", () => {
    render(<RootStyleField value={{}} onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    expect(screen.getByText(/padding x/i)).toBeInTheDocument();
    expect(screen.getByText(/margin x/i)).toBeInTheDocument();
  });
});
