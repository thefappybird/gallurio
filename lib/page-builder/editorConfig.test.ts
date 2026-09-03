import { describe, it, expect, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import type { Permissions } from "@measured/puck";
import { editorPuckConfig, createEditorConfig, englishPuckT, type PuckTranslate } from "./editorConfig";
import { puckConfig } from "./config";
import { ChromeSyncContext, type ChromeSyncCtx } from "./chromeSyncContext";
import {
  SECTION_PRESETS,
  SECTION_PRESET_KEYS,
  PRESET_GROUPS,
  NAV_PRESET_KEYS,
  LEGACY_NAV_PRESET_KEYS,
} from "./blocks/sectionPresets";
import {
  FOOTER_SIGNATURE_PRESET,
  FOOTER_DIRECTORY_PRESET,
  FOOTER_STATEMENT_PRESET,
} from "./blocks/presets/footer";
import { MANUAL_BLOCK_KEYS } from "./blockCategories";
import { galleryGridDefaultProps } from "./blocks/GalleryGridBlock";
import { galleryMasonryDefaultProps } from "./blocks/GalleryMasonryBlock";
import { featuredWorkDefaultProps } from "./blocks/FeaturedWorkBlock";
import { videoDefaultProps } from "./blocks/VideoBlock";
import { contactDetailsDefaultProps } from "./blocks/ContactDetailsBlock";
import { navigationDefaultProps } from "./blocks/NavigationBlock";
import { pageBodyDefaultProps } from "./blocks/PageBodyBlock";
import {
  headingDefaultProps,
  textDefaultProps,
  imageDefaultProps,
  buttonDefaultProps,
  spacerDefaultProps,
  dividerDefaultProps,
  columnsDefaultProps,
  containerDefaultProps,
} from "./blocks/manualBlocks";

// Stubs StyleToolkitField's actual UI (owned/tested elsewhere) so these tests
// can assert WHAT reaches it (does the field even delegate to it? what
// navDetach shape?) without depending on its internal rendering/gating.
vi.mock("./StyleToolkitField", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./StyleToolkitField")>();
  return {
    ...actual,
    StyleToolkitField: (props: { navDetach?: unknown }) =>
      createElement(
        "div",
        { "data-testid": "style-toolkit-stub" },
        JSON.stringify(props.navDetach ?? null)
      ),
  };
});

// The editor config mirrors the production blocks for client-safe previews. If a
// block's component keys or defaultProps drift from the editor's, saved data
// won't round-trip. This guards that parity.

type ComponentLike = { fields?: object; defaultProps?: unknown; inline?: boolean; label?: string };
type ComponentsMap = Record<string, ComponentLike>;
const componentsOf = (cfg: { components: unknown }) => cfg.components as ComponentsMap;

