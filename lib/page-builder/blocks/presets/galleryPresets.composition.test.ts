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
  it("every export has an empty backgroundImages seed (or none) and non-empty content", () => {
    // Photo Grid / Masonry presets stopped seeding `backgroundImages: []` — the
    // wrapping Container's own defaultProps already supplies it. Absent and `[]`
    // are equivalent here; either way no preset ships stray background data.
    for (const [name, preset] of Object.entries(ALL_PRESETS)) {
      const p = preset as Record<string, unknown>;
      expect(p.backgroundImages ?? [], name).toEqual([]);
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

  it("no GalleryGrid/GalleryMasonry child carries stale top-level layout props", () => {
    const galleryTypes = new Set(["GalleryGrid", "GalleryMasonry"]);
    const layoutTypes = galleryTypes;
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

  it("wraps every root-level Columns grid in a page-fit Container and makes the grid fill it", () => {
    for (const [name, preset] of Object.entries(ALL_PRESETS)) {
      const root = preset as Record<string, unknown>;
      const topLevel = root.content as PresetNode[];
      expect(topLevel.some((node) => node.type === "Columns"), `${name} exposes Columns directly`).toBe(false);

      for (const wrapper of topLevel) {
        const content = wrapper.props.content as PresetNode[] | undefined;
        if (wrapper.type !== "Container" || !Array.isArray(content) || content.length !== 1 || content[0].type !== "Columns") continue;
        expect(wrapper.props.overallWidth, `${name} Columns wrapper`).toBe("page-fit");
        expect(content[0].props.overallWidth, `${name} wrapped Columns`).toBe("full");
      }
    }
  });

  it("every GalleryMasonry preset uses Image-only column lanes", () => {
    const masonryPresets = [GALLERY_MASONRY_PRESET, GALLERY_MASONRY_WALL_PRESET, GALLERY_MASONRY_JOURNAL_PRESET];
    for (const preset of masonryPresets) {
      const nodes = allNodes(preset as unknown as Record<string, unknown>).filter((n) => n.type === "GalleryMasonry");
      expect(nodes.length).toBeGreaterThan(0);
      for (const node of nodes) {
        const style = node.props._style as Record<string, unknown> | undefined;
        expect(style?.galleryStagger).toBeUndefined();
        expect(node.props.masonryLayout).toBe("columns");
        expect(node.props.content).toBeUndefined();
        const columns = (style?.galleryColumns as number | undefined) ?? 3;
        for (let index = 1; index <= columns; index += 1) {
          const lane = node.props[`column${index}`] as PresetNode[];
          expect(lane.length).toBeGreaterThan(0);
          expect(lane.every((child) => child.type === "Image")).toBe(true);
        }
      }
    }
  });

  it("seeds every grid and masonry gallery with independently editable Image blocks", () => {
    const galleryPresets = [
      GALLERY_GRID_PRESET,
      GALLERY_GRID_FULL_PRESET,
      GALLERY_GRID_FRAMED_PRESET,
      GALLERY_MASONRY_PRESET,
      GALLERY_MASONRY_WALL_PRESET,
      GALLERY_MASONRY_JOURNAL_PRESET,
    ];
    for (const preset of galleryPresets) {
      const galleries = allNodes(preset as unknown as Record<string, unknown>).filter(
        (node) => node.type === "GalleryGrid" || node.type === "GalleryMasonry",
      );
      for (const gallery of galleries) {
        expect(gallery.props.images).toBeUndefined();
        if (gallery.type === "GalleryGrid") {
          const content = gallery.props.content as PresetNode[];
          expect(content.length).toBeGreaterThan(0);
          expect(content.every((node) => node.type === "Image")).toBe(true);
        } else {
          const style = gallery.props._style as Record<string, unknown> | undefined;
          const columns = (style?.galleryColumns as number | undefined) ?? 3;
          const laneImages = Array.from({ length: columns }, (_, index) => gallery.props[`column${index + 1}`] as PresetNode[]).flat();
          expect(laneImages.length).toBeGreaterThan(0);
          expect(laneImages.every((node) => node.type === "Image")).toBe(true);
        }
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

  it("FEATURED_WORK_PRESET uses a three-column, draggable CollectionCard container", () => {
    const nodes = allNodes(FEATURED_WORK_PRESET as unknown as Record<string, unknown>);
    expect(nodes.some((node) => node.type === "FeaturedWork")).toBe(false);
    const columns = nodes.find((node) => node.type === "Columns" && node.props.columns === 3);
    expect(columns).toBeDefined();
    const cards = (columns?.props.content as PresetNode[]) ?? [];
    expect(cards).toHaveLength(3);
    expect(cards.every((node) => node.type === "CollectionCard")).toBe(true);
  });

  it("enables loop and alternating tile rhythm for the Wall and Journal masonry presets", () => {
    for (const preset of [GALLERY_MASONRY_WALL_PRESET, GALLERY_MASONRY_JOURNAL_PRESET]) {
      const masonry = allNodes(preset as unknown as Record<string, unknown>).find((node) => node.type === "GalleryMasonry")!;
      expect(masonry.props.masonryLoop).toBe(true);
      expect((masonry.props._style as Record<string, unknown>).masonryHeightPattern).toBe("alternating");
      const columns = (masonry.props._style as Record<string, unknown>).galleryColumns as number;
      for (let index = 1; index <= columns; index += 1) {
        expect((masonry.props[`column${index}`] as PresetNode[])).toHaveLength(3);
      }
    }
  });

  it.each([
    ["FEATURED_WORK_PRESET", FEATURED_WORK_PRESET],
    ["FEATURED_WORK_LEAD_PRESET", FEATURED_WORK_LEAD_PRESET],
    ["FEATURED_WORK_INDEX_PRESET", FEATURED_WORK_INDEX_PRESET],
  ] as const)("%s wraps its collection Columns in a page-fit Container and fills that Container", (_name, preset) => {
    const wrappers = allNodes(preset as unknown as Record<string, unknown>).filter((node) => {
      const content = node.props.content as PresetNode[] | undefined;
      return node.type === "Container"
        && node.props.overallWidth === "page-fit"
        && Array.isArray(content)
        && content.length === 1
        && content[0].type === "Columns";
    });

    expect(wrappers).toHaveLength(1);
    const columns = (wrappers[0].props.content as PresetNode[])[0];
    expect(columns.props.overallWidth).toBe("full");
  });

  it("GALLERY_LANDING_SPLIT_PRESET is page-fit, not full-bleed (item 6)", () => {
    expect((GALLERY_LANDING_SPLIT_PRESET as unknown as Record<string, unknown>).overallWidth).toBe(
      "page-fit",
    );
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

  it("makes both video presets medium and removes the Cinema preset's obsolete Columns wrapper", () => {
    const video = allNodes(VIDEO_PRESET as unknown as Record<string, unknown>).find((node) => node.type === "Video");
    const cinema = allNodes(VIDEO_CINEMA_PRESET as unknown as Record<string, unknown>).find((node) => node.type === "Video");
    expect(video?.props.size).toBe("md");
    expect(cinema?.props.size).toBe("md");
    expect(allNodes(VIDEO_CINEMA_PRESET as unknown as Record<string, unknown>).some((node) => node.type === "Columns")).toBe(false);
  });
});
