/**
 * Gallery grid section presets — a straight grid of a single collection's images.
 */

import type { ContainerBlockProps } from "../manualBlocks";
import {
  accentBandSection,
  child,
  hairlineFrame,
  pageFitColumns,
  pageSection,
  primaryBandSection,
  slot,
} from "./_helpers";

// Keep each photograph as a first-class Image block. This makes every preset
// editable with the same picker, crop/size controls, and drag ordering as a
// hand-built gallery instead of hiding an opaque image array inside a grid.
const gridImages = (count: number) =>
  slot(Array.from({ length: count }, () => child("Image", { alt: "" })));

export const GALLERY_GRID_PRESET: ContainerBlockProps = {
  overlayOpacity: 0,
  minHeight: "auto",
  alignX: "left",
  alignY: "top",
  _style: pageSection,
  content: slot([
    child("Heading", { level: "h2", text: "Gallery highlights" }),
    child("Text", { text: "A curated selection from one collection." }),
    child("GalleryGrid", { content: gridImages(6), _style: { galleryColumns: 3, galleryGap: "normal" } }),
  ]),
};

export const GALLERY_GRID_FULL_PRESET: ContainerBlockProps = {
  minHeight: "auto",
  _style: {
    ...primaryBandSection,
    gap: 20,
    paddingLeft: "0px",
    paddingRight: "0px",
    paddingTop: "3rem",
    paddingBottom: "3rem",
  },
  content: slot([
    child("Heading", {
      level: "h2",
      text: "Gallery highlights",
      _style: { paddingLeft: "1.5rem", paddingRight: "1.5rem" },
    }),
    pageFitColumns({
      columns: 1,
      overallWidth: "full",
      minHeight: "0px",
      _style: { paddingLeft: "0px", paddingRight: "0px" },
      content: slot([
        child("GalleryGrid", { content: gridImages(8), _style: { galleryColumns: 4, galleryGap: "tight" } }),
      ]),
    }),
  ]),
};

export const GALLERY_GRID_FRAMED_PRESET: ContainerBlockProps = {
  minHeight: "auto",
  _style: { ...pageSection, gap: 0 },
  content: slot([
    pageFitColumns({
      columns: 4,
      minHeight: "0px",
      _style: { gap: 40 },
      content: slot([
        child("GalleryGrid", {
          content: gridImages(6),
          _style: {
            ...hairlineFrame,
            colSpan: 3,
            galleryColumns: 3,
            galleryGap: "normal",
            paddingTop: "1.5rem",
            paddingRight: "1.5rem",
            paddingBottom: "1.5rem",
            paddingLeft: "1.5rem",
          },
        }),
        child("Container", {
          _style: {
            ...accentBandSection,
            gap: 14,
            paddingTop: "2rem",
            paddingRight: "2rem",
            paddingBottom: "2rem",
            paddingLeft: "2rem",
          },
          content: slot([
            child("Heading", { level: "h2", text: "Gallery highlights" }),
            child("Text", { text: "A curated selection from one collection." }),
            child("Divider", {
              thickness: 1,
              _style: { width: "3rem", paddingLeft: "0px", paddingRight: "0px" },
            }),
            child("Text", { text: "Six frames, hand-picked from the full set." }),
          ]),
        }),
      ]),
    }),
  ]),
};
