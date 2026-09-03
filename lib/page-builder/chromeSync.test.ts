import { describe, it, expect } from "vitest";
import type { ComponentData, Data } from "@measured/puck";
import {
  findChrome,
  syncChrome,
  reanchorChrome,
  normalizeChrome,
  canDetach,
  rescueNestedChrome,
  type Zones,
  type IdFactory,
} from "./chromeSync";

function makeIdFactory(prefix: string): IdFactory {
  let n = 0;
  return () => `${prefix}-${n++}`;
}

function block(
  type: string,
  id: string,
  props: Record<string, unknown> = {},
): ComponentData {
  return { type, props: { id, ...props } } as ComponentData;
}

function navBlock(id: string, overrides: Record<string, unknown> = {}): ComponentData {
  return block("Navigation", id, {
    _chrome: "nav",
    detached: false,
    brandText: "Studio",
    content: [
      block("Image", `${id}-logo`, { src: "logo.png" }),
      block("Heading", `${id}-title`, { text: "Studio" }),
    ],
    ...overrides,
  });
}

function footerBlock(id: string, overrides: Record<string, unknown> = {}): ComponentData {
  return block("FooterSimple", id, {
    _chrome: "footer",
    detached: false,
    columns: 2,
    content: [block("Text", `${id}-copy`, { text: "(c) Studio" })],
    ...overrides,
  });
}

