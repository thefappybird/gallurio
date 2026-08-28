/**
 * Gallery masonry section presets — an editorial, uneven-row layout of a single
 * collection's images.
 */

import type { ContainerBlockProps } from "../manualBlocks";
import { child, slot, pageSection } from "./_helpers";

export const GALLERY_MASONRY_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  overlayOpacity: 0,
  minHeight: "auto",
  alignX: "left",
  alignY: "top",
  content: slot([
    child("Heading", { level: "h2", text: "Story gallery" }),
    child("Text", { text: "A more editorial layout for one collection." }),
    child("GalleryMasonry", { images: [], _style: { galleryColumns: 3, galleryGap: "normal" } }),
  ]),
};

export const GALLERY_MASONRY_WALL_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  minHeight: "auto",
  _style: {
    ...pageSection,
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
        child("GalleryMasonry", { images: [], _style: { galleryColumns: 4, galleryGap: "tight" } }),
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
          _style: { gap: 14 },
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
          images: [],
          _style: { colSpan: 3, galleryColumns: 2, galleryGap: "normal" },
        }),
      ]),
    }),
  ]),
};
