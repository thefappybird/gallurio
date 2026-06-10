# Theme Modal — Current Theme + Per-Theme Edit Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a floating in-memory "Current Theme" tile and per-theme edit mode to the portfolio theme modal, with override/unsaved-changes guards and case-insensitive name uniqueness.

**Architecture:** A pure decision/data layer (tile variants + reserved-cell pagination, name uniqueness, state-machine predicates, edit diff) is consumed by a `useThemeEditor` hook that owns the editor session state (current theme, selection, edit session, dialog flags). `ThemePanelDialog` owns the controller and wires the modal-close guard; `BrandKitPicker`/`ThemeGrid`/`ThemeTile` consume it. A new `updateThemeAction` server action edits saved themes in place; `saveThemeAction` gains a uniqueness check. No schema change — the Current Theme is session-only.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, next-intl (ICU), Vitest + @testing-library/react, lucide-react, Radix-based `Dialog`/`Popover`, Mongoose 8, Zod.

**Spec:** `docs/superpowers/specs/2026-06-10-theme-modal-current-theme-edit-mode-design.md`

---

## File Structure

**New files:**
- `lib/page-builder/themeNames.ts` — pure name normalization + uniqueness (shared client/server).
- `lib/page-builder/brandKitPicker/themeEditorState.ts` — pure state-machine predicates + types (`ThemeSelection`, `EditSession`, `needsOverrideConfirm`, `editHasDiff`).
- `lib/page-builder/brandKitPicker/useThemeEditor.ts` — the editor-session hook (orchestrator).
- `lib/page-builder/brandKitPicker/ConfirmDialog.tsx` — generic two-button confirm (override + close-guard).
- `lib/page-builder/brandKitPicker/UnsavedEditDialog.tsx` — edit-mode Discard / Save & close dialog.
- `lib/page-builder/brandKitPicker/EditThemeBar.tsx` — inline name input + exit control shown while editing.
- Test files colocated next to each.

**Modified files:**
- `lib/page-builder/brandKitPicker/themeTiles.ts` — add `variant`, `buildCurrentTile`, `paginateWithCurrent`.
- `lib/page-builder/brandKitPicker/ThemeTile.tsx` — `variant`, edit button, current styling, editing ring.
- `lib/page-builder/brandKitPicker/ThemeGrid.tsx` — consume controller: current tile, edit button, dialogs.
- `lib/page-builder/brandKitPicker/BrandKitPicker.tsx` — own/accept controller; route control edits + edit-draft.
- `lib/page-builder/brandKitPicker/SaveThemePopover.tsx` — controllable open + client uniqueness error.
- `app/[locale]/(app)/portfolio/_components/ThemePanelDialog.tsx` — own controller, close-guard, `updateThemeAction`.
- `app/[locale]/(app)/portfolio/_actions.ts` — `saveThemeAction` uniqueness; new `updateThemeAction`.
- `messages/{en,fil,ms,id}.json` — new keys.
- `lib/page-builder/brandKitPicker/brandKitMessages.test.ts` — assert new keys.

**Conventions to follow (verified in the existing code):**
- i18n namespace for picker components: `useTranslations("app.pageBuilder.brandKit")`.
- Server actions live in `app/[locale]/(app)/portfolio/_actions.ts`, use `requireOrg()` → `ctx.role`/`ctx.workspace._id`, `connectDB()`, Zod `safeParse`, return `{ ok: true; ... } | { error: string }`.
- Result type for theme saves: `SaveThemeResult = { ok: true; theme: PortfolioSavedTheme } | { error: string }`.
- Component tests render via `renderWithProviders(node, { messages })` from `@/test-utils/render` (exports `enMessages`). Pure modules use plain `vitest`.
- jsdom returns inline `style.background` as the raw hex you set (assert hex, not `rgb(...)`).

---

## Task 1: Tile variants + reserved-cell pagination (pure)

**Files:**
- Modify: `lib/page-builder/brandKitPicker/themeTiles.ts`
- Test: `lib/page-builder/brandKitPicker/themeTiles.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `themeTiles.test.ts`:

```typescript
import {
  buildCurrentTile,
  paginateWithCurrent,
} from "./themeTiles";

describe("tile variants", () => {
  it("tags presets and saved themes with a variant", () => {
    const tiles = buildThemeTiles({ presetName, savedThemes });
    expect(tiles[0].variant).toBe("preset");
    expect(tiles.find((t) => t.savedThemeId === "a")?.variant).toBe("saved");
  });
});

describe("buildCurrentTile", () => {
  it("builds a current-variant tile with a fixed key", () => {
    const tile = buildCurrentTile(DEFAULT_BRAND_KIT, "Current Theme");
    expect(tile.variant).toBe("current");
    expect(tile.key).toBe("current");
    expect(tile.name).toBe("Current Theme");
    expect(tile.savedThemeId).toBeUndefined();
  });
});

