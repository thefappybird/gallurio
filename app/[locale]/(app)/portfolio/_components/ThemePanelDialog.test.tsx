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

describe("ThemePanelDialog Apply button", () => {
  it("footer button is labeled Apply", () => {
    setup();
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
  });

  it("Apply with no unsaved Current Theme persists page directly", async () => {
    const { updateBrandKitAction } = await import("../_actions");
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(updateBrandKitAction).toHaveBeenCalled());
    expect(props.onSaved).toHaveBeenCalled();
  });

  it("Apply with an unsaved Current Theme but no name shows inline error and does NOT call onSaved", async () => {
    const { updateBrandKitAction } = await import("../_actions");
    const props = setup();
    // create a current theme by editing the accent color
    fireEvent.click(screen.getByRole("button", { name: /accent/i }));
    fireEvent.change(screen.getByLabelText("Accent hex"), { target: { value: "abcabc" } });
    (updateBrandKitAction as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument()
    );
    expect(updateBrandKitAction).not.toHaveBeenCalled();
    expect(props.onSaved).not.toHaveBeenCalled();
  });

  it("Apply with an unsaved Current Theme after typing a name saves + persists", async () => {
    const { updateBrandKitAction, saveThemeAction } = await import("../_actions");
    const props = setup();
    // create a current theme
    fireEvent.click(screen.getByRole("button", { name: /accent/i }));
    fireEvent.change(screen.getByLabelText("Accent hex"), { target: { value: "abcabc" } });
    // type a name into the inline tile input
    const nameInput = screen.getByRole("textbox", { name: "Theme name" });
    fireEvent.change(nameInput, { target: { value: "My Theme" } });
    (updateBrandKitAction as ReturnType<typeof vi.fn>).mockClear();
    (saveThemeAction as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(saveThemeAction).toHaveBeenCalledWith("My Theme", expect.anything()));
    await waitFor(() => expect(updateBrandKitAction).toHaveBeenCalled());
    expect(props.onSaved).toHaveBeenCalled();
  });
});
