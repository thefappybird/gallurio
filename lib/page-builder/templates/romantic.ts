import { THEME_PRESET_DEFINITIONS } from "@/lib/page-builder/brandKitPicker/themePresetDefinitions";
import type { PortfolioTemplate } from "./types";
import { zone, navigationBlock } from "./_blocks";

/**
 * Romantic — Deep burgundy palette, soft rounded buttons, intimate storytelling layout.
 * Ported 1:1 from the "Romantic Template" reference draft.
 */
export const romanticTemplate: PortfolioTemplate = {
  id: "romantic",
  label: "Romantic",
  businessType: "stylist",
  description: "Deep burgundy palette, soft rounded buttons, intimate storytelling layout.",
  previewImage: "/template-previews/romantic.svg",
  defaultBrandKit: { ...THEME_PRESET_DEFINITIONS.romantic.brandKit },
  defaultContact: {
    buttonStyle: "solid",
    buttonColor: "foreground",
  },
  defaultCollectionsPopup: {
    backgroundColor: "background",
    radius: "rounded",
    popupLayout: "immersive",
    popupColumns: 3,
    imageModalLayout: "cinema",
    closeButtonRadius: "rounded",
    closeButtonBorderWidth: 0,
  },
  seedData: (ctx) => ({
    home: zone([
      navigationBlock("Navigation-romantic-home-0", {
      navOrder: [
        "logo",
        "home",
        "gallery",
        "contact",
      ],
      fontSize: "",
      contactButtonRadius: "sharp",
      contactButtonTextColor: "foreground",
      inactiveLinkRadius: "sharp",
      activeLinkRadius: "sharp",
    }, ctx.workspace.name),
    {
      type: "PageBody",
      props: {
        id: "page-body",
        content: [
          {
            type: "HeroStatementPreset",
            props: {
              id: "HeroStatementPreset-68869cc5-af9d-48f7-aef1-288e68fa4c76",
              content: [
                {
                  type: "Container",
                  props: {
                    overallWidth: "page-fit",
                    alignX: "left",
                    alignY: "center",
                    _style: {
                    gap: 28,
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
                    id: "Container-e3ac9b73-0143-435c-afc8-b75d5cb7b194",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "Heading-09572152-a3bc-4bcc-b217-0ed35d970216",
                          level: "h1",
                          text: "Capturing moments that last forever",
                          _style: {
                            bold: true,
                          },
                        },
                      },
                      {
                        type: "Divider",
                        props: {
                          id: "Divider-9d96ce2a-1e9a-4f5e-9b94-4778970aecbf",
                          thickness: 1,
                          _style: {
                            width: "8rem",
                            paddingLeft: "0px",
                            paddingRight: "0px",
                          },
                        },
                      },
                      {
                        type: "Text",
                        props: {
                          id: "Text-b7510b4d-90b5-47b8-a579-0568835b6cbb",
                          text: "Fine art photography for weddings, portraits, and events.",
                        },
                      },
                      {
                        type: "Button",
                        props: {
                          id: "Button-d60dd6bf-6d59-4c31-87f4-6e613bbff0b8",
                          label: "Get in Touch",
                          action: "open-contact",
                          align: "left",
                          size: "sm",
                          _style: {
                            buttonStyle: "soft",
                            buttonColorToken: "foreground",
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
                  },
                },
              ],
                  },
                },
              ],
              backgroundImages: [],
              minHeight: "medium",
              alignX: "left",
              alignY: "center",
              _style: {
                bgColorToken: "primary",
                textColorToken: "foreground",
                gap: 28,
                radius: 0,
                marginBottom: "0px",
                paddingLeft: "0px",
                paddingRight: "0px",
              },
              bgAnimation: "crossfade",
              bgSpeed: "medium",
              overlayOpacity: 0,
              overallWidth: "full",
            },
          },
          {
            type: "VideoSplitPreset",
            props: {
              id: "VideoSplitPreset-bff5c37a-4688-48e4-ac0c-ae7cac5d85e6",
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
                    id: "Columns-a4697676-bc60-4ac1-8381-496ea946b3f0",
                    content: [
                      {
                        type: "Video",
                        props: {
                          id: "Video-3e7737a1-fef0-4aef-98c4-d5f5e657357d",
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
                          id: "Container-652c8956-bdf9-4c26-9300-95b56b5907df",
                          content: [
                            {
                              type: "Heading",
                              props: {
                                id: "Heading-ca5287a7-854a-4bec-b490-b81828c96f60",
                                level: "h2",
                                text: "Watch our story",
                              },
                            },
                            {
                              type: "Text",
                              props: {
                                id: "Text-0eaf110a-1d08-432f-8df6-741bb6b5b913",
                                text: "A short film capturing the moments that matter most.",
                              },
                            },
                            {
                              type: "Button",
                              props: {
                                id: "Button-641e69f0-aaf3-4f5d-99f3-a99926130a9a",
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
                            radius: 0,
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
              _style: { paddingLeft: "0px", paddingRight: "0px",
                bgColorToken: "background",
                gap: 0,
                marginBottom: "0px",
                radius: 0,
              },
              bgAnimation: "crossfade",
              bgSpeed: "medium",
              overlayOpacity: 0,
              alignX: "left",
              alignY: "top",
            },
          },
          {
            type: "ServicesMenuPreset",
            props: {
              id: "ServicesMenuPreset-fb7fee02-7614-4c05-9ab6-c0e3955d0167",
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
                    id: "Container-3b20d163-025f-4ad0-9321-0ac82e773171",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "Heading-34b07678-35e9-4411-8453-e8b0904e33e3",
                          level: "h2",
                          text: "Services",
                        },
                      },
                      {
                        type: "Divider",
                        props: {
                          id: "Divider-64f24d65-2861-4316-b4da-a4c5dcc093c4",
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
                          id: "Container-84dd3c24-b153-49e9-89e9-0fe38e44500d",
                          content: [
                            {
                              type: "Columns",
                              props: {
                                id: "Columns-c20a3360-6ac2-4295-9e73-72e5662f2ae9",
                                content: [
                                  {
                                    type: "Heading",
                                    props: {
                                      id: "Heading-089e8ba8-98f4-47cb-8571-13bdb93495d9",
                                      level: "h3",
                                      text: "Wedding Photography",
                                    },
                                  },
                                  {
                                    type: "Text",
                                    props: {
                                      id: "Text-7525008b-f255-40ec-877b-711026399e18",
                                      text: "Full-day coverage, two shooters, and a curated gallery within four weeks.",
                                      _style: {
                                        colSpan: 1,
                                      },
                                    },
                                  },
                                  {
                                    type: "Text",
                                    props: {
                                      id: "Text-3be2ebcf-d72c-4db7-9b25-37c010d0ddaf",
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
                                overallWidth: "full",
                              },
                            },
                            {
                              type: "ContainerAnchor",
                              props: {
                                id: "Container-84dd3c24-b153-49e9-89e9-0fe38e44500d--anchor",
                                height: 0,
                              },
                            },
                          ],
                          overallWidth: "page-fit",
                        },
                      },
                      {
                        type: "Divider",
                        props: {
                          id: "Divider-66de3436-de1d-4bfd-bb67-6c44038f4fd2",
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
                          id: "Container-74c9babf-5795-4ecd-bb50-d2ada392550e",
                          content: [
                            {
                              type: "Columns",
                              props: {
                                id: "Columns-3be6985f-4d81-4c63-bef6-ca1860e4f447",
                                content: [
                                  {
                                    type: "Heading",
                                    props: {
                                      id: "Heading-68765e2f-ae0f-4302-839b-a069dd3c423d",
                                      level: "h3",
                                      text: "Portrait Sessions",
                                    },
                                  },
                                  {
                                    type: "Text",
                                    props: {
                                      id: "Text-60d2fcb5-f98b-469f-b531-46e94249af90",
                                      text: "Ninety minutes in natural light, at the studio or somewhere that matters to you.",
                                      _style: {
                                        colSpan: 1,
                                      },
                                    },
                                  },
                                  {
                                    type: "Text",
                                    props: {
                                      id: "Text-56a3e367-e6af-469e-9948-8e31b21cfec7",
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
                                overallWidth: "full",
                              },
                            },
                            {
                              type: "ContainerAnchor",
                              props: {
                                id: "Container-74c9babf-5795-4ecd-bb50-d2ada392550e--anchor",
                                height: 0,
                              },
                            },
                          ],
                          overallWidth: "page-fit",
                        },
                      },
                      {
                        type: "Divider",
                        props: {
                          id: "Divider-8708cc2d-0439-4ecc-8f33-8b980971e3cb",
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
                          id: "Container-28b40e35-e095-450f-aed9-e6dcd0f5f3d1",
                          content: [
                            {
                              type: "Columns",
                              props: {
                                id: "Columns-c667170b-8443-4a52-ae15-766d21e8f285",
                                content: [
                                  {
                                    type: "Heading",
                                    props: {
                                      id: "Heading-f2113882-f2f7-432b-b74a-8298c5e0fe28",
                                      level: "h3",
                                      text: "Event Coverage",
                                    },
                                  },
                                  {
                                    type: "Text",
                                    props: {
                                      id: "Text-7beecc18-7be7-468b-baee-11b506581039",
                                      text: "Corporate events, debuts, and intimate gatherings, half or full day.",
                                      _style: {
                                        colSpan: 1,
                                      },
                                    },
                                  },
                                  {
                                    type: "Text",
                                    props: {
                                      id: "Text-820afaef-caf3-4084-9b68-edc5543eb458",
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
                                overallWidth: "full",
                              },
                            },
                            {
                              type: "ContainerAnchor",
                              props: {
                                id: "Container-28b40e35-e095-450f-aed9-e6dcd0f5f3d1--anchor",
                                height: 0,
                              },
                            },
                          ],
                          overallWidth: "page-fit",
                        },
                      },
                      {
                        type: "Divider",
                        props: {
                          id: "Divider-23b5f3b2-a206-4016-9e60-25519c38147d",
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
                          id: "Container-ce599fb4-9fc2-43ac-8094-2220ff4c09fd",
                          content: [
                            {
                              type: "Columns",
                              props: {
                                id: "Columns-7e317b8f-9a69-4954-90fb-25ac719d63d7",
                                content: [
                                  {
                                    type: "Heading",
                                    props: {
                                      id: "Heading-b10b71bb-a9ff-4411-9776-0655d3b847ee",
                                      level: "h3",
                                      text: "Editorial and Brand",
                                    },
                                  },
                                  {
                                    type: "Text",
                                    props: {
                                      id: "Text-268cdfde-6e13-490f-b142-3663a1801638",
                                      text: "Campaign and lookbook work for studios, labels, and venues.",
                                      _style: {
                                        colSpan: 1,
                                      },
                                    },
                                  },
                                  {
                                    type: "Text",
                                    props: {
                                      id: "Text-dc6541dd-c1bd-4673-8280-8ab2f495bd3a",
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
                                overallWidth: "full",
                              },
                            },
                            {
                              type: "ContainerAnchor",
                              props: {
                                id: "Container-ce599fb4-9fc2-43ac-8094-2220ff4c09fd--anchor",
                                height: 0,
                              },
                            },
                          ],
                          overallWidth: "page-fit",
                        },
                      },
                      {
                        type: "Divider",
                        props: {
                          id: "Divider-55783720-19ad-465a-a4a7-465fcab96fba",
                          thickness: 1,
                          _style: {
                            paddingLeft: "0px",
                            paddingRight: "0px",
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
              minHeight: "auto",
              _style: { paddingLeft: "0px", paddingRight: "0px",
                bgColorToken: "secondary",
                textColorToken: "foreground",
                gap: 0,
                radius: 0,
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
            type: "CtaImagePreset",
            props: {
              id: "CtaImagePreset-7ae3fe92-35d3-4710-a860-975a1a5fe4bd",
              content: [
                {
                  type: "Container",
                  props: {
                    id: "Container-3c747873-4d2c-499c-a8ff-867fc4df4f1e",
                    content: [
                      {
                        type: "Columns",
                        props: {
                          id: "Columns-642c879f-250c-4c43-b2d2-52a190cc5554",
                          content: [
                            {
                              type: "Container",
                              props: {
                                id: "Container-33d38760-7158-4169-91b3-9a80cea5c571",
                                content: [
                                  {
                                    type: "Heading",
                                    props: {
                                      id: "Heading-a94d8400-daaf-4a38-b39a-af26d3118e4b",
                                      level: "h2",
                                      text: "Ready to book your session?",
                                    },
                                  },
                                  {
                                    type: "Text",
                                    props: {
                                      id: "Text-2e449303-34cf-4dd1-85d7-42eb379fd0c7",
                                      text: "Let's create something beautiful together.",
                                    },
                                  },
                                  {
                                    type: "Button",
                                    props: {
                                      id: "Button-d82fd24e-113e-48b8-8770-462e32173475",
                                      label: "Get in Touch",
                                      action: "open-contact",
                                      align: "left",
                                      size: "sm",
                                      _style: {
                                        buttonStyle: "soft",
                                        buttonColorToken: "foreground",
                                        radius: 0,
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
                                  radius: 0,
                                },
                              },
                            },
                            {
                              type: "Image",
                              props: {
                                id: "Image-42368d2e-f15d-4130-bd08-a5e75a986183",
                                alt: "Studio portrait",
                              },
                            },
                          ],
                          columns: 2,
                          minHeight: "0px",
                          _style: {
                            gap: 32,
                          },
                          overallWidth: "full",
                        },
                      },
                      {
                        type: "ContainerAnchor",
                        props: {
                          id: "Container-3c747873-4d2c-499c-a8ff-867fc4df4f1e--anchor",
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
              _style: { paddingLeft: "0px", paddingRight: "0px",
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
      type: "FooterSignaturePreset",
      props: {
        id: "FooterSignaturePreset-8c4afb10-6abe-44b0-9d04-5f460d3f6133",
        content: [
                {
                  type: "Container",
                  props: {
                    overallWidth: "page-fit",
                    alignX: "center",
                    alignY: "top",
                    _style: {
                    gap: 20,
                    contentVerticalDistribution: "start",
                    contentHorizontalAlign: "center",
                      paddingTop: "0px",
                      paddingRight: "0px",
                      paddingBottom: "0px",
                      paddingLeft: "0px",
                      marginBottom: "0px",
                    },
                    content: [
          {
            type: "Divider",
            props: {
              id: "78f42ae1-92f7-43dc-8174-0fb3ea12de93",
              thickness: 1,
              _style: {
                paddingLeft: "0px",
                paddingRight: "0px",
              },
            },
          },
          {
            type: "Heading",
            props: {
              id: "3d4b7ae3-16fb-46e8-98d4-65488c9d7bac",
              level: "h3",
              text: "Lumen Studio",
            },
          },
          {
            type: "Text",
            props: {
              id: "1a240156-c7c9-4458-b155-111446c42a9f",
              text: "Fine art photography · Manila",
            },
          },
          {
            type: "Container",
            props: {
              id: "de38ff4e-a128-4bc0-841e-369c0134393b",
              content: [
                {
                  type: "Button",
                  props: {
                    id: "9efc8514-ccb4-4477-a181-7c084dae1730",
                    label: "Home",
                    action: "go-to-home",
                    align: "center",
                    size: "sm",
                    _style: {
                      buttonStyle: "link",
                      marginLeft: "0px",
                      marginRight: "0px",
                    },
                  },
                },
                {
                  type: "Button",
                  props: {
                    id: "dbccb293-aa2a-4d77-88bd-1fdae1353dae",
                    label: "Gallery",
                    action: "go-to-gallery",
                    align: "center",
                    size: "sm",
                    _style: {
                      buttonStyle: "link",
                      marginLeft: "0px",
                      marginRight: "0px",
                    },
                  },
                },
                {
                  type: "Button",
                  props: {
                    id: "2f925793-27a3-4de1-8563-e6ef0599e272",
                    label: "Contact",
                    action: "open-contact",
                    align: "center",
                    size: "sm",
                    _style: {
                      buttonStyle: "link",
                      marginLeft: "0px",
                      marginRight: "0px",
                    },
                  },
                },
              ],
              _style: {
                flexDirection: "row",
                contentVerticalDistribution: "center",
                gap: 20,
              },
            },
          },
        ],
                  },
                },
              ],
        _chrome: "footer",
        overallWidth: "full",
        backgroundImages: [],
        minHeight: "auto",
        alignX: "center",
        _style: {
          bgColorToken: "accent",
          textColorToken: "foreground",
          gap: 20,
          paddingTop: "2.5rem",
          paddingBottom: "2.5rem",
          contentVerticalDistribution: "start",
          contentHorizontalAlign: "center",
          radius: 0,
        },
        bgAnimation: "crossfade",
        bgSpeed: "medium",
        overlayOpacity: 0,
        alignY: "top",
      },
    }
    ]),
    gallery: zone([
      navigationBlock("Navigation-romantic-gal-0", {
      navOrder: [
        "logo",
        "home",
        "gallery",
        "contact",
      ],
      fontSize: "",
      contactButtonRadius: "sharp",
      contactButtonTextColor: "foreground",
      inactiveLinkRadius: "sharp",
      activeLinkRadius: "sharp",
    }, ctx.workspace.name),
    {
      type: "PageBody",
      props: {
        id: "page-body",
        content: [
          {
            type: "GalleryLandingPreset",
            props: {
              id: "GalleryLandingPreset-4cb18161-319e-4092-bdda-58fc4d368989",
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
                  type: "Container",
                  props: {
                    id: "Container-d3f6d691-eb97-4de1-8ee5-1ac109f6380b",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "Heading-70ce3b00-10f5-4640-82ea-94b4ad196d4b",
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
                          id: "Text-b3bf1c61-2223-48e4-8c09-929866c6fe18",
                          text: "A curated look at our work.",
                          _style: {
                            textColorToken: "foreground",
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
                    overallWidth: "full",
                    _style: {
                      contentHorizontalAlign: "center",
                      width: "fit-content",
                    },
                  },
                },
              ],
                  },
                },
              ],
              backgroundImages: [],
              overlayOpacity: 40,
              overlayColorToken: "primary",
              minHeight: "medium",
              alignX: "center",
              alignY: "center",
              _style: {
                bgColorToken: "accent",
                contentHorizontalAlign: "center",
                radius: 0,
                paddingLeft: "0px",
                paddingRight: "0px",
              },
              bgAnimation: "crossfade",
              bgSpeed: "medium",
              overallWidth: "full",
            },
          },
          {
            type: "GalleryMasonryJournalPreset",
            props: {
              id: "GalleryMasonryJournalPreset-0b12c14f-3552-46f7-8295-fb789a614853",
              content: [
                {
                  type: "Container",
                  props: {
                    id: "Container-7609b4b9-75a9-43f0-8572-a63b3f5364b6",
                    content: [
                      {
                        type: "Columns",
                        props: {
                          id: "Columns-747bbd4b-4f89-4e5b-b0a2-a753402b840f",
                          content: [
                            {
                              type: "Container",
                              props: {
                                id: "Container-46b03d22-5073-4430-b2b3-7705ed6c6cd4",
                                content: [
                                  {
                                    type: "Heading",
                                    props: {
                                      id: "Heading-4b353985-ca74-4aa2-84bc-13223674ea21",
                                      level: "h2",
                                      text: "Story gallery",
                                    },
                                  },
                                  {
                                    type: "Text",
                                    props: {
                                      id: "Text-11b8bda6-68fe-421a-8064-27e4d8911366",
                                      text: "A more editorial layout for one collection.",
                                    },
                                  },
                                  {
                                    type: "Divider",
                                    props: {
                                      id: "Divider-97409e9d-4329-4a33-a095-396e54df8193",
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
                                      id: "Text-e3e151c1-e040-443f-92eb-e9cbec11077b",
                                      text: "Shot over two days in Batangas, mostly at the hour when the light stops behaving.",
                                    },
                                  },
                                ],
                                _style: {
                                  bgColorToken: "accent",
                                  textColorToken: "foreground",
                                  gap: 14,
                                  paddingTop: "2rem",
                                  paddingRight: "2rem",
                                  paddingBottom: "2rem",
                                  paddingLeft: "2rem",
                                  radius: 0,
                                },
                              },
                            },
                            {
                              type: "GalleryMasonry",
                              props: {
                                id: "GalleryMasonry-ceab15b7-cf41-43f9-a784-6076d9de18e4",
                                column4: [],
                                column3: [],
                                column2: [
                                  {
                                    type: "Image",
                                    props: {
                                      id: "Image-edf7a4f6-6925-4ddf-8ac0-69f6a07b9994",
                                      alt: "",
                                      _style: {
                                        height: "25rem",
                                      },
                                    },
                                  },
                                  {
                                    type: "Image",
                                    props: {
                                      id: "Image-9f35400d-310e-4158-b982-5c64cd027322",
                                      alt: "",
                                      _style: {
                                        height: "28rem",
                                      },
                                    },
                                  },
                                  {
                                    type: "Image",
                                    props: {
                                      id: "Image-d50e739b-a7de-453b-b141-1296a1287252",
                                      alt: "",
                                      _style: {
                                        height: "16rem",
                                      },
                                    },
                                  },
                                  {
                                    type: "MasonryClone",
                                    props: {
                                      id: "GalleryMasonry-ceab15b7-cf41-43f9-a784-6076d9de18e4--clone-2",
                                      masonryId: "GalleryMasonry-ceab15b7-cf41-43f9-a784-6076d9de18e4",
                                      column: 2,
                                      gap: 4,
                                      sourceId: "Image-edf7a4f6-6925-4ddf-8ac0-69f6a07b9994",
                                      imageProps: {
                                        alt: "",
                                        _style: {
                                          height: "25rem",
                                        },
                                      },
                                      layoutSignature: "[[[\"Image\",\"Image-91129760-1c76-4d31-bb67-2120b75fd278\",{\"height\":\"17rem\"}],[\"Image\",\"Image-77ed6c02-acb6-43f6-a8b6-9f130a16b053\",{\"height\":\"20rem\"}],[\"Image\",\"Image-3c53901b-ba93-41dd-82a2-341cf23661d6\",{\"height\":\"22rem\"}]],[[\"Image\",\"Image-edf7a4f6-6925-4ddf-8ac0-69f6a07b9994\",{\"height\":\"25rem\"}],[\"Image\",\"Image-9f35400d-310e-4158-b982-5c64cd027322\",{\"height\":\"28rem\"}],[\"Image\",\"Image-d50e739b-a7de-453b-b141-1296a1287252\",{\"height\":\"16rem\"}]]]",
                                    },
                                  },
                                ],
                                column1: [
                                  {
                                    type: "Image",
                                    props: {
                                      id: "Image-91129760-1c76-4d31-bb67-2120b75fd278",
                                      alt: "",
                                      _style: {
                                        height: "17rem",
                                      },
                                    },
                                  },
                                  {
                                    type: "Image",
                                    props: {
                                      id: "Image-77ed6c02-acb6-43f6-a8b6-9f130a16b053",
                                      alt: "",
                                      _style: {
                                        height: "20rem",
                                      },
                                    },
                                  },
                                  {
                                    type: "Image",
                                    props: {
                                      id: "Image-3c53901b-ba93-41dd-82a2-341cf23661d6",
                                      alt: "",
                                      _style: {
                                        height: "22rem",
                                      },
                                    },
                                  },
                                  {
                                    type: "MasonryClone",
                                    props: {
                                      id: "GalleryMasonry-ceab15b7-cf41-43f9-a784-6076d9de18e4--clone-1",
                                      masonryId: "GalleryMasonry-ceab15b7-cf41-43f9-a784-6076d9de18e4",
                                      column: 1,
                                      gap: 4,
                                      sourceId: "Image-91129760-1c76-4d31-bb67-2120b75fd278",
                                      imageProps: {
                                        alt: "",
                                        _style: {
                                          height: "17rem",
                                        },
                                      },
                                      layoutSignature: "[[[\"Image\",\"Image-91129760-1c76-4d31-bb67-2120b75fd278\",{\"height\":\"17rem\"}],[\"Image\",\"Image-77ed6c02-acb6-43f6-a8b6-9f130a16b053\",{\"height\":\"20rem\"}],[\"Image\",\"Image-3c53901b-ba93-41dd-82a2-341cf23661d6\",{\"height\":\"22rem\"}]],[[\"Image\",\"Image-edf7a4f6-6925-4ddf-8ac0-69f6a07b9994\",{\"height\":\"25rem\"}],[\"Image\",\"Image-9f35400d-310e-4158-b982-5c64cd027322\",{\"height\":\"28rem\"}],[\"Image\",\"Image-d50e739b-a7de-453b-b141-1296a1287252\",{\"height\":\"16rem\"}]]]",
                                    },
                                  },
                                ],
                                content: [],
                                masonryLayout: "columns",
                                _style: {
                                  colSpan: 3,
                                  galleryColumns: 2,
                                  galleryGap: "tight",
                                  masonryHeightPattern: "alternating",
                                },
                                masonryLoop: true,
                              },
                            },
                          ],
                          columns: 4,
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
                          id: "Container-7609b4b9-75a9-43f0-8572-a63b3f5364b6--anchor",
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
              minHeight: "auto",
              _style: { paddingLeft: "0px", paddingRight: "0px",
                bgColorToken: "background",
                gap: 0,
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
            type: "FeaturedWorkIndexPreset",
            props: {
              id: "FeaturedWorkIndexPreset-f925d1bc-eed9-46bb-89a0-875999ee99a0",
              content: [
                {
                  type: "Container",
                  props: {
                    overallWidth: "page-fit",
                    alignX: "left",
                    alignY: "top",
                    _style: {
                    gap: 24,
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
                    id: "Container-b5e693b4-7c5a-43be-844f-6613931f11c1",
                    content: [
                      {
                        type: "Heading",
                        props: {
                          id: "Heading-3ac85a97-01d3-4745-8178-d1abd2b7b6fe",
                          level: "h2",
                          text: "Featured work",
                        },
                      },
                      {
                        type: "Text",
                        props: {
                          id: "Text-c2499784-c8a6-455e-9be1-27b5be1d2de0",
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
                    id: "Container-dd5cf4fb-bc7f-44af-97b7-40119ca810b0",
                    content: [
                      {
                        type: "Columns",
                        props: {
                          id: "Columns-272817a7-3a41-465f-ba23-c0cfbbcbfd5d",
                          content: [
                            {
                              type: "CollectionCard",
                              props: {
                                id: "CollectionCard-55c79e82-4927-412c-aaa3-71ad8fe51793",
                                aspectRatio: "1 / 1",
                                showCaption: true,
                                _style: {
                                  radius: 0,
                                },
                              },
                            },
                            {
                              type: "CollectionCard",
                              props: {
                                id: "CollectionCard-8bafd0d5-b143-4ae1-8ade-1c64684b5f75",
                                aspectRatio: "1 / 1",
                                showCaption: true,
                                _style: {
                                  radius: 0,
                                },
                              },
                            },
                            {
                              type: "CollectionCard",
                              props: {
                                id: "CollectionCard-fbc46aa5-d51f-4615-8ed5-0a35eba1f64d",
                                aspectRatio: "1 / 1",
                                showCaption: true,
                                _style: {
                                  radius: 0,
                                },
                              },
                            },
                            {
                              type: "CollectionCard",
                              props: {
                                id: "CollectionCard-8fcb4408-39a9-404e-847c-5cdfdd6ff5f0",
                                aspectRatio: "1 / 1",
                                showCaption: true,
                                _style: {
                                  radius: 0,
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
                          id: "Container-dd5cf4fb-bc7f-44af-97b7-40119ca810b0--anchor",
                          height: 0,
                        },
                      },
                    ],
                    overallWidth: "page-fit",
                  },
                },
              ],
                  },
                },
              ],
              backgroundImages: [],
              minHeight: "auto",
              _style: { paddingLeft: "0px", paddingRight: "0px",
                bgColorToken: "primary",
                textColorToken: "foreground",
                gap: 24,
                paddingTop: "3rem",
                paddingBottom: "3rem",
                marginBottom: "0px",
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
      type: "FooterSignaturePreset",
      props: {
        id: "4be30a70-089d-4bb0-82b4-34a056034b57",
        content: [
          {
            type: "Container",
            props: {
              overallWidth: "page-fit",
              alignX: "center",
              alignY: "top",
              _style: {
                contentVerticalDistribution: "start",
                contentHorizontalAlign: "center",
                gap: 20,
                paddingTop: "0px",
                paddingRight: "0px",
                paddingBottom: "0px",
                paddingLeft: "0px",
                marginBottom: "0px",
              },
              content: [
          {
            type: "Divider",
            props: {
              id: "84834728-9a77-4ce5-afdb-8dad40ffd7bf",
              thickness: 1,
              _style: {
                paddingLeft: "0px",
                paddingRight: "0px",
              },
            },
          },
          {
            type: "Heading",
            props: {
              id: "320119dd-5ed7-4209-867a-77581bf9150b",
              level: "h3",
              text: "Lumen Studio",
            },
          },
          {
            type: "Text",
            props: {
              id: "abff7a05-1144-43c2-a50f-394486f12047",
              text: "Fine art photography · Manila",
            },
          },
          {
            type: "Container",
            props: {
              id: "0951ef89-83a5-49f1-8d32-7bcc722bad77",
              content: [
                {
                  type: "Button",
                  props: {
                    id: "1bb6a59f-a92b-431b-b46f-bef292dab928",
                    label: "Home",
                    action: "go-to-home",
                    align: "center",
                    size: "sm",
                    _style: {
                      buttonStyle: "link",
                      marginLeft: "0px",
                      marginRight: "0px",
                    },
                  },
                },
                {
                  type: "Button",
                  props: {
                    id: "33cc5064-6dd2-411f-8e30-439f9652bdb3",
                    label: "Gallery",
                    action: "go-to-gallery",
                    align: "center",
                    size: "sm",
                    _style: {
                      buttonStyle: "link",
                      marginLeft: "0px",
                      marginRight: "0px",
                    },
                  },
                },
                {
                  type: "Button",
                  props: {
                    id: "79a0fa4d-6950-40ea-9d1c-d0f0928e8414",
                    label: "Contact",
                    action: "open-contact",
                    align: "center",
                    size: "sm",
                    _style: {
                      buttonStyle: "link",
                      marginLeft: "0px",
                      marginRight: "0px",
                    },
                  },
                },
              ],
              _style: {
                flexDirection: "row",
                contentVerticalDistribution: "center",
                gap: 20,
              },
            },
          },
              ],
            },
          },
        ],
        _chrome: "footer",
        overallWidth: "full",
        backgroundImages: [],
        minHeight: "auto",
        alignX: "center",
        _style: {
          bgColorToken: "accent",
          textColorToken: "foreground",
          gap: 20,
          paddingTop: "2.5rem",
          paddingBottom: "2.5rem",
          contentVerticalDistribution: "start",
          contentHorizontalAlign: "center",
          radius: 0,
        },
        bgAnimation: "crossfade",
        bgSpeed: "medium",
        overlayOpacity: 0,
        alignY: "top",
      },
    }
    ]),
  }),
};
