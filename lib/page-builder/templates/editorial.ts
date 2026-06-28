import { THEME_PRESET_DEFINITIONS } from "@/lib/page-builder/brandKitPicker/themePresetDefinitions";
import type { PortfolioTemplate } from "./types";
import { zone } from "./_blocks";

/**
 * Editorial — bold asymmetric layout, split-color mosaic hero, Lato/Montserrat pairing.
 * Faithful to the "Event Photographer" draft (themePreset: editorial).
 * ContainerAnchor children omitted — fillBlockDefaults re-injects them on apply.
 */
export const editorialTemplate: PortfolioTemplate = {
  id: "editorial",
  label: "Editorial",
  businessType: "photographer",
  description: "Asymmetric mosaic hero, editorial type, suitable for photographers and planners.",
  previewImage: "/template-previews/editorial.svg",
  defaultBrandKit: { ...THEME_PRESET_DEFINITIONS.editorial.brandKit },
  defaultContact: {
    title: "Start the conversation",
    description: "Tell us about your upcoming event and we'll be in touch.",
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
    borderBottomWidth: 1,
    borderBottomColor: "foreground",
    navbarSize: "balanced",
    activeLinkScale: false,
    activeLinkHighlight: true,
    highlightOpacity: 30,
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
          id: "Columns-editorial-hero",
          columns: 5,
          rows: 2,
          _style: { gap: 0, paddingLeft: "0px", paddingRight: "0px", paddingTop: "0px", paddingBottom: "0px" },
          content: [
            {
              type: "HeroPreset",
              props: {
                id: "HeroPreset-editorial-hero",
                backgroundImages: [],
                overlayOpacity: 50,
                minHeight: "tall",
                alignX: "center",
                alignY: "center",
                _style: { bgColorToken: "accent", colSpan: 3, rowSpan: 2, alignItems: "center" },
                content: [
                  {
                    type: "Heading",
                    props: {
                      id: "Heading-editorial-hero-h1",
                      level: "h1",
                      text: "Every event, every moment, beautifully told",
                      _style: { textColorToken: "background", bold: true },
                    },
                  },
                  {
                    type: "Text",
                    props: {
                      id: "Text-editorial-hero-sub",
                      text: "Documentary photography that captures the story of your event.",
                      _style: { textColorToken: "background" },
                    },
                  },
                  {
                    type: "Button",
                    props: {
                      id: "Button-editorial-hero-cta",
                      label: "See Our Work",
                      action: "go-to-gallery",
                      align: "center",
                    },
                  },
                ],
              },
            },
            {
              type: "Container",
              props: {
                id: "Container-editorial-hero-c1",
                backgroundImages: [],
                bgAnimation: "crossfade",
                bgSpeed: "medium",
                overlayOpacity: 0,
                minHeight: "auto",
                alignX: "left",
                alignY: "top",
                _style: { bgColorToken: "primary", colSpan: 2 },
                content: [],
              },
            },
            {
              type: "Container",
              props: {
                id: "Container-editorial-hero-c2",
                backgroundImages: [],
                bgAnimation: "crossfade",
                bgSpeed: "medium",
                overlayOpacity: 0,
                minHeight: "auto",
                alignX: "left",
                alignY: "top",
                _style: { bgColorToken: "secondary", colSpan: 2 },
                content: [],
              },
            },
          ],
        },
      },
      {
        type: "Columns",
        props: {
          id: "Columns-editorial-about-cta",
          columns: 2,
          content: [
            {
              type: "AboutPreset",
              props: {
                id: "AboutPreset-editorial",
                backgroundImages: [],
                overlayOpacity: 0,
                minHeight: "auto",
                alignX: "left",
                alignY: "top",
                content: [
                  {
                    type: "Heading",
                    props: { id: "Heading-editorial-about-h2", level: "h2", text: "About Us" },
                  },
                  {
                    type: "Text",
                    props: {
                      id: "Text-editorial-about-body",
                      text: "We are storytellers. From intimate dinners to large-scale productions, we capture the full emotional arc of your event — candidly, beautifully, and without interruption.",
                    },
                  },
                ],
              },
            },
            {
              type: "CtaPreset",
              props: {
                id: "CtaPreset-editorial",
                backgroundImages: [],
                overlayOpacity: 60,
                minHeight: "auto",
                alignX: "center",
                alignY: "center",
                _style: { bgColorToken: "accent", alignItems: "center" },
                content: [
                  {
                    type: "Heading",
                    props: {
                      id: "Heading-editorial-cta-h2",
                      level: "h2",
                      text: "Book your date",
                      _style: { textColorToken: "background" },
                    },
                  },
                  {
                    type: "Button",
                    props: {
                      id: "Button-editorial-cta",
                      label: "Inquire Now",
                      action: "open-contact",
                      align: "center",
                      _style: { buttonStyle: "outline" },
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
          id: "GalleryLandingPreset-editorial",
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
                id: "Heading-editorial-glp-h1",
                level: "h1",
                text: "Our Work",
                _style: { textColorToken: "background", bold: true },
              },
            },
            {
              type: "Text",
              props: {
                id: "Text-editorial-glp-sub",
                text: "A portfolio of events captured with care and precision.",
                _style: { textColorToken: "background" },
              },
            },
          ],
        },
      },
      {
        type: "GalleryGridPreset",
        props: {
          id: "GalleryGridPreset-editorial",
          backgroundImages: [],
          overlayOpacity: 0,
          minHeight: "auto",
          alignX: "left",
          alignY: "top",
          content: [
            {
              type: "Heading",
              props: { id: "Heading-editorial-ggp-h2", level: "h2", text: "Gallery" },
            },
            {
              type: "Text",
              props: { id: "Text-editorial-ggp-sub", text: "Moments from recent events." },
            },
            {
              type: "GalleryGrid",
              props: { id: "GalleryGrid-editorial", images: [], columns: 3, gap: "normal" },
            },
          ],
        },
      },
    ]),
  }),
};
