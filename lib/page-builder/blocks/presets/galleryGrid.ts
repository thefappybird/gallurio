/**
 * Gallery grid section presets — a straight grid of a single collection's images.
 */

import type { ContainerBlockProps } from "../manualBlocks";
import { child, slot, pageSection, hairlineFrame } from "./_helpers";

export const GALLERY_GRID_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  overlayOpacity: 0,
  minHeight: "auto",
  alignX: "left",
  alignY: "top",
  content: slot([
    child("Heading", { level: "h2", text: "Gallery highlights" }),
    child("Text", { text: "A curated selection from one collection." }),
    child("GalleryGrid", { images: [], _style: { galleryColumns: 3, galleryGap: "normal" } }),
  ]),
};

export const GALLERY_GRID_FULL_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  minHeight: "auto",
  _style: {
    ...pageSection,
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
        child("GalleryGrid", { images: [], _style: { galleryColumns: 4, galleryGap: "tight" } }),
      ]),
    }),
  ]),
};

export const GALLERY_GRID_FRAMED_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  minHeight: "auto",
  _style: { ...pageSection, gap: 0, paddingTop: "3rem", paddingBottom: "3rem" },
  content: slot([
    child("Container", {
      backgroundImages: [],
      _style: {
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
        child("GalleryGrid", { images: [], _style: { galleryColumns: 2, galleryGap: "loose" } }),
      ]),
    }),
  ]),
};
