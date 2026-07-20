import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadImage } from "./uploadImage.client";

function makeFile(type = "image/png", size = 1024): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], "photo.png", { type });
}

class MockImage {
  naturalWidth = 1200;
  naturalHeight = 800;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_: string) {
    queueMicrotask(() => this.onload?.());
  }
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubEnv("NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH", "testhash");
  vi.stubGlobal("Image", MockImage);
  vi.stubGlobal("URL", {
    createObjectURL: () => "blob:test",
    revokeObjectURL: () => {},
  });
});

const directUploadBody = { imageId: "img_new", uploadURL: "https://upload.cf.test/one-time/xyz" };

describe("uploadImage", () => {
  it("requests a direct-upload URL, uploads file to uploadURL, and returns assetId", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => directUploadBody })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadImage(makeFile(), { subfolder: "gallery" });

    expect(result.assetId).toBe("img_new");
    expect(result.url).toContain("imagedelivery.net");
    expect(result.width).toBe(1200);
    expect(result.height).toBe(800);
    expect(result.format).toBe("png");

    // First call: direct-upload endpoint
    const [step1Url, step1Init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(step1Url).toBe("/api/images/direct-upload");
    expect(step1Init.method).toBe("POST");
    expect(JSON.parse(step1Init.body as string)).toMatchObject({ subfolder: "gallery" });

    // Second call: upload to the one-time CF URL
    const [step2Url, step2Init] = fetchMock.mock.calls[1] as [string, RequestInit & { body: FormData }];
    expect(step2Url).toBe("https://upload.cf.test/one-time/xyz");
    expect(step2Init.method).toBe("POST");
    expect((step2Init.body as FormData).get("file")).toBeTruthy();
  });

  it("rejects files with an unsupported MIME type before making any fetch call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(uploadImage(makeFile("image/gif"))).rejects.toThrow("type_not_accepted");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects files over the 10 MB limit", async () => {
    const big = makeFile("image/png", 11 * 1024 * 1024);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(uploadImage(big)).rejects.toThrow("file_too_large");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts an image below the old minimum dimension — pixel size is no longer enforced", async () => {
    vi.stubGlobal("Image", class SmallImage extends MockImage {
      naturalWidth = 400;
      naturalHeight = 300;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => directUploadBody })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadImage(makeFile());

    expect(result.width).toBe(400);
    expect(result.height).toBe(300);
  });

  it("throws when the direct-upload request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(uploadImage(makeFile())).rejects.toThrow("direct_upload_request_failed");
  });

  it("throws when the CF upload to uploadURL fails", async () => {
    vi.stubGlobal("fetch", vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => directUploadBody })
      .mockResolvedValueOnce({ ok: false, status: 400 }));
    await expect(uploadImage(makeFile())).rejects.toThrow("upload_failed");
  });

  it("rejects a 12 MB file with the default (avatar) limit even when subfolder is 'avatars'", async () => {
    const file = makeFile("image/png", 12 * 1024 * 1024);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(uploadImage(file, { subfolder: "avatars" })).rejects.toThrow("file_too_large");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("defaults subfolder to 'gallery' when omitted", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => directUploadBody })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await uploadImage(makeFile());
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.subfolder).toBe("gallery");
  });

  it("accepts a 12 MB file (over the default 10 MB limit) when a 15 MB maxBytes override is passed (portfolio gallery)", async () => {
    const file = makeFile("image/png", 12 * 1024 * 1024);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => directUploadBody })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadImage(file, {
      subfolder: "portfolio",
      maxBytes: 15 * 1024 * 1024,
    });
    expect(result.assetId).toBe("img_new");
  });

  it("rejects a 16 MB file even with a 15 MB maxBytes override", async () => {
    const file = makeFile("image/png", 16 * 1024 * 1024);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadImage(file, { subfolder: "portfolio", maxBytes: 15 * 1024 * 1024 })
    ).rejects.toThrow("file_too_large");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
