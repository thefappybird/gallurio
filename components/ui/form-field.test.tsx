import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { FormField } from "./form-field";
import { Select, SelectTrigger, SelectValue } from "./select";
import { PhoneInput } from "./phone-input";
import { Combobox } from "./combobox";

describe("FormField", () => {
  it("wires aria-invalid and aria-describedby to the error message when error is present", () => {
    renderWithProviders(
      <FormField label="Email" error="Email is required">
        {(a11y) => (
          <input
            id={a11y.id}
            aria-invalid={a11y["aria-invalid"]}
            aria-describedby={a11y["aria-describedby"]}
            data-testid="control"
          />
        )}
      </FormField>
    );
    const control = screen.getByTestId("control");
    expect(control).toHaveAttribute("aria-invalid", "true");
    const message = screen.getByRole("alert");
    expect(control.getAttribute("aria-describedby")).toBe(message.id);
  });

  it("renders no message and no aria-invalid/aria-describedby when error is absent", () => {
    renderWithProviders(
      <FormField label="Email">
        {(a11y) => (
          <input
            id={a11y.id}
            aria-invalid={a11y["aria-invalid"]}
            aria-describedby={a11y["aria-describedby"]}
            data-testid="control"
          />
        )}
      </FormField>
    );
    const control = screen.getByTestId("control");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(control).not.toHaveAttribute("aria-invalid");
    expect(control).not.toHaveAttribute("aria-describedby");
  });

  it("renders the alert message directly after the control in DOM order", () => {
    const { container } = renderWithProviders(
      <FormField label="Email" error="Email is required">
        {(a11y) => (
          <input
            id={a11y.id}
            aria-invalid={a11y["aria-invalid"]}
            aria-describedby={a11y["aria-describedby"]}
            data-testid="control"
          />
        )}
      </FormField>
    );
    const message = screen.getByRole("alert");
    expect(message.tagName).toBe("P");
    const children = Array.from(container.querySelector("div")!.children);
    const controlIndex = children.findIndex((el) => el.getAttribute("data-testid") === "control");
    const messageIndex = children.indexOf(message);
    expect(messageIndex).toBe(controlIndex + 1);
  });

  it("preserves a caller-supplied describedBy alongside the error id, error id first", () => {
    renderWithProviders(
      <FormField label="Email" error="Email is required" describedBy="external-hint">
        {(a11y) => (
          <input
            id={a11y.id}
            aria-invalid={a11y["aria-invalid"]}
            aria-describedby={a11y["aria-describedby"]}
            data-testid="control"
          />
        )}
      </FormField>
    );
    const control = screen.getByTestId("control");
    const message = screen.getByRole("alert");
    expect(control.getAttribute("aria-describedby")).toBe(`${message.id} external-hint`);
  });

  it("includes the hint's id in aria-describedby", () => {
    renderWithProviders(
      <FormField label="Email" hint="We'll never share this">
        {(a11y) => (
          <input
            id={a11y.id}
            aria-invalid={a11y["aria-invalid"]}
            aria-describedby={a11y["aria-describedby"]}
            data-testid="control"
          />
        )}
      </FormField>
    );
    const control = screen.getByTestId("control");
    const hint = screen.getByText("We'll never share this");
    expect(control.getAttribute("aria-describedby")).toBe(hint.id);
  });

  it("wires SelectTrigger to carry aria-invalid and its destructive outline classes", () => {
    renderWithProviders(
      <Select>
        <SelectTrigger data-testid="select-trigger" aria-invalid>
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
      </Select>
    );
    const trigger = screen.getByTestId("select-trigger");
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger.className).toContain("aria-invalid:border-destructive");
  });

  it("forwards aria-invalid from PhoneInput down to its inner text input", () => {
    renderWithProviders(<PhoneInput aria-invalid value={undefined} onChange={() => {}} />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("wires Combobox's trigger to carry aria-invalid, aria-describedby, and the destructive outline classes", () => {
    renderWithProviders(
      <Combobox
        groups={[{ heading: "Fruits", items: [{ id: "apple", name: "Apple" }] }]}
        getValue={(i: { id: string }) => i.id}
        getLabel={(i: { name: string }) => i.name}
        value="apple"
        onChange={() => {}}
        selectedLabel="Apple"
        searchPlaceholder="Search"
        noMatchesLabel="No matches"
        ariaLabel="Pick item"
        invalid
        ariaDescribedby="ext-error"
      />
    );
    const trigger = screen.getByRole("button", { name: "Pick item" });
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toHaveAttribute("aria-describedby", "ext-error");
    expect(trigger.className).toContain("aria-invalid:border-destructive");
  });
});
