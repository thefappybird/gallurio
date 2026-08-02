import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cropToFile, webpName } from "./cropImage";
import type { CropSpec } from "./cropSpecs";

const spec: CropSpec = {
  aspect: 1,
  maxWidth: 512,
  maxHeight: 512,
  maxBytes: 10 * 1024 * 1024,
  acceptedTypes: ["image/png"],
};

beforeEach(() => {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 2000, height: 1000, close: vi.fn() }))
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
});

describe("webpName", () => {
  it("strips the old extension and appends .webp", () => {
    expect(webpName("photo.png")).toBe("photo.webp");
    expect(webpName("")).toBe("image.webp");
  });
});
