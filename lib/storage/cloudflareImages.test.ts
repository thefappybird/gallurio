import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  requestDirectUpload,
  verifyImageOwnership,
  deleteImage,
  imageDeliveryUrl,
} from "./cloudflareImages";

const ACCOUNT_ID = "acc123";
const API_TOKEN = "tok456";
const ACCOUNT_HASH = "hash789";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", ACCOUNT_ID);
  vi.stubEnv("CLOUDFLARE_IMAGES_API_TOKEN", API_TOKEN);
  vi.stubEnv("CLOUDFLARE_IMAGES_ACCOUNT_HASH", ACCOUNT_HASH);
});

// ---------------------------------------------------------------------------
// requestDirectUpload
// ---------------------------------------------------------------------------

describe("requestDirectUpload", () => {
  it("POSTs to direct_upload and returns imageId + uploadURL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: { id: "img_abc", uploadURL: "https://upload.cloudflare.com/one-time/abc" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestDirectUpload("ws_1", "gallery");
    expect(result).toEqual({ imageId: "img_abc", uploadURL: "https://upload.cloudflare.com/one-time/abc" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { body: FormData }];
    expect(url).toContain(`/accounts/${ACCOUNT_ID}/images/v2/direct_upload`);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${API_TOKEN}`);

    const form = init.body as FormData;
    expect(form.get("requireSignedURLs")).toBe("false");
    const meta = JSON.parse(form.get("metadata") as string);
    expect(meta.workspaceId).toBe("ws_1");
    expect(meta.subfolder).toBe("gallery");
  });

  it("defaults subfolder to 'gallery' when omitted", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { id: "x", uploadURL: "https://u" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await requestDirectUpload("ws_1");
    const form = (fetchMock.mock.calls[0] as [string, RequestInit & { body: FormData }])[1].body as FormData;
    expect(JSON.parse(form.get("metadata") as string).subfolder).toBe("gallery");
  });

  it("throws when CF returns a non-ok status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "bad request",
    }));

    await expect(requestDirectUpload("ws_1")).rejects.toThrow("CF direct_upload failed 400");
  });
});

// ---------------------------------------------------------------------------
// verifyImageOwnership
// ---------------------------------------------------------------------------

describe("verifyImageOwnership", () => {
  it("returns true when draft is absent and workspaceId matches in meta", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: { meta: { workspaceId: "ws_1" } },
      }),
    }));

    expect(await verifyImageOwnership("img_1", "ws_1")).toBe(true);
  });

  it("returns true when metadata field is used instead of meta", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: { metadata: { workspaceId: "ws_1" } },
      }),
    }));

    expect(await verifyImageOwnership("img_1", "ws_1")).toBe(true);
  });

  it("returns false when workspaceId does not match", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: { meta: { workspaceId: "ws_other" } },
      }),
    }));

    expect(await verifyImageOwnership("img_1", "ws_1")).toBe(false);
  });

  it("retries when draft is present and eventually succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { draft: true, meta: { workspaceId: "ws_1" } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { meta: { workspaceId: "ws_1" } } }),
      });
    vi.stubGlobal("fetch", fetchMock);
    // Speed up by stubbing setTimeout to resolve immediately.
    vi.stubGlobal("setTimeout", (fn: () => void) => { fn(); return 0; });

    expect(await verifyImageOwnership("img_1", "ws_1")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns false after 3 draft-still-present attempts", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { draft: true, meta: { workspaceId: "ws_1" } } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("setTimeout", (fn: () => void) => { fn(); return 0; });

    expect(await verifyImageOwnership("img_1", "ws_1")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns false when the GET is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    expect(await verifyImageOwnership("nonexistent", "ws_1")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deleteImage
// ---------------------------------------------------------------------------

describe("deleteImage", () => {
  it("sends DELETE to the correct endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await deleteImage("img_del");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/images/v1/img_del`);
    expect(init.method).toBe("DELETE");
  });

  it("is a no-op for empty imageId", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await deleteImage("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when CF returns non-ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "err" }));
    await expect(deleteImage("img_x")).rejects.toThrow("CF delete failed 500");
  });
});

// ---------------------------------------------------------------------------
// imageDeliveryUrl
// ---------------------------------------------------------------------------

describe("imageDeliveryUrl", () => {
  it("returns /public variant when no dimensions given", () => {
    expect(imageDeliveryUrl("img1")).toBe(
      `https://imagedelivery.net/${ACCOUNT_HASH}/img1/public`
    );
  });

  it("builds w/h/fit/q/f variant", () => {
    expect(imageDeliveryUrl("img1", { width: 400, height: 300, fit: "cover" })).toBe(
      `https://imagedelivery.net/${ACCOUNT_HASH}/img1/w=400,h=300,fit=cover,q=85,f=auto`
    );
  });

  it("omits fit when not specified", () => {
    const url = imageDeliveryUrl("img1", { width: 200, height: 200 });
    expect(url).toBe(`https://imagedelivery.net/${ACCOUNT_HASH}/img1/w=200,h=200,q=85,f=auto`);
  });

  it("returns empty string for missing imageId", () => {
    expect(imageDeliveryUrl("")).toBe("");
  });

  it("returns empty string when CLOUDFLARE_IMAGES_ACCOUNT_HASH is not set", () => {
    vi.stubEnv("CLOUDFLARE_IMAGES_ACCOUNT_HASH", "");
    expect(imageDeliveryUrl("img1", { width: 100 })).toBe("");
  });
});
