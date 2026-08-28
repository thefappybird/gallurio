/**
 * About section presets — the studio/photographer biography.
 */

import type { ContainerBlockProps } from "../manualBlocks";
import { child, slot, pageSection } from "./_helpers";

const BIO_TEXT =
  "I'm a passionate photographer based in Manila, capturing life's most meaningful moments.\n\nWith over a decade of experience, I bring artistry and technical expertise to every session.";

export const ABOUT_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  overlayOpacity: 0,
  minHeight: "auto",
  alignX: "left",
  alignY: "top",
  content: slot([
    child("Heading", { level: "h2", text: "About Me" }),
    child("Text", { text: BIO_TEXT }),
  ]),
};

export const ABOUT_PORTRAIT_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  minHeight: "auto",
  _style: { ...pageSection, gap: 0 },
  content: slot([
    child("Columns", {
      columns: 2,
      minHeight: "0px",
      _style: { gap: 40 },
      content: slot([
        child("Image", { alt: "Portrait of the photographer", _style: { cellVerticalAlign: "start" } }),
        child("Container", {
          _style: { gap: 16, contentVerticalDistribution: "center" },
          content: slot([
            child("Heading", { level: "h2", text: "About Me" }),
            child("Text", { text: BIO_TEXT }),
            child("Button", { label: "Get in Touch", action: "open-contact", align: "left", size: "sm" }),
          ]),
        }),
      ]),
    }),
  ]),
};

export const ABOUT_PROFILE_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  minHeight: "auto",
  _style: { ...pageSection, gap: 0 },
  content: slot([
    child("Columns", {
      columns: 3,
      minHeight: "0px",
      _style: { gap: 40 },
      content: slot([
        child("Container", {
          _style: { colSpan: 2, gap: 16 },
          content: slot([
            child("Heading", { level: "h2", text: "About Me" }),
            child("Text", { text: BIO_TEXT }),
          ]),
        }),
        child("Container", {
          _style: { gap: 14 },
          content: slot([
            child("Heading", { level: "h4", text: "Based in" }),
            child("Text", { text: "Makati City" }),
            child("Heading", { level: "h4", text: "Working since" }),
            child("Text", { text: "2016" }),
            child("Heading", { level: "h4", text: "Specialty" }),
            child("Text", { text: "Weddings and portraits" }),
            child("Heading", { level: "h4", text: "Travel" }),
            child("Text", { text: "Nationwide" }),
          ]),
        }),
      ]),
    }),
  ]),
};
