import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadToCloudinary } from "./uploadToCloudinary";

function makeFile(type = "image/png", size = 1024): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], "logo.png", { type });
}

const signResponse = {
  signature: "sig",
  timestamp: 123,
  apiKey: "key",
  cloudName: "demo-cloud",
  folder: "gallurio/ws1/logos",
  allowedFormats: "jpg,jpeg,png,webp,avif",
  uploadUrl: "https://api.cloudinary.com/v1_1/demo-cloud/auto/upload",
};

describe("uploadToCloudinary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("forwards allowed_formats so the signed upload is accepted", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => signResponse })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          secure_url: "https://res.cloudinary.com/demo-cloud/logo.png",
          public_id: "gallurio/ws1/logos/logo",
          width: 512,
          height: 256,
          format: "png",
          bytes: 2048,
          resource_type: "image",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadToCloudinary(makeFile(), { subfolder: "logos" });
    expect(result.public_id).toBe("gallurio/ws1/logos/logo");

    // The upload request (2nd fetch) must include allowed_formats matching the
    // signed value — omitting it triggers Cloudinary's 401 "Invalid Signature".
    const uploadCall = fetchMock.mock.calls[1];
    const form = uploadCall[1].body as FormData;
    expect(form.get("allowed_formats")).toBe("jpg,jpeg,png,webp,avif");
    expect(form.get("folder")).toBe("gallurio/ws1/logos");
  });

  it("throws a descriptive error when Cloudinary rejects the upload", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => signResponse })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => '{"error":{"message":"Invalid Signature"}}',
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadToCloudinary(makeFile(), { subfolder: "logos" }),
    ).rejects.toThrow(/401/);
  });
});
