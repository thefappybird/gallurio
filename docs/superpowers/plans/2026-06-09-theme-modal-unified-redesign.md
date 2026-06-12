# Theme Modal — Unified Preset/Saved Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify built-in preset themes and user saved themes into one searchable, paginated 3×3 grid of identical `[thumbnail | title]` tiles where clicking any tile applies a full brand-kit snapshot — fixing the bug where preset clicks don't update colors/fonts.

**Architecture:** Each preset gains a concrete `PortfolioBrandKit` definition (it currently carries none). A new `ThemeGrid` component composes pure helpers (`buildThemeTiles`, `filterThemeTiles`, `paginate`, `brandKitsEqualForSelection`), a presentational `ThemeTile`, and a `SaveThemePopover`. `BrandKitPicker` drops its old preset fieldset + saved-themes section and mounts `ThemeGrid` above the unchanged font/color editors. Preset clicks route through the same `onChange(fullBrandKit)` path saved themes already use, so the preview mechanism (`resolveBrandKit` → CSS vars) is reused unchanged.

**Tech Stack:** Next.js 16, React 19, next-intl, Tailwind v4, Vitest + @testing-library/react, lucide-react, shadcn `Popover`/`Button`.

**Spec:** `docs/superpowers/specs/2026-06-09-theme-modal-unified-redesign-design.md`

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `lib/page-builder/brandKitPicker/themePresetDefinitions.ts` | `THEME_PRESET_DEFINITIONS` — full brand kit per built-in preset | Create |
| `lib/page-builder/brandKitPicker/themeTiles.ts` | Pure helpers: build/filter/paginate tiles, selection equality | Create |
| `lib/page-builder/brandKitPicker/ThemeTile.tsx` | Presentational `[thumbnail \| title]` tile (+ optional delete) | Create |
| `lib/page-builder/brandKitPicker/SaveThemePopover.tsx` | Save-as icon button + name popover | Create |
| `lib/page-builder/brandKitPicker/ThemeGrid.tsx` | Toolbar (search + save) + grid + pagination | Create |
| `lib/page-builder/brandKitPicker/BrandKitPicker.tsx` | Mount `ThemeGrid`; keep font/color editors | Modify |
| `lib/page-builder/brandKitPicker/themePresetSwatches.ts` | Remove `THEME_PRESET_SWATCHES` (keep `FONT_PAIR_SAMPLES` if still used) | Modify/Delete |
| `messages/{en,fil,ms,id}.json` | New `app.pageBuilder.brandKit` keys | Modify |
| `*.test.tsx` / `*.test.ts` colocated | Tests per unit | Create/Modify |

Note: there are no radius/button-style controls in `BrandKitPicker` today; do not add any. Only `themePreset`, fonts, and colors are edited here.

---

## Task 1: Preset definitions (concrete brand kits)

**Files:**
- Create: `lib/page-builder/brandKitPicker/themePresetDefinitions.ts`
- Test: `lib/page-builder/brandKitPicker/themePresetDefinitions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/page-builder/brandKitPicker/themePresetDefinitions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { THEME_PRESET_DEFINITIONS } from "./themePresetDefinitions";
import {
  BRAND_KIT_THEME_PRESETS,
  BRAND_KIT_RADII,
  BRAND_KIT_BUTTON_STYLES,
} from "@/lib/page-builder/types";
import { PORTFOLIO_FONT_KEYS } from "@/lib/page-builder/fonts";

const HEX_RE = /^#[0-9a-f]{6}$/i;
const COLOR_FIELDS = [
  "primaryColor",
  "secondaryColor",
  "accentColor",
  "backgroundColor",
  "foregroundColor",
] as const;

describe("THEME_PRESET_DEFINITIONS", () => {
  it("defines exactly the built-in presets", () => {
    expect(Object.keys(THEME_PRESET_DEFINITIONS).sort()).toEqual(
      [...BRAND_KIT_THEME_PRESETS].sort()
    );
  });

  for (const preset of BRAND_KIT_THEME_PRESETS) {
    describe(preset, () => {
      const def = THEME_PRESET_DEFINITIONS[preset];

      it("has a non-empty name and self-consistent themePreset", () => {
        expect(def.name.length).toBeGreaterThan(0);
        expect(def.brandKit.themePreset).toBe(preset);
      });

      it("has 5 valid hex colors", () => {
        for (const field of COLOR_FIELDS) {
          expect(def.brandKit[field]).toMatch(HEX_RE);
        }
      });

      it("uses distinct primary and accent (legible 2-swatch thumbnail)", () => {
        expect(def.brandKit.primaryColor.toLowerCase()).not.toBe(
          def.brandKit.accentColor.toLowerCase()
        );
      });

      it("uses valid font keys, radius, and button style", () => {
        expect(PORTFOLIO_FONT_KEYS).toContain(def.brandKit.headingFont);
        expect(PORTFOLIO_FONT_KEYS).toContain(def.brandKit.bodyFont);
        expect(BRAND_KIT_RADII).toContain(def.brandKit.radius);
        expect(BRAND_KIT_BUTTON_STYLES).toContain(def.brandKit.buttonStyle);
      });
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run themePresetDefinitions`
Expected: FAIL — cannot find module `./themePresetDefinitions`.

- [ ] **Step 3: Write the implementation**

Create `lib/page-builder/brandKitPicker/themePresetDefinitions.ts`:

