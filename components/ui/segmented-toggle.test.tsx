import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TableIcon, CalendarIcon } from "lucide-react";
import { SegmentedToggle } from "./segmented-toggle";

const options = [
  { key: "table" as const, label: "Table", icon: TableIcon },
  { key: "calendar" as const, label: "Calendar", icon: CalendarIcon },
];

describe("SegmentedToggle", () => {
  it("renders all option labels", () => {
    render(
      <SegmentedToggle
        value="table"
        onChange={vi.fn()}
        options={options}
        ariaLabel="View"
      />
    );
    expect(screen.getByText("Table")).toBeInTheDocument();
    expect(screen.getByText("Calendar")).toBeInTheDocument();
  });

  it("marks the active option aria-selected and applies brand classes", () => {
    render(
      <SegmentedToggle
        value="calendar"
        onChange={vi.fn()}
        options={options}
        ariaLabel="View"
      />
    );
    const calendarBtn = screen.getByRole("tab", { name: /calendar/i });
    const tableBtn = screen.getByRole("tab", { name: /table/i });

    expect(calendarBtn).toHaveAttribute("aria-selected", "true");
    expect(tableBtn).toHaveAttribute("aria-selected", "false");
    expect(calendarBtn.className).toContain("bg-brand");
    expect(tableBtn.className).not.toContain("bg-brand");
  });

  it("calls onChange when an option is clicked", () => {
    const onChange = vi.fn();
    render(
      <SegmentedToggle value="table" onChange={onChange} options={options} ariaLabel="View" />
    );
    fireEvent.click(screen.getByRole("tab", { name: /calendar/i }));
    expect(onChange).toHaveBeenCalledWith("calendar");
  });

  it("renders with role=tablist and correct aria-label", () => {
    render(
      <SegmentedToggle
        value="table"
        onChange={vi.fn()}
        options={options}
        ariaLabel="My label"
      />
    );
    expect(screen.getByRole("tablist", { name: "My label" })).toBeInTheDocument();
  });

  it("container has pill structure: rounded-lg, overflow-hidden, border-border", () => {
    const { container } = render(
      <SegmentedToggle value="table" onChange={vi.fn()} options={options} ariaLabel="View" />
    );
    const tablist = container.querySelector('[role="tablist"]')!;
    expect(tablist.className).toContain("rounded-lg");
    expect(tablist.className).toContain("overflow-hidden");
    expect(tablist.className).toContain("border-border");
  });

  it("buttons are rounded-none so container clips outer corners", () => {
    const { container } = render(
      <SegmentedToggle value="table" onChange={vi.fn()} options={options} ariaLabel="View" />
    );
    container.querySelectorAll('[role="tab"]').forEach((tab) => {
      expect(tab.className).toContain("rounded-none");
    });
  });

  it("renders option icons when provided", () => {
    const { container } = render(
      <SegmentedToggle value="table" onChange={vi.fn()} options={options} ariaLabel="View" />
    );
    expect(container.querySelectorAll("svg").length).toBe(2);
  });

  it("renders no icons when icon prop is omitted", () => {
    const noIconOptions = [
      { key: "month" as const, label: "Month" },
      { key: "week" as const, label: "Week" },
    ];
    const { container } = render(
      <SegmentedToggle
        value="month"
        onChange={vi.fn()}
        options={noIconOptions}
        ariaLabel="Calendar view"
      />
    );
    expect(container.querySelectorAll("svg").length).toBe(0);
  });
});
