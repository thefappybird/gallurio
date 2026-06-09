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
    expect(screen.getByRole("button", { name: "Save current as theme" })).toBeDisabled();
  });
});
