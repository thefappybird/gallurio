/**
 * Services section presets — pricing and offerings.
 */

import type { ContainerBlockProps } from "../manualBlocks";
import { accentBandSection, child, onAccentBand, pageSection, slot } from "./_helpers";

export const SERVICES_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  overlayOpacity: 0,
  minHeight: "auto",
  alignX: "center",
  alignY: "top",
  // Unlike Hero/CTA/GalleryLanding (explicit "accent" feature bands), this is a
  // plain section — but its unstyled children still default to the theme
  // foreground color, which is the LIGHT pole of the palette on dark themes
  // (e.g. Luxury). Pin the section's own background to the page's "background"
  // token so that default text stays legible regardless of theme.
  _style: { bgColorToken: "background" },
  content: slot([
    child("Heading", { level: "h2", text: "Services" }),
    child("Columns", {
      columns: 3,
      content: slot([
        child("Container", {
          _style: { borderWidth: 1, borderColorToken: "foreground", paddingY: 24, paddingX: 24 },
          content: slot([
            child("Heading", { level: "h3", text: "Wedding Photography" }),
            child("Text", { text: "Full-day coverage of your most important day." }),
            child("Text", { text: "From ₱30,000", _style: { textColorToken: "accent", bold: true } }),
          ]),
        }),
        child("Container", {
          _style: { borderWidth: 1, borderColorToken: "foreground", paddingY: 24, paddingX: 24 },
          content: slot([
            child("Heading", { level: "h3", text: "Portrait Sessions" }),
            child("Text", { text: "Individual or family portraits in natural light." }),
            child("Text", { text: "From ₱8,000", _style: { textColorToken: "accent", bold: true } }),
          ]),
        }),
        child("Container", {
          _style: { borderWidth: 1, borderColorToken: "foreground", paddingY: 24, paddingX: 24 },
          content: slot([
            child("Heading", { level: "h3", text: "Event Coverage" }),
            child("Text", { text: "Corporate events, debuts, and intimate gatherings." }),
            child("Text", { text: "From ₱15,000", _style: { textColorToken: "accent", bold: true } }),
          ]),
        }),
      ]),
    }),
  ]),
};

const MENU_SERVICES = [
  {
    title: "Wedding Photography",
    description: "Full-day coverage, two shooters, and a curated gallery within four weeks.",
    price: "From ₱30,000",
  },
  {
    title: "Portrait Sessions",
    description: "Ninety minutes in natural light, at the studio or somewhere that matters to you.",
    price: "From ₱8,000",
  },
  {
    title: "Event Coverage",
    description: "Corporate events, debuts, and intimate gatherings, half or full day.",
    price: "From ₱15,000",
  },
  {
    title: "Editorial and Brand",
    description: "Campaign and lookbook work for studios, labels, and venues.",
    price: "Price on request",
  },
];

export const SERVICES_MENU_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  minHeight: "auto",
  _style: { ...accentBandSection, gap: 0 },
  content: slot([
    child("Heading", { level: "h2", text: "Services" }),
    ...MENU_SERVICES.flatMap((service) => [
      child("Divider", { thickness: 1, _style: { paddingLeft: "0px", paddingRight: "0px" } }),
      child("Columns", {
        columns: 3,
        minHeight: "0px",
        _style: { gap: 24, paddingTop: "1.25rem", paddingBottom: "1.25rem" },
        content: slot([
          child("Heading", { level: "h3", text: service.title }),
          child("Text", { text: service.description, _style: { colSpan: 1 } }),
          child("Text", { text: service.price, _style: { textColorToken: "background", bold: true } }),
        ]),
      }),
    ]),
    child("Divider", { thickness: 1, _style: { paddingLeft: "0px", paddingRight: "0px" } }),
  ]),
};

export const SERVICES_FEATURE_PRESET: ContainerBlockProps = {
  backgroundImages: [],
  minHeight: "auto",
  _style: { ...pageSection, gap: 32 },
  content: slot([
    child("Heading", { level: "h2", text: "Services" }),
    child("Columns", {
      columns: 2,
      minHeight: "0px",
      _style: { gap: 32 },
      content: slot([
        child("Container", {
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
            child("Heading", { level: "h3", text: "Wedding Photography" }),
            child("Text", {
              text: "Full-day coverage, two shooters, and a curated gallery within four weeks. The one I build the year around.",
            }),
            child("Text", { text: "From ₱30,000", _style: { textColorToken: "background", bold: true } }),
            child("Button", {
              label: "Get in Touch",
              action: "open-contact",
              align: "left",
              size: "sm",
              _style: onAccentBand,
            }),
          ]),
        }),
        child("Image", { alt: "Wedding coverage" }),
      ]),
    }),
    child("Columns", {
      columns: 2,
      minHeight: "0px",
      _style: { gap: 32 },
      content: slot([
        child("Container", {
          _style: {
            gap: 8,
            borderWidth: 1,
            borderSides: ["top"],
            borderColorToken: "foreground",
            paddingTop: "1.125rem",
          },
          content: slot([
            child("Heading", { level: "h3", text: "Portrait Sessions" }),
            child("Text", { text: "Individual or family portraits in natural light." }),
            child("Text", { text: "From ₱8,000", _style: { textColorToken: "accent", bold: true } }),
          ]),
        }),
        child("Container", {
          _style: {
            gap: 8,
            borderWidth: 1,
            borderSides: ["top"],
            borderColorToken: "foreground",
            paddingTop: "1.125rem",
          },
          content: slot([
            child("Heading", { level: "h3", text: "Event Coverage" }),
            child("Text", { text: "Corporate events, debuts, and intimate gatherings." }),
            child("Text", { text: "From ₱15,000", _style: { textColorToken: "accent", bold: true } }),
          ]),
        }),
      ]),
    }),
  ]),
};
