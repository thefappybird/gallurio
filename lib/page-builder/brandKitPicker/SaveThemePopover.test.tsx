import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders, enMessages } from "@/test-utils/render";
import { SaveThemePopover } from "./SaveThemePopover";

// Ensure the keys this component reads exist for the test regardless of Task 7 ordering.
const messages = {
  ...enMessages,
  app: {
    ...enMessages.app,
    pageBuilder: {
      ...enMessages.app.pageBuilder,
      brandKit: {
        ...enMessages.app.pageBuilder.brandKit,
        saveCurrentAsTheme: "Save current as theme",
        themeNamePlaceholder: "Theme name",
        saveAction: "Save",
        enterThemeName: "Enter a name for this theme.",
        nameTooLong: "Theme name must be 60 characters or fewer.",
        saveThemeError: "Could not save theme. Please try again.",
        themeLimitReached: "You've reached the maximum of {max} saved themes.",
        themeNameExists: "A theme already exists with this name.",
      },
    },
  },
};

function setup(over: Partial<Parameters<typeof SaveThemePopover>[0]> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  renderWithProviders(<SaveThemePopover onSave={onSave} atLimit={false} {...over} />, {
    messages,
  });
  return { onSave };
}

describe("SaveThemePopover", () => {
  it("exposes an accessible save trigger", () => {
    setup();
    expect(screen.getByRole("button", { name: "Save current as theme" })).toBeInTheDocument();
  });

  it("saves the typed name then clears the input", async () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Save current as theme" }));
    const input = await screen.findByPlaceholderText("Theme name");
    fireEvent.change(input, { target: { value: "Spring 26" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("Spring 26"));
    await waitFor(() => expect(screen.queryByPlaceholderText("Theme name")).toBeNull());
  });

  it("trims the name and saves via the Enter key", async () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Save current as theme" }));
    const input = await screen.findByPlaceholderText("Theme name");
    fireEvent.change(input, { target: { value: "  Moody  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("Moody"));
  });

  it("blocks an empty name", async () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Save current as theme" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a name for this theme.")).toBeInTheDocument();
  });

  it("disables the trigger at the saved-theme limit", () => {
    setup({ atLimit: true });
    expect(
      screen.getByRole("button", { name: "You've reached the maximum of 24 saved themes." })
    ).toBeDisabled();
  });

  it("rejects a name longer than 60 characters", async () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Save current as theme" }));
    const input = await screen.findByPlaceholderText("Theme name");
    fireEvent.change(input, { target: { value: "x".repeat(61) } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Theme name must be 60 characters or fewer.")).toBeInTheDocument();
  });

  it("shows an error and keeps the popover open when saving fails", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("nope"));
    renderWithProviders(<SaveThemePopover onSave={onSave} atLimit={false} />, { messages });
    fireEvent.click(screen.getByRole("button", { name: "Save current as theme" }));
    const input = await screen.findByPlaceholderText("Theme name");
    fireEvent.change(input, { target: { value: "Retry me" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.getByText("Could not save theme. Please try again.")).toBeInTheDocument()
    );
    expect(screen.getByPlaceholderText("Theme name")).toHaveValue("Retry me");
  });

  it("blocks a duplicate name with an inline error before saving", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <SaveThemePopover onSave={onSave} atLimit={false} takenNames={["Sunset"]} />,
      { messages }
    );
    fireEvent.click(screen.getByRole("button", { name: "Save current as theme" }));
    const input = await screen.findByPlaceholderText("Theme name");
    fireEvent.change(input, { target: { value: "  SUNSET " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("A theme already exists with this name.")).toBeInTheDocument();
  });
});
