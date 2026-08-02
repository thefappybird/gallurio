import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { ImageCropperDialog } from "./image-cropper-dialog";
import { CROP_SPECS } from "@/lib/media/cropSpecs";

vi.mock("@/lib/media/cropImage", () => ({
  cropToFile: vi.fn(() => new Promise(() => {})),
  outputName: (name: string) => name.replace(/\.[^.]+$/, ".webp"),
}));

vi.mock("react-easy-crop", async () => {
  const { useEffect } = await import("react");
  function MockCropper({
    onCropComplete,
    onMediaLoaded,
    cropShape,
    cropperProps,
  }: {
    onCropComplete?: (a: unknown, b: unknown) => void;
    onMediaLoaded?: (size: { width: number; height: number; naturalWidth: number; naturalHeight: number }) => void;
    cropShape?: string;
    cropperProps?: { "aria-label"?: string };
  }) {
    // Real react-easy-crop only fires after mount (async media measurement);
    // fire on a timer so it lands strictly after all mount-time effects,
    // matching real-world timing (image load is async).
    useEffect(() => {
      const id = setTimeout(() => {
        onMediaLoaded?.({ width: 100, height: 100, naturalWidth: 100, naturalHeight: 100 });
        onCropComplete?.({ x: 0, y: 0, width: 100, height: 100 }, { x: 0, y: 0, width: 100, height: 100 });
      }, 0);
      return () => clearTimeout(id);
    }, [onCropComplete, onMediaLoaded]);
    return (
      <div
        data-testid="cropper-stub"
        data-crop-shape={cropShape}
        role="application"
        aria-label={cropperProps?.["aria-label"]}
      />
    );
  }
  return { default: MockCropper };
});

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

describe("ImageCropperDialog", () => {
  it("renders title, description, zoom slider, cancel and upload controls", () => {
    const file = new File(["x"], "photo.png", { type: "image/png" });
    renderWithProviders(
      <ImageCropperDialog
        file={file}
        spec={CROP_SPECS.avatar}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText("Crop image")).toBeInTheDocument();
    expect(screen.getByText(/Frame your image at 1:1/)).toBeInTheDocument();
    expect(screen.getByLabelText("Zoom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
  });

  it("fires onCancel when the Cancel button is clicked", () => {
    const onCancel = vi.fn();
    const file = new File(["x"], "photo.png", { type: "image/png" });
    renderWithProviders(
      <ImageCropperDialog file={file} spec={CROP_SPECS.avatar} onCancel={onCancel} onConfirm={vi.fn()} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("passes cropShape=round for a round spec", () => {
    const file = new File(["x"], "photo.png", { type: "image/png" });
    renderWithProviders(
      <ImageCropperDialog file={file} spec={CROP_SPECS.avatar} onCancel={vi.fn()} onConfirm={vi.fn()} />
    );

    expect(screen.getByTestId("cropper-stub")).toHaveAttribute("data-crop-shape", "round");
  });

  it("disables Upload while encoding", async () => {
    const file = new File(["x"], "photo.png", { type: "image/png" });
    renderWithProviders(
      <ImageCropperDialog file={file} spec={CROP_SPECS.avatar} onCancel={vi.fn()} onConfirm={vi.fn()} />
    );

    const uploadBtn = await screen.findByRole("button", { name: "Upload", hidden: false });
    await waitFor(() => expect(uploadBtn).not.toBeDisabled());
    fireEvent.click(uploadBtn);

    expect(await screen.findByRole("button", { name: "Uploading…" })).toBeDisabled();
  });

  it("surfaces the cropFailed alert and keeps the dialog open when cropToFile rejects", async () => {
    const { cropToFile } = await import("@/lib/media/cropImage");
    vi.mocked(cropToFile).mockRejectedValueOnce(new Error("InvalidStateError"));
    const onConfirm = vi.fn();
    const file = new File(["x"], "report.png", { type: "image/png" });
    renderWithProviders(
      <ImageCropperDialog file={file} spec={CROP_SPECS.avatar} onCancel={vi.fn()} onConfirm={onConfirm} />
    );

    const uploadBtn = await screen.findByRole("button", { name: "Upload", hidden: false });
    await waitFor(() => expect(uploadBtn).not.toBeDisabled());
    fireEvent.click(uploadBtn);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That image couldn't be processed. Try a different file."
    );
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
  });

  it("shows a loading indicator until the media reports loaded, and hides it after", async () => {
    const file = new File(["x"], "photo.png", { type: "image/png" });
    renderWithProviders(
      <ImageCropperDialog file={file} spec={CROP_SPECS.avatar} onCancel={vi.fn()} onConfirm={vi.fn()} />
    );

    expect(screen.getByText("Loading image…")).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByText("Loading image…")).not.toBeInTheDocument());
  });

  it("gives the crop surface an accessible name for keyboard users", async () => {
    const file = new File(["x"], "photo.png", { type: "image/png" });
    renderWithProviders(
      <ImageCropperDialog file={file} spec={CROP_SPECS.avatar} onCancel={vi.fn()} onConfirm={vi.fn()} />
    );

    expect(
      screen.getByLabelText("Crop area. Drag to reposition, or use the arrow keys.")
    ).toBeInTheDocument();
  });
});
