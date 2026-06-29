import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { ThemePanelDialog } from "./ThemePanelDialog";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";

vi.mock("../_actions", () => {
  const kit = {
    themePreset: "minimal",
    fontPair: "merriweather-only",
    headingFont: "merriweather",
    bodyFont: "merriweather",
    primaryColor: "#111111",
    secondaryColor: "#f5f5f5",
    accentColor: "#2f5d56",
    backgroundColor: "#ffffff",
    foregroundColor: "#111111",
    radius: "sharp",
    buttonStyle: "solid",
  };
  return {
    updateBrandKitAction: vi.fn().mockResolvedValue({ ok: true }),
    saveThemeAction: vi.fn().mockResolvedValue({ ok: true, theme: { id: "n", name: "X", brandKit: kit } }),
    deleteThemeAction: vi.fn().mockResolvedValue({ ok: true }),
    updateThemeAction: vi.fn().mockResolvedValue({ ok: true, theme: { id: "s1", name: "Y", brandKit: kit } }),
  };
});

function setup(over: Partial<Parameters<typeof ThemePanelDialog>[0]> = {}) {
  const props = {
    open: true,
    brandKit: DEFAULT_BRAND_KIT,
    onBrandKitChange: vi.fn(),
    onSaved: vi.fn(),
    onCancel: vi.fn(),
    savedThemes: [],
    onSavedThemesChange: vi.fn(),
    ...over,
  };
  renderWithProviders(<ThemePanelDialog {...props} />);
  return props;
}

describe("ThemePanelDialog close guard", () => {
  it("closes without a guard when there are no unsaved theme changes", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onCancel).toHaveBeenCalled();
  });

  it("guards close when an unsaved Current Theme exists", () => {
    const onCancel = vi.fn();
    setup({ onCancel });
    fireEvent.click(screen.getByRole("button", { name: /accent/i }));
    fireEvent.change(screen.getByLabelText("Accent hex"), { target: { value: "abcabc" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("You have unsaved changes")).toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("ThemePanelDialog add-new guard", () => {
  it("clicking 'Add new theme' with an unsaved draft opens the guard modal", () => {
    setup();
    // create a current (unsaved) theme
    fireEvent.click(screen.getByRole("button", { name: /accent/i }));
    fireEvent.change(screen.getByLabelText("Accent hex"), { target: { value: "abcabc" } });
    // click add new theme
    fireEvent.click(screen.getByRole("button", { name: "Add new theme" }));
    expect(screen.getByText("Save before starting new?")).toBeInTheDocument();
  });

  it("'Keep editing' (cancel) in the add-new guard closes the modal and preserves the draft", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /accent/i }));
    fireEvent.change(screen.getByLabelText("Accent hex"), { target: { value: "abcabc" } });
    fireEvent.click(screen.getByRole("button", { name: "Add new theme" }));
    expect(screen.getByText("Save before starting new?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByText("Save before starting new?")).not.toBeInTheDocument();
    // The draft is still active — the current tile's name input should still exist
    expect(screen.getByRole("textbox", { name: "Theme name" })).toBeInTheDocument();
  });

  it("'Discard' in the add-new guard drops the draft and seeds a fresh editable tile", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /accent/i }));
    fireEvent.change(screen.getByLabelText("Accent hex"), { target: { value: "abcabc" } });
    fireEvent.click(screen.getByRole("button", { name: "Add new theme" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByText("Save before starting new?")).not.toBeInTheDocument();
    // a fresh editable tile is now visible — the name input is present for the new theme
    expect(screen.getByRole("textbox", { name: "Theme name" })).toBeInTheDocument();
  });

  it("Save in the add-new guard with a duplicate name keeps the modal open with an error", async () => {
    const savedThemes = [{ id: "t1", name: "Taken", brandKit: DEFAULT_BRAND_KIT }];
    setup({ savedThemes });
    fireEvent.click(screen.getByRole("button", { name: /accent/i }));
    fireEvent.change(screen.getByLabelText("Accent hex"), { target: { value: "abcabc" } });
    fireEvent.click(screen.getByRole("button", { name: "Add new theme" }));
    // type duplicate name
    const nameInput = screen.getByRole("textbox", { name: "Theme name" });
    fireEvent.change(nameInput, { target: { value: "Taken" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument()
    );
    // modal is still open
    expect(screen.getByText("Save before starting new?")).toBeInTheDocument();
  });
});

describe("ThemePanelDialog edit-mode close guard", () => {
  it("guards close when in edit mode with unsaved changes (editGuardOpen wiring)", () => {
    const savedThemes = [{ id: "t1", name: "Studio", brandKit: DEFAULT_BRAND_KIT }];
    const props = setup({ savedThemes });
    // Enter edit mode on the saved theme
    fireEvent.click(screen.getByRole("button", { name: "Edit theme: Studio" }));
    // Make a change to create a diff
    fireEvent.click(screen.getByRole("button", { name: /accent/i }));
    fireEvent.change(screen.getByLabelText("Accent hex"), { target: { value: "abcabc" } });
    // Attempt to close the dialog
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    // UnsavedEditDialog should fire via requestExit → editGuardOpen
    expect(screen.getByText("You have unsaved changes")).toBeInTheDocument();
    expect(props.onCancel).not.toHaveBeenCalled();
  });
});

describe("ThemePanelDialog Apply button", () => {
  it("footer button is labeled Apply", () => {
    setup();
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
  });

  it("Apply with no unsaved Current Theme calls onSaved (no DB write — brand kit is kept in local buffer)", async () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(props.onSaved).toHaveBeenCalled());
  });

  it("Apply with an unsaved Current Theme but no name shows inline error and does NOT call onSaved", async () => {
    const props = setup();
    // create a current theme by editing the accent color
    fireEvent.click(screen.getByRole("button", { name: /accent/i }));
    fireEvent.change(screen.getByLabelText("Accent hex"), { target: { value: "abcabc" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument()
    );
    expect(props.onSaved).not.toHaveBeenCalled();
  });

  it("Apply with an unsaved Current Theme after typing a name saves the named theme + calls onSaved", async () => {
    const { saveThemeAction } = await import("../_actions");
    const props = setup();
    // create a current theme
    fireEvent.click(screen.getByRole("button", { name: /accent/i }));
    fireEvent.change(screen.getByLabelText("Accent hex"), { target: { value: "abcabc" } });
    // type a name into the inline tile input
    const nameInput = screen.getByRole("textbox", { name: "Theme name" });
    fireEvent.change(nameInput, { target: { value: "My Theme" } });
    (saveThemeAction as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(saveThemeAction).toHaveBeenCalledWith("My Theme", expect.anything()));
    await waitFor(() => expect(props.onSaved).toHaveBeenCalled());
  });
});
