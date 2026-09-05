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

import { resolveDrawerItemPreset } from "./EditorShell";
import { SECTION_PRESETS } from "@/lib/page-builder/blocks/sectionPresets";

// Demo-mode filtering itself (which component keys DEMO_HIDDEN_COMPONENT_KEYS
// hides, at both the group and manual level) is exercised against the
// rendered drawer tree in EditorShell.test.tsx — there is no longer a
// separate `categories`-shaped structure to filter in isolation (Puck 0.20's
// flat `categories` config was removed; see PresetBlocksDrawer).
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