describe("editorPuckConfig parity with production puckConfig", () => {
  it("registers exactly the same component types", () => {
    expect(Object.keys(editorPuckConfig.components).sort()).toEqual(
      Object.keys(puckConfig.components).sort()
    );
  });

  it("registers every insertable section preset in both configs", () => {
    for (const key of SECTION_PRESET_KEYS) {
      expect(componentsOf(editorPuckConfig), key).toHaveProperty(key);
      expect(componentsOf(puckConfig), key).toHaveProperty(key);
    }
  });

  describe.each(SECTION_PRESET_KEYS)("%s (preset)", (key) => {
    it("is inline: true on the editor side (grid colSpan/rowSpan needs it)", () => {
      expect(componentsOf(editorPuckConfig)[key]?.inline).toBe(true);
    });

    it("editor/production field key sets match", () => {
      const editorFields = Object.keys(componentsOf(editorPuckConfig)[key]?.fields ?? {}).sort();
      const prodFields = Object.keys(componentsOf(puckConfig)[key]?.fields ?? {}).sort();
      expect(editorFields).toEqual(prodFields);
    });

    it("editor/production defaultProps both match the registry", () => {
      const expected = SECTION_PRESETS[key].defaultProps;
      expect(componentsOf(editorPuckConfig)[key]?.defaultProps).toEqual(expected);
      expect(componentsOf(puckConfig)[key]?.defaultProps).toEqual(expected);
    });
  });

  const nonPresetDefaults: Record<string, unknown> = {
    GalleryGrid: galleryGridDefaultProps,
    GalleryMasonry: galleryMasonryDefaultProps,
    FeaturedWork: featuredWorkDefaultProps,
    Video: videoDefaultProps,
    ContactDetails: contactDetailsDefaultProps,
    Heading: headingDefaultProps,
    Text: textDefaultProps,
    Image: imageDefaultProps,
    Button: buttonDefaultProps,
    Spacer: spacerDefaultProps,
    Divider: dividerDefaultProps,
    Columns: columnsDefaultProps,
    Container: containerDefaultProps,
    PageBody: pageBodyDefaultProps,
    Navigation: navigationDefaultProps,
  };

  for (const [type, blockDefaults] of Object.entries(nonPresetDefaults)) {
    it(`${type}: editor defaultProps match the block's defaultProps`, () => {
      expect(componentsOf(editorPuckConfig)[type]?.defaultProps).toEqual(blockDefaults);
    });

    it(`${type}: editor field keys match the production block's field keys`, () => {
      const editorFields = Object.keys(componentsOf(editorPuckConfig)[type]?.fields ?? {}).sort();
      const prodFields = Object.keys(componentsOf(puckConfig)[type]?.fields ?? {}).sort();
      expect(editorFields).toEqual(prodFields);
    });
  }

  it("enables contentEditable inline editing on the visible text fields", () => {
    const fieldOf = (type: string, key: string) =>
      (editorPuckConfig.components as Record<string, { fields?: Record<string, { contentEditable?: boolean }> }>)
        [type]?.fields?.[key];
    expect(fieldOf("Heading", "text")?.contentEditable).toBe(true);
    expect(fieldOf("Text", "text")?.contentEditable).toBe(true);
    expect(fieldOf("Button", "label")?.contentEditable).toBe(true);
  });

  it("keeps Video as a video-only manual block", () => {
    const editorFields = Object.keys(editorPuckConfig.components.Video.fields ?? {});
    const prodFields = Object.keys(puckConfig.components.Video.fields ?? {});
    expect(editorFields).toEqual(["_style", "videoUrl"]);
    expect(prodFields).toEqual(["_style", "videoUrl"]);
  });

  it("removes gallery copy inputs from GalleryGrid field keys", () => {
    const editorFields = Object.keys(editorPuckConfig.components.GalleryGrid.fields ?? {});
    const prodFields = Object.keys(puckConfig.components.GalleryGrid.fields ?? {});
    expect(editorFields).not.toEqual(expect.arrayContaining(["heading", "description", "footer"]));
    expect(prodFields).not.toEqual(expect.arrayContaining(["heading", "description", "footer"]));
  });

  it("allows only Image blocks plus the internal clone inside Masonry lanes", () => {
    for (const config of [editorPuckConfig, puckConfig]) {
      const gridField = config.components.GalleryGrid.fields?.content as { allow?: string[] } | undefined;
      expect(gridField?.allow).toEqual(["Image"]);
      expect((config.components.GalleryMasonry.fields?.content as { allow?: string[] })?.allow).toEqual(["Image"]);
      for (const fieldName of ["column1", "column2", "column3", "column4"]) {
        const field = (config.components.GalleryMasonry.fields as Record<string, unknown> | undefined)?.[fieldName] as { allow?: string[] } | undefined;
        expect(field?.allow).toEqual(["Image", "MasonryClone"]);
      }
    }
  });

  it("removes gallery copy inputs from GalleryMasonry field keys", () => {
    const editorFields = Object.keys(editorPuckConfig.components.GalleryMasonry.fields ?? {});
    const prodFields = Object.keys(puckConfig.components.GalleryMasonry.fields ?? {});
    expect(editorFields).not.toEqual(expect.arrayContaining(["heading", "description", "footer"]));
    expect(prodFields).not.toEqual(expect.arrayContaining(["heading", "description", "footer"]));
  });

  it("removes copy inputs from FeaturedWork field keys", () => {
    const editorFields = Object.keys(editorPuckConfig.components.FeaturedWork.fields ?? {});
    const prodFields = Object.keys(puckConfig.components.FeaturedWork.fields ?? {});
    expect(editorFields).not.toEqual(expect.arrayContaining(["heading", "subheading"]));
    expect(prodFields).not.toEqual(expect.arrayContaining(["heading", "subheading"]));
  });

  it("Container exposes bgAnimation + bgSpeed + overlayColorToken and drops the legacy bg-publicId field", () => {
    const editorFields = Object.keys(editorPuckConfig.components.Container.fields ?? {});
    const prodFields = Object.keys(puckConfig.components.Container.fields ?? {});
    expect(editorFields).toContain("bgAnimation");
    expect(editorFields).toContain("bgSpeed");
    expect(editorFields).toContain("overlayColorToken");
    expect(editorFields).not.toContain("backgroundImagePublicId");
    expect(prodFields).toContain("bgAnimation");
    expect(prodFields).toContain("bgSpeed");
    expect(prodFields).toContain("overlayColorToken");
    expect(prodFields).not.toContain("backgroundImagePublicId");
  });

  it("Hero preset inherits the container background animation + overlay color fields", () => {
    const heroFields = Object.keys(editorPuckConfig.components.HeroPreset.fields ?? {});
    expect(heroFields).toEqual(expect.arrayContaining(["bgAnimation", "bgSpeed", "overlayColorToken"]));
  });

  it("Button action options include go-to-home on both configs", () => {
    type ActionField = { options?: Array<{ value: unknown }> };
    const editorAction = (editorPuckConfig.components.Button.fields as unknown as { action: ActionField }).action;
    const prodAction = (puckConfig.components.Button.fields as unknown as { action: ActionField }).action;
    expect(editorAction.options?.map((o) => o.value)).toContain("go-to-home");
    expect(prodAction.options?.map((o) => o.value)).toContain("go-to-home");
  });
});

