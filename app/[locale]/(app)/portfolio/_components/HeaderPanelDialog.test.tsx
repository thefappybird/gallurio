import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { HeaderPanelDialog } from "./HeaderPanelDialog";
import { DEFAULT_BRAND_KIT, type PortfolioHeaderConfig } from "@/lib/page-builder/types";
import { uploadImage } from "@/lib/storage/uploadImage.client";

const updateHeaderConfigAction = vi.fn().mockResolvedValue({ ok: true });
vi.mock("../_actions", () => ({
  updateHeaderConfigAction: (...args: unknown[]) => updateHeaderConfigAction(...args),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/storage/uploadImage.client", () => ({
  uploadImage: vi.fn(),
}));

const baseProps = {
  header: {} satisfies PortfolioHeaderConfig,
  onHeaderChange: vi.fn(),
  brandKit: DEFAULT_BRAND_KIT,
  workspaceName: "Studio Aurora",
  onSaved: vi.fn(),
  onCancel: vi.fn(),
};

function installImageMock(width = 128, height = 64) {
  vi.stubGlobal(
    "Image",
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = width;
      naturalHeight = height;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    },
  );
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:logo"),
    revokeObjectURL: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  installImageMock();
});

describe("HeaderPanelDialog", () => {
  it("uses CF Images direct upload for logo uploads", async () => {
    vi.mocked(uploadImage).mockResolvedValueOnce({
      url: "https://imagedelivery.net/test-hash/logo-asset-id/public",
      assetId: "logo-asset-id",
      width: 200,
      height: 80,
      format: "png",
      sizeBytes: 4096,
    });

    const onHeaderChange = vi.fn();
    const { container } = renderWithProviders(
      <HeaderPanelDialog {...baseProps} onHeaderChange={onHeaderChange} />,
    );

    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(["logo"], "logo.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(uploadImage).toHaveBeenCalledWith(file, {
        subfolder: "portfolio_header",
      }),
    );
    expect(onHeaderChange).toHaveBeenCalledWith({
      logoUrl: "https://imagedelivery.net/test-hash/logo-asset-id/public",
      logoPublicId: "logo-asset-id",
    });
  });

  it("shows a specific error for invalid logo file size", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { container } = renderWithProviders(<HeaderPanelDialog {...baseProps} />);

    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File([new Uint8Array(251 * 1024)], "logo.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("Logo must be 250 KB or smaller.")).toBeInTheDocument();
  });

  it("renders design groups as collapsed drawers", () => {
    renderWithProviders(<HeaderPanelDialog {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));

    const banner = screen.getByRole("button", { name: "Banner" });
    expect(banner).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Background color")).not.toBeInTheDocument();

    fireEvent.click(banner);
    expect(banner).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Background color")).toBeInTheDocument();
  });

  it("does not render Done or Cancel footer buttons", () => {
    renderWithProviders(<HeaderPanelDialog {...baseProps} />);

    expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("shows limits copy near the logo uploader", () => {
    renderWithProviders(<HeaderPanelDialog {...baseProps} />);
    expect(screen.getByText("PNG, JPEG or WEBP · max 250 KB · up to 512×256")).toBeInTheDocument();
  });

  it("shows inline role=alert error for oversized file (dimension violation)", async () => {
    installImageMock(600, 300); // exceeds 512x256
    const { container } = renderWithProviders(<HeaderPanelDialog {...baseProps} />);
    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(["img"], "big.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Logo must be 512 x 256 px or smaller.");
  });

  it("rejects SVG with an inline role=alert type error", async () => {
    const { container } = renderWithProviders(<HeaderPanelDialog {...baseProps} />);
    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const svgFile = new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" });
    fireEvent.change(input, { target: { files: [svgFile] } });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Logo must be a PNG, JPEG, or WEBP image.");
  });

  it("keeps navbar size on Setup and heading color on Design", () => {
    renderWithProviders(<HeaderPanelDialog {...baseProps} />);

    expect(screen.getByText("Navbar size")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Links" }));

    expect(screen.getByText("Heading color")).toBeInTheDocument();
    expect(screen.queryAllByText("Navbar size")).toHaveLength(0);
  });

  it("custom color picker commits every change immediately (shared ColorSwatchRow has no debounce)", () => {
    const onHeaderChange = vi.fn();
    renderWithProviders(<HeaderPanelDialog {...baseProps} onHeaderChange={onHeaderChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Banner" }));

    const colorInput = screen.getByLabelText("Pick custom color");

    fireEvent.change(colorInput, { target: { value: "#ff0000" } });
    fireEvent.change(colorInput, { target: { value: "#ffcc00" } });

    // Each change fires immediately — two commits, last one is the final color
    const hexCalls = onHeaderChange.mock.calls.filter((c) =>
      JSON.stringify(c[0]).includes("#ff"),
    );
    expect(hexCalls).toHaveLength(2);
    expect(onHeaderChange).toHaveBeenLastCalledWith({ backgroundColor: "#ffcc00" });
  });

  it("link-color row shows foreground swatch as aria-pressed when linkColor is unset (effective default)", () => {
    // With linkColor unset, PortfolioHeader falls back to var(--pf-color-fg) — "foreground".
    // The shared ColorSwatchRow must reflect this via effectiveValue="foreground".
    renderWithProviders(<HeaderPanelDialog {...baseProps} header={{} satisfies PortfolioHeaderConfig} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Links" }));

    // The "Text" swatch (foreground token) in the link-color row should be aria-pressed
    const foregroundSwatches = screen.getAllByRole("button", { name: "Text" });
    // First foreground swatch in the Links section (link color row)
    expect(foregroundSwatches[0]).toHaveAttribute("aria-pressed", "true");
  });

  it("shows percent suffixes for opacity controls", () => {
    renderWithProviders(
      <HeaderPanelDialog
        {...baseProps}
        header={{ activeLinkHighlight: true } satisfies PortfolioHeaderConfig}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Design" }));

    fireEvent.click(screen.getByRole("button", { name: "Banner" }));
    let spinbuttons = screen.getAllByRole("spinbutton");
    expect(spinbuttons[0]?.parentElement).toHaveTextContent("%");
    expect(spinbuttons[0]?.parentElement).not.toHaveTextContent("px");

    fireEvent.click(screen.getByRole("button", { name: "Active link style" }));
    spinbuttons = screen.getAllByRole("spinbutton");
    expect(spinbuttons[0]?.parentElement).toHaveTextContent("%");
    expect(spinbuttons[0]?.parentElement).not.toHaveTextContent("px");

    fireEvent.click(screen.getByRole("button", { name: "Contact button" }));
    spinbuttons = screen.getAllByRole("spinbutton");
    expect(spinbuttons[0]?.parentElement).toHaveTextContent("%");
    expect(spinbuttons[0]?.parentElement).not.toHaveTextContent("px");
  });
});
