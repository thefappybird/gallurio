import { THEME_PRESET_DEFINITIONS } from "@/lib/page-builder/brandKitPicker/themePresetDefinitions";
import type { PortfolioTemplate } from "./types";
import { zone, navigationBlock } from "./_blocks";

/**
 * Luxury — Dark, moody palette with restrained serif type for upscale venues.
 * Ported 1:1 from the "Luxury Template" reference draft.
 */
export const luxuryTemplate: PortfolioTemplate = {
  id: "luxury",
  label: "Luxury",
  businessType: "venue",
  description: "Dark, moody palette with restrained serif type for upscale venues.",
  previewImage: "/template-previews/luxury.svg",
  defaultBrandKit: { ...THEME_PRESET_DEFINITIONS.luxury.brandKit },
  defaultContact: {
    buttonStyle: "solid",
    buttonColor: "foreground",
  },
  defaultCollectionsPopup: {
    radius: "sharp",
    popupLayout: "contact-sheet",
    imageModalLayout: "caption",
    closeButtonRadius: "rounded",
    closeButtonBorderWidth: 0,
  },
  seedData: (ctx) => ({
    home: zone([
      navigationBlock("Navigation-luxury-home-0", {
      contactButtonTextColor: "foreground",
      fontSize: "sm",
      contactButtonRadius: "subtle",
    }, ctx.workspace.name),
    {
      type: "PageBody",
      props: {
        id: "page-body",
        content: [
          {
            type: "HeroSplitPreset",
            props: {
              id: "HeroSplitPreset-8eae50a7-ce9d-461b-9592-193f4568e7ea",
              content: [
                {
                  type: "Columns",
                  props: {
                    id: "Columns-582a67af-8329-4e53-acf1-b3e406469bc2",
                    content: [
                      {
                        type: "Container",
                        props: {
                          id: "Container-ae117a99-124e-416e-b12a-50003bf9897c",
                          content: [
                            {
                              type: "Heading",
                              props: {
                                id: "Heading-90b290a2-258c-4b7a-af23-9d732811e5d0",
                                level: "h1",
                                text: "Capturing moments that last forever",
                              },
                            },
                            {
                              type: "Text",
                              props: {
                                id: "Text-b10bb086-9942-4cc4-bc82-f84c79e0c3c0",
                                text: "Fine art photography for weddings, portraits, and events across Metro Manila.",
                              },
                            },
                            {
                              type: "Container",
                              props: {
                                id: "Container-6a51d1a4-a082-494c-a806-74a49e276292",
                                content: [
                                  {
                                    type: "Button",
                                    props: {
                                      id: "Button-2aaa7f4a-0b7a-4cfb-8168-f753b0407ffb",
                                      label: "View Gallery",
                                      action: "go-to-gallery",
                                      align: "center",
                                      size: "md",
                                    },
                                  },
                                  {
                                    type: "Button",
                                    props: {
                                      id: "Button-1797306e-9a84-4a73-94c2-7738f6dbc0b2",
                                      label: "Inquire",
                                      action: "open-contact",
                                      align: "center",
                                      size: "md",
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
                                  contentHorizontalAlign: "center",
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
                          id: "Image-18c98fa0-08fb-46ca-b554-40c883024f0e",
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
            type: "AboutPortraitPreset",
            props: {
              id: "AboutPortraitPreset-6b06e08d-f540-4111-97db-a947fb0f7896",
              content: [
                {
                  type: "Columns",
                  props: {
                    id: "Columns-ae3dfa26-ca33-4428-b5cb-2b152d992c7b",
                    content: [
                      {
                        type: "Image",
                        props: {
                          id: "Image-d1f8fdea-e88d-4203-9527-4dcf6959ee36",
                          alt: "Portrait of the photographer",
                          _style: {
                            cellVerticalAlign: "center",
                            selfAlign: "center",
                          },
                        },
                      },
                      {
                        type: "Container",
                        props: {
                          id: "Container-f28c216c-542e-4f1a-8418-493e5d12c264",
                          content: [
                            {
                              type: "Heading",
                              props: {
                                id: "Heading-e050e18a-aca7-47e3-b416-96c56e874d9f",
                                level: "h2",
                                text: "About Me",
                              },
                            },
                            {
                              type: "Text",
                              props: {
                                id: "Text-198c6d88-4dc0-4f6a-8862-159cb18c1aef",
                                text: "I'm a passionate photographer based in Manila, capturing life's most meaningful moments.\n\nWith over a decade of experience, I bring artistry and technical expertise to every session.",
                              },
                            },
                          ],
                          _style: {
                            bgColorToken: "background",
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
                    columns: 2,
                    minHeight: "0px",
                    _style: {
                      gap: 40,
                    },
                  },
                },
              ],
              backgroundImages: [],
              minHeight: "auto",
              _style: {
                bgColorToken: "accent",
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
            type: "ServicesFeaturePreset",
            props: {
              id: "ServicesFeaturePreset-3a72ae0c-e1fd-4b51-9388-976ec446a4fa",
              content: [
                {
                  type: "Heading",
                  props: {
                    id: "Heading-98bfc685-61bb-4bc9-9944-506c6c2f4129",
                    level: "h2",
                    text: "Services",
                  },
                },
                {
                  type: "Columns",
                  props: {
                    id: "Columns-d205500f-9f7c-406b-b655-9f074b3d1b76",
                    content: [
                      {
                        type: "Image",
                        props: {
                          id: "Image-523b2827-93e5-4677-8bb7-9e9b623b2ba8",
                          alt: "Wedding coverage",
                        },
                      },
                      {
                        type: "Container",
                        props: {
                          id: "Container-1fcd9cc5-ee23-4d0b-a508-6b703374d5af",
                          content: [
                            {
                              type: "Heading",
                              props: {
                                id: "Heading-2e072e71-8cad-49f7-b88e-6d46503c0b7b",
                                level: "h3",
                                text: "Wedding Photography",
                              },
                            },
                            {
                              type: "Text",
                              props: {
                                id: "Text-4b706d11-3623-43f7-8b29-ac537c4bf002",
                                text: "Full-day coverage, two shooters, and a curated gallery within four weeks. The one I build the year around.",
                              },
                            },
                            {
                              type: "Text",
                              props: {
                                id: "Text-9f783038-e372-45bc-ad18-6583765a3540",
                                text: "From ₱30,000",
                                _style: {
                                  textColorToken: "foreground",
                                  bold: true,
                                },
                              },
                            },
                            {
                              type: "Button",
                              props: {
                                id: "Button-db8bb248-e1af-4147-ae98-1f133905991a",
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
                          _style: {
                            bgColorToken: "accent",
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
                    columns: 2,
                    minHeight: "0px",
                    _style: {
                      gap: 32,
                    },
                  },
                },
                {
                  type: "Columns",
                  props: {
                    id: "Columns-c3749700-2772-4046-8187-4476f5ce3585",
                    content: [
                      {
                        type: "Container",
                        props: {
                          id: "Container-0e8d4b0e-68f0-4f72-aec5-7835992bb08f",
                          content: [
                            {
                              type: "Heading",
                              props: {
                                id: "Heading-8909a4da-6119-49dd-8523-7f2713c571b0",
                                level: "h3",
                                text: "Portrait Sessions",
                              },
                            },
                            {
                              type: "Text",
                              props: {
                                id: "Text-0e8a735f-0005-464a-be1b-b0a62fda0fc0",
                                text: "Individual or family portraits in natural light.",
                              },
                            },
                            {
                              type: "Text",
                              props: {
                                id: "Text-e7818c20-3cc7-491a-aacc-117f4c65037e",
                                text: "From ₱8,000",
                                _style: {
                                  textColorToken: "foreground",
                                  bold: true,
                                },
                              },
                            },
                          ],
                          _style: {
                            gap: 8,
                            borderWidth: 1,
                            borderSides: [
                              "top",
                            ],
                            borderColorToken: "foreground",
                            paddingTop: "1.125rem",
                          },
                        },
                      },
                      {
                        type: "Container",
                        props: {
                          id: "Container-785ed01e-c2fe-4575-ad86-569cbb1c16c8",
                          content: [
                            {
                              type: "Heading",
                              props: {
                                id: "Heading-bf8e00e5-80b7-495f-96ce-753166a6ad2f",
                                level: "h3",
                                text: "Event Coverage",
                              },
                            },
                            {
                              type: "Text",
                              props: {
                                id: "Text-f53db108-125c-4d4b-b1ca-f29019c65ceb",
                                text: "Corporate events, debuts, and intimate gatherings.",
                              },
                            },
                            {
                              type: "Text",
                              props: {
                                id: "Text-c4772d3b-4189-471f-ac6e-13707ab7ca99",
                                text: "From ₱15,000",
                                _style: {
                                  textColorToken: "foreground",
                                  bold: true,
                                },
                              },
                            },
                          ],
                          _style: {
                            gap: 8,
                            borderWidth: 1,
                            borderSides: [
                              "top",
                            ],
                            borderColorToken: "foreground",
                            paddingTop: "1.125rem",
                          },
                        },
                      },
                    ],
                    columns: 2,
                    minHeight: "0px",
                    _style: {
                      gap: 32,
                    },
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
            },
          },
          {
            type: "FeaturedWorkIndexPreset",
            props: {
              id: "FeaturedWorkIndexPreset-53ea6369-0d19-4f3d-b171-78ba60faf0e9",
              content: [
                {
                  type: "Container",
                  props: {
                    id: "Container-fc68b3bb-1cf5-4b52-b01e-815905d9fa48",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "Heading-72dc5bf0-a744-4768-8929-39a26555a1a1",
                          level: "h2",
                          text: "Featured work",
                        },
                      },
                      {
                        type: "Text",
                        props: {
                          id: "Text-9dd582af-9bcb-4faa-b588-fea441cba5d3",
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
                  type: "Container",
                  props: {
                    id: "Container-88e14747-12c8-4e62-835d-77ee709b8181",
                    content: [
                      {
                        type: "Columns",
                        props: {
                          id: "Columns-97ac1370-0fa9-406c-9d0d-6b7ff3ec5bd2",
                          content: [
                            {
                              type: "CollectionCard",
                              props: {
                                id: "CollectionCard-28456d13-b99c-4563-9ca8-a0eddf00422d",
                                aspectRatio: "1 / 1",
                                showCaption: true,
                              },
                            },
                            {
                              type: "CollectionCard",
                              props: {
                                id: "CollectionCard-5128caae-1c9e-4378-b487-c2ff27262d82",
                                aspectRatio: "1 / 1",
                                showCaption: true,
                              },
                            },
                            {
                              type: "CollectionCard",
                              props: {
                                id: "CollectionCard-7be5827e-0921-45bb-ad2a-7ead4291752a",
                                aspectRatio: "1 / 1",
                                showCaption: true,
                              },
                            },
                            {
                              type: "CollectionCard",
                              props: {
                                id: "CollectionCard-cbf13a2b-f1e0-45ac-bc80-8fb5af59ce36",
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
                          id: "Container-88e14747-12c8-4e62-835d-77ee709b8181--anchor",
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
            },
          },
        ],
        marginX: "1.5rem",
      },
    },
    {
      type: "FooterDirectoryPreset",
      props: {
        id: "FooterDirectoryPreset-54fc8ae1-90e5-4059-91bf-2cf9c5de95b9",
        content: [
          {
            type: "Divider",
            props: {
              id: "c42f3a42-c010-435e-a78f-af04c7c96946",
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
              id: "55d869e8-f70a-4390-a28a-7854b6551845",
              content: [
                {
                  type: "Container",
                  props: {
                    id: "5265b0d4-d1a5-4368-b14f-5e8692707bf0",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "ab1f157d-059d-4430-8923-8e682625cf59",
                          level: "h3",
                          text: "Lumen Studio",
                        },
                      },
                      {
                        type: "Text",
                        props: {
                          id: "842f1a34-93b3-4959-9d97-f0e58395f7f1",
                          text: "Fine art photography for weddings, portraits, and events across Metro Manila.",
                        },
                      },
                    ],
                    _style: {
                      gap: 10,
                    },
                  },
                },
                {
                  type: "Container",
                  props: {
                    id: "695bf8c1-29ef-41f4-b789-d90256a5a0d9",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "eb45dabf-2bb8-4083-9e1d-2a66116b1f7b",
                          level: "h4",
                          text: "Explore",
                        },
                      },
                      {
                        type: "Button",
                        props: {
                          id: "220f76f5-ce85-4376-ab9a-a8c30c865260",
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
                          id: "606494d1-ebf5-4f08-b975-5cd96c90bd06",
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
                          id: "1ae4916d-a0f9-4dfa-b594-aef40b140c3c",
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
                  },
                },
                {
                  type: "Container",
                  props: {
                    id: "061e3888-24e6-4e16-af57-6983738fae6c",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "694410b9-0217-4e35-96a5-0790dae8d9e2",
                          level: "h4",
                          text: "Studio",
                        },
                      },
                      {
                        type: "ContactDetails",
                        props: {
                          id: "9431388a-56e8-44c5-9fe4-af33c96cf3cd",
                        },
                      },
                    ],
                    _style: {
                      gap: 12,
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
          {
            type: "Divider",
            props: {
              id: "1fced7f7-c4db-4b6e-8362-bc9e92236567",
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
              id: "1a67a6c6-3c52-4074-bcf1-05f32ec87e36",
              content: [
                {
                  type: "Text",
                  props: {
                    id: "df48c6fb-371d-416b-8abf-28d6c0d778cd",
                    text: "© 2026 Lumen Studio",
                  },
                },
              ],
              overallWidth: "page-fit",
              _style: {
                contentHorizontalAlign: "start",
              },
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
      navigationBlock("Navigation-luxury-gal-0", {
      contactButtonTextColor: "foreground",
      fontSize: "sm",
      contactButtonRadius: "subtle",
    }, ctx.workspace.name),
    {
      type: "PageBody",
      props: {
        id: "page-body",
        content: [
          {
            type: "GalleryLandingSplitPreset",
            props: {
              id: "GalleryLandingSplitPreset-41b28e11-9396-4ed2-924b-0fa7e9c8085d",
              content: [
                {
                  type: "Container",
                  props: {
                    id: "Container-50c5e2e7-08bd-4bfe-a0b8-a729756de3fe",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "Heading-0ad37e54-b474-4e4d-b64c-ff933a462b08",
                          level: "h2",
                          text: "Our gallery",
                        },
                      },
                      {
                        type: "Text",
                        props: {
                          id: "Text-776b494f-8f79-4fde-9f50-dbb24a39e7a2",
                          text: "A curated look at our work.",
                        },
                      },
                      {
                        type: "Divider",
                        props: {
                          id: "Divider-4e6e03bb-2697-48f5-ac32-c39717b85519",
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
                  type: "Image",
                  props: {
                    id: "Image-c1f168ef-4845-4d9b-bd88-6e04aeaa4fec",
                    alt: "Signature photograph",
                    _style: {
                      width: "50%",
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
            type: "FeaturedWorkLeadPreset",
            props: {
              id: "FeaturedWorkLeadPreset-090f383c-ff6f-4af9-9795-ff893d01bb83",
              content: [
                {
                  type: "Container",
                  props: {
                    id: "Container-ffcfd169-5da8-4b6a-879e-6c3c4affc579",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "Heading-84145422-166b-4819-b61f-519e85b74fc8",
                          level: "h2",
                          text: "Featured work",
                          _style: {
                            align: "right",
                            selfAlign: "right",
                          },
                        },
                      },
                      {
                        type: "Text",
                        props: {
                          id: "Text-91b4d40f-3d35-465f-930a-02ae6b96f7ad",
                          text: "Two projects that say most of what I'd want to say in a first meeting.",
                          _style: {
                            selfAlign: "right",
                          },
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
                      align: "right",
                    },
                  },
                },
                {
                  type: "Columns",
                  props: {
                    id: "Columns-1eb7fdf4-f40e-4094-9f51-0e8971950612",
                    content: [
                      {
                        type: "CollectionCard",
                        props: {
                          id: "CollectionCard-9e3499fd-819f-4b94-8952-e2cabc3cd853",
                          aspectRatio: "3 / 2",
                          showCaption: true,
                        },
                      },
                      {
                        type: "CollectionCard",
                        props: {
                          id: "CollectionCard-c0c68934-fcf1-432f-ae13-935b0ca0beaa",
                          aspectRatio: "3 / 2",
                          showCaption: true,
                        },
                      },
                      {
                        type: "CollectionCard",
                        props: {
                          id: "CollectionCard-6a3b81cb-08c0-4422-997b-4fd6d7919111",
                          aspectRatio: "3 / 2",
                          showCaption: true,
                        },
                      },
                      {
                        type: "CollectionCard",
                        props: {
                          id: "CollectionCard-ce4f68ac-95ca-4792-b8dd-8f6912d6e133",
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
            },
          },
          {
            type: "VideoSplitPreset",
            props: {
              id: "VideoSplitPreset-2a7aadbb-4f77-42e8-a433-1fc9ecc30896",
              content: [
                {
                  type: "Columns",
                  props: {
                    id: "Columns-401b6a3e-733c-4265-91d7-e60f2b085391",
                    content: [
                      {
                        type: "Container",
                        props: {
                          id: "Container-5d9638df-6936-4804-b0e1-76f7a621d426",
                          content: [
                            {
                              type: "Heading",
                              props: {
                                id: "Heading-85702f36-cb1e-4a9c-a290-258cbe7e7681",
                                level: "h2",
                                text: "Watch our story",
                              },
                            },
                            {
                              type: "Text",
                              props: {
                                id: "Text-5eb01700-1155-421f-b310-0087215520e5",
                                text: "A short film capturing the moments that matter most.",
                              },
                            },
                            {
                              type: "Button",
                              props: {
                                id: "Button-11c95534-fb23-4176-825e-3c1667c41eb5",
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
                            paddingTop: "2rem",
                            paddingRight: "2rem",
                            paddingBottom: "2rem",
                            paddingLeft: "2rem",
                            contentVerticalDistribution: "center",
                          },
                        },
                      },
                      {
                        type: "Video",
                        props: {
                          id: "Video-28925aea-f403-4d79-abdd-ba74f279dabd",
                          videoUrl: "",
                          _style: {
                            colSpan: 2,
                            cellVerticalAlign: "center",
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
              backgroundImages: [],
              minHeight: "auto",
              _style: {
                bgColorToken: "background",
                gap: 0,
              },
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
        id: "e7349dcd-9002-42a9-976a-8817f796eb71",
        content: [
          {
            type: "Divider",
            props: {
              id: "d4cc736e-5cdf-47e1-baf8-410e46268ee0",
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
              id: "fe33f048-112f-4d26-996c-6940ac5704e6",
              content: [
                {
                  type: "Container",
                  props: {
                    id: "2b750483-1169-46b7-b992-d82b4e5df868",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "7dbda5e9-91ae-40f3-8c32-06a32c3b5333",
                          level: "h3",
                          text: "Lumen Studio",
                        },
                      },
                      {
                        type: "Text",
                        props: {
                          id: "d67a866a-e592-4a4a-ae86-54f42ed3e99e",
                          text: "Fine art photography for weddings, portraits, and events across Metro Manila.",
                        },
                      },
                    ],
                    _style: {
                      gap: 10,
                    },
                  },
                },
                {
                  type: "Container",
                  props: {
                    id: "0a2bc0f5-a8c9-4b2e-bc28-cc40a81cf9f5",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "770f27f4-6d1e-4106-9a94-82f0efdc3736",
                          level: "h4",
                          text: "Explore",
                        },
                      },
                      {
                        type: "Button",
                        props: {
                          id: "230b0f9c-c612-44c0-b2bb-d64fb4bad9a0",
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
                          id: "fc98059e-d750-465d-b39c-53608ffa0e9c",
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
                          id: "c71330dc-099b-4f8d-bc96-5a6bd3d436e7",
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
                  },
                },
                {
                  type: "Container",
                  props: {
                    id: "9db934e8-04fc-4d56-95c2-9475ed60672e",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "f5bc3d0e-6295-4f38-8292-21f9c5b6e5dc",
                          level: "h4",
                          text: "Studio",
                        },
                      },
                      {
                        type: "ContactDetails",
                        props: {
                          id: "249d0718-712c-498b-87a4-cb0044ae93f0",
                        },
                      },
                    ],
                    _style: {
                      gap: 12,
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
          {
            type: "Divider",
            props: {
              id: "64732dec-005d-4056-a30f-0b2d351043fe",
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
              id: "dc2ee0c9-3e21-4496-bb12-f1b3528d89ea",
              content: [
                {
                  type: "Text",
                  props: {
                    id: "35fb950c-6161-46f0-a705-17a2ed26ea2f",
                    text: "© 2026 Lumen Studio",
                  },
                },
              ],
              overallWidth: "page-fit",
              _style: {
                contentHorizontalAlign: "start",
              },
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
