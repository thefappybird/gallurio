import { describe, it, expect } from "vitest";
import {
  validatePhotoFile,
  validatePhotoDimensions,
  validatePhotoMeta,
  PHOTO_SPEC,
  PORTFOLIO_PHOTO_MAX_BYTES,
  ACCEPTED_MIME,
  ACCEPTED_FORMATS,
} from "./photoSpec";

function makeFile(type: string, sizeBytes: number): File {
  const blob = new Blob([new Uint8Array(sizeBytes)], { type });
  return new File([blob], "test.img", { type });
}

describe("validatePhotoFile", () => {
  it("accepts jpeg", () => {
    expect(validatePhotoFile(makeFile("image/jpeg", 1024))).toEqual({ ok: true });
  });

  it("accepts the image/jpg MIME alias", () => {
    expect(validatePhotoFile(makeFile("image/jpg", 1024))).toEqual({ ok: true });
  });

  it("accepts png", () => {
    expect(validatePhotoFile(makeFile("image/png", 1024))).toEqual({ ok: true });
  });

  it("accepts webp", () => {
    expect(validatePhotoFile(makeFile("image/webp", 1024))).toEqual({ ok: true });
  });

  it("accepts avif", () => {
    expect(validatePhotoFile(makeFile("image/avif", 1024))).toEqual({ ok: true });
  });

  it("rejects gif with type_not_accepted", () => {
    expect(validatePhotoFile(makeFile("image/gif", 1024))).toEqual({
      ok: false,
      reason: "type_not_accepted",
    });
  });

  it("rejects pdf with type_not_accepted", () => {
    expect(validatePhotoFile(makeFile("application/pdf", 1024))).toEqual({
      ok: false,
      reason: "type_not_accepted",
    });
  });

  it("rejects a file exactly at max size + 1 byte", () => {
    expect(validatePhotoFile(makeFile("image/jpeg", PHOTO_SPEC.maxBytes + 1))).toEqual({
      ok: false,
      reason: "file_too_large",
    });
  });

  it("accepts a file exactly at the max size", () => {
    expect(validatePhotoFile(makeFile("image/jpeg", PHOTO_SPEC.maxBytes))).toEqual({ ok: true });
  });

  it("rejects type check before size — gif stays type_not_accepted even when oversized", () => {
    expect(validatePhotoFile(makeFile("image/gif", PHOTO_SPEC.maxBytes + 1))).toEqual({
      ok: false,
      reason: "type_not_accepted",
    });
  });

  it("defaults to PHOTO_SPEC.maxBytes (10 MB) when no override is passed", () => {
    expect(validatePhotoFile(makeFile("image/jpeg", PORTFOLIO_PHOTO_MAX_BYTES))).toEqual({
      ok: false,
      reason: "file_too_large",
    });
  });

  it("accepts a file above the default 10 MB limit when an explicit maxBytes override allows it", () => {
    expect(
      validatePhotoFile(makeFile("image/jpeg", PORTFOLIO_PHOTO_MAX_BYTES), PORTFOLIO_PHOTO_MAX_BYTES)
    ).toEqual({ ok: true });
  });

  it("rejects a file over an explicit maxBytes override", () => {
    expect(
      validatePhotoFile(makeFile("image/jpeg", PORTFOLIO_PHOTO_MAX_BYTES + 1), PORTFOLIO_PHOTO_MAX_BYTES)
    ).toEqual({ ok: false, reason: "file_too_large" });
  });
});

describe("validatePhotoDimensions", () => {
  it("accepts 1920×1080 (short side 1080 >= 600)", () => {
    expect(validatePhotoDimensions(1920, 1080)).toEqual({ ok: true });
  });

  it("accepts exactly 600×600", () => {
    expect(validatePhotoDimensions(600, 600)).toEqual({ ok: true });
  });

  it("accepts a portrait 600×1200", () => {
    expect(validatePhotoDimensions(600, 1200)).toEqual({ ok: true });
  });

  it("rejects 400×800 (short side 400 < 600)", () => {
    expect(validatePhotoDimensions(400, 800)).toEqual({
      ok: false,
      reason: "dimension_too_small",
    });
  });

  it("rejects 300×300", () => {
    expect(validatePhotoDimensions(300, 300)).toEqual({
      ok: false,
      reason: "dimension_too_small",
    });
  });

  it("returns ok when width is null (no dimensions from Cloudinary)", () => {
    expect(validatePhotoDimensions(null, null)).toEqual({ ok: true });
  });

  it("returns ok when width is undefined", () => {
    expect(validatePhotoDimensions(undefined, undefined)).toEqual({ ok: true });
  });

  it("returns ok when only one dimension is present (partial upload response)", () => {
    expect(validatePhotoDimensions(800, null)).toEqual({ ok: true });
  });
});

describe("ACCEPTED_MIME / ACCEPTED_FORMATS exports", () => {
  it("ACCEPTED_MIME contains all four MIME types", () => {
    expect(ACCEPTED_MIME).toContain("image/jpeg");
    expect(ACCEPTED_MIME).toContain("image/png");
    expect(ACCEPTED_MIME).toContain("image/webp");
    expect(ACCEPTED_MIME).toContain("image/avif");
  });

  it("ACCEPTED_FORMATS contains Cloudinary format strings", () => {
    expect(ACCEPTED_FORMATS).toContain("jpg");
    expect(ACCEPTED_FORMATS).toContain("jpeg");
    expect(ACCEPTED_FORMATS).toContain("png");
    expect(ACCEPTED_FORMATS).toContain("webp");
    expect(ACCEPTED_FORMATS).toContain("avif");
  });
});

