import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { HeaderPanelDialog } from "./HeaderPanelDialog";
import { DEFAULT_BRAND_KIT, type PortfolioHeaderConfig } from "@/lib/page-builder/types";
import { uploadImageToCloudinary } from "@/lib/storage/uploadToCloudinary.client";

const updateHeaderConfigAction = vi.fn().mockResolvedValue({ ok: true });
vi.mock("../_actions", () => ({
  updateHeaderConfigAction: (...args: unknown[]) => updateHeaderConfigAction(...args),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/storage/uploadToCloudinary.client", () => ({
  uploadImageToCloudinary: vi.fn(),
}));

import { toast } from "sonner";

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
  it("uses the signed Cloudinary uploadUrl for logo uploads", async () => {
    vi.mocked(uploadImageToCloudinary).mockResolvedValueOnce({
      url: "https://res.cloudinary.com/demo-cloud/logo.png",
      cloudinaryPublicId: "gallurio/ws1/portfolio/header/logo",
    });

    const onHeaderChange = vi.fn();
    const { container } = renderWithProviders(
      <HeaderPanelDialog {...baseProps} onHeaderChange={onHeaderChange} />,
    );

    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(["logo"], "logo.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(uploadImageToCloudinary).toHaveBeenCalledWith(file, {
        subfolder: "portfolio_header",
        validateDimensions: false,
      }),
    );
    expect(onHeaderChange).toHaveBeenCalledWith({
      logoUrl: "https://res.cloudinary.com/demo-cloud/logo.png",
      logoPublicId: "gallurio/ws1/portfolio/header/logo",
    });
  });

  it("shows a specific error for invalid logo file size", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { container } = renderWithProviders(<HeaderPanelDialog {...baseProps} />);

    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File([new Uint8Array(251 * 1024)], "logo.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Logo must be 250 KB or smaller."));
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
});
