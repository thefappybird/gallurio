import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cfImageLoader } from "./cfImageLoader";

const OLD = process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH;
beforeEach(() => {
  process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = "test-hash";
});
afterEach(() => {
  process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = OLD;
});

describe("cfImageLoader", () => {
  it("rewrites a /public variant URL to a sized w=/q=/f=auto variant", () => {
    const src = "https://imagedelivery.net/test-hash/pid1/public";
    expect(cfImageLoader({ src, width: 600 })).toBe(
      "https://imagedelivery.net/test-hash/pid1/w=600,q=85,f=auto"
    );
  });

  it("rewrites an already-sized variant URL, preserving h=/fit= and using the requested width/quality", () => {
    const src = "https://imagedelivery.net/test-hash/pid1/w=400,h=400,fit=cover,q=85,f=auto";
    expect(cfImageLoader({ src, width: 800, quality: 70 })).toBe(
      "https://imagedelivery.net/test-hash/pid1/w=800,h=400,fit=cover,q=70,f=auto"
    );
  });

  it("builds a fresh delivery URL from a bare Cloudflare image id", () => {
    expect(cfImageLoader({ src: "bare-id-123", width: 320 })).toBe(
      "https://imagedelivery.net/test-hash/bare-id-123/w=320,q=85,f=auto"
    );
  });

  it("rewrites a URL whose image id itself contains a slash", () => {
    const src = "https://imagedelivery.net/test-hash/gallery/cover.jpg/w=700,h=900,fit=cover,q=85,f=auto";
    expect(cfImageLoader({ src, width: 300 })).toBe(
      "https://imagedelivery.net/test-hash/gallery/cover.jpg/w=300,h=900,fit=cover,q=85,f=auto"
    );
  });

  it("returns a foreign (non-imagedelivery) URL untouched", () => {
    const src = "data:image/png;base64,AAAA";
    expect(cfImageLoader({ src, width: 320 })).toBe(src);
  });

  it("returns the src untouched when the account hash env var is missing (bare id case)", () => {
    delete process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH;
    expect(cfImageLoader({ src: "bare-id-123", width: 320 })).toBe("bare-id-123");
  });

  it("defaults quality to 85 when unset", () => {
    const src = "https://imagedelivery.net/test-hash/pid1/public";
    expect(cfImageLoader({ src, width: 600 })).toContain("q=85");
  });
});
