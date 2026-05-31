import { describe, it, expect } from "vitest";
import { validatePhotoFile, validatePhotoDimensions, PHOTO_SPEC } from "./photoSpec";

function makeFile(type: string, sizeBytes: number): File {
  const blob = new Blob([new Uint8Array(sizeBytes)], { type });
  return new File([blob], "test.img", { type });
}

describe("validatePhotoFile", () => {
  it("accepts jpeg", () => {
    expect(validatePhotoFile(makeFile("image/jpeg", 1024))).toEqual({ ok: true });
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
