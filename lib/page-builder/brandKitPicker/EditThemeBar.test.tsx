import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders, enMessages } from "@/test-utils/render";
import { EditThemeBar } from "./EditThemeBar";

describe("EditThemeBar", () => {
  it("edits the name and exits", () => {
    const onNameChange = vi.fn();
    const onExit = vi.fn();
    renderWithProviders(
      <EditThemeBar name="Studio" onNameChange={onNameChange} onExit={onExit} />,
      { messages: enMessages }
    );
    fireEvent.change(screen.getByLabelText("Theme name"), { target: { value: "Studio X" } });
    expect(onNameChange).toHaveBeenCalledWith("Studio X");
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
