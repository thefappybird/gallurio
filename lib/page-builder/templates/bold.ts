import { THEME_PRESET_DEFINITIONS } from "@/lib/page-builder/brandKitPicker/themePresetDefinitions";
import type { PortfolioTemplate } from "./types";
import { zone } from "./_blocks";

/**
 * Bold — high-contrast dark-navy accent, Montserrat headings, grid mosaic hero.
 * Faithful to the "Bold" draft (themePreset: bold).
 * ContainerAnchor children omitted — fillBlockDefaults re-injects them on apply.
 */
export const boldTemplate: PortfolioTemplate = {
  id: "bold",
  label: "Bold",
  businessType: "entertainer",
  description: "High-contrast navy accent, grid mosaic hero, strong typographic presence.",
  previewImage: "/template-previews/bold.svg",
  defaultBrandKit: { ...THEME_PRESET_DEFINITIONS.bold.brandKit },
  defaultContact: {
    title: "Get in touch",
    description: "Send a message and we'll get back to you soon.",
    buttonStyle: "solid",
    buttonColor: "accent",
    buttonRadius: "subtle",
    addSessionButtonStyle: "outline",
    addSessionButtonColor: "foreground",
    addSessionButtonTextColor: "accent",
    addSessionButtonRadius: "subtle",
    tabFontSize: "sm",
    tabColor: "background",
    activeTabScale: false,
    activeTabUnderline: true,
    tabUnderlineColor: "accent",
  },
  defaultHeader: {
    borderBottomWidth: 2,
    borderBottomColor: "foreground",
    navbarSize: "sleek",
    activeLinkScale: false,
    activeLinkHighlight: true,
    highlightOpacity: 40,
    activeLinkRadius: "subtle",
    activeLinkUnderline: false,
    contactButtonColor: "accent",
    contactButtonTextColor: "background",
    contactButtonOpacity: 100,
    contactButtonRadius: "subtle",
  },
  defaultCollectionsPopup: {},
  seedData: () => ({
    home: zone([
      {
        type: "Columns",
        props: {
          id: "Columns-bold-home-hero",
          columns: 4,
          _style: { gap: 0, paddingLeft: "0px", paddingRight: "0px", paddingTop: "0px", paddingBottom: "0px" },
          content: [
            {
              type: "HeroPreset",
              props: {
                id: "HeroPreset-bold-hero",
                backgroundImages: [],
                overlayOpacity: 50,
                minHeight: "tall",
                alignX: "center",
                alignY: "center",
                _style: { bgColorToken: "accent", colSpan: 2, alignItems: "center" },
                content: [
                  {
                    type: "Heading",
                    props: {
                      id: "Heading-bold-hero-h1",
                      level: "h1",
                      text: "Capturing moments that last forever",
                      _style: { textColorToken: "background", bold: true },
                    },
                  },
                  {
                    type: "Text",
                    props: {
                      id: "Text-bold-hero-sub",
                      text: "Fine art photography for weddings, portraits, and events.",
                      _style: { textColorToken: "background" },
                    },
                  },
                  {
                    type: "Button",
                    props: {
                      id: "Button-bold-hero-cta",
                      label: "Get in Touch",
                      action: "open-contact",
                      align: "center",
                    },
                  },
                ],
              },
            },
            {
              type: "Container",
              props: {
                id: "Container-bold-home-c1",
                backgroundImages: [],
                bgAnimation: "crossfade",
                bgSpeed: "medium",
                overlayOpacity: 0,
                minHeight: "auto",
                alignX: "left",
                alignY: "top",
                _style: { bgColorToken: "primary" },
                content: [],
              },
            },
            {
              type: "Container",
              props: {
                id: "Container-bold-home-c2",
                backgroundImages: [],
                bgAnimation: "crossfade",
                bgSpeed: "medium",
                overlayOpacity: 0,
                minHeight: "auto",
                alignX: "left",
                alignY: "top",
                _style: { bgColorToken: "accent" },
                content: [],
              },
            },
          ],
        },
      },
      {
        type: "ServicesPreset",
        props: {
          id: "ServicesPreset-bold",
          backgroundImages: [],
          overlayOpacity: 0,
          minHeight: "auto",
          alignX: "center",
          alignY: "top",
          content: [
            {
              type: "Heading",
              props: { id: "Heading-bold-svc-h2", level: "h2", text: "Services" },
            },
            {
              type: "Columns",
              props: {
                id: "Columns-bold-svc",
                columns: 3,
                content: [
                  {
                    type: "Container",
                    props: {
                      id: "Container-bold-svc-1",
                      _style: { borderWidth: 1, borderColorToken: "foreground", paddingY: 24, paddingX: 24 },
                      content: [
                        { type: "Heading", props: { id: "Heading-bold-svc-1", level: "h3", text: "Wedding Photography" } },
                        { type: "Text", props: { id: "Text-bold-svc-1a", text: "Full-day coverage of your most important day." } },
                        { type: "Text", props: { id: "Text-bold-svc-1b", text: "From ₱30,000", _style: { textColorToken: "accent", bold: true } } },
                      ],
                    },
                  },
                  {
                    type: "Container",
                    props: {
                      id: "Container-bold-svc-2",
                      _style: { borderWidth: 1, borderColorToken: "foreground", paddingY: 24, paddingX: 24 },
                      content: [
                        { type: "Heading", props: { id: "Heading-bold-svc-2", level: "h3", text: "Portrait Sessions" } },
                        { type: "Text", props: { id: "Text-bold-svc-2a", text: "Individual or family portraits in natural light." } },
                        { type: "Text", props: { id: "Text-bold-svc-2b", text: "From ₱8,000", _style: { textColorToken: "accent", bold: true } } },
                      ],
                    },
                  },
                  {
                    type: "Container",
                    props: {
                      id: "Container-bold-svc-3",
                      _style: { borderWidth: 1, borderColorToken: "foreground", paddingY: 24, paddingX: 24 },
                      content: [
                        { type: "Heading", props: { id: "Heading-bold-svc-3", level: "h3", text: "Event Coverage" } },
                        { type: "Text", props: { id: "Text-bold-svc-3a", text: "Corporate events, debuts, and intimate gatherings." } },
                        { type: "Text", props: { id: "Text-bold-svc-3b", text: "From ₱15,000", _style: { textColorToken: "accent", bold: true } } },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    ]),
    gallery: zone([
      {
        type: "Columns",
        props: {
          id: "Columns-bold-gal-grid",
          columns: 4,
          _style: { gap: 0, paddingLeft: "0px", paddingRight: "0px", paddingTop: "0px", paddingBottom: "0px" },
          content: [
            {
              type: "Container",
              props: {
                id: "Container-bold-gal-c1",
                backgroundImages: [],
                bgAnimation: "crossfade",
                bgSpeed: "medium",
                overlayOpacity: 0,
                minHeight: "auto",
                alignX: "left",
                alignY: "top",
                _style: { bgColorToken: "accent" },
                content: [],
              },
            },
            {
              type: "Container",
              props: {
                id: "Container-bold-gal-c2",
                backgroundImages: [],
                bgAnimation: "crossfade",
                bgSpeed: "medium",
                overlayOpacity: 0,
                minHeight: "auto",
                alignX: "left",
                alignY: "top",
                _style: { bgColorToken: "primary" },
                content: [],
              },
            },
            {
              type: "GalleryLandingPreset",
              props: {
                id: "GalleryLandingPreset-bold",
                backgroundImages: [],
                overlayOpacity: 40,
                minHeight: "medium",
                alignX: "center",
                alignY: "center",
                _style: { bgColorToken: "accent", colSpan: 2, alignItems: "center" },
                content: [
                  {
                    type: "Heading",
                    props: {
                      id: "Heading-bold-glp-h2",
                      level: "h2",
                      text: "Our gallery",
                      _style: { textColorToken: "background", bold: true },
                    },
                  },
                  {
                    type: "Text",
                    props: {
                      id: "Text-bold-glp-sub",
                      text: "A curated look at our work.",
                      _style: { textColorToken: "background" },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      {
        type: "GalleryGridPreset",
        props: {
          id: "GalleryGridPreset-bold",
          backgroundImages: [],
          overlayOpacity: 0,
          minHeight: "auto",
          alignX: "left",
          alignY: "top",
          content: [
            {
              type: "Heading",
              props: { id: "Heading-bold-ggp-h2", level: "h2", text: "Gallery highlights" },
            },
            {
              type: "Text",
              props: { id: "Text-bold-ggp-sub", text: "A curated selection from one collection." },
            },
            {
              type: "GalleryGrid",
              props: { id: "GalleryGrid-bold", images: [], columns: 3, gap: "normal" },
            },
          ],
        },
      },
    ]),
  }),
};
