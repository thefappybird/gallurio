import { describe, expect, it } from "vitest";
import {
  UploadError,
  describeUploadErrorEnglish,
  formatMB,
  uploadErrorTranslation,
  type UploadErrorDetail,
} from "./uploadError";

describe("UploadError", () => {
  it("keeps .message equal to the bare code (backward-compatible with err.message checks)", () => {
    const err = new UploadError({ code: "file_too_large", actualBytes: 100, maxBytes: 50 });
    expect(err.message).toBe("file_too_large");
    expect(err.detail).toEqual({ code: "file_too_large", actualBytes: 100, maxBytes: 50 });
  });

  it("is an instance of Error", () => {
    expect(new UploadError({ code: "unknown" })).toBeInstanceOf(Error);
  });
});

describe("formatMB", () => {
  it("formats bytes to one decimal MB", () => {
    expect(formatMB(18.4 * 1024 * 1024)).toBe("18.4");
    expect(formatMB(10 * 1024 * 1024)).toBe("10.0");
  });

  it("returns '?' when bytes is undefined", () => {
    expect(formatMB(undefined)).toBe("?");
  });
});

describe("uploadErrorTranslation", () => {
  it("maps type_not_accepted with the rejected MIME type and accepted list", () => {
    const detail: UploadErrorDetail = {
      code: "type_not_accepted",
      mimeType: "image/gif",
      acceptedTypes: ["image/jpeg", "image/png"],
    };
    expect(uploadErrorTranslation(detail)).toEqual({
      code: "upload_type_not_accepted",
      params: { type: "GIF", accepted: "JPEG, PNG" },
    });
  });

  it("maps format_not_accepted using the format field when mimeType is absent", () => {
    const detail: UploadErrorDetail = {
      code: "format_not_accepted",
      format: "svg",
      acceptedTypes: ["jpg", "png"],
    };
    expect(uploadErrorTranslation(detail)).toEqual({
      code: "upload_type_not_accepted",
      params: { type: "SVG", accepted: "JPG, PNG" },
    });
  });

  it("maps file_too_large with actual and limit formatted in MB", () => {
    const detail: UploadErrorDetail = {
      code: "file_too_large",
      actualBytes: 18.4 * 1024 * 1024,
      maxBytes: 10 * 1024 * 1024,
    };
    expect(uploadErrorTranslation(detail)).toEqual({
      code: "upload_file_too_large",
      params: { actual: "18.4", limit: "10.0" },
    });
  });

  it("maps dimension_too_small with actual width/height and the minimum", () => {
    const detail: UploadErrorDetail = {
      code: "dimension_too_small",
      actualWidth: 400,
      actualHeight: 800,
      minShortSide: 600,
    };
    expect(uploadErrorTranslation(detail)).toEqual({
      code: "upload_dimension_too_small",
      params: { width: 400, height: 800, min: 600 },
    });
  });

  it("maps invalid_image, quota_exceeded, rate_limited, network_error with no params", () => {
    expect(uploadErrorTranslation({ code: "invalid_image" })).toEqual({ code: "upload_invalid_image" });
    expect(uploadErrorTranslation({ code: "quota_exceeded" })).toEqual({ code: "upload_quota_exceeded" });
    expect(uploadErrorTranslation({ code: "rate_limited" })).toEqual({ code: "upload_rate_limited" });
    expect(uploadErrorTranslation({ code: "network_error" })).toEqual({ code: "upload_network_error" });
  });

  it("reuses the existing not_authenticated code for auth_required (no duplicate key)", () => {
    expect(uploadErrorTranslation({ code: "auth_required" })).toEqual({ code: "not_authenticated" });
  });

  it("falls back to the existing generic code for unknown", () => {
    expect(uploadErrorTranslation({ code: "unknown" })).toEqual({ code: "generic" });
  });
});

describe("describeUploadErrorEnglish", () => {
  it("states the actual size and the limit, not a generic failure", () => {
    const msg = describeUploadErrorEnglish({
      code: "file_too_large",
      actualBytes: 18.4 * 1024 * 1024,
      maxBytes: 10 * 1024 * 1024,
    });
    expect(msg).toBe("That file is 18.4 MB. The limit is 10.0 MB.");
  });

  it("states the rejected type and accepted list", () => {
    const msg = describeUploadErrorEnglish({
      code: "type_not_accepted",
      mimeType: "image/gif",
      acceptedTypes: ["image/jpeg", "image/png"],
    });
    expect(msg).toBe('"GIF" isn\'t a supported format. Upload JPEG, PNG instead.');
  });

  it("states the actual dimensions and the minimum", () => {
    const msg = describeUploadErrorEnglish({
      code: "dimension_too_small",
      actualWidth: 400,
      actualHeight: 300,
      minShortSide: 600,
    });
    expect(msg).toBe("That image is 400×300px. It needs to be at least 600px on the shorter side.");
  });

  it("never returns the generic fallback when a specific reason is known", () => {
    const codes: UploadErrorDetail["code"][] = [
      "type_not_accepted",
      "format_not_accepted",
      "file_too_large",
      "dimension_too_small",
      "invalid_image",
      "quota_exceeded",
      "rate_limited",
      "auth_required",
      "network_error",
    ];
    for (const code of codes) {
      expect(describeUploadErrorEnglish({ code })).not.toBe("Something went wrong. Please try again.");
    }
  });
});