describe("validatePhotoMeta", () => {
  // --- format checks ---
  it("accepts jpg format", () => {
    expect(validatePhotoMeta({ format: "jpg" })).toEqual({ ok: true });
  });

  it("accepts jpeg format", () => {
    expect(validatePhotoMeta({ format: "jpeg" })).toEqual({ ok: true });
  });

  it("accepts png format", () => {
    expect(validatePhotoMeta({ format: "png" })).toEqual({ ok: true });
  });

  it("accepts webp format", () => {
    expect(validatePhotoMeta({ format: "webp" })).toEqual({ ok: true });
  });

  it("accepts avif format", () => {
    expect(validatePhotoMeta({ format: "avif" })).toEqual({ ok: true });
  });

  it("rejects gif format", () => {
    expect(validatePhotoMeta({ format: "gif" })).toEqual({
      ok: false,
      reason: "format_not_accepted",
    });
  });

  it("rejects pdf format", () => {
    expect(validatePhotoMeta({ format: "pdf" })).toEqual({
      ok: false,
      reason: "format_not_accepted",
    });
  });

  it("rejects svg format", () => {
    expect(validatePhotoMeta({ format: "svg" })).toEqual({
      ok: false,
      reason: "format_not_accepted",
    });
  });

  it("is case-insensitive for format (JPG accepted)", () => {
    expect(validatePhotoMeta({ format: "JPG" })).toEqual({ ok: true });
  });

  it("is case-insensitive for format (GIF still rejected)", () => {
    expect(validatePhotoMeta({ format: "GIF" })).toEqual({
      ok: false,
      reason: "format_not_accepted",
    });
  });

  it("skips format check when format is null", () => {
    expect(validatePhotoMeta({ format: null, sizeBytes: 1024, width: 800, height: 800 })).toEqual({
      ok: true,
    });
  });

  it("skips format check when format is undefined", () => {
    expect(validatePhotoMeta({ sizeBytes: 1024, width: 800, height: 800 })).toEqual({ ok: true });
  });

  // --- size checks ---
  it("accepts a file exactly at the max size", () => {
    expect(validatePhotoMeta({ format: "jpg", sizeBytes: PHOTO_SPEC.maxBytes })).toEqual({
      ok: true,
    });
  });

  it("rejects a file 1 byte over max size", () => {
    expect(validatePhotoMeta({ format: "jpg", sizeBytes: PHOTO_SPEC.maxBytes + 1 })).toEqual({
      ok: false,
      reason: "file_too_large",
    });
  });

  it("skips size check when sizeBytes is null", () => {
    expect(validatePhotoMeta({ format: "jpg", sizeBytes: null, width: 800, height: 800 })).toEqual(
      { ok: true }
    );
  });

  // format rejection takes priority over size
  it("rejects bad format before checking oversize", () => {
    expect(validatePhotoMeta({ format: "gif", sizeBytes: PHOTO_SPEC.maxBytes + 1 })).toEqual({
      ok: false,
      reason: "format_not_accepted",
    });
  });

  // --- dimension checks ---
  it("accepts 1920×1080 (short side 1080 >= 600)", () => {
    expect(validatePhotoMeta({ format: "jpg", width: 1920, height: 1080 })).toEqual({ ok: true });
  });

  it("accepts exactly 600×600", () => {
    expect(validatePhotoMeta({ format: "png", width: 600, height: 600 })).toEqual({ ok: true });
  });

  it("rejects 400×800 (short side 400 < 600)", () => {
    expect(validatePhotoMeta({ format: "jpg", width: 400, height: 800 })).toEqual({
      ok: false,
      reason: "dimension_too_small",
    });
  });

  it("rejects 300×300", () => {
    expect(validatePhotoMeta({ format: "webp", width: 300, height: 300 })).toEqual({
      ok: false,
      reason: "dimension_too_small",
    });
  });

  it("skips dimension check when only one dimension is present", () => {
    expect(validatePhotoMeta({ format: "jpg", width: 400, height: null })).toEqual({ ok: true });
  });

  it("skips dimension check when both dimensions are null", () => {
    expect(validatePhotoMeta({ format: "jpg", width: null, height: null })).toEqual({ ok: true });
  });

  // size rejection takes priority over dimension
  it("rejects oversize before checking dimensions", () => {
    expect(
      validatePhotoMeta({ format: "jpg", sizeBytes: PHOTO_SPEC.maxBytes + 1, width: 300, height: 300 })
    ).toEqual({
      ok: false,
      reason: "file_too_large",
    });
  });

  // completely empty meta is fine (all checks skipped)
  it("accepts empty meta (all fields undefined)", () => {
    expect(validatePhotoMeta({})).toEqual({ ok: true });
  });

  // --- maxBytes override ---
  it("defaults to PHOTO_SPEC.maxBytes (10 MB) when no override is passed", () => {
    expect(
      validatePhotoMeta({ format: "jpg", sizeBytes: PORTFOLIO_PHOTO_MAX_BYTES })
    ).toEqual({ ok: false, reason: "file_too_large" });
  });

  it("accepts sizeBytes above the default 10 MB limit when an explicit maxBytes override allows it", () => {
    expect(
      validatePhotoMeta(
        { format: "jpg", sizeBytes: PORTFOLIO_PHOTO_MAX_BYTES },
        PORTFOLIO_PHOTO_MAX_BYTES
      )
    ).toEqual({ ok: true });
  });

  it("rejects sizeBytes over an explicit maxBytes override", () => {
    expect(
      validatePhotoMeta(
        { format: "jpg", sizeBytes: PORTFOLIO_PHOTO_MAX_BYTES + 1 },
        PORTFOLIO_PHOTO_MAX_BYTES
      )
    ).toEqual({ ok: false, reason: "file_too_large" });
  });
});
