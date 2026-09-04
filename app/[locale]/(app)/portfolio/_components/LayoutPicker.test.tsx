import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LayoutPicker, renderPopupLayoutThumb } from "./LayoutPicker";

const OPTIONS = [
  { id: "a", label: "Option A", description: "Description A" },
  { id: "b", label: "Option B", description: "Description B" },
  { id: "c", label: "Option C", description: "Description C" },
];

describe("LayoutPicker", () => {
  it("renders a radiogroup with one radio per option and marks the selected one", () => {
    render(
      <LayoutPicker
        ariaLabel="Test layout"
        options={OPTIONS}
        value="b"
        onChange={vi.fn()}
        renderThumb={renderPopupLayoutThumb}
      />,
    );

    const group = screen.getByRole("radiogroup", { name: "Test layout" });
    expect(group).toBeInTheDocument();

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "Option A" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: "Option B" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Option C" })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange with the clicked option id", () => {
    const onChange = vi.fn();
    render(
      <LayoutPicker
        ariaLabel="Test layout"
        options={OPTIONS}
        value="a"
        onChange={onChange}
        renderThumb={renderPopupLayoutThumb}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Option C" }));
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("moves selection with ArrowRight from the currently selected tile", () => {
    const onChange = vi.fn();
    render(
      <LayoutPicker
        ariaLabel="Test layout"
        options={OPTIONS}
        value="a"
        onChange={onChange}
        renderThumb={renderPopupLayoutThumb}
      />,
    );

    fireEvent.keyDown(screen.getByRole("radio", { name: "Option A" }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("shows the hovered option's description in the inline preview", () => {
    render(
      <LayoutPicker
        ariaLabel="Test layout"
        options={OPTIONS}
        value="a"
        onChange={vi.fn()}
        renderThumb={renderPopupLayoutThumb}
      />,
    );

    fireEvent.mouseEnter(screen.getByRole("radio", { name: "Option C" }));
    expect(screen.getByText("Description C")).toBeInTheDocument();
  });

  it("shows the focused option's description in the inline preview (keyboard-reachable)", () => {
    render(
      <LayoutPicker
        ariaLabel="Test layout"
        options={OPTIONS}
        value="a"
        onChange={vi.fn()}
        renderThumb={renderPopupLayoutThumb}
      />,
    );

    fireEvent.focus(screen.getByRole("radio", { name: "Option B" }));
    expect(screen.getByText("Description B")).toBeInTheDocument();
  });

  it("falls back to the selected option's description when nothing is hovered or focused", () => {
    render(
      <LayoutPicker
        ariaLabel="Test layout"
        options={OPTIONS}
        value="c"
        onChange={vi.fn()}
        renderThumb={renderPopupLayoutThumb}
      />,
    );

    expect(screen.getByText("Description C")).toBeInTheDocument();
  });

  it("disables every tile, shows the note, and never calls onChange when disabled", () => {
    const onChange = vi.fn();
    render(
      <LayoutPicker
        ariaLabel="Test layout"
        options={OPTIONS}
        value="a"
        onChange={onChange}
        disabled
        disabledNote="Not available right now"
        renderThumb={renderPopupLayoutThumb}
      />,
    );

    const radios = screen.getAllByRole("radio");
    radios.forEach((r) => expect(r).toBeDisabled());
    expect(screen.getByText("Not available right now")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Option B" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
