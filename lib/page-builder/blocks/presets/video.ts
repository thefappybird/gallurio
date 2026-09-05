/**
 * Video section presets — a short film for the About/Home page.
 */

import type { ContainerBlockProps } from "../manualBlocks";
import {
  accentBandSection,
  child,
  onAccentBand,
  pageSection,
  primaryBandSection,
  slot,
} from "./_helpers";

/**
 * Video preset — header + description + video. Built on Container like every
 * other preset (NOT a bespoke wrapper) so its Content/Design/Layout tabs expose
 * the full Container style surface (background/background-image incl. opacity,
 * padding, min-height, border, shadow, radius, colSpan/rowSpan, overlay) —
 * matching every other preset's style surface exactly.
 */
export const VIDEO_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  overlayOpacity: 0,
  minHeight: "auto",
  alignX: "center",
  alignY: "top",
  _style: pageSection,
  content: slot([
    child("Heading", { level: "h2", text: "Watch our story" }),
    child("Text", { text: "A short film capturing the moments that matter most." }),
    child("Video", { videoUrl: "" }),
  ]),
};

export const VIDEO_SPLIT_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  minHeight: "auto",
  _style: { ...pageSection, gap: 0 },
  content: slot([
    child("Columns", {
      columns: 3,
      minHeight: "0px",
      _style: { gap: 40 },
      content: slot([
        child("Video", { videoUrl: "", _style: { colSpan: 2, cellVerticalAlign: "center" } }),
        child("Container", {
          backgroundImages: [],
          _style: {
            ...accentBandSection,
            gap: 16,
            paddingTop: "2rem",
            paddingRight: "2rem",
            paddingBottom: "2rem",
            paddingLeft: "2rem",
            contentVerticalDistribution: "center",
          },
          content: slot([
            child("Heading", { level: "h2", text: "Watch our story" }),
            child("Text", { text: "A short film capturing the moments that matter most." }),
            child("Button", {
              label: "Get in Touch",
              action: "open-contact",
              align: "left",
              size: "sm",
              _style: onAccentBand,
            }),
          ]),
        }),
      ]),
    }),
  ]),
};

export const VIDEO_CINEMA_PRESET: ContainerBlockProps = {
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
    child("Columns", {
      columns: 1,
      overallWidth: "full",
      minHeight: "0px",
      _style: { paddingLeft: "0px", paddingRight: "0px" },
      content: slot([child("Video", { videoUrl: "" })]),
    }),
    child("Container", {
      backgroundImages: [],
      _style: {
        gap: 6,
        contentHorizontalAlign: "center",
        paddingLeft: "1.5rem",
        paddingRight: "1.5rem",
      },
      content: slot([
        child("Heading", { level: "h3", text: "Watch our story" }),
        child("Text", { text: "A short film capturing the moments that matter most." }),
      ]),
    }),
  ]),
};
