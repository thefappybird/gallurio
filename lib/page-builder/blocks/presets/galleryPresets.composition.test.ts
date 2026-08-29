import { describe, expect, it } from "vitest";
import {
  GALLERY_GRID_PRESET,
  GALLERY_GRID_FULL_PRESET,
  GALLERY_GRID_FRAMED_PRESET,
} from "./galleryGrid";
import {
  GALLERY_MASONRY_PRESET,
  GALLERY_MASONRY_WALL_PRESET,
  GALLERY_MASONRY_JOURNAL_PRESET,
} from "./galleryMasonry";
import {
  FEATURED_WORK_PRESET,
  FEATURED_WORK_LEAD_PRESET,
  FEATURED_WORK_INDEX_PRESET,
} from "./featuredWork";
import {
  GALLERY_LANDING_PRESET,
  GALLERY_LANDING_SPLIT_PRESET,
  GALLERY_LANDING_MASTHEAD_PRESET,
} from "./galleryLanding";
import { VIDEO_PRESET, VIDEO_SPLIT_PRESET, VIDEO_CINEMA_PRESET } from "./video";

type PresetNode = { type: string; props: Record<string, unknown> };

const ALL_PRESETS: Record<string, unknown> = {
  GALLERY_GRID_PRESET,
  GALLERY_GRID_FULL_PRESET,
  GALLERY_GRID_FRAMED_PRESET,
  GALLERY_MASONRY_PRESET,
  GALLERY_MASONRY_WALL_PRESET,
  GALLERY_MASONRY_JOURNAL_PRESET,
  FEATURED_WORK_PRESET,
  FEATURED_WORK_LEAD_PRESET,
  FEATURED_WORK_INDEX_PRESET,
  GALLERY_LANDING_PRESET,
  GALLERY_LANDING_SPLIT_PRESET,
  GALLERY_LANDING_MASTHEAD_PRESET,
  VIDEO_PRESET,
  VIDEO_SPLIT_PRESET,
  VIDEO_CINEMA_PRESET,
};

/** Recursively collects every node (any block) inside a preset's content tree,
 *  including the root preset itself as a synthetic "Container" node. */
function collectNodes(props: Record<string, unknown>, out: PresetNode[]) {
  const content = props.content as PresetNode[] | undefined;
  if (!Array.isArray(content)) return;
  for (const node of content) {
    out.push(node);
    if (node.props) collectNodes(node.props, out);
  }
}

function allNodes(preset: Record<string, unknown>): PresetNode[] {
  const out: PresetNode[] = [];
  collectNodes(preset, out);
  return out;
}

