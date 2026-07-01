import { THEME_PRESET_DEFINITIONS } from "@/lib/page-builder/brandKitPicker/themePresetDefinitions";
import type { PortfolioTemplate } from "./types";
import { zone } from "./_blocks";

/**
 * Editorial — Asymmetric mosaic hero, editorial type, suitable for photographers and planners.
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
    // title/description left unset so the locale-translated default applies.
    buttonStyle: "solid",
    buttonColor: "accent",
    buttonTextColor: "background",
    buttonRadius: "subtle",
    addSessionButtonStyle: "outline",
    addSessionButtonTextColor: "accent",
    addSessionButtonRadius: "subtle",
    tabFontSize: "sm",
    tabColor: "foreground",
    activeTabColor: "accent",
    activeTabScale: false,
    activeTabHighlight: false,
    activeTabUnderline: true,
    tabUnderlineColor: "accent",
  },
  defaultHeader: {
    fontSize: "sm",
    navbarSize: "sleek",
    activeLinkHighlight: false,
    highlightOpacity: 100,
    activeLinkUnderline: true,
    underlineColor: "accent",
    contactButtonColor: "accent",
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
                type: "Container",
                props: {
                  content: [
                    {
                      type: "ContainerAnchor",
                      props: {
                        id: "ContainerAnchor-editorial-home-3",
                        height: 0,
                      },
                    },
                  ],
                  id: "Container-editorial-home-2",
                  backgroundImages: [],
                  bgAnimation: "crossfade",
                  bgSpeed: "medium",
                  overlayOpacity: 0,
                  minHeight: "short",
                  alignX: "left",
                  alignY: "top",
                  _style: {
                    textColorToken: "accent",
                    bgColorToken: "accent",
                    rowSpan: 1,
                    colSpan: 1,
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
                        id: "ContainerAnchor-editorial-home-5",
                        height: 0,
                      },
                    },
                  ],
                  id: "Container-editorial-home-4",
                  backgroundImages: [],
                  bgAnimation: "crossfade",
                  bgSpeed: "medium",
                  overlayOpacity: 0,
                  minHeight: "short",
                  alignX: "left",
                  alignY: "top",
                  _style: {
                    bgColorToken: "primary",
                    rowSpan: 1,
                    colSpan: 1,
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
                        id: "ContainerAnchor-editorial-home-7",
                        height: 0,
                      },
                    },
                  ],
                  id: "Container-editorial-home-6",
                  backgroundImages: [],
                  bgAnimation: "crossfade",
                  bgSpeed: "medium",
                  overlayOpacity: 0,
                  minHeight: "short",
                  alignX: "left",
                  alignY: "top",
                  _style: {
                    bgColorToken: "accent",
                    colSpan: 1,
                    rowSpan: 1,
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
                        id: "ContainerAnchor-editorial-home-9",
                        height: 0,
                      },
                    },
                  ],
                  id: "Container-editorial-home-8",
                  backgroundImages: [],
                  bgAnimation: "crossfade",
                  bgSpeed: "medium",
                  overlayOpacity: 0,
                  minHeight: "auto",
                  alignX: "left",
                  alignY: "top",
                  _style: {
                    bgColorToken: "primary",
                    colSpan: 1,
                    rowSpan: 1,
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
                        id: "ContainerAnchor-editorial-home-11",
                        height: 0,
                      },
                    },
                  ],
                  id: "Container-editorial-home-10",
                  backgroundImages: [],
                  bgAnimation: "crossfade",
                  bgSpeed: "medium",
                  overlayOpacity: 0,
                  minHeight: "auto",
                  alignX: "left",
                  alignY: "top",
                  _style: {
                    bgColorToken: "accent",
                    colSpan: 1,
                    rowSpan: 1,
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
                        id: "ContainerAnchor-editorial-home-13",
                        height: 0,
                      },
                    },
                  ],
                  id: "Container-editorial-home-12",
                  backgroundImages: [],
                  bgAnimation: "crossfade",
                  bgSpeed: "medium",
                  overlayOpacity: 0,
                  minHeight: "auto",
                  alignX: "left",
                  alignY: "top",
                  _style: {
                    bgColorToken: "primary",
                    colSpan: 1,
                    rowSpan: 1,
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
                        id: "ContainerAnchor-editorial-home-15",
                        height: 0,
                      },
                    },
                    {
                      type: "Heading",
                      props: {
                        id: "Heading-editorial-home-16",
                        text: "Event Photographer",
                        level: "h2",
                        _style: {
                          align: "center",
                        },
                      },
                    },
                    {
                      type: "Button",
                      props: {
                        id: "Button-editorial-home-17",
                        label: "Get in Touch",
                        action: "open-contact",
                        align: "center",
                        size: "sm",
                        _style: {
                          radius: 8,
                          buttonStyle: "soft",
                        },
                      },
                    },
                  ],
                  id: "Container-editorial-home-14",
                  backgroundImages: [],
                  bgAnimation: "crossfade",
                  bgSpeed: "medium",
                  overlayOpacity: 0,
                  minHeight: "auto",
                  alignX: "left",
                  alignY: "top",
                  _style: {
                    bgColorToken: "secondary",
                    colSpan: 6,
                    textColorToken: "secondary",
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
                        id: "ContainerAnchor-editorial-home-19",
                        height: 0,
                      },
                    },
                  ],
                  id: "Container-editorial-home-18",
                  backgroundImages: [],
                  bgAnimation: "crossfade",
                  bgSpeed: "medium",
                  overlayOpacity: 0,
                  minHeight: "short",
                  alignX: "left",
                  alignY: "top",
                  _style: {
                    bgColorToken: "accent",
                    colSpan: 1,
                    rowSpan: 1,
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
                        id: "ContainerAnchor-editorial-home-21",
                        height: 0,
                      },
                    },
                  ],
                  id: "Container-editorial-home-20",
                  backgroundImages: [],
                  bgAnimation: "crossfade",
                  bgSpeed: "medium",
                  overlayOpacity: 0,
                  minHeight: "auto",
                  alignX: "left",
                  alignY: "top",
                  _style: {
                    bgColorToken: "primary",
                    colSpan: 1,
                    rowSpan: 1,
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
                        id: "ContainerAnchor-editorial-home-23",
                        height: 0,
                      },
                    },
                  ],
                  id: "Container-editorial-home-22",
                  backgroundImages: [],
                  bgAnimation: "crossfade",
                  bgSpeed: "medium",
                  overlayOpacity: 0,
                  minHeight: "auto",
                  alignX: "left",
                  alignY: "top",
                  _style: {
                    bgColorToken: "accent",
                    colSpan: 1,
                    rowSpan: 1,
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
                        id: "ContainerAnchor-editorial-home-25",
                        height: 0,
                      },
                    },
                  ],
                  id: "Container-editorial-home-24",
                  backgroundImages: [],
                  bgAnimation: "crossfade",
                  bgSpeed: "medium",
                  overlayOpacity: 0,
                  minHeight: "auto",
                  alignX: "left",
                  alignY: "top",
                  _style: {
                    bgColorToken: "foreground",
                    colSpan: 1,
                    rowSpan: 1,
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
                        id: "ContainerAnchor-editorial-home-27",
                        height: 0,
                      },
                    },
                  ],
                  id: "Container-editorial-home-26",
                  backgroundImages: [],
                  bgAnimation: "crossfade",
                  bgSpeed: "medium",
                  overlayOpacity: 0,
                  minHeight: "auto",
                  alignX: "left",
                  alignY: "top",
                  _style: {
                    bgColorToken: "accent",
                    colSpan: 1,
                    rowSpan: 1,
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
                        id: "ContainerAnchor-editorial-home-29",
                        height: 0,
                      },
                    },
                  ],
                  id: "Container-editorial-home-28",
                  backgroundImages: [],
                  bgAnimation: "crossfade",
                  bgSpeed: "medium",
                  overlayOpacity: 0,
                  minHeight: "auto",
                  alignX: "left",
                  alignY: "top",
                  _style: {
                    bgColorToken: "foreground",
                    colSpan: 1,
                    rowSpan: 1,
                  },
                },
              },
            ],
            id: "Columns-editorial-home-1",
            columns: 6,
            rows: 3,
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
          type: "AboutPreset",
          props: {
            content: [
              {
                type: "Heading",
                props: {
                  id: "Heading-editorial-home-31",
                  level: "h2",
                  text: "About Me",
                },
              },
              {
                type: "Text",
                props: {
                  id: "Text-editorial-home-32",
                  text: `I'm a passionate photographer based in Manila, capturing life's most meaningful moments.

With over a decade of experience, I bring artistry and technical expertise to every session.`,
                },
              },
            ],
            id: "AboutPreset-editorial-home-30",
            backgroundImages: [],
            overlayOpacity: 0,
            minHeight: "auto",
            alignX: "left",
            alignY: "top",
            bgAnimation: "crossfade",
            bgSpeed: "medium",
          },
        },
        {
          type: "ServicesPreset",
          props: {
            content: [
              {
                type: "Heading",
                props: {
                  id: "Heading-editorial-home-34",
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
                              id: "ContainerAnchor-editorial-home-37",
                              height: 0,
                            },
                          },
                          {
                            type: "Heading",
                            props: {
                              id: "Heading-editorial-home-38",
                              level: "h3",
                              text: "Wedding Photography",
                            },
                          },
                          {
                            type: "Text",
                            props: {
                              id: "Text-editorial-home-39",
                              text: "Full-day coverage of your most important day.",
                            },
                          },
                          {
                            type: "Text",
                            props: {
                              id: "Text-editorial-home-40",
                              text: "From ₱30,000",
                              _style: {
                                textColorToken: "accent",
                                bold: true,
                              },
                            },
                          },
                        ],
                        id: "Container-editorial-home-36",
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
                              id: "ContainerAnchor-editorial-home-42",
                              height: 0,
                            },
                          },
                          {
                            type: "Heading",
                            props: {
                              id: "Heading-editorial-home-43",
                              level: "h3",
                              text: "Portrait Sessions",
                            },
                          },
                          {
                            type: "Text",
                            props: {
                              id: "Text-editorial-home-44",
                              text: "Individual or family portraits in natural light.",
                            },
                          },
                          {
                            type: "Text",
                            props: {
                              id: "Text-editorial-home-45",
                              text: "From ₱8,000",
                              _style: {
                                textColorToken: "accent",
                                bold: true,
                              },
                            },
                          },
                        ],
                        id: "Container-editorial-home-41",
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
                              id: "ContainerAnchor-editorial-home-47",
                              height: 0,
                            },
                          },
                          {
                            type: "Heading",
                            props: {
                              id: "Heading-editorial-home-48",
                              level: "h3",
                              text: "Event Coverage",
                            },
                          },
                          {
                            type: "Text",
                            props: {
                              id: "Text-editorial-home-49",
                              text: "Corporate events, debuts, and intimate gatherings.",
                            },
                          },
                          {
                            type: "Text",
                            props: {
                              id: "Text-editorial-home-50",
                              text: "From ₱15,000",
                              _style: {
                                textColorToken: "accent",
                                bold: true,
                              },
                            },
                          },
                        ],
                        id: "Container-editorial-home-46",
                        _style: {
                          borderWidth: 1,
                          borderColorToken: "foreground",
                          paddingY: 24,
                          paddingX: 24,
                        },
                      },
                    },
                  ],
                  id: "Columns-editorial-home-35",
                  columns: 3,
                },
              },
            ],
            id: "ServicesPreset-editorial-home-33",
            backgroundImages: [],
            overlayOpacity: 0,
            minHeight: "auto",
            alignX: "center",
            alignY: "top",
            bgAnimation: "crossfade",
            bgSpeed: "medium",
          },
        },
        {
          type: "ContactPreset",
          props: {
            content: [
              {
                type: "Heading",
                props: {
                  id: "Heading-editorial-home-52",
                  level: "h2",
                  text: "Get in Touch",
                },
              },
              {
                type: "Text",
                props: {
                  id: "Text-editorial-home-53",
                  text: "I'd love to hear about your vision. Reach out and let's talk.",
                },
              },
              {
                type: "ContactDetails",
                props: {
                  id: "ContactDetails-editorial-home-54",
                },
              },
              {
                type: "Button",
                props: {
                  id: "Button-editorial-home-55",
                  label: "Send a Message",
                  action: "open-contact",
                  align: "center",
                },
              },
            ],
            id: "ContactPreset-editorial-home-51",
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
                type: "GalleryLandingPreset",
                props: {
                  content: [
                    {
                      type: "Heading",
                      props: {
                        id: "Heading-editorial-gal-3",
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
                        id: "Text-editorial-gal-4",
                        text: "A curated look at our work.",
                        _style: {
                          textColorToken: "background",
                        },
                      },
                    },
                  ],
                  id: "GalleryLandingPreset-editorial-gal-2",
                  backgroundImages: [],
                  overlayOpacity: 40,
                  minHeight: "medium",
                  alignX: "center",
                  alignY: "center",
                  _style: {
                    bgColorToken: "accent",
                    alignItems: "center",
                    colSpan: 2,
                  },
                },
              },
              {
                type: "CtaPreset",
                props: {
                  content: [
                    {
                      type: "Heading",
                      props: {
                        id: "Heading-editorial-gal-6",
                        level: "h2",
                        text: "Ready to book your session?",
                        _style: {
                          textColorToken: "background",
                        },
                      },
                    },
                    {
                      type: "Text",
                      props: {
                        id: "Text-editorial-gal-7",
                        text: "Let's create something beautiful together.",
                        _style: {
                          textColorToken: "background",
                        },
                      },
                    },
                    {
                      type: "Button",
                      props: {
                        id: "Button-editorial-gal-8",
                        label: "Get in Touch",
                        action: "open-contact",
                        align: "center",
                        _style: {
                          textColorToken: "secondary",
                          buttonStyle: "solid",
                          buttonColorToken: "accent",
                          radius: 4,
                        },
                      },
                    },
                  ],
                  id: "CtaPreset-editorial-gal-5",
                  backgroundImages: [],
                  overlayOpacity: 0,
                  minHeight: "medium",
                  alignX: "center",
                  alignY: "center",
                  _style: {
                    bgColorToken: "primary",
                    align: "center",
                    alignItems: "center",
                    textColorToken: "primary",
                  },
                },
              },
            ],
            id: "Columns-editorial-gal-1",
            columns: 3,
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
                  id: "Heading-editorial-gal-10",
                  level: "h2",
                  text: "Gallery highlights",
                },
              },
              {
                type: "Text",
                props: {
                  id: "Text-editorial-gal-11",
                  text: "A curated selection from one collection.",
                },
              },
              {
                type: "GalleryGrid",
                props: {
                  id: "GalleryGrid-editorial-gal-12",
                  images: [],
                  columns: 3,
                  gap: "normal",
                },
              },
            ],
            id: "GalleryGridPreset-editorial-gal-9",
            backgroundImages: [],
            overlayOpacity: 0,
            minHeight: "auto",
            alignX: "left",
            alignY: "top",
            bgAnimation: "crossfade",
            bgSpeed: "medium",
          },
        },
        {
          type: "Container",
          props: {
            content: [
              {
                type: "ContainerAnchor",
                props: {
                  id: "ContainerAnchor-editorial-gal-14",
                  height: 0,
                },
              },
            ],
            id: "Container-editorial-gal-13",
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
      ]
    ),
  }),
};
