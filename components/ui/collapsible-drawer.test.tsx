import { describe, expect, it } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { CollapsibleDrawer } from "./collapsible-drawer";

describe("CollapsibleDrawer", () => {
  it("expands to reveal body content on trigger click", () => {
    renderWithProviders(
      <CollapsibleDrawer title="Section title">
        <div>Body content</div>
      </CollapsibleDrawer>
    );

    const trigger = screen.getByRole("button", { name: "Section title" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Body content")).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  it("drives the chevron rotation off the trigger's data-panel-open state", () => {
    renderWithProviders(
      <CollapsibleDrawer title="Section title">
        <div>Body content</div>
      </CollapsibleDrawer>
    );

    const trigger = screen.getByRole("button", { name: "Section title" });
    const chevron = trigger.querySelector("svg");
    expect(chevron).toHaveClass("group-data-panel-open:rotate-180");
  });

  it("does not toggle when clicking a nested control in the title", () => {
    renderWithProviders(
      <CollapsibleDrawer
        title={
          <span>
            Section title
            <button type="button">Nested action</button>
          </span>
        }
      >
        <div>Body content</div>
      </CollapsibleDrawer>
    );

    const trigger = screen.getByRole("button", { name: /Section title/ });
    fireEvent.click(screen.getByRole("button", { name: "Nested action" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("hides body content again after collapsing", async () => {
    renderWithProviders(
      <CollapsibleDrawer title="Section title">
        <div>Body content</div>
      </CollapsibleDrawer>
    );

    const trigger = screen.getByRole("button", { name: "Section title" });
    fireEvent.click(trigger);
    expect(screen.getByText("Body content")).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(screen.queryByText("Body content")).not.toBeInTheDocument());
  });
});
