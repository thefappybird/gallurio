/**
 * item 2b (docs/portfolio/puck-023-followups.md): proves lazy.ts actually
 * produces three distinct code-split components, without a browser. The
 * per-template "which chunk gets requested" assertion lives in
 * lazySplit.test.tsx (needs a mocked next/dynamic; this file uses the real
 * one so the identity check is meaningful).
 */
import { describe, it, expect } from "vitest";
import {
  LazyGalleryLightboxTrigger,
  LazyFeaturedCollectionsClient,
  LazyMasonryCloneClient,
} from "./lazy";
import { GalleryLightboxTrigger } from "./GalleryLightboxTrigger";
import { FeaturedCollectionsClient } from "./FeaturedCollectionsClient";
import { MasonryCloneClient } from "./MasonryCloneClient";

describe("lazy.ts — next/dynamic islands are distinct split points", () => {
  it("wraps each island in its own component, none sharing an identity", () => {
    const lazies = [
      LazyGalleryLightboxTrigger,
      LazyFeaturedCollectionsClient,
      LazyMasonryCloneClient,
    ];
    // Every pair is a different reference — three separate dynamic() calls,
    // not one shared wrapper accidentally reused across islands.
    for (let i = 0; i < lazies.length; i++) {
      for (let j = i + 1; j < lazies.length; j++) {
        expect(lazies[i]).not.toBe(lazies[j]);
      }
    }
  });

  it("does not just re-export the real component (dynamic() actually wraps it)", () => {
    expect(LazyGalleryLightboxTrigger).not.toBe(GalleryLightboxTrigger);
    expect(LazyFeaturedCollectionsClient).not.toBe(FeaturedCollectionsClient);
    expect(LazyMasonryCloneClient).not.toBe(MasonryCloneClient);
  });

  it("each export is a renderable component reference", () => {
    for (const Lazy of [
      LazyGalleryLightboxTrigger,
      LazyFeaturedCollectionsClient,
      LazyMasonryCloneClient,
    ]) {
      expect(["function", "object"]).toContain(typeof Lazy);
      expect(Lazy).not.toBeNull();
    }
  });
});