describe("Container resolveData — anchor id idempotency", () => {
  // Regression for Bug #2: a draft-restored Container whose ContainerAnchor
  // carries the wrong id (missing --anchor suffix) must have the anchor
  // replaced — not passed through — so the selection-bounce useEffect never
  // sees parentId === id and loops.
  it("replaces a draft anchor with the wrong id (no --anchor suffix) instead of leaving it as-is", () => {
    type ResolveDataFn = (data: unknown) => unknown;
    const container = (editorPuckConfig.components as Record<string, { resolveData?: ResolveDataFn }>).Container;
    expect(container?.resolveData, "Container.resolveData must exist").toBeDefined();
    const resolveData = container.resolveData!;

    const containerId = "myblock";
    const wrongAnchorId = containerId; // missing --anchor — the bug scenario

    const data = {
      props: {
        id: containerId,
        content: [
          { type: "ContainerAnchor", props: { id: wrongAnchorId, height: 0 } },
        ],
      },
    };

    const result = resolveData(data) as {
      props: { content: Array<{ type: string; props: { id?: string } }> };
    };
    const anchor = result.props.content[0];
    expect(anchor.type).toBe("ContainerAnchor");
    // The anchor id MUST be "myblock--anchor", not "myblock".
    expect(anchor.props.id).toBe(`${containerId}--anchor`);
  });

  it("strips the editor-only anchor when an ordinary child exists", () => {
    type ResolveDataFn = (data: unknown) => unknown;
    const container = (editorPuckConfig.components as Record<string, { resolveData?: ResolveDataFn }>).Container;
    const resolveData = container.resolveData!;
    const heading = { type: "Heading", props: { id: "h1", text: "Hello" } };

    const result = resolveData({
      props: {
        id: "myblock",
        content: [
          { type: "ContainerAnchor", props: { id: "myblock--anchor", height: 0 } },
          heading,
        ],
      },
    }) as { props: { content: Array<{ type: string; props: { id?: string } }> } };

    // An ordinary child means no anchor at all, matching
    // reconcileContainerAnchors — see shouldKeepAnchor.
    expect(result.props.content).toEqual([heading]);
  });
});

describe("GalleryLandingPreset carousel hint", () => {
  it("GalleryLandingPreset carries a backgroundImages carousel hint accessible via component metadata", () => {
    const cfg = editorPuckConfig.components.GalleryLandingPreset as Record<string, unknown>;
    const meta = cfg?.metadata as Record<string, unknown> | undefined;
    // metadata.backgroundImagesHint must mention multiple images and carousel or slideshow
    // so editor tooling (e.g. a help popover) can surface the hint without polluting
    // Puck field keys (which must stay in sync with the production config).
    expect(meta?.backgroundImagesHint).toBeDefined();
    const hint = String(meta?.backgroundImagesHint ?? "").toLowerCase();
    expect(hint).toMatch(/multiple/i);
    expect(hint).toMatch(/carousel|slideshow/i);
  });
});