```ts
import {
  type BrandKitThemePreset,
  type PortfolioBrandKit,
} from "@/lib/page-builder/types";

/**
 * Concrete brand kit per built-in preset. Selecting a preset applies this full
 * snapshot (all 5 colors + both fonts + radius + button style) via the same
 * `onChange(brandKit)` path as a saved theme, so the preview updates instantly.
 * `themePreset` is retained on each kit for back-compat/metadata only — the
 * `pf-theme-*` class it produces defines no CSS.
 */
export const THEME_PRESET_DEFINITIONS: Record<
  BrandKitThemePreset,
  { name: string; brandKit: PortfolioBrandKit }
> = {
  minimal: {
    name: "Minimal",
    brandKit: {
      themePreset: "minimal",
      fontPair: "merriweather-only",
      headingFont: "merriweather",
      bodyFont: "merriweather",
      primaryColor: "#111111",
      secondaryColor: "#f5f5f5",
      accentColor: "#2f5d56",
      backgroundColor: "#ffffff",
      foregroundColor: "#111111",
      radius: "sharp",
      buttonStyle: "solid",
    },
  },
  editorial: {
    name: "Editorial",
    brandKit: {
      themePreset: "editorial",
      fontPair: "playfair-inter",
      headingFont: "playfair",
      bodyFont: "inter",
      primaryColor: "#161514",
      secondaryColor: "#ece5db",
      accentColor: "#7e6a52",
      backgroundColor: "#fbf9f6",
      foregroundColor: "#161514",
      radius: "sharp",
      buttonStyle: "solid",
    },
  },
  luxury: {
    name: "Luxury",
    brandKit: {
      themePreset: "luxury",
      fontPair: "cormorant-montserrat",
      headingFont: "cormorant",
      bodyFont: "montserrat",
      primaryColor: "#f3efe9",
      secondaryColor: "#1a1a1a",
      accentColor: "#c9a86a",
      backgroundColor: "#0e0e0e",
      foregroundColor: "#f3efe9",
      radius: "sharp",
      buttonStyle: "outline",
    },
  },
  bold: {
    name: "Bold",
    brandKit: {
      themePreset: "bold",
      fontPair: "playfair-inter",
      headingFont: "montserrat",
      bodyFont: "inter",
      primaryColor: "#101010",
      secondaryColor: "#f0f0f0",
      accentColor: "#1f3a5f",
      backgroundColor: "#ffffff",
      foregroundColor: "#101010",
      radius: "sharp",
      buttonStyle: "solid",
    },
  },
  romantic: {
    name: "Romantic",
    brandKit: {
      themePreset: "romantic",
      fontPair: "cormorant-montserrat",
      headingFont: "cormorant",
      bodyFont: "dm-sans",
      primaryColor: "#3a2b2b",
      secondaryColor: "#f3e6e2",
      accentColor: "#9c6b6b",
      backgroundColor: "#fcf6f4",
      foregroundColor: "#3a2b2b",
      radius: "subtle",
      buttonStyle: "soft",
    },
  },
  modern: {
    name: "Modern",
    brandKit: {
      themePreset: "modern",
      fontPair: "dm-serif-dm-sans",
      headingFont: "dm-serif",
      bodyFont: "dm-sans",
      primaryColor: "#1a1a1a",
      secondaryColor: "#ebebe8",
      accentColor: "#2f5d56",
      backgroundColor: "#f7f7f5",
      foregroundColor: "#1a1a1a",
      radius: "subtle",
      buttonStyle: "solid",
    },
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run themePresetDefinitions`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/brandKitPicker/themePresetDefinitions.ts lib/page-builder/brandKitPicker/themePresetDefinitions.test.ts
git commit -m "feat(portfolio): concrete brand kit per theme preset

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Pure tile helpers

**Files:**
- Create: `lib/page-builder/brandKitPicker/themeTiles.ts`
- Test: `lib/page-builder/brandKitPicker/themeTiles.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/page-builder/brandKitPicker/themeTiles.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  buildThemeTiles,
  filterThemeTiles,
  paginate,
  brandKitsEqualForSelection,
  THEMES_PER_PAGE,
} from "./themeTiles";
import { THEME_PRESET_DEFINITIONS } from "./themePresetDefinitions";
import { BRAND_KIT_THEME_PRESETS, DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import type { PortfolioSavedTheme } from "@/lib/page-builder/types";

const savedThemes: PortfolioSavedTheme[] = [
  { id: "a", name: "My Wedding", brandKit: { ...DEFAULT_BRAND_KIT, accentColor: "#abcabc" } },
  { id: "b", name: "Studio Dark", brandKit: { ...DEFAULT_BRAND_KIT, backgroundColor: "#000000" } },
];

const presetName = (id: (typeof BRAND_KIT_THEME_PRESETS)[number]) =>
  THEME_PRESET_DEFINITIONS[id].name;

describe("buildThemeTiles", () => {
  it("lists presets first, then saved themes", () => {
    const tiles = buildThemeTiles({ presetName, savedThemes });
    expect(tiles).toHaveLength(BRAND_KIT_THEME_PRESETS.length + savedThemes.length);
    expect(tiles.slice(0, BRAND_KIT_THEME_PRESETS.length).every((t) => !t.savedThemeId)).toBe(true);
    expect(tiles[0].name).toBe("Minimal");
    expect(tiles[0].key).toBe("preset:minimal");
  });

  it("marks saved tiles with their id and raw name", () => {
    const tiles = buildThemeTiles({ presetName, savedThemes });
    const saved = tiles.find((t) => t.savedThemeId === "a");
    expect(saved?.name).toBe("My Wedding");
    expect(saved?.key).toBe("saved:a");
    expect(saved?.brandKit.accentColor).toBe("#abcabc");
  });
});

describe("filterThemeTiles", () => {
  const tiles = buildThemeTiles({ presetName, savedThemes });
  it("returns all tiles for an empty query", () => {
    expect(filterThemeTiles(tiles, "  ")).toHaveLength(tiles.length);
  });
  it("matches by name, case-insensitively", () => {
    const result = filterThemeTiles(tiles, "wEdd");
    expect(result.map((t) => t.name)).toEqual(["My Wedding"]);
  });
  it("returns empty when nothing matches", () => {
    expect(filterThemeTiles(tiles, "zzz")).toEqual([]);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 14 }, (_, i) => i);
  it("returns the first page of THEMES_PER_PAGE items", () => {
    const { pageItems, pageCount, page } = paginate(items, 0);
    expect(THEMES_PER_PAGE).toBe(9);
    expect(pageItems).toHaveLength(9);
    expect(pageCount).toBe(2);
    expect(page).toBe(0);
  });
  it("returns the remainder on the last page", () => {
    expect(paginate(items, 1).pageItems).toHaveLength(5);
  });
  it("clamps an out-of-range page", () => {
    const { page, pageItems } = paginate(items, 9);
    expect(page).toBe(1);
    expect(pageItems).toHaveLength(5);
  });
  it("always reports at least one page when empty", () => {
    expect(paginate([], 0).pageCount).toBe(1);
  });
});

describe("brandKitsEqualForSelection", () => {
  it("is true for identical styling fields", () => {
    expect(brandKitsEqualForSelection(DEFAULT_BRAND_KIT, { ...DEFAULT_BRAND_KIT })).toBe(true);
  });
  it("is false when a color differs", () => {
    expect(
      brandKitsEqualForSelection(DEFAULT_BRAND_KIT, { ...DEFAULT_BRAND_KIT, accentColor: "#000000" })
    ).toBe(false);
  });
  it("normalizes missing fonts via the legacy pair", () => {
    const legacy = { ...DEFAULT_BRAND_KIT, headingFont: undefined, bodyFont: undefined };
    expect(brandKitsEqualForSelection(legacy, DEFAULT_BRAND_KIT)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run themeTiles`
Expected: FAIL — cannot find module `./themeTiles`.

- [ ] **Step 3: Write the implementation**

Create `lib/page-builder/brandKitPicker/themeTiles.ts`:

