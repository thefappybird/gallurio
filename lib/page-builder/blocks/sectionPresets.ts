/**
 * Section presets — the "Preset blocks" shown in the editor drawer.
 *
 * Each preset is a `Container` (see manualBlocks) whose `content` slot is
 * PRE-FILLED with a composition of manual blocks (Heading + Text + Button…).
 * Dragging one in inserts the whole section; every child block is then selected
 * and styled INDIVIDUALLY via its own `_style` toolkit — so each piece of text
 * is its own block, not a bundle of text-inputs on one monolithic component.
 *
 * Client-safe (pure data + the isomorphic ContainerBlock render), so the SAME
 * configs power the editor canvas and the public renderer. Only the `_style`
 * field and the bg-image field differ between editor/prod (the editor swaps in
 * visual pickers) — field KEYS match, so editor/prod parity holds.
 */

import type { Slot } from "@measured/puck";
import type { ContainerBlockProps } from "./manualBlocks";

// A child block in a preset's slot. Props are intentionally loose here — each
// child's real prop type is enforced where the block is defined.
function child(type: string, props: Record<string, unknown>) {
  return { type, props };
}

// `content` literals are validated structurally by Puck at runtime; cast once.
const slot = (items: ReturnType<typeof child>[]): Slot => items as unknown as Slot;

// Light text for use over a dark hero/CTA image or accent fill (the page's
// background token is the light pole of the palette).
const onDark = { textColorToken: "background" } as const;

export const HERO_PRESET: ContainerBlockProps = {
  backgroundImagePublicId: "",
  overlayOpacity: 50,
  minHeight: "tall",
  alignX: "center",
  alignY: "center",
  _style: { bgColorToken: "accent" },
  content: slot([
    child("Heading", { level: "h1", text: "Capturing moments that last forever", _style: { ...onDark, bold: true } }),
    child("Text", { text: "Fine art photography for weddings, portraits, and events.", _style: onDark }),
    child("Button", { label: "Get in Touch", action: "open-contact", align: "center" }),
  ]),
};

export const ABOUT_PRESET: ContainerBlockProps = {
  backgroundImagePublicId: "",
  overlayOpacity: 0,
  minHeight: "auto",
  alignX: "left",
  alignY: "top",
  content: slot([
    child("Heading", { level: "h2", text: "About Me" }),
    child("Text", {
      text: "I'm a passionate photographer based in Manila, capturing life's most meaningful moments.\n\nWith over a decade of experience, I bring artistry and technical expertise to every session.",
    }),
  ]),
};

export const CTA_PRESET: ContainerBlockProps = {
  backgroundImagePublicId: "",
  overlayOpacity: 0,
  minHeight: "medium",
  alignX: "center",
  alignY: "center",
  _style: { bgColorToken: "accent" },
  content: slot([
    child("Heading", { level: "h2", text: "Ready to book your session?", _style: onDark }),
    child("Text", { text: "Let's create something beautiful together.", _style: onDark }),
    child("Button", { label: "Get in Touch", action: "open-contact", align: "center" }),
  ]),
};

export const SERVICES_PRESET: ContainerBlockProps = {
  backgroundImagePublicId: "",
  overlayOpacity: 0,
  minHeight: "auto",
  alignX: "center",
  alignY: "top",
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

export const CONTACT_PRESET: ContainerBlockProps = {
  backgroundImagePublicId: "",
  overlayOpacity: 0,
  minHeight: "auto",
  alignX: "center",
  alignY: "top",
  content: slot([
    child("Heading", { level: "h2", text: "Get in Touch" }),
    child("Text", { text: "I'd love to hear about your vision. Reach out and let's talk." }),
    child("ContactDetails", {}),
    child("Button", { label: "Send a Message", action: "open-contact", align: "center" }),
  ]),
};

export const GALLERY_GRID_PRESET: ContainerBlockProps = {
  backgroundImagePublicId: "",
  overlayOpacity: 0,
  minHeight: "auto",
  alignX: "left",
  alignY: "top",
  content: slot([
    child("Heading", { level: "h2", text: "Gallery highlights" }),
    child("Text", { text: "A curated selection from one collection." }),
    child("GalleryGrid", { collectionId: "", columns: 3, gap: "normal", maxItems: 12 }),
  ]),
};

export const GALLERY_MASONRY_PRESET: ContainerBlockProps = {
  backgroundImagePublicId: "",
  overlayOpacity: 0,
  minHeight: "auto",
  alignX: "left",
  alignY: "top",
  content: slot([
    child("Heading", { level: "h2", text: "Story gallery" }),
    child("Text", { text: "A more editorial layout for one collection." }),
    child("GalleryMasonry", { collectionId: "", columns: 3, gap: "normal", maxItems: 18 }),
  ]),
};

export const FEATURED_WORK_PRESET: ContainerBlockProps = {
  backgroundImagePublicId: "",
  overlayOpacity: 0,
  minHeight: "auto",
  alignX: "left",
  alignY: "top",
  content: slot([
    child("Heading", { level: "h2", text: "Featured work" }),
    child("Text", { text: "Spotlight a few signature images." }),
    child("FeaturedWork", { itemIds: [], layout: "row" }),
  ]),
};

export const SECTION_PRESETS = {
  HeroPreset: { label: "Hero", defaultProps: HERO_PRESET },
  AboutPreset: { label: "About", defaultProps: ABOUT_PRESET },
  ServicesPreset: { label: "Services", defaultProps: SERVICES_PRESET },
  CtaPreset: { label: "Call to action", defaultProps: CTA_PRESET },
  ContactPreset: { label: "Contact", defaultProps: CONTACT_PRESET },
  GalleryGridPreset: { label: "Gallery grid section", defaultProps: GALLERY_GRID_PRESET },
  GalleryMasonryPreset: { label: "Gallery masonry section", defaultProps: GALLERY_MASONRY_PRESET },
  FeaturedWorkPreset: { label: "Featured work section", defaultProps: FEATURED_WORK_PRESET },
} as const;

export type SectionPresetKey = keyof typeof SECTION_PRESETS;
