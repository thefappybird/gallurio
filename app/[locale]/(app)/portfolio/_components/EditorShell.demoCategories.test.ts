import { describe, it, expect, vi } from "vitest";

// EditorShell.tsx pulls in Puck + several Server Actions at module scope.
// Under vitest those actions transitively resolve authkit-nextjs, which
// breaks module resolution in this environment — mock them out (same
// minimal set EditorShell.test.tsx already uses) purely so the module loads;
// none of these mocks are exercised by the pure helpers under test here.
vi.mock("@measured/puck", () => ({
  createUsePuck: () => () => undefined,
  Puck: () => null,
}));
vi.mock("../_actions", () => ({
  dismissPortfolioGuideAction: vi.fn(),
  saveThemeAction: vi.fn(),
  deleteThemeAction: vi.fn(),
  updateThemeAction: vi.fn(),
  updatePortfolioSlugAction: vi.fn(),
  completeStoryPromptAction: vi.fn(),
}));
vi.mock("../_draftActions", () => ({
  createDraftAction: vi.fn(),
  updateDraftAction: vi.fn(),
  deleteDraftAction: vi.fn(),
  getDraftAction: vi.fn(),
  listDraftsAction: vi.fn(),
  publishDraftAction: vi.fn(),
  seedTemplateAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/storage/uploadAsset.client", () => ({ uploadAsset: vi.fn() }));
vi.mock("@/lib/actions/slug", () => ({
  checkSlugAvailabilityAction: vi.fn().mockResolvedValue({ available: true }),
}));

import { filterCategoriesForDemo, resolveDrawerItemPreset } from "./EditorShell";
import { SECTION_PRESETS, SECTION_PRESET_KEYS, COLLECTION_PRESET_KEYS } from "@/lib/page-builder/blocks/sectionPresets";
import { MANUAL_BLOCK_KEYS } from "@/lib/page-builder/blockCategories";

// Puck types `components` as a union of the registered component keys. The
// fixture builds them from the registry as plain strings, so cast once here
// rather than threading the union through the builder.
type DrawerCategories = Parameters<typeof filterCategoriesForDemo>[0];

function buildCategories(): DrawerCategories {
  const categories: Record<string, { components: string[] }> = {
    manual: { components: [...MANUAL_BLOCK_KEYS] },
  };
  const groups = new Set(SECTION_PRESET_KEYS.map((key) => SECTION_PRESETS[key].group));
  for (const group of groups) {
    categories[group] = {
      components: SECTION_PRESET_KEYS.filter((key) => SECTION_PRESETS[key].group === group),
    };
  }
  return categories as DrawerCategories;
}

describe("filterCategoriesForDemo", () => {
  it("removes every FeaturedWork preset variant from the featuredWork category", () => {
    const filtered = filterCategoriesForDemo(buildCategories(), true);
    for (const key of COLLECTION_PRESET_KEYS) {
      const group = SECTION_PRESETS[key].group;
      expect(filtered[group]?.components).not.toContain(key);
    }
  });

  it("removes FeaturedWork and CollectionCard from manual", () => {
    const filtered = filterCategoriesForDemo(buildCategories(), true);
    expect(filtered.manual?.components).not.toContain("FeaturedWork");
    expect(filtered.manual?.components).not.toContain("CollectionCard");
  });

  it("keeps every other preset key and manual block untouched in demo mode", () => {
    const filtered = filterCategoriesForDemo(buildCategories(), true);
    const hidden = new Set<string>([...COLLECTION_PRESET_KEYS, "FeaturedWork", "CollectionCard"]);
    for (const key of SECTION_PRESET_KEYS) {
      if (hidden.has(key)) continue;
      const group = SECTION_PRESETS[key].group;
      expect(filtered[group]?.components).toContain(key);
    }
    for (const key of MANUAL_BLOCK_KEYS) {
      if (hidden.has(key)) continue;
      expect(filtered.manual?.components).toContain(key);
    }
  });

  it("returns categories unchanged (same reference) outside demo mode", () => {
    const categories = buildCategories();
    expect(filterCategoriesForDemo(categories, false)).toBe(categories);
  });
});

describe("resolveDrawerItemPreset", () => {
  it("resolves a section preset entry by component name", () => {
    const preset = resolveDrawerItemPreset("HeroSplitPreset");
    expect(preset?.description).toBe(SECTION_PRESETS.HeroSplitPreset.description);
  });

  it("returns undefined for a manual block name", () => {
    expect(resolveDrawerItemPreset("FeaturedWork")).toBeUndefined();
    expect(resolveDrawerItemPreset("CollectionCard")).toBeUndefined();
  });
});
