import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadAsset, type AssetValidationConstraints } from "./uploadAsset.client";

function makeFile(type = "image/png", size = 1024): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], "asset.png", { type });
}

class MockImage {
  naturalWidth = 200;
  naturalHeight = 200;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_: string) {
    queueMicrotask(() => this.onload?.());
  }
}

const BASE_CONSTRAINTS: AssetValidationConstraints = {
  acceptedTypes: ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/avif"],
  maxBytes: 512 * 1024,
  maxWidth: 512,
  maxHeight: 512,
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubEnv("NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH", "testhash");
  vi.stubGlobal("Image", MockImage);
  vi.stubGlobal("URL", {
    createObjectURL: () => "blob:test",
    revokeObjectURL: () => {},
  });
});

describe("uploadAsset", () => {
  it("accepts the image/jpg MIME alias", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ imageId: "img123", uploadURL: "https://upload.example.com" }) })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadAsset(makeFile("image/jpg"), BASE_CONSTRAINTS);

    expect(result).toHaveProperty("asset");
  });

  it("rejects file with wrong MIME type", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadAsset(makeFile("image/gif"), BASE_CONSTRAINTS);

    expect(result).toEqual({
      error: "type_not_accepted",
      detail: { code: "type_not_accepted", mimeType: "image/gif", acceptedTypes: BASE_CONSTRAINTS.acceptedTypes },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects file over maxBytes, attaching the actual and max byte counts", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const bigFile = makeFile("image/png", 600 * 1024); // 600KB > 512KB limit
    const result = await uploadAsset(bigFile, BASE_CONSTRAINTS);

    expect(result).toEqual({
      error: "file_too_large",
      detail: { code: "file_too_large", actualBytes: 600 * 1024, maxBytes: BASE_CONSTRAINTS.maxBytes },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts an image exceeding maxWidth — dimensions are no longer enforced", async () => {
    vi.stubGlobal("Image", class WideImage extends MockImage {
      naturalWidth = 1000;
      naturalHeight = 200;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ imageId: "img_wide", uploadURL: "https://upload.example.com" }) })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadAsset(makeFile("image/png"), BASE_CONSTRAINTS);

    expect(result).toEqual({
      asset: {
        assetId: "img_wide",
        url: expect.stringContaining("img_wide"),
        width: 1000,
        height: 200,
      },
    });
  });

  it("accepts a rectangular image even when requireSquare is set — dimensions are no longer enforced", async () => {
    vi.stubGlobal("Image", class RectangularImage extends MockImage {
      naturalWidth = 200;
      naturalHeight = 160;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ imageId: "img_rect", uploadURL: "https://upload.example.com" }) })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadAsset(makeFile("image/png"), {
      ...BASE_CONSTRAINTS,
      requireSquare: true,
    });

    expect(result).toEqual({
      asset: {
        assetId: "img_rect",
        url: expect.stringContaining("img_rect"),
        width: 200,
        height: 160,
      },
    });
  });

  it("returns asset on success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imageId: "img123", uploadURL: "https://upload.example.com" }),
      })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadAsset(makeFile("image/png"), BASE_CONSTRAINTS);

    expect(result).toEqual({
      asset: {
        assetId: "img123",
        url: expect.stringContaining("img123"),
        width: 200,
        height: 200,
      },
    });

    const [step1Url, step1Init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(step1Url).toBe("/api/images/direct-upload");
    expect(step1Init.method).toBe("POST");
    expect(JSON.parse(step1Init.body as string)).toMatchObject({ subfolder: "assets" });

    const [step2Url, step2Init] = fetchMock.mock.calls[1] as [string, RequestInit & { body: FormData }];
    expect(step2Url).toBe("https://upload.example.com");
    expect(step2Init.method).toBe("POST");
    expect((step2Init.body as FormData).get("file")).toBeTruthy();
  });
});
