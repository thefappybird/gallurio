import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Combobox } from "./combobox";

type Item = { id: string; name: string };

const GROUPS = [
  { heading: "Fruits", items: [{ id: "apple", name: "Apple" }, { id: "banana", name: "Banana" }] },
  { heading: "Veggies", items: [{ id: "carrot", name: "Carrot" }] },
];

function setup(overrides: Partial<React.ComponentProps<typeof Combobox<Item>>> = {}) {
  const onChange = vi.fn();
  render(
    <Combobox<Item>
      groups={GROUPS}
      getValue={(i) => i.id}
      getLabel={(i) => i.name}
      value="apple"
      onChange={onChange}
      selectedLabel="Apple"
      searchPlaceholder="Search items"
      noMatchesLabel="No matching items"
      ariaLabel="Pick item"
      {...overrides}
    />
  );
  return { onChange };
}

describe("Combobox", () => {
  it("shows the selected label on the closed trigger", () => {
    setup();
    expect(screen.getByRole("button", { name: "Pick item" })).toHaveTextContent("Apple");
  });

  it("opening the trigger shows a grouped listbox with all options", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Pick item" }));
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText("Fruits")).toBeInTheDocument();
    expect(within(listbox).getByText("Veggies")).toBeInTheDocument();
    const options = within(listbox).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Apple", "Banana", "Carrot"]);
  });

  it("does not show the listbox before the trigger is clicked", () => {
    setup();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("selecting an option calls onChange with its value and closes the listbox", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Pick item" }));
    fireEvent.mouseDown(screen.getByRole("option", { name: "Banana" }));
    expect(onChange).toHaveBeenCalledWith("banana");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("caps the listbox at a scrollable max-height so it can't overflow the viewport", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Pick item" }));
    expect(screen.getByRole("listbox")).toHaveClass("max-h-64", "overflow-y-auto");
  });

  it("typing in the search box filters options across all groups", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Pick item" }));
    const search = screen.getByRole("combobox");
    fireEvent.change(search, { target: { value: "car" } });
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Carrot"]);
  });

  it("supports ArrowDown + Enter keyboard selection", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Pick item" }));
    const search = screen.getByRole("combobox");
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("banana");
  });

  it("Escape closes the listbox", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Pick item" }));
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("renders a trailing action row and selecting it calls its onSelect instead of onChange", () => {
    const onSelect = vi.fn();
    const { onChange } = setup({ trailingAction: { label: "Custom…", onSelect } });
    fireEvent.click(screen.getByRole("button", { name: "Pick item" }));
    fireEvent.mouseDown(screen.getByRole("option", { name: "Custom…" }));
    expect(onSelect).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows the no-matches label when the search query matches nothing", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Pick item" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzz" } });
    expect(screen.getByText("No matching items")).toBeInTheDocument();
  });

  it("applies a per-item inline style, e.g. a font-family preview", () => {
    setup({ getItemStyle: (i) => ({ fontFamily: `"${i.name}"` }) });
    fireEvent.click(screen.getByRole("button", { name: "Pick item" }));
    expect(screen.getByRole("option", { name: "Banana" })).toHaveStyle({ fontFamily: '"Banana"' });
  });

  it("marks the currently selected value's option with aria-selected", () => {
    setup({ value: "banana" });
    fireEvent.click(screen.getByRole("button", { name: "Pick item" }));
    expect(screen.getByRole("option", { name: "Banana" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "Apple" })).toHaveAttribute("aria-selected", "false");
  });

  it("stops propagation for the keys it handles so a page-level hotkey listener never sees them", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Pick item" }));
    const search = screen.getByRole("combobox");
    let bubbled = false;
    document.addEventListener("keydown", () => { bubbled = true; });
    fireEvent.keyDown(search, { key: "Escape", bubbles: true });
    expect(bubbled).toBe(false);
  });
});