describe("gallery/featured/video preset compositions", () => {
  it("every export has backgroundImages: [] and non-empty content", () => {
    for (const [name, preset] of Object.entries(ALL_PRESETS)) {
      const p = preset as Record<string, unknown>;
      expect(p.backgroundImages, name).toEqual([]);
      expect(Array.isArray(p.content) && (p.content as unknown[]).length > 0, name).toBe(true);
    }
  });

  it("every Columns block has an explicit minHeight", () => {
    for (const [name, preset] of Object.entries(ALL_PRESETS)) {
      const nodes = allNodes(preset as Record<string, unknown>);
      for (const node of nodes) {
        if (node.type === "Columns") {
          expect(node.props.minHeight, `${name} Columns.minHeight`).toBeDefined();
        }
      }
    }
  });

  it("no child colSpan exceeds its parent Columns' columns count", () => {
    function walk(props: Record<string, unknown>, name: string) {
      const content = props.content as PresetNode[] | undefined;
      if (!Array.isArray(content)) return;
      const parentColumns = typeof props.columns === "number" ? props.columns : undefined;
      for (const node of content) {
        if (parentColumns !== undefined) {
          const style = node.props?._style as Record<string, unknown> | undefined;
          const colSpan = style?.colSpan as number | undefined;
          if (typeof colSpan === "number") {
            expect(colSpan, `${name} ${node.type} colSpan vs parent columns=${parentColumns}`).toBeLessThanOrEqual(
              parentColumns,
            );
          }
        }
        if (node.props) walk(node.props, name);
      }
    }
    for (const [name, preset] of Object.entries(ALL_PRESETS)) {
      walk(preset as Record<string, unknown>, name);
    }
  });

  it("no GalleryGrid/GalleryMasonry/FeaturedWork child carries stale top-level layout props", () => {
    const galleryTypes = new Set(["GalleryGrid", "GalleryMasonry"]);
    const layoutTypes = new Set(["GalleryGrid", "GalleryMasonry", "FeaturedWork"]);
    for (const [name, preset] of Object.entries(ALL_PRESETS)) {
      const nodes = allNodes(preset as Record<string, unknown>);
      for (const node of nodes) {
        if (!layoutTypes.has(node.type)) continue;
        expect(node.props.columns, `${name} ${node.type}.columns`).toBeUndefined();
        expect(node.props.gap, `${name} ${node.type}.gap`).toBeUndefined();
        expect(node.props.collectionId, `${name} ${node.type}.collectionId`).toBeUndefined();
        expect(node.props.maxItems, `${name} ${node.type}.maxItems`).toBeUndefined();
        const style = node.props._style as Record<string, unknown> | undefined;
        expect(style?.galleryColumns, `${name} ${node.type}._style.galleryColumns`).toBeDefined();
        if (galleryTypes.has(node.type)) {
          expect(style?.galleryGap, `${name} ${node.type}._style.galleryGap`).toBeDefined();
        }
      }
    }
  });

  it("full-bleed variants contain a Columns with overallWidth: 'full'; page-fit variants do not", () => {
    const fullVariants = [GALLERY_GRID_FULL_PRESET, GALLERY_MASONRY_WALL_PRESET, VIDEO_CINEMA_PRESET];
    for (const preset of fullVariants) {
      const nodes = allNodes(preset as unknown as Record<string, unknown>);
      const hasFull = nodes.some((n) => n.type === "Columns" && n.props.overallWidth === "full");
      expect(hasFull).toBe(true);
    }

    const pageFitVariants = [
      GALLERY_GRID_PRESET,
      GALLERY_GRID_FRAMED_PRESET,
      GALLERY_MASONRY_PRESET,
      GALLERY_MASONRY_JOURNAL_PRESET,
      VIDEO_PRESET,
      VIDEO_SPLIT_PRESET,
    ];
    for (const preset of pageFitVariants) {
      const nodes = allNodes(preset as unknown as Record<string, unknown>);
      const hasFull = nodes.some((n) => n.type === "Columns" && n.props.overallWidth === "full");
      expect(hasFull).toBe(false);
    }
  });

  it("every GalleryMasonry preset variant turns on _style.galleryStagger", () => {
    const masonryPresets = [GALLERY_MASONRY_PRESET, GALLERY_MASONRY_WALL_PRESET, GALLERY_MASONRY_JOURNAL_PRESET];
    for (const preset of masonryPresets) {
      const nodes = allNodes(preset as unknown as Record<string, unknown>).filter((n) => n.type === "GalleryMasonry");
      expect(nodes.length).toBeGreaterThan(0);
      for (const node of nodes) {
        const style = node.props._style as Record<string, unknown> | undefined;
        expect(style?.galleryStagger).toBe(true);
      }
    }
  });

  it("FEATURED_WORK_LEAD_PRESET uses CollectionCard at 3/2, FEATURED_WORK_INDEX_PRESET at 1/1", () => {
    const leadCards = allNodes(FEATURED_WORK_LEAD_PRESET as unknown as Record<string, unknown>).filter(
      (n) => n.type === "CollectionCard",
    );
    expect(leadCards.length).toBeGreaterThan(0);
    for (const card of leadCards) {
      expect(card.props.aspectRatio).toBe("3 / 2");
    }

    const indexCards = allNodes(FEATURED_WORK_INDEX_PRESET as unknown as Record<string, unknown>).filter(
      (n) => n.type === "CollectionCard",
    );
    expect(indexCards.length).toBeGreaterThan(0);
    for (const card of indexCards) {
      expect(card.props.aspectRatio).toBe("1 / 1");
    }
  });

  it("GALLERY_LANDING_PRESET sets overlayColorToken: 'primary' and no landing variant has a Button", () => {
    expect((GALLERY_LANDING_PRESET as unknown as Record<string, unknown>).overlayColorToken).toBe("primary");

    const landingVariants = [
      GALLERY_LANDING_PRESET,
      GALLERY_LANDING_SPLIT_PRESET,
      GALLERY_LANDING_MASTHEAD_PRESET,
    ];
    for (const preset of landingVariants) {
      const nodes = allNodes(preset as unknown as Record<string, unknown>);
      expect(nodes.some((n) => n.type === "Button")).toBe(false);
    }
  });
});
