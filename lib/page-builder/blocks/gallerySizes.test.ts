import { describe, it, expect } from "vitest";
import { galleryImageSizes } from "./gallerySizes";

describe("galleryImageSizes", () => {
  it("2 columns", () => {
    expect(galleryImageSizes(2)).toBe("(min-width: 768px) 50vw, 100vw");
  });

  it("3 columns", () => {
    expect(galleryImageSizes(3)).toBe("(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw");
  });

  it("4 columns", () => {
    expect(galleryImageSizes(4)).toBe("(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw");
  });
});
