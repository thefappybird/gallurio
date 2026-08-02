import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { HeaderPanelDialog } from "./HeaderPanelDialog";
import { DEFAULT_BRAND_KIT, type PortfolioHeaderConfig } from "@/lib/page-builder/types";
import { uploadImage } from "@/lib/storage/uploadImage.client";
import { uploadAsset } from "@/lib/storage/uploadAsset.client";
import { useImageCropper } from "@/lib/media/useImageCropper";
import { PORTFOLIO_TEMPLATES } from "@/lib/page-builder/templates";

const updateHeaderConfigAction = vi.fn().mockResolvedValue({ ok: true });
vi.mock("../_actions", () => ({
  updateHeaderConfigAction: (...args: unknown[]) => updateHeaderConfigAction(...args),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/storage/uploadImage.client", () => ({
  uploadImage: vi.fn(),
}));
vi.mock("@/lib/storage/uploadAsset.client", () => ({
  uploadAsset: vi.fn(),
}));
vi.mock("@/lib/media/useImageCropper", () => ({
  useImageCropper: vi.fn(() => ({
    cropDialog: null,
    requestCrop: vi.fn(async (file: File) => ({ status: "ok", file })),
  })),
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
  it("uses CF Images direct upload for logo uploads via uploadAsset", async () => {
    vi.mocked(uploadAsset).mockResolvedValueOnce({
      asset: {
        assetId: "logo-asset-id",
        url: "https://imagedelivery.net/test-hash/logo-asset-id/public",
        width: 200,
        height: 80,
      },
    });

    const onHeaderChange = vi.fn();
    const { container } = renderWithProviders(
      <HeaderPanelDialog {...baseProps} onHeaderChange={onHeaderChange} />,
    );

    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(["logo"], "logo.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(uploadAsset).toHaveBeenCalled());
    expect(uploadImage).not.toHaveBeenCalled();
    expect(onHeaderChange).toHaveBeenCalledWith(
      expect.objectContaining({
        logoUrl: "https://imagedelivery.net/test-hash/logo-asset-id/public",
        logoAssetId: "logo-asset-id",
      }),
    );
  });

  it("shows a specific error for invalid logo file size", async () => {
    vi.mocked(uploadAsset).mockResolvedValueOnce({ error: "file_too_large" });
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
    vi.mocked(uploadAsset).mockResolvedValueOnce({ error: "dimensions_too_large" });
    const { container } = renderWithProviders(<HeaderPanelDialog {...baseProps} />);
    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(["img"], "big.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Logo must be 512 x 256 px or smaller.");
  });

  it("rejects SVG with an inline role=alert type error", async () => {
    vi.mocked(uploadAsset).mockResolvedValueOnce({ error: "type_not_accepted" });
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

  it("floats the rendered 1px banner border default", () => {
    renderWithProviders(<HeaderPanelDialog {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Banner" }));
    expect(
      screen.getAllByRole("spinbutton").some(
        (input) => input.getAttribute("placeholder") === "1",
      ),
    ).toBe(true);
  });

  it("floats the rendered accent underline color default", () => {
    renderWithProviders(<HeaderPanelDialog {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Links" }));
    fireEvent.click(screen.getByRole("button", { name: "Active link style" }));
    const row = screen.getByText("Underline color").parentElement!;
    expect(within(row).getByRole("button", { name: "Accent" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("floats the rendered 8% default active-link highlight opacity", () => {
    renderWithProviders(
      <HeaderPanelDialog
        {...baseProps}
        header={{ activeLinkHighlight: true }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Links" }));
    fireEvent.click(screen.getByRole("button", { name: "Active link style" }));
    expect(screen.getByRole("spinbutton")).toHaveAttribute("placeholder", "8");
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

    // Active link style is now a sub-section nested inside Links (B3 reorg).
    fireEvent.click(screen.getByRole("button", { name: "Links" }));
    fireEvent.click(screen.getByRole("button", { name: "Active link style" }));
    spinbuttons = screen.getAllByRole("spinbutton");
    expect(spinbuttons[0]?.parentElement).toHaveTextContent("%");
    expect(spinbuttons[0]?.parentElement).not.toHaveTextContent("px");

    fireEvent.click(screen.getByRole("button", { name: "Contact button" }));
    spinbuttons = screen.getAllByRole("spinbutton");
    expect(spinbuttons[0]?.parentElement).toHaveTextContent("%");
    expect(spinbuttons[0]?.parentElement).not.toHaveTextContent("px");
  });

  // C2: underline toggle — effective default ON (undefined → shows as lighter-active)
  it("underline toggle uses same selected fill when unset effective default is on", () => {
    const onHeaderChange = vi.fn();
    renderWithProviders(
      <HeaderPanelDialog
        {...baseProps}
        header={{} satisfies PortfolioHeaderConfig}
        onHeaderChange={onHeaderChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    // Active link style is now a sub-section nested inside Links (B3 reorg).
    fireEvent.click(screen.getByRole("button", { name: "Links" }));
    fireEvent.click(screen.getByRole("button", { name: "Active link style" }));

    const underlineBtn = screen.getByRole("button", { name: /underline/i });
    // aria-pressed=true when effective default is active
    expect(underlineBtn).toHaveAttribute("aria-pressed", "true");
    expect(underlineBtn).toHaveClass("bg-foreground");
    expect(underlineBtn).toHaveClass("text-background");
    expect(underlineBtn).not.toHaveClass("opacity-70");
    // Clicking sets it to false (explicit off)
    fireEvent.click(underlineBtn);
    expect(onHeaderChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ activeLinkUnderline: false }),
    );
  });

  // B3: activeLinkColor lives in the "Active link style" sub-section, nested inside the
  // Links drawer alongside "Inactive links" — mirrors the Inactive links sub-section
  // structure rather than sitting as its own top-level drawer.
  it("activeLinkColor control is inside the Active link style sub-section under Links", () => {
    renderWithProviders(<HeaderPanelDialog {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Links" }));

    // Before opening Active link style, the label must not be visible
    expect(screen.queryByText("Active link text color")).not.toBeInTheDocument();

    // After opening, label becomes visible
    fireEvent.click(screen.getByRole("button", { name: "Active link style" }));
    expect(screen.getByText("Active link text color")).toBeInTheDocument();
  });

  // Task 11: linkColor must live in the Inactive links sub-drawer inside Links
  it("linkColor control is inside the Inactive links sub-section", () => {
    renderWithProviders(<HeaderPanelDialog {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Links" }));

    // Before opening Inactive links, "Link text color" must not be visible
    expect(screen.queryByText("Link text color")).not.toBeInTheDocument();

    // After opening Inactive links sub-section, label becomes visible
    fireEvent.click(screen.getByRole("button", { name: "Inactive links" }));
    expect(screen.getByText("Link text color")).toBeInTheDocument();
  });

  // Bug #8 regression: uploadImage enforces validatePhotoDimensions(minShortSide=600),
  // which rejects ALL valid logos (≤512×256px) before any network request. The fix
  // switches to uploadAsset which accepts caller-supplied max-dimension constraints.
  it("calls uploadAsset (not uploadImage) for a valid small logo — bug #8 regression", async () => {
    vi.mocked(uploadAsset).mockResolvedValueOnce({
      asset: {
        assetId: "logo-asset-id",
        url: "https://imagedelivery.net/hash/logo-asset-id/public",
        width: 128,
        height: 64,
      },
    });

    const onHeaderChange = vi.fn();
    const { container } = renderWithProviders(
      <HeaderPanelDialog {...baseProps} onHeaderChange={onHeaderChange} />,
    );

    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(["logo"], "logo.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(uploadAsset).toHaveBeenCalled());
    expect(uploadImage).not.toHaveBeenCalled();
    expect(onHeaderChange).toHaveBeenCalledWith(
      expect.objectContaining({
        logoUrl: "https://imagedelivery.net/hash/logo-asset-id/public",
        logoAssetId: "logo-asset-id",
      }),
    );
  });

  it("hands the cropped file (not the original) to uploadAsset for the logo", async () => {
    vi.mocked(useImageCropper).mockReturnValueOnce({
      cropDialog: null,
      requestCrop: vi.fn(async () => ({
        status: "ok" as const,
        file: new File(["cropped"], "cropped.webp", { type: "image/webp" }),
      })),
    });
    vi.mocked(uploadAsset).mockResolvedValueOnce({
      asset: {
        assetId: "logo-cropped",
        url: "https://imagedelivery.net/test-hash/logo-cropped/public",
      },
    });

    const { container } = renderWithProviders(<HeaderPanelDialog {...baseProps} />);

    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(["logo"], "logo.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(uploadAsset).toHaveBeenCalledWith(
        expect.objectContaining({ name: "cropped.webp", type: "image/webp" }),
        expect.anything(),
        expect.anything(),
      ),
    );
  });

  // Task 12: active toggle in the Active link style section must use charcoal (bg-foreground)
  it("active scale toggle in Active link style renders with bg-foreground (charcoal) class", () => {
    renderWithProviders(
      <HeaderPanelDialog
        {...baseProps}
        header={{ activeLinkScale: true } satisfies PortfolioHeaderConfig}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    // Active link style is now a sub-section nested inside Links (B3 reorg).
    fireEvent.click(screen.getByRole("button", { name: "Links" }));
    fireEvent.click(screen.getByRole("button", { name: "Active link style" }));

    const scaleBtn = screen.getByRole("button", { name: "Scale" });
    expect(scaleBtn).toHaveClass("bg-foreground");
    expect(scaleBtn).toHaveClass("text-background");
  });
});

describe("HeaderPanelDialog template active-link parity", () => {
  it.each(PORTFOLIO_TEMPLATES)(
    "$id floats the same active-link toggles and colors that the public header renders",
    (template) => {
      const header = template.defaultHeader;
      renderWithProviders(
        <HeaderPanelDialog {...baseProps} header={header} />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Design" }));
      fireEvent.click(screen.getByRole("button", { name: "Links" }));
      fireEvent.click(screen.getByRole("button", { name: "Active link style" }));

      expect(screen.getByRole("button", { name: "Scale" })).toHaveAttribute(
        "aria-pressed",
        String(Boolean(header.activeLinkScale)),
      );
      expect(screen.getByRole("button", { name: "Highlight" })).toHaveAttribute(
        "aria-pressed",
        String(Boolean(header.activeLinkHighlight)),
      );
      expect(screen.getByRole("button", { name: "Underline" })).toHaveAttribute(
        "aria-pressed",
        String(header.activeLinkUnderline !== false),
      );

      const activeColorRow = screen.getByText("Active link text color").parentElement!;
      expect(
        within(activeColorRow).getByRole("button", { name: "Text" }),
      ).toHaveAttribute("aria-pressed", "true");

      if (header.activeLinkUnderline !== false) {
        const underlineRow = screen.getByText("Underline color").parentElement!;
        expect(
          within(underlineRow).getByRole("button", { name: "Accent" }),
        ).toHaveAttribute("aria-pressed", "true");
      }

      if (header.activeLinkHighlight) {
        expect(
          screen.getAllByRole("spinbutton").some(
            (input) =>
              input.getAttribute("value") === String(header.highlightOpacity) ||
              input.getAttribute("placeholder") === String(header.highlightOpacity ?? 8),
          ),
        ).toBe(true);
      }
    },
  );
});
