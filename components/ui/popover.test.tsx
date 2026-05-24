import { describe, expect, it } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { Popover, PopoverTrigger, PopoverContent } from "./popover";

describe("Popover", () => {
  it("renders the trigger and opens content on click", () => {
    renderWithProviders(
      <Popover>
        <PopoverTrigger render={<button type="button">Open</button>} />
        <PopoverContent>Popover body</PopoverContent>
      </Popover>
    );
    expect(screen.getByText("Open")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Open"));
    expect(screen.getByText("Popover body")).toBeInTheDocument();
  });
});
