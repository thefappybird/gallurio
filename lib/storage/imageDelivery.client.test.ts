import { beforeEach, describe, expect, it, vi } from "vitest";
import { imageDeliveryUrl } from "./imageDelivery.client";

const HASH = "testhash";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubEnv("NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH", HASH);
});

describe("imageDeliveryUrl", () => {
  it("returns /public variant when no dimensions given", () => {
    expect(imageDeliveryUrl("img1")).toBe(`https://imagedelivery.net/${HASH}/img1/public`);
  });

  it("builds width + height + fit variant", () => {
    expect(imageDeliveryUrl("img1", { width: 400, height: 300, fit: "cover" })).toBe(
      `https://imagedelivery.net/${HASH}/img1/w=400,h=300,fit=cover,q=85,f=auto`
    );
  });

  it("builds width-only variant without fit", () => {
    expect(imageDeliveryUrl("img1", { width: 200 })).toBe(
      `https://imagedelivery.net/${HASH}/img1/w=200,q=85,f=auto`
    );
  });

  it("builds height-only variant without fit", () => {
    expect(imageDeliveryUrl("img1", { height: 150 })).toBe(
      `https://imagedelivery.net/${HASH}/img1/h=150,q=85,f=auto`
    );
  });

  it("maps Cloudinary fill → cover correctly when caller passes cover", () => {
    const url = imageDeliveryUrl("img1", { width: 240, height: 240, fit: "cover" });
    expect(url).toContain("fit=cover");
  });

  it("maps Cloudinary limit → scale-down correctly when caller passes scale-down", () => {
    const url = imageDeliveryUrl("img1", { width: 800, fit: "scale-down" });
    expect(url).toContain("fit=scale-down");
  });

  it("returns empty string for empty imageId", () => {
    expect(imageDeliveryUrl("")).toBe("");
  });

  it("returns empty string when NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH is not set", () => {
    vi.stubEnv("NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH", "");
    expect(imageDeliveryUrl("img1", { width: 100 })).toBe("");
  });
});
