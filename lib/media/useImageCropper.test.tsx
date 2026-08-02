import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { useImageCropper, type CropRequestResult } from "./useImageCropper";
import { CROP_SPECS } from "./cropSpecs";
import type { CropSpec } from "./cropSpecs";

function Harness({
  spec,
  onResult,
}: {
  spec: CropSpec;
  onResult: (r: CropRequestResult) => void;
}) {
  const { cropDialog, requestCrop } = useImageCropper(spec);
  return (
    <div>
      <button
        onClick={() => {
          const file = new File(["x"], "photo.png", { type: "image/png" });
          requestCrop(file).then(onResult);
        }}
      >
        trigger
      </button>
      {cropDialog}
    </div>
  );
}

vi.mock("react-easy-crop", async () => {
  const { useEffect } = await import("react");
  function MockCropper({ onCropComplete }: { onCropComplete?: (a: unknown, b: unknown) => void }) {
    // Fire after mount (real react-easy-crop only reports post-measurement);
    // calling onCropComplete synchronously during render would setState on
    // the parent mid-render and loop forever.
    useEffect(() => {
      const id = setTimeout(() => {
        onCropComplete?.({ x: 0, y: 0, width: 100, height: 100 }, { x: 0, y: 0, width: 100, height: 100 });
      }, 0);
      return () => clearTimeout(id);
    }, [onCropComplete]);
    return <div data-testid="cropper-stub" />;
  }
  return { default: MockCropper };
});

vi.mock("@/lib/media/cropImage", () => ({
  cropToFile: vi.fn(async (_file, _area, _spec, name: string) => new File(["x"], name, { type: "image/webp" })),
  outputName: (name: string) => name.replace(/\.[^.]+$/, ".webp"),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <NextIntlClientProvider locale="en" messages={enMessages}>{children}</NextIntlClientProvider>;
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

describe("useImageCropper", () => {
  it("resolves cancelled when the dialog is cancelled", async () => {
    const { result, rerender } = renderHook(() => useImageCropper(CROP_SPECS.avatar), { wrapper });
    const file = new File(["x"], "photo.png", { type: "image/png" });

    let promise!: ReturnType<typeof result.current.requestCrop>;
    act(() => {
      promise = result.current.requestCrop(file);
    });
    rerender();

    // simulate cancel via the dialog's onCancel — invoked through the rendered node's props
    // is not directly accessible here; call cancel path by re-requesting with no pending crop
    // instead assert via the exposed cropDialog element's onCancel prop.
    const dialogEl = result.current.cropDialog as React.ReactElement<{ onCancel: () => void }>;
    act(() => {
      dialogEl.props.onCancel();
    });

    await expect(promise).resolves.toEqual({ status: "cancelled" });
  });

  it("resolves ok with the cropped File on confirm", async () => {
    const onResult = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <Harness spec={CROP_SPECS.avatar} onResult={onResult} />
      </NextIntlClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "trigger" }));

    const uploadBtn = await screen.findByRole("button", { name: "Upload" });
    await waitFor(() => expect(uploadBtn).not.toBeDisabled());
    fireEvent.click(uploadBtn);

    await waitFor(() => expect(onResult).toHaveBeenCalledWith({ status: "ok", file: expect.any(File) }));
    const result = onResult.mock.calls[0][0] as { status: string; file: File };
    expect(result.file.name.endsWith(".webp")).toBe(true);
  });

  it("resolves ok with the same File for an svg without opening the dialog", async () => {
    const { result } = renderHook(() => useImageCropper(CROP_SPECS.workspaceLogo), { wrapper });
    const svgFile = new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" });

    let outcome!: CropRequestResult;
    await act(async () => {
      outcome = await result.current.requestCrop(svgFile);
    });

    expect(outcome).toEqual({ status: "ok", file: svgFile });
  });

  it("resolves file_too_large for an oversized file without opening the dialog", async () => {
    const { result } = renderHook(() => useImageCropper(CROP_SPECS.workspaceLogo), { wrapper });
    const bigFile = new File([new Uint8Array(CROP_SPECS.workspaceLogo.maxBytes + 1)], "logo.png", {
      type: "image/png",
    });

    let outcome!: CropRequestResult;
    await act(async () => {
      outcome = await result.current.requestCrop(bigFile);
    });

    expect(outcome).toEqual({ status: "error", reason: "file_too_large" });
  });

  it("resolves type_not_accepted for a bad MIME without opening the dialog", async () => {
    const { result } = renderHook(() => useImageCropper(CROP_SPECS.workspaceLogo), { wrapper });
    const badFile = new File(["x"], "clip.mp4", { type: "video/mp4" });

    let outcome!: CropRequestResult;
    await act(async () => {
      outcome = await result.current.requestCrop(badFile);
    });

    expect(outcome).toEqual({ status: "error", reason: "type_not_accepted" });
  });

  it("clears the pending dialog when a superseding request fails validation", async () => {
    const { result, rerender } = renderHook(() => useImageCropper(CROP_SPECS.workspaceLogo), { wrapper });
    const goodFile = new File(["x"], "photo.png", { type: "image/png" });
    const badFile = new File(["x"], "clip.mp4", { type: "video/mp4" });

    let firstPromise!: ReturnType<typeof result.current.requestCrop>;
    act(() => {
      firstPromise = result.current.requestCrop(goodFile);
    });
    rerender();

    let secondOutcome!: CropRequestResult;
    await act(async () => {
      secondOutcome = await result.current.requestCrop(badFile);
    });
    rerender();

    await expect(firstPromise).resolves.toEqual({ status: "cancelled" });
    expect(secondOutcome).toEqual({ status: "error", reason: "type_not_accepted" });
    const dialogEl = result.current.cropDialog as React.ReactElement<{ file: File | null }>;
    expect(dialogEl.props.file).toBeNull();
  });
});