// Puck 0.20's `categories` config is flat and can't nest, so the editor
// drawer's two-level tree (Preset blocks > group > variant, plus a flat
// Manual blocks sibling) is hand-built by EditorShell's PresetBlocksDrawer
// straight from PRESET_GROUPS / MANUAL_BLOCK_KEYS — editorPuckConfig carries
// no `categories` key. These tests guard the two source lists themselves;
// the rendered tree (structure, default-open state, demo filtering) is
// covered in EditorShell.test.tsx.
describe("PRESET_GROUPS + MANUAL_BLOCK_KEYS — the drawer's two source lists", () => {
  it("has exactly the 12 group ids, and together with MANUAL_BLOCK_KEYS lists every registered component exactly once", () => {
    expect(PRESET_GROUPS.map((g) => g.id)).toHaveLength(12);

    const seen = new Set<string>();
    for (const group of PRESET_GROUPS) {
      for (const componentKey of group.keys) {
        expect(seen.has(componentKey), `${componentKey} listed in more than one group`).toBe(false);
        seen.add(componentKey);
        expect(editorPuckConfig.components, `${componentKey} listed in ${group.id} but not registered`).toHaveProperty(componentKey);
      }
    }
    for (const componentKey of MANUAL_BLOCK_KEYS) {
      expect(seen.has(componentKey), `${componentKey} listed in both a preset group and manual`).toBe(false);
      seen.add(componentKey);
      expect(editorPuckConfig.components, `${componentKey} listed in manual but not registered`).toHaveProperty(componentKey);
    }
    // ContainerAnchor is editor-only plumbing (insert: false in its permissions) —
    // it is registered but deliberately absent from every drawer list.
    // FeaturedWork remains registered so a saved legacy block renders, but new
    // pages compose collection cards inside Columns containers. Navigation (the
    // base type) is likewise registered-but-undrawered. NavigationPreset is the
    // single drawer item; retired nav variants stay registered only for old data.
    const insertable = Object.keys(editorPuckConfig.components).filter(
      (k) =>
        k !== "ContainerAnchor" &&
        k !== "MasonryClone" &&
        k !== "PageBody" &&
        k !== "FeaturedWork" &&
        k !== "Navigation" &&
        !LEGACY_NAV_PRESET_KEYS.includes(k as (typeof LEGACY_NAV_PRESET_KEYS)[number]),
    );
    expect([...seen].sort()).toEqual(insertable.sort());
  });

  it("keeps retired navigation variants renderable but out of every drawer group", () => {
    const listed = PRESET_GROUPS.flatMap((group) => group.keys);
    for (const key of LEGACY_NAV_PRESET_KEYS) {
      expect(editorPuckConfig.components).toHaveProperty(key);
      expect(puckConfig.components).toHaveProperty(key);
      expect(listed).not.toContain(key);
    }
  });

  it("keeps deprecated Highlights registered but impossible to insert, and out of both drawer lists", () => {
    expect(editorPuckConfig.components.FeaturedWork.permissions?.insert).toBe(false);
    const allListed = [...PRESET_GROUPS.flatMap((g) => g.keys), ...MANUAL_BLOCK_KEYS];
    expect(allListed).not.toContain("FeaturedWork");
  });

  it("keeps MasonryClone internal and completely read-only, and out of both drawer lists", () => {
    expect(editorPuckConfig.components.MasonryClone.permissions).toEqual({
      drag: false,
      delete: false,
      duplicate: false,
      insert: false,
      edit: false,
    });
    const allListed = [...PRESET_GROUPS.flatMap((g) => g.keys), ...MANUAL_BLOCK_KEYS];
    expect(allListed).not.toContain("MasonryClone");
  });
});

describe("English fallback coverage", () => {
  it("every key createEditorConfig requests resolves to a real string, not the key itself", () => {
    // englishPuckT falls through to `?? key` on a miss, which is exactly the bug
    // this guards: a label silently rendering as e.g. "puckConfig.blocks.heroSplitPreset".
    const misses: string[] = [];
    const recordingT: PuckTranslate = (key) => {
      const value = englishPuckT(key);
      if (value === key) misses.push(key);
      return value;
    };
    createEditorConfig(recordingT);
    expect(misses).toEqual([]);
  });
});

