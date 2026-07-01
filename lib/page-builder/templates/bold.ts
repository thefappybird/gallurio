import { THEME_PRESET_DEFINITIONS } from "@/lib/page-builder/brandKitPicker/themePresetDefinitions";
import type { PortfolioTemplate } from "./types";
import { zone } from "./_blocks";

/**
 * Bold — High-contrast navy accent, grid mosaic hero, strong typographic presence.
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
    // title/description left unset so the locale-translated default applies.
    buttonStyle: "solid",
    buttonColor: "accent",
    buttonRadius: "subtle",
    addSessionButtonStyle: "outline",
    addSessionButtonColor: "foreground",
    addSessionButtonTextColor: "accent",
    addSessionButtonRadius: "subtle",
    tabFontSize: "sm",
    tabColor: "foreground",
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
    home: zone(
      [
        {
          type: "Columns",
          props: {
            content: [
              {
                type: "HeroPreset",
                props: {
                  content: [
                    {
                      type: "Heading",
                      props: {
                        id: "Heading-bold-home-3",
                        level: "h1",
                        text: "Capturing moments that last forever",
                        _style: {
                          textColorToken: "background",
                          bold: true,
                        },
                      },
                    },
                    {
                      type: "Text",
                      props: {
                        id: "Text-bold-home-4",
                        text: "Fine art photography for weddings, portraits, and events.",
                        _style: {
                          textColorToken: "background",
                        },
                      },
                    },
                    {
                      type: "Button",
                      props: {
                        id: "Button-bold-home-5",
                        label: "Get in Touch",
                        action: "open-contact",
                        align: "center",
                      },
                    },
                  ],
                  id: "HeroPreset-bold-home-2",
                  backgroundImages: [],
                  overlayOpacity: 50,
                  minHeight: "tall",
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
                        id: "ContainerAnchor-bold-home-7",
                        height: 0,
                      },
                    },
                  ],
                  id: "Container-bold-home-6",
                  backgroundImages: [],
                  bgAnimation: "crossfade",
                  bgSpeed: "medium",
                  overlayOpacity: 0,
                  minHeight: "auto",
                  alignX: "left",
                  alignY: "top",
                  _style: {
                    bgColorToken: "primary",
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
                        id: "ContainerAnchor-bold-home-9",
                        height: 0,
                      },
                    },
                  ],
                  id: "Container-bold-home-8",
                  backgroundImages: [],
                  bgAnimation: "crossfade",
                  bgSpeed: "medium",
                  overlayOpacity: 0,
                  minHeight: "auto",
                  alignX: "left",
                  alignY: "top",
                  _style: {
                    bgColorToken: "accent",
                  },
                },
              },
            ],
            id: "Columns-bold-home-1",
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
          type: "ServicesPreset",
          props: {
            content: [
              {
                type: "Heading",
                props: {
                  id: "Heading-bold-home-11",
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
                              id: "ContainerAnchor-bold-home-14",
                              height: 0,
                            },
                          },
                          {
                            type: "Heading",
                            props: {
                              id: "Heading-bold-home-15",
                              level: "h3",
                              text: "Wedding Photography",
                            },
                          },
                          {
                            type: "Text",
                            props: {
                              id: "Text-bold-home-16",
                              text: "Full-day coverage of your most important day.",
                            },
                          },
                          {
                            type: "Text",
                            props: {
                              id: "Text-bold-home-17",
                              text: "From ₱30,000",
                              _style: {
                                textColorToken: "accent",
                                bold: true,
                              },
                            },
                          },
                        ],
                        id: "Container-bold-home-13",
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
                              id: "ContainerAnchor-bold-home-19",
                              height: 0,
                            },
                          },
                          {
                            type: "Heading",
                            props: {
                              id: "Heading-bold-home-20",
                              level: "h3",
                              text: "Portrait Sessions",
                            },
                          },
                          {
                            type: "Text",
                            props: {
                              id: "Text-bold-home-21",
                              text: "Individual or family portraits in natural light.",
                            },
                          },
                          {
                            type: "Text",
                            props: {
                              id: "Text-bold-home-22",
                              text: "From ₱8,000",
                              _style: {
                                textColorToken: "accent",
                                bold: true,
                              },
                            },
                          },
                        ],
                        id: "Container-bold-home-18",
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
                              id: "ContainerAnchor-bold-home-24",
                              height: 0,
                            },
                          },
                          {
                            type: "Heading",
                            props: {
                              id: "Heading-bold-home-25",
                              level: "h3",
                              text: "Event Coverage",
                            },
                          },
                          {
                            type: "Text",
                            props: {
                              id: "Text-bold-home-26",
                              text: "Corporate events, debuts, and intimate gatherings.",
                            },
                          },
                          {
                            type: "Text",
                            props: {
                              id: "Text-bold-home-27",
                              text: "From ₱15,000",
                              _style: {
                                textColorToken: "accent",
                                bold: true,
                              },
                            },
                          },
                        ],
                        id: "Container-bold-home-23",
                        _style: {
                          borderWidth: 1,
                          borderColorToken: "foreground",
                          paddingY: 24,
                          paddingX: 24,
                        },
                      },
                    },
                  ],
                  id: "Columns-bold-home-12",
                  columns: 3,
                },
              },
            ],
            id: "ServicesPreset-bold-home-10",
            backgroundImages: [],
            overlayOpacity: 0,
            minHeight: "auto",
            alignX: "center",
            alignY: "top",
            bgAnimation: "crossfade",
            bgSpeed: "medium",
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
                        id: "ContainerAnchor-bold-gal-3",
                        height: 0,
                      },
                    },
                  ],
                  id: "Container-bold-gal-2",
                  backgroundImages: [],
                  bgAnimation: "crossfade",
                  bgSpeed: "medium",
                  overlayOpacity: 0,
                  minHeight: "auto",
                  alignX: "left",
                  alignY: "top",
                  _style: {
                    bgColorToken: "accent",
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
                        id: "ContainerAnchor-bold-gal-5",
                        height: 0,
                      },
                    },
                  ],
                  id: "Container-bold-gal-4",
                  backgroundImages: [],
                  bgAnimation: "crossfade",
                  bgSpeed: "medium",
                  overlayOpacity: 0,
                  minHeight: "auto",
                  alignX: "left",
                  alignY: "top",
                  _style: {
                    bgColorToken: "primary",
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
                        id: "Heading-bold-gal-7",
                        level: "h2",
                        text: "Our gallery",
                        _style: {
                          textColorToken: "background",
                          bold: true,
                        },
                      },
                    },
                    {
                      type: "Text",
                      props: {
                        id: "Text-bold-gal-8",
                        text: "A curated look at our work.",
                        _style: {
                          textColorToken: "background",
                        },
                      },
                    },
                  ],
                  id: "GalleryLandingPreset-bold-gal-6",
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
            ],
            id: "Columns-bold-gal-1",
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
          type: "GalleryGridPreset",
          props: {
            content: [
              {
                type: "Heading",
                props: {
                  id: "Heading-bold-gal-10",
                  level: "h2",
                  text: "Gallery highlights",
                },
              },
              {
                type: "Text",
                props: {
                  id: "Text-bold-gal-11",
                  text: "A curated selection from one collection.",
                },
              },
              {
                type: "GalleryGrid",
                props: {
                  id: "GalleryGrid-bold-gal-12",
                  images: [],
                  columns: 3,
                  gap: "normal",
                },
              },
            ],
            id: "GalleryGridPreset-bold-gal-9",
            backgroundImages: [],
            overlayOpacity: 0,
            minHeight: "auto",
            alignX: "left",
            alignY: "top",
            bgAnimation: "crossfade",
            bgSpeed: "medium",
          },
        },
      ]
    ),
  }),
};