```ts
import {
  BRAND_KIT_THEME_PRESETS,
  type BrandKitThemePreset,
  type PortfolioBrandKit,
  type PortfolioSavedTheme,
} from "@/lib/page-builder/types";
import { legacyFontPairToFonts } from "@/lib/page-builder/fonts";
import { THEME_PRESET_DEFINITIONS } from "./themePresetDefinitions";

/** Max tiles per page (3×3). */
export const THEMES_PER_PAGE = 9;

export type ThemeTileModel = {
  /** Stable React key + identity, e.g. "preset:minimal" or "saved:<id>". */
  key: string;
  /** Display title — already localized for presets, raw name for saved themes. */
  name: string;
  /** Full brand kit applied on click. */
  brandKit: PortfolioBrandKit;
  /** Present (and deletable) for saved themes; undefined for built-in presets. */
  savedThemeId?: string;
};

/** Built-in presets first, saved themes after, in one flat list. */
export function buildThemeTiles(opts: {
  presetName: (id: BrandKitThemePreset) => string;
  savedThemes: PortfolioSavedTheme[];
}): ThemeTileModel[] {
  const presetTiles: ThemeTileModel[] = BRAND_KIT_THEME_PRESETS.map((id) => ({
    key: `preset:${id}`,
    name: opts.presetName(id),
    brandKit: THEME_PRESET_DEFINITIONS[id].brandKit,
  }));
  const savedTiles: ThemeTileModel[] = opts.savedThemes.map((theme) => ({
    key: `saved:${theme.id}`,
    name: theme.name,
    brandKit: theme.brandKit,
    savedThemeId: theme.id,
  }));
  return [...presetTiles, ...savedTiles];
}

/** Case-insensitive filter by tile name. Empty/whitespace query returns all. */
export function filterThemeTiles(tiles: ThemeTileModel[], query: string): ThemeTileModel[] {
  const q = query.trim().toLowerCase();
  if (!q) return tiles;
  return tiles.filter((tile) => tile.name.toLowerCase().includes(q));
}

/** Slice into a clamped page of `perPage` items; reports the resolved page. */
export function paginate<T>(
  items: T[],
  page: number,
  perPage: number = THEMES_PER_PAGE
): { pageItems: T[]; pageCount: number; page: number } {
  const pageCount = Math.max(1, Math.ceil(items.length / perPage));
  const safePage = Math.min(Math.max(0, page), pageCount - 1);
  const start = safePage * perPage;
  return { pageItems: items.slice(start, start + perPage), pageCount, page: safePage };
}

const SELECTION_COLOR_FIELDS = [
  "primaryColor",
  "secondaryColor",
  "accentColor",
  "backgroundColor",
  "foregroundColor",
] as const;

function normalizedFonts(bk: PortfolioBrandKit): { headingFont: string; bodyFont: string } {
  const legacy = legacyFontPairToFonts(bk.fontPair);
  return {
    headingFont: bk.headingFont ?? legacy.headingFont,
    bodyFont: bk.bodyFont ?? legacy.bodyFont,
  };
}

/**
 * True when two kits would render identically: same 5 colors, resolved fonts,
 * radius, and button style. `themePreset` (a label only) is ignored so a saved
 * theme cloned from a preset still matches.
 */
export function brandKitsEqualForSelection(a: PortfolioBrandKit, b: PortfolioBrandKit): boolean {
  for (const field of SELECTION_COLOR_FIELDS) {
    if (a[field].toLowerCase() !== b[field].toLowerCase()) return false;
  }
  const fa = normalizedFonts(a);
  const fb = normalizedFonts(b);
  return (
    fa.headingFont === fb.headingFont &&
    fa.bodyFont === fb.bodyFont &&
    a.radius === b.radius &&
    a.buttonStyle === b.buttonStyle
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run themeTiles`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/brandKitPicker/themeTiles.ts lib/page-builder/brandKitPicker/themeTiles.test.ts
git commit -m "feat(portfolio): pure helpers for unified theme tiles

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: ThemeTile component

**Files:**
- Create: `lib/page-builder/brandKitPicker/ThemeTile.tsx`
- Test: `lib/page-builder/brandKitPicker/ThemeTile.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `lib/page-builder/brandKitPicker/ThemeTile.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeTile } from "./ThemeTile";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import type { ThemeTileModel } from "./themeTiles";

const tile: ThemeTileModel = {
  key: "saved:a",
  name: "My Wedding",
  brandKit: { ...DEFAULT_BRAND_KIT, primaryColor: "#112233", accentColor: "#445566" },
  savedThemeId: "a",
};

function renderTile(over: Partial<Parameters<typeof ThemeTile>[0]> = {}) {
  const onApply = vi.fn();
  const onDelete = vi.fn();
  render(
    <ThemeTile
      tile={tile}
      selected={false}
      applyLabel={`Apply theme: ${tile.name}`}
      deleteLabel={`Delete theme: ${tile.name}`}
      onApply={onApply}
      onDelete={onDelete}
      {...over}
    />
  );
  return { onApply, onDelete };
}

