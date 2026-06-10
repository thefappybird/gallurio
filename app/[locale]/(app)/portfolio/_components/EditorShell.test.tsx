import { describe, it, expect, vi, beforeEach } from "vitest";
import { useEffect, type ReactNode } from "react";
import { screen, fireEvent, within, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";

// Stub the heavy Puck editor: render its title + the injected custom header
// (`overrides.header`), passing a "Publish" action so we can exercise onPublish.
// Also stub `usePuck` (used by the in-canvas device toggle) so it has context.
vi.mock("@measured/puck", () => ({
  Puck: ({
    headerTitle,
    overrides,
    onPublish,
    onChange,
  }: {
    headerTitle?: string;
    overrides?: { header?: (p: { actions: ReactNode; children: ReactNode }) => ReactNode };
    onPublish?: () => void;
    onChange?: (data: unknown) => void;
  }) => {
    useEffect(() => {
      onChange?.({ content: [], root: {} });
    }, [onChange]);

    return (
      <div data-testid="puck">
        <div data-testid="puck-title">{headerTitle}</div>
        <button
          type="button"
          onClick={() =>
            onChange?.({
              content: [{ type: "Hero", props: { id: "hero-1", headline: "Changed" } }],
              root: {},
            })
          }
        >
          Simulate Puck change
        </button>
        {overrides?.header?.({
          actions: (
            <button type="button" onClick={onPublish}>
              PuckPublish
            </button>
          ),
          children: null,
        })}
      </div>
    );
  },
  usePuck: () => ({
    appState: {
      ui: {
        leftSideBarVisible: true,
        rightSideBarVisible: true,
        viewports: { current: { width: 1280, height: "auto" }, controlsVisible: true, options: [] },
      },
    },
    dispatch: vi.fn(),
  }),
}));

const savePortfolioDraftAction = vi.fn().mockResolvedValue({ ok: true });
const publishPortfolioAction = vi.fn().mockResolvedValue({ ok: true });
const updateBrandKitAction = vi.fn().mockResolvedValue({ ok: true });
const updateContactConfigAction = vi.fn().mockResolvedValue({ ok: true });
const updateFormLocaleAction = vi.fn().mockResolvedValue({ ok: true });
const switchTemplateAction = vi.fn().mockResolvedValue({ ok: true });
const dismissPortfolioGuideAction = vi.fn().mockResolvedValue({ ok: true });
const saveThemeAction = vi.fn().mockResolvedValue({ ok: true, theme: { id: "t1", name: "Test", brandKit: {} } });
const deleteThemeAction = vi.fn().mockResolvedValue({ ok: true });
const updateHeaderConfigAction = vi.fn().mockResolvedValue({ ok: true });
const updateCollectionsPopupConfigAction = vi.fn().mockResolvedValue({ ok: true });
const updateThemeAction = vi.fn().mockResolvedValue({ ok: true, theme: { id: "t1", name: "Test", brandKit: {} } });
vi.mock("../_actions", () => ({
  savePortfolioDraftAction: (...a: unknown[]) => savePortfolioDraftAction(...a),
  publishPortfolioAction: (...a: unknown[]) => publishPortfolioAction(...a),
  updateBrandKitAction: (...a: unknown[]) => updateBrandKitAction(...a),
  updateContactConfigAction: (...a: unknown[]) => updateContactConfigAction(...a),
  updateFormLocaleAction: (...a: unknown[]) => updateFormLocaleAction(...a),
  switchTemplateAction: (...a: unknown[]) => switchTemplateAction(...a),
  dismissPortfolioGuideAction: (...a: unknown[]) => dismissPortfolioGuideAction(...a),
  saveThemeAction: (...a: unknown[]) => saveThemeAction(...a),
  deleteThemeAction: (...a: unknown[]) => deleteThemeAction(...a),
  updateThemeAction: (...a: unknown[]) => updateThemeAction(...a),
  updateHeaderConfigAction: (...a: unknown[]) => updateHeaderConfigAction(...a),
  updateCollectionsPopupConfigAction: (...a: unknown[]) => updateCollectionsPopupConfigAction(...a),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { EditorShell } from "./EditorShell";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";

const baseProps = {
  slug: "studio-aurora",
  workspaceName: "Studio Aurora",
  initialData: {
    home: { content: [{ type: "Hero", props: { headline: "Hi" } }], root: {} },
    gallery: { content: [], root: {} },
  },
  initialBrandKit: DEFAULT_BRAND_KIT,
  initialContact: { title: "Hi" },
  initialFormLocale: "",
  initialHeaderConfig: {},
  initialCollectionsPopup: {},
  publicOrigin: "https://app.test",
  previewBasePath: "/portfolio-preview",
  templates: [
    { id: "minimal", label: "Minimal", description: "Clean", defaultBrandKit: DEFAULT_BRAND_KIT },
  ],
  currentTemplateId: "minimal",
  // Keep the first-run guide closed during these tests so its overlay doesn't
  // sit over the editor controls.
  guideDismissed: true,
  initialSavedThemes: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("EditorShell", () => {
  it("renders the editor with the workspace name + active zone in the title", () => {
    renderWithProviders(<EditorShell {...baseProps} />);
    expect(screen.getByTestId("puck-title")).toHaveTextContent("Studio Aurora · Home");
    expect(screen.getByTestId("portfolio-editor-shell")).toHaveClass("min-h-svh");
  });

  it("renders the zone switcher and switches the active zone", async () => {
    renderWithProviders(<EditorShell {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Gallery" }));
    expect(await screen.findByText("Studio Aurora · Gallery")).toBeInTheDocument();
  });

  it("places Navigation and Contact Form beside the page tabs", () => {
    renderWithProviders(<EditorShell {...baseProps} />);
    const controls = screen.getByRole("group", { name: "Portfolio sections" });
    expect(within(controls).getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(within(controls).getByRole("button", { name: "Gallery" })).toBeInTheDocument();
    expect(within(controls).getByRole("button", { name: "Collections Popup" })).toBeInTheDocument();
    expect(within(controls).getByRole("button", { name: "Navigation" })).toBeInTheDocument();
    expect(within(controls).getByRole("button", { name: "Contact Form" })).toBeInTheDocument();
  });

  it("opens the Collections Popup panel when the Collections Popup tab is clicked", async () => {
    renderWithProviders(<EditorShell {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Collections Popup" }));
    expect(await screen.findByLabelText("Collections popup style")).toBeInTheDocument();
    expect(screen.queryByTestId("puck")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collections Popup" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("shows a preview and swaps the right editor panel between header and contact settings", async () => {
    renderWithProviders(<EditorShell {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Contact Form" }));
    expect(screen.queryByTestId("puck")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Contact form")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Navigation" }));
    expect(screen.queryByLabelText("Contact form")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Navigation")).toBeInTheDocument();
    expect(screen.queryByTestId("puck")).not.toBeInTheDocument();
    expect(screen.getByText("Studio Aurora")).toBeInTheDocument();
  });

  it("removes viewport buttons from edit mode but keeps sidebar toggles", () => {
    renderWithProviders(<EditorShell {...baseProps} />);
    expect(screen.getByRole("button", { name: "Toggle blocks panel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle properties panel" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mobile" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tablet" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desktop" })).not.toBeInTheDocument();
  });

  it("opens the publish dialog when Puck's publish fires", () => {
    renderWithProviders(<EditorShell {...baseProps} />);
    expect(screen.queryByText("Publish your portfolio?")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "PuckPublish" }));
    expect(screen.getByText("Publish your portfolio?")).toBeInTheDocument();
  });

  it("opens the theme panel", () => {
    renderWithProviders(<EditorShell {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Theme" }));
    expect(screen.getByText("Theme & brand")).toBeInTheDocument();
  });

  it("toggles into live preview (Puck unmounts, iframe shown) and back", async () => {
    const { container } = renderWithProviders(<EditorShell {...baseProps} />);
    expect(screen.getByTestId("puck")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    // Puck gone, preview iframe mounted pointing at the home zone.
    expect(await screen.findByTitle("Live preview")).toBeInTheDocument();
    expect(screen.queryByTestId("puck")).not.toBeInTheDocument();
    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("src")).toContain("/portfolio-preview?zone=home");
    expect(iframe?.getAttribute("src")).toContain("&draft=");
    expect(iframe?.getAttribute("src")).not.toContain("&header=");
    // Back to editing.
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(await screen.findByTestId("puck")).toBeInTheDocument();
  });

  it("treats Contact as a tab — auto-opens the inline settings panel", async () => {
    renderWithProviders(<EditorShell {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Contact Form" }));
    expect(screen.queryByTestId("puck")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Contact Form" }).getAttribute("aria-pressed")).toBe("true");
    // Auto-open means the panel is already visible (shows the description).
    expect(
      await screen.findByText(
        "The form fields are fixed. You can edit the heading, message, and button only."
      )
    ).toBeInTheDocument();
  });

  it("publishes from the contact tab without a lingering 'Saving…' status", async () => {
    renderWithProviders(<EditorShell {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Contact Form" }));
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));
    fireEvent.click(await screen.findByRole("button", { name: "Publish now" }));
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(screen.queryByText("Saving…")).not.toBeInTheDocument();
    await waitFor(() => expect(publishPortfolioAction).toHaveBeenCalled());
  });

  it("shows the mobile banner notice", () => {
    renderWithProviders(<EditorShell {...baseProps} />);
    expect(
      screen.getByText("The editor works best on a larger screen")
    ).toBeInTheDocument();
  });

  it("entering preview from the contact panel closes edit-only tabs and returns to home", async () => {
    const { container } = renderWithProviders(<EditorShell {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Contact Form" }));
    expect(await screen.findByLabelText("Contact form preview")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Navigation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Contact Form" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Collections Popup" })).not.toBeInTheDocument();
    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("src")).toContain("/portfolio-preview?zone=home");
    expect(screen.getByRole("button", { name: "Home" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps Puck edits local until Publish", async () => {
    renderWithProviders(<EditorShell {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Simulate Puck change" }));
    expect(savePortfolioDraftAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "PuckPublish" }));
    fireEvent.click(await screen.findByRole("button", { name: "Publish now" }));

    expect(savePortfolioDraftAction).toHaveBeenCalledWith({
      zone: "home",
      data: {
        content: [{ type: "Hero", props: { id: "hero-1", headline: "Changed" } }],
        root: {},
      },
    });
    await waitFor(() => expect(publishPortfolioAction).toHaveBeenCalled());
  });
});
