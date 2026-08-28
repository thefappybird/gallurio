/**
 * Hero section presets — the top-of-page cover for the Home page.
 */

import type { ContainerBlockProps } from "../manualBlocks";
import { child, slot, onDark, onAccentBand, pageSection } from "./_helpers";

export const HERO_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  overlayOpacity: 50,
  overlayColorToken: "primary",
  minHeight: "tall",
  alignX: "center",
  alignY: "center",
  _style: { bgColorToken: "accent" },
  content: slot([
    child("Heading", { level: "h1", text: "Capturing moments that last forever", _style: { ...onDark, bold: true } }),
    child("Text", { text: "Fine art photography for weddings, portraits, and events.", _style: onDark }),
    child("Button", { label: "Get in Touch", action: "open-contact", align: "center", _style: onAccentBand }),
  ]),
};

export const HERO_SPLIT_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  minHeight: "medium",
  alignY: "center",
  _style: { ...pageSection, gap: 0 },
  content: slot([
    child("Columns", {
      columns: 2,
      minHeight: "0px",
      _style: { gap: 40 },
      content: slot([
        child("Container", {
          minHeight: "auto",
          _style: { gap: 22, contentVerticalDistribution: "center" },
          content: slot([
            child("Heading", { level: "h1", text: "Capturing moments that last forever" }),
            child("Text", { text: "Fine art photography for weddings, portraits, and events across Metro Manila." }),
            child("Button", { label: "Get in Touch", action: "open-contact", align: "left" }),
          ]),
        }),
        child("Image", { alt: "Studio portrait", _style: { height: "100%", cellVerticalAlign: "stretch" } }),
      ]),
    }),
  ]),
};

export const HERO_STATEMENT_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  minHeight: "medium",
  alignX: "left",
  alignY: "center",
  _style: { ...pageSection, gap: 28 },
  content: slot([
    child("Heading", { level: "h1", text: "Capturing moments that last forever", _style: { bold: true } }),
    child("Divider", { thickness: 1, _style: { width: "8rem", paddingLeft: "0px", paddingRight: "0px" } }),
    child("Text", { text: "Fine art photography for weddings, portraits, and events." }),
    child("Button", { label: "Get in Touch", action: "open-contact", align: "left", size: "sm" }),
  ]),
};
