import { THEME_PRESET_DEFINITIONS } from "@/lib/page-builder/brandKitPicker/themePresetDefinitions";
import { onAccentBand } from "@/lib/page-builder/blocks/presets/_helpers";
import type { PortfolioTemplate } from "./types";
import { zone } from "./_blocks";

/**
 * Luxury — Warm gold accent, editorial split-panel hero, refined typographic hierarchy.
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
    // title/description left unset so the locale-translated default applies.
    buttonStyle: "solid",
    buttonColor: "accent",
    buttonTextColor: "secondary",
    buttonRadius: "subtle",
    addSessionButtonStyle: "outline",
    addSessionButtonColor: "accent",
    addSessionButtonTextColor: "accent",
    addSessionButtonRadius: "subtle",
    tabFontSize: "sm",
    tabColor: "foreground",
    activeTabColor: "accent",
    activeTabUnderline: true,
    tabUnderlineColor: "accent",
  },
  defaultHeader: {
    fontSize: "sm",
    activeLinkScale: true,
    activeLinkHighlight: false,
    highlightOpacity: 100,
    contactButtonColor: "accent",
    contactButtonTextColor: "secondary",
    contactButtonOpacity: 100,
    contactButtonRadius: "",
  },
  defaultCollectionsPopup: {},
  seedData: () => ({
    home: zone(
      [
        {
          type: "HeroPreset",
          props: {
            id: "HeroPreset-luxury-home-1",
            content: [
              {
                type: "Heading",
                props: {
                  id: "Heading-luxury-home-2",
                  level: "h1",
                  text: "Capturing moments that last forever",
                  _style: {
                    textColorToken: "foreground",
                    bold: true,
                  },
                },
              },
              {
                type: "Text",
                props: {
                  id: "Text-luxury-home-3",
                  text: "Fine art photography for weddings, portraits, and events.",
                  _style: {
                    textColorToken: "foreground",
                  },
                },
              },
              {
                type: "Button",
                props: {
                  id: "Button-luxury-home-4",
                  label: "Get in Touch",
                  action: "open-contact",
                  align: "center",
                  _style: onAccentBand,
                },
              },
            ],
            backgroundImages: [],
            overlayOpacity: 50,
            minHeight: "tall",
            alignX: "center",
            alignY: "center",
            _style: {
              bgColorToken: "accent",
            },
            bgAnimation: "crossfade",
            bgSpeed: "medium",
          },
        },
        {
          type: "ServicesPreset",
          props: {
            id: "ServicesPreset-luxury-home-5",
            content: [
              {
                type: "Heading",
                props: {
                  id: "Heading-luxury-home-6",
                  level: "h2",
                  text: "Services",
                },
              },
              {
                type: "Columns",
                props: {
                  content: [
                    {
                      type: "Container",
                      props: {
                        content: [
                          {
                            type: "ContainerAnchor",
                            props: {
                              id: "ContainerAnchor-luxury-home-9",
                              height: 0,
                            },
                          },
                          {
                            type: "Heading",
                            props: {
                              id: "Heading-luxury-home-10",
                              level: "h3",
                              text: "Wedding Photography",
                            },
                          },
                          {
                            type: "Text",
                            props: {
                              id: "Text-luxury-home-11",
                              text: "Full-day coverage of your most important day.",
                            },
                          },
                          {
                            type: "Text",
                            props: {
                              id: "Text-luxury-home-12",
                              text: "From ₱30,000",
                              _style: {
                                textColorToken: "foreground",
                                bold: true,
                              },
                            },
                          },
                        ],
                        id: "Container-luxury-home-8",
                        _style: {
                          borderWidth: 1,
                          borderColorToken: "foreground",
                          paddingY: 24,
                          paddingX: 24,
                        },
                      },
                    },
                    {
                      type: "Container",
                      props: {
                        content: [
                          {
                            type: "ContainerAnchor",
                            props: {
                              id: "ContainerAnchor-luxury-home-14",
                              height: 0,
                            },
                          },
                          {
                            type: "Heading",
                            props: {
                              id: "Heading-luxury-home-15",
                              level: "h3",
                              text: "Portrait Sessions",
                            },
                          },
                          {
                            type: "Text",
                            props: {
                              id: "Text-luxury-home-16",
                              text: "Individual or family portraits in natural light.",
                            },
                          },
                          {
                            type: "Text",
                            props: {
                              id: "Text-luxury-home-17",
                              text: "From ₱8,000",
                              _style: {
                                textColorToken: "foreground",
                                bold: true,
                              },
                            },
                          },
                        ],
                        id: "Container-luxury-home-13",
                        _style: {
                          borderWidth: 1,
                          borderColorToken: "foreground",
                          paddingY: 24,
                          paddingX: 24,
                        },
                      },
                    },
                    {
                      type: "Container",
                      props: {
                        content: [
                          {
                            type: "ContainerAnchor",
                            props: {
                              id: "ContainerAnchor-luxury-home-19",
                              height: 0,
                            },
                          },
                          {
                            type: "Heading",
                            props: {
                              id: "Heading-luxury-home-20",
                              level: "h3",
                              text: "Event Coverage",
                            },
                          },
                          {
                            type: "Text",
                            props: {
                              id: "Text-luxury-home-21",
                              text: "Corporate events, debuts, and intimate gatherings.",
                            },
                          },
                          {
                            type: "Text",
                            props: {
                              id: "Text-luxury-home-22",
                              text: "From ₱15,000",
                              _style: {
                                textColorToken: "foreground",
                                bold: true,
                              },
                            },
                          },
                        ],
                        id: "Container-luxury-home-18",
                        _style: {
                          borderWidth: 1,
                          borderColorToken: "foreground",
                          paddingY: 24,
                          paddingX: 24,
                        },
                      },
                    },
                  ],
                  id: "Columns-luxury-home-7",
                  columns: 3,
                },
              },
            ],
            backgroundImages: [],
            overlayOpacity: 0,
            minHeight: "auto",
            alignX: "center",
            alignY: "top",
            bgAnimation: "crossfade",
            bgSpeed: "medium",
            // Plain section (not a feature band) — its unstyled children default
            // to the theme foreground, which is light on this dark palette. Pin
            // the section to the page's own "background" token to stay legible.
            _style: { bgColorToken: "background" },
          },
        },
      ]
    ),
    gallery: zone(
      [
        {
          type: "Columns",
          props: {
            content: [
              {
                type: "Container",
                props: {
                  content: [
                    {
                      type: "ContainerAnchor",
                      props: {
                        id: "ContainerAnchor-luxury-gal-3",
                        height: 0,
                      },
                    },
                  ],
                  id: "Container-luxury-gal-2",
                  backgroundImages: [],
                  bgAnimation: "crossfade",
                  bgSpeed: "medium",
                  overlayOpacity: 0,
                  minHeight: "auto",
                  alignX: "left",
                  alignY: "top",
                  _style: {
                    bgColorToken: "secondary",
                  },
                },
              },
              {
                type: "GalleryLandingPreset",
                props: {
                  content: [
                    {
                      type: "Heading",
                      props: {
                        id: "Heading-luxury-gal-5",
                        level: "h2",
                        text: "Our gallery",
                        _style: {
                          textColorToken: "foreground",
                          bold: true,
                        },
                      },
                    },
                    {
                      type: "Text",
                      props: {
                        id: "Text-luxury-gal-6",
                        text: "A curated look at our work.",
                        _style: {
                          textColorToken: "foreground",
                        },
                      },
                    },
                  ],
                  id: "GalleryLandingPreset-luxury-gal-4",
                  backgroundImages: [],
                  overlayOpacity: 40,
                  minHeight: "medium",
                  alignX: "center",
                  alignY: "center",
                  _style: {
                    bgColorToken: "accent",
                    colSpan: 2,
                    alignItems: "center",
                  },
                },
              },
              {
                type: "Container",
                props: {
                  content: [
                    {
                      type: "ContainerAnchor",
                      props: {
                        id: "ContainerAnchor-luxury-gal-8",
                        height: 0,
                      },
                    },
                  ],
                  id: "Container-luxury-gal-7",
                  backgroundImages: [],
                  bgAnimation: "crossfade",
                  bgSpeed: "medium",
                  overlayOpacity: 0,
                  minHeight: "auto",
                  alignX: "left",
                  alignY: "top",
                  _style: {
                    bgColorToken: "secondary",
                    colSpan: 1,
                  },
                },
              },
            ],
            id: "Columns-luxury-gal-1",
            columns: 4,
            _style: {
              gap: 0,
              paddingLeft: "0px",
              paddingRight: "0px",
              paddingTop: "0px",
              paddingBottom: "0px",
            },
            overallWidth: "full",
          },
        },
        {
          type: "FeaturedWorkPreset",
          props: {
            content: [
              {
                type: "Heading",
                props: {
                  id: "Heading-luxury-gal-10",
                  level: "h2",
                  text: "Featured work",
                },
              },
              {
                type: "Text",
                props: {
                  id: "Text-luxury-gal-11",
                  text: "Spotlight a few signature images.",
                },
              },
              {
                type: "Columns",
                props: {
                  id: "Columns-luxury-gal-12",
                  columns: 3,
                  minHeight: "0px",
                  _style: { gap: 16 },
                  content: [
                    { type: "CollectionCard", props: { id: "CollectionCard-luxury-gal-12a", aspectRatio: "7 / 9", showCaption: true } },
                    { type: "CollectionCard", props: { id: "CollectionCard-luxury-gal-12b", aspectRatio: "7 / 9", showCaption: true } },
                    { type: "CollectionCard", props: { id: "CollectionCard-luxury-gal-12c", aspectRatio: "7 / 9", showCaption: true } },
                  ],
                },
              },
            ],
            id: "FeaturedWorkPreset-luxury-gal-9",
            backgroundImages: [],
            overlayOpacity: 0,
            minHeight: "auto",
            alignX: "left",
            alignY: "top",
            bgAnimation: "crossfade",
            bgSpeed: "medium",
            // Same reasoning as the home zone's ServicesPreset above.
            _style: { bgColorToken: "background" },
          },
        },
      ]
    ),
  }),
};