describe("ThemeTile", () => {
  it("renders the title and two color swatches (primary, accent)", () => {
    renderTile();
    expect(screen.getByText("My Wedding")).toBeInTheDocument();
    const apply = screen.getByRole("button", { name: "Apply theme: My Wedding" });
    const swatches = apply.querySelectorAll("[data-swatch]");
    expect(swatches).toHaveLength(2);
    expect((swatches[0] as HTMLElement).style.background).toBe("rgb(17, 34, 51)"); // #112233
    expect((swatches[1] as HTMLElement).style.background).toBe("rgb(68, 85, 102)"); // #445566
  });

  it("calls onApply when the tile is clicked", () => {
    const { onApply } = renderTile();
    fireEvent.click(screen.getByRole("button", { name: "Apply theme: My Wedding" }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("reflects the selected state via aria-pressed", () => {
    renderTile({ selected: true });
    expect(screen.getByRole("button", { name: "Apply theme: My Wedding" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("shows a delete control that calls onDelete", () => {
    const { onDelete } = renderTile();
    fireEvent.click(screen.getByRole("button", { name: "Delete theme: My Wedding" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("omits the delete control when no deleteLabel is given (presets)", () => {
    renderTile({ deleteLabel: undefined, onDelete: undefined });
    expect(screen.queryByRole("button", { name: /Delete theme/ })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run ThemeTile`
Expected: FAIL — cannot find module `./ThemeTile`.

- [ ] **Step 3: Write the implementation**

Create `lib/page-builder/brandKitPicker/ThemeTile.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import { Trash2Icon, Loader2Icon } from "lucide-react";
import type { ThemeTileModel } from "./themeTiles";

type Props = {
  tile: ThemeTileModel;
  selected: boolean;
  /** Localized accessible label for the apply button, e.g. "Apply theme: X". */
  applyLabel: string;
  /** Localized label for the delete button; presence enables deletion. */
  deleteLabel?: string;
  deleting?: boolean;
  onApply: () => void;
  onDelete?: () => void;
};

/**
 * One unified theme tile: `[thumbnail | title]`. The thumbnail shows two
 * swatches — primary (left) and accent (right). Apply and delete are sibling
 * buttons (never nested) for valid semantics.
 */
export function ThemeTile({
  tile,
  selected,
  applyLabel,
  deleteLabel,
  deleting = false,
  onApply,
  onDelete,
}: Props) {
  return (
    <div
      className={cn(
        "flex items-stretch border transition-colors",
        selected ? "border-foreground" : "border-border"
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        aria-label={applyLabel}
        onClick={onApply}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 p-2 text-left text-sm transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span className="flex size-7 shrink-0 overflow-hidden border border-border" aria-hidden>
          <span
            data-swatch="primary"
            className="h-full w-1/2"
            style={{ background: tile.brandKit.primaryColor }}
          />
          <span
            data-swatch="accent"
            className="h-full w-1/2"
            style={{ background: tile.brandKit.accentColor }}
          />
        </span>
        <span className="min-w-0 truncate" title={tile.name}>
          {tile.name}
        </span>
      </button>
      {deleteLabel && onDelete && (
        <button
          type="button"
          aria-label={deleteLabel}
          onClick={onDelete}
          disabled={deleting}
          className="inline-flex w-8 shrink-0 items-center justify-center border-l border-border text-muted-foreground transition-colors hover:text-destructive focus-visible:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        >
          {deleting ? (
            <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Trash2Icon className="size-3.5" aria-hidden />
          )}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run ThemeTile`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/brandKitPicker/ThemeTile.tsx lib/page-builder/brandKitPicker/ThemeTile.test.tsx
git commit -m "feat(portfolio): unified theme tile component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: SaveThemePopover

**Files:**
- Create: `lib/page-builder/brandKitPicker/SaveThemePopover.tsx`
- Test: `lib/page-builder/brandKitPicker/SaveThemePopover.test.tsx`

This task adds locale keys it consumes; they are formally added in Task 7. To keep this task green in isolation, the test injects an `en`-shaped messages object via `renderWithProviders` that already includes the new keys (Task 7 makes them permanent in the real files).

- [ ] **Step 1: Write the failing test**

Create `lib/page-builder/brandKitPicker/SaveThemePopover.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders, enMessages } from "@/test-utils/render";
import { SaveThemePopover } from "./SaveThemePopover";

// Ensure the keys this component reads exist for the test regardless of Task 7 ordering.
const messages = {
  ...enMessages,
  app: {
    ...enMessages.app,
    pageBuilder: {
      ...enMessages.app.pageBuilder,
      brandKit: {
        ...enMessages.app.pageBuilder.brandKit,
        saveCurrentAsTheme: "Save current as theme",
        themeNamePlaceholder: "Theme name",
        saveAction: "Save",
        enterThemeName: "Enter a name for this theme.",
        nameTooLong: "Theme name must be 60 characters or fewer.",
        saveThemeError: "Could not save theme. Please try again.",
        themeLimitReached: "You've reached the maximum of {max} saved themes.",
      },
    },
  },
};

function setup(over: Partial<Parameters<typeof SaveThemePopover>[0]> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  renderWithProviders(<SaveThemePopover onSave={onSave} atLimit={false} {...over} />, {
    messages,
  });
  return { onSave };
}

describe("SaveThemePopover", () => {
  it("exposes an accessible save trigger", () => {
    setup();
    expect(screen.getByRole("button", { name: "Save current as theme" })).toBeInTheDocument();
  });

  it("saves the typed name then clears the input", async () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Save current as theme" }));
    const input = await screen.findByPlaceholderText("Theme name");
    fireEvent.change(input, { target: { value: "Spring 26" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("Spring 26"));
  });

  it("blocks an empty name", async () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Save current as theme" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a name for this theme.")).toBeInTheDocument();
  });

  it("disables the trigger at the saved-theme limit", () => {
    setup({ atLimit: true });
    expect(screen.getByRole("button", { name: "Save current as theme" })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run SaveThemePopover`
Expected: FAIL — cannot find module `./SaveThemePopover`.

- [ ] **Step 3: Write the implementation**

Create `lib/page-builder/brandKitPicker/SaveThemePopover.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { SaveIcon, Loader2Icon } from "lucide-react";
import { SAVED_THEMES_MAX } from "@/lib/page-builder/types";

type Props = {
  /** Persist the current brand kit under `name`. Rejects on failure. */
  onSave: (name: string) => Promise<void>;
  /** True when the workspace is at `SAVED_THEMES_MAX` saved themes. */
  atLimit: boolean;
};

export function SaveThemePopover({ onSave, atLimit }: Props) {
  const t = useTranslations("app.pageBuilder.brandKit");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("enterThemeName"));
      return;
    }
    if (trimmed.length > 60) {
      setError(t("nameTooLong"));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(trimmed);
      setName("");
      setOpen(false);
    } catch {
      setError(t("saveThemeError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(null); }}>
      <PopoverTrigger
        type="button"
        disabled={atLimit}
        title={atLimit ? t("themeLimitReached", { max: SAVED_THEMES_MAX }) : t("saveCurrentAsTheme")}
        aria-label={t("saveCurrentAsTheme")}
        className="inline-flex size-9 shrink-0 items-center justify-center border border-border text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
      >
        <SaveIcon className="size-4" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-64 flex-col gap-2">
        <input
          type="text"
          autoFocus
          placeholder={t("themeNamePlaceholder")}
          aria-label={t("themeNamePlaceholder")}
          value={name}
          maxLength={60}
          onChange={(e) => { setName(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
          className="h-9 w-full min-w-0 border border-border bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <Button
          type="button"
          size="sm"
          onClick={() => void handleSave()}
          disabled={saving || !name.trim()}
          className="gap-1.5 self-end"
        >
          {saving && <Loader2Icon className="size-3.5 animate-spin" aria-hidden />}
          {t("saveAction")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run SaveThemePopover`
Expected: PASS.

> If the `PopoverContent` does not render its children in jsdom until opened, the `findBy*` queries already wait for it. If your shadcn `Popover` renders into a portal, `screen.findBy*` still finds portalled nodes — no change needed.

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/brandKitPicker/SaveThemePopover.tsx lib/page-builder/brandKitPicker/SaveThemePopover.test.tsx
git commit -m "feat(portfolio): save-as-theme icon popover

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: ThemeGrid (toolbar + grid + pagination)

**Files:**
- Create: `lib/page-builder/brandKitPicker/ThemeGrid.tsx`
- Test: `lib/page-builder/brandKitPicker/ThemeGrid.test.tsx`

Like Task 4, the test injects the new `brandKit` keys so it is green regardless of Task 7 ordering.

- [ ] **Step 1: Write the failing test**

Create `lib/page-builder/brandKitPicker/ThemeGrid.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, within } from "@testing-library/react";
import { renderWithProviders, enMessages } from "@/test-utils/render";
import { ThemeGrid } from "./ThemeGrid";
import { DEFAULT_BRAND_KIT, type PortfolioSavedTheme } from "@/lib/page-builder/types";
import { THEME_PRESET_DEFINITIONS } from "./themePresetDefinitions";

const brandKitKeys = {
  ...enMessages.app.pageBuilder.brandKit,
  themes: "Themes",
  searchPlaceholder: "Search themes",
  noThemesMatch: "No themes match your search.",
  prevPage: "Previous themes",
  nextPage: "More themes",
  pageIndicator: "{current} / {total}",
  applyTheme: "Apply theme: {name}",
  deleteTheme: "Delete theme: {name}",
  saveCurrentAsTheme: "Save current as theme",
  themeNamePlaceholder: "Theme name",
  saveAction: "Save",
  enterThemeName: "Enter a name for this theme.",
  nameTooLong: "Name too long.",
  saveThemeError: "Could not save theme.",
  themeLimitReached: "Limit {max} reached.",
};
const messages = {
  ...enMessages,
  app: {
    ...enMessages.app,
    pageBuilder: {
      ...enMessages.app.pageBuilder,
      brandKit: brandKitKeys,
    },
  },
};

function setup(over: Partial<Parameters<typeof ThemeGrid>[0]> = {}) {
  const onChange = vi.fn();
  const onSaveTheme = vi.fn().mockResolvedValue(undefined);
  const onDeleteTheme = vi.fn().mockResolvedValue(undefined);
  renderWithProviders(
    <ThemeGrid
      value={DEFAULT_BRAND_KIT}
      onChange={onChange}
      savedThemes={[]}
      onSaveTheme={onSaveTheme}
      onDeleteTheme={onDeleteTheme}
      {...over}
    />,
    { messages }
  );
  return { onChange, onSaveTheme, onDeleteTheme };
}

const manySaved = (n: number): PortfolioSavedTheme[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    name: `Saved ${i}`,
    brandKit: { ...DEFAULT_BRAND_KIT, accentColor: `#0000${(i % 10)}${(i % 10)}` },
  }));

describe("ThemeGrid", () => {
  it("applies the full brand kit when a preset tile is clicked (regression)", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Apply theme: Editorial" }));
    expect(onChange).toHaveBeenCalledWith(THEME_PRESET_DEFINITIONS.editorial.brandKit);
    // The applied kit carries real colors/fonts, not just a themePreset label.
    expect(onChange.mock.calls[0][0].accentColor).toBe("#7e6a52");
    expect(onChange.mock.calls[0][0].headingFont).toBe("playfair");
  });

  it("shows at most 9 tiles per page and paginates beyond 9", () => {
    setup({ savedThemes: manySaved(6) }); // 6 presets + 6 saved = 12 -> 2 pages
    expect(screen.getAllByRole("button", { name: /Apply theme:/ })).toHaveLength(9);
    fireEvent.click(screen.getByRole("button", { name: "More themes" }));
    expect(screen.getAllByRole("button", { name: /Apply theme:/ })).toHaveLength(3);
  });

  it("does not render pagination for 9 or fewer tiles", () => {
    setup({ savedThemes: manySaved(3) }); // 6 + 3 = 9
    expect(screen.queryByRole("button", { name: "More themes" })).toBeNull();
  });

  it("filters tiles by the search query and shows an empty message", () => {
    setup({ savedThemes: manySaved(2) });
    fireEvent.change(screen.getByPlaceholderText("Search themes"), {
      target: { value: "Saved 1" },
    });
    expect(screen.getAllByRole("button", { name: /Apply theme:/ })).toHaveLength(1);
    fireEvent.change(screen.getByPlaceholderText("Search themes"), {
      target: { value: "nope" },
    });
    expect(screen.getByText("No themes match your search.")).toBeInTheDocument();
  });

  it("renders delete only on saved tiles and calls onDeleteTheme", () => {
    const { onDeleteTheme } = setup({ savedThemes: manySaved(1) });
    expect(screen.queryByRole("button", { name: "Delete theme: Minimal" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Delete theme: Saved 0" }));
    expect(onDeleteTheme).toHaveBeenCalledWith("s0");
  });

  it("marks the tile matching the current brand kit as selected", () => {
    setup(); // value = DEFAULT_BRAND_KIT == Minimal preset
    expect(screen.getByRole("button", { name: "Apply theme: Minimal" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run ThemeGrid`
Expected: FAIL — cannot find module `./ThemeGrid`.

- [ ] **Step 3: Write the implementation**

Create `lib/page-builder/brandKitPicker/ThemeGrid.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  SAVED_THEMES_MAX,
  type PortfolioBrandKit,
  type PortfolioSavedTheme,
  type BrandKitThemePreset,
} from "@/lib/page-builder/types";
import {
  buildThemeTiles,
  filterThemeTiles,
  paginate,
  brandKitsEqualForSelection,
} from "./themeTiles";
import { ThemeTile } from "./ThemeTile";
import { SaveThemePopover } from "./SaveThemePopover";

type Props = {
  value: PortfolioBrandKit;
  onChange: (next: PortfolioBrandKit) => void;
  savedThemes: PortfolioSavedTheme[];
  onSaveTheme?: (name: string) => Promise<void>;
  onDeleteTheme?: (id: string) => Promise<void>;
};

export function ThemeGrid({ value, onChange, savedThemes, onSaveTheme, onDeleteTheme }: Props) {
  const t = useTranslations("app.pageBuilder.brandKit");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const presetName = (id: BrandKitThemePreset) => t(`presets.${id}`);
  const tiles = buildThemeTiles({ presetName, savedThemes });
  const filtered = filterThemeTiles(tiles, query);
  const { pageItems, pageCount, page: safePage } = paginate(filtered, page);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await onDeleteTheme?.(id);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0); }}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="h-9 min-w-0 flex-1 border border-border bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        {onSaveTheme && (
          <SaveThemePopover onSave={onSaveTheme} atLimit={savedThemes.length >= SAVED_THEMES_MAX} />
        )}
      </div>

      {/* Grid / empty state */}
      {pageItems.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {pageItems.map((tile) => (
            <ThemeTile
              key={tile.key}
              tile={tile}
              selected={brandKitsEqualForSelection(tile.brandKit, value)}
              applyLabel={t("applyTheme", { name: tile.name })}
              deleteLabel={
                tile.savedThemeId && onDeleteTheme
                  ? t("deleteTheme", { name: tile.name })
                  : undefined
              }
              deleting={deletingId === tile.savedThemeId}
              onApply={() => onChange(tile.brandKit)}
              onDelete={
                tile.savedThemeId ? () => void handleDelete(tile.savedThemeId!) : undefined
              }
            />
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("noThemesMatch")}</p>
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            aria-label={t("prevPage")}
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
            className="inline-flex size-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-40"
          >
            <ChevronLeftIcon className="size-4" aria-hidden />
          </button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {t("pageIndicator", { current: safePage + 1, total: pageCount })}
          </span>
          <button
            type="button"
            aria-label={t("nextPage")}
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(safePage + 1)}
            className="inline-flex size-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-40"
          >
            <ChevronRightIcon className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run ThemeGrid`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/brandKitPicker/ThemeGrid.tsx lib/page-builder/brandKitPicker/ThemeGrid.test.tsx
git commit -m "feat(portfolio): unified theme grid with search and pagination

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Integrate ThemeGrid into BrandKitPicker

**Files:**
- Modify: `lib/page-builder/brandKitPicker/BrandKitPicker.tsx`
- Modify: `lib/page-builder/brandKitPicker/BrandKitPicker.test.tsx`

- [ ] **Step 1: Update the existing failing test**

In `lib/page-builder/brandKitPicker/BrandKitPicker.test.tsx`, replace the preset-selection test so it asserts a full-kit apply (the bug fix), and keep coverage that the editors still render. Replace the existing `it("selecting a theme preset emits the updated kit", ...)` block with:

```tsx
  it("applies the full brand kit (colors + fonts) when a preset is selected", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Apply theme: Editorial" }));
    const applied = onChange.mock.calls.at(-1)![0];
    expect(applied.themePreset).toBe("editorial");
    expect(applied.accentColor).toBe("#7e6a52");
    expect(applied.headingFont).toBe("playfair");
  });

  it("still renders the color and font editors", () => {
    setup();
    expect(screen.getByRole("button", { name: /Heading font/i })).toBeTruthy();
    expect(screen.getByText("Colors")).toBeInTheDocument();
  });
```

If the existing test file relies on `useTranslations` keys, ensure its render uses `renderWithProviders` (default `enMessages`) — after Task 7 the real `en.json` carries every key, so no inline message override is needed here. If you run Task 6 before Task 7, add the same `messages` override object used in the Task 5 test.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run BrandKitPicker`
Expected: FAIL — the button named "Apply theme: Editorial" does not exist yet (old UI renders a "Editorial" preset button instead).

- [ ] **Step 3: Edit BrandKitPicker**

Replace the **Theme preset** `<fieldset>` block and the entire **Saved themes** `<section>` block with a single `ThemeGrid`. Remove the now-dead save/delete state and helpers. The file becomes:

```tsx
"use client";

import { useTranslations } from "next-intl";
import {
  type PortfolioBrandKit,
} from "@/lib/page-builder/types";
import {
  PORTFOLIO_FONTS,
  PORTFOLIO_FONT_KEYS,
  legacyFontPairToFonts,
  type PortfolioFontKey,
} from "@/lib/page-builder/fonts";
import type { PortfolioSavedTheme } from "@/lib/page-builder/types";
import { ColorPicker } from "@/components/ui/color-picker";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";
import { ThemeGrid } from "./ThemeGrid";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// Quick-pick swatches shown above the spectrum — Gallurio brand shades plus a
// few versatile neutrals/accents. Owners can still pick any custom color.
const BRAND_PRESETS = [
  "#111111",
  "#ffffff",
  "#f5f5f5",
  "#2f5d56",
  "#5fb3a8",
  "#7c5cff",
  "#e87a4f",
  "#c9aa55",
] as const;

type ColorKey = "primaryColor" | "secondaryColor" | "accentColor" | "backgroundColor" | "foregroundColor";
const COLOR_KEYS: ColorKey[] = [
  "primaryColor",
  "secondaryColor",
  "accentColor",
  "backgroundColor",
  "foregroundColor",
];

// Labels for the two independent font selectors (English — editor chrome only).
const FONT_SELECTOR_LABELS: Record<"headingFont" | "bodyFont", string> = {
  headingFont: "Heading font",
  bodyFont: "Body font",
};

type Props = {
  value: PortfolioBrandKit;
  onChange: (next: PortfolioBrandKit) => void;
  /** When provided, enables a "use workspace branding" shortcut for the colors. */
  workspaceBranding?: { primaryColor?: string; secondaryColor?: string } | null;
  /** Owner's saved named themes, shown in the unified theme grid. */
  savedThemes?: PortfolioSavedTheme[];
  /** Called when user saves the current kit as a named theme. */
  onSaveTheme?: (name: string) => Promise<void>;
  /** Called when user deletes a saved theme by id. */
  onDeleteTheme?: (id: string) => Promise<void>;
};

/** A single font-family selector — heading or body. */
function FontSelector({
  label,
  value: selectedKey,
  onChange,
}: {
  label: string;
  value: PortfolioFontKey;
  onChange: (key: PortfolioFontKey) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-xs font-medium text-muted-foreground">{label}</legend>
      <div className="flex flex-col gap-1">
        {PORTFOLIO_FONT_KEYS.map((key) => {
          const entry = PORTFOLIO_FONTS[key];
          const active = selectedKey === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(key)}
              className={cn(
                "flex min-h-11 items-center justify-between gap-3 border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                active ? "border-foreground bg-accent/20" : "border-border hover:bg-accent/40 focus-visible:bg-accent/40"
              )}
            >
              <span className="text-sm" style={{ fontFamily: entry.family }}>
                {entry.label}
              </span>
              <span className="flex items-center gap-2">
                <span
                  className="text-base text-muted-foreground"
                  style={{ fontFamily: entry.family }}
                  aria-hidden
                >
                  Aa
                </span>
                {active && <CheckIcon className="size-3.5 shrink-0 text-foreground" aria-hidden />}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function BrandKitPicker({
  value,
  onChange,
  workspaceBranding,
  savedThemes = [],
  onSaveTheme,
  onDeleteTheme,
}: Props) {
  const t = useTranslations("app.pageBuilder.brandKit");

  // Derive current heading/body from explicit keys or legacy pair fallback.
  const resolvedFonts = legacyFontPairToFonts(value.fontPair);
  const headingFont: PortfolioFontKey = value.headingFont ?? resolvedFonts.headingFont;
  const bodyFont: PortfolioFontKey = value.bodyFont ?? resolvedFonts.bodyFont;

  function set<K extends keyof PortfolioBrandKit>(key: K, v: PortfolioBrandKit[K]) {
    onChange({ ...value, [key]: v });
  }

  function setFont(slot: "headingFont" | "bodyFont", key: PortfolioFontKey) {
    onChange({ ...value, [slot]: key });
  }

  function useWorkspaceBranding() {
    if (!workspaceBranding) return;
    const next = { ...value };
    if (workspaceBranding.primaryColor && HEX_RE.test(workspaceBranding.primaryColor)) {
      next.primaryColor = workspaceBranding.primaryColor;
    }
    if (workspaceBranding.secondaryColor && HEX_RE.test(workspaceBranding.secondaryColor)) {
      next.secondaryColor = workspaceBranding.secondaryColor;
    }
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Unified theme grid (presets + saved) */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t("themes")}</legend>
        <ThemeGrid
          value={value}
          onChange={onChange}
          savedThemes={savedThemes}
          onSaveTheme={onSaveTheme}
          onDeleteTheme={onDeleteTheme}
        />
      </fieldset>

      {/* Independent font selectors */}
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium">Fonts</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FontSelector
            label={FONT_SELECTOR_LABELS.headingFont}
            value={headingFont}
            onChange={(key) => setFont("headingFont", key)}
          />
          <FontSelector
            label={FONT_SELECTOR_LABELS.bodyFont}
            value={bodyFont}
            onChange={(key) => setFont("bodyFont", key)}
          />
        </div>
      </div>

      {/* Colors */}
      <fieldset className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <legend className="text-sm font-medium">{t("colors")}</legend>
          {workspaceBranding && (
            <button
              type="button"
              onClick={useWorkspaceBranding}
              className="text-xs text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
            >
              {t("useWorkspaceBranding")}
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {COLOR_KEYS.map((key) => (
            <Popover key={key}>
              <PopoverTrigger
                className="flex min-h-11 items-center gap-2 border border-border px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label={t(`colorLabels.${key}`)}
              >
                <span
                  className="size-7 shrink-0 border border-border"
                  style={{ background: value[key] }}
                  aria-hidden
                />
                <span className="flex flex-1 flex-col">
                  <span className="text-xs text-muted-foreground">{t(`colorLabels.${key}`)}</span>
                  <span className="font-mono text-xs uppercase">{value[key]}</span>
                </span>
              </PopoverTrigger>
              <PopoverContent className="w-auto" align="start">
                <ColorPicker
                  value={value[key]}
                  onChange={(hex) => set(key, hex)}
                  presets={BRAND_PRESETS}
                  presetsLabel={t("colors")}
                  hexLabel={`${t(`colorLabels.${key}`)} hex`}
                />
              </PopoverContent>
            </Popover>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
```

This removes the imports/usages of `BRAND_KIT_THEME_PRESETS`, `BrandKitThemePreset`, `THEME_PRESET_SWATCHES`, `Button`, `Trash2Icon`, `PlusIcon`, `Loader2Icon`, and the `useState` save/delete state — confirm none remain referenced.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test --run BrandKitPicker`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/brandKitPicker/BrandKitPicker.tsx lib/page-builder/brandKitPicker/BrandKitPicker.test.tsx
git commit -m "feat(portfolio): mount unified theme grid in brand kit picker

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Locales

**Files:**
- Modify: `messages/en.json`, `messages/fil.json`, `messages/ms.json`, `messages/id.json`
- Test: `lib/page-builder/brandKitPicker/brandKitMessages.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `lib/page-builder/brandKitPicker/brandKitMessages.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import fil from "@/messages/fil.json";
import ms from "@/messages/ms.json";
import id from "@/messages/id.json";

const REQUIRED_KEYS = [
  "themes",
  "searchPlaceholder",
  "noThemesMatch",
  "prevPage",
  "nextPage",
  "pageIndicator",
  "applyTheme",
  "deleteTheme",
  "saveCurrentAsTheme",
  "themeNamePlaceholder",
  "saveAction",
  "enterThemeName",
  "nameTooLong",
  "saveThemeError",
  "themeLimitReached",
] as const;

const locales = { en, fil, ms, id } as const;

describe("brandKit locale keys", () => {
  for (const [name, messages] of Object.entries(locales)) {
    it(`${name} defines all new theme-grid keys`, () => {
      const bk = (messages as any).app.pageBuilder.brandKit;
      for (const key of REQUIRED_KEYS) {
        expect(typeof bk[key], `${name}.${key}`).toBe("string");
        expect(bk[key].length, `${name}.${key}`).toBeGreaterThan(0);
      }
    });
  }

  it("interpolation placeholders are present where required", () => {
    const bk = (en as any).app.pageBuilder.brandKit;
    expect(bk.applyTheme).toContain("{name}");
    expect(bk.deleteTheme).toContain("{name}");
    expect(bk.pageIndicator).toContain("{current}");
    expect(bk.pageIndicator).toContain("{total}");
    expect(bk.themeLimitReached).toContain("{max}");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run brandKitMessages`
Expected: FAIL — keys undefined.

- [ ] **Step 3: Add keys to all four locale files**

In each file, locate the `app.pageBuilder.brandKit` object (keep existing `themePreset`, `presets`, `fontPair`, `colors`, `useWorkspaceBranding`, `colorLabels`) and add the following keys.

`messages/en.json` — add to `brandKit`:

```json
      "themes": "Themes",
      "searchPlaceholder": "Search themes",
      "noThemesMatch": "No themes match your search.",
      "prevPage": "Previous themes",
      "nextPage": "More themes",
      "pageIndicator": "{current} / {total}",
      "applyTheme": "Apply theme: {name}",
      "deleteTheme": "Delete theme: {name}",
      "saveCurrentAsTheme": "Save current as theme",
      "themeNamePlaceholder": "Theme name",
      "saveAction": "Save",
      "enterThemeName": "Enter a name for this theme.",
      "nameTooLong": "Theme name must be 60 characters or fewer.",
      "saveThemeError": "Could not save theme. Please try again.",
      "themeLimitReached": "You've reached the maximum of {max} saved themes."
```

`messages/fil.json` — add to `brandKit`:

```json
      "themes": "Mga tema",
      "searchPlaceholder": "Maghanap ng tema",
      "noThemesMatch": "Walang temang tumugma sa iyong paghahanap.",
      "prevPage": "Mga nakaraang tema",
      "nextPage": "Higit pang tema",
      "pageIndicator": "{current} / {total}",
      "applyTheme": "Ilapat ang tema: {name}",
      "deleteTheme": "Burahin ang tema: {name}",
      "saveCurrentAsTheme": "I-save ang kasalukuyan bilang tema",
      "themeNamePlaceholder": "Pangalan ng tema",
      "saveAction": "I-save",
      "enterThemeName": "Maglagay ng pangalan para sa temang ito.",
      "nameTooLong": "Ang pangalan ng tema ay dapat 60 character o mas kaunti.",
      "saveThemeError": "Hindi ma-save ang tema. Pakisubukan muli.",
      "themeLimitReached": "Naabot mo na ang maximum na {max} na naka-save na tema."
```

`messages/ms.json` — add to `brandKit`:

```json
      "themes": "Tema",
      "searchPlaceholder": "Cari tema",
      "noThemesMatch": "Tiada tema sepadan dengan carian anda.",
      "prevPage": "Tema sebelumnya",
      "nextPage": "Lagi tema",
      "pageIndicator": "{current} / {total}",
      "applyTheme": "Gunakan tema: {name}",
      "deleteTheme": "Padam tema: {name}",
      "saveCurrentAsTheme": "Simpan semasa sebagai tema",
      "themeNamePlaceholder": "Nama tema",
      "saveAction": "Simpan",
      "enterThemeName": "Masukkan nama untuk tema ini.",
      "nameTooLong": "Nama tema mestilah 60 aksara atau kurang.",
      "saveThemeError": "Tidak dapat menyimpan tema. Sila cuba lagi.",
      "themeLimitReached": "Anda telah mencapai maksimum {max} tema yang disimpan."
```

`messages/id.json` — add to `brandKit`:

```json
      "themes": "Tema",
      "searchPlaceholder": "Cari tema",
      "noThemesMatch": "Tidak ada tema yang cocok dengan pencarian Anda.",
      "prevPage": "Tema sebelumnya",
      "nextPage": "Tema berikutnya",
      "pageIndicator": "{current} / {total}",
      "applyTheme": "Terapkan tema: {name}",
      "deleteTheme": "Hapus tema: {name}",
      "saveCurrentAsTheme": "Simpan saat ini sebagai tema",
      "themeNamePlaceholder": "Nama tema",
      "saveAction": "Simpan",
      "enterThemeName": "Masukkan nama untuk tema ini.",
      "nameTooLong": "Nama tema harus 60 karakter atau kurang.",
      "saveThemeError": "Tidak dapat menyimpan tema. Silakan coba lagi.",
      "themeLimitReached": "Anda telah mencapai maksimum {max} tema tersimpan."
```

Mind JSON comma placement: add a comma after the previous last key (`colorLabels` block) and ensure the inserted block sits inside `brandKit`. Verify each file parses (the test imports them — a parse error fails the test).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run brandKitMessages`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add messages/en.json messages/fil.json messages/ms.json messages/id.json lib/page-builder/brandKitPicker/brandKitMessages.test.ts
git commit -m "feat(portfolio): locale keys for unified theme grid (en/fil/ms/id)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Retire THEME_PRESET_SWATCHES + full verification sweep

**Files:**
- Modify/Delete: `lib/page-builder/brandKitPicker/themePresetSwatches.ts`

- [ ] **Step 1: Find remaining usages**

Run:
```bash
git grep -n "THEME_PRESET_SWATCHES"
git grep -n "FONT_PAIR_SAMPLES"
git grep -n "themePresetSwatches"
```

Expected after Task 6: no `THEME_PRESET_SWATCHES` references remain (only its definition). Note whether `FONT_PAIR_SAMPLES` is still imported anywhere.

- [ ] **Step 2: Remove the dead export (or file)**

- If `FONT_PAIR_SAMPLES` has **no** remaining importers: delete the whole file.
  ```bash
  git rm lib/page-builder/brandKitPicker/themePresetSwatches.ts
  ```
- If `FONT_PAIR_SAMPLES` **is** still imported somewhere: edit the file to remove only the `THEME_PRESET_SWATCHES` export and the now-unused `BrandKitThemePreset` import, keeping `FONT_PAIR_SAMPLES` and its `BrandKitFontPair` import intact.

- [ ] **Step 3: Run the full affected-test sweep**

Run:
```bash
pnpm test --run themePresetDefinitions themeTiles ThemeTile SaveThemePopover ThemeGrid BrandKitPicker brandKitMessages
```
Expected: all PASS.

- [ ] **Step 4: Typecheck and lint**

Run:
```bash
pnpm typecheck
pnpm lint
```
Expected: 0 errors. Fix any unused-import or type errors surfaced by the refactor (especially leftover imports in `BrandKitPicker.tsx` and `ThemeGrid.tsx`).

- [ ] **Step 5: Manual 375px check**

Run `pnpm dev`, open the portfolio editor, open the theme dialog at 375px width. Confirm: tiles render `[thumbnail | title]` in a 2-col grid; toolbar stays one row; clicking a preset instantly changes the canvas colors/fonts; search filters; pagination appears past 9; save popover works; delete works on saved themes only.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(portfolio): retire theme preset swatches; verify theme modal redesign

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Presets carry concrete brand kits → Task 1. ✓
- Clicking any tile applies full snapshot / fixes bug → Task 1 (data), Task 5 (regression test), Task 6 (integration + updated assertion). ✓
- Unified grid, presets first then saved → Task 2 (`buildThemeTiles`), Task 5. ✓
- `[thumbnail | title]` tile, two swatches = primary + accent → Task 3. ✓
- Presets non-deletable, saved deletable, no hover-only → Task 3 (delete only with `deleteLabel`; always-visible button), Task 5. ✓
- Selected ring via deep-equal → Task 2 (`brandKitsEqualForSelection`), Task 3 (aria-pressed), Task 5. ✓
- Toolbar: search (live filter) + save icon w/ tooltip → Task 4, Task 5. ✓
- Save popover w/ name + limit guard → Task 4. ✓
- 9/page pagination, reset on query, clamp on delete → Task 2 (`paginate`), Task 5. ✓
- Locales en/fil/ms/id → Task 7. ✓
- Tests + typecheck + lint + 375px → Task 8. ✓
- No data migration, swatches retired → Task 8. ✓

**Placeholder scan:** No TBD/TODO; all code blocks complete; translations provided literally.

**Type consistency:** `ThemeTileModel`, `THEME_PRESET_DEFINITIONS`, `buildThemeTiles`, `filterThemeTiles`, `paginate`, `brandKitsEqualForSelection`, `THEMES_PER_PAGE`, `SaveThemePopover`(props `onSave`,`atLimit`), `ThemeGrid`(props `value`,`onChange`,`savedThemes`,`onSaveTheme`,`onDeleteTheme`), `ThemeTile`(props `tile`,`selected`,`applyLabel`,`deleteLabel`,`deleting`,`onApply`,`onDelete`) are used consistently across tasks. `BrandKitPicker` keeps its existing prop contract, so `ThemePanelDialog` needs no change. `SAVED_THEMES_MAX`, `BRAND_KIT_THEME_PRESETS`, `PORTFOLIO_FONT_KEYS`, `legacyFontPairToFonts` match the verified source.
