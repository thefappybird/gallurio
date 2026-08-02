import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cropToFile, outputName } from "./cropImage";
import type { CropSpec } from "./cropSpecs";

const spec: CropSpec = {
  aspect: 1,
  maxWidth: 512,
  maxHeight: 512,
  maxBytes: 10 * 1024 * 1024,
  acceptedTypes: ["image/png"],
};

let closeSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  closeSpy = vi.fn();
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 2000, height: 1000, close: closeSpy }))
  );
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    drawImage: vi.fn(),
  })) as never;
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(new Blob(["x"], { type: "image/webp" }));
  } as never;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cropToFile", () => {
  it("downscales to maxWidth preserving aspect", async () => {
    const file = new File(["x"], "photo.png", { type: "image/png" });
    const created: HTMLCanvasElement[] = [];
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "canvas") created.push(el as HTMLCanvasElement);
      return el;
    });

    await cropToFile(file, { x: 0, y: 0, width: 1000, height: 1000 }, spec, "out.webp");

    expect(created[0].width).toBe(512);
    expect(created[0].height).toBe(512);
  });

  it("never upscales a crop smaller than the caps", async () => {
    const file = new File(["x"], "photo.png", { type: "image/png" });
    const created: HTMLCanvasElement[] = [];
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "canvas") created.push(el as HTMLCanvasElement);
      return el;
    });

    await cropToFile(file, { x: 0, y: 0, width: 200, height: 100 }, spec, "out.webp");

    expect(created[0].width).toBe(200);
    expect(created[0].height).toBe(100);
  });

  it("outputs a webp File named per fileName", async () => {
    const file = new File(["x"], "photo.png", { type: "image/png" });

    const result = await cropToFile(file, { x: 0, y: 0, width: 1000, height: 1000 }, spec, "out.webp");

    expect(result.type).toBe("image/webp");
    expect(result.name.endsWith(".webp")).toBe(true);
  });

  it("passes the crop area as the drawImage source rect, scaled into the destination", async () => {
    const drawImage = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage })) as never;
    const file = new File(["x"], "photo.png", { type: "image/png" });

    await cropToFile(file, { x: 40, y: 60, width: 1000, height: 500 }, spec, "out.webp");

    expect(drawImage).toHaveBeenCalledTimes(1);
    const [, sx, sy, sw, sh, dx, dy, dw, dh] = drawImage.mock.calls[0];
    expect([sx, sy, sw, sh]).toEqual([40, 60, 1000, 500]);
    expect([dx, dy]).toEqual([0, 0]);
    // scale = min(1, 512/1000, 512/500) = 0.512
    expect(dw).toBe(512);
    expect(dh).toBe(256);
  });

  it("closes the decoded bitmap on the success path", async () => {
    const file = new File(["x"], "photo.png", { type: "image/png" });

    await cropToFile(file, { x: 0, y: 0, width: 1000, height: 1000 }, spec, "out.webp");

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it("closes the decoded bitmap even when canvas_unavailable throws", async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
    const file = new File(["x"], "photo.png", { type: "image/png" });

    await expect(
      cropToFile(file, { x: 0, y: 0, width: 1000, height: 1000 }, spec, "out.webp")
    ).rejects.toThrow("canvas_unavailable");

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it("labels the File with the encoder's actual output type, not a hardcoded webp", async () => {
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      cb(new Blob(["x"], { type: "image/png" }));
    } as never;
    const file = new File(["x"], "photo.png", { type: "image/png" });

    const result = await cropToFile(file, { x: 0, y: 0, width: 1000, height: 1000 }, spec, "out.webp");

    expect(result.type).toBe("image/png");
    expect(result.name.endsWith(".png")).toBe(true);
  });
});

describe("outputName", () => {
  it("strips the old extension and appends .webp", () => {
    expect(outputName("photo.png")).toBe("photo.webp");
    expect(outputName("")).toBe("image.webp");
  });
});
