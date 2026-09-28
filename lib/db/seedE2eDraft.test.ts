import { describe, expect, it } from "vitest";
import { buildE2eFixtureData } from "./seedE2eDraft";

describe("buildE2eFixtureData", () => {
  it("configures a FeaturedWork bound to the seeded collection and a GalleryGrid in the gallery zone", () => {
    const featuredCollectionId = "abc123def456abc123def456";
    const data = buildE2eFixtureData({ featuredCollectionId });

    const featuredWork = data.home.content.find((block) => block.type === "FeaturedWork");
    expect(featuredWork).toBeDefined();
    expect(featuredWork!.props.id).toBe("e2e-featured-work");
    expect(featuredWork!.props.collections).toEqual([{ id: featuredCollectionId, name: "Weddings" }]);

    const galleryGrid = data.gallery.content.find((block) => block.type === "GalleryGrid");
    expect(galleryGrid).toBeDefined();
    expect(galleryGrid!.props.id).toBe("e2e-gallery-grid");
  });
});
