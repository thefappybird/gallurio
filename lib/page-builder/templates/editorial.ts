import { THEME_PRESET_DEFINITIONS } from "@/lib/page-builder/brandKitPicker/themePresetDefinitions";
import type { PortfolioTemplate } from "./types";
import { zone, navigationBlock } from "./_blocks";

/**
 * Editorial — Asymmetric mosaic hero, editorial type, suitable for photographers and planners.
 * Ported 1:1 from the "Editorial Template" reference draft.
 */
export const editorialTemplate: PortfolioTemplate = {
  id: "editorial",
  label: "Editorial",
  businessType: "photographer",
  description: "Asymmetric mosaic hero, editorial type, suitable for photographers and planners.",
  previewImage: "/template-previews/editorial.svg",
  defaultBrandKit: { ...THEME_PRESET_DEFINITIONS.editorial.brandKit },
  defaultContact: {
    buttonStyle: "solid",
    buttonColor: "foreground",
  },
  defaultCollectionsPopup: {
    popupLayout: "immersive",
    popupColumns: 3,
    imageModalLayout: "cinema",
  },
  seedData: (ctx) => ({
    home: zone([
      navigationBlock("Navigation-editorial-home-0", {}, ctx.workspace.name),
    {
      type: "PageBody",
      props: {
        id: "page-body",
        content: [
          {
            type: "HeroPreset",
            props: {
              id: "HeroPreset-b74faaf7-8d75-4ff8-90a3-6a77e346187d",
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
                    id: "Heading-78c228ab-9f36-4082-bfe0-77216ffd3cc8",
                    level: "h1",
                    text: "Capturing moments that last forever",
                    _style: {
                      textColorToken: "foreground",
                      bold: true,
                      align: "center",
                    },
                  },
                },
                {
                  type: "Text",
                  props: {
                    id: "Text-1f6675ab-f78c-45fb-a51a-800a757cd2ca",
                    text: "Fine art photography for weddings, portraits, and events.",
                    _style: {
                      textColorToken: "foreground",
                    },
                  },
                },
                {
                  type: "Container",
                  props: {
                    id: "Container-df66fb46-3306-45b7-acc1-59a08bc53b81",
                    content: [
                      {
                        type: "Button",
                        props: {
                          id: "Button-21a0e70c-dd65-46fa-b48c-9833966e2ce2",
                          label: "View Gallery",
                          action: "go-to-gallery",
                          align: "center",
                          _style: {
                            buttonStyle: "soft",
                            buttonColorToken: "foreground",
                            textColorToken: "foreground",
                            marginTop: "0px",
                            marginBottom: "0px",
                            marginRight: "0px",
                            marginLeft: "0px",
                            selfAlign: "center",
                          },
                        },
                      },
                      {
                        type: "Button",
                        props: {
                          id: "Button-15e1d8e1-9319-4e85-9eba-7cb13cfd5e32",
                          label: "Inquiry",
                          action: "open-contact",
                          align: "center",
                          _style: {
                            buttonStyle: "outline",
                            buttonColorToken: "foreground",
                            textColorToken: "foreground",
                            selfAlign: "left",
                            marginBottom: "0px",
                            marginTop: "0px",
                            marginRight: "0px",
                            marginLeft: "0px",
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
                      width: "fit-content",
                      flexDirection: "row",
                      marginBottom: "0px",
                      paddingLeft: "0px",
                      paddingRight: "0px",
                      paddingTop: "0px",
                      paddingBottom: "0px",
                      contentVerticalDistribution: "center",
                      contentHorizontalAlign: "center",
                    },
                  },
                },
              ],
                  },
                },
              ],
              backgroundImages: [],
              overlayOpacity: 50,
              overlayColorToken: "primary",
              minHeight: "tall",
              alignX: "center",
              alignY: "center",
              _style: {
                bgColorToken: "secondary",
                textColorToken: "foreground",
                contentHorizontalAlign: "center",
                paddingLeft: "0px",
                paddingRight: "0px",
              },
              bgAnimation: "crossfade",
              bgSpeed: "medium",
              overallWidth: "full",
            },
          },
          {
            type: "VideoSplitPreset",
            props: {
              id: "VideoSplitPreset-83301d07-8958-4ec9-ae4a-8e5f6f24a440",
              overallWidth: "full",
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
                  type: "Columns",
                  props: {
                    id: "Columns-935256db-9f7a-4d99-bc12-f9e9ad503adf",
                    content: [
                      {
                        type: "Video",
                        props: {
                          id: "Video-d00fdffb-58af-4431-b016-ed78e5e1ca72",
                          videoUrl: "",
                          _style: {
                            colSpan: 2,
                            cellVerticalAlign: "center",
                          },
                        },
                      },
                      {
                        type: "Container",
                        props: {
                          id: "Container-084b9962-a5f4-408f-a34e-cc03081fbd5e",
                          content: [
                            {
                              type: "Heading",
                              props: {
                                id: "Heading-8a90f5de-958a-4378-83ae-59adaaa56b89",
                                level: "h2",
                                text: "Watch our story",
                              },
                            },
                            {
                              type: "Text",
                              props: {
                                id: "Text-61097cc7-2dca-4fd7-bc86-c1cf96633cc4",
                                text: "A short film capturing the moments that matter most.",
                              },
                            },
                          ],
                          backgroundImages: [],
                          _style: {
                            bgColorToken: "secondary",
                            textColorToken: "foreground",
                            gap: 16,
                            paddingTop: "2rem",
                            paddingRight: "2rem",
                            paddingBottom: "2rem",
                            paddingLeft: "2rem",
                            contentVerticalDistribution: "center",
                          },
                        },
                      },
                    ],
                    columns: 3,
                    minHeight: "0px",
                    _style: {
                      gap: 40,
                    },
                  },
                },
              ],
                  },
                },
              ],
              backgroundImages: [],
              minHeight: "auto",
              _style: {
                bgColorToken: "background",
                gap: 0,
                paddingLeft: "0px",
                paddingRight: "0px",
                paddingTop: "0px",
                paddingBottom: "0px",
              },
              bgAnimation: "crossfade",
              bgSpeed: "medium",
              overlayOpacity: 0,
              alignX: "left",
              alignY: "top",
            },
          },
          {
            type: "AboutPreset",
            props: {
              id: "AboutPreset-6a523a79-a8a5-4cd1-b2a9-cd6185aa421e",
              overallWidth: "full",
              content: [
                {
                  type: "Container",
                  props: {
                    overallWidth: "page-fit",
                    alignX: "left",
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
                  type: "Heading",
                  props: {
                    id: "Heading-5880a758-22fe-4b05-b270-e64711f12580",
                    level: "h2",
                    text: "About Me",
                  },
                },
                {
                  type: "Text",
                  props: {
                    id: "Text-e7123255-cc30-44f1-b2bf-30466f62d001",
                    text: "I'm a passionate photographer based in Manila, capturing life's most meaningful moments.\n\nWith over a decade of experience, I bring artistry and technical expertise to every session.",
                  },
                },
              ],
                  },
                },
              ],
              backgroundImages: [],
              overlayOpacity: 0,
              minHeight: "auto",
              alignX: "left",
              alignY: "top",
              _style: {
                bgColorToken: "background",
              },
              bgAnimation: "crossfade",
              bgSpeed: "medium",
            },
          },
          {
            type: "FeaturedWorkLeadPreset",
            props: {
              id: "FeaturedWorkLeadPreset-f5729773-3d0e-4846-8c93-519e151cc967",
              content: [
                {
                  type: "Container",
                  props: {
                    id: "Container-79762f46-e789-4921-a48a-228b74999473",
                    content: [
                      {
                        type: "Container",
                        props: {
                          id: "Container-79762f46-e789-4921-a48a-228b74999474",
                          content: [
                            {
                              type: "Heading",
                              props: {
                                id: "Heading-d9c0a809-a0d0-4c56-a88c-b6334a181416",
                                level: "h2",
                                text: "Featured work",
                              },
                            },
                            {
                              type: "Text",
                              props: {
                                id: "Text-18b69836-c14c-4aec-8c2d-5d0b03a072c0",
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
                          id: "Container-79762f46-e789-4921-a48a-228b74999473--anchor",
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
                    id: "Container-580482dd-7013-4923-9a7a-d395360f66bc",
                    content: [
                      {
                        type: "Columns",
                        props: {
                          id: "Columns-babfd9df-1cf9-426b-a2b3-bc3122c1a466",
                          content: [
                            {
                              type: "CollectionCard",
                              props: {
                                id: "CollectionCard-cd086687-f25e-469b-86ef-dfa6dddc5380",
                                aspectRatio: "3 / 2",
                                showCaption: true,
                              },
                            },
                            {
                              type: "CollectionCard",
                              props: {
                                id: "CollectionCard-44e53e6b-5203-481b-a85d-8e4d0a18ef4c",
                                aspectRatio: "3 / 2",
                                showCaption: true,
                              },
                            },
                          ],
                          columns: 2,
                          minHeight: "0px",
                          _style: {
                            gap: 24,
                          },
                          overallWidth: "full",
                        },
                      },
                      {
                        type: "ContainerAnchor",
                        props: {
                          id: "Container-580482dd-7013-4923-9a7a-d395360f66bc--anchor",
                          height: 0,
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
                    overallWidth: "page-fit",
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
            type: "ContactSplitPreset",
            props: {
              id: "ContactSplitPreset-ef7f1de3-76f9-45c7-8736-6decc132099b",
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
                  type: "Columns",
                  props: {
                    id: "Columns-6fd9c96e-7787-42c5-b737-d038d7e5e290",
                    content: [
                      {
                        type: "Container",
                        props: {
                          id: "Container-cdc0860c-65a8-4dcc-8d6e-f708c7376dbc",
                          content: [
                            {
                              type: "Heading",
                              props: {
                                id: "Heading-c8b63633-1b8d-4429-aab2-61e368bdf03b",
                                level: "h2",
                                text: "Get in Touch",
                              },
                            },
                            {
                              type: "Text",
                              props: {
                                id: "Text-07e6a1b4-10d5-49d3-869c-6f5208cbf340",
                                text: "Tell me the date, the place, and what the day is supposed to feel like. I'll take it from there.",
                              },
                            },
                            {
                              type: "Button",
                              props: {
                                id: "Button-2ca659b7-0539-4898-a87d-8e3cd97c6794",
                                label: "Send a Message",
                                action: "open-contact",
                                align: "left",
                                _style: {
                                  buttonStyle: "outline",
                                  buttonColorToken: "foreground",
                                },
                              },
                            },
                          ],
                          _style: {
                            textColorToken: "foreground",
                            gap: 16,
                            paddingTop: "2rem",
                            paddingRight: "2rem",
                            paddingBottom: "2rem",
                            paddingLeft: "2rem",
                            contentVerticalDistribution: "center",
                          },
                        },
                      },
                      {
                        type: "Container",
                        props: {
                          id: "Container-943d76f6-cad1-4c27-9091-d5b68f4b0af4",
                          content: [
                            {
                              type: "Heading",
                              props: {
                                id: "Heading-ae9cee5c-53fb-49b0-bc3e-1a39ad01c0c4",
                                level: "h3",
                                text: "Studio",
                              },
                            },
                            {
                              type: "ContactDetails",
                              props: {
                                id: "ContactDetails-250fe6a8-9d7b-49ed-b723-05250f6bc3e8",
                              },
                            },
                          ],
                          _style: {
                            borderWidth: 1,
                            borderColorToken: "foreground",
                            gap: 16,
                            paddingTop: "1.75rem",
                            paddingRight: "1.75rem",
                            paddingBottom: "1.75rem",
                            paddingLeft: "1.75rem",
                          },
                        },
                      },
                    ],
                    columns: 2,
                    minHeight: "0px",
                    _style: {
                      gap: 40,
                    },
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
        marginX: "24px",
      },
    },
    {
      type: "FooterDirectoryPreset",
      props: {
        id: "ce054bae-1949-4c08-bf9b-848882eef48d",
        content: [
          {
            type: "Divider",
            props: {
              id: "95f58b2b-2c3d-4fd9-a8e8-0be3b609e0e7",
              thickness: 1,
              _style: {
                paddingLeft: "0px",
                paddingRight: "0px",
              },
            },
          },
          {
            type: "Columns",
            props: {
              id: "bb0dedc2-a88f-4591-9a97-3181b787fc40",
              content: [
                {
                  type: "Container",
                  props: {
                    id: "eb7f3de2-e7d2-4b78-aef0-e4bdfbc10a20",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "e90a4e51-c9d4-4953-972b-2d7b0fa059fe",
                          level: "h3",
                          text: "Lumen Studio",
                        },
                      },
                      {
                        type: "Text",
                        props: {
                          id: "1e1c1db8-25c4-4a86-90e0-62798ddeccb3",
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
                    id: "366b073b-abe4-49dd-a961-7b280715962e",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "84611101-f402-48b0-ae12-9abdee0bd383",
                          level: "h4",
                          text: "Explore",
                        },
                      },
                      {
                        type: "Button",
                        props: {
                          id: "7c554af1-812d-4c9c-8757-2749ac75bdf7",
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
                          id: "3ebef027-6a2d-4959-a723-d69d0a7c8e9f",
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
                          id: "40a081b6-7b27-4a0f-9878-01281f708e90",
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
                    id: "76170696-774a-41e8-aebb-bef62a809354",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "e79a4f38-1593-4232-9be4-e962a1c6db7e",
                          level: "h4",
                          text: "Studio",
                        },
                      },
                      {
                        type: "ContactDetails",
                        props: {
                          id: "ae9632f0-ef5f-4372-888c-504d4582fd68",
                          tiktok: "",
                          _style: {
                            contactIconAlign: "left",
                          },
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
            },
          },
          {
            type: "Divider",
            props: {
              id: "107152d5-d0eb-4d6a-b16a-4d52404529bd",
              thickness: 1,
              _style: {
                paddingLeft: "0px",
                paddingRight: "0px",
              },
            },
          },
          {
            type: "Text",
            props: {
              id: "40f90c60-d561-4e3a-baf1-c2ccbad760ff",
              text: "© 2026 Lumen Studio",
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
      navigationBlock("Navigation-editorial-gal-0", {}, ctx.workspace.name),
    {
      type: "PageBody",
      props: {
        id: "page-body",
        content: [
          {
            type: "GalleryLandingSplitPreset",
            props: {
              id: "GalleryLandingSplitPreset-4603a5a4-3a57-4995-aac2-eeffd7aff23b",
              content: [
                {
                  type: "Container",
                  props: {
                    id: "Container-fd5141ac-07ed-4e08-98e5-65b2aa27b03b",
                    content: [
                      {
                        type: "Container",
                        props: {
                          id: "Container-79e7276d-d572-49be-87cf-cdfaab0e8165",
                          content: [
                            {
                              type: "Heading",
                              props: {
                                id: "Heading-9764553a-2764-4e5f-b24f-4d0fe06e0b4a",
                                level: "h2",
                                text: "Our gallery",
                              },
                            },
                            {
                              type: "Text",
                              props: {
                                id: "Text-439f15a8-be76-4e4a-9184-61ff54e1cb88",
                                text: "A curated look at our work.",
                              },
                            },
                            {
                              type: "Divider",
                              props: {
                                id: "Divider-00167a45-59e5-4005-a324-8c6056e056f1",
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
                          },
                        },
                      },
                      {
                        type: "Video",
                        props: {
                          id: "Video-30aff049-8b97-4289-bcc8-8575b0986c98",
                          videoUrl: "",
                          aspectRatio: "16 / 9",
                          size: "sm",
                        },
                      },
                    ],
                    overallWidth: "page-fit",
                    _style: {
                      flexDirection: "row",
                      gap: 0,
                      paddingTop: "0px",
                      paddingRight: "0px",
                      paddingBottom: "0px",
                      paddingLeft: "0px",
                      marginBottom: "0px",
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
            type: "FeaturedWorkIndexPreset",
            props: {
              id: "FeaturedWorkIndexPreset-0d9d9c82-e36d-4524-b6e8-8a121083c4f7",
              content: [
                {
                  type: "Container",
                  props: {
                    id: "Container-ca7f339f-17cf-4515-9d30-c7a241208310",
                    content: [
                      {
                        type: "Container",
                        props: {
                          id: "Container-01313155-3fbe-4309-a0c4-bab66e1e2a00",
                          content: [
                            {
                              type: "Heading",
                              props: {
                                id: "Heading-8519bf48-c406-4a1a-bac0-f1eaca22e262",
                                level: "h2",
                                text: "Featured work",
                              },
                            },
                            {
                              type: "Text",
                              props: {
                                id: "Text-350cf397-5a52-44d7-a730-c95a62074c95",
                                text: "Four collections",
                              },
                            },
                          ],
                          _style: {
                            flexDirection: "row",
                            contentVerticalDistribution: "between",
                            gap: 16,
                          },
                        },
                      },
                      {
                        type: "Columns",
                        props: {
                          id: "Columns-12f310d4-8d4b-4efd-afa5-9e1893408b2e",
                          content: [
                            {
                              type: "CollectionCard",
                              props: {
                                id: "CollectionCard-534473bb-4f6e-4158-a109-256c1b2bcceb",
                                aspectRatio: "1 / 1",
                                showCaption: true,
                              },
                            },
                            {
                              type: "CollectionCard",
                              props: {
                                id: "CollectionCard-7efbaa27-73ec-4e3e-81fd-4c4f08a4ec5c",
                                aspectRatio: "1 / 1",
                                showCaption: true,
                              },
                            },
                            {
                              type: "CollectionCard",
                              props: {
                                id: "CollectionCard-74ae2614-09f0-4115-a7d2-82a838244303",
                                aspectRatio: "1 / 1",
                                showCaption: true,
                              },
                            },
                            {
                              type: "CollectionCard",
                              props: {
                                id: "CollectionCard-5ac3993d-1d3c-4214-89ab-27d03490d782",
                                aspectRatio: "1 / 1",
                                showCaption: true,
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
                          id: "Container-ca7f339f-17cf-4515-9d30-c7a241208310--anchor",
                          height: 0,
                        },
                      },
                    ],
                    overallWidth: "page-fit",
                    _style: {
                      gap: 24,
                      paddingTop: "0px",
                      paddingRight: "0px",
                      paddingBottom: "0px",
                      paddingLeft: "0px",
                      marginBottom: "0px",
                    },
                  },
                },
              ],
              backgroundImages: [],
              minHeight: "auto",
              _style: {
                bgColorToken: "primary",
                textColorToken: "foreground",
                gap: 24,
                paddingTop: "3rem",
                paddingBottom: "3rem",
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
            type: "CtaImagePreset",
            props: {
              id: "CtaImagePreset-afe2d241-ee33-4be8-b416-b7aeb38793b0",
              content: [
                {
                  type: "Container",
                  props: {
                    id: "Container-8f111ad9-d91d-4c0e-a5aa-f648f03dabd4",
                    content: [
                      {
                        type: "Columns",
                        props: {
                          id: "Columns-47689893-cf01-475a-be5d-2b3d31c05ee1",
                          content: [
                            {
                              type: "Image",
                              props: {
                                id: "Image-26b6f78b-9bf4-4f88-8b06-2115052f9213",
                                alt: "Studio portrait",
                              },
                            },
                            {
                              type: "Container",
                              props: {
                                id: "Container-957a772a-b3e2-4296-8f6e-ab088322cc4b",
                                content: [
                                  {
                                    type: "Heading",
                                    props: {
                                      id: "Heading-9cf751d3-2398-4d98-a134-1390c52d9898",
                                      level: "h2",
                                      text: "Ready to book your session?",
                                    },
                                  },
                                  {
                                    type: "Text",
                                    props: {
                                      id: "Text-845d59d0-7ee2-4ab8-9ef2-104ea238518f",
                                      text: "Let's create something beautiful together.",
                                    },
                                  },
                                  {
                                    type: "Button",
                                    props: {
                                      id: "Button-f7cc8d90-b53a-4b29-a01b-3447b3005288",
                                      label: "Get in Touch",
                                      action: "open-contact",
                                      align: "left",
                                      size: "sm",
                                      _style: {
                                        buttonStyle: "outline",
                                        buttonColorToken: "foreground",
                                      },
                                    },
                                  },
                                ],
                                _style: {
                                  bgColorToken: "primary",
                                  textColorToken: "foreground",
                                  gap: 16,
                                  paddingTop: "2rem",
                                  paddingRight: "2rem",
                                  paddingBottom: "2rem",
                                  paddingLeft: "2rem",
                                  contentVerticalDistribution: "center",
                                  contentHorizontalAlign: "end",
                                },
                              },
                            },
                          ],
                          columns: 2,
                          minHeight: "0px",
                          _style: {
                            gap: 0,
                          },
                          overallWidth: "full",
                        },
                      },
                      {
                        type: "ContainerAnchor",
                        props: {
                          id: "Container-8f111ad9-d91d-4c0e-a5aa-f648f03dabd4--anchor",
                          height: 0,
                        },
                      },
                    ],
                    overallWidth: "page-fit",
                    _style: {
                      gap: 0,
                      paddingTop: "0px",
                      paddingRight: "0px",
                      paddingBottom: "0px",
                      paddingLeft: "0px",
                      marginBottom: "0px",
                    },
                  },
                },
              ],
              backgroundImages: [],
              minHeight: "auto",
              _style: {
                bgColorToken: "background",
                gap: 0,
              },
              overallWidth: "full",
              bgAnimation: "crossfade",
              bgSpeed: "medium",
              overlayOpacity: 0,
              alignX: "left",
              alignY: "top",
            },
          },
        ],
        marginX: "1.5rem",
      },
    },
    {
      type: "FooterDirectoryPreset",
      props: {
        id: "FooterDirectoryPreset-8862318a-4264-47c0-955b-30fc787ef2f2",
        content: [
          {
            type: "Divider",
            props: {
              id: "6f8eacc0-ef82-4ee5-9a0c-c4b5db622ff4",
              thickness: 1,
              _style: {
                paddingLeft: "0px",
                paddingRight: "0px",
              },
            },
          },
          {
            type: "Columns",
            props: {
              id: "dd5e43dc-815d-4852-be85-8b83f76d6b3e",
              content: [
                {
                  type: "Container",
                  props: {
                    id: "27f88d00-e184-4622-af48-17ccd564b4c6",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "1f85ee95-fe33-4c98-a57f-da1d45ad340e",
                          level: "h3",
                          text: "Lumen Studio",
                        },
                      },
                      {
                        type: "Text",
                        props: {
                          id: "04ed6365-aad7-458e-9ae9-d11919c7f43f",
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
                    id: "aff32b9c-cdb4-4139-991c-d1f976ed8db6",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "f56c7237-b433-4ee5-94ac-12585b96d32b",
                          level: "h4",
                          text: "Explore",
                        },
                      },
                      {
                        type: "Button",
                        props: {
                          id: "15ea1f8c-da3a-490a-bcd0-de97c18bfbeb",
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
                          id: "9ed12ff7-00e4-4ea5-847d-95bf19ca72af",
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
                          id: "24b94458-ce8d-4805-ba7e-c7db525530c7",
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
                    id: "3ac503a2-87d6-45e7-a791-e6b8a323c1dd",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "94c3486a-a433-4599-9a7a-167f423b9673",
                          level: "h4",
                          text: "Studio",
                        },
                      },
                      {
                        type: "ContactDetails",
                        props: {
                          id: "7ac5b5b7-a329-41ac-9881-b172be2e2368",
                          tiktok: "",
                          _style: {
                            contactIconAlign: "left",
                          },
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
            },
          },
          {
            type: "Divider",
            props: {
              id: "4dd8a274-58c5-46e7-a22e-24cde5df067c",
              thickness: 1,
              _style: {
                paddingLeft: "0px",
                paddingRight: "0px",
              },
            },
          },
          {
            type: "Text",
            props: {
              id: "7f7a85f6-883e-41ed-bd86-177197ca4182",
              text: "© 2026 Lumen Studio",
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