describe("createEditorConfig factory", () => {
  it("uses translated block labels when called with a custom translator", () => {
    const mockT = (key: string) => `[${key}]`;
    const cfg = createEditorConfig(mockT);
    const components = cfg.components as Record<string, { label?: string }>;
    expect(components.GalleryGrid?.label).toBe("[puckConfig.blocks.galleryGrid]");
    expect(components.HeroPreset?.label).toBe("[puckConfig.blocks.heroPreset]");
    expect(components.Container?.label).toBe("[puckConfig.blocks.container]");
  });
});

describe("block label renames", () => {
  const label = (cfg: { components: Record<string, { label?: string }> }, key: string) =>
    cfg.components[key]?.label;

  it("renames the manual gallery/featured labels in both configs", () => {
    for (const cfg of [editorPuckConfig, puckConfig] as const) {
      expect(label(cfg as never, "GalleryGrid")).toBe("Photo Grid");
      expect(label(cfg as never, "GalleryMasonry")).toBe("Masonry");
      expect(label(cfg as never, "FeaturedWork")).toBe("Highlights");
    }
  });

  it("preset component labels are the variant name; the group name is now the drawer category title", () => {
    expect(SECTION_PRESETS.GalleryLandingPreset.label).toBe("Slideshow cover");
    expect(SECTION_PRESETS.GalleryLandingPreset.group).toBe("galleryLanding");
    const group = PRESET_GROUPS.find((g) => g.id === "galleryLanding");
    expect(group?.label).toBe("Gallery landing");
  });
});

// ---------------------------------------------------------------------------
// Navigation `_style` editor override — the field panel must actually render.
// ---------------------------------------------------------------------------

type StyleField = { render: (p: { value: unknown; onChange: (v: unknown) => void; id: string }) => ReactNode };

describe("Navigation _style editor override", () => {
  it("resolves the real StyleToolkitField for the base Navigation type (not the inert production placeholder)", () => {
    const cfg = createEditorConfig(englishPuckT);
    const field = (cfg.components.Navigation.fields as unknown as { _style: StyleField })._style;
    render(field.render({ value: undefined, onChange: vi.fn(), id: "nav-1" }));
    expect(screen.getByTestId("style-toolkit-stub")).toBeInTheDocument();
  });

  it("resolves the real StyleToolkitField for every nav-group preset", () => {
    const cfg = createEditorConfig(englishPuckT);
    for (const key of NAV_PRESET_KEYS) {
      const field = (cfg.components[key].fields as unknown as { _style: StyleField })._style;
      const { unmount, getByTestId } = render(
        field.render({ value: undefined, onChange: vi.fn(), id: `${key}-1` })
      );
      expect(getByTestId("style-toolkit-stub")).toBeInTheDocument();
      unmount();
    }
  });

  it("leaves the Container branch's shared editor _style field untouched", () => {
    const cfg = createEditorConfig(englishPuckT);
    const containerStyle = (cfg.components.Container.fields as unknown as { _style: StyleField })._style;
    const heroPresetStyle = (cfg.components.HeroPreset.fields as unknown as { _style: StyleField })._style;
    // Container-based blocks all share ONE `styleField` instance — proves the
    // Navigation override didn't touch (or fork) the Container code path.
    expect(containerStyle).toBe(heroPresetStyle);
  });

  it("the production config.ts path never delegates to StyleToolkitField (still the inert placeholder)", () => {
    const field = (puckConfig.components.Navigation.fields as unknown as { _style: StyleField })._style;
    // If config.ts's Navigation `_style` routed through StyleToolkitField (even
    // the mocked stub), this would be a rendered element, not null.
    expect(field.render({ value: undefined, onChange: vi.fn(), id: "nav-1" })).toBeNull();
  });
});

