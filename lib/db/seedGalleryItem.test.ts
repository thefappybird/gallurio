import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { buildSeedGalleryItem } from "./seedGalleryItem";

describe("buildSeedGalleryItem", () => {
  it("builds a Cloudflare-compatible gallery item fixture", () => {
    const workspaceId = new Types.ObjectId();
    const collectionId = new Types.ObjectId();

    expect(
      buildSeedGalleryItem({
        workspaceId,
        collectionId,
        assetId: "img_seed_123",
        url: "https://picsum.photos/seed/demo/1600/1067",
        width: 1600,
        height: 1067,
        format: "jpg",
        sizeBytes: 250_000,
        caption: "Sample",
        altText: "Sample alt",
        order: 2,
      })
    ).toEqual({
      workspaceId,
      collectionId,
      assetId: "img_seed_123",
      assetProvider: "cloudflare",
      url: "https://picsum.photos/seed/demo/1600/1067",
      width: 1600,
      height: 1067,
      format: "jpg",
      sizeBytes: 250_000,
      caption: "Sample",
      altText: "Sample alt",
      order: 2,
      tags: [],
    });
  });

  it("fills optional fields with schema-safe defaults", () => {
    const workspaceId = new Types.ObjectId();

    expect(
      buildSeedGalleryItem({
        workspaceId,
        assetId: "img_seed_456",
        url: "https://picsum.photos/seed/demo-2/1200/1500",
        order: 0,
      })
    ).toMatchObject({
      workspaceId,
      collectionId: null,
      assetProvider: "cloudflare",
      width: null,
      height: null,
      format: null,
      sizeBytes: 0,
      caption: "",
      altText: "",
      tags: [],
    });
  });
});
