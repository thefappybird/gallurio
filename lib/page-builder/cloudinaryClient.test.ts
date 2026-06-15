import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { imageDeliveryUrl } from "@/lib/storage/imageDelivery.client";

const OLD = process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH;

beforeEach(() => {
  process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = "test-hash";
});
afterEach(() => {
  process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = OLD;
});

describe("imageDeliveryUrl (via cloudinaryClient re-export)", () => {
  it("builds a cover URL with width+height", () => {
    expect(imageDeliveryUrl("img123", { width: 600, height: 600, fit: "cover" })).toBe(
      "https://imagedelivery.net/test-hash/img123/w=600,h=600,fit=cover,q=85,f=auto"
    );
  });

  it("builds a scale-down URL", () => {
    expect(imageDeliveryUrl("img123", { width: 800, height: 1600, fit: "scale-down" })).toBe(
      "https://imagedelivery.net/test-hash/img123/w=800,h=1600,fit=scale-down,q=85,f=auto"
    );
  });

  it("returns /public URL when no dims given", () => {
    expect(imageDeliveryUrl("img123")).toBe(
      "https://imagedelivery.net/test-hash/img123/public"
    );
  });

  it("returns empty string when imageId is missing", () => {
    expect(imageDeliveryUrl("", { width: 400 })).toBe("");
  });

  it("returns empty string when account hash env is unset", () => {
    delete process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH;
    expect(imageDeliveryUrl("img123", { width: 400 })).toBe("");
  });
});