function zoneWith(content: ComponentData[]): Data {
  return { root: { props: {} }, content } as Data;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

function ids(content: ComponentData[]): string[] {
  const out: string[] = [];
  const walk = (list: ComponentData[]) => {
    for (const b of list) {
      out.push((b.props as { id: string }).id);
      for (const value of Object.values(b.props as Record<string, unknown>)) {
        if (Array.isArray(value) && value.every((v) => v && typeof v === "object" && "type" in v)) {
          walk(value as ComponentData[]);
        }
      }
    }
  };
  walk(content);
  return out;
}

describe("findChrome", () => {
  it("returns the block with matching _chrome marker", () => {
    const zone = zoneWith([block("Hero", "hero-1"), navBlock("nav-1")]);
    expect(findChrome(zone, "nav")).toEqual(navBlock("nav-1"));
  });

  it("returns null when no block matches", () => {
    const zone = zoneWith([block("Hero", "hero-1")]);
    expect(findChrome(zone, "footer")).toBeNull();
  });
});

describe("syncChrome", () => {
  it("mirrors config props and slot children home -> gallery", () => {
    const home = zoneWith([navBlock("home-nav", { brandText: "Home Brand" })]);
    const gallery = zoneWith([navBlock("gallery-nav", { brandText: "Gallery Brand" })]);
    const zones: Zones = { home, gallery };

    const result = syncChrome(zones, "home", "nav", makeIdFactory("gen"));
    const mirrored = findChrome(result.gallery, "nav")!;

    expect((mirrored.props as unknown as { brandText: string }).brandText).toBe("Home Brand");
    expect((mirrored.props as { id: string }).id).toBe("gallery-nav");
    const slot = (mirrored.props as unknown as { content: ComponentData[] }).content;
    expect(slot.map((b) => b.type)).toEqual(["Image", "Heading"]);
    expect((slot[1].props as unknown as { text: string }).text).toBe("Studio");
  });

  it("mirrors config props and slot children gallery -> home", () => {
    const home = zoneWith([navBlock("home-nav", { brandText: "Home Brand" })]);
    const gallery = zoneWith([navBlock("gallery-nav", { brandText: "Gallery Brand" })]);
    const zones: Zones = { home, gallery };

    const result = syncChrome(zones, "gallery", "nav", makeIdFactory("gen"));
    const mirrored = findChrome(result.home, "nav")!;

    expect((mirrored.props as unknown as { brandText: string }).brandText).toBe("Gallery Brand");
    expect((mirrored.props as { id: string }).id).toBe("home-nav");
  });

  it("removes a deleted slot child (logo) on the other zone after sync", () => {
    const homeNav = navBlock("home-nav");
    (homeNav.props as unknown as { content: ComponentData[] }).content = [
      block("Heading", "home-nav-title", { text: "Studio" }),
    ];
    const home = zoneWith([homeNav]);
    const gallery = zoneWith([navBlock("gallery-nav")]);
    const zones: Zones = { home, gallery };

    const result = syncChrome(zones, "home", "nav", makeIdFactory("gen"));
    const mirrored = findChrome(result.gallery, "nav")!;
    const slot = (mirrored.props as unknown as { content: ComponentData[] }).content;

    expect(slot.map((b) => b.type)).toEqual(["Heading"]);
  });

  it("keeps target's own id and gives mirrored slot children fresh ids colliding with nothing in the target tree", () => {
    const home = zoneWith([navBlock("home-nav")]);
    const gallery = zoneWith([block("Hero", "gallery-hero"), navBlock("gallery-nav")]);
    const zones: Zones = { home, gallery };

    const result = syncChrome(zones, "home", "nav", makeIdFactory("gen"));
    const mirrored = findChrome(result.gallery, "nav")!;

    expect((mirrored.props as { id: string }).id).toBe("gallery-nav");
    const slotIds = (mirrored.props as unknown as { content: ComponentData[] }).content.map(
      (b) => (b.props as { id: string }).id,
    );
    expect(slotIds).not.toContain("home-nav-logo");
    expect(slotIds).not.toContain("home-nav-title");

    const allIds = ids(result.gallery.content as ComponentData[]);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("gives fresh ids to nested slots inside slot children", () => {
    const homeNav = navBlock("home-nav");
    (homeNav.props as unknown as { content: ComponentData[] }).content = [
      block("Columns", "home-nav-cols", {
        content: [block("Text", "home-nav-cols-text", { text: "nested" })],
      }),
    ];
    const home = zoneWith([homeNav]);
    const gallery = zoneWith([navBlock("gallery-nav")]);
    const zones: Zones = { home, gallery };

    const result = syncChrome(zones, "home", "nav", makeIdFactory("gen"));
    const mirrored = findChrome(result.gallery, "nav")!;
    const [cols] = (mirrored.props as unknown as { content: ComponentData[] }).content;
    const nested = (cols.props as unknown as { content: ComponentData[] }).content;

    expect(cols.props.id).not.toBe("home-nav-cols");
    expect(nested[0].props.id).not.toBe("home-nav-cols-text");
    expect(nested[0].type).toBe("Text");
  });

  it("is a no-op when the source zone's chrome is detached", () => {
    const home = zoneWith([navBlock("home-nav", { detached: true, brandText: "Changed" })]);
    const gallery = zoneWith([navBlock("gallery-nav", { brandText: "Original" })]);
    const zones: Zones = { home, gallery };

    const result = syncChrome(zones, "home", "nav");
    expect(result).toBe(zones);
  });

  it("is a no-op when the target zone's chrome is detached", () => {
    const home = zoneWith([navBlock("home-nav", { brandText: "Changed" })]);
    const gallery = zoneWith([navBlock("gallery-nav", { detached: true, brandText: "Kept" })]);
    const zones: Zones = { home, gallery };

    const result = syncChrome(zones, "home", "nav");
    expect(result).toBe(zones);
  });

  it("inserts nav at index 0 when the target zone has no chrome", () => {
    const home = zoneWith([navBlock("home-nav")]);
    const gallery = zoneWith([block("Hero", "gallery-hero")]);
    const zones: Zones = { home, gallery };

    const result = syncChrome(zones, "home", "nav", makeIdFactory("gen"));
    expect(result.gallery.content?.[0].type).toBe("Navigation");
    expect(result.gallery.content?.[1].type).toBe("Hero");
  });

  it("appends footer when the target zone has no chrome", () => {
    const home = zoneWith([footerBlock("home-footer")]);
    const gallery = zoneWith([block("Hero", "gallery-hero")]);
    const zones: Zones = { home, gallery };

    const result = syncChrome(zones, "home", "footer", makeIdFactory("gen"));
    const content = result.gallery.content as ComponentData[];
    expect(content[content.length - 1].type).toBe("FooterSimple");
    expect(content[0].type).toBe("Hero");
  });

  it("returns unchanged when the source zone has no chrome of that kind", () => {
    const home = zoneWith([block("Hero", "home-hero")]);
    const gallery = zoneWith([navBlock("gallery-nav")]);
    const zones: Zones = { home, gallery };

    const result = syncChrome(zones, "home", "nav");
    expect(result).toBe(zones);
  });

  it("mirrors a deletion: removes the other zone's footer when the source had one and now does not", () => {
    const previousHome = zoneWith([block("Hero", "home-hero"), footerBlock("home-footer")]);
    const home = zoneWith([block("Hero", "home-hero")]);
    const gallery = zoneWith([block("Hero", "gallery-hero"), footerBlock("gallery-footer")]);
    const zones: Zones = { home, gallery };

    const result = syncChrome(zones, "home", "footer", makeIdFactory("gen"), previousHome);
    expect(findChrome(result.gallery, "footer")).toBeNull();
    expect(result.gallery.content?.map((b) => b.type)).toEqual(["Hero"]);
  });

  it("does not mutate frozen inputs", () => {
    const home = deepFreeze(zoneWith([navBlock("home-nav", { brandText: "Frozen" })]));
    const gallery = deepFreeze(zoneWith([navBlock("gallery-nav")]));
    const zones: Zones = deepFreeze({ home, gallery });

    expect(() => syncChrome(zones, "home", "nav", makeIdFactory("gen"))).not.toThrow();
  });
});

describe("reanchorChrome", () => {
  it("overwrites the detached zone from the anchor and clears detached; anchor stays deep-equal", () => {
    const anchorGallery = navBlock("gallery-nav", { brandText: "Anchor Brand" });
    const home = zoneWith([navBlock("home-nav", { detached: true, brandText: "Divergent" })]);
    const gallery = zoneWith([anchorGallery]);
    const zones: Zones = { home, gallery };
    const galleryBefore = JSON.parse(JSON.stringify(gallery));

    const result = reanchorChrome(zones, "home", "nav", makeIdFactory("gen"));
    const homeNav = findChrome(result.home, "nav")!;

    expect((homeNav.props as unknown as { brandText: string }).brandText).toBe("Anchor Brand");
    expect((homeNav.props as { id: string }).id).toBe("home-nav");
    expect((homeNav.props as unknown as { detached: boolean }).detached).toBe(false);
    expect(JSON.parse(JSON.stringify(result.gallery))).toEqual(galleryBefore);
  });

  it("is a no-op when the named zone is not actually detached", () => {
    const home = zoneWith([navBlock("home-nav", { detached: false })]);
    const gallery = zoneWith([navBlock("gallery-nav")]);
    const zones: Zones = { home, gallery };

    const result = reanchorChrome(zones, "home", "nav");
    expect(result).toBe(zones);
  });

  it("does not mutate frozen inputs", () => {
    const home = deepFreeze(zoneWith([navBlock("home-nav", { detached: true })]));
    const gallery = deepFreeze(zoneWith([navBlock("gallery-nav")]));
    const zones: Zones = deepFreeze({ home, gallery });

    expect(() => reanchorChrome(zones, "home", "nav", makeIdFactory("gen"))).not.toThrow();
  });
});

describe("canDetach", () => {
  it("refuses the second zone once one holds detached (home first)", () => {
    const zones: Zones = {
      home: zoneWith([navBlock("home-nav", { detached: true })]),
      gallery: zoneWith([navBlock("gallery-nav")]),
    };
    expect(canDetach(zones, "gallery", "nav")).toBe(false);
    expect(canDetach(zones, "home", "nav")).toBe(true);
  });

  it("refuses the second zone once one holds detached (gallery first)", () => {
    const zones: Zones = {
      home: zoneWith([navBlock("home-nav")]),
      gallery: zoneWith([navBlock("gallery-nav", { detached: true })]),
    };
    expect(canDetach(zones, "home", "nav")).toBe(false);
    expect(canDetach(zones, "gallery", "nav")).toBe(true);
  });
});

describe("normalizeChrome", () => {
  it("moves a displaced nav back to index 0, preserving the rest of the order", () => {
    const zone = zoneWith([block("Hero", "hero-1"), navBlock("nav-1"), block("Text", "text-1")]);
    const result = normalizeChrome(zone);
    expect(result.content?.map((b) => b.type)).toEqual(["Navigation", "Hero", "Text"]);
  });

  it("collapses duplicate navs to the first, dropping the extras", () => {
    const zone = zoneWith([
      navBlock("nav-1", { brandText: "First" }),
      block("Hero", "hero-1"),
      navBlock("nav-2", { brandText: "Second" }),
    ]);
    const result = normalizeChrome(zone);
    const navs = (result.content as ComponentData[]).filter(
      (b) => (b.props as { _chrome?: string })._chrome === "nav",
    );
    expect(navs).toHaveLength(1);
    expect((navs[0].props as unknown as { brandText: string }).brandText).toBe("First");
    expect(result.content?.map((b) => b.type)).toEqual(["Navigation", "Hero"]);
  });

  it("leaves a zone with no nav unchanged", () => {
    const zone = zoneWith([block("Hero", "hero-1"), footerBlock("footer-1")]);
    const result = normalizeChrome(zone);
    expect(result).toBe(zone);
  });

  it("returns the same reference when already normalized", () => {
    const zone = zoneWith([navBlock("nav-1"), block("Hero", "hero-1")]);
    const result = normalizeChrome(zone);
    expect(result).toBe(zone);
  });

  it("moves a displaced footer to the last index, preserving the rest of the order", () => {
    const zone = zoneWith([
      navBlock("nav-1"),
      footerBlock("footer-1"),
      block("Text", "text-1"),
    ]);
    const result = normalizeChrome(zone);
    expect(result.content?.map((b) => b.type)).toEqual(["Navigation", "Text", "FooterSimple"]);
  });

  it("collapses duplicate footers to the first, dropping the extras, and pins the survivor last", () => {
    const zone = zoneWith([
      block("Hero", "hero-1"),
      navBlock("nav-1"),
      footerBlock("footer-1", { columns: 1 }),
      footerBlock("footer-2", { columns: 2 }),
    ]);
    const result = normalizeChrome(zone);
    const footers = (result.content as ComponentData[]).filter(
      (b) => (b.props as { _chrome?: string })._chrome === "footer",
    );
    expect(footers).toHaveLength(1);
    expect((footers[0].props as unknown as { columns: number }).columns).toBe(1);
    expect(result.content?.map((b) => b.type)).toEqual(["Navigation", "Hero", "FooterSimple"]);
  });

  it("leaves a zone with no footer unchanged on that axis (only enforces nav)", () => {
    const zone = zoneWith([navBlock("nav-1"), block("Hero", "hero-1")]);
    const result = normalizeChrome(zone);
    expect(result).toBe(zone);
  });

  it("enforces nav-at-0 and footer-at-last simultaneously in one pass", () => {
    const zone = zoneWith([
      footerBlock("footer-1"),
      block("Hero", "hero-1"),
      navBlock("nav-1"),
    ]);
    const result = normalizeChrome(zone);
    expect(result.content?.map((b) => b.type)).toEqual(["Navigation", "Hero", "FooterSimple"]);
  });

  it("is idempotent: running normalizeChrome twice yields a deep-equal, reference-stable result", () => {
    const zone = zoneWith([
      footerBlock("footer-1"),
      block("Hero", "hero-1"),
      navBlock("nav-1"),
      footerBlock("footer-2"),
    ]);
    const once = normalizeChrome(zone);
    const twice = normalizeChrome(once);
    expect(twice).toBe(once);
    expect(twice).toEqual(once);
  });

  it("a zone with only nav and footer normalizes to [nav, footer] and is a stable fixed point", () => {
    const zone = zoneWith([footerBlock("footer-1"), navBlock("nav-1")]);
    const once = normalizeChrome(zone);
    expect(once.content?.map((b) => b.type)).toEqual(["Navigation", "FooterSimple"]);
    expect(normalizeChrome(once)).toBe(once);
  });

  it("does not mutate frozen input", () => {
    const zone = deepFreeze(
      zoneWith([block("Hero", "hero-1"), navBlock("nav-1"), navBlock("nav-2"), footerBlock("footer-1"), footerBlock("footer-2")]),
    );
    expect(() => normalizeChrome(zone)).not.toThrow();
  });
});

describe("rescueNestedChrome", () => {
  it("promotes a footer dropped inside a Columns column's slot back to the zone's top level", () => {
    // Mirrors the real dnd-kit trap: a drop aimed at "the bottom of the
    // page" lands on an existing block's own nested slot (a Columns column)
    // instead of the zone's own end-of-list dropzone.
    const nestedFooter = footerBlock("footer-1");
    const zone = zoneWith([
      navBlock("nav-1"),
      block("HeroPreset", "hero-1"),
      block("Columns", "cols-1", {
        content: [block("Container", "col-1", { content: [block("Text", "t-1"), nestedFooter] })],
      }),
    ]);

    const result = rescueNestedChrome(zone, "footer");

    const topLevelKinds = (result.content as ComponentData[]).map(
      (b) => (b.props as { _chrome?: string })._chrome,
    );
    expect(topLevelKinds).toContain("footer");

    const cols = result.content?.find((b) => b.type === "Columns");
    const col = ((cols?.props as unknown as { content: ComponentData[] }).content)[0];
    const colContentTypes = ((col.props as unknown as { content: ComponentData[] }).content).map((b) => b.type);
    expect(colContentTypes).not.toContain("FooterSimple");
  });

  it("promotes a nested nav the same way", () => {
    const zone = zoneWith([
      block("HeroPreset", "hero-1"),
      block("Container", "col-1", { content: [navBlock("nav-1")] }),
    ]);
    const result = rescueNestedChrome(zone, "nav");
    const kinds = (result.content as ComponentData[]).map((b) => (b.props as { _chrome?: string })._chrome);
    expect(kinds).toContain("nav");
  });

  it("is a no-op (same reference) when no block of that kind is nested anywhere", () => {
    const zone = zoneWith([
      navBlock("nav-1"),
      block("Columns", "cols-1", { content: [block("Container", "col-1", { content: [block("Text", "t-1")] })] }),
    ]);
    expect(rescueNestedChrome(zone, "footer")).toBe(zone);
  });

  it("is a no-op when the chrome block is already at the top level, not nested", () => {
    const zone = zoneWith([navBlock("nav-1"), footerBlock("footer-1")]);
    expect(rescueNestedChrome(zone, "footer")).toBe(zone);
  });

  it("does not mutate frozen input", () => {
    const zone = deepFreeze(
      zoneWith([
        navBlock("nav-1"),
        block("Columns", "cols-1", {
          content: [block("Container", "col-1", { content: [footerBlock("footer-1")] })],
        }),
      ]),
    );
    expect(() => rescueNestedChrome(zone, "footer")).not.toThrow();
  });
});

describe("syncChrome - footer mirror into a chrome-only zone", () => {
  it("mirrors a footer into a zone whose PageBody may still be empty", () => {
    const zones: Zones = {
      home: zoneWith([navBlock("nav-home"), block("Heading", "h1"), footerBlock("footer-home")]),
      gallery: zoneWith([navBlock("nav-gallery")]),
    };

    const next = syncChrome(zones, "home", "footer", makeIdFactory("new"));

    expect(findChrome(next.gallery, "footer")).not.toBeNull();
  });
});
