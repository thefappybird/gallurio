/**
 * item 2b (docs/portfolio/puck-023-followups.md): proves the per-block split
 * is DATA-dependent — a page that never uses an island never mounts it, so
 * that island's chunk is never requested. Complements lazy.test.tsx (which
 * proves the three islands are distinct split points) and the followups
 * doc's Run 5 real A/B transfer-size measurement.
 *
 * Raw template seed data ships FeaturedWork/CollectionCard with EMPTY
 * `collections`/`collection` (they're populated later from a real
 * workspace's media — see FeaturedWorkBlock.tsx's own comment), so asserting
 * against `getTemplate(...).seedData(...)` directly would test the empty
 * placeholder branch, not the island. Build minimal synthetic pages instead —
 * one that only uses FeaturedWork (populated), one that only uses MasonryClone
 * — mirroring the real Editorial-vs-Minimal contrast (Editorial never uses
 * GalleryMasonry/MasonryClone at all; Minimal's gallery zone uses
 * GalleryMasonry with masonry-loop MasonryClone lane fillers and no
 * FeaturedWork/CollectionCard — verified against the template source).
 *
 * next/dynamic is mocked with a spy recording each loader's source text
 * (unique per island via its `import("./Name")` specifier) the moment its
 * wrapper actually mounts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { Render, type Config, type Data } from "@puckeditor/core";

const invokedLoaders = vi.hoisted(() => new Set<string>());

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<unknown>) => {
    return function LazySplitProbe() {
      invokedLoaders.add(loader.toString());
      return null;
    };
  },
}));

import { puckConfig } from "@/lib/page-builder/config";
import { featuredWorkDefaultProps } from "./FeaturedWorkBlock";
import { masonryCloneDefaultProps } from "./MasonryCloneBlock";

const renderConfig = puckConfig as unknown as Config;

function invoked(islandFileName: string): boolean {
  return [...invokedLoaders].some((src) => src.includes(islandFileName));
}

describe("item 2b — per-page island invocation is data-dependent", () => {
  beforeEach(() => {
    invokedLoaders.clear();
  });

  it("a page using only FeaturedWork mounts FeaturedCollectionsClient, never MasonryCloneClient", () => {
    const data = {
      root: {},
      content: [
        {
          type: "FeaturedWork",
          props: {
            ...featuredWorkDefaultProps,
            id: "fw-1",
            collections: [
              { id: "c1", name: "Weddings", coverPublicId: "gallurio/cover.jpg", itemCount: 5 },
            ],
          },
        },
      ],
    } as unknown as Data;

    render(<Render config={renderConfig} data={data} />);

    expect(invoked("FeaturedCollectionsClient")).toBe(true);
    expect(invoked("MasonryCloneClient")).toBe(false);
  });

  it("a page using only MasonryClone mounts MasonryCloneClient, never FeaturedCollectionsClient", () => {
    const data = {
      root: {},
      content: [
        {
          type: "MasonryClone",
          props: {
            ...masonryCloneDefaultProps,
            id: "mc-1",
            sourceId: "source-1",
            imageProps: { alt: "", _style: { bgImagePublicId: "gallurio/asset.jpg" } },
          },
        },
      ],
    } as unknown as Data;

    render(<Render config={renderConfig} data={data} />);

    expect(invoked("MasonryCloneClient")).toBe(true);
    expect(invoked("FeaturedCollectionsClient")).toBe(false);
  });
});