describe("paginateWithCurrent", () => {
  const reals = (n: number) =>
    Array.from({ length: n }, (_, i) => buildCurrentTile(DEFAULT_BRAND_KIT, `T${i}`));
  const current = buildCurrentTile(DEFAULT_BRAND_KIT, "Current Theme");

  it("uses 9 real tiles per page when there is no current tile", () => {
    const r = paginateWithCurrent(reals(12), null, 0);
    expect(r.pageItems).toHaveLength(9);
    expect(r.pageCount).toBe(2);
  });

  it("reserves the last cell so 8 reals + current fill a page", () => {
    const r = paginateWithCurrent(reals(10), current, 0);
    expect(r.pageItems).toHaveLength(9); // 8 reals + current
    expect(r.pageItems[8].variant).toBe("current");
    expect(r.pageCount).toBe(2); // 10 reals / 8 per page
  });

  it("pins the current tile to the last cell of every page", () => {
    const r2 = paginateWithCurrent(reals(10), current, 1);
    expect(r2.page).toBe(1);
    expect(r2.pageItems).toHaveLength(3); // 2 reals + current
    expect(r2.pageItems.at(-1)?.variant).toBe("current");
  });

  it("places the current tile right after a short list (7 reals -> cell 8)", () => {
    const r = paginateWithCurrent(reals(7), current, 0);
    expect(r.pageItems).toHaveLength(8);
    expect(r.pageCount).toBe(1);
    expect(r.pageItems[7].variant).toBe("current");
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test --run themeTiles`
Expected: FAIL — `buildCurrentTile`/`paginateWithCurrent` not exported; `variant` undefined.

- [ ] **Step 3: Implement**

In `themeTiles.ts`, extend the model and `buildThemeTiles`, then add the two helpers.

Replace the `ThemeTileModel` type with:

```typescript
export type ThemeTileModel = {
  /** Stable React key + identity, e.g. "preset:minimal", "saved:<id>", or "current". */
  key: string;
  /** Display title - already localized for presets, raw name for saved/current. */
  name: string;
  /** Full brand kit applied on click. */
  brandKit: PortfolioBrandKit;
  /** Distinguishes built-in presets, saved themes, and the unsaved current theme. */
  variant: "preset" | "saved" | "current";
  /** Present (and deletable) for saved themes; undefined otherwise. */
  savedThemeId?: string;
};
```

In `buildThemeTiles`, set `variant: "preset"` on `presetTiles` entries and `variant: "saved"` on `savedTiles` entries.

Add after `buildThemeTiles`:

```typescript
/** The floating, unsaved "Current Theme" tile (none when the kit matches a tile). */
export function buildCurrentTile(brandKit: PortfolioBrandKit, name: string): ThemeTileModel {
  return { key: "current", name, brandKit, variant: "current" };
}
```

Add after `paginate`:

```typescript
/**
 * Paginate real tiles while pinning the Current Theme tile to the last cell of
 * every page. Reserves a cell: 8 real tiles/page when a current tile exists, 9
 * otherwise.
 */
export function paginateWithCurrent(
  realTiles: ThemeTileModel[],
  currentTile: ThemeTileModel | null,
  page: number
): { pageItems: ThemeTileModel[]; pageCount: number; page: number } {
  const perPage = currentTile ? THEMES_PER_PAGE - 1 : THEMES_PER_PAGE;
  const { pageItems, pageCount, page: safePage } = paginate(realTiles, page, perPage);
  return {
    pageItems: currentTile ? [...pageItems, currentTile] : pageItems,
    pageCount,
    page: safePage,
  };
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `pnpm test --run themeTiles`
Expected: PASS (existing `buildThemeTiles`/`filterThemeTiles`/`paginate`/`brandKitsEqualForSelection` tests still pass).

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/brandKitPicker/themeTiles.ts lib/page-builder/brandKitPicker/themeTiles.test.ts
git commit -m "feat(portfolio): tile variants + reserved-cell pagination for current theme"
```

---

## Task 2: Theme-name uniqueness helper (pure, shared)

**Files:**
- Create: `lib/page-builder/themeNames.ts`
- Test: `lib/page-builder/themeNames.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { normalizeThemeName, isThemeNameTaken } from "./themeNames";

const saved = [
  { id: "1", name: "My Wedding" },
  { id: "2", name: "Studio Dark" },
];

describe("normalizeThemeName", () => {
  it("trims and lowercases", () => {
    expect(normalizeThemeName("  My Theme  ")).toBe("my theme");
  });
});

describe("isThemeNameTaken", () => {
  it("matches case-insensitively and ignores surrounding whitespace", () => {
    expect(isThemeNameTaken("my wedding", saved)).toBe(true);
    expect(isThemeNameTaken("  STUDIO DARK ", saved)).toBe(true);
  });
  it("is false for a free name", () => {
    expect(isThemeNameTaken("Spring 26", saved)).toBe(false);
  });
  it("excludes the theme's own id (rename keeping the same name)", () => {
    expect(isThemeNameTaken("My Wedding", saved, "1")).toBe(false);
    expect(isThemeNameTaken("My Wedding", saved, "2")).toBe(true);
  });
  it("treats an empty name as not taken (other validation handles it)", () => {
    expect(isThemeNameTaken("   ", saved)).toBe(false);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test --run themeNames`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
import type { PortfolioSavedTheme } from "@/lib/page-builder/types";

/** Canonical form for case-insensitive name comparison. */
export function normalizeThemeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * True when `name` collides (case-insensitively) with an existing saved theme.
 * Pass the edited theme's id as `excludeId` so a rename may keep its own name.
 * Empty/whitespace names are reported as not taken; required-name validation is
 * handled separately.
 */
export function isThemeNameTaken(
  name: string,
  savedThemes: Pick<PortfolioSavedTheme, "id" | "name">[],
  excludeId?: string
): boolean {
  const target = normalizeThemeName(name);
  if (!target) return false;
  return savedThemes.some(
    (t) => t.id !== excludeId && normalizeThemeName(t.name) === target
  );
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `pnpm test --run themeNames`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/themeNames.ts lib/page-builder/themeNames.test.ts
git commit -m "feat(portfolio): case-insensitive saved-theme name uniqueness helper"
```

---

## Task 3: State-machine predicates + edit diff (pure)

**Files:**
- Create: `lib/page-builder/brandKitPicker/themeEditorState.ts`
- Test: `lib/page-builder/brandKitPicker/themeEditorState.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { needsOverrideConfirm, editHasDiff, type EditSession } from "./themeEditorState";
import { DEFAULT_BRAND_KIT, type PortfolioSavedTheme } from "@/lib/page-builder/types";

describe("needsOverrideConfirm", () => {
  it("is true only when a real tile is active AND a current theme exists", () => {
    expect(needsOverrideConfirm({ kind: "tile", key: "preset:minimal" }, DEFAULT_BRAND_KIT)).toBe(true);
  });
  it("is false when no current theme exists", () => {
    expect(needsOverrideConfirm({ kind: "tile", key: "preset:minimal" }, null)).toBe(false);
  });
  it("is false when the current tile (not a real tile) is active", () => {
    expect(needsOverrideConfirm({ kind: "current" }, DEFAULT_BRAND_KIT)).toBe(false);
    expect(needsOverrideConfirm({ kind: "none" }, DEFAULT_BRAND_KIT)).toBe(false);
  });
});

describe("editHasDiff", () => {
  const base: PortfolioSavedTheme = { id: "x", name: "Base", brandKit: DEFAULT_BRAND_KIT };
  const session = (over: Partial<EditSession> = {}): EditSession => ({
    id: "x",
    baseTheme: base,
    baseWorkingKit: DEFAULT_BRAND_KIT,
    draftKit: DEFAULT_BRAND_KIT,
    draftName: "Base",
    ...over,
  });
  it("is false when neither name nor kit changed", () => {
    expect(editHasDiff(session())).toBe(false);
    expect(editHasDiff(null)).toBe(false);
  });
  it("is true when the name changed (trimmed)", () => {
    expect(editHasDiff(session({ draftName: "Renamed" }))).toBe(true);
    expect(editHasDiff(session({ draftName: "  Base  " }))).toBe(false);
  });
  it("is true when a styling field changed", () => {
    expect(editHasDiff(session({ draftKit: { ...DEFAULT_BRAND_KIT, accentColor: "#000000" } }))).toBe(true);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test --run themeEditorState`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
import type { PortfolioBrandKit, PortfolioSavedTheme } from "@/lib/page-builder/types";
import { brandKitsEqualForSelection } from "./themeTiles";

export type ThemeSelection =
  | { kind: "tile"; key: string }
  | { kind: "current" }
  | { kind: "none" };

export type EditSession = {
  /** Saved theme id being edited. */
  id: string;
  /** Snapshot for diffing + discard-revert. */
  baseTheme: PortfolioSavedTheme;
  /** Working kit captured at entry, restored on discard. */
  baseWorkingKit: PortfolioBrandKit;
  draftKit: PortfolioBrandKit;
  draftName: string;
};

/**
 * A base-control edit needs the override confirm only when a *different* real
 * tile is the active selection AND an unsaved Current Theme already exists (the
 * edit would overwrite it). Editing while the current tile is active just keeps
 * refining the Current Theme.
 */
export function needsOverrideConfirm(
  selection: ThemeSelection,
  currentTheme: PortfolioBrandKit | null
): boolean {
  return selection.kind === "tile" && currentTheme !== null;
}

/** True when the edit draft differs from the saved theme (name or styling). */
export function editHasDiff(editing: EditSession | null): boolean {
  if (!editing) return false;
  if (editing.draftName.trim() !== editing.baseTheme.name) return true;
  return !brandKitsEqualForSelection(editing.draftKit, editing.baseTheme.brandKit);
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `pnpm test --run themeEditorState`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/brandKitPicker/themeEditorState.ts lib/page-builder/brandKitPicker/themeEditorState.test.ts
git commit -m "feat(portfolio): theme-editor state predicates and edit diff"
```

---

## Task 4: `saveThemeAction` name-uniqueness check (server)

**Files:**
- Modify: `app/[locale]/(app)/portfolio/_actions.ts`
- Test: the existing actions test (find it first; likely `app/[locale]/(app)/portfolio/_actions.test.ts` or `__tests__`). If none covers `saveThemeAction`, create `app/[locale]/(app)/portfolio/_actions.themes.test.ts`.

> **Before writing:** read the nearest existing `*_actions*.test.*` to mirror how `requireOrg` is mocked and how the in-memory Mongo / `Workspace` model is set up (CLAUDE.md: do not mock Mongoose; use in-memory Mongo). Reuse that harness verbatim. If `requireOrg` is mocked to return a fixed `{ role: "owner", workspace: { _id } }`, seed two workspaces to also cover tenant isolation in Task 5.

- [ ] **Step 1: Write the failing test**

Add a case (adapt to the discovered harness):

```typescript
it("rejects a duplicate theme name case-insensitively", async () => {
  // seed: workspace already has a theme named "Sunset"
  await Workspace.updateOne(
    { _id: ws._id },
    { $set: { "publicPage.savedThemes": [{ id: "a", name: "Sunset", brandKit: DEFAULT_BRAND_KIT }] } }
  );
  const res = await saveThemeAction("  sUnSeT ", DEFAULT_BRAND_KIT);
  expect(res).toEqual({ error: "theme_name_exists" });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test --run _actions`
Expected: FAIL — currently returns `{ ok: true, ... }`.

- [ ] **Step 3: Implement**

In `_actions.ts`, add the import:

```typescript
import { isThemeNameTaken } from "@/lib/page-builder/themeNames";
```

In `saveThemeAction`, after `await connectDB();` and before building `newTheme`, insert:

```typescript
  const current = await Workspace.findOne({ _id: ctx.workspace._id })
    .select({ "publicPage.savedThemes": 1 })
    .lean<{ publicPage?: { savedThemes?: PortfolioSavedTheme[] } }>();
  if (isThemeNameTaken(nameParsed.data, current?.publicPage?.savedThemes ?? [])) {
    return { error: "theme_name_exists" };
  }
```

(The atomic capped `$push` below is unchanged; the uniqueness check is best-effort and backed by the client check — a same-name double-submit race is acceptable and rare.)

- [ ] **Step 4: Run and confirm pass**

Run: `pnpm test --run _actions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(app)/portfolio/_actions.ts" "app/[locale]/(app)/portfolio/_actions.themes.test.ts"
git commit -m "feat(portfolio): reject duplicate saved-theme names on save"
```

---

## Task 5: `updateThemeAction` (server, in-place edit)

**Files:**
- Modify: `app/[locale]/(app)/portfolio/_actions.ts`
- Test: same actions test file as Task 4.

- [ ] **Step 1: Write the failing tests**

```typescript
describe("updateThemeAction", () => {
  beforeEach(async () => {
    await Workspace.updateOne(
      { _id: ws._id },
      { $set: { "publicPage.savedThemes": [
        { id: "a", name: "Sunset", brandKit: DEFAULT_BRAND_KIT },
        { id: "b", name: "Moody", brandKit: DEFAULT_BRAND_KIT },
      ] } }
    );
  });

  it("updates name + brandKit in place, preserving id and order", async () => {
    const kit = { ...DEFAULT_BRAND_KIT, accentColor: "#123456" };
    const res = await updateThemeAction("a", "Sunset Bright", kit);
    expect(res).toMatchObject({ ok: true, theme: { id: "a", name: "Sunset Bright" } });
    const doc = await Workspace.findById(ws._id).lean();
    expect(doc!.publicPage.savedThemes.map((t: PortfolioSavedTheme) => t.id)).toEqual(["a", "b"]);
    expect(doc!.publicPage.savedThemes[0].name).toBe("Sunset Bright");
    expect(doc!.publicPage.savedThemes[0].brandKit.accentColor).toBe("#123456");
  });

  it("allows a theme to keep its own name", async () => {
    const res = await updateThemeAction("a", "Sunset", DEFAULT_BRAND_KIT);
    expect(res).toMatchObject({ ok: true });
  });

  it("rejects a name owned by a different theme (case-insensitive)", async () => {
    const res = await updateThemeAction("a", "moody", DEFAULT_BRAND_KIT);
    expect(res).toEqual({ error: "theme_name_exists" });
  });

  it("returns theme_not_found for an unknown id", async () => {
    const res = await updateThemeAction("zzz", "X", DEFAULT_BRAND_KIT);
    expect(res).toEqual({ error: "theme_not_found" });
  });

  it("cannot edit another workspace's theme (tenant isolation)", async () => {
    // requireOrg resolves to ws (workspace A). otherWs (B) owns id "a" too.
    await Workspace.updateOne(
      { _id: otherWs._id },
      { $set: { "publicPage.savedThemes": [{ id: "a", name: "Theirs", brandKit: DEFAULT_BRAND_KIT }] } }
    );
    await updateThemeAction("a", "Hijacked", DEFAULT_BRAND_KIT);
    const theirs = await Workspace.findById(otherWs._id).lean();
    expect(theirs!.publicPage.savedThemes[0].name).toBe("Theirs"); // untouched
  });
});
```

> If the harness mocks `requireOrg` to a non-owner for an "owner_only" case elsewhere, add: `it("rejects non-owners")` returning `{ error: "owner_only" }`, mirroring the existing `saveThemeAction` owner test.

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test --run _actions`
Expected: FAIL — `updateThemeAction` undefined.

- [ ] **Step 3: Implement**

Add after `saveThemeAction` in `_actions.ts`:

```typescript
export async function updateThemeAction(
  id: unknown,
  name: unknown,
  brandKit: unknown
): Promise<SaveThemeResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  const idParsed = z.string().min(1).max(64).safeParse(id);
  if (!idParsed.success) return { error: "invalid_id" };
  const nameParsed = saveThemeNameSchema.safeParse(name);
  if (!nameParsed.success) {
    return { error: nameParsed.error.errors[0]?.message ?? "invalid_name" };
  }
  const kitParsed = brandKitSchema.safeParse(brandKit);
  if (!kitParsed.success) {
    return { error: kitParsed.error.errors[0]?.message ?? "invalid_brand_kit" };
  }

  await connectDB();

  const current = await Workspace.findOne({ _id: ctx.workspace._id })
    .select({ "publicPage.savedThemes": 1 })
    .lean<{ publicPage?: { savedThemes?: PortfolioSavedTheme[] } }>();
  const savedThemes = current?.publicPage?.savedThemes ?? [];
  if (!savedThemes.some((t) => t.id === idParsed.data)) {
    return { error: "theme_not_found" };
  }
  if (isThemeNameTaken(nameParsed.data, savedThemes, idParsed.data)) {
    return { error: "theme_name_exists" };
  }

  const updated: PortfolioSavedTheme = {
    id: idParsed.data,
    name: nameParsed.data,
    brandKit: kitParsed.data,
  };
  // Positional update keeps the element's id and array position intact, and is
  // scoped to this workspace's _id so it can never touch another tenant.
  await Workspace.updateOne(
    { _id: ctx.workspace._id, "publicPage.savedThemes.id": idParsed.data },
    {
      $set: {
        "publicPage.savedThemes.$.name": updated.name,
        "publicPage.savedThemes.$.brandKit": updated.brandKit,
      },
    }
  );
  return { ok: true, theme: updated };
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `pnpm test --run _actions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(app)/portfolio/_actions.ts" "app/[locale]/(app)/portfolio/_actions.themes.test.ts"
git commit -m "feat(portfolio): updateThemeAction edits saved themes in place"
```

---

## Task 6: `ThemeTile` variants, edit button, current styling

**Files:**
- Modify: `lib/page-builder/brandKitPicker/ThemeTile.tsx`
- Test: `lib/page-builder/brandKitPicker/ThemeTile.test.tsx`

- [ ] **Step 1: Update the fixture + add failing tests**

In `ThemeTile.test.tsx`, add `variant: "saved"` to the `tile` fixture. Then append:

```typescript
describe("ThemeTile variants", () => {
  const savedTile: ThemeTileModel = { ...tile, variant: "saved" };
  const currentTile: ThemeTileModel = {
    key: "current", name: "Current Theme", brandKit: tile.brandKit, variant: "current",
  };

  it("renders an edit button on saved tiles that calls onEdit", () => {
    const onEdit = vi.fn();
    render(
      <ThemeTile tile={savedTile} selected={false} applyLabel="Apply theme: My Wedding"
        editLabel="Edit theme: My Wedding" onApply={() => {}} onEdit={onEdit} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit theme: My Wedding" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("omits the edit button when editLabel/onEdit are absent (presets)", () => {
    render(
      <ThemeTile tile={{ ...tile, variant: "preset" }} selected={false}
        applyLabel="Apply theme: Minimal" onApply={() => {}} />
    );
    expect(screen.queryByRole("button", { name: /Edit theme/ })).toBeNull();
  });

  it("renders the current tile with a badge and no edit/delete controls", () => {
    render(
      <ThemeTile tile={currentTile} selected applyLabel="Apply theme: Current Theme"
        currentBadge="Unsaved" onApply={() => {}} />
    );
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit theme/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Delete theme/ })).toBeNull();
  });

  it("shows an editing ring via aria-current when editing", () => {
    render(
      <ThemeTile tile={savedTile} selected editing applyLabel="Apply theme: My Wedding"
        onApply={() => {}} />
    );
    // the tile container carries data-editing for styling/assertion
    expect(document.querySelector('[data-editing="true"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test --run ThemeTile`
Expected: FAIL — new props unsupported; fixtures need `variant`.

- [ ] **Step 3: Implement**

Replace `ThemeTile.tsx` with:

```typescript
"use client";

import { cn } from "@/lib/utils";
import { Trash2Icon, Loader2Icon, PencilIcon } from "lucide-react";
import type { ThemeTileModel } from "./themeTiles";

type Props = {
  tile: ThemeTileModel;
  selected: boolean;
  /** Marks the tile currently in edit mode (distinct ring). */
  editing?: boolean;
  /** Localized accessible label for the apply button, e.g. "Apply theme: X". */
  applyLabel: string;
  /** Localized label for the delete button; presence enables deletion. */
  deleteLabel?: string;
  /** Localized label for the edit button; presence (saved tiles) enables editing. */
  editLabel?: string;
  /** Short localized "Unsaved" badge for the current tile. */
  currentBadge?: string;
  deleting?: boolean;
  onApply: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
};

/**
 * One unified theme tile: `[thumbnail | title]`. The thumbnail shows two
 * swatches - primary (left) and accent (right). Apply/delete/edit are sibling
 * buttons (never nested). The current variant uses a dashed border + badge.
 */
export function ThemeTile({
  tile,
  selected,
  editing = false,
  applyLabel,
  deleteLabel,
  editLabel,
  currentBadge,
  deleting = false,
  onApply,
  onDelete,
  onEdit,
}: Props) {
  const isCurrent = tile.variant === "current";
  return (
    <div
      data-editing={editing || undefined}
      className={cn(
        "relative flex items-stretch border transition-colors",
        isCurrent && "border-dashed",
        editing
          ? "border-foreground ring-1 ring-ring"
          : selected
            ? "border-foreground"
            : "border-border"
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        aria-label={applyLabel}
        onClick={onApply}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 p-2 pr-7 text-left text-sm transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="min-w-0 truncate" title={tile.name}>
            {tile.name}
          </span>
          {isCurrent && currentBadge && (
            <span className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
              {currentBadge}
            </span>
          )}
        </span>
      </button>

      {editLabel && onEdit && (
        <button
          type="button"
          aria-label={editLabel}
          onClick={onEdit}
          className="absolute right-1 top-1 z-10 inline-flex size-5 items-center justify-center border border-border bg-background text-muted-foreground opacity-70 transition-opacity transition-colors hover:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <PencilIcon className="size-3" aria-hidden />
        </button>
      )}

      {deleteLabel && onDelete && (
        <button
          type="button"
          aria-label={deleteLabel}
          onClick={onDelete}
          disabled={deleting}
          className="inline-flex w-8 shrink-0 items-center justify-center self-end border-l border-border text-muted-foreground transition-colors hover:text-destructive focus-visible:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
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

> Note: the apply button reserves `pr-7` so the absolute edit button never overlaps the title. The delete control aligns to the bottom (`self-end`) so the top-right corner stays clear for edit.

- [ ] **Step 4: Run and confirm pass**

Run: `pnpm test --run ThemeTile`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/brandKitPicker/ThemeTile.tsx lib/page-builder/brandKitPicker/ThemeTile.test.tsx
git commit -m "feat(portfolio): theme tile variants, edit button, current-theme styling"
```

---

## Task 7: Dialog components (ConfirmDialog + UnsavedEditDialog)

**Files:**
- Create: `lib/page-builder/brandKitPicker/ConfirmDialog.tsx`
- Create: `lib/page-builder/brandKitPicker/UnsavedEditDialog.tsx`
- Test: `lib/page-builder/brandKitPicker/ConfirmDialog.test.tsx`, `lib/page-builder/brandKitPicker/UnsavedEditDialog.test.tsx`

> Reuses the app `Dialog` primitive (`@/components/ui/dialog`, Radix-based — nesting inside the theme Dialog is supported). Confirm the exact exports by reading `components/ui/dialog.tsx`; this plan assumes `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` (as used in `ThemePanelDialog.tsx`). If `DialogDescription` is absent, use a `<p>`.

- [ ] **Step 1: Write the failing tests**

`ConfirmDialog.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders title/body and fires confirm and cancel", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderWithProviders(
      <ConfirmDialog open title="Override current theme?" body="Building on X will replace it."
        confirmLabel="Continue" cancelLabel="Cancel" onConfirm={onConfirm} onCancel={onCancel} />
    );
    expect(screen.getByText("Override current theme?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

`UnsavedEditDialog.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { UnsavedEditDialog } from "./UnsavedEditDialog";

describe("UnsavedEditDialog", () => {
  it("fires discard and save-and-close", () => {
    const onDiscard = vi.fn();
    const onSaveAndClose = vi.fn();
    renderWithProviders(
      <UnsavedEditDialog open title="Unsaved changes" body="Save your edits?"
        discardLabel="Discard" saveLabel="Save & close"
        onDiscard={onDiscard} onSaveAndClose={onSaveAndClose} onOpenChange={() => {}} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Save & close" }));
    expect(onSaveAndClose).toHaveBeenCalledTimes(1);
  });

  it("shows an inline error and disables save while saving", () => {
    renderWithProviders(
      <UnsavedEditDialog open title="Unsaved changes" body="Save?"
        discardLabel="Discard" saveLabel="Save & close" saving error="a theme already exists with this name"
        onDiscard={() => {}} onSaveAndClose={() => {}} onOpenChange={() => {}} />
    );
    expect(screen.getByText("a theme already exists with this name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save & close" })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test --run ConfirmDialog UnsavedEditDialog`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`ConfirmDialog.tsx`:

```typescript
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Generic two-button confirm rendered above the theme modal. Cancel is safe. */
export function ConfirmDialog({
  open, title, body, confirmLabel, cancelLabel, onConfirm, onCancel,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>{cancelLabel}</Button>
          <Button type="button" onClick={onConfirm}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

`UnsavedEditDialog.tsx`:

```typescript
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  title: string;
  body: string;
  discardLabel: string;
  saveLabel: string;
  saving?: boolean;
  error?: string | null;
  onDiscard: () => void;
  onSaveAndClose: () => void;
  onOpenChange: (open: boolean) => void;
};

/** Unsaved-changes guard with Discard (destructive) and Save & close (primary). */
export function UnsavedEditDialog({
  open, title, body, discardLabel, saveLabel, saving = false, error,
  onDiscard, onSaveAndClose, onOpenChange,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDiscard} disabled={saving}>
            {discardLabel}
          </Button>
          <Button type="button" onClick={onSaveAndClose} loading={saving} disabled={saving}>
            {saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

> `Button` already supports a `loading` prop (used in `ThemePanelDialog`). If `loading` + `disabled` conflict in the local Button API, keep only `disabled={saving}` and render a spinner child like `SaveThemePopover` does.

- [ ] **Step 4: Run and confirm pass**

Run: `pnpm test --run ConfirmDialog UnsavedEditDialog`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/brandKitPicker/ConfirmDialog.tsx lib/page-builder/brandKitPicker/ConfirmDialog.test.tsx lib/page-builder/brandKitPicker/UnsavedEditDialog.tsx lib/page-builder/brandKitPicker/UnsavedEditDialog.test.tsx
git commit -m "feat(portfolio): confirm + unsaved-changes dialogs for theme editor"
```

---

## Task 8: `useThemeEditor` controller hook

**Files:**
- Create: `lib/page-builder/brandKitPicker/useThemeEditor.ts`
- Test: `lib/page-builder/brandKitPicker/useThemeEditor.test.ts`

This hook owns the editor session and exposes a controller consumed by the grid/picker/dialog. It is **controlled**: the working kit lives in the parent; the hook calls `onChange(nextKit)` to drive it.

**Controller shape (exported type `ThemeEditorController`):**

```typescript
type ThemeEditorController = {
  currentTheme: PortfolioBrandKit | null;
  selection: ThemeSelection;
  editing: EditSession | null;
  hasUnsavedCurrent: boolean;     // currentTheme !== null
  editDiff: boolean;              // editHasDiff(editing)

  // tiles
  applyTile: (tile: ThemeTileModel) => void;

  // base-control edits routed from BrandKitPicker (color/font/radius/button)
  changeControl: (nextKit: PortfolioBrandKit) => void;

  // override confirm (2.2)
  overrideOpen: boolean;
  confirmOverride: () => void;
  cancelOverride: () => void;

  // edit mode
  enterEdit: (theme: PortfolioSavedTheme) => void;
  editName: string;
  changeEditName: (name: string) => void;
  // exit attempts run through the guard
  requestExit: (proceed: () => void) => void;
  editGuardOpen: boolean;
  editGuardError: string | null;
  editSaving: boolean;
  discardEdit: () => void;
  saveAndExitEdit: () => Promise<void>;
  cancelEditGuard: () => void;

  // current-theme save success (2.1) — call after SaveThemePopover resolves
  onCurrentThemeSaved: (theme: PortfolioSavedTheme) => void;

  // modal close support (used by ThemePanelDialog)
  needsCloseGuard: boolean;       // hasUnsavedCurrent || editDiff
};
```

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useThemeEditor } from "./useThemeEditor";
import { buildCurrentTile } from "./themeTiles";
import { THEME_PRESET_DEFINITIONS } from "./themePresetDefinitions";
import { DEFAULT_BRAND_KIT, type PortfolioBrandKit, type PortfolioSavedTheme } from "@/lib/page-builder/types";

function harness(initial: PortfolioBrandKit = DEFAULT_BRAND_KIT, saved: PortfolioSavedTheme[] = []) {
  let value = initial;
  const onChange = vi.fn((next: PortfolioBrandKit) => { value = next; });
  const onUpdateTheme = vi.fn().mockResolvedValue({ ok: true });
  const { result, rerender } = renderHook(
    ({ v }) => useThemeEditor({ value: v, onChange, savedThemes: saved, onUpdateTheme }),
    { initialProps: { v: value } }
  );
  return {
    result,
    onChange,
    onUpdateTheme,
    get value() { return value; },
    sync: () => rerender({ v: value }),
  };
}

const editorialKit = THEME_PRESET_DEFINITIONS.editorial.brandKit;

describe("useThemeEditor", () => {
  it("creates a Current Theme on first divergent control edit (no confirm)", () => {
    const h = harness();
    act(() => h.result.current.changeControl({ ...DEFAULT_BRAND_KIT, accentColor: "#abcabc" }));
    expect(h.onChange).toHaveBeenCalledWith(expect.objectContaining({ accentColor: "#abcabc" }));
    expect(h.result.current.hasUnsavedCurrent).toBe(true);
    expect(h.result.current.overrideOpen).toBe(false);
    expect(h.result.current.selection).toEqual({ kind: "current" });
  });

  it("preserves the Current Theme when a different tile is loaded", () => {
    const h = harness();
    act(() => h.result.current.changeControl({ ...DEFAULT_BRAND_KIT, accentColor: "#abcabc" }));
    act(() => h.result.current.applyTile(buildCurrentTile(editorialKit, "Editorial")
      .key === "current" ? { key: "preset:editorial", name: "Editorial", brandKit: editorialKit, variant: "preset" } : { key: "preset:editorial", name: "Editorial", brandKit: editorialKit, variant: "preset" }));
    expect(h.result.current.hasUnsavedCurrent).toBe(true); // still there
    expect(h.result.current.selection).toEqual({ kind: "tile", key: "preset:editorial" });
  });

  it("asks for confirm when building on a different loaded theme", () => {
    const h = harness();
    // make a current theme, then load a preset
    act(() => h.result.current.changeControl({ ...DEFAULT_BRAND_KIT, accentColor: "#abcabc" }));
    act(() => h.result.current.applyTile({ key: "preset:editorial", name: "Editorial", brandKit: editorialKit, variant: "preset" }));
    h.onChange.mockClear();
    act(() => h.result.current.changeControl({ ...editorialKit, primaryColor: "#010101" }));
    expect(h.result.current.overrideOpen).toBe(true);
    expect(h.onChange).not.toHaveBeenCalled(); // edit pended until confirm

    act(() => h.result.current.confirmOverride());
    expect(h.onChange).toHaveBeenCalledWith(expect.objectContaining({ primaryColor: "#010101" }));
    expect(h.result.current.selection).toEqual({ kind: "current" });
  });

  it("cancelOverride reverts to the active tile's kit", () => {
    const h = harness();
    act(() => h.result.current.changeControl({ ...DEFAULT_BRAND_KIT, accentColor: "#abcabc" }));
    act(() => h.result.current.applyTile({ key: "preset:editorial", name: "Editorial", brandKit: editorialKit, variant: "preset" }));
    act(() => h.result.current.changeControl({ ...editorialKit, primaryColor: "#010101" }));
    h.onChange.mockClear();
    act(() => h.result.current.cancelOverride());
    expect(h.result.current.overrideOpen).toBe(false);
    expect(h.onChange).toHaveBeenCalledWith(editorialKit);
  });

  it("clears the Current Theme when it is saved", () => {
    const h = harness();
    act(() => h.result.current.changeControl({ ...DEFAULT_BRAND_KIT, accentColor: "#abcabc" }));
    act(() => h.result.current.onCurrentThemeSaved({ id: "n", name: "New", brandKit: { ...DEFAULT_BRAND_KIT, accentColor: "#abcabc" } }));
    expect(h.result.current.hasUnsavedCurrent).toBe(false);
    expect(h.result.current.selection).toEqual({ kind: "tile", key: "saved:n" });
  });

  describe("edit mode", () => {
    const saved: PortfolioSavedTheme = { id: "s1", name: "Studio", brandKit: { ...DEFAULT_BRAND_KIT, accentColor: "#222222" } };

    it("enters edit mode, applies the draft to the preview, no diff yet", () => {
      const h = harness(DEFAULT_BRAND_KIT, [saved]);
      act(() => h.result.current.enterEdit(saved));
      expect(h.onChange).toHaveBeenCalledWith(saved.brandKit);
      expect(h.result.current.editing?.id).toBe("s1");
      expect(h.result.current.editDiff).toBe(false);
    });

    it("draft edits set diff and do not create a Current Theme", () => {
      const h = harness(DEFAULT_BRAND_KIT, [saved]);
      act(() => h.result.current.enterEdit(saved));
      act(() => h.result.current.changeControl({ ...saved.brandKit, primaryColor: "#090909" }));
      expect(h.result.current.editDiff).toBe(true);
      expect(h.result.current.hasUnsavedCurrent).toBe(false);
    });

    it("requestExit with a diff opens the guard and defers the action", () => {
      const h = harness(DEFAULT_BRAND_KIT, [saved]);
      const proceed = vi.fn();
      act(() => h.result.current.enterEdit(saved));
      act(() => h.result.current.changeEditName("Studio X"));
      act(() => h.result.current.requestExit(proceed));
      expect(h.result.current.editGuardOpen).toBe(true);
      expect(proceed).not.toHaveBeenCalled();
    });

    it("requestExit without a diff proceeds immediately", () => {
      const h = harness(DEFAULT_BRAND_KIT, [saved]);
      const proceed = vi.fn();
      act(() => h.result.current.enterEdit(saved));
      act(() => h.result.current.requestExit(proceed));
      expect(proceed).toHaveBeenCalledTimes(1);
      expect(h.result.current.editing).toBeNull();
    });

    it("discardEdit reverts the working kit to pre-edit and exits", () => {
      const h = harness(DEFAULT_BRAND_KIT, [saved]);
      const proceed = vi.fn();
      act(() => h.result.current.enterEdit(saved));
      act(() => h.result.current.changeControl({ ...saved.brandKit, primaryColor: "#090909" }));
      act(() => h.result.current.requestExit(proceed));
      h.onChange.mockClear();
      act(() => h.result.current.discardEdit());
      expect(h.onChange).toHaveBeenCalledWith(DEFAULT_BRAND_KIT); // baseWorkingKit
      expect(h.result.current.editing).toBeNull();
      expect(proceed).toHaveBeenCalledTimes(1);
    });

    it("saveAndExitEdit calls onUpdateTheme then proceeds", async () => {
      const h = harness(DEFAULT_BRAND_KIT, [saved]);
      const proceed = vi.fn();
      act(() => h.result.current.enterEdit(saved));
      act(() => h.result.current.changeEditName("Studio X"));
      act(() => h.result.current.requestExit(proceed));
      await act(async () => { await h.result.current.saveAndExitEdit(); });
      expect(h.onUpdateTheme).toHaveBeenCalledWith("s1", "Studio X", saved.brandKit);
      expect(h.result.current.editing).toBeNull();
      expect(proceed).toHaveBeenCalledTimes(1);
    });

    it("surfaces a duplicate-name error and stays in edit mode", async () => {
      const onUpdateTheme = vi.fn().mockResolvedValue({ error: "theme_name_exists" });
      const { result } = renderHook(() =>
        useThemeEditor({ value: DEFAULT_BRAND_KIT, onChange: vi.fn(), savedThemes: [saved], onUpdateTheme }));
      act(() => result.current.enterEdit(saved));
      act(() => result.current.changeEditName("Dupe"));
      act(() => result.current.requestExit(vi.fn()));
      await act(async () => { await result.current.saveAndExitEdit(); });
      expect(result.current.editGuardError).toBe("theme_name_exists");
      expect(result.current.editing?.id).toBe("s1");
    });
  });
});
```

> The awkward `applyTile(...)` line in test #2 is a guard against accidental key collisions; simplify it to a plain preset tile literal `{ key: "preset:editorial", name: "Editorial", brandKit: editorialKit, variant: "preset" }` when implementing.

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test --run useThemeEditor`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { PortfolioBrandKit, PortfolioSavedTheme } from "@/lib/page-builder/types";
import type { ThemeTileModel } from "./themeTiles";
import {
  type ThemeSelection,
  type EditSession,
  needsOverrideConfirm,
  editHasDiff,
} from "./themeEditorState";

type UpdateResult = { ok: true; theme: PortfolioSavedTheme } | { error: string };

type Options = {
  value: PortfolioBrandKit;
  onChange: (next: PortfolioBrandKit) => void;
  savedThemes: PortfolioSavedTheme[];
  /** Persist edit-mode changes; returns the action result. */
  onUpdateTheme?: (id: string, name: string, brandKit: PortfolioBrandKit) => Promise<UpdateResult>;
};

export function useThemeEditor({ value, onChange, savedThemes, onUpdateTheme }: Options) {
  const [currentTheme, setCurrentTheme] = useState<PortfolioBrandKit | null>(null);
  const [selection, setSelection] = useState<ThemeSelection>({ kind: "none" });
  const [editing, setEditing] = useState<EditSession | null>(null);

  const [pendingOverride, setPendingOverride] = useState<{ nextKit: PortfolioBrandKit; activeKit: PortfolioBrandKit } | null>(null);
  const [editGuardOpen, setEditGuardOpen] = useState(false);
  const [editGuardError, setEditGuardError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  // The deferred exit action captured by requestExit; run after discard/save.
  const pendingExit = useRef<(() => void) | null>(null);

  const editDiff = editHasDiff(editing);
  const hasUnsavedCurrent = currentTheme !== null;

  /** Apply a tile (preset/saved/current). Preserves the Current Theme. */
  const applyTile = useCallback((tile: ThemeTileModel) => {
    onChange(tile.brandKit);
    if (tile.variant === "current") setSelection({ kind: "current" });
    else setSelection({ kind: "tile", key: tile.key });
  }, [onChange]);

  /** Route a base-control edit through the state machine. */
  const changeControl = useCallback((nextKit: PortfolioBrandKit) => {
    if (editing) {
      // In edit mode: mutate the draft, leave the Current Theme untouched.
      setEditing((e) => (e ? { ...e, draftKit: nextKit } : e));
      onChange(nextKit);
      return;
    }
    if (needsOverrideConfirm(selection, currentTheme)) {
      // Building on a different loaded theme would overwrite the Current Theme.
      setPendingOverride({ nextKit, activeKit: value });
      return;
    }
    onChange(nextKit);
    setCurrentTheme(nextKit);
    setSelection({ kind: "current" });
  }, [editing, selection, currentTheme, value, onChange]);

  const confirmOverride = useCallback(() => {
    if (!pendingOverride) return;
    onChange(pendingOverride.nextKit);
    setCurrentTheme(pendingOverride.nextKit);
    setSelection({ kind: "current" });
    setPendingOverride(null);
  }, [pendingOverride, onChange]);

  const cancelOverride = useCallback(() => {
    if (pendingOverride) onChange(pendingOverride.activeKit);
    setPendingOverride(null);
  }, [pendingOverride, onChange]);

  const onCurrentThemeSaved = useCallback((theme: PortfolioSavedTheme) => {
    setCurrentTheme(null);
    setSelection({ kind: "tile", key: `saved:${theme.id}` });
  }, []);

  // ---- edit mode ----
  const enterEdit = useCallback((theme: PortfolioSavedTheme) => {
    setEditing({
      id: theme.id,
      baseTheme: theme,
      baseWorkingKit: value,
      draftKit: theme.brandKit,
      draftName: theme.name,
    });
    onChange(theme.brandKit);
    setSelection({ kind: "tile", key: `saved:${theme.id}` });
  }, [value, onChange]);

  const changeEditName = useCallback((name: string) => {
    setEditing((e) => (e ? { ...e, draftName: name } : e));
  }, []);

  const exitEditNow = useCallback(() => {
    setEditing(null);
    setEditGuardOpen(false);
    setEditGuardError(null);
    const proceed = pendingExit.current;
    pendingExit.current = null;
    proceed?.();
  }, []);

  const requestExit = useCallback((proceed: () => void) => {
    if (editing && editHasDiff(editing)) {
      pendingExit.current = proceed;
      setEditGuardOpen(true);
      return;
    }
    setEditing(null);
    proceed();
  }, [editing]);

  const discardEdit = useCallback(() => {
    if (editing) onChange(editing.baseWorkingKit);
    exitEditNow();
  }, [editing, onChange, exitEditNow]);

  const saveAndExitEdit = useCallback(async () => {
    if (!editing || !onUpdateTheme) return;
    setEditSaving(true);
    setEditGuardError(null);
    try {
      const res = await onUpdateTheme(editing.id, editing.draftName.trim(), editing.draftKit);
      if ("error" in res) {
        setEditGuardError(res.error);
        return;
      }
      onChange(res.theme.brandKit);
      exitEditNow();
    } finally {
      setEditSaving(false);
    }
  }, [editing, onUpdateTheme, onChange, exitEditNow]);

  const cancelEditGuard = useCallback(() => {
    pendingExit.current = null;
    setEditGuardOpen(false);
    setEditGuardError(null);
  }, []);

  return useMemo(() => ({
    currentTheme,
    selection,
    editing,
    hasUnsavedCurrent,
    editDiff,
    applyTile,
    changeControl,
    overrideOpen: pendingOverride !== null,
    confirmOverride,
    cancelOverride,
    enterEdit,
    editName: editing?.draftName ?? "",
    changeEditName,
    requestExit,
    editGuardOpen,
    editGuardError,
    editSaving,
    discardEdit,
    saveAndExitEdit,
    cancelEditGuard,
    onCurrentThemeSaved,
    needsCloseGuard: hasUnsavedCurrent || editDiff,
  }), [
    currentTheme, selection, editing, hasUnsavedCurrent, editDiff, applyTile,
    changeControl, pendingOverride, confirmOverride, cancelOverride, enterEdit,
    changeEditName, requestExit, editGuardOpen, editGuardError, editSaving,
    discardEdit, saveAndExitEdit, cancelEditGuard, onCurrentThemeSaved,
  ]);
}

export type ThemeEditorController = ReturnType<typeof useThemeEditor>;
```

- [ ] **Step 4: Run and confirm pass**

Run: `pnpm test --run useThemeEditor`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/brandKitPicker/useThemeEditor.ts lib/page-builder/brandKitPicker/useThemeEditor.test.ts
git commit -m "feat(portfolio): useThemeEditor controller for current theme + edit mode"
```

---

## Task 9: Locale keys (en/fil/ms/id) + parity test

**Files:**
- Modify: `messages/en.json`, `messages/fil.json`, `messages/ms.json`, `messages/id.json`
- Modify: `lib/page-builder/brandKitPicker/brandKitMessages.test.ts`

Done before the UI integration so integration tests use real messages.

- [ ] **Step 1: Extend the parity test**

In `brandKitMessages.test.ts`, add to `REQUIRED_KEYS`:

```typescript
  "currentTheme",
  "currentThemeBadge",
  "editTheme",
  "editThemeName",
  "overrideCurrentTitle",
  "overrideCurrentBody",
  "continueAction",
  "cancelAction",
  "unsavedChangesTitle",
  "unsavedChangesBody",
  "discardAction",
  "saveAndCloseAction",
  "themeNameExists",
```

And in the interpolation test add:

```typescript
    expect(bk.editTheme).toContain("{name}");
    expect(bk.overrideCurrentBody).toContain("{name}");
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test --run brandKitMessages`
Expected: FAIL — keys missing in all locales.

- [ ] **Step 3: Implement — add keys to each locale**

Add these into `app.pageBuilder.brandKit` in **en.json**:

```json
"currentTheme": "Current Theme",
"currentThemeBadge": "Unsaved",
"editTheme": "Edit theme: {name}",
"editThemeName": "Theme name",
"overrideCurrentTitle": "Replace your current theme?",
"overrideCurrentBody": "Building on \"{name}\" will replace your unsaved Current Theme.",
"continueAction": "Continue",
"cancelAction": "Cancel",
"unsavedChangesTitle": "You have unsaved changes",
"unsavedChangesBody": "Save your changes before closing, or discard them.",
"discardAction": "Discard",
"saveAndCloseAction": "Save & close",
"themeNameExists": "A theme already exists with this name."
```

**fil.json:**

```json
"currentTheme": "Kasalukuyang Tema",
"currentThemeBadge": "Hindi naka-save",
"editTheme": "I-edit ang tema: {name}",
"editThemeName": "Pangalan ng tema",
"overrideCurrentTitle": "Palitan ang kasalukuyang tema?",
"overrideCurrentBody": "Ang pagbuo sa \"{name}\" ay papalit sa hindi naka-save mong Kasalukuyang Tema.",
"continueAction": "Magpatuloy",
"cancelAction": "Kanselahin",
"unsavedChangesTitle": "May hindi naka-save na mga pagbabago",
"unsavedChangesBody": "I-save ang mga pagbabago bago isara, o itapon ang mga ito.",
"discardAction": "Itapon",
"saveAndCloseAction": "I-save at isara",
"themeNameExists": "May tema nang umiiral na may ganitong pangalan."
```

**ms.json:**

```json
"currentTheme": "Tema Semasa",
"currentThemeBadge": "Belum disimpan",
"editTheme": "Edit tema: {name}",
"editThemeName": "Nama tema",
"overrideCurrentTitle": "Gantikan tema semasa anda?",
"overrideCurrentBody": "Membina di atas \"{name}\" akan menggantikan Tema Semasa anda yang belum disimpan.",
"continueAction": "Teruskan",
"cancelAction": "Batal",
"unsavedChangesTitle": "Anda mempunyai perubahan belum disimpan",
"unsavedChangesBody": "Simpan perubahan anda sebelum menutup, atau buang perubahan tersebut.",
"discardAction": "Buang",
"saveAndCloseAction": "Simpan & tutup",
"themeNameExists": "Sudah wujud tema dengan nama ini."
```

**id.json:**

```json
"currentTheme": "Tema Saat Ini",
"currentThemeBadge": "Belum disimpan",
"editTheme": "Edit tema: {name}",
"editThemeName": "Nama tema",
"overrideCurrentTitle": "Ganti tema saat ini Anda?",
"overrideCurrentBody": "Membangun di atas \"{name}\" akan mengganti Tema Saat Ini Anda yang belum disimpan.",
"continueAction": "Lanjutkan",
"cancelAction": "Batal",
"unsavedChangesTitle": "Anda memiliki perubahan yang belum disimpan",
"unsavedChangesBody": "Simpan perubahan Anda sebelum menutup, atau buang perubahan tersebut.",
"discardAction": "Buang",
"saveAndCloseAction": "Simpan & tutup",
"themeNameExists": "Sudah ada tema dengan nama ini."
```

> Place each block consistently inside the existing `app.pageBuilder.brandKit` object (after the prior theme-grid keys). Keep JSON valid (commas).

- [ ] **Step 4: Run and confirm pass**

Run: `pnpm test --run brandKitMessages`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add messages/en.json messages/fil.json messages/ms.json messages/id.json lib/page-builder/brandKitPicker/brandKitMessages.test.ts
git commit -m "feat(portfolio): locale keys for current theme + edit mode (en/fil/ms/id)"
```

---

## Task 10: `SaveThemePopover` — controllable open + client uniqueness

**Files:**
- Modify: `lib/page-builder/brandKitPicker/SaveThemePopover.tsx`
- Test: `lib/page-builder/brandKitPicker/SaveThemePopover.test.tsx`

Adds (a) optional controlled `open`/`onOpenChange` so the close-guard can force it open, and (b) a `takenNames` check producing the `themeNameExists` error before the round-trip.

- [ ] **Step 1: Add failing tests**

Append:

```typescript
it("blocks a duplicate name with an inline error before saving", async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  renderWithProviders(
    <SaveThemePopover onSave={onSave} atLimit={false} takenNames={["sunset"]} />,
    { messages: { ...messages, app: { ...messages.app, pageBuilder: { ...messages.app.pageBuilder, brandKit: { ...messages.app.pageBuilder.brandKit, themeNameExists: "A theme already exists with this name." } } } } }
  );
  fireEvent.click(screen.getByRole("button", { name: "Save current as theme" }));
  const input = await screen.findByPlaceholderText("Theme name");
  fireEvent.change(input, { target: { value: "  SUNSET " } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByText("A theme already exists with this name.")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test --run SaveThemePopover`
Expected: FAIL — `takenNames` unsupported; no uniqueness check.

- [ ] **Step 3: Implement**

In `SaveThemePopover.tsx`:

- Import the helper: `import { normalizeThemeName } from "@/lib/page-builder/themeNames";`
- Extend `Props`:

```typescript
type Props = {
  onSave: (name: string) => Promise<void>;
  atLimit: boolean;
  /** Existing names (any case) to reject as duplicates before saving. */
  takenNames?: string[];
  /** Optional controlled open state (used by the close-guard). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};
```

- Support controlled/uncontrolled open:

```typescript
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = (o: boolean) => { onOpenChange?.(o); if (open === undefined) setInternalOpen(o); if (!o) setError(null); };
```

  Replace the `<Popover open={open} onOpenChange=...>` usage with `open={isOpen} onOpenChange={setOpen}` and remove the old local `open` state declaration.

- In `handleSave`, after the empty/length checks and before `setSaving(true)`:

```typescript
    if ((props.takenNames ?? []).some((n) => normalizeThemeName(n) === normalizeThemeName(trimmed))) {
      setError(t("themeNameExists"));
      return;
    }
```

  (Destructure `takenNames` from props alongside the others, or reference via the destructured name.)

- [ ] **Step 4: Run and confirm pass**

Run: `pnpm test --run SaveThemePopover`
Expected: PASS (existing tests still pass — `takenNames` defaults to none, open stays uncontrolled).

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/brandKitPicker/SaveThemePopover.tsx lib/page-builder/brandKitPicker/SaveThemePopover.test.tsx
git commit -m "feat(portfolio): save popover controllable open + duplicate-name guard"
```

---

## Task 11: `ThemeGrid` — current tile, edit button, dialogs

**Files:**
- Modify: `lib/page-builder/brandKitPicker/ThemeGrid.tsx`
- Test: `lib/page-builder/brandKitPicker/ThemeGrid.test.tsx`

`ThemeGrid` now consumes the controller. It builds real tiles, the current tile, paginates with the reserved cell, renders edit buttons + dialogs, and feeds duplicate names to the save popover.

**New props:**

```typescript
type Props = {
  value: PortfolioBrandKit;
  savedThemes: PortfolioSavedTheme[];
  controller: ThemeEditorController;
  onSaveTheme?: (name: string) => Promise<void>;
  onDeleteTheme?: (id: string) => Promise<void>;
};
```

`onChange` is gone — all kit changes flow through `controller.applyTile` / `controller.changeControl` (the latter is wired in BrandKitPicker, not the grid). Tiles call `controller.applyTile(tile)`; saved tiles' edit button calls `controller.enterEdit(theme)`; clicking any tile while editing routes through `controller.requestExit(() => controller.applyTile(tile))`.

- [ ] **Step 1: Update the existing tests + add new ones**

The existing `ThemeGrid.test.tsx` calls `setup()` with `value/onChange/...`. Update `setup` to build a controller and pass it. Add a test helper that wraps `useThemeEditor`:

```typescript
import { useThemeEditor } from "./useThemeEditor";

function Harness({ savedThemes = [], onSaveTheme, onDeleteTheme, onChange = () => {} }: {
  savedThemes?: PortfolioSavedTheme[];
  onSaveTheme?: (n: string) => Promise<void>;
  onDeleteTheme?: (id: string) => Promise<void>;
  onChange?: (k: typeof DEFAULT_BRAND_KIT) => void;
}) {
  const [value, setValue] = useState(DEFAULT_BRAND_KIT);
  const controller = useThemeEditor({
    value,
    onChange: (k) => { setValue(k); onChange(k); },
    savedThemes,
    onUpdateTheme: async () => ({ ok: true, theme: { id: "x", name: "x", brandKit: value } }),
  });
  return (
    <ThemeGrid value={value} savedThemes={savedThemes} controller={controller}
      onSaveTheme={onSaveTheme} onDeleteTheme={onDeleteTheme} />
  );
}
```

Keep the existing behavioral assertions but drive them through `Harness` (preset-apply still calls `onChange` with the full kit; pagination still 9 with no current tile; search/empty; delete only on saved; selected marking). Add:

```typescript
it("renders an edit button only on saved tiles", () => {
  renderWithProviders(<Harness savedThemes={manySaved(1)} onSaveTheme={vi.fn()} />, { messages });
  expect(screen.queryByRole("button", { name: "Edit theme: Minimal" })).toBeNull();
  expect(screen.getByRole("button", { name: "Edit theme: Saved 0" })).toBeInTheDocument();
});

it("shows a pinned Current Theme tile after a divergent edit and reserves a cell", () => {
  // 8 saved + 6 presets = 14 reals; with a current theme, page 1 shows 8 reals + current.
  renderWithProviders(<Harness savedThemes={manySaved(8)} onSaveTheme={vi.fn()} />, { messages });
  // simulate divergence by applying a preset then editing is done at picker level;
  // here assert the grid renders the current tile when controller has one:
  // (covered more fully in BrandKitPicker integration — Task 12)
});
```

> The full divergence-driven current-tile assertions live in the BrandKitPicker integration test (Task 12), since `changeControl` is wired there. Keep ThemeGrid tests focused on rendering given a controller state.

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test --run ThemeGrid`
Expected: FAIL — prop shape changed; `controller` required.

- [ ] **Step 3: Implement**

Rewrite `ThemeGrid.tsx`:

```typescript
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
  buildCurrentTile,
  filterThemeTiles,
  paginateWithCurrent,
  brandKitsEqualForSelection,
  type ThemeTileModel,
} from "./themeTiles";
import { ThemeTile } from "./ThemeTile";
import { SaveThemePopover } from "./SaveThemePopover";
import { ConfirmDialog } from "./ConfirmDialog";
import type { ThemeEditorController } from "./useThemeEditor";

type Props = {
  value: PortfolioBrandKit;
  savedThemes: PortfolioSavedTheme[];
  controller: ThemeEditorController;
  onSaveTheme?: (name: string) => Promise<void>;
  onDeleteTheme?: (id: string) => Promise<void>;
};

export function ThemeGrid({ value, savedThemes, controller, onSaveTheme, onDeleteTheme }: Props) {
  const t = useTranslations("app.pageBuilder.brandKit");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const presetName = (id: BrandKitThemePreset) => t(`presets.${id}`);
  const realTiles = filterThemeTiles(buildThemeTiles({ presetName, savedThemes }), query);
  const currentTile = controller.hasUnsavedCurrent
    ? buildCurrentTile(controller.currentTheme!, t("currentTheme"))
    : null;
  const { pageItems, pageCount, page: safePage } = paginateWithCurrent(realTiles, currentTile, page);

  function isSelected(tile: ThemeTileModel): boolean {
    if (tile.variant === "current") return controller.selection.kind === "current";
    return brandKitsEqualForSelection(tile.brandKit, value) && controller.selection.kind !== "current";
  }

  function applyWithGuard(tile: ThemeTileModel) {
    controller.requestExit(() => controller.applyTile(tile));
  }

  function editWithGuard(theme: PortfolioSavedTheme) {
    controller.requestExit(() => controller.enterEdit(theme));
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await onDeleteTheme?.(id);
    } finally {
      setDeletingId(null);
    }
  }

  const savedById = new Map(savedThemes.map((s) => [s.id, s]));

  return (
    <section aria-label={t("themes")} className="flex flex-col gap-3">
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
          <SaveThemePopover
            onSave={onSaveTheme}
            atLimit={savedThemes.length >= SAVED_THEMES_MAX}
            takenNames={savedThemes.map((s) => s.name)}
          />
        )}
      </div>

      {pageItems.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {pageItems.map((tile) => {
            const saved = tile.savedThemeId ? savedById.get(tile.savedThemeId) : undefined;
            return (
              <ThemeTile
                key={tile.key}
                tile={tile}
                selected={isSelected(tile)}
                editing={!!saved && controller.editing?.id === saved.id}
                applyLabel={t("applyTheme", { name: tile.name })}
                currentBadge={tile.variant === "current" ? t("currentThemeBadge") : undefined}
                editLabel={saved ? t("editTheme", { name: tile.name }) : undefined}
                deleteLabel={saved && onDeleteTheme ? t("deleteTheme", { name: tile.name }) : undefined}
                deleting={deletingId === tile.savedThemeId}
                onApply={() => applyWithGuard(tile)}
                onEdit={saved ? () => editWithGuard(saved) : undefined}
                onDelete={saved && onDeleteTheme ? () => void handleDelete(saved.id) : undefined}
              />
            );
          })}
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("noThemesMatch")}</p>
      )}

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

      <ConfirmDialog
        open={controller.overrideOpen}
        title={t("overrideCurrentTitle")}
        body={t("overrideCurrentBody", { name: currentTileBaseName(controller) })}
        confirmLabel={t("continueAction")}
        cancelLabel={t("cancelAction")}
        onConfirm={controller.confirmOverride}
        onCancel={controller.cancelOverride}
      />
    </section>
  );
}

/** Name of the tile being built upon, for the override message. */
function currentTileBaseName(controller: ThemeEditorController): string {
  return controller.selection.kind === "tile" ? controller.selection.key.replace(/^(preset|saved):/, "") : "";
}
```

> The override body's `{name}` should ideally be the active theme's display name. A pragmatic source is the selection key; if you want the localized/saved name, thread the active tile's `name` into the controller when `applyTile` runs (store `lastTileName` in the hook) and expose it. Keep it simple: storing `selectionName` in the hook is acceptable — add a `selectionName` field set in `applyTile`/`enterEdit` and read it here. Update the hook + its test if you take this route.

- [ ] **Step 4: Run and confirm pass**

Run: `pnpm test --run ThemeGrid`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/brandKitPicker/ThemeGrid.tsx lib/page-builder/brandKitPicker/ThemeGrid.test.tsx
git commit -m "feat(portfolio): theme grid renders current tile, edit buttons, override dialog"
```

---

## Task 12: `BrandKitPicker` — controller wiring + edit-mode draft + edit bar

**Files:**
- Modify: `lib/page-builder/brandKitPicker/BrandKitPicker.tsx`
- Create: `lib/page-builder/brandKitPicker/EditThemeBar.tsx`
- Test: `lib/page-builder/brandKitPicker/BrandKitPicker.test.tsx`, `lib/page-builder/brandKitPicker/EditThemeBar.test.tsx`

BrandKitPicker now:
- Accepts an optional `controller` prop; when absent, creates its own via `useThemeEditor` (keeps the component independently testable).
- Routes ALL base-control edits (`set`, `setFont`, `useWorkspaceBranding`) through `controller.changeControl(nextKit)` instead of calling `onChange` directly.
- Renders `EditThemeBar` (name input + exit) while `controller.editing`.
- Renders the `UnsavedEditDialog` bound to the edit guard.
- Passes `controller` + `onSaveTheme`/`onDeleteTheme` to `ThemeGrid` (no `onChange` to the grid).

**`EditThemeBar`** — a compact bar shown above the editors while editing:

```typescript
"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

type Props = {
  name: string;
  onNameChange: (name: string) => void;
  onExit: () => void;
};

export function EditThemeBar({ name, onNameChange, onExit }: Props) {
  const t = useTranslations("app.pageBuilder.brandKit");
  return (
    <div className="flex items-center gap-2 border border-foreground bg-accent/20 p-2">
      <input
        type="text"
        value={name}
        maxLength={60}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={t("editThemeName")}
        aria-label={t("editThemeName")}
        className="h-9 min-w-0 flex-1 border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <Button type="button" size="sm" variant="outline" onClick={onExit} className="gap-1.5">
        <XIcon className="size-3.5" aria-hidden />
        {t("cancelAction")}
      </Button>
    </div>
  );
}
```

- [ ] **Step 1: Tests**

`EditThemeBar.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { EditThemeBar } from "./EditThemeBar";

describe("EditThemeBar", () => {
  it("edits the name and exits", () => {
    const onNameChange = vi.fn();
    const onExit = vi.fn();
    renderWithProviders(<EditThemeBar name="Studio" onNameChange={onNameChange} onExit={onExit} />);
    fireEvent.change(screen.getByLabelText("Theme name"), { target: { value: "Studio X" } });
    expect(onNameChange).toHaveBeenCalledWith("Studio X");
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
```

In `BrandKitPicker.test.tsx`, keep all existing tests (they exercise the uncontrolled path and must still pass — preset apply, font selectors, color popovers, workspace branding, saved-theme apply/delete, save-control show/hide). Add an integration test for divergence:

```typescript
it("shows a Current Theme tile after a divergent color edit", () => {
  setup({ onSaveTheme: vi.fn() });
  // start on Minimal (== default); change the accent so the kit diverges
  fireEvent.click(screen.getByRole("button", { name: /accent/i }));
  fireEvent.change(screen.getByLabelText("Accent hex"), { target: { value: "abcabc" } });
  expect(screen.getByRole("button", { name: "Apply theme: Current Theme" })).toBeInTheDocument();
  expect(screen.getByText("Unsaved")).toBeInTheDocument();
});

it("enters edit mode from a saved tile and shows the name bar", () => {
  const themes = [{ id: "t1", name: "Sunset", brandKit: { ...DEFAULT_BRAND_KIT, accentColor: "#e87a4f" } }];
  setup({ savedThemes: themes, onSaveTheme: vi.fn() });
  fireEvent.click(screen.getByRole("button", { name: "Edit theme: Sunset" }));
  expect(screen.getByLabelText("Theme name")).toHaveValue("Sunset");
});
```

> `setup` renders `<BrandKitPicker value={DEFAULT_BRAND_KIT} onChange={onChange} .../>`. With the uncontrolled controller, `onChange` updates are not reflected back into `value` (the test passes a static value). For the divergence test to show the Current Theme tile, BrandKitPicker must keep an internal "working value" mirror when uncontrolled OR the test must re-render with the new value. Simplest: in the **uncontrolled** path, BrandKitPicker maintains `const [internalValue, setInternalValue] = useState(value)` and uses `internalValue` for rendering, calling both `setInternalValue` and the prop `onChange`. Document this in the implementation (it does not affect the controlled path used by ThemePanelDialog, which passes `value` back down).

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test --run BrandKitPicker EditThemeBar`
Expected: FAIL.

- [ ] **Step 3: Implement**

Update `BrandKitPicker.tsx`:

- Add imports:

```typescript
import { useState } from "react";
import { useThemeEditor, type ThemeEditorController } from "./useThemeEditor";
import { EditThemeBar } from "./EditThemeBar";
import { UnsavedEditDialog } from "./UnsavedEditDialog";
import type { PortfolioSavedTheme } from "@/lib/page-builder/types";
```

- Extend `Props`:

```typescript
  /** Optional shared controller (provided by ThemePanelDialog for close-guard). */
  controller?: ThemeEditorController;
  /** Persist edit-mode changes. */
  onUpdateTheme?: (id: string, name: string, brandKit: PortfolioBrandKit) => Promise<{ ok: true; theme: PortfolioSavedTheme } | { error: string }>;
```

- At the top of the component body, set up the working value + controller:

```typescript
  // Uncontrolled mirror so standalone usage (and tests) reflect edits in the grid.
  const [internalValue, setInternalValue] = useState(value);
  const isControlled = controller !== undefined;
  const workingValue = isControlled ? value : internalValue;
  const emitChange = (next: PortfolioBrandKit) => {
    if (!isControlled) setInternalValue(next);
    onChange(next);
  };
  const ownController = useThemeEditor({
    value: workingValue,
    onChange: emitChange,
    savedThemes,
    onUpdateTheme,
  });
  const ctrl = controller ?? ownController;
```

- Replace the font/color/branding mutators to route through `ctrl.changeControl`:

```typescript
  function set<K extends keyof PortfolioBrandKit>(key: K, v: PortfolioBrandKit[K]) {
    ctrl.changeControl({ ...workingValue, [key]: v });
  }
  function setFont(slot: "headingFont" | "bodyFont", key: PortfolioFontKey) {
    ctrl.changeControl({ ...workingValue, [slot]: key });
  }
  function useWorkspaceBranding() {
    if (!workspaceBranding) return;
    const next = { ...workingValue };
    if (workspaceBranding.primaryColor && HEX_RE.test(workspaceBranding.primaryColor)) next.primaryColor = workspaceBranding.primaryColor;
    if (workspaceBranding.secondaryColor && HEX_RE.test(workspaceBranding.secondaryColor)) next.secondaryColor = workspaceBranding.secondaryColor;
    ctrl.changeControl(next);
  }
```

- Use `workingValue` everywhere `value` was read for rendering (font derivation, color swatches). E.g. `const resolvedFonts = legacyFontPairToFonts(workingValue.fontPair);` and `value[key]` → `workingValue[key]`.

- Replace the `<ThemeGrid .../>` usage:

```typescript
        <ThemeGrid
          value={workingValue}
          savedThemes={savedThemes}
          controller={ctrl}
          onSaveTheme={onSaveTheme}
          onDeleteTheme={onDeleteTheme}
        />
```

- Render the edit bar above the Fonts section when editing, and the unsaved-edit dialog at the end:

```typescript
      {ctrl.editing && (
        <EditThemeBar
          name={ctrl.editName}
          onNameChange={ctrl.changeEditName}
          onExit={() => ctrl.requestExit(() => {})}
        />
      )}
```

  …and just before the closing `</div>`:

```typescript
      <UnsavedEditDialog
        open={ctrl.editGuardOpen}
        title={t("unsavedChangesTitle")}
        body={t("unsavedChangesBody")}
        discardLabel={t("discardAction")}
        saveLabel={t("saveAndCloseAction")}
        saving={ctrl.editSaving}
        error={ctrl.editGuardError ? t("themeNameExists") : null}
        onDiscard={ctrl.discardEdit}
        onSaveAndClose={() => void ctrl.saveAndExitEdit()}
        onOpenChange={(o) => { if (!o) ctrl.cancelEditGuard(); }}
      />
```

> The grid's save popover converts the Current Theme. After a successful save the parent updates `savedThemes` and the working kit no longer needs the current tile — but the hook must be told. Thread `onSaveTheme` so that on success it calls `ctrl.onCurrentThemeSaved(theme)`. The cleanest place is ThemePanelDialog's `handleSaveTheme` (Task 13), which already has the saved theme; have it call `controller.onCurrentThemeSaved(res.theme)`. For the **uncontrolled** path, wrap `onSaveTheme` here so it also calls `ownController.onCurrentThemeSaved` — but since standalone usage has no real persistence, this is optional and can be left to the controlled path.

- [ ] **Step 4: Run and confirm pass**

Run: `pnpm test --run BrandKitPicker EditThemeBar`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/brandKitPicker/BrandKitPicker.tsx lib/page-builder/brandKitPicker/BrandKitPicker.test.tsx lib/page-builder/brandKitPicker/EditThemeBar.tsx lib/page-builder/brandKitPicker/EditThemeBar.test.tsx
git commit -m "feat(portfolio): brand kit picker wires controller, edit bar, unsaved-edit dialog"
```

---

## Task 13: `ThemePanelDialog` — own controller, close-guard, update wiring

**Files:**
- Modify: `app/[locale]/(app)/portfolio/_components/ThemePanelDialog.tsx`
- Test: `app/[locale]/(app)/portfolio/_components/ThemePanelDialog.test.tsx` (create if absent; otherwise extend)

ThemePanelDialog owns the controller so it can guard the modal close. On close attempt:
- If `controller.editDiff` → run the edit guard (delegate to the picker's dialog by calling `controller.requestExit(actualClose)`).
- Else if `controller.hasUnsavedCurrent` → show the close-guard `ConfirmDialog` (Discard / Save & close). Discard → revert via existing `onCancel`. Save & close → open the SaveThemePopover (controlled) to name it; on success persist the page + close.
- Else → close normally.

- [ ] **Step 1: Tests**

> First read any existing test for this component to mirror mocking of `updateBrandKitAction`/`saveThemeAction`/`deleteThemeAction` and `next-intl`. Mock the actions module: `vi.mock("../_actions", () => ({ updateBrandKitAction: vi.fn().mockResolvedValue({ ok: true }), saveThemeAction: vi.fn(), deleteThemeAction: vi.fn(), updateThemeAction: vi.fn().mockResolvedValue({ ok: true, theme: {...} }) }))`.

```typescript
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { ThemePanelDialog } from "./ThemePanelDialog";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";

vi.mock("../_actions", () => ({
  updateBrandKitAction: vi.fn().mockResolvedValue({ ok: true }),
  saveThemeAction: vi.fn().mockResolvedValue({ ok: true, theme: { id: "n", name: "X", brandKit: DEFAULT_BRAND_KIT } }),
  deleteThemeAction: vi.fn().mockResolvedValue({ ok: true }),
  updateThemeAction: vi.fn().mockResolvedValue({ ok: true, theme: { id: "s1", name: "Y", brandKit: DEFAULT_BRAND_KIT } }),
}));

function setup(over = {}) {
  const props = {
    open: true,
    brandKit: DEFAULT_BRAND_KIT,
    onBrandKitChange: vi.fn(),
    onSaved: vi.fn(),
    onCancel: vi.fn(),
    savedThemes: [],
    onSavedThemesChange: vi.fn(),
    ...over,
  };
  renderWithProviders(<ThemePanelDialog {...props} />);
  return props;
}

describe("ThemePanelDialog close guard", () => {
  it("closes without a guard when there are no unsaved theme changes", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(props.onCancel).toHaveBeenCalled();
  });

  it("guards close when an unsaved Current Theme exists", () => {
    const onCancel = vi.fn();
    setup({ onCancel });
    // diverge: open accent popover, type a hex
    fireEvent.click(screen.getByRole("button", { name: /accent/i }));
    fireEvent.change(screen.getByLabelText("Accent hex"), { target: { value: "abcabc" } });
    // attempt to close
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.getByText("You have unsaved changes")).toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
    // Discard reverts/closes
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test --run ThemePanelDialog`
Expected: FAIL.

- [ ] **Step 3: Implement**

Rewrite `ThemePanelDialog.tsx` to own the controller and the close-guard. Key changes:

```typescript
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BrandKitPicker } from "@/lib/page-builder/brandKitPicker/BrandKitPicker";
import { useThemeEditor } from "@/lib/page-builder/brandKitPicker/useThemeEditor";
import { ConfirmDialog } from "@/lib/page-builder/brandKitPicker/ConfirmDialog";
import { SaveThemePopover } from "@/lib/page-builder/brandKitPicker/SaveThemePopover";
import type { PortfolioBrandKit, PortfolioSavedTheme } from "@/lib/page-builder/types";
import { updateBrandKitAction, saveThemeAction, deleteThemeAction, updateThemeAction } from "../_actions";

// ...Props unchanged...

export function ThemePanelDialog({
  open, brandKit, onBrandKitChange, onSaved, onCancel, savedThemes, onSavedThemesChange,
}: Props) {
  const t = useTranslations("app.pageBuilder.editor");
  const tk = useTranslations("app.pageBuilder.brandKit");
  const [saving, setSaving] = useState(false);
  const [closeGuardOpen, setCloseGuardOpen] = useState(false);
  const [savePopoverOpen, setSavePopoverOpen] = useState(false);

  const controller = useThemeEditor({
    value: brandKit,
    onChange: onBrandKitChange,
    savedThemes,
    onUpdateTheme: async (id, name, kit) => {
      const res = await updateThemeAction(id, name, kit);
      if ("ok" in res) onSavedThemesChange(savedThemes.map((s) => (s.id === id ? res.theme : s)));
      return res;
    },
  });

  async function persistPage() {
    setSaving(true);
    try {
      const res = await updateBrandKitAction(brandKit);
      if ("error" in res) { toast.error(t("errorToast")); return false; }
      toast.success(t("savedToast"));
      onSaved();
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTheme(name: string) {
    const res = await saveThemeAction(name, brandKit);
    if ("error" in res) throw new Error(res.error);
    onSavedThemesChange([...savedThemes, res.theme]);
    controller.onCurrentThemeSaved(res.theme);
  }

  async function handleDeleteTheme(id: string) {
    const previous = savedThemes;
    onSavedThemesChange(previous.filter((s) => s.id !== id));
    const res = await deleteThemeAction(id);
    if ("error" in res) { onSavedThemesChange(previous); toast.error("Could not delete theme. Please try again."); }
  }

  /** Intercept any close (X / Esc / Cancel button). */
  function attemptClose() {
    if (controller.editDiff) {
      controller.requestExit(() => onCancel());
      return;
    }
    if (controller.hasUnsavedCurrent) {
      setCloseGuardOpen(true);
      return;
    }
    onCancel();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) attemptClose(); }}>
        <DialogContent className="flex max-h-[100dvh] h-[100dvh] w-screen max-w-[100vw] flex-col overflow-hidden sm:h-auto sm:max-h-[85vh] sm:w-auto sm:max-w-2xl lg:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t("themeDialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
            <BrandKitPicker
              value={brandKit}
              onChange={onBrandKitChange}
              controller={controller}
              savedThemes={savedThemes}
              onSaveTheme={handleSaveTheme}
              onDeleteTheme={handleDeleteTheme}
              onUpdateTheme={updateThemeAction}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={attemptClose} disabled={saving}>
              {t("publishDialog.cancel")}
            </Button>
            <Button type="button" onClick={() => void persistPage()} loading={saving}>
              {saving ? t("save.saving") : t("contactDialog.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal-close guard for an unsaved Current Theme */}
      <ConfirmDialog
        open={closeGuardOpen}
        title={tk("unsavedChangesTitle")}
        body={tk("unsavedChangesBody")}
        confirmLabel={tk("saveAndCloseAction")}
        cancelLabel={tk("discardAction")}
        onConfirm={() => { setCloseGuardOpen(false); setSavePopoverOpen(true); }}
        onCancel={() => { setCloseGuardOpen(false); onCancel(); }}
      />

      {/* Hidden save popover the close-guard opens to name the Current Theme */}
      {savePopoverOpen && (
        <div className="fixed bottom-4 right-4 z-50">
          <SaveThemePopover
            open={savePopoverOpen}
            onOpenChange={setSavePopoverOpen}
            atLimit={savedThemes.length >= SAVED_THEMES_MAX}
            takenNames={savedThemes.map((s) => s.name)}
            onSave={async (name) => {
              await handleSaveTheme(name);
              setSavePopoverOpen(false);
              await persistPage();
            }}
          />
        </div>
      )}
    </>
  );
}
```

> Import `SAVED_THEMES_MAX` from `@/lib/page-builder/types`. The close-guard uses `ConfirmDialog` where **Cancel = Discard** (safe, reverts via `onCancel`) and **Confirm = Save & close** (opens the popover, then persists). If the floating popover proves awkward at 375px, an acceptable alternative is to add a name input directly to a dedicated close-guard dialog — but the spec chose "route to the existing save popover," so keep this unless review says otherwise.

- [ ] **Step 4: Run and confirm pass**

Run: `pnpm test --run ThemePanelDialog`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(app)/portfolio/_components/ThemePanelDialog.tsx" "app/[locale]/(app)/portfolio/_components/ThemePanelDialog.test.tsx"
git commit -m "feat(portfolio): theme panel close-guard + update-theme wiring"
```

---

## Task 14: Full verification sweep

**Files:** none (verification only).

- [ ] **Step 1: Run the brandKitPicker + portfolio suites**

Run: `pnpm test --run brandKitPicker themeNames _actions ThemePanelDialog`
Expected: all PASS.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: exit 0. Fix any type errors (common: `value` vs `workingValue` reads, `ThemeTileModel.variant` required in fixtures, controller prop threading).

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no new errors in touched files.

- [ ] **Step 4: Commit any fixups**

```bash
git add -A
git commit -m "chore(portfolio): typecheck/lint fixups for theme editor"
```

> Do not run the entire suite unless doing a pre-merge sweep (per project testing guidance — targeted tests during development).

---

## Self-Review (completed by plan author)

**Spec coverage:**
- §1 state — Task 8 hook.
- §2 state machine (silent create, override confirm, preserve current, reselect) — Tasks 3 + 8 (+ integration in 12/13).
- §3 lifecycle (save/override/close deletion) — Tasks 8 (save/override), 13 (close).
- §4 grid/pagination reserve + pinned current — Tasks 1, 11.
- §5 edit mode (entry, draft, diff, exit guard, discard-revert, save) — Tasks 3, 6, 8, 12.
- §6 dialogs (override, unsaved-edit, modal-close) — Tasks 7, 11, 12, 13.
- §7 uniqueness client+server — Tasks 2, 4, 5, 10.
- §8 server actions — Tasks 4, 5.
- §9 components — Tasks 6, 11, 12, 13.
- §10 locales — Task 9.
- Testing matrix — covered per task.

**Type consistency:** `ThemeEditorController` (Task 8) is the single controller type threaded through Tasks 11–13; `ThemeTileModel.variant` (Task 1) used everywhere; `SaveThemeResult` reused for `updateThemeAction`.

**Open implementation notes flagged inline** (not placeholders — explicit decisions for the implementer): override-message name source (store `selectionName` in hook if the key-derived name is unacceptable); uncontrolled `internalValue` mirror in BrandKitPicker; close-guard floating popover vs inline name input. Each has a concrete default to ship.
