import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";

// Stub the heavy Puck editor: render its title + the injected headerActions,
// and expose a "Publish" child so we can exercise onPublish.
vi.mock("@measured/puck", () => ({
  Puck: ({
    headerTitle,
    overrides,
    onPublish,
  }: {
    headerTitle?: string;
    overrides?: { headerActions?: (p: { children: ReactNode }) => ReactNode };
    onPublish?: () => void;
  }) => (
    <div data-testid="puck">
      <div data-testid="puck-title">{headerTitle}</div>
      {overrides?.headerActions?.({
        children: (
          <button type="button" onClick={onPublish}>
            PuckPublish
          </button>
        ),
      })}
    </div>
  ),
}));

const savePortfolioDraftAction = vi.fn().mockResolvedValue({ ok: true });
const publishPortfolioAction = vi.fn().mockResolvedValue({ ok: true });
const updateBrandKitAction = vi.fn().mockResolvedValue({ ok: true });
const updateContactConfigAction = vi.fn().mockResolvedValue({ ok: true });
vi.mock("../_actions", () => ({
  savePortfolioDraftAction: (...a: unknown[]) => savePortfolioDraftAction(...a),
  publishPortfolioAction: (...a: unknown[]) => publishPortfolioAction(...a),
  updateBrandKitAction: (...a: unknown[]) => updateBrandKitAction(...a),
  updateContactConfigAction: (...a: unknown[]) => updateContactConfigAction(...a),
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
  publicOrigin: "https://app.test",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EditorShell", () => {
  it("renders the editor with the workspace name + active zone in the title", () => {
    renderWithProviders(<EditorShell {...baseProps} />);
    expect(screen.getByTestId("puck-title")).toHaveTextContent("Studio Aurora · Home");
  });

  it("renders the zone switcher and switches the active zone", () => {
    renderWithProviders(<EditorShell {...baseProps} />);
    const galleryBtn = screen.getByRole("button", { name: "Gallery" });
    fireEvent.click(galleryBtn);
    expect(screen.getByTestId("puck-title")).toHaveTextContent("Studio Aurora · Gallery");
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

  it("opens the contact panel", () => {
    renderWithProviders(<EditorShell {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Contact" }));
    expect(screen.getByText("Contact form")).toBeInTheDocument();
  });

  it("shows the mobile banner notice", () => {
    renderWithProviders(<EditorShell {...baseProps} />);
    expect(
      screen.getByText("The editor works best on a larger screen")
    ).toBeInTheDocument();
  });
});
