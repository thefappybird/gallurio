import { describe, it, expect } from "vitest";
import { firstHomeImage } from "@/lib/discover/firstHomeImage";
import type { PuckData } from "@/lib/page-builder/types";

const img = (publicId: string) => ({ id: `id_${publicId}`, publicId, alt: "" });

describe("firstHomeImage", () => {
  it("returns the image of a block nested in a preset slot before a later top-level block", () => {
    const home: PuckData = {
      content: [
        {
          type: "GalleryGridPreset",
          props: {
            content: [{ type: "GalleryGrid", props: { images: [img("nested-1")] } }],
          },
        },
        { type: "GalleryGrid", props: { images: [img("later-1")] } },
      ],
    };
    expect(firstHomeImage(home)).toEqual({ publicId: "nested-1" });
  });

  it("prefers backgroundImages over a later images on the same block", () => {
    const home: PuckData = {
      content: [{ type: "Container", props: { images: [img("fg-1")], backgroundImages: [img("bg-1")] } }],
    };
    expect(firstHomeImage(home)).toEqual({ publicId: "bg-1" });
  });

  it("returns null for a null tree or a tree with no images", () => {
    expect(firstHomeImage(null)).toBeNull();
    expect(firstHomeImage({ content: [{ type: "Heading", props: { text: "Hi" } }] })).toBeNull();
  });

  it("skips malformed entries and returns the first valid publicId", () => {
    const home = {
      content: [
        {
          type: "GalleryGrid",
          props: {
            images: [null, "str", {}, { publicId: "" }, { publicId: 42 }, img("valid-1")],
          },
        },
      ],
    } as unknown as PuckData;
    expect(firstHomeImage(home)).toEqual({ publicId: "valid-1" });
  });
});