describe("Navigation _style navDetach wiring", () => {
  const mockT: PuckTranslate = (key) => {
    if (key === "zone.home") return "Home";
    if (key === "zone.gallery") return "Gallery";
    return englishPuckT(key);
  };

  function renderNavStyle(activeZone: "home" | "gallery" | undefined, ctx: ChromeSyncCtx) {
    const cfg = createEditorConfig(mockT, activeZone);
    const field = (cfg.components.Navigation.fields as unknown as { _style: StyleField })._style;
    const el = field.render({ value: undefined, onChange: vi.fn(), id: "nav-1" });
    render(createElement(ChromeSyncContext.Provider, { value: ctx }, el as never));
  }

  it("passes zoneLabel/otherZoneLabel/disabled through when activeZone + chromeSync context are present", () => {
    const ctx: ChromeSyncCtx = {
      canDetach: (zone) => zone !== "home",
      detachedZone: () => "home",
    };
    renderNavStyle("home", ctx);
    const payload = JSON.parse(screen.getByTestId("style-toolkit-stub").textContent ?? "null");
    expect(payload).toEqual({ zoneLabel: "Home", otherZoneLabel: "Gallery", disabled: true });
  });

  it("flips zoneLabel/otherZoneLabel/disabled for the gallery zone", () => {
    const ctx: ChromeSyncCtx = {
      canDetach: (zone) => zone === "gallery",
      detachedZone: () => null,
    };
    renderNavStyle("gallery", ctx);
    const payload = JSON.parse(screen.getByTestId("style-toolkit-stub").textContent ?? "null");
    expect(payload).toEqual({ zoneLabel: "Gallery", otherZoneLabel: "Home", disabled: false });
  });

  it("passes navDetach: undefined when no activeZone is supplied (current EditorShell call site)", () => {
    renderNavStyle(undefined, { canDetach: () => true, detachedZone: () => null });
    expect(screen.getByTestId("style-toolkit-stub").textContent).toBe("null");
  });
});

describe("editor Container config — footer permission lock", () => {
  const basePermissions: Permissions = {
    drag: true,
    duplicate: true,
    delete: true,
    edit: true,
    insert: true,
  };
  type ResolvePermissionsFn = (
    data: { props: Record<string, unknown> },
    params: { permissions: Partial<Permissions> },
  ) => Partial<Permissions>;

  it.each([
    ["FooterSignaturePreset", FOOTER_SIGNATURE_PRESET],
    ["FooterDirectoryPreset", FOOTER_DIRECTORY_PRESET],
    ["FooterStatementPreset", FOOTER_STATEMENT_PRESET],
  ])("%s (editor) locks duplicate + drag, keeps delete, for its own preset props", (key, presetProps) => {
    const cfg = editorPuckConfig.components[key as keyof typeof editorPuckConfig.components] as unknown as {
      resolvePermissions?: ResolvePermissionsFn;
    };
    expect(cfg.resolvePermissions, `${key} must declare resolvePermissions`).toBeDefined();
    const result = cfg.resolvePermissions!({ props: presetProps }, { permissions: basePermissions });
    expect(result.duplicate).toBe(false);
    expect(result.drag).toBe(false);
    expect(result.delete).toBe(true);
  });

  it("the base Container type carries the same resolvePermissions and leaves an ordinary Container alone", () => {
    const cfg = editorPuckConfig.components.Container as unknown as { resolvePermissions?: ResolvePermissionsFn };
    expect(cfg.resolvePermissions, "Container must declare resolvePermissions").toBeDefined();
    const result = cfg.resolvePermissions!({ props: containerDefaultProps }, { permissions: basePermissions });
    expect(result).toBe(basePermissions);
  });
});

describe("Container resolveData vs the live anchor reconciler", () => {
  type ResolveDataFn = (data: {
    props: { id: string; content: Array<{ type: string; props: Record<string, unknown> }> };
  }) => { props: { content: Array<{ type: string; props: Record<string, unknown> }> } };

  it("agrees with the reconciler on a container-class-only slot (no setData ping-pong)", () => {
    // Puck's resolver and ContainerAnchorReconciler must produce identical
    // slots. They used to disagree and undid each other on every store tick,
    // spamming Puck's "setData is expensive" warning and thrashing canvas
    // layout on every selection.
    const resolveData = (
      editorPuckConfig.components.Container as unknown as { resolveData: ResolveDataFn }
    ).resolveData;
    const columns = { type: "Columns", props: { id: "cols" } };
    const anchor = { type: "ContainerAnchor", props: { id: "c1--anchor", height: 0 } };

    const resolved = resolveData({ props: { id: "c1", content: [columns, anchor] } });

    expect(resolved.props.content).toEqual([columns, anchor]);
  });
});
