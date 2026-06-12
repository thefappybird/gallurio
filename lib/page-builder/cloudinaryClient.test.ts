import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cloudinaryImageUrl } from "./cloudinaryClient";

const OLD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

beforeEach(() => {
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "test-cloud";
});
afterEach(() => {
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = OLD;
});

describe("cloudinaryImageUrl", () => {
  it("builds a fill URL with width+height (mirrors server cloudinaryThumbnailUrl)", () => {
    expect(cloudinaryImageUrl("ws/1/item0", { width: 600, height: 600 })).toBe(
      "https://res.cloudinary.com/test-cloud/image/upload/c_fill,w_600,h_600,q_auto,f_auto/ws/1/item0"
    );
  });

  it("defaults height to width and crop to fill", () => {
    expect(cloudinaryImageUrl("p", { width: 400 })).toBe(
      "https://res.cloudinary.com/test-cloud/image/upload/c_fill,w_400,h_400,q_auto,f_auto/p"
    );
  });

  it("honours an explicit crop (limit)", () => {
    expect(cloudinaryImageUrl("p", { width: 800, height: 1600, crop: "limit" })).toBe(
      "https://res.cloudinary.com/test-cloud/image/upload/c_limit,w_800,h_1600,q_auto,f_auto/p"
    );
  });

  it("returns empty string when publicId is missing", () => {
    expect(cloudinaryImageUrl("", { width: 400 })).toBe("");
  });

  it("returns empty string when the cloud name env is unset", () => {
    delete process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    expect(cloudinaryImageUrl("p", { width: 400 })).toBe("");
  });
});
