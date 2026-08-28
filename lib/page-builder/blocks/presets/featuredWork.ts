/**
 * Featured work section presets — multi-collection navigation surfaces.
 */

import type { ContainerBlockProps } from "../manualBlocks";
import { child, slot, pageSection, primaryBandSection } from "./_helpers";

export const FEATURED_WORK_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  overlayOpacity: 0,
  minHeight: "auto",
  alignX: "left",
  alignY: "top",
  // Same reasoning as SERVICES_PRESET — pin to the theme's own background so
  // unstyled (default-foreground) text stays legible on dark themes.
  _style: pageSection,
  content: slot([
    child("Heading", { level: "h2", text: "Featured work" }),
    child("Text", { text: "Spotlight a few signature images." }),
    child("FeaturedWork", { collections: [], _style: { galleryColumns: 3 } }),
  ]),
};

export const FEATURED_WORK_LEAD_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  minHeight: "auto",
  _style: { ...pageSection, gap: 32 },
  content: slot([
    child("Heading", { level: "h2", text: "Featured work" }),
    child("Text", { text: "Two projects that say most of what I'd want to say in a first meeting." }),
    child("Columns", {
      columns: 2,
      minHeight: "0px",
      _style: { gap: 24 },
      content: slot([
        child("CollectionCard", { aspectRatio: "3 / 2", showCaption: true }),
        child("CollectionCard", { aspectRatio: "3 / 2", showCaption: true }),
      ]),
    }),
  ]),
};

export const FEATURED_WORK_INDEX_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  minHeight: "auto",
  _style: { ...primaryBandSection, gap: 24, paddingTop: "3rem", paddingBottom: "3rem" },
  content: slot([
    child("Columns", {
      columns: 2,
      minHeight: "0px",
      _style: { gap: 16 },
      content: slot([
        child("Heading", { level: "h2", text: "Featured work" }),
        child("Text", { text: "Four collections", _style: { align: "right" } }),
      ]),
    }),
    child("Columns", {
      columns: 4,
      minHeight: "0px",
      _style: { gap: 16 },
      content: slot([
        child("CollectionCard", { aspectRatio: "1 / 1", showCaption: true }),
        child("CollectionCard", { aspectRatio: "1 / 1", showCaption: true }),
        child("CollectionCard", { aspectRatio: "1 / 1", showCaption: true }),
        child("CollectionCard", { aspectRatio: "1 / 1", showCaption: true }),
      ]),
    }),
  ]),
};
