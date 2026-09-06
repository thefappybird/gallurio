import { THEME_PRESET_DEFINITIONS } from "@/lib/page-builder/brandKitPicker/themePresetDefinitions";
import type { PortfolioTemplate } from "./types";
import { zone, navigationBlock } from "./_blocks";

/**
 * Minimal — Clean serif palette, image-first hero, about and contact side by side.
 * Ported 1:1 from the "Minimal Template" reference draft.
 */
export const minimalTemplate: PortfolioTemplate = {
  id: "minimal",
  label: "Minimal",
  businessType: "photographer",
  description: "Clean serif palette, image-first hero, about and contact side by side.",
  previewImage: "/template-previews/minimal.svg",
  defaultBrandKit: { ...THEME_PRESET_DEFINITIONS.minimal.brandKit },
  defaultContact: {
    buttonStyle: "soft",
    buttonColor: "foreground",
    errorMessageColor: "#e7000b",
    buttonRadius: "subtle",
    addSessionButtonRadius: "subtle",
    backgroundColor: "background",
    popupRadius: "sharp",
    activeTabColor: "foreground",
    tabUnderlineColor: "accent",
  },
  defaultCollectionsPopup: {
    backgroundColor: "background",
    radius: "rounded",
    popupLayout: "split-index",
    popupColumns: 2,
    imageModalLayout: "sidebar",
    closeButtonRadius: "rounded",
    closeButtonBorderWidth: 0,
  },
  seedData: (ctx) => ({
    home: zone([
      navigationBlock("Navigation-minimal-home-0", {
      _style: {
        bold: false,
        italic: false,
        underline: false,
      },
      fontSize: "",
      activeLinkHighlight: false,
      contactButtonTextColor: "foreground",
      backgroundColor: "secondary",
    }, ctx.workspace.name),
    {
      type: "PageBody",
      props: {
        id: "page-body",
        content: [
          {
            type: "HeroSplitPreset",
            props: {
              id: "HeroSplitPreset-5354bd14-308f-4165-8beb-57247ee76973",
              content: [
                {
                  type: "Columns",
                  props: {
                    id: "Columns-f0ae75a4-f7ff-4076-9f28-3230a29f900a",
                    content: [
                      {
                        type: "Container",
                        props: {
                          id: "Container-fff8d56f-a6fe-4843-be80-0fb32d1e3508",
                          content: [
                            {
                              type: "Heading",
                              props: {
                                id: "Heading-a86e7987-8ca3-439c-9cd9-95e623817a3a",
                                level: "h1",
                                text: "Portraits, on location, in one sitting.",
                              },
                            },
                            {
                              type: "Text",
                              props: {
                                id: "Text-60d412d1-6f57-4cc5-820a-555c28e8a782",
                                text: "Fine art photography for weddings, portraits, and events across Metro Manila.",
                              },
                            },
                            {
                              type: "Container",
                              props: {
                                id: "Container-ef7af0a1-6e2f-4290-b6b2-f1336fc0dc12",
                                content: [
                                  {
                                    type: "Button",
                                    props: {
                                      id: "Button-a7236bc1-36f0-4aa3-89d7-e9d04c4ebc92",
                                      label: "View Gallery",
                                      action: "go-to-gallery",
                                      align: "left",
                                      size: "md",
                                      _style: {
                                        selfAlign: "left",
                                        buttonStyle: "solid",
                                        buttonColorToken: "foreground",
                                        textColorToken: "background",
                                      },
                                    },
                                  },
                                  {
                                    type: "Button",
                                    props: {
                                      id: "Button-bf87364a-13c0-478e-a69d-837cf1675e02",
                                      label: "Inquire",
                                      action: "open-contact",
                                      align: "left",
                                      _style: {
                                        selfAlign: "right",
                                      },
                                      size: "md",
                                    },
                                  },
                                ],
                                backgroundImages: [],
                                bgAnimation: "crossfade",
                                bgSpeed: "medium",
                                overlayOpacity: 0,
                                minHeight: "custom",
                                alignX: "left",
                                alignY: "top",
                                _style: {
                                  flexDirection: "row",
                                  paddingLeft: "0px",
                                  paddingRight: "0px",
                                  paddingTop: "0px",
                                  paddingBottom: "0px",
                                  gap: 3,
                                  contentHorizontalAlign: "start",
                                  contentVerticalDistribution: "start",
                                  width: "fit-content",
                                },
                                minHeightValue: "0px",
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
                        type: "Container",
                        props: {
                          id: "Container-241f89c1-a497-4deb-bdd4-301dfc064eed",
                          content: [
                            {
                              type: "Video",
                              props: {
                                id: "Video-86122b7b-5fd9-42ed-aba3-366487958ddf",
                                videoUrl: "",
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
                            contentHorizontalAlign: "start",
                            contentVerticalDistribution: "center",
                            paddingLeft: "0px",
                            paddingRight: "0px",
                          },
                        },
                      },
                    ],
                    columns: 2,
                    minHeight: "0px",
                    _style: {
                      paddingLeft: "0px",
                      paddingRight: "0px",
                    },
                  },
                },
              ],
              backgroundImages: [],
              minHeight: "medium",
              alignY: "center",
              _style: {
                bgColorToken: "background",
                gap: 0,
              },
              bgAnimation: "crossfade",
              bgSpeed: "medium",
              overlayOpacity: 0,
              alignX: "left",
            },
          },
          {
            type: "FeaturedWorkIndexPreset",
            props: {
              id: "FeaturedWorkIndexPreset-a4781bbc-c070-49c6-b516-994cba63ba35",
              content: [
                {
                  type: "Container",
                  props: {
                    id: "Container-cf346324-8d2c-4d97-b893-65144ed09447",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "Heading-e266bba5-782d-4285-9655-130f94517a01",
                          level: "h2",
                          text: "Featured work",
                        },
                      },
                      {
                        type: "Text",
                        props: {
                          id: "Text-76eee838-eba0-48b5-9ab7-c3e01572d41b",
                          text: "Four collections",
                        },
                      },
                    ],
                    _style: {
                      flexDirection: "row",
                      contentVerticalDistribution: "between",
                      gap: 16,
                    },
                    backgroundImages: [],
                  },
                },
                {
                  type: "Container",
                  props: {
                    id: "Container-1e889fe1-33f5-4d8c-9aef-1c0ed7200f6e",
                    content: [
                      {
                        type: "Columns",
                        props: {
                          id: "Columns-a93dcaab-c92b-40c0-95af-d0f653a7eda9",
                          content: [
                            {
                              type: "CollectionCard",
                              props: {
                                id: "CollectionCard-f3e9611d-cc86-439a-99d9-42c73bee7f1e",
                                aspectRatio: "1 / 1",
                                showCaption: true,
                              },
                            },
                            {
                              type: "CollectionCard",
                              props: {
                                id: "CollectionCard-89f6866b-afa6-4394-a9f3-6402509e383f",
                                aspectRatio: "1 / 1",
                                showCaption: true,
                              },
                            },
                            {
                              type: "CollectionCard",
                              props: {
                                id: "CollectionCard-54198572-9f25-4565-8e48-639bc7750ad1",
                                aspectRatio: "1 / 1",
                                showCaption: true,
                              },
                            },
                            {
                              type: "CollectionCard",
                              props: {
                                id: "CollectionCard-e6342554-5119-4bf4-8aeb-bd12730188e6",
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
                          id: "Container-1e889fe1-33f5-4d8c-9aef-1c0ed7200f6e--anchor",
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
                gap: 24,
                paddingTop: "3rem",
                paddingBottom: "3rem",
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
            type: "ServicesMenuPreset",
            props: {
              id: "ServicesMenuPreset-88ed46e5-e232-4c9a-9ebe-592c205315a3",
              content: [
                {
                  type: "Heading",
                  props: {
                    id: "Heading-61e9c681-9b49-458e-8861-a4e5ee371b93",
                    level: "h2",
                    text: "Services",
                  },
                },
                {
                  type: "Divider",
                  props: {
                    id: "Divider-41d64bd5-5752-4f5a-a516-96e55dedc95b",
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
                    id: "Columns-2dd33aca-0d18-4a0d-b402-28a9832dd672",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "Heading-18aa38a3-0103-4a8e-8550-9457304f891b",
                          level: "h3",
                          text: "Wedding Photography",
                        },
                      },
                      {
                        type: "Text",
                        props: {
                          id: "Text-fda98682-9bd2-4bf1-a12c-8c088c759d50",
                          text: "Full-day coverage, two shooters, and a curated gallery within four weeks.",
                          _style: {
                            colSpan: 1,
                          },
                        },
                      },
                      {
                        type: "Text",
                        props: {
                          id: "Text-2b6b6a80-cf0f-4b9b-8786-453292fedd44",
                          text: "From ₱30,000",
                          _style: {
                            textColorToken: "foreground",
                            bold: true,
                            align: "right",
                          },
                        },
                      },
                    ],
                    columns: 3,
                    minHeight: "0px",
                    _style: {
                      gap: 24,
                      paddingTop: "1.25rem",
                      paddingBottom: "1.25rem",
                    },
                  },
                },
                {
                  type: "Divider",
                  props: {
                    id: "Divider-9f8b1c8e-a0a5-4758-b76e-8d29b0794b10",
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
                    id: "Columns-152f38b3-ba9d-4b02-ae03-1dae0eb9f503",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "Heading-d8db1fe6-1388-48e9-b8e2-68e0fbf2bd16",
                          level: "h3",
                          text: "Portrait Sessions",
                        },
                      },
                      {
                        type: "Text",
                        props: {
                          id: "Text-813eb270-8a69-4ab8-a302-b6490d040d20",
                          text: "Ninety minutes in natural light, at the studio or somewhere that matters to you.",
                          _style: {
                            colSpan: 1,
                          },
                        },
                      },
                      {
                        type: "Text",
                        props: {
                          id: "Text-7fafbdcf-aad4-470b-b6da-0d07064701b7",
                          text: "From ₱8,000",
                          _style: {
                            textColorToken: "foreground",
                            bold: true,
                            align: "right",
                          },
                        },
                      },
                    ],
                    columns: 3,
                    minHeight: "0px",
                    _style: {
                      gap: 24,
                      paddingTop: "1.25rem",
                      paddingBottom: "1.25rem",
                    },
                  },
                },
                {
                  type: "Divider",
                  props: {
                    id: "Divider-1874b16d-21b8-4f39-9b41-e67b0b87e6bb",
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
                    id: "Columns-b7f501cb-a12d-408b-9e6d-83779ee2e28c",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "Heading-9c2c941d-01eb-439d-8d2b-b8df4ccc8a6e",
                          level: "h3",
                          text: "Event Coverage",
                        },
                      },
                      {
                        type: "Text",
                        props: {
                          id: "Text-39a4fbdc-d393-48f8-81e8-1e68aec47b3b",
                          text: "Corporate events, debuts, and intimate gatherings, half or full day.",
                          _style: {
                            colSpan: 1,
                          },
                        },
                      },
                      {
                        type: "Text",
                        props: {
                          id: "Text-e5f5547b-2a9a-462c-a322-6623089c6407",
                          text: "From ₱15,000",
                          _style: {
                            textColorToken: "foreground",
                            bold: true,
                            align: "right",
                          },
                        },
                      },
                    ],
                    columns: 3,
                    minHeight: "0px",
                    _style: {
                      gap: 24,
                      paddingTop: "1.25rem",
                      paddingBottom: "1.25rem",
                    },
                  },
                },
                {
                  type: "Divider",
                  props: {
                    id: "Divider-e12db59b-1dbe-45ca-8b66-d6fd9aaade85",
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
                    id: "Columns-8dbf8527-2b78-4d2f-834b-b1a8d8e0b9cf",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "Heading-e994929c-f9d1-4fa4-91dc-c1011e92c1c3",
                          level: "h3",
                          text: "Editorial and Brand",
                        },
                      },
                      {
                        type: "Text",
                        props: {
                          id: "Text-0f835d58-5c28-462c-bd89-f0524609f9aa",
                          text: "Campaign and lookbook work for studios, labels, and venues.",
                          _style: {
                            colSpan: 1,
                          },
                        },
                      },
                      {
                        type: "Text",
                        props: {
                          id: "Text-97c03f01-2fde-419c-a017-60aceba0312b",
                          text: "Price on request",
                          _style: {
                            textColorToken: "foreground",
                            bold: true,
                            align: "right",
                          },
                        },
                      },
                    ],
                    columns: 3,
                    minHeight: "0px",
                    _style: {
                      gap: 24,
                      paddingTop: "1.25rem",
                      paddingBottom: "1.25rem",
                    },
                  },
                },
                {
                  type: "Divider",
                  props: {
                    id: "Divider-41436ab2-57db-42af-9291-f3e6504d5e01",
                    thickness: 1,
                    _style: {
                      paddingLeft: "0px",
                      paddingRight: "0px",
                    },
                  },
                },
              ],
              backgroundImages: [],
              minHeight: "auto",
              _style: {
                bgColorToken: "background",
                textColorToken: "foreground",
                gap: 0,
              },
              bgAnimation: "crossfade",
              bgSpeed: "medium",
              overlayOpacity: 0,
              alignX: "left",
              alignY: "top",
            },
          },
          {
            type: "ContactBarPreset",
            props: {
              id: "ContactBarPreset-86e610e6-71f1-451d-a9cd-85af3656ea60",
              content: [
                {
                  type: "Container",
                  props: {
                    id: "Container-eda68a70-566f-40b2-8d6b-b435329be566",
                    content: [
                      {
                        type: "Container",
                        props: {
                          id: "Container-744f2c68-2322-48bf-a662-966cfe3bb409",
                          content: [
                            {
                              type: "Heading",
                              props: {
                                id: "Heading-616948d0-4fe4-4a4f-af76-c759497b0517",
                                level: "h3",
                                text: "Start an Inquiry",
                              },
                            },
                            {
                              type: "Text",
                              props: {
                                id: "Text-ac6e24da-39e6-42cc-a0e1-a2fa14c9015f",
                                text: "Available for 2026 dates.",
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
                            flexDirection: "column",
                            width: "fit-content",
                            contentHorizontalAlign: "start",
                            contentVerticalDistribution: "start",
                          },
                          overallWidth: "page-fit",
                        },
                      },
                      {
                        type: "Button",
                        props: {
                          id: "Button-20ef2974-666c-4dde-9a18-861cb4140b61",
                          label: "Inquire",
                          action: "open-contact",
                          align: "center",
                          size: "lg",
                          _style: {
                            selfAlign: "right",
                            buttonStyle: "solid",
                            radius: 0,
                            textColorToken: "background",
                            buttonColorToken: "foreground",
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
                      flexDirection: "row",
                      contentVerticalDistribution: "between",
                      contentHorizontalAlign: "center",
                    },
                  },
                },
              ],
              backgroundImages: [],
              minHeight: "auto",
              _style: {
                bgColorToken: "secondary",
                textColorToken: "foreground",
                gap: 0,
                paddingTop: "2.25rem",
                paddingBottom: "2.25rem",
                contentVerticalDistribution: "between",
                contentHorizontalAlign: "center",
                flexDirection: "row",
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
      },
    },
    {
      type: "FooterDirectoryPreset",
      props: {
        id: "FooterDirectoryPreset-9c79411e-111a-4b62-a18e-7dfcb9204315",
        content: [
          {
            type: "Divider",
            props: {
              id: "8d3ad031-d851-46b2-a66d-105a87eb0b40",
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
              id: "e10d56d2-b5d2-4d73-9992-110e45043564",
              content: [
                {
                  type: "Container",
                  props: {
                    id: "3abff9f9-3947-4867-914d-16d32c35369b",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "ea0ddffd-a3e3-4495-b109-4cfe330d1f0c",
                          level: "h3",
                          text: "Lumen Studio",
                        },
                      },
                      {
                        type: "Text",
                        props: {
                          id: "07f6f968-042d-4108-9277-52e2506e951e",
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
                    id: "ce755ce1-6f42-4187-8a6c-b11a1c4d3aa7",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "c21e6fcf-c33f-441f-a65b-6ab112b8606d",
                          level: "h4",
                          text: "Studio",
                          _style: {
                            marginTop: "0px",
                            marginBottom: "0px",
                            marginRight: "0px",
                            marginLeft: "0px",
                          },
                        },
                      },
                      {
                        type: "ContactDetails",
                        props: {
                          id: "4008219d-3f8b-4f1f-9174-4b562976f7e7",
                        },
                      },
                    ],
                    _style: {
                      gap: 12,
                    },
                    backgroundImages: [],
                  },
                },
                {
                  type: "Container",
                  props: {
                    id: "3418f79f-24a3-4bd7-84fc-e4043a804fed",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "9442b13c-2b9b-44bf-a309-adc00efd0070",
                          level: "h4",
                          text: "Explore",
                          _style: {
                            marginTop: "0px",
                            marginBottom: "0px",
                            marginRight: "0px",
                            marginLeft: "0px",
                          },
                        },
                      },
                      {
                        type: "Button",
                        props: {
                          id: "e32078dd-43f7-467e-9018-45d2b51575f8",
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
                          id: "51a117dd-6980-41c4-8b7c-3bc8d0a1da0e",
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
                          id: "f096b91f-43fc-473a-9d1a-a6fafe982ec3",
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
              id: "4ce4fe95-3119-477e-8a58-5565d7baff1d",
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
              id: "d7ff6199-61e1-4ac1-ba1a-78f659948a14",
              content: [
                {
                  type: "Text",
                  props: {
                    id: "51cd1ee0-0932-4751-83ef-db092ad2512c",
                    text: "© 2026 Lumen Studio",
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
              _style: {},
              overallWidth: "page-fit",
            },
          },
        ],
        _chrome: "footer",
        backgroundImages: [],
        minHeight: "auto",
        _style: {
          bgColorToken: "background",
          gap: 0,
          paddingTop: "0px",
          paddingBottom: "0px",
          paddingLeft: "0px",
          paddingRight: "0px",
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
      navigationBlock("Navigation-minimal-gal-0", {
      _style: {
        bold: false,
        italic: false,
        underline: false,
      },
      fontSize: "",
      activeLinkHighlight: false,
      contactButtonTextColor: "foreground",
      backgroundColor: "secondary",
    }, ctx.workspace.name),
    {
      type: "PageBody",
      props: {
        id: "page-body",
        content: [
          {
            type: "VideoSplitPreset",
            props: {
              id: "VideoSplitPreset-238d4e26-c61e-40ae-80fd-fe84d571e235",
              content: [
                {
                  type: "Container",
                  props: {
                    id: "Container-8b2b4cf3-5b88-4bf1-a9bf-13e8a7437fe3",
                    content: [
                      {
                        type: "Video",
                        props: {
                          id: "Video-b425b5db-6628-48b0-afc5-77ec9343b564",
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
                          id: "Container-c80bdece-b1ca-41f9-8d5b-98e29e1e36a9",
                          content: [
                            {
                              type: "Heading",
                              props: {
                                id: "Heading-34666695-76b0-4ddf-94ba-08cfadab8125",
                                level: "h2",
                                text: "Our Gallery",
                              },
                            },
                            {
                              type: "Text",
                              props: {
                                id: "Text-47a98d0d-472e-4c21-bee2-3ca5c0267695",
                                text: "Take a tour of our best work yet.",
                              },
                            },
                            {
                              type: "Button",
                              props: {
                                id: "Button-60af319c-86c6-461e-b268-f644e10f0a82",
                                label: "Get in Touch",
                                action: "open-contact",
                                align: "left",
                                size: "sm",
                                _style: {
                                  buttonStyle: "outline",
                                  buttonColorToken: "foreground",
                                  textColorToken: "foreground",
                                },
                              },
                            },
                          ],
                          backgroundImages: [],
                          _style: {
                            bgColorToken: "accent",
                            textColorToken: "foreground",
                            gap: 16,
                            contentVerticalDistribution: "center",
                            flexDirection: "column",
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
                      flexDirection: "row",
                    },
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
              overallWidth: "full",
            },
          },
          {
            type: "GalleryMasonryWallPreset",
            props: {
              id: "GalleryMasonryWallPreset-f17d4fab-43b0-45be-bd60-a3d06f58522b",
              content: [
                {
                  type: "Container",
                  props: {
                    id: "Container-c7ba1077-dda2-4a67-acfc-eddcd3156b88",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "Heading-e0039914-8d7d-4c8c-b38b-cfcc802dd560",
                          level: "h2",
                          text: "Story gallery",
                          _style: {
                            paddingLeft: "1.5rem",
                            paddingRight: "1.5rem",
                          },
                        },
                      },
                      {
                        type: "GalleryMasonry",
                        props: {
                          id: "GalleryMasonry-d3612b6a-a305-4c82-9ccd-8b77cd00322c",
                          column4: [
                            {
                              type: "Image",
                              props: {
                                id: "Image-c7ed4197-b187-45b7-9bd9-729ea71c4bd5",
                                alt: "",
                                _style: {
                                  height: "28rem",
                                },
                              },
                            },
                            {
                              type: "Image",
                              props: {
                                id: "Image-5911163e-297c-46bf-a978-0ad1accd62bb",
                                alt: "",
                                _style: {
                                  height: "19rem",
                                },
                              },
                            },
                            {
                              type: "Image",
                              props: {
                                id: "Image-8fa7b79c-8f0e-4176-a380-dedfe0098120",
                                alt: "",
                                _style: {
                                  height: "19rem",
                                },
                              },
                            },
                            {
                              type: "MasonryClone",
                              props: {
                                id: "GalleryMasonry-d3612b6a-a305-4c82-9ccd-8b77cd00322c--clone-4",
                                masonryId: "GalleryMasonry-d3612b6a-a305-4c82-9ccd-8b77cd00322c",
                                column: 4,
                                gap: 4,
                                sourceId: "Image-c7ed4197-b187-45b7-9bd9-729ea71c4bd5",
                                imageProps: {
                                  alt: "",
                                  _style: {
                                    height: "28rem",
                                  },
                                },
                                layoutSignature: "[[[\"Image\",\"Image-e9736d4a-6b51-4396-8eec-0dad040b40d4\",{\"height\":\"17rem\"}],[\"Image\",\"Image-75a68f72-1303-4333-a7f3-d3f8b21cc94e\",{\"height\":\"22rem\"}],[\"Image\",\"Image-22963f6d-0f7a-4e98-8015-d1c47ed24786\",{\"height\":\"22rem\"}]],[[\"Image\",\"Image-6668eea8-2655-458a-b9b0-2a7b6ab32b54\",{\"height\":\"25rem\"}],[\"Image\",\"Image-416f17e9-4d68-4605-ac0a-140507d70b7b\",{\"height\":\"16rem\"}],[\"Image\",\"Image-c37e1251-1e82-4333-90bc-8980d58ab9df\",{\"height\":\"16rem\"}]],[[\"Image\",\"Image-dfd8a04a-38ce-4981-a94c-cce4d67d90c5\",{\"height\":\"20rem\"}],[\"Image\",\"Image-613e884b-e9d3-47a4-8034-0935946c581c\",{\"height\":\"24rem\"}],[\"Image\",\"Image-6175a77b-d1da-479d-a34d-2f7d0bcad121\",{\"height\":\"24rem\"}]],[[\"Image\",\"Image-c7ed4197-b187-45b7-9bd9-729ea71c4bd5\",{\"height\":\"28rem\"}],[\"Image\",\"Image-5911163e-297c-46bf-a978-0ad1accd62bb\",{\"height\":\"19rem\"}],[\"Image\",\"Image-8fa7b79c-8f0e-4176-a380-dedfe0098120\",{\"height\":\"19rem\"}]]]",
                              },
                            },
                          ],
                          column3: [
                            {
                              type: "Image",
                              props: {
                                id: "Image-dfd8a04a-38ce-4981-a94c-cce4d67d90c5",
                                alt: "",
                                _style: {
                                  height: "20rem",
                                },
                              },
                            },
                            {
                              type: "Image",
                              props: {
                                id: "Image-613e884b-e9d3-47a4-8034-0935946c581c",
                                alt: "",
                                _style: {
                                  height: "24rem",
                                },
                              },
                            },
                            {
                              type: "Image",
                              props: {
                                id: "Image-6175a77b-d1da-479d-a34d-2f7d0bcad121",
                                alt: "",
                                _style: {
                                  height: "24rem",
                                },
                              },
                            },
                            {
                              type: "MasonryClone",
                              props: {
                                id: "GalleryMasonry-d3612b6a-a305-4c82-9ccd-8b77cd00322c--clone-3",
                                masonryId: "GalleryMasonry-d3612b6a-a305-4c82-9ccd-8b77cd00322c",
                                column: 3,
                                gap: 4,
                                sourceId: "Image-dfd8a04a-38ce-4981-a94c-cce4d67d90c5",
                                imageProps: {
                                  alt: "",
                                  _style: {
                                    height: "20rem",
                                  },
                                },
                                layoutSignature: "[[[\"Image\",\"Image-e9736d4a-6b51-4396-8eec-0dad040b40d4\",{\"height\":\"17rem\"}],[\"Image\",\"Image-75a68f72-1303-4333-a7f3-d3f8b21cc94e\",{\"height\":\"22rem\"}],[\"Image\",\"Image-22963f6d-0f7a-4e98-8015-d1c47ed24786\",{\"height\":\"22rem\"}]],[[\"Image\",\"Image-6668eea8-2655-458a-b9b0-2a7b6ab32b54\",{\"height\":\"25rem\"}],[\"Image\",\"Image-416f17e9-4d68-4605-ac0a-140507d70b7b\",{\"height\":\"16rem\"}],[\"Image\",\"Image-c37e1251-1e82-4333-90bc-8980d58ab9df\",{\"height\":\"16rem\"}]],[[\"Image\",\"Image-dfd8a04a-38ce-4981-a94c-cce4d67d90c5\",{\"height\":\"20rem\"}],[\"Image\",\"Image-613e884b-e9d3-47a4-8034-0935946c581c\",{\"height\":\"24rem\"}],[\"Image\",\"Image-6175a77b-d1da-479d-a34d-2f7d0bcad121\",{\"height\":\"24rem\"}]],[[\"Image\",\"Image-c7ed4197-b187-45b7-9bd9-729ea71c4bd5\",{\"height\":\"28rem\"}],[\"Image\",\"Image-5911163e-297c-46bf-a978-0ad1accd62bb\",{\"height\":\"19rem\"}],[\"Image\",\"Image-8fa7b79c-8f0e-4176-a380-dedfe0098120\",{\"height\":\"19rem\"}]]]",
                              },
                            },
                          ],
                          column2: [
                            {
                              type: "Image",
                              props: {
                                id: "Image-6668eea8-2655-458a-b9b0-2a7b6ab32b54",
                                alt: "",
                                _style: {
                                  height: "25rem",
                                },
                              },
                            },
                            {
                              type: "Image",
                              props: {
                                id: "Image-416f17e9-4d68-4605-ac0a-140507d70b7b",
                                alt: "",
                                _style: {
                                  height: "16rem",
                                },
                              },
                            },
                            {
                              type: "Image",
                              props: {
                                id: "Image-c37e1251-1e82-4333-90bc-8980d58ab9df",
                                alt: "",
                                _style: {
                                  height: "16rem",
                                },
                              },
                            },
                            {
                              type: "MasonryClone",
                              props: {
                                id: "GalleryMasonry-d3612b6a-a305-4c82-9ccd-8b77cd00322c--clone-2",
                                masonryId: "GalleryMasonry-d3612b6a-a305-4c82-9ccd-8b77cd00322c",
                                column: 2,
                                gap: 4,
                                sourceId: "Image-6668eea8-2655-458a-b9b0-2a7b6ab32b54",
                                imageProps: {
                                  alt: "",
                                  _style: {
                                    height: "25rem",
                                  },
                                },
                                layoutSignature: "[[[\"Image\",\"Image-e9736d4a-6b51-4396-8eec-0dad040b40d4\",{\"height\":\"17rem\"}],[\"Image\",\"Image-75a68f72-1303-4333-a7f3-d3f8b21cc94e\",{\"height\":\"22rem\"}],[\"Image\",\"Image-22963f6d-0f7a-4e98-8015-d1c47ed24786\",{\"height\":\"22rem\"}]],[[\"Image\",\"Image-6668eea8-2655-458a-b9b0-2a7b6ab32b54\",{\"height\":\"25rem\"}],[\"Image\",\"Image-416f17e9-4d68-4605-ac0a-140507d70b7b\",{\"height\":\"16rem\"}],[\"Image\",\"Image-c37e1251-1e82-4333-90bc-8980d58ab9df\",{\"height\":\"16rem\"}]],[[\"Image\",\"Image-dfd8a04a-38ce-4981-a94c-cce4d67d90c5\",{\"height\":\"20rem\"}],[\"Image\",\"Image-613e884b-e9d3-47a4-8034-0935946c581c\",{\"height\":\"24rem\"}],[\"Image\",\"Image-6175a77b-d1da-479d-a34d-2f7d0bcad121\",{\"height\":\"24rem\"}]],[[\"Image\",\"Image-c7ed4197-b187-45b7-9bd9-729ea71c4bd5\",{\"height\":\"28rem\"}],[\"Image\",\"Image-5911163e-297c-46bf-a978-0ad1accd62bb\",{\"height\":\"19rem\"}],[\"Image\",\"Image-8fa7b79c-8f0e-4176-a380-dedfe0098120\",{\"height\":\"19rem\"}]]]",
                              },
                            },
                          ],
                          column1: [
                            {
                              type: "Image",
                              props: {
                                id: "Image-e9736d4a-6b51-4396-8eec-0dad040b40d4",
                                alt: "",
                                _style: {
                                  height: "17rem",
                                },
                              },
                            },
                            {
                              type: "Image",
                              props: {
                                id: "Image-75a68f72-1303-4333-a7f3-d3f8b21cc94e",
                                alt: "",
                                _style: {
                                  height: "22rem",
                                },
                              },
                            },
                            {
                              type: "Image",
                              props: {
                                id: "Image-22963f6d-0f7a-4e98-8015-d1c47ed24786",
                                alt: "",
                                _style: {
                                  height: "22rem",
                                },
                              },
                            },
                            {
                              type: "MasonryClone",
                              props: {
                                id: "GalleryMasonry-d3612b6a-a305-4c82-9ccd-8b77cd00322c--clone-1",
                                masonryId: "GalleryMasonry-d3612b6a-a305-4c82-9ccd-8b77cd00322c",
                                column: 1,
                                gap: 4,
                                sourceId: "Image-e9736d4a-6b51-4396-8eec-0dad040b40d4",
                                imageProps: {
                                  alt: "",
                                  _style: {
                                    height: "17rem",
                                  },
                                },
                                layoutSignature: "[[[\"Image\",\"Image-e9736d4a-6b51-4396-8eec-0dad040b40d4\",{\"height\":\"17rem\"}],[\"Image\",\"Image-75a68f72-1303-4333-a7f3-d3f8b21cc94e\",{\"height\":\"22rem\"}],[\"Image\",\"Image-22963f6d-0f7a-4e98-8015-d1c47ed24786\",{\"height\":\"22rem\"}]],[[\"Image\",\"Image-6668eea8-2655-458a-b9b0-2a7b6ab32b54\",{\"height\":\"25rem\"}],[\"Image\",\"Image-416f17e9-4d68-4605-ac0a-140507d70b7b\",{\"height\":\"16rem\"}],[\"Image\",\"Image-c37e1251-1e82-4333-90bc-8980d58ab9df\",{\"height\":\"16rem\"}]],[[\"Image\",\"Image-dfd8a04a-38ce-4981-a94c-cce4d67d90c5\",{\"height\":\"20rem\"}],[\"Image\",\"Image-613e884b-e9d3-47a4-8034-0935946c581c\",{\"height\":\"24rem\"}],[\"Image\",\"Image-6175a77b-d1da-479d-a34d-2f7d0bcad121\",{\"height\":\"24rem\"}]],[[\"Image\",\"Image-c7ed4197-b187-45b7-9bd9-729ea71c4bd5\",{\"height\":\"28rem\"}],[\"Image\",\"Image-5911163e-297c-46bf-a978-0ad1accd62bb\",{\"height\":\"19rem\"}],[\"Image\",\"Image-8fa7b79c-8f0e-4176-a380-dedfe0098120\",{\"height\":\"19rem\"}]]]",
                              },
                            },
                          ],
                          content: [],
                          masonryLayout: "columns",
                          _style: {
                            galleryColumns: 4,
                            galleryGap: "tight",
                            masonryHeightPattern: "alternating",
                          },
                          masonryLoop: true,
                          images: [],
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
                  type: "Columns",
                  props: {
                    id: "Columns-5e978a50-e699-40da-9eff-29ba5f11ff2d",
                    content: [],
                    columns: 1,
                    overallWidth: "full",
                    minHeight: "0px",
                    _style: {
                      paddingLeft: "0px",
                      paddingRight: "0px",
                    },
                  },
                },
              ],
              minHeight: "auto",
              _style: {
                bgColorToken: "primary",
                textColorToken: "foreground",
                gap: 16,
                paddingLeft: "0px",
                paddingRight: "0px",
                paddingTop: "2.5rem",
                paddingBottom: "2.5rem",
              },
              backgroundImages: [],
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
      },
    },
    {
      type: "FooterDirectoryPreset",
      props: {
        id: "daed93b2-3ed4-4b2c-974d-356821582790",
        content: [
          {
            type: "Divider",
            props: {
              id: "0c2915c2-2426-4831-b270-45aeb7e11c32",
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
              id: "fbe06a4e-2617-4169-925f-b6acf2a19b7f",
              content: [
                {
                  type: "Container",
                  props: {
                    id: "14c5a2a9-a3ba-478f-b520-982b79e29c02",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "acafe5d3-d977-4f33-b685-3f0345cbe5d9",
                          level: "h3",
                          text: "Lumen Studio",
                        },
                      },
                      {
                        type: "Text",
                        props: {
                          id: "09c7cbb7-ec5f-4811-9d71-29de71c9a631",
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
                    id: "19674343-4ee3-403b-9658-3242f620d4c7",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "99826e40-fd3d-4241-8571-6dd777351dec",
                          level: "h4",
                          text: "Studio",
                          _style: {
                            marginTop: "0px",
                            marginBottom: "0px",
                            marginRight: "0px",
                            marginLeft: "0px",
                          },
                        },
                      },
                      {
                        type: "ContactDetails",
                        props: {
                          id: "f1eef5f4-78b1-48b1-9860-2d7e160e0659",
                        },
                      },
                    ],
                    _style: {
                      gap: 12,
                    },
                    backgroundImages: [],
                  },
                },
                {
                  type: "Container",
                  props: {
                    id: "5cf19848-7135-45eb-b035-2c03468d1c3c",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "a79ee10b-beae-4d2d-8947-4ddefc906c06",
                          level: "h4",
                          text: "Explore",
                          _style: {
                            marginTop: "0px",
                            marginBottom: "0px",
                            marginRight: "0px",
                            marginLeft: "0px",
                          },
                        },
                      },
                      {
                        type: "Button",
                        props: {
                          id: "4063ebde-11a7-4847-a43d-e324bb4ac376",
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
                          id: "232db013-57ad-4b64-bfc1-1f1f53966ca9",
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
                          id: "5116dfe6-7266-4cf0-ad81-80027fc6209f",
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
              id: "d8874c43-1b69-4c15-8bd2-a8a47950e57b",
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
              id: "32375245-71a7-418c-9ee4-ba3c3d78c9c4",
              content: [
                {
                  type: "Text",
                  props: {
                    id: "1b91339b-e50d-411d-a8f8-08b14834ae2d",
                    text: "© 2026 Lumen Studio",
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
              _style: {},
              overallWidth: "page-fit",
            },
          },
        ],
        _chrome: "footer",
        backgroundImages: [],
        minHeight: "auto",
        _style: {
          bgColorToken: "background",
          gap: 0,
          paddingTop: "0px",
          paddingBottom: "0px",
          paddingLeft: "0px",
          paddingRight: "0px",
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
