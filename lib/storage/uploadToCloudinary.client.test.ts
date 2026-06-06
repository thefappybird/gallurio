import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadImageToCloudinary } from "./uploadToCloudinary.client";

function makeFile(type = "image/png", size = 1024): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], "upload.png", { type });
}

describe("uploadImageToCloudinary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("skips gallery dimension validation when requested", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          signature: "sig",
          timestamp: 123,
          apiKey: "key",
          cloudName: "demo-cloud",
          folder: "gallurio/ws1/portfolio_header",
          allowedFormats: "jpg,jpeg,png,webp,avif",
          uploadUrl: "https://api.cloudinary.com/v1_1/demo-cloud/auto/upload",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          secure_url: "https://res.cloudinary.com/demo-cloud/logo.png",
          public_id: "gallurio/ws1/portfolio_header/logo",
          width: 512,
          height: 256,
          format: "png",
          bytes: 2048,
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadImageToCloudinary(makeFile(), {
        subfolder: "portfolio_header",
        validateDimensions: false,
      }),
    ).resolves.toEqual({
      cloudinaryPublicId: "gallurio/ws1/portfolio_header/logo",
      url: "https://res.cloudinary.com/demo-cloud/logo.png",
      width: 512,
      height: 256,
      format: "png",
      sizeBytes: 2048,
    });
  });

  it("still enforces gallery dimension validation by default", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          signature: "sig",
          timestamp: 123,
          apiKey: "key",
          cloudName: "demo-cloud",
          folder: "gallurio/ws1/portfolio",
          allowedFormats: "jpg,jpeg,png,webp,avif",
          uploadUrl: "https://api.cloudinary.com/v1_1/demo-cloud/auto/upload",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          secure_url: "https://res.cloudinary.com/demo-cloud/photo.png",
          public_id: "gallurio/ws1/portfolio/photo",
          width: 512,
          height: 256,
          format: "png",
          bytes: 2048,
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(uploadImageToCloudinary(makeFile())).rejects.toThrow("dimension_too_small");
  });
});
