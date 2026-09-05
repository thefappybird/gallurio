import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadDemoImage } from "./uploadDemoImage.client";

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

const directUploadBody = { imageId: "img_demo", uploadURL: "https://upload.cf.test/one-time/demo" };

describe("uploadDemoImage", () => {
  it("requests a direct-upload URL, uploads the file, and returns {ok:true, image}", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => directUploadBody })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadDemoImage(makeFile(), "session-1");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.image.assetId).toBe("img_demo");
    expect(result.image.url).toContain("imagedelivery.net");
    expect(result.image.width).toBe(1200);
    expect(result.image.height).toBe(800);

    const [step1Url, step1Init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(step1Url).toBe("/api/portfolio-maker-demo/upload");
    expect(JSON.parse(step1Init.body as string)).toMatchObject({ demoSessionId: "session-1" });

    const [step2Url] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(step2Url).toBe("https://upload.cf.test/one-time/demo");
  });

  it("maps a 400 image_cap_reached response to {ok:false, error:'image_cap_reached'}", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "image_cap_reached" }),
    }));

    const result = await uploadDemoImage(makeFile(), "session-1");

    expect(result).toEqual({ ok: false, error: "image_cap_reached" });
  });

  it("maps a 429 rate_limited response to {ok:false, error:'rate_limited'}", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ ok: false, error: "rate_limited" }),
    }));

    const result = await uploadDemoImage(makeFile(), "session-1");

    expect(result).toEqual({ ok: false, error: "rate_limited" });
  });

  it("maps a thrown network error to {ok:false, error:'upload_failed'}", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await uploadDemoImage(makeFile(), "session-1");

    expect(result).toEqual({ ok: false, error: "upload_failed" });
  });

  it("rejects an invalid file (unsupported MIME type) without calling fetch, attaching the rejected type as detail", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadDemoImage(makeFile("image/gif"), "session-1");

    expect(result).toEqual({
      ok: false,
      error: "invalid_file",
      detail: { code: "type_not_accepted", mimeType: "image/gif", acceptedTypes: expect.arrayContaining(["image/jpeg"]) },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized file, attaching actual and max bytes as detail", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const big = makeFile("image/png", 16 * 1024 * 1024);

    const result = await uploadDemoImage(big, "session-1");

    expect(result).toEqual({
      ok: false,
      error: "invalid_file",
      detail: { code: "file_too_large", actualBytes: 16 * 1024 * 1024, maxBytes: 15 * 1024 * 1024 },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
