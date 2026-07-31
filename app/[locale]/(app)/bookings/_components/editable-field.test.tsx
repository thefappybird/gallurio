import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditableField } from "./editable-field";

describe("EditableField validation a11y", () => {
  it("marks the text input invalid and links it to the error message when validate fails", () => {
    render(
      <EditableField
        label="Title"
        value="Original"
        type="text"
        validate={(v) => (v === "bad" ? "Not allowed" : null)}
        onCommit={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Title" }));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "bad" } });
    fireEvent.keyDown(input, { key: "Enter" });

    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent("Not allowed");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toBe(error.id);
  });

  it("marks the SelectTrigger invalid and links it to the error message when validate fails", () => {
    // The Confirm button is disabled whenever validate() currently fails
    // (canCommit requires !validationError), so a real user can never click
    // through to an invalid commit for a constrained `select` control the way
    // they can via Enter on a text input. To exercise the select branch's a11y
    // wiring in isolation, drive the shared `error` state via the text branch
    // first, then swap `type` on the same mounted instance (no `key` change,
    // so React state — including `error` — survives the prop change).
    const { rerender } = render(
      <EditableField
        label="Status"
        value="open"
        type="text"
        validate={(v) => (v === "closed" ? "Cannot close" : null)}
        onCommit={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit Status" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "closed" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(screen.getByRole("alert")).toHaveTextContent("Cannot close");

    rerender(
      <EditableField
        label="Status"
        value="open"
        type="select"
        options={[
          { value: "open", label: "Open" },
          { value: "closed", label: "Closed" },
        ]}
        validate={(v) => (v === "closed" ? "Cannot close" : null)}
        onCommit={vi.fn()}
      />
    );

    const error = screen.getByRole("alert");
    const trigger = screen.getByRole("combobox");
    expect(error).toHaveTextContent("Cannot close");
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger.getAttribute("aria-describedby")).toBe(error.id);
  });
});
