/**
 * Gallery landing section presets — the cover section for the Gallery page.
 * No variant in this group carries a Button (this is a cover, not a CTA).
 */

import type { ContainerBlockProps } from "../manualBlocks";
import { child, onDark, pageSection, primaryBandSection, slot } from "./_helpers";

/**
 * Gallery landing — a medium-height, full-bleed hero-style container for the
 * Gallery page. Supports multi-image background (slideshow). No button.
 */
export const GALLERY_LANDING_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  overlayOpacity: 40,
  // Same 3.45:1 Luxury contrast failure as the Hero preset: the copy is pinned
  // to the background token, near-black on Luxury. Primary is background's
  // guaranteed opposite in all six kits.
  overlayColorToken: "primary",
  minHeight: "medium",
  alignX: "center",
  alignY: "center",
  _style: { bgColorToken: "accent" },
  content: slot([
    child("Heading", { level: "h2", text: "Our gallery", _style: { ...onDark, bold: true } }),
    child("Text", { text: "A curated look at our work.", _style: onDark }),
  ]),
};

export const GALLERY_LANDING_SPLIT_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  minHeight: "auto",
  _style: { ...pageSection, gap: 0, paddingTop: "3rem", paddingBottom: "3rem" },
  content: slot([
    child("Columns", {
      columns: 2,
      minHeight: "0px",
      _style: { gap: 40 },
      content: slot([
        child("Container", {
          backgroundImages: [],
          _style: {
            ...primaryBandSection,
            gap: 16,
            paddingTop: "2rem",
            paddingRight: "2rem",
            paddingBottom: "2rem",
            paddingLeft: "2rem",
            contentVerticalDistribution: "center",
          },
          content: slot([
            child("Heading", { level: "h2", text: "Our gallery" }),
            child("Text", { text: "A curated look at our work." }),
            child("Divider", {
              thickness: 1,
              _style: { width: "3rem", paddingLeft: "0px", paddingRight: "0px" },
            }),
          ]),
        }),
        child("Image", { alt: "Signature photograph" }),
      ]),
    }),
  ]),
};

export const GALLERY_LANDING_MASTHEAD_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  minHeight: "auto",
  alignX: "left",
  _style: { ...primaryBandSection, gap: 20, paddingTop: "3.5rem", paddingBottom: "3.5rem" },
  content: slot([
    child("Heading", { level: "h2", text: "Our gallery", _style: { bold: true } }),
    child("Text", { text: "A curated look at our work." }),
    child("Divider", { thickness: 1, _style: { paddingLeft: "0px", paddingRight: "0px" } }),
  ]),
};
