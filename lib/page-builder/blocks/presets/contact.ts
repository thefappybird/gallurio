/**
 * Contact section presets — inquiry prompts and studio details.
 */

import type { ContainerBlockProps } from "../manualBlocks";
import {
  accentBandSection,
  child,
  hairlineFrame,
  onAccentBand,
  onPrimaryBand,
  pageSection,
  primaryBandSection,
  slot,
} from "./_helpers";

export const CONTACT_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  overlayOpacity: 0,
  minHeight: "auto",
  alignX: "center",
  alignY: "top",
  _style: pageSection,
  content: slot([
    child("Heading", { level: "h2", text: "Get in Touch" }),
    child("Text", { text: "I'd love to hear about your vision. Reach out and let's talk." }),
    child("ContactDetails", {}),
    child("Button", { label: "Send a Message", action: "open-contact", align: "center" }),
  ]),
};

export const CONTACT_SPLIT_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  minHeight: "auto",
  _style: { ...pageSection, gap: 0 },
  content: slot([
    child("Columns", {
      columns: 2,
      minHeight: "0px",
      _style: { gap: 40 },
      content: slot([
        child("Container", {
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
            child("Heading", { level: "h2", text: "Get in Touch" }),
            child("Text", {
              text: "Tell me the date, the place, and what the day is supposed to feel like. I'll take it from there.",
            }),
            child("Button", {
              label: "Send a Message",
              action: "open-contact",
              align: "left",
              _style: onPrimaryBand,
            }),
          ]),
        }),
        child("Container", {
          _style: {
            ...hairlineFrame,
            gap: 16,
            paddingTop: "1.75rem",
            paddingRight: "1.75rem",
            paddingBottom: "1.75rem",
            paddingLeft: "1.75rem",
          },
          content: slot([
            child("Heading", { level: "h3", text: "Studio" }),
            child("ContactDetails", {}),
          ]),
        }),
      ]),
    }),
  ]),
};

export const CONTACT_BAR_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  minHeight: "auto",
  _style: { ...accentBandSection, gap: 0, paddingTop: "2.25rem", paddingBottom: "2.25rem" },
  content: slot([
    child("Columns", {
      columns: 3,
      minHeight: "0px",
      _style: { gap: 32 },
      content: slot([
        child("Container", {
          _style: { gap: 8 },
          content: slot([
            child("Heading", { level: "h3", text: "Get in Touch" }),
            child("Text", { text: "Available for 2026 dates." }),
          ]),
        }),
        child("ContactDetails", {
          _style: {
            labelColorToken: "background",
            valueColorToken: "background",
            iconColorToken: "background",
          },
        }),
        child("Button", {
          label: "Send a Message",
          action: "open-contact",
          align: "right",
          _style: { ...onAccentBand, cellVerticalAlign: "center" },
        }),
      ]),
    }),
  ]),
};
