import { THEME_PRESET_DEFINITIONS } from "@/lib/page-builder/brandKitPicker/themePresetDefinitions";
import type { PortfolioTemplate } from "./types";
import { zone } from "./_blocks";

/**
 * Luxury — warm gold accent, Cormorant Garamond headings, split-panel editorial hero.
 * Faithful to the "Venue & Stylist" draft (themePreset: luxury).
 * ContainerAnchor children omitted — fillBlockDefaults re-injects them on apply.
 */
export const luxuryTemplate: PortfolioTemplate = {
  id: "luxury",
  label: "Luxury",
  businessType: "venue",
  description: "Warm gold accent, editorial split-panel hero, refined typographic hierarchy.",
  previewImage: "/template-previews/luxury.svg",
  defaultBrandKit: { ...THEME_PRESET_DEFINITIONS.luxury.brandKit },
  defaultContact: {
    title: "Inquire now",
    description: "We'd love to learn about your vision.",
    buttonStyle: "outline",
    buttonColor: "foreground",
    buttonRadius: "sharp",
    addSessionButtonStyle: "solid",
    addSessionButtonColor: "accent",
    addSessionButtonTextColor: "background",
    addSessionButtonRadius: "sharp",
    tabFontSize: "sm",
    tabColor: "background",
    activeTabScale: false,
    activeTabUnderline: true,
    tabUnderlineColor: "accent",
  },
  defaultHeader: {
    borderBottomWidth: 1,
    borderBottomColor: "foreground",
    navbarSize: "balanced",
    activeLinkScale: false,
    activeLinkHighlight: false,
    highlightOpacity: 100,
    activeLinkRadius: "sharp",
    activeLinkUnderline: true,
    contactButtonColor: "foreground",
    contactButtonTextColor: "background",
    contactButtonOpacity: 100,
    contactButtonRadius: "sharp",
  },
  defaultCollectionsPopup: {},
  seedData: () => ({
    home: zone([
      {
        type: "Columns",
        props: {
          id: "Columns-luxury-hero",
          columns: 2,
          _style: { gap: 0, paddingLeft: "0px", paddingRight: "0px", paddingTop: "0px", paddingBottom: "0px" },
          content: [
            {
              type: "HeroPreset",
              props: {
                id: "HeroPreset-luxury-hero",
                backgroundImages: [],
                overlayOpacity: 50,
                minHeight: "tall",
                alignX: "center",
                alignY: "center",
                _style: { bgColorToken: "accent", alignItems: "center" },
                content: [
                  {
                    type: "Heading",
                    props: {
                      id: "Heading-luxury-hero-h1",
                      level: "h1",
                      text: "An extraordinary venue for extraordinary moments",
                      _style: { textColorToken: "background", bold: true },
                    },
                  },
                  {
                    type: "Text",
                    props: {
                      id: "Text-luxury-hero-sub",
                      text: "Elegance, warmth, and impeccable service for every event.",
                      _style: { textColorToken: "background" },
                    },
                  },
                  {
                    type: "Button",
                    props: {
                      id: "Button-luxury-hero-cta",
                      label: "Inquire Now",
                      action: "open-contact",
                      align: "center",
                      _style: { buttonStyle: "outline" },
                    },
                  },
                ],
              },
            },
            {
              type: "Container",
              props: {
                id: "Container-luxury-hero-panel",
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
      {
        type: "AboutPreset",
        props: {
          id: "AboutPreset-luxury",
          backgroundImages: [],
          overlayOpacity: 0,
          minHeight: "auto",
          alignX: "center",
          alignY: "top",
          content: [
            {
              type: "Heading",
              props: { id: "Heading-luxury-about-h2", level: "h2", text: "Our Story" },
            },
            {
              type: "Text",
              props: {
                id: "Text-luxury-about-body",
                text: "We are passionate creators dedicated to crafting unforgettable experiences. From intimate gatherings to grand celebrations, every event is a masterpiece in the making.",
              },
            },
            {
              type: "Button",
              props: {
                id: "Button-luxury-about-cta",
                label: "View Our Work",
                action: "go-to-gallery",
                align: "center",
                _style: { buttonStyle: "outline" },
              },
            },
          ],
        },
      },
      {
        type: "ServicesPreset",
        props: {
          id: "ServicesPreset-luxury",
          backgroundImages: [],
          overlayOpacity: 0,
          minHeight: "auto",
          alignX: "center",
          alignY: "top",
          content: [
            {
              type: "Heading",
              props: { id: "Heading-luxury-svc-h2", level: "h2", text: "Services" },
            },
            {
              type: "Columns",
              props: {
                id: "Columns-luxury-svc",
                columns: 3,
                content: [
                  {
                    type: "Container",
                    props: {
                      id: "Container-luxury-svc-1",
                      _style: { borderWidth: 1, borderColorToken: "foreground", paddingY: 32, paddingX: 32 },
                      content: [
                        { type: "Heading", props: { id: "Heading-luxury-svc-1", level: "h3", text: "Full Venue Rental" } },
                        { type: "Text", props: { id: "Text-luxury-svc-1a", text: "Exclusive access to our space for your special event." } },
                        { type: "Text", props: { id: "Text-luxury-svc-1b", text: "From ₱80,000", _style: { textColorToken: "accent", bold: true } } },
                      ],
                    },
                  },
                  {
                    type: "Container",
                    props: {
                      id: "Container-luxury-svc-2",
                      _style: { borderWidth: 1, borderColorToken: "foreground", paddingY: 32, paddingX: 32 },
                      content: [
                        { type: "Heading", props: { id: "Heading-luxury-svc-2", level: "h3", text: "Styling & Design" } },
                        { type: "Text", props: { id: "Text-luxury-svc-2a", text: "Full décor design, sourcing, and setup for your vision." } },
                        { type: "Text", props: { id: "Text-luxury-svc-2b", text: "From ₱25,000", _style: { textColorToken: "accent", bold: true } } },
                      ],
                    },
                  },
                  {
                    type: "Container",
                    props: {
                      id: "Container-luxury-svc-3",
                      _style: { borderWidth: 1, borderColorToken: "foreground", paddingY: 32, paddingX: 32 },
                      content: [
                        { type: "Heading", props: { id: "Heading-luxury-svc-3", level: "h3", text: "Day-of Coordination" } },
                        { type: "Text", props: { id: "Text-luxury-svc-3a", text: "Seamless execution so you can enjoy every moment." } },
                        { type: "Text", props: { id: "Text-luxury-svc-3b", text: "From ₱15,000", _style: { textColorToken: "accent", bold: true } } },
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
        type: "GalleryLandingPreset",
        props: {
          id: "GalleryLandingPreset-luxury",
          backgroundImages: [],
          overlayOpacity: 50,
          minHeight: "medium",
          alignX: "center",
          alignY: "center",
          _style: { bgColorToken: "accent", alignItems: "center" },
          content: [
            {
              type: "Heading",
              props: {
                id: "Heading-luxury-glp-h1",
                level: "h1",
                text: "Gallery",
                _style: { textColorToken: "background", bold: true },
              },
            },
            {
              type: "Text",
              props: {
                id: "Text-luxury-glp-sub",
                text: "A curated collection of moments we've had the privilege to create.",
                _style: { textColorToken: "background" },
              },
            },
          ],
        },
      },
      {
        type: "GalleryGridPreset",
        props: {
          id: "GalleryGridPreset-luxury",
          backgroundImages: [],
          overlayOpacity: 0,
          minHeight: "auto",
          alignX: "left",
          alignY: "top",
          content: [
            {
              type: "Heading",
              props: { id: "Heading-luxury-ggp-h2", level: "h2", text: "Venues & Celebrations" },
            },
            {
              type: "Text",
              props: { id: "Text-luxury-ggp-sub", text: "A selection of our finest work." },
            },
            {
              type: "GalleryGrid",
              props: { id: "GalleryGrid-luxury", images: [], columns: 3, gap: "normal" },
            },
          ],
        },
      },
    ]),
  }),
};
