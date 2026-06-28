import { THEME_PRESET_DEFINITIONS } from "@/lib/page-builder/brandKitPicker/themePresetDefinitions";
import type { PortfolioTemplate } from "./types";
import { zone } from "./_blocks";

/**
 * Minimal — clean, serif-only, white/charcoal palette.
 * Faithful to the "Wedding Photographer" draft (themePreset: minimal).
 * Slot children that are pure structural blocks (ContainerAnchor) are omitted
 * here; fillBlockDefaults re-injects them when the template is applied.
 */
export const minimalTemplate: PortfolioTemplate = {
  id: "minimal",
  label: "Minimal",
  businessType: "photographer",
  description: "Clean serif palette, image-first hero, about and contact side by side.",
  previewImage: "/template-previews/minimal.svg",
  defaultBrandKit: { ...THEME_PRESET_DEFINITIONS.minimal.brandKit },
  defaultContact: {
    title: "Get in touch",
    description: "Send a message and we'll get back to you soon.",
    buttonStyle: "solid",
    buttonColor: "foreground",
  },
  defaultHeader: {
    highlightOpacity: 100,
    contactButtonOpacity: 100,
  },
  defaultCollectionsPopup: {},
  seedData: () => ({
    home: zone([
      {
        type: "HeroPreset",
        props: {
          id: "HeroPreset-min-hero",
          backgroundImages: [],
          overlayOpacity: 50,
          minHeight: "tall",
          alignX: "center",
          alignY: "center",
          _style: { bgColorToken: "accent" },
          bgAnimation: "crossfade",
          bgSpeed: "medium",
          content: [
            {
              type: "Heading",
              props: {
                id: "Heading-min-hero-h1",
                level: "h1",
                text: "Capturing moments that last forever",
                _style: { textColorToken: "background", bold: true },
              },
            },
            {
              type: "Text",
              props: {
                id: "Text-min-hero-sub",
                text: "Fine art photography for weddings, portraits, and events.",
                _style: { textColorToken: "background" },
              },
            },
            {
              type: "Columns",
              props: {
                id: "Columns-min-hero-btns",
                columns: 2,
                _style: { gap: 16 },
                content: [
                  {
                    type: "Button",
                    props: {
                      id: "Button-min-hero-gallery",
                      label: "View Gallery",
                      action: "go-to-gallery",
                      align: "center",
                      _style: { selfAlign: "right", radius: 0, buttonStyle: "solid" },
                    },
                  },
                  {
                    type: "Button",
                    props: {
                      id: "Button-min-hero-contact",
                      label: "Get In Touch",
                      action: "open-contact",
                      align: "center",
                      size: "md",
                      _style: { selfAlign: "left", buttonStyle: "soft" },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      {
        type: "Columns",
        props: {
          id: "Columns-min-about-contact",
          columns: 2,
          _style: { gap: 16 },
          content: [
            {
              type: "AboutPreset",
              props: {
                id: "AboutPreset-min-about",
                backgroundImages: [],
                overlayOpacity: 0,
                minHeight: "auto",
                alignX: "left",
                alignY: "top",
                content: [
                  {
                    type: "Heading",
                    props: { id: "Heading-min-about-h2", level: "h2", text: "About Me" },
                  },
                  {
                    type: "Text",
                    props: {
                      id: "Text-min-about-body",
                      text: "I'm a passionate photographer based in Manila, capturing life's most meaningful moments.\n\nWith over a decade of experience, I bring artistry and technical expertise to every session.",
                    },
                  },
                ],
              },
            },
            {
              type: "ContactPreset",
              props: {
                id: "ContactPreset-min-contact",
                backgroundImages: [],
                overlayOpacity: 0,
                minHeight: "auto",
                alignX: "center",
                alignY: "top",
                content: [
                  {
                    type: "Heading",
                    props: { id: "Heading-min-contact-h2", level: "h2", text: "Get in Touch" },
                  },
                  {
                    type: "Text",
                    props: {
                      id: "Text-min-contact-body",
                      text: "I'd love to hear about your vision. Reach out and let's talk.",
                    },
                  },
                  {
                    type: "ContactDetails",
                    props: { id: "ContactDetails-min", columns: 2, email: "" },
                  },
                  {
                    type: "Button",
                    props: {
                      id: "Button-min-contact-cta",
                      label: "Send a Message",
                      action: "open-contact",
                      align: "center",
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
          id: "Columns-min-gallery-grid",
          columns: 5,
          rows: 2,
          _style: { gap: 16 },
          content: [
            {
              type: "GalleryLandingPreset",
              props: {
                id: "GalleryLandingPreset-min",
                backgroundImages: [],
                overlayOpacity: 40,
                minHeight: "medium",
                alignX: "center",
                alignY: "center",
                _style: { bgColorToken: "accent", colSpan: 3, rowSpan: 2, alignItems: "center" },
                content: [
                  {
                    type: "Heading",
                    props: {
                      id: "Heading-min-glp-h2",
                      level: "h2",
                      text: "Our gallery",
                      _style: { textColorToken: "background", bold: true },
                    },
                  },
                  {
                    type: "Text",
                    props: {
                      id: "Text-min-glp-sub",
                      text: "A curated look at our work.",
                      _style: { textColorToken: "background" },
                    },
                  },
                ],
              },
            },
            {
              type: "Columns",
              props: {
                id: "Columns-min-gallery-color",
                columns: 2,
                rows: 2,
                _style: { gap: 4, colSpan: 2, rowSpan: 2, paddingLeft: "0px", paddingRight: "0px", paddingTop: "0px", paddingBottom: "0px" },
                content: [
                  {
                    type: "Container",
                    props: {
                      id: "Container-min-c1",
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
                      id: "Container-min-c2",
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
                      id: "Container-min-c3",
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
                      id: "Container-min-c4",
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
                ],
              },
            },
          ],
        },
      },
      {
        type: "ServicesPreset",
        props: {
          id: "ServicesPreset-min",
          backgroundImages: [],
          overlayOpacity: 0,
          minHeight: "auto",
          alignX: "center",
          alignY: "top",
          content: [
            {
              type: "Heading",
              props: { id: "Heading-min-svc-h2", level: "h2", text: "Services" },
            },
            {
              type: "Columns",
              props: {
                id: "Columns-min-svc",
                columns: 3,
                content: [
                  {
                    type: "Container",
                    props: {
                      id: "Container-min-svc-1",
                      _style: { borderWidth: 1, borderColorToken: "foreground", paddingY: 24, paddingX: 24 },
                      content: [
                        { type: "Heading", props: { id: "Heading-min-svc-1", level: "h3", text: "Wedding Photography" } },
                        { type: "Text", props: { id: "Text-min-svc-1a", text: "Full-day coverage of your most important day." } },
                        { type: "Text", props: { id: "Text-min-svc-1b", text: "From ₱30,000", _style: { textColorToken: "accent", bold: true } } },
                      ],
                    },
                  },
                  {
                    type: "Container",
                    props: {
                      id: "Container-min-svc-2",
                      _style: { borderWidth: 1, borderColorToken: "foreground", paddingY: 24, paddingX: 24 },
                      content: [
                        { type: "Heading", props: { id: "Heading-min-svc-2", level: "h3", text: "Portrait Sessions" } },
                        { type: "Text", props: { id: "Text-min-svc-2a", text: "Individual or family portraits in natural light." } },
                        { type: "Text", props: { id: "Text-min-svc-2b", text: "From ₱8,000", _style: { textColorToken: "accent", bold: true } } },
                      ],
                    },
                  },
                  {
                    type: "Container",
                    props: {
                      id: "Container-min-svc-3",
                      _style: { borderWidth: 1, borderColorToken: "foreground", paddingY: 24, paddingX: 24 },
                      content: [
                        { type: "Heading", props: { id: "Heading-min-svc-3", level: "h3", text: "Event Coverage" } },
                        { type: "Text", props: { id: "Text-min-svc-3a", text: "Corporate events, debuts, and intimate gatherings." } },
                        { type: "Text", props: { id: "Text-min-svc-3b", text: "From ₱15,000", _style: { textColorToken: "accent", bold: true } } },
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
  }),
};
