import { THEME_PRESET_DEFINITIONS } from "@/lib/page-builder/brandKitPicker/themePresetDefinitions";
import type { PortfolioTemplate } from "./types";
import { zone, navigationBlock } from "./_blocks";

/**
 * Modern — Warm neutral palette, clean serif headings, structured full-bleed sections.
 * Ported 1:1 from the "Modern Template" reference draft.
 */
export const modernTemplate: PortfolioTemplate = {
  id: "modern",
  label: "Modern",
  businessType: "planner",
  description: "Warm neutral palette, clean serif headings, structured full-bleed sections.",
  previewImage: "/template-previews/modern.svg",
  defaultBrandKit: { ...THEME_PRESET_DEFINITIONS.modern.brandKit },
  defaultContact: {
    buttonStyle: "solid",
    buttonColor: "foreground",
    popupRadius: "sharp",
  },
  defaultCollectionsPopup: {
    popupLayout: "justified",
    popupColumns: 3,
    imageModalLayout: "sheet",
    closeButtonBorderWidth: 0,
  },
  seedData: (ctx) => ({
    home: zone([
      navigationBlock("Navigation-modern-home-0", {
      contactButtonColor: "primary",
      contactButtonTextColor: "foreground",
      contactButtonRadius: "sharp",
      underlineColor: "primary",
      activeLinkHighlight: false,
      activeLinkRadius: "sharp",
    }, ctx.workspace.name),
    {
      type: "PageBody",
      props: {
        id: "page-body",
        content: [
          {
            type: "HeroSplitPreset",
            props: {
              id: "HeroSplitPreset-bca68827-4d8b-4949-8124-27f205585dff",
              content: [
                {
                  type: "Container",
                  props: {
                    id: "Container-ad877111-d891-4822-9a30-ed76738cf4ce",
                    content: [
                      {
                        type: "Columns",
                        props: {
                          id: "Columns-71689d96-7a3f-496e-bef3-8418debd0f44",
                          content: [
                            {
                              type: "Container",
                              props: {
                                id: "Container-44f9813a-a159-43d3-b404-e48503efff07",
                                content: [
                                  {
                                    type: "Heading",
                                    props: {
                                      id: "Heading-2063eddb-7970-46d3-a1cf-8a19909ce97e",
                                      level: "h1",
                                      text: "Capturing moments that last forever",
                                    },
                                  },
                                  {
                                    type: "Text",
                                    props: {
                                      id: "Text-5aa98ef6-5d80-4f4f-b401-94ada2e2ee19",
                                      text: "Fine art photography for weddings, portraits, and events across Metro Manila.",
                                    },
                                  },
                                  {
                                    type: "Container",
                                    props: {
                                      id: "Container-8aa626de-ab1d-47a5-a399-dbc0f62d6dcc",
                                      content: [
                                        {
                                          type: "Button",
                                          props: {
                                            id: "Button-c50ca032-2607-411f-bdbe-a5ba9b97927b",
                                            label: "View Gallery",
                                            action: "open-contact",
                                            align: "left",
                                            _style: {
                                              selfAlign: "center",
                                              buttonColorToken: "foreground",
                                              textColorToken: "background",
                                              buttonStyle: "solid",
                                              radius: 0,
                                            },
                                          },
                                        },
                                        {
                                          type: "Button",
                                          props: {
                                            id: "Button-0f075a62-d64e-4f14-b668-dbb36f71910b",
                                            label: "Get in Touch",
                                            action: "open-contact",
                                            align: "left",
                                            _style: {
                                              radius: 0,
                                            },
                                          },
                                        },
                                      ],
                                      backgroundImages: [],
                                      bgAnimation: "crossfade",
                                      bgSpeed: "medium",
                                      overlayOpacity: 0,
                                      minHeight: "auto",
                                      alignX: "left",
                                      alignY: "top",
                                      overallWidth: "page-fit",
                                      _style: {
                                        flexDirection: "row",
                                        contentHorizontalAlign: "center",
                                        paddingLeft: "0px",
                                        paddingRight: "0px",
                                        paddingTop: "0px",
                                        paddingBottom: "0px",
                                      },
                                    },
                                  },
                                ],
                                minHeight: "auto",
                                _style: {
                                  gap: 22,
                                  contentVerticalDistribution: "center",
                                },
                                backgroundImages: [],
                              },
                            },
                            {
                              type: "Image",
                              props: {
                                id: "Image-82a784b1-d0b0-4d8c-9cb8-bfcd6ab32ec5",
                                alt: "Studio portrait",
                                _style: {
                                  height: "100%",
                                  cellVerticalAlign: "stretch",
                                },
                              },
                            },
                          ],
                          columns: 2,
                          minHeight: "0px",
                          _style: {
                            gap: 40,
                          },
                          overallWidth: "full",
                        },
                      },
                      {
                        type: "ContainerAnchor",
                        props: {
                          id: "Container-ad877111-d891-4822-9a30-ed76738cf4ce--anchor",
                          height: 0,
                        },
                      },
                    ],
                    overallWidth: "page-fit",
                    _style: {
                      paddingLeft: "0px",
                      paddingRight: "0px",
                      paddingTop: "0px",
                      paddingBottom: "0px",
                    },
                    backgroundImages: [],
                  },
                },
              ],
              backgroundImages: [],
              minHeight: "medium",
              alignY: "center",
              _style: {
                bgColorToken: "background",
                gap: 0,
                paddingLeft: "0px",
                paddingRight: "0px",
              },
              bgAnimation: "crossfade",
              bgSpeed: "medium",
              overlayOpacity: 0,
              alignX: "left",
              overallWidth: "full",
            },
          },
          {
            type: "FeaturedWorkIndexPreset",
            props: {
              id: "FeaturedWorkIndexPreset-50fd6560-d82e-4f26-9981-35cf6834e955",
              content: [
                {
                  type: "Container",
                  props: {
                    overallWidth: "page-fit",
                    alignX: "left",
                    alignY: "top",
                    _style: {
                    gap: 0,
                      paddingTop: "0px",
                      paddingRight: "0px",
                      paddingBottom: "0px",
                      paddingLeft: "0px",
                      marginBottom: "0px",
                    },
                    content: [
                {
                  type: "Container",
                  props: {
                    id: "Container-e75f234b-47b5-413e-a267-10a1f0607ec1",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "Heading-a769a781-6724-45f7-b9c0-e98dbc57dc24",
                          level: "h2",
                          text: "Featured work",
                        },
                      },
                      {
                        type: "Text",
                        props: {
                          id: "Text-1724f96a-effc-46d4-98b7-10f6a2bf15b1",
                          text: "Four collections",
                        },
                      },
                    ],
                    _style: {
                      flexDirection: "row",
                      contentVerticalDistribution: "between",
                      gap: 16,
                      contentHorizontalAlign: "center",
                    },
                    backgroundImages: [],
                  },
                },
                {
                  type: "Container",
                  props: {
                    id: "Container-b7d61071-4022-462e-b5e4-ea83bdd11fb9",
                    content: [
                      {
                        type: "Columns",
                        props: {
                          id: "Columns-ddef38e0-b6e0-4f59-8f35-692350e4e4c7",
                          content: [
                            {
                              type: "CollectionCard",
                              props: {
                                id: "CollectionCard-c38066cf-d125-4095-bc0b-3407e90fdb9f",
                                aspectRatio: "1 / 1",
                                showCaption: true,
                                _style: {
                                  bgColorToken: "secondary",
                                },
                              },
                            },
                            {
                              type: "CollectionCard",
                              props: {
                                id: "CollectionCard-ee230953-b8be-4388-b90d-805fa0321456",
                                aspectRatio: "1 / 1",
                                showCaption: true,
                                _style: {
                                  bgColorToken: "secondary",
                                },
                              },
                            },
                            {
                              type: "CollectionCard",
                              props: {
                                id: "CollectionCard-3d37ee99-83f9-4f66-8645-091b5da3b8c2",
                                aspectRatio: "1 / 1",
                                showCaption: true,
                                _style: {
                                  bgColorToken: "secondary",
                                },
                              },
                            },
                            {
                              type: "CollectionCard",
                              props: {
                                id: "CollectionCard-627c89e1-8d89-4415-b230-6030de55f3a4",
                                aspectRatio: "1 / 1",
                                showCaption: true,
                                _style: {
                                  bgColorToken: "secondary",
                                },
                              },
                            },
                          ],
                          columns: 4,
                          overallWidth: "full",
                          minHeight: "0px",
                          _style: {
                            gap: 16,
                          },
                        },
                      },
                      {
                        type: "ContainerAnchor",
                        props: {
                          id: "Container-b7d61071-4022-462e-b5e4-ea83bdd11fb9--anchor",
                          height: 0,
                        },
                      },
                    ],
                    overallWidth: "page-fit",
                    _style: {
                      paddingTop: "0px",
                      paddingBottom: "0px",
                    },
                    backgroundImages: [],
                  },
                },
              ],
                  },
                },
              ],
              backgroundImages: [],
              minHeight: "auto",
              _style: {
                bgColorToken: "primary",
                textColorToken: "foreground",
                gap: 0,
                paddingTop: "0px",
                paddingBottom: "0px",
                paddingLeft: "0px",
                paddingRight: "0px",
              },
              overallWidth: "full",
              bgAnimation: "crossfade",
              bgSpeed: "medium",
              overlayOpacity: 0,
              alignX: "left",
              alignY: "top",
            },
          },
          {
            type: "ServicesPreset",
            props: {
              id: "ServicesPreset-3ecca4a6-da82-43db-b342-5cc6881b6b48",
              content: [
                {
                  type: "Container",
                  props: {
                    overallWidth: "page-fit",
                    alignX: "center",
                    alignY: "top",
                    _style: {
                      paddingTop: "0px",
                      paddingRight: "0px",
                      paddingBottom: "0px",
                      paddingLeft: "0px",
                      marginBottom: "0px",
                    },
                    content: [
                {
                  type: "Container",
                  props: {
                    id: "Container-115e308c-4848-4561-9a6e-c9b37a44f2a3",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "Heading-7b5b0cb1-2081-414b-bc3c-3ae75e69ebd8",
                          level: "h2",
                          text: "Services",
                        },
                      },
                      {
                        type: "Columns",
                        props: {
                          id: "Columns-b410439e-1f85-4d53-98af-433d5899d83d",
                          content: [
                            {
                              type: "Container",
                              props: {
                                id: "Container-979ba419-a82b-4fa6-8b3b-3ad1a2e5ae5b",
                                content: [
                                  {
                                    type: "Container",
                                    props: {
                                      id: "Container-8d3444b2-5b59-4efd-a017-b3e3a8f46d26",
                                      content: [
                                        {
                                          type: "Heading",
                                          props: {
                                            id: "Heading-9d68c743-42db-4406-8358-c70501533f24",
                                            level: "h3",
                                            text: "Wedding Photography",
                                          },
                                        },
                                        {
                                          type: "Text",
                                          props: {
                                            id: "Text-baa604f6-9a84-4225-8e0f-da3f0a88feaa",
                                            text: "Full-day coverage of your most important day.",
                                          },
                                        },
                                      ],
                                      backgroundImages: [],
                                      bgAnimation: "crossfade",
                                      bgSpeed: "medium",
                                      overlayOpacity: 0,
                                      minHeight: "auto",
                                      alignX: "left",
                                      alignY: "top",
                                      _style: {
                                        paddingLeft: "0px",
                                        paddingRight: "0px",
                                        paddingTop: "0px",
                                        paddingBottom: "0px",
                                      },
                                    },
                                  },
                                  {
                                    type: "Text",
                                    props: {
                                      id: "Text-7e4af2fb-c2c1-4315-a94a-bffb5b1be507",
                                      text: "From ₱30,000",
                                      _style: {
                                        textColorToken: "foreground",
                                        bold: true,
                                      },
                                    },
                                  },
                                ],
                                _style: {
                                  borderWidth: 1,
                                  borderColorToken: "foreground",
                                  paddingY: 24,
                                  paddingX: 24,
                                  radius: 0,
                                  contentVerticalDistribution: "between",
                                },
                                backgroundImages: [],
                              },
                            },
                            {
                              type: "Container",
                              props: {
                                id: "Container-45915a92-4a53-4604-b27b-35fe980d2130",
                                content: [
                                  {
                                    type: "Container",
                                    props: {
                                      id: "Container-7f544d46-1d02-4223-94d6-5653d72bb09d",
                                      content: [
                                        {
                                          type: "Heading",
                                          props: {
                                            id: "Heading-c2a9993b-cf28-455e-b2a4-be1c297b37c5",
                                            level: "h3",
                                            text: "Portrait Sessions",
                                          },
                                        },
                                        {
                                          type: "Text",
                                          props: {
                                            id: "Text-92cf59f2-4e6f-4ae9-9b0b-03725c27d1ff",
                                            text: "Individual or family portraits in natural light.",
                                          },
                                        },
                                      ],
                                      backgroundImages: [],
                                      bgAnimation: "crossfade",
                                      bgSpeed: "medium",
                                      overlayOpacity: 0,
                                      minHeight: "auto",
                                      alignX: "left",
                                      alignY: "top",
                                      _style: {
                                        paddingLeft: "0px",
                                        paddingRight: "0px",
                                        paddingTop: "0px",
                                        paddingBottom: "0px",
                                      },
                                    },
                                  },
                                  {
                                    type: "Text",
                                    props: {
                                      id: "Text-5708ead1-4f35-49ce-b12f-7ebd9d893405",
                                      text: "From ₱8,000",
                                      _style: {
                                        textColorToken: "foreground",
                                        bold: true,
                                      },
                                    },
                                  },
                                ],
                                _style: {
                                  borderWidth: 1,
                                  borderColorToken: "foreground",
                                  paddingY: 24,
                                  paddingX: 24,
                                  radius: 0,
                                  contentVerticalDistribution: "between",
                                },
                                backgroundImages: [],
                              },
                            },
                            {
                              type: "Container",
                              props: {
                                id: "Container-fe31c9de-89ef-4a37-a85c-f999203c9465",
                                content: [
                                  {
                                    type: "Container",
                                    props: {
                                      id: "Container-43de5622-a3a6-49a0-a8e8-55f9a2914f86",
                                      content: [
                                        {
                                          type: "Heading",
                                          props: {
                                            id: "Heading-9370006c-f162-4192-9036-5cb01aab0cf9",
                                            level: "h3",
                                            text: "Event Coverage",
                                          },
                                        },
                                        {
                                          type: "Text",
                                          props: {
                                            id: "Text-9aecf631-c312-4614-8095-9aeb2a5436bb",
                                            text: "Corporate events, debuts, and intimate gatherings.",
                                          },
                                        },
                                      ],
                                      backgroundImages: [],
                                      bgAnimation: "crossfade",
                                      bgSpeed: "medium",
                                      overlayOpacity: 0,
                                      minHeight: "auto",
                                      alignX: "left",
                                      alignY: "top",
                                      _style: {
                                        paddingLeft: "0px",
                                        paddingRight: "0px",
                                        paddingTop: "0px",
                                        paddingBottom: "0px",
                                      },
                                    },
                                  },
                                  {
                                    type: "Text",
                                    props: {
                                      id: "Text-b742b210-51d8-424c-9ee5-082e4c42eaf7",
                                      text: "From ₱15,000",
                                      _style: {
                                        textColorToken: "foreground",
                                        bold: true,
                                      },
                                    },
                                  },
                                ],
                                _style: {
                                  borderWidth: 1,
                                  borderColorToken: "foreground",
                                  paddingY: 24,
                                  paddingX: 24,
                                  radius: 0,
                                  contentVerticalDistribution: "between",
                                },
                                backgroundImages: [],
                              },
                            },
                          ],
                          columns: 3,
                          overallWidth: "full",
                          _style: {
                            radius: 0,
                          },
                        },
                      },
                    ],
                    backgroundImages: [],
                    bgAnimation: "crossfade",
                    bgSpeed: "medium",
                    overlayOpacity: 0,
                    minHeight: "auto",
                    alignX: "left",
                    alignY: "top",
                    _style: {
                      paddingLeft: "0px",
                      paddingRight: "0px",
                      paddingTop: "0px",
                      paddingBottom: "0px",
                    },
                  },
                },
              ],
                  },
                },
              ],
              backgroundImages: [],
              overlayOpacity: 0,
              minHeight: "auto",
              alignX: "center",
              alignY: "top",
              _style: {
                bgColorToken: "background",
              },
              bgAnimation: "crossfade",
              bgSpeed: "medium",
              overallWidth: "full",
            },
          },
          {
            type: "AboutProfilePreset",
            props: {
              id: "AboutProfilePreset-ab9f42fb-5fa9-4fa2-989e-7787a4355e50",
              content: [
                {
                  type: "Container",
                  props: {
                    id: "Container-4ce4d626-b4ca-433f-a04e-acd23ff98739",
                    content: [
                      {
                        type: "Columns",
                        props: {
                          id: "Columns-92cea785-0b45-4cf9-8b79-b148e87ec59e",
                          content: [
                            {
                              type: "Container",
                              props: {
                                id: "Container-23a897f8-23d4-4062-900f-be8ce6488380",
                                content: [
                                  {
                                    type: "Heading",
                                    props: {
                                      id: "Heading-bdeb726b-66bb-4036-ba72-730b5ee11469",
                                      level: "h2",
                                      text: "About Me",
                                    },
                                  },
                                  {
                                    type: "Text",
                                    props: {
                                      id: "Text-cf3c83fd-6795-4101-b404-9a69287c8506",
                                      text: "I'm a passionate photographer based in Manila, capturing life's most meaningful moments.\n\nWith over a decade of experience, I bring artistry and technical expertise to every session.",
                                    },
                                  },
                                ],
                                _style: {
                                  colSpan: 2,
                                  gap: 16,
                                  paddingLeft: "0px",
                                  paddingRight: "0px",
                                  paddingTop: "0px",
                                  paddingBottom: "0px",
                                },
                                backgroundImages: [],
                              },
                            },
                            {
                              type: "Container",
                              props: {
                                id: "Container-06a46bb3-4622-49a6-99bc-06ac687afcfd",
                                content: [
                                  {
                                    type: "Heading",
                                    props: {
                                      id: "Heading-5d260b59-0a89-4d7d-b2be-4bdbed9c0992",
                                      level: "h4",
                                      text: "Based in",
                                    },
                                  },
                                  {
                                    type: "Text",
                                    props: {
                                      id: "Text-91da170d-10f1-405b-b055-f155398f1bff",
                                      text: "Makati City",
                                    },
                                  },
                                  {
                                    type: "Heading",
                                    props: {
                                      id: "Heading-747b0c09-d2e8-4f41-bf43-ab659050b2a8",
                                      level: "h4",
                                      text: "Working since",
                                    },
                                  },
                                  {
                                    type: "Text",
                                    props: {
                                      id: "Text-8648057e-6eb0-4327-897e-89fa1fb24641",
                                      text: "2016",
                                    },
                                  },
                                  {
                                    type: "Heading",
                                    props: {
                                      id: "Heading-0b474dd9-3eb3-4c12-9acb-9ea6c6240311",
                                      level: "h4",
                                      text: "Specialty",
                                    },
                                  },
                                  {
                                    type: "Text",
                                    props: {
                                      id: "Text-22b55aa7-267a-42e0-8a61-f9fbc2ab6ea0",
                                      text: "Weddings and portraits",
                                    },
                                  },
                                  {
                                    type: "Heading",
                                    props: {
                                      id: "Heading-b16c6d46-1ca2-48d8-94e9-ed0e464bbc32",
                                      level: "h4",
                                      text: "Travel",
                                    },
                                  },
                                  {
                                    type: "Text",
                                    props: {
                                      id: "Text-32a70e71-0080-4677-94b7-e208c2c07b35",
                                      text: "Nationwide",
                                    },
                                  },
                                ],
                                _style: {
                                  gap: 14,
                                },
                                backgroundImages: [],
                              },
                            },
                          ],
                          columns: 3,
                          minHeight: "0px",
                          _style: {
                            gap: 40,
                          },
                          overallWidth: "full",
                        },
                      },
                      {
                        type: "ContainerAnchor",
                        props: {
                          id: "Container-4ce4d626-b4ca-433f-a04e-acd23ff98739--anchor",
                          height: 0,
                        },
                      },
                    ],
                    overallWidth: "page-fit",
                    _style: {
                      paddingLeft: "0px",
                      paddingRight: "0px",
                      paddingTop: "0px",
                      paddingBottom: "0px",
                    },
                    backgroundImages: [],
                  },
                },
              ],
              backgroundImages: [],
              minHeight: "auto",
              _style: {
                bgColorToken: "primary",
                textColorToken: "foreground",
                gap: 0,
              },
              bgAnimation: "crossfade",
              bgSpeed: "medium",
              overlayOpacity: 0,
              alignX: "left",
              alignY: "top",
              overallWidth: "full",
            },
          },
        ],
        marginX: "1.5rem",
        containerDefaults: {
          radius: 0,
        },
      },
    },
    {
      type: "FooterDirectoryPreset",
      props: {
        id: "5c07dc46-dcfd-42a6-8e96-915364a8a13a",
        content: [
          {
            type: "Divider",
            props: {
              id: "054e07b5-2d09-4915-922c-882af0b2fbc6",
              thickness: 1,
              _style: {
                paddingLeft: "0px",
                paddingRight: "0px",
              },
            },
          },
          {
            type: "Container",
            props: {
              id: "15d24504-cb00-4c6f-94dc-17bc55fd1b42",
              content: [
                {
                  type: "Columns",
                  props: {
                    id: "49545217-24ee-4620-a702-f7c9fce388ca",
                    content: [
                      {
                        type: "Container",
                        props: {
                          id: "c9135c59-96d6-4740-a6fb-520ed65fb683",
                          content: [
                            {
                              type: "Heading",
                              props: {
                                id: "6525c329-5ed7-4f17-b4ef-79e0b274149e",
                                level: "h3",
                                text: "Lumen Studio",
                              },
                            },
                            {
                              type: "Text",
                              props: {
                                id: "17ace401-b353-4bd9-8172-4980947b1b9a",
                                text: "Fine art photography for weddings, portraits, and events across Metro Manila.",
                              },
                            },
                          ],
                          _style: {
                            gap: 10,
                          },
                          backgroundImages: [],
                        },
                      },
                      {
                        type: "Container",
                        props: {
                          id: "5bc96c42-2023-43f5-83cc-ec1a31e8b5f2",
                          content: [
                            {
                              type: "Heading",
                              props: {
                                id: "d89fb802-84ac-4703-aeea-7a1b0e75cf96",
                                level: "h4",
                                text: "Explore",
                              },
                            },
                            {
                              type: "Button",
                              props: {
                                id: "c8dc8ddb-4949-4e49-897d-179a3ba3f182",
                                label: "Home",
                                action: "go-to-home",
                                align: "left",
                                size: "sm",
                                _style: {
                                  buttonStyle: "link",
                                },
                              },
                            },
                            {
                              type: "Button",
                              props: {
                                id: "d27338e3-48f1-4d23-9674-92606d7f8e87",
                                label: "Gallery",
                                action: "go-to-gallery",
                                align: "left",
                                size: "sm",
                                _style: {
                                  buttonStyle: "link",
                                },
                              },
                            },
                            {
                              type: "Button",
                              props: {
                                id: "2c115e74-0c7d-4a66-a553-cdbce126da7d",
                                label: "Contact",
                                action: "open-contact",
                                align: "left",
                                size: "sm",
                                _style: {
                                  buttonStyle: "link",
                                },
                              },
                            },
                          ],
                          _style: {
                            gap: 6,
                          },
                          backgroundImages: [],
                        },
                      },
                      {
                        type: "Container",
                        props: {
                          id: "d7c3859d-cf70-4ec6-8b09-ca5e7a22891b",
                          content: [
                            {
                              type: "Heading",
                              props: {
                                id: "e4a229f7-5d70-4774-8e4d-ff42bf63f799",
                                level: "h4",
                                text: "Studio",
                              },
                            },
                            {
                              type: "ContactDetails",
                              props: {
                                id: "37c0dc37-717a-4aeb-803d-1f947a331ce6",
                              },
                            },
                          ],
                          _style: {
                            gap: 12,
                          },
                          backgroundImages: [],
                        },
                      },
                    ],
                    columns: 3,
                    minHeight: "0px",
                    _style: {
                      gap: 40,
                    },
                    overallWidth: "full",
                  },
                },
                {
                  type: "ContainerAnchor",
                  props: {
                    id: "15d24504-cb00-4c6f-94dc-17bc55fd1b42--anchor",
                    height: 0,
                  },
                },
              ],
              overallWidth: "page-fit",
              _style: {
                paddingLeft: "0px",
                paddingRight: "0px",
                paddingTop: "0px",
                paddingBottom: "0px",
              },
              backgroundImages: [],
            },
          },
          {
            type: "Divider",
            props: {
              id: "85672dfe-57d6-43bc-8d4b-70db17ce6d13",
              thickness: 1,
              _style: {
                paddingLeft: "0px",
                paddingRight: "0px",
              },
            },
          },
          {
            type: "Container",
            props: {
              id: "006f8b74-0a4a-4b77-bc11-fad4ef649f1b",
              content: [
                {
                  type: "Text",
                  props: {
                    id: "7a33a34a-2a31-40b6-bee1-202eacdb4c84",
                    text: "© 2026 Lumen Studio",
                  },
                },
              ],
              overallWidth: "page-fit",
              _style: {
                contentHorizontalAlign: "start",
              },
              backgroundImages: [],
            },
          },
        ],
        _chrome: "footer",
        overallWidth: "full",
        backgroundImages: [],
        minHeight: "auto",
        _style: {
          bgColorToken: "background",
          gap: 0,
          paddingTop: "3rem",
          paddingBottom: "3rem",
        },
        bgAnimation: "crossfade",
        bgSpeed: "medium",
        overlayOpacity: 0,
        alignX: "left",
        alignY: "top",
      },
    }
    ]),
    gallery: zone([
      navigationBlock("Navigation-modern-gal-0", {
      contactButtonColor: "primary",
      contactButtonTextColor: "foreground",
      contactButtonRadius: "sharp",
      underlineColor: "primary",
      activeLinkHighlight: false,
      activeLinkRadius: "sharp",
    }, ctx.workspace.name),
    {
      type: "PageBody",
      props: {
        id: "page-body",
        content: [
          {
            type: "GalleryLandingSplitPreset",
            props: {
              id: "GalleryLandingSplitPreset-ce82bc42-4d3e-4ed3-a4b0-623f0c8c2b11",
              content: [
                {
                  type: "Container",
                  props: {
                    id: "Container-de29d9da-2535-4325-9dc5-2c475523b9d0",
                    content: [
                      {
                        type: "Container",
                        props: {
                          id: "Container-b2531ebd-b846-4bcb-bcea-4e02f9828644",
                          content: [
                            {
                              type: "Heading",
                              props: {
                                id: "Heading-f17c844b-fb87-432e-ad0d-b070946ad88d",
                                level: "h2",
                                text: "Our gallery",
                              },
                            },
                            {
                              type: "Text",
                              props: {
                                id: "Text-87918228-d971-4d87-b2d2-6d9713b8dc0c",
                                text: "A curated look at our work.",
                              },
                            },
                            {
                              type: "Divider",
                              props: {
                                id: "Divider-ef16f874-e250-4b34-8833-693efef7c527",
                                thickness: 1,
                                _style: {
                                  width: "3rem",
                                  paddingLeft: "0px",
                                  paddingRight: "0px",
                                },
                              },
                            },
                          ],
                          backgroundImages: [],
                          _style: {
                            bgColorToken: "primary",
                            textColorToken: "foreground",
                            width: "50%",
                            gap: 16,
                            paddingTop: "2rem",
                            paddingRight: "2rem",
                            paddingBottom: "2rem",
                            paddingLeft: "2rem",
                            radius: 0,
                            marginBottom: "0px",
                          },
                        },
                      },
                      {
                        type: "Image",
                        props: {
                          id: "Image-0008963e-93a6-4b65-92af-854d1edf368c",
                          alt: "Signature photograph",
                          _style: {
                            width: "50%",
                            radius: 0,
                          },
                        },
                      },
                    ],
                    backgroundImages: [],
                    bgAnimation: "crossfade",
                    bgSpeed: "medium",
                    overlayOpacity: 0,
                    minHeight: "auto",
                    alignX: "left",
                    alignY: "top",
                    overallWidth: "page-fit",
                    _style: {
                      flexDirection: "row",
                      gap: 0,
                      paddingLeft: "0px",
                      paddingRight: "0px",
                      paddingTop: "0px",
                      paddingBottom: "0px",
                      radius: 0,
                    },
                  },
                },
              ],
              backgroundImages: [],
              minHeight: "auto",
              overallWidth: "full",
              _style: {
                bgColorToken: "background",
                flexDirection: "row",
                gap: 0,
                radius: 0,
                paddingLeft: "0px",
                paddingRight: "0px",
              },
              bgAnimation: "crossfade",
              bgSpeed: "medium",
              overlayOpacity: 0,
              alignX: "left",
              alignY: "top",
            },
          },
          {
            type: "GalleryMasonryJournalPreset",
            props: {
              id: "GalleryMasonryJournalPreset-777cc78e-d4b1-4bd2-8fb2-703f631cd561",
              content: [
                {
                  type: "Container",
                  props: {
                    id: "Container-9e6f7e6b-ea70-43ac-b0dd-d371cf1fa82c",
                    content: [
                      {
                        type: "Columns",
                        props: {
                          id: "Columns-4d1b3204-5458-43a2-b3a9-84d996a3dcfb",
                          content: [
                            {
                              type: "GalleryMasonry",
                              props: {
                                id: "GalleryMasonry-db9d71a9-e6ff-41ad-a8e8-1963c56b3411",
                                column4: [],
                                column3: [],
                                column2: [
                                  {
                                    type: "Image",
                                    props: {
                                      id: "Image-3292cecf-eefc-4b0f-9f51-748a09c7f95c",
                                      alt: "",
                                      _style: {
                                        height: "25rem",
                                      },
                                    },
                                  },
                                  {
                                    type: "Image",
                                    props: {
                                      id: "Image-0340c7d1-717b-48fb-b929-0040a4da141c",
                                      alt: "",
                                      _style: {
                                        height: "28rem",
                                      },
                                    },
                                  },
                                  {
                                    type: "Image",
                                    props: {
                                      id: "Image-af37d8ba-0170-4c7f-be18-ce3d10f89ce3",
                                      alt: "",
                                      _style: {
                                        height: "16rem",
                                      },
                                    },
                                  },
                                  {
                                    type: "MasonryClone",
                                    props: {
                                      id: "GalleryMasonry-db9d71a9-e6ff-41ad-a8e8-1963c56b3411--clone-2",
                                      masonryId: "GalleryMasonry-db9d71a9-e6ff-41ad-a8e8-1963c56b3411",
                                      column: 2,
                                      gap: 4,
                                      sourceId: "Image-3292cecf-eefc-4b0f-9f51-748a09c7f95c",
                                      imageProps: {
                                        alt: "",
                                        _style: {
                                          height: "25rem",
                                        },
                                      },
                                      layoutSignature: "[[[\"Image\",\"Image-c88b460e-2264-4384-92ef-2a48ab39b738\",{\"height\":\"17rem\"}],[\"Image\",\"Image-07187126-8581-42f7-9be5-8706fe4746c9\",{\"height\":\"20rem\"}],[\"Image\",\"Image-f8f13046-d2f6-4c5f-9dbc-185d2817a081\",{\"height\":\"22rem\"}]],[[\"Image\",\"Image-3292cecf-eefc-4b0f-9f51-748a09c7f95c\",{\"height\":\"25rem\"}],[\"Image\",\"Image-0340c7d1-717b-48fb-b929-0040a4da141c\",{\"height\":\"28rem\"}],[\"Image\",\"Image-af37d8ba-0170-4c7f-be18-ce3d10f89ce3\",{\"height\":\"16rem\"}]]]",
                                    },
                                  },
                                ],
                                column1: [
                                  {
                                    type: "Image",
                                    props: {
                                      id: "Image-c88b460e-2264-4384-92ef-2a48ab39b738",
                                      alt: "",
                                      _style: {
                                        height: "17rem",
                                      },
                                    },
                                  },
                                  {
                                    type: "Image",
                                    props: {
                                      id: "Image-07187126-8581-42f7-9be5-8706fe4746c9",
                                      alt: "",
                                      _style: {
                                        height: "20rem",
                                      },
                                    },
                                  },
                                  {
                                    type: "Image",
                                    props: {
                                      id: "Image-f8f13046-d2f6-4c5f-9dbc-185d2817a081",
                                      alt: "",
                                      _style: {
                                        height: "22rem",
                                      },
                                    },
                                  },
                                  {
                                    type: "MasonryClone",
                                    props: {
                                      id: "GalleryMasonry-db9d71a9-e6ff-41ad-a8e8-1963c56b3411--clone-1",
                                      masonryId: "GalleryMasonry-db9d71a9-e6ff-41ad-a8e8-1963c56b3411",
                                      column: 1,
                                      gap: 4,
                                      sourceId: "Image-c88b460e-2264-4384-92ef-2a48ab39b738",
                                      imageProps: {
                                        alt: "",
                                        _style: {
                                          height: "17rem",
                                        },
                                      },
                                      layoutSignature: "[[[\"Image\",\"Image-c88b460e-2264-4384-92ef-2a48ab39b738\",{\"height\":\"17rem\"}],[\"Image\",\"Image-07187126-8581-42f7-9be5-8706fe4746c9\",{\"height\":\"20rem\"}],[\"Image\",\"Image-f8f13046-d2f6-4c5f-9dbc-185d2817a081\",{\"height\":\"22rem\"}]],[[\"Image\",\"Image-3292cecf-eefc-4b0f-9f51-748a09c7f95c\",{\"height\":\"25rem\"}],[\"Image\",\"Image-0340c7d1-717b-48fb-b929-0040a4da141c\",{\"height\":\"28rem\"}],[\"Image\",\"Image-af37d8ba-0170-4c7f-be18-ce3d10f89ce3\",{\"height\":\"16rem\"}]]]",
                                    },
                                  },
                                ],
                                content: [],
                                masonryLayout: "columns",
                                _style: {
                                  colSpan: 3,
                                  galleryColumns: 2,
                                  galleryGap: "tight",
                                  paddingTop: "24px",
                                  paddingBottom: "24px",
                                  masonryHeightPattern: "alternating",
                                },
                                masonryLoop: true,
                                images: [],
                              },
                            },
                            {
                              type: "Container",
                              props: {
                                id: "Container-01ca1af4-1de4-4e53-aac4-509a53365aa9",
                                content: [
                                  {
                                    type: "Heading",
                                    props: {
                                      id: "Heading-ca9cf2cb-2ac5-4070-85b2-7f3f5d36b471",
                                      level: "h2",
                                      text: "Story gallery",
                                    },
                                  },
                                  {
                                    type: "Text",
                                    props: {
                                      id: "Text-6c2a9011-ab05-4e65-b9c7-dbd64699d52a",
                                      text: "A more editorial layout for one collection.",
                                    },
                                  },
                                  {
                                    type: "Divider",
                                    props: {
                                      id: "Divider-b554b0f6-38ec-4c7a-bedd-223f47468114",
                                      thickness: 1,
                                      _style: {
                                        width: "3rem",
                                        paddingLeft: "0px",
                                        paddingRight: "0px",
                                      },
                                    },
                                  },
                                  {
                                    type: "Text",
                                    props: {
                                      id: "Text-648bce02-70cf-4fca-88e8-92aa694a9bda",
                                      text: "Shot over two days in Batangas, mostly at the hour when the light stops behaving.",
                                    },
                                  },
                                ],
                                _style: {
                                  bgColorToken: "accent",
                                  textColorToken: "foreground",
                                  paddingTop: "2rem",
                                  paddingRight: "2rem",
                                  paddingBottom: "2rem",
                                  paddingLeft: "2rem",
                                  radius: 0,
                                },
                                backgroundImages: [],
                              },
                            },
                          ],
                          columns: 4,
                          minHeight: "0px",
                          _style: {
                            gap: 0,
                            paddingLeft: "0px",
                            paddingRight: "0px",
                            paddingTop: "0px",
                            paddingBottom: "0px",
                            radius: 0,
                          },
                          overallWidth: "full",
                        },
                      },
                      {
                        type: "ContainerAnchor",
                        props: {
                          id: "Container-9e6f7e6b-ea70-43ac-b0dd-d371cf1fa82c--anchor",
                          height: 0,
                        },
                      },
                    ],
                    overallWidth: "page-fit",
                    _style: {
                      paddingLeft: "0px",
                      paddingRight: "0px",
                      paddingTop: "0px",
                      paddingBottom: "0px",
                      radius: 0,
                    },
                    backgroundImages: [],
                  },
                },
              ],
              minHeight: "auto",
              _style: {
                bgColorToken: "background",
                gap: 0,
                paddingLeft: "0px",
                paddingRight: "0px",
                paddingTop: "0px",
                paddingBottom: "0px",
                radius: 0,
              },
              backgroundImages: [],
              bgAnimation: "crossfade",
              bgSpeed: "medium",
              overlayOpacity: 0,
              alignX: "left",
              alignY: "top",
            },
          },
          {
            type: "FeaturedWorkLeadPreset",
            props: {
              id: "FeaturedWorkLeadPreset-d0b721f8-825a-483f-906f-3e7df4993377",
              content: [
                {
                  type: "Container",
                  props: {
                    id: "Container-5a7e791a-8de7-4b33-8dc1-69accf8ebed5",
                    content: [
                      {
                        type: "Container",
                        props: {
                          id: "Container-bb4e2d87-7d76-4b0b-94e8-e9fbb33faebb",
                          content: [
                            {
                              type: "Heading",
                              props: {
                                id: "Heading-5e00b72c-6ff5-40c5-89cf-e72b9e313adf",
                                level: "h2",
                                text: "Featured work",
                              },
                            },
                            {
                              type: "Text",
                              props: {
                                id: "Text-efefc21e-0d7a-4330-b689-e1872ea305c5",
                                text: "Two projects that say most of what I'd want to say in a first meeting.",
                              },
                            },
                          ],
                          backgroundImages: [],
                          bgAnimation: "crossfade",
                          bgSpeed: "medium",
                          overlayOpacity: 0,
                          minHeight: "auto",
                          alignX: "left",
                          alignY: "top",
                          _style: {
                            paddingLeft: "0px",
                            paddingRight: "0px",
                            paddingTop: "0px",
                            paddingBottom: "0px",
                          },
                        },
                      },
                      {
                        type: "ContainerAnchor",
                        props: {
                          id: "Container-5a7e791a-8de7-4b33-8dc1-69accf8ebed5--anchor",
                          height: 0,
                        },
                      },
                    ],
                    _style: {
                      bgColorToken: "accent",
                      textColorToken: "foreground",
                      gap: 12,
                      paddingTop: "2rem",
                      paddingRight: "2rem",
                      paddingBottom: "2rem",
                      paddingLeft: "2rem",
                    },
                    overallWidth: "full",
                    backgroundImages: [],
                  },
                },
                {
                  type: "Container",
                  props: {
                    id: "Container-6d6ef4a5-350a-4769-8a7e-4697bf996718",
                    content: [
                      {
                        type: "Columns",
                        props: {
                          id: "Columns-61e76467-da11-4e66-b8c3-10fc874a70c2",
                          content: [
                            {
                              type: "CollectionCard",
                              props: {
                                id: "CollectionCard-d4d430b4-883f-4396-823f-43785ec026c7",
                                aspectRatio: "3 / 2",
                                showCaption: true,
                                _style: {
                                  radius: 0,
                                  bgColorToken: "secondary",
                                },
                              },
                            },
                            {
                              type: "CollectionCard",
                              props: {
                                id: "CollectionCard-038f2ef7-790b-461b-a990-fe6600666c25",
                                aspectRatio: "3 / 2",
                                showCaption: true,
                                _style: {
                                  radius: 0,
                                  bgColorToken: "secondary",
                                },
                              },
                            },
                          ],
                          columns: 2,
                          overallWidth: "full",
                          minHeight: "0px",
                          _style: {
                            gap: 24,
                            radius: 0,
                          },
                        },
                      },
                      {
                        type: "ContainerAnchor",
                        props: {
                          id: "Container-6d6ef4a5-350a-4769-8a7e-4697bf996718--anchor",
                          height: 0,
                        },
                      },
                    ],
                    overallWidth: "page-fit",
                    backgroundImages: [],
                  },
                },
              ],
              backgroundImages: [],
              minHeight: "auto",
              _style: {
                bgColorToken: "background",
                gap: 32,
              },
              bgAnimation: "crossfade",
              bgSpeed: "medium",
              overlayOpacity: 0,
              alignX: "left",
              alignY: "top",
              overallWidth: "full",
            },
          },
          {
            type: "CtaPreset",
            props: {
              id: "CtaPreset-1cb687ae-e24b-4150-9ec5-335990ffb445",
              content: [
                {
                  type: "Container",
                  props: {
                    overallWidth: "page-fit",
                    alignX: "center",
                    alignY: "center",
                    _style: {
                    contentHorizontalAlign: "center",
                      paddingTop: "0px",
                      paddingRight: "0px",
                      paddingBottom: "0px",
                      paddingLeft: "0px",
                      marginBottom: "0px",
                    },
                    content: [
                {
                  type: "Heading",
                  props: {
                    id: "Heading-0ac4c66a-eb86-410d-b300-121938a1fae6",
                    level: "h2",
                    text: "Ready to book your session?",
                    _style: {
                      textColorToken: "foreground",
                    },
                  },
                },
                {
                  type: "Text",
                  props: {
                    id: "Text-4517f5ba-1477-4e51-8832-49bc5054c7d4",
                    text: "Let's create something beautiful together.",
                    _style: {
                      textColorToken: "foreground",
                    },
                  },
                },
                {
                  type: "Button",
                  props: {
                    id: "Button-30fc4558-0c1c-4022-a6ed-6d7ba038d164",
                    label: "Get in Touch",
                    action: "open-contact",
                    align: "center",
                    _style: {
                      buttonStyle: "soft",
                      buttonColorToken: "foreground",
                      textColorToken: "foreground",
                    },
                  },
                },
              ],
                  },
                },
              ],
              backgroundImages: [],
              overlayOpacity: 0,
              minHeight: "medium",
              alignX: "center",
              alignY: "center",
              _style: {
                bgColorToken: "accent",
                contentHorizontalAlign: "center",
                radius: 0,
              },
              bgAnimation: "crossfade",
              bgSpeed: "medium",
              overallWidth: "full",
            },
          },
        ],
        marginX: "1.5rem",
        containerDefaults: {
          radius: 0,
        },
      },
    },
    {
      type: "FooterDirectoryPreset",
      props: {
        id: "FooterDirectoryPreset-47bc1fae-7b65-42bf-91b0-b837e99f2f78",
        content: [
          {
            type: "Divider",
            props: {
              id: "9a25f41b-b43d-4b5d-8a74-7f36de918bdb",
              thickness: 1,
              _style: {
                paddingLeft: "0px",
                paddingRight: "0px",
              },
            },
          },
          {
            type: "Container",
            props: {
              id: "da3c8210-bdb7-45d5-b6a9-17bf8684725f",
              content: [
                {
                  type: "Columns",
                  props: {
                    id: "545911dd-064b-4e39-aad2-646486bbb710",
                    content: [
                      {
                        type: "Container",
                        props: {
                          id: "fae7b733-120c-4850-8959-d94ee04aa2ca",
                          content: [
                            {
                              type: "Heading",
                              props: {
                                id: "9f82cd31-365a-4b54-a44d-e488552eba1a",
                                level: "h3",
                                text: "Lumen Studio",
                              },
                            },
                            {
                              type: "Text",
                              props: {
                                id: "d2ab456b-fb0b-495b-8478-1a1ae5ccbf50",
                                text: "Fine art photography for weddings, portraits, and events across Metro Manila.",
                              },
                            },
                          ],
                          _style: {
                            gap: 10,
                          },
                          backgroundImages: [],
                        },
                      },
                      {
                        type: "Container",
                        props: {
                          id: "d5a87883-4de2-4d02-93b3-ce23f18d31ad",
                          content: [
                            {
                              type: "Heading",
                              props: {
                                id: "dcab6c38-76cb-48b1-8451-ef46b1142979",
                                level: "h4",
                                text: "Explore",
                              },
                            },
                            {
                              type: "Button",
                              props: {
                                id: "29a63b76-ae6e-4ad3-9f6c-dddd3e1904a4",
                                label: "Home",
                                action: "go-to-home",
                                align: "left",
                                size: "sm",
                                _style: {
                                  buttonStyle: "link",
                                },
                              },
                            },
                            {
                              type: "Button",
                              props: {
                                id: "b68f7ff9-3f49-4f85-a1e2-e97547c7f79f",
                                label: "Gallery",
                                action: "go-to-gallery",
                                align: "left",
                                size: "sm",
                                _style: {
                                  buttonStyle: "link",
                                },
                              },
                            },
                            {
                              type: "Button",
                              props: {
                                id: "67c202f9-b284-4894-9310-db1c5d27e72f",
                                label: "Contact",
                                action: "open-contact",
                                align: "left",
                                size: "sm",
                                _style: {
                                  buttonStyle: "link",
                                },
                              },
                            },
                          ],
                          _style: {
                            gap: 6,
                          },
                          backgroundImages: [],
                        },
                      },
                      {
                        type: "Container",
                        props: {
                          id: "fb59692c-76d4-40ee-8bdd-cc6d30c5acbe",
                          content: [
                            {
                              type: "Heading",
                              props: {
                                id: "42b3c1b7-b2c7-41fd-b772-15a74f902683",
                                level: "h4",
                                text: "Studio",
                              },
                            },
                            {
                              type: "ContactDetails",
                              props: {
                                id: "e0fded25-c30d-4dfd-9af8-df8ad79820b6",
                              },
                            },
                          ],
                          _style: {
                            gap: 12,
                          },
                          backgroundImages: [],
                        },
                      },
                    ],
                    columns: 3,
                    minHeight: "0px",
                    _style: {
                      gap: 40,
                    },
                    overallWidth: "full",
                  },
                },
                {
                  type: "ContainerAnchor",
                  props: {
                    id: "da3c8210-bdb7-45d5-b6a9-17bf8684725f--anchor",
                    height: 0,
                  },
                },
              ],
              overallWidth: "page-fit",
              _style: {
                paddingLeft: "0px",
                paddingRight: "0px",
                paddingTop: "0px",
                paddingBottom: "0px",
              },
              backgroundImages: [],
            },
          },
          {
            type: "Divider",
            props: {
              id: "1030daa0-fb1e-4798-b337-31e789edee2e",
              thickness: 1,
              _style: {
                paddingLeft: "0px",
                paddingRight: "0px",
              },
            },
          },
          {
            type: "Container",
            props: {
              id: "db73e93d-7afc-46ca-80f8-94366e099b3b",
              content: [
                {
                  type: "Text",
                  props: {
                    id: "5549a4dc-5714-4a6a-a013-d6d8375fce07",
                    text: "© 2026 Lumen Studio",
                  },
                },
              ],
              overallWidth: "page-fit",
              _style: {
                contentHorizontalAlign: "start",
              },
              backgroundImages: [],
            },
          },
        ],
        _chrome: "footer",
        overallWidth: "full",
        backgroundImages: [],
        minHeight: "auto",
        _style: {
          bgColorToken: "background",
          gap: 0,
          paddingTop: "3rem",
          paddingBottom: "3rem",
        },
        bgAnimation: "crossfade",
        bgSpeed: "medium",
        overlayOpacity: 0,
        alignX: "left",
        alignY: "top",
      },
    }
    ]),
  }),
};
