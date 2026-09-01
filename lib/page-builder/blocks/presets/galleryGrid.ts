/**
 * Gallery grid section presets — a straight grid of a single collection's images.
 */

import type { ContainerBlockProps } from "../manualBlocks";
import {
  accentBandSection,
  child,
  hairlineFrame,
  pageInsetSection,
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
    child("Columns", {
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
  _style: { ...accentBandSection, gap: 0, paddingTop: "3rem", paddingBottom: "3rem" },
  content: slot([
    child("Container", {
      _style: {
        ...pageInsetSection,
        ...hairlineFrame,
        gap: 28,
        paddingTop: "2.5rem",
        paddingRight: "2.5rem",
        paddingBottom: "2.5rem",
        paddingLeft: "2.5rem",
        contentHorizontalAlign: "center",
      },
      content: slot([
        child("Heading", { level: "h2", text: "Gallery highlights" }),
        child("Text", { text: "A curated selection from one collection." }),
        child("GalleryGrid", { content: gridImages(4), _style: { galleryColumns: 2, galleryGap: "loose" } }),
      ]),
    }),
  ]),
};
