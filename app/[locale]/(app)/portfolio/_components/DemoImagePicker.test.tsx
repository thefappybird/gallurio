import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { DemoMultiImageControl } from "./DemoImagePicker";
import { DemoPickerContext } from "@/lib/page-builder/demoPickerContext";
import { writeDemoImageLibrary } from "@/lib/page-builder/demoSession";
import { uploadDemoImage } from "@/lib/storage/uploadDemoImage.client";

vi.mock("@/lib/storage/uploadDemoImage.client", () => ({
  uploadDemoImage: vi.fn(),
}));

const SESSION_ID = "test-session";

function renderWithDemoCtx(ui: React.ReactElement, onImageCapHit = vi.fn()) {
  return renderWithProviders(
    <DemoPickerContext.Provider value={{ demoSessionId: SESSION_ID, onImageCapHit }}>
      {ui}
    </DemoPickerContext.Provider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(uploadDemoImage).mockReset();
});

describe("DemoImagePicker", () => {
  it("renders images already uploaded this demo session", async () => {
    writeDemoImageLibrary(SESSION_ID, [
      { id: "img1", publicId: "img1", url: "https://cf.test/img1", width: 800, height: 600 },
    ]);

    renderWithDemoCtx(<DemoMultiImageControl value={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /choose photos/i }));

    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(dialog.querySelectorAll('img[src="https://cf.test/img1"]')).toHaveLength(1);
    });
  });

  it("uploading a new image adds it to the grid and persists it to the session library", async () => {
    vi.mocked(uploadDemoImage).mockResolvedValue({
      ok: true,
      image: { assetId: "img-new", url: "https://cf.test/img-new", width: 900, height: 700 },
    });
    const onChange = vi.fn();

    renderWithDemoCtx(<DemoMultiImageControl value={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /choose photos/i }));

    const dialog = await screen.findByRole("dialog");
    const fileInput = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "photo.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(dialog.querySelectorAll('img[src="https://cf.test/img-new"]')).toHaveLength(1);
    });
    expect(onChange).toHaveBeenCalledWith([{ id: "img-new", publicId: "img-new", width: 900, height: 700 }]);

    const { readDemoImageLibrary } = await import("@/lib/page-builder/demoSession");
    expect(readDemoImageLibrary(SESSION_ID).some((i) => i.id === "img-new")).toBe(true);
  });

  it("hitting the image cap calls onImageCapHit and closes the dialog, without opening a plain error", async () => {
    vi.mocked(uploadDemoImage).mockResolvedValue({ ok: false, error: "image_cap_reached" });
    const onImageCapHit = vi.fn();

    renderWithDemoCtx(<DemoMultiImageControl value={[]} onChange={vi.fn()} />, onImageCapHit);
    fireEvent.click(screen.getByRole("button", { name: /choose photos/i }));

    const dialog = await screen.findByRole("dialog");
    const fileInput = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "photo.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(onImageCapHit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("respects max in multi mode — selecting past the cap is a no-op", async () => {
    writeDemoImageLibrary(SESSION_ID, [
      { id: "img1", publicId: "img1", url: "https://cf.test/img1" },
      { id: "img2", publicId: "img2", url: "https://cf.test/img2" },
    ]);
    const onChange = vi.fn();

    renderWithDemoCtx(
      <DemoMultiImageControl
        value={[{ id: "img1", publicId: "img1" }]}
        onChange={onChange}
        max={1}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /choose photos/i }));

    const dialog = await screen.findByRole("dialog");
    const unselectedThumb = dialog.querySelector('img[src="https://cf.test/img2"]')!
      .closest("button") as HTMLButtonElement;
    expect(unselectedThumb).toBeDisabled();

    fireEvent.click(unselectedThumb);
    expect(onChange).not.toHaveBeenCalled();
  });
});
