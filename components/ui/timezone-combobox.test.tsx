import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { TimezoneCombobox } from "./timezone-combobox";

function setup(value = "Asia/Manila", onChange = vi.fn()) {
  render(
    <TimezoneCombobox
      id="timezone"
      value={value}
      onChange={onChange}
      searchPlaceholder="Search timezones"
      noMatchesLabel="No matching timezones"
    />,
  );
  return { onChange };
}

describe("TimezoneCombobox", () => {
  it("shows the selected zone's label on the closed trigger", () => {
    setup("Asia/Manila");
    expect(
      screen.getByRole("button", { name: /Asia\/Manila \(UTC\+8\)/ }),
    ).toBeInTheDocument();
  });

  it("typing 'manila' filters the list to Asia/Manila", () => {
    setup("Etc/UTC");
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "manila" } });
    const listbox = screen.getByRole("listbox");
    const options = within(listbox).getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Asia/Manila (UTC+8)");
  });

  it("typing '+8' includes Asia/Manila and other UTC+8 zones", () => {
    setup("Etc/UTC");
    fireEvent.click(screen.getByRole("button"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "+8" } });
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    const labels = options.map((o) => o.textContent);
    expect(labels).toContain("Asia/Manila (UTC+8)");
    expect(labels).toContain("Asia/Singapore (UTC+8)");
    expect(options.length).toBeGreaterThan(1);
  });

  it("selecting an option calls onChange with the IANA value", () => {
    const onChange = vi.fn();
    setup("Etc/UTC", onChange);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "manila" } });
    const option = within(screen.getByRole("listbox")).getByRole("option");
    fireEvent.mouseDown(option);
    expect(onChange).toHaveBeenCalledWith("Asia/Manila");
  });

  it("caps the options list at a scrollable max-height so it doesn't overflow the page", () => {
    setup("Etc/UTC");
    fireEvent.click(screen.getByRole("button"));
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveClass("max-h-64", "overflow-y-auto");
  });

  it("forwards invalid + ariaDescribedby to the trigger button", () => {
    render(
      <TimezoneCombobox
        id="timezone"
        value="Asia/Manila"
        onChange={vi.fn()}
        searchPlaceholder="Search timezones"
        noMatchesLabel="No matching timezones"
        invalid
        ariaDescribedby="timezone-error"
      />,
    );
    const trigger = screen.getByRole("button");
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toHaveAttribute("aria-describedby", "timezone-error");
  });

  it("supports ArrowDown + Enter keyboard selection", () => {
    const onChange = vi.fn();
    setup("Etc/UTC", onChange);
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "asia" } });
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    // Option labels are "IANA (UTC±N)"; derive the IANA value of the 2nd option.
    const secondIana = options[1].textContent!.split(" (")[0];
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(secondIana);
  });
});
