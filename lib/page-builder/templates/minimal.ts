import { THEME_PRESET_DEFINITIONS } from "@/lib/page-builder/brandKitPicker/themePresetDefinitions";
import { onAccentBand } from "@/lib/page-builder/blocks/presets/_helpers";
import type { PortfolioTemplate } from "./types";
import { zone, navigationBlock } from "./_blocks";

/**
 * Minimal — Clean serif palette, image-first hero, about and contact side by side.
 * Faithful to the "Wedding Photographer" draft (themePreset: minimal).
 * ContainerAnchor children omitted — fillBlockDefaults re-injects them on apply.
 */
export const minimalTemplate: PortfolioTemplate = {
  id: "minimal",
  label: "Minimal",
  businessType: "photographer",
  description: "Clean serif palette, image-first hero, about and contact side by side.",
  previewImage: "/template-previews/minimal.svg",
  defaultBrandKit: { ...THEME_PRESET_DEFINITIONS.minimal.brandKit },
  defaultContact: {
    // title/description left unset so the locale-translated default applies.
    buttonStyle: "solid",
    buttonColor: "foreground",
    tabFontSize: "sm",
    tabColor: "foreground",
  },
  defaultCollectionsPopup: {},
  seedData: () => ({
    home: zone(
      [
        navigationBlock("Navigation-minimal-home-0"),
        {
          type: "HeroPreset",
          props: {
            id: "HeroPreset-minimal-home-1",
            content: [
              {
                type: "Heading",
                props: {
                  id: "Heading-minimal-home-2",
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
                  id: "Text-minimal-home-3",
                  text: "Fine art photography for weddings, portraits, and events.",
                  _style: {
                    textColorToken: "foreground",
                  },
                },
              },
              {
                type: "Columns",
                props: {
                  content: [
                    {
                      type: "Button",
                      props: {
                        id: "Button-minimal-home-5",
                        label: "View Gallery",
                        action: "go-to-gallery",
                        align: "center",
                        _style: {
                          selfAlign: "right",
                          radius: 0,
                          ...onAccentBand,
                        },
                      },
                    },
                    {
                      type: "Button",
                      props: {
                        label: "Get In Touch",
                        action: "open-contact",
                        align: "center",
                        size: "md",
                        id: "Button-minimal-home-6",
                        _style: {
                          selfAlign: "left",
                          ...onAccentBand,
                        },
                      },
                    },
                  ],
                  columns: 2,
                  _style: {
                    gap: 16,
                  },
                  id: "Columns-minimal-home-4",
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
          type: "Columns",
          props: {
            id: "Columns-minimal-home-7",
            content: [
              {
                type: "AboutPreset",
                props: {
                  content: [
                    {
                      type: "Heading",
                      props: {
                        id: "Heading-minimal-home-9",
                        level: "h2",
                        text: "About Me",
                      },
                    },
                    {
                      type: "Text",
                      props: {
                        id: "Text-minimal-home-10",
                        text: `I'm a passionate photographer based in Manila, capturing life's most meaningful moments.

With over a decade of experience, I bring artistry and technical expertise to every session.`,
                      },
                    },
                  ],
                  backgroundImages: [],
                  overlayOpacity: 0,
                  minHeight: "auto",
                  alignX: "left",
                  alignY: "top",
                  id: "AboutPreset-minimal-home-8",
                },
              },
              {
                type: "ContactPreset",
                props: {
                  content: [
                    {
                      type: "Heading",
                      props: {
                        id: "Heading-minimal-home-12",
                        level: "h2",
                        text: "Get in Touch",
                      },
                    },
                    {
                      type: "Text",
                      props: {
                        id: "Text-minimal-home-13",
                        text: "I'd love to hear about your vision. Reach out and let's talk.",
                      },
                    },
                    {
                      type: "ContactDetails",
                      props: {
                        id: "ContactDetails-minimal-home-14",
                        columns: 2,
                        email: "",
                      },
                    },
                    {
                      type: "Button",
                      props: {
                        id: "Button-minimal-home-15",
                        label: "Send a Message",
                        action: "open-contact",
                        align: "center",
                      },
                    },
                  ],
                  backgroundImages: [],
                  overlayOpacity: 0,
                  minHeight: "auto",
                  alignX: "center",
                  alignY: "top",
                  id: "ContactPreset-minimal-home-11",
                },
              },
            ],
            columns: 2,
            _style: {
              gap: 16,
            },
            overallWidth: "page-fit",
          },
        },
      ]
    ),
    gallery: zone(
      [
        navigationBlock("Navigation-minimal-gal-0"),
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
                        id: "Heading-minimal-gal-3",
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
                        id: "Text-minimal-gal-4",
                        text: "A curated look at our work.",
                        _style: {
                          textColorToken: "foreground",
                        },
                      },
                    },
                  ],
                  id: "GalleryLandingPreset-minimal-gal-2",
                  backgroundImages: [],
                  overlayOpacity: 40,
                  minHeight: "medium",
                  alignX: "center",
                  alignY: "center",
                  _style: {
                    bgColorToken: "accent",
                    colSpan: 3,
                    rowSpan: 2,
                    alignItems: "center",
                  },
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
                              id: "ContainerAnchor-minimal-gal-7",
                              height: 0,
                            },
                          },
                        ],
                        id: "Container-minimal-gal-6",
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
                              id: "ContainerAnchor-minimal-gal-9",
                              height: 0,
                            },
                          },
                        ],
                        id: "Container-minimal-gal-8",
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
                              id: "ContainerAnchor-minimal-gal-11",
                              height: 0,
                            },
                          },
                        ],
                        id: "Container-minimal-gal-10",
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
                              id: "ContainerAnchor-minimal-gal-13",
                              height: 0,
                            },
                          },
                        ],
                        id: "Container-minimal-gal-12",
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
                  ],
                  id: "Columns-minimal-gal-5",
                  columns: 2,
                  rows: 2,
                  _style: {
                    gap: 4,
                    colSpan: 2,
                    rowSpan: 2,
                    paddingLeft: "0px",
                    paddingRight: "0px",
                    paddingTop: "0px",
                    paddingBottom: "0px",
                  },
                },
              },
            ],
            id: "Columns-minimal-gal-1",
            columns: 5,
            rows: 2,
            _style: {
              gap: 4,
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
                  id: "Heading-minimal-gal-15",
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
                              id: "ContainerAnchor-minimal-gal-18",
                              height: 0,
                            },
                          },
                          {
                            type: "Heading",
                            props: {
                              id: "Heading-minimal-gal-19",
                              level: "h3",
                              text: "Wedding Photography",
                            },
                          },
                          {
                            type: "Text",
                            props: {
                              id: "Text-minimal-gal-20",
                              text: "Full-day coverage of your most important day.",
                            },
                          },
                          {
                            type: "Text",
                            props: {
                              id: "Text-minimal-gal-21",
                              text: "From ₱30,000",
                              _style: {
                                textColorToken: "foreground",
                                bold: true,
                              },
                            },
                          },
                        ],
                        id: "Container-minimal-gal-17",
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
                              id: "ContainerAnchor-minimal-gal-23",
                              height: 0,
                            },
                          },
                          {
                            type: "Heading",
                            props: {
                              id: "Heading-minimal-gal-24",
                              level: "h3",
                              text: "Portrait Sessions",
                            },
                          },
                          {
                            type: "Text",
                            props: {
                              id: "Text-minimal-gal-25",
                              text: "Individual or family portraits in natural light.",
                            },
                          },
                          {
                            type: "Text",
                            props: {
                              id: "Text-minimal-gal-26",
                              text: "From ₱8,000",
                              _style: {
                                textColorToken: "foreground",
                                bold: true,
                              },
                            },
                          },
                        ],
                        id: "Container-minimal-gal-22",
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
                              id: "ContainerAnchor-minimal-gal-28",
                              height: 0,
                            },
                          },
                          {
                            type: "Heading",
                            props: {
                              id: "Heading-minimal-gal-29",
                              level: "h3",
                              text: "Event Coverage",
                            },
                          },
                          {
                            type: "Text",
                            props: {
                              id: "Text-minimal-gal-30",
                              text: "Corporate events, debuts, and intimate gatherings.",
                            },
                          },
                          {
                            type: "Text",
                            props: {
                              id: "Text-minimal-gal-31",
                              text: "From ₱15,000",
                              _style: {
                                textColorToken: "foreground",
                                bold: true,
                              },
                            },
                          },
                        ],
                        id: "Container-minimal-gal-27",
                        _style: {
                          borderWidth: 1,
                          borderColorToken: "foreground",
                          paddingY: 24,
                          paddingX: 24,
                        },
                      },
                    },
                  ],
                  id: "Columns-minimal-gal-16",
                  columns: 3,
                },
              },
            ],
            id: "ServicesPreset-minimal-gal-14",
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
  }),
};
