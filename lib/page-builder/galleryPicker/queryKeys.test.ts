import { describe, it, expect } from "vitest";
import { galleryKeys } from "./queryKeys";

describe("galleryKeys", () => {
  it("scopes every key by workspaceId so two workspaces never share a cache entry", () => {
    expect(galleryKeys.all("ws-a")).toEqual(["gallery", "ws-a"]);
    expect(galleryKeys.picker("ws-a")).toEqual(["gallery", "ws-a", "picker"]);
    expect(galleryKeys.feed("ws-a", "col1")).toEqual(["gallery", "ws-a", "feed", "col1"]);
    expect(galleryKeys.picker("ws-a")).not.toEqual(galleryKeys.picker("ws-b"));
  });

  it("gives the layout-preview card its own key, distinct from the 'all' feed", () => {
    expect(galleryKeys.layoutPreview("ws-a")).toEqual(["gallery", "ws-a", "layoutPreview"]);
    expect(galleryKeys.layoutPreview("ws-a")).not.toEqual(galleryKeys.feed("ws-a", "all"));
  });

  it("gives an Image block's by-asset lookup its own key, scoped per asset", () => {
    expect(galleryKeys.itemByAsset("ws-a", "asset123")).toEqual(["gallery", "ws-a", "itemByAsset", "asset123"]);
    expect(galleryKeys.itemByAsset("ws-a", "asset123")).not.toEqual(galleryKeys.itemByAsset("ws-a", "asset456"));
  });
});
