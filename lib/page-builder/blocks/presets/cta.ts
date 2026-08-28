/**
 * Call-to-action section presets — closing prompts to book or inquire.
 */

import type { ContainerBlockProps } from "../manualBlocks";
import { child, slot, onDark, onAccentBand, pageSection } from "./_helpers";

export const CTA_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  overlayOpacity: 0,
  minHeight: "medium",
  alignX: "center",
  alignY: "center",
  _style: { bgColorToken: "accent" },
  content: slot([
    child("Heading", { level: "h2", text: "Ready to book your session?", _style: onDark }),
    child("Text", { text: "Let's create something beautiful together.", _style: onDark }),
    child("Button", { label: "Get in Touch", action: "open-contact", align: "center", _style: onAccentBand }),
  ]),
};

export const CTA_IMAGE_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  minHeight: "short",
  alignX: "left",
  alignY: "center",
  overlayOpacity: 62,
  overlayColorToken: "primary",
  _style: { bgColorToken: "accent", gap: 18 },
  content: slot([
    child("Heading", { level: "h2", text: "Ready to book your session?", _style: onDark }),
    child("Text", { text: "Let's create something beautiful together.", _style: onDark }),
    child("Button", { label: "Get in Touch", action: "open-contact", align: "left", _style: onAccentBand }),
  ]),
};

export const CTA_MINIMAL_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  minHeight: "auto",
  _style: { ...pageSection, gap: 28, paddingTop: "3rem", paddingBottom: "3rem" },
  content: slot([
    child("Divider", { thickness: 1, _style: { paddingLeft: "0px", paddingRight: "0px" } }),
    child("Columns", {
      columns: 2,
      minHeight: "0px",
      _style: { gap: 32 },
      content: slot([
        child("Heading", { level: "h2", text: "Ready to book your session?" }),
        child("Button", { label: "Get in Touch", action: "open-contact", align: "right", _style: { cellVerticalAlign: "center" } }),
      ]),
    }),
  ]),
};
