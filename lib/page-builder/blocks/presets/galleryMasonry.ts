/**
 * Gallery masonry section presets — an editorial, uneven-row layout of a single
 * collection's images.
 */

import type { ContainerBlockProps } from "../manualBlocks";
import { accentBandSection, child, pageSection, primaryBandSection, slot } from "./_helpers";

const masonryColumns = (heights: readonly string[], columns: 2 | 3 | 4) => {
  const lanes = Array.from({ length: columns }, () => [] as string[]);
  heights.forEach((height, index) => lanes[index % columns].push(height));
  return Object.fromEntries(
    lanes.map((lane, index) => [
      `column${index + 1}`,
      slot(lane.map((height) => child("Image", { alt: "", _style: { height } }))),
    ]),
  );
};

export const GALLERY_MASONRY_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  overlayOpacity: 0,
  minHeight: "auto",
  alignX: "left",
  alignY: "top",
  _style: pageSection,
  content: slot([
    child("Heading", { level: "h2", text: "Story gallery" }),
    child("Text", { text: "A more editorial layout for one collection." }),
    child("GalleryMasonry", {
      masonryLayout: "columns",
      ...masonryColumns(["15rem", "22rem", "18rem", "25rem", "17rem", "21rem"], 3),
      _style: { galleryColumns: 3, galleryGap: "normal" },
    }),
  ]),
};

export const GALLERY_MASONRY_WALL_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  minHeight: "auto",
  _style: {
    ...primaryBandSection,
    gap: 16,
    paddingLeft: "0px",
    paddingRight: "0px",
    paddingTop: "2.5rem",
    paddingBottom: "2.5rem",
  },
  content: slot([
    child("Heading", {
      level: "h2",
      text: "Story gallery",
      _style: { paddingLeft: "1.5rem", paddingRight: "1.5rem" },
    }),
    child("Columns", {
      columns: 1,
      overallWidth: "full",
      minHeight: "0px",
      _style: { paddingLeft: "0px", paddingRight: "0px" },
      content: slot([
        child("GalleryMasonry", {
          masonryLayout: "columns",
          ...masonryColumns(["17rem", "25rem", "20rem", "28rem", "22rem", "16rem", "24rem", "19rem"], 4),
          _style: { galleryColumns: 4, galleryGap: "tight" },
        }),
      ]),
    }),
  ]),
};

export const GALLERY_MASONRY_JOURNAL_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  minHeight: "auto",
  _style: { ...pageSection, gap: 0 },
  content: slot([
    child("Columns", {
      columns: 4,
      minHeight: "0px",
      _style: { gap: 40 },
      content: slot([
        child("Container", {
          backgroundImages: [],
          _style: {
            ...accentBandSection,
            gap: 14,
            paddingTop: "2rem",
            paddingRight: "2rem",
            paddingBottom: "2rem",
            paddingLeft: "2rem",
          },
          content: slot([
            child("Heading", { level: "h2", text: "Story gallery" }),
            child("Text", { text: "A more editorial layout for one collection." }),
            child("Divider", {
              thickness: 1,
              _style: { width: "3rem", paddingLeft: "0px", paddingRight: "0px" },
            }),
            child("Text", {
              text: "Shot over two days in Batangas, mostly at the hour when the light stops behaving.",
            }),
          ]),
        }),
        child("GalleryMasonry", {
          masonryLayout: "columns",
          ...masonryColumns(["17rem", "25rem", "20rem", "28rem", "22rem", "16rem"], 2),
          _style: { colSpan: 3, galleryColumns: 2, galleryGap: "normal" },
        }),
      ]),
    }),
  ]),
};
