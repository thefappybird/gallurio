/**
 * Footer section presets — closing identity, navigation, and legal line.
 */

import type { ContainerBlockProps } from "../manualBlocks";
import type { ChromeKind } from "../../chromeSync";
import {
  accentBandSection,
  child,
  onPrimaryBand,
  pageSection,
  primaryBandSection,
  slot,
} from "./_helpers";

// Footer presets stay Container-shaped; `_chrome`/`detached` are the only
// additions, marking them for chromeSync's home/gallery mirroring (a later
// EditorShell wave wires the sync itself — this only carries the markers).
type FooterPresetProps = ContainerBlockProps & { _chrome?: ChromeKind; detached?: boolean };

export const FOOTER_SIGNATURE_PRESET: FooterPresetProps = {
  _chrome: "footer",
  overallWidth: "full",
  backgroundImages: [],
  minHeight: "auto",
  alignX: "center",
  _style: { ...accentBandSection, gap: 20, paddingTop: "2.5rem", paddingBottom: "2.5rem" },
  content: slot([
    child("Divider", { thickness: 1, _style: { paddingLeft: "0px", paddingRight: "0px" } }),
    child("Heading", { level: "h3", text: "Lumen Studio" }),
    child("Text", { text: "Fine art photography · Manila" }),
    child("Container", {
      _style: { flexDirection: "row", contentVerticalDistribution: "center", gap: 20 },
      content: slot([
        child("Button", { label: "Home", action: "go-to-home", align: "center", size: "sm", _style: { buttonStyle: "link", marginLeft: "0px", marginRight: "0px" } }),
        child("Button", { label: "Gallery", action: "go-to-gallery", align: "center", size: "sm", _style: { buttonStyle: "link", marginLeft: "0px", marginRight: "0px" } }),
        child("Button", { label: "Contact", action: "open-contact", align: "center", size: "sm", _style: { buttonStyle: "link", marginLeft: "0px", marginRight: "0px" } }),
      ]),
    }),
  ]),
};

export const FOOTER_DIRECTORY_PRESET: FooterPresetProps = {
  _chrome: "footer",
  overallWidth: "full",
  backgroundImages: [],
  minHeight: "auto",
  _style: { ...pageSection, gap: 0, paddingTop: "3rem", paddingBottom: "3rem" },
  content: slot([
    child("Divider", { thickness: 1, _style: { paddingLeft: "0px", paddingRight: "0px" } }),
    child("Columns", {
      columns: 3,
      minHeight: "0px",
      _style: { gap: 40 },
      content: slot([
        child("Container", {
          _style: { gap: 10 },
          content: slot([
            child("Heading", { level: "h3", text: "Lumen Studio" }),
            child("Text", {
              text: "Fine art photography for weddings, portraits, and events across Metro Manila.",
            }),
          ]),
        }),
        child("Container", {
          _style: { gap: 6 },
          content: slot([
            child("Heading", { level: "h4", text: "Explore" }),
            child("Button", { label: "Home", action: "go-to-home", align: "left", size: "sm", _style: { buttonStyle: "link" } }),
            child("Button", { label: "Gallery", action: "go-to-gallery", align: "left", size: "sm", _style: { buttonStyle: "link" } }),
            child("Button", { label: "Contact", action: "open-contact", align: "left", size: "sm", _style: { buttonStyle: "link" } }),
          ]),
        }),
        child("Container", {
          _style: { gap: 12 },
          content: slot([
            child("Heading", { level: "h4", text: "Studio" }),
            child("ContactDetails", {}),
          ]),
        }),
      ]),
    }),
    child("Divider", { thickness: 1, _style: { paddingLeft: "0px", paddingRight: "0px" } }),
    child("Text", { text: "© 2026 Lumen Studio" }),
  ]),
};

export const FOOTER_STATEMENT_PRESET: FooterPresetProps = {
  _chrome: "footer",
  overallWidth: "full",
  backgroundImages: [],
  minHeight: "auto",
  _style: { ...primaryBandSection, gap: 24, paddingTop: "3.5rem", paddingBottom: "3.5rem" },
  content: slot([
    child("Heading", { level: "h2", text: "Let's make something worth keeping." }),
    child("Button", { label: "Get in Touch", action: "open-contact", align: "left", _style: onPrimaryBand }),
    child("Divider", { thickness: 1, _style: { paddingLeft: "0px", paddingRight: "0px" } }),
    child("Columns", {
      columns: 2,
      minHeight: "0px",
      _style: { gap: 12 },
      content: slot([
        child("Text", { text: "© 2026 Lumen Studio. All rights reserved." }),
        child("Container", {
          _style: { flexDirection: "row", contentVerticalDistribution: "end", gap: 16 },
          content: slot([
            child("Button", { label: "Home", action: "go-to-home", align: "right", size: "sm", _style: { buttonStyle: "link", textColorToken: "foreground", marginLeft: "0px", marginRight: "0px" } }),
            child("Button", { label: "Gallery", action: "go-to-gallery", align: "right", size: "sm", _style: { buttonStyle: "link", textColorToken: "foreground", marginLeft: "0px", marginRight: "0px" } }),
          ]),
        }),
      ]),
    }),
  ]),
};
