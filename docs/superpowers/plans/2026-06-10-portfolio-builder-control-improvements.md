# Portfolio Builder Control Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship seven portfolio-builder editor improvements: configurable carousel heading gap, preset rename, root-page styling, padding relocation, gallery-section container parity, a live Collections Popup tab, and a fix for the preview HTTP 431.

**Architecture:** All changes live in the Puck-based portfolio builder under `lib/page-builder/` and `app/[locale]/(app)/portfolio/_components/`. Block editor controls are a custom Puck field (`StyleToolkitField.tsx`) with Content/Design/Layout tabs. Styling serializes into `_style: BlockStyle` (blocks) or new root/popup config objects. The preview iframe currently inlines the whole draft into its URL; we move it to `localStorage` (already populated by `persistLocalDraft`) and client-render the preview.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Puck (`@measured/puck`), Tailwind v4, Vitest + Testing Library (happy-dom), next-intl.

**Reference spec:** `docs/superpowers/specs/2026-06-10-portfolio-builder-control-improvements-design.md`

**Test command:** `pnpm test --run <fragment>` (per-file). Full sweep: `pnpm test`. Also `pnpm typecheck` and `pnpm lint` before done.

**Conventions:**
- Editor chrome is English-only; no locale files to touch.
- Commit after each task. Never mention AI tools in commits/code.
- Block styling primitives live in `lib/page-builder/toolbarPrimitives` (`ToolbarToggle`, `ColorSwatchRow`, `NumberInputRow`, `DimensionInput`, `IconRow`, `ResetButton`).

---

## File map

| File | Responsibility | Touched by |
|------|----------------|-----------|
| `lib/page-builder/blocks/sectionPresets.ts` | Preset labels/defaults | Group A |
| `lib/page-builder/blocks/GalleryText.tsx` | `GalleryHeader` (heading+desc render) | Group B |
| `lib/page-builder/blocks/GalleryCarouselBlock.tsx` | Carousel render + config | Group B |
| `lib/page-builder/styleToolkit.ts` | `BlockStyle` type + `resolveBlockStyle` | Group B |
| `lib/page-builder/StyleToolkitField.tsx` | Editor tabs/panels, type sets | Groups B, C |
| `lib/page-builder/editorConfig.tsx` | Editor Puck config + root field | Group D |
| `lib/page-builder/config.ts` | Production Puck config + root render | Group D |
| `lib/page-builder/rootStyle.ts` (new) | Root page style type + CSS resolver | Group D |
| `lib/page-builder/RootStyleField.tsx` (new) | Root Design/Layout panel | Group D |
| `lib/page-builder/types.ts` | `PortfolioCollectionsPopupConfig` | Group E |
| `lib/page-builder/blocks/CollectionPopupChrome.tsx` (new) | Shared popup chrome (shell+title+close) | Group E |
| `lib/page-builder/blocks/CollectionPopup.tsx` | Public popup uses shared chrome | Group E |
| `.../portfolio/_components/CollectionsPopupPreview.tsx` (new) | Editor live preview pane | Group E |
| `.../portfolio/_components/CollectionsPopupPanelDialog.tsx` | Sidebar controls + new drawers | Group E |
| `.../portfolio/_components/EditorShell.tsx` | Preview URL + popup tab layout | Groups E, F |
| `app/[locale]/portfolio-preview/page.tsx` | Server shell for preview | Group F |
| `.../portfolio-preview/_components/PreviewClient.tsx` (new) | Client renderer reading localStorage | Group F |

---

## Group A — Rename "Masonry" preset to "Gallery Masonry" (Scope 2)

### Task A1: Rename the Gallery Masonry preset label

**Files:**
- Modify: `lib/page-builder/blocks/sectionPresets.ts:174`
- Test: `lib/page-builder/blocks/sectionPresets.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

Create/append `lib/page-builder/blocks/sectionPresets.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { SECTION_PRESETS } from "./sectionPresets";

describe("SECTION_PRESETS labels", () => {
  it("labels the masonry section preset 'Gallery Masonry'", () => {
    expect(SECTION_PRESETS.GalleryMasonryPreset.label).toBe("Gallery Masonry");
  });
  it("keeps the other gallery preset labels", () => {
    expect(SECTION_PRESETS.GalleryGridPreset.label).toBe("Gallery Grid");
    expect(SECTION_PRESETS.FeaturedWorkPreset.label).toBe("Featured Work");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run sectionPresets`
Expected: FAIL — received `"Masonry"`, expected `"Gallery Masonry"`.

- [ ] **Step 3: Make the change**

In `lib/page-builder/blocks/sectionPresets.ts`, line 174, change:

```ts
  GalleryMasonryPreset: { label: "Masonry", defaultProps: GALLERY_MASONRY_PRESET },
```

to:

```ts
  GalleryMasonryPreset: { label: "Gallery Masonry", defaultProps: GALLERY_MASONRY_PRESET },
```

(Leave the standalone `galleryMasonryBlockConfig.label = "Masonry"` in `GalleryMasonryBlock.tsx` unchanged — scope is preset label only.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run sectionPresets`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/blocks/sectionPresets.ts lib/page-builder/blocks/sectionPresets.test.ts
git commit -m "feat(portfolio): rename Masonry section preset to Gallery Masonry"
```

---

## Group B — Carousel heading↔description gap (Scope 1)

Currently `GalleryHeader` (`GalleryText.tsx:108-109`) hardcodes the description top margin to `0.5rem`. We add a configurable gap, stored on `_style.headingGap`, surfaced in the carousel's **Layout** tab, threaded through `GalleryCarouselBlock` into `GalleryHeader`.

### Task B1: Add `headingGap` to `BlockStyle` and honor it in `GalleryHeader`

**Files:**
- Modify: `lib/page-builder/styleToolkit.ts:106-107` (add field near carousel fields)
- Modify: `lib/page-builder/blocks/GalleryText.tsx:74-109`
- Test: `lib/page-builder/blocks/GalleryText.test.tsx` (create if absent)

- [ ] **Step 1: Write the failing test**

Create/append `lib/page-builder/blocks/GalleryText.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { GalleryHeader } from "./GalleryText";

describe("GalleryHeader gap", () => {
  it("defaults the description top margin to 0.5rem when no gap given", () => {
    const { container } = render(
      <GalleryHeader heading="Title" description="Desc" align="center" />,
    );
    const p = container.querySelector("p")!;
    expect(p.style.margin).toContain("0.5rem");
  });

  it("uses the provided gap (px) for the description top margin", () => {
    const { container } = render(
      <GalleryHeader heading="Title" description="Desc" align="center" gap={24} />,
    );
    const p = container.querySelector("p")!;
    expect(p.style.margin).toContain("24px");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run GalleryText`
Expected: FAIL — `gap` prop not accepted / margin still `0.5rem`.

- [ ] **Step 3: Implement**

In `lib/page-builder/styleToolkit.ts`, inside the carousel section of `BlockStyle` (after line 107, the `textPaddingY?` field), add:

```ts
  // Carousel-only: gap (px) between the heading and the description.
  headingGap?: number;
```

In `lib/page-builder/blocks/GalleryText.tsx`, update the `GalleryHeader` signature and the description margin. Change the props destructure (around line 74-88) to add `gap`:

```tsx
export function GalleryHeader({
  heading,
  description,
  align = "center",
  overlay = false,
  gap,
  headingStyle = {},
  descriptionStyle = {},
}: {
  heading?: string;
  description?: string;
  align?: TextAlign;
  overlay?: boolean;
  gap?: number;
  headingStyle?: GalleryTextTargetStyle & { level?: HeadingLevel };
  descriptionStyle?: GalleryTextTargetStyle & { fontSize?: number };
}) {
```

Then change the `dMargin` computation (lines 108-109) from:

```tsx
  const dMargin =
    dAlign === "center" ? "0.5rem auto 0" : dAlign === "right" ? "0.5rem 0 0 auto" : "0.5rem 0 0";
```

to:

```tsx
  const gapTop = gap !== undefined ? `${gap}px` : "0.5rem";
  const dMargin =
    dAlign === "center" ? `${gapTop} auto 0` : dAlign === "right" ? `${gapTop} 0 0 auto` : `${gapTop} 0 0`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run GalleryText`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/styleToolkit.ts lib/page-builder/blocks/GalleryText.tsx lib/page-builder/blocks/GalleryText.test.tsx
git commit -m "feat(portfolio): support configurable heading gap in GalleryHeader"
```

### Task B2: Thread `headingGap` from the carousel block into `GalleryHeader`

**Files:**
- Modify: `lib/page-builder/blocks/GalleryCarouselBlock.tsx:126-129`
- Test: `lib/page-builder/blocks/GalleryCarouselBlock.test.tsx` (create if absent)

- [ ] **Step 1: Write the failing test**

Create/append `lib/page-builder/blocks/GalleryCarouselBlock.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { GalleryCarouselBlock, galleryCarouselDefaultProps } from "./GalleryCarouselBlock";

describe("GalleryCarouselBlock heading gap", () => {
  it("passes _style.headingGap to the rendered description margin", () => {
    const { container } = render(
      <GalleryCarouselBlock
        {...galleryCarouselDefaultProps}
        images={[{ id: "1", publicId: "demo/x", alt: "" }]}
        heading="Title"
        description="Desc"
        _style={{ headingGap: 32 }}
      />,
    );
    const p = container.querySelector("p")!;
    expect(p.style.margin).toContain("32px");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run GalleryCarouselBlock`
Expected: FAIL — margin is `0.5rem` (gap not threaded).

- [ ] **Step 3: Implement**

In `lib/page-builder/blocks/GalleryCarouselBlock.tsx`, in the `<GalleryHeader ...>` call (line 126), add the `gap` prop right after `overlay`:

```tsx
            <GalleryHeader
              heading={heading}
              description={description}
              align={horizontal}
              overlay
              gap={_style?.headingGap}
              headingStyle={{
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run GalleryCarouselBlock`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/blocks/GalleryCarouselBlock.tsx lib/page-builder/blocks/GalleryCarouselBlock.test.tsx
git commit -m "feat(portfolio): thread carousel heading gap into GalleryHeader"
```

### Task B3: Surface the gap input in the carousel's Layout tab

The carousel Layout tab renders `<CarouselTextPadding s={s} set={set} />` inside `LayoutTabBody` (`StyleToolkitField.tsx:1335`). Add a gap `DimensionInput`-style number control there. Reuse `NumberInputRow` (label + number + suffix).

**Files:**
- Modify: `lib/page-builder/StyleToolkitField.tsx` (the `CarouselTextPadding` component — locate by name)
- Test: `lib/page-builder/StyleToolkitField.test.tsx` (append; create if absent)

- [ ] **Step 1: Locate `CarouselTextPadding`**

Run: `pnpm exec rg -n "function CarouselTextPadding" lib/page-builder/StyleToolkitField.tsx`
Read the component body so you can add a row inside its returned container.

- [ ] **Step 2: Write the failing test**

Append to `lib/page-builder/StyleToolkitField.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { CarouselTextPadding } from "./StyleToolkitField";

describe("CarouselTextPadding heading gap control", () => {
  it("renders a heading gap input and writes _style.headingGap", () => {
    const set = vi.fn();
    render(<CarouselTextPadding s={{}} set={set} />);
    const input = screen.getByLabelText(/heading gap/i);
    fireEvent.change(input, { target: { value: "20" } });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ headingGap: 20 }));
  });
});
```

> If `CarouselTextPadding` is not currently exported, add `export` to its declaration.
> If `NumberInputRow` does not associate its label via `htmlFor`/`aria-label`, assert on `screen.getByText(/heading gap/i)` presence plus the input's `onChange` instead — inspect `toolbarPrimitives` first and match its accessibility pattern.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test --run StyleToolkitField`
Expected: FAIL — no "heading gap" control.

- [ ] **Step 4: Implement**

Ensure `CarouselTextPadding` is exported. Inside its returned JSX (alongside the existing X/Y padding inputs), add a gap row:

```tsx
      <NumberInputRow
        label="Heading gap"
        value={s.headingGap}
        min={0}
        max={96}
        suffix="px"
        onChange={(v) => set({ headingGap: v })}
      />
```

Confirm `NumberInputRow` is already imported in this file (it is, used elsewhere).

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test --run StyleToolkitField`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/page-builder/StyleToolkitField.tsx lib/page-builder/StyleToolkitField.test.tsx
git commit -m "feat(portfolio): add carousel heading gap control to Layout tab"
```

---

## Group C — Padding → Layout tab + Gallery section parity (Scopes 4 & 5)

These two scopes both edit `StyleToolkitField.tsx` block-type sets and tab bodies, so they are grouped.

### Task C1: Add gallery section presets to container type sets (Scope 5)

**Files:**
- Modify: `lib/page-builder/StyleToolkitField.tsx:74-98` (`CONTAINER_TYPES`, `FLEX_CONTAINER_BLOCKS`)
- Test: `lib/page-builder/StyleToolkitField.test.tsx` (append)

- [ ] **Step 1: Write the failing test**

Append:

```tsx
import { CONTAINER_TYPES, FLEX_CONTAINER_BLOCKS } from "./StyleToolkitField";

describe("gallery section presets are container-typed", () => {
  for (const t of ["GalleryGridPreset", "GalleryMasonryPreset", "FeaturedWorkPreset"]) {
    it(`${t} is a CONTAINER_TYPE`, () => {
      expect(CONTAINER_TYPES.has(t)).toBe(true);
    });
    it(`${t} is a FLEX_CONTAINER_BLOCK`, () => {
      expect(FLEX_CONTAINER_BLOCKS.has(t)).toBe(true);
    });
  }
  it("does not treat the standalone GalleryCarousel as a container", () => {
    expect(CONTAINER_TYPES.has("GalleryCarousel")).toBe(false);
  });
});
```

> If `CONTAINER_TYPES` / `FLEX_CONTAINER_BLOCKS` are not exported, add `export` to their `const` declarations.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run StyleToolkitField`
Expected: FAIL — gallery presets absent from the sets.

- [ ] **Step 3: Implement**

Export and extend both sets (`StyleToolkitField.tsx:74-98`):

```tsx
export const CONTAINER_TYPES = new Set([
  "Container",
  "HeroPreset",
  "AboutPreset",
  "ServicesPreset",
  "CtaPreset",
  "ContactPreset",
  "GalleryGridPreset",
  "GalleryMasonryPreset",
  "FeaturedWorkPreset",
]);
```

```tsx
export const FLEX_CONTAINER_BLOCKS = new Set([
  "Container",
  "HeroPreset", "AboutPreset", "ServicesPreset", "CtaPreset", "ContactPreset",
  "GalleryGridPreset", "GalleryMasonryPreset", "FeaturedWorkPreset",
]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run StyleToolkitField`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/StyleToolkitField.tsx lib/page-builder/StyleToolkitField.test.tsx
git commit -m "feat(portfolio): give gallery section presets full container controls"
```

### Task C2: Move the Padding control from the Design tab into the Layout tab (Scope 4)

`DesignTab` renders the Padding block at `StyleToolkitField.tsx:961-1003` (gated by `showPadding = FLEX_CONTAINER_BLOCKS.has(blockType)`). `LayoutTabBody`'s container branch starts at line 1413 with the `Gap` control. We move padding to render **above Gap** in the Layout container branch and remove it from Design.

**Files:**
- Modify: `lib/page-builder/StyleToolkitField.tsx` — `DesignTab` (remove padding) + `LayoutTabBody` (add padding)
- Test: `lib/page-builder/StyleToolkitField.test.tsx` (append)

- [ ] **Step 1: Write the failing test**

This is a structural relocation; test it via a small extracted helper so we don't depend on full Puck context. Create a `PaddingControls` component and assert it renders, then assert `DesignTab` no longer contains a "Padding" label for a container while `LayoutTabBody` does. Append:

```tsx
import { LayoutTabBody, DesignTab } from "./StyleToolkitField";

describe("padding lives in the Layout tab", () => {
  it("LayoutTabBody shows Padding for a Container", () => {
    render(
      <LayoutTabBody
        s={{}}
        set={() => {}}
        isGridChild={false}
        showJustify
        blockType="Container"
        p={{}}
        setProp={() => {}}
      />,
    );
    expect(screen.getByText("Padding")).toBeInTheDocument();
  });

  it("DesignTab no longer shows Padding for a Container", () => {
    render(<DesignTab s={{}} set={() => {}} blockType="Container" />);
    expect(screen.queryByText("Padding")).not.toBeInTheDocument();
  });
});
```

> Export `LayoutTabBody` and `DesignTab` if not already exported.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run StyleToolkitField`
Expected: FAIL — Padding currently appears in Design, not Layout.

- [ ] **Step 3: Extract a shared `PaddingControls` component**

To avoid duplicating the advanced/simple padding JSX, extract it. Above `DesignTab` (or near the other helpers), add:

```tsx
function PaddingControls({
  s,
  set,
}: {
  s: BlockStyle;
  set: (p: Partial<BlockStyle>) => void;
}) {
  const [paddingAdvanced, setPaddingAdvanced] = useState(false);
  const paddingX =
    s.paddingLeft !== undefined && s.paddingLeft === s.paddingRight ? s.paddingLeft : undefined;
  const paddingY =
    s.paddingTop !== undefined && s.paddingTop === s.paddingBottom ? s.paddingTop : undefined;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Padding
        </span>
        <button
          type="button"
          aria-label="Padding advanced options"
          onClick={() => setPaddingAdvanced((a) => !a)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          Advanced
          {paddingAdvanced ? (
            <ChevronUp className="size-3" aria-hidden />
          ) : (
            <ChevronDown className="size-3" aria-hidden />
          )}
        </button>
      </div>
      {paddingAdvanced ? (
        <div className="flex flex-col gap-2">
          <DimensionInput label="Top" value={s.paddingTop} onChange={(v) => set({ paddingTop: v })} />
          <DimensionInput label="Right" value={s.paddingRight} onChange={(v) => set({ paddingRight: v })} />
          <DimensionInput label="Bottom" value={s.paddingBottom} onChange={(v) => set({ paddingBottom: v })} />
          <DimensionInput label="Left" value={s.paddingLeft} onChange={(v) => set({ paddingLeft: v })} />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <DimensionInput
            label="Horizontal (X)"
            value={paddingX}
            onChange={(v) => set({ paddingLeft: v, paddingRight: v })}
          />
          <DimensionInput
            label="Vertical (Y)"
            value={paddingY}
            onChange={(v) => set({ paddingTop: v, paddingBottom: v })}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Remove the padding block from `DesignTab`**

Delete the entire `{showPadding && ( ... )}` block (`StyleToolkitField.tsx:961-1003`) and remove the now-unused locals `paddingAdvanced`/`setPaddingAdvanced`, `paddingX`, `paddingY`, and `showPadding` from `DesignTab` (lines 801, 804, 809-816). Leave `isButton`, `showFrame`, `isCarousel`, `showTypography` intact.

- [ ] **Step 5: Add padding to `LayoutTabBody` container branch (above Gap)**

In `LayoutTabBody`, the container/generic branch returns starting at line 1413. Insert `PaddingControls` as the first child, gated to flex containers, before the `Gap` `NumberInputRow`:

```tsx
  // Container / generic block layout
  return (
    <div className="flex flex-col gap-4 p-3">
      {isFlexContainer && <PaddingControls s={s} set={set} />}
      <NumberInputRow
        label="Gap"
        value={s.gap}
        min={0}
        max={96}
        suffix="px"
        onChange={(v) => set({ gap: v })}
      />
```

(`isFlexContainer` is already computed at line 1328.)

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test --run StyleToolkitField`
Expected: PASS (both the new C2 tests and the existing suite).

- [ ] **Step 7: Typecheck**

Run: `pnpm typecheck`
Expected: no errors (verify no dangling `showPadding`/`paddingAdvanced` references remain in `DesignTab`).

- [ ] **Step 8: Commit**

```bash
git add lib/page-builder/StyleToolkitField.tsx lib/page-builder/StyleToolkitField.test.tsx
git commit -m "feat(portfolio): move block padding control from Design to Layout tab"
```

---

## Group D — Root page styling (Scope 3)

Add a page-root style: **Design** (bg color + bg opacity) and **Layout** (padding X/Y + margin X/Y). Stored in Puck `root.props._rootStyle` (per zone). Applied in production via `config.ts` `root.render`; previewed live in the editor canvas via a `usePuck`-driven side-channel that styles the existing canvas element (no `config.root.render` in the editor — that breaks DnD).

### Task D1: Root style type + CSS resolver

**Files:**
- Create: `lib/page-builder/rootStyle.ts`
- Test: `lib/page-builder/rootStyle.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/page-builder/rootStyle.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveRootStyle, type RootPageStyle } from "./rootStyle";

describe("resolveRootStyle", () => {
  it("returns an empty object for undefined", () => {
    expect(resolveRootStyle(undefined)).toEqual({});
  });

  it("applies a token background color", () => {
    const css = resolveRootStyle({ bgColorToken: "primary" });
    expect(css.backgroundColor).toBe("var(--pf-color-primary)");
  });

  it("applies a hex background color with opacity via color-mix fallback", () => {
    const css = resolveRootStyle({ bgColorToken: "#112233", bgOpacity: 50 } as RootPageStyle);
    expect(String(css.backgroundColor)).toContain("#112233");
    expect(css.opacity).toBeUndefined(); // opacity is folded into the color, not the wrapper
  });

  it("maps padding and margin X/Y to per-side CSS", () => {
    const css = resolveRootStyle({
      paddingX: "16px",
      paddingY: "24px",
      marginX: "8px",
      marginY: "12px",
    });
    expect(css.paddingLeft).toBe("16px");
    expect(css.paddingRight).toBe("16px");
    expect(css.paddingTop).toBe("24px");
    expect(css.paddingBottom).toBe("24px");
    expect(css.marginLeft).toBe("8px");
    expect(css.marginRight).toBe("8px");
    expect(css.marginTop).toBe("12px");
    expect(css.marginBottom).toBe("12px");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run rootStyle`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

Create `lib/page-builder/rootStyle.ts`:

```ts
import type React from "react";
import { colorTokenToVar } from "./styleToolkit";
import type { CssLength, StyleColorToken } from "./styleToolkit";

export type RootPageStyle = {
  // Design
  bgColorToken?: StyleColorToken | string;
  bgOpacity?: number; // 0-100, opacity of the background color fill
  // Layout
  paddingX?: CssLength;
  paddingY?: CssLength;
  marginX?: CssLength;
  marginY?: CssLength;
};

/**
 * Fold an opacity (0-100) into a CSS color. For hex colors we emit a
 * color-mix() with transparent; for token vars we likewise wrap in color-mix.
 * 100 (or undefined) returns the color unchanged.
 */
function withOpacity(color: string, opacity?: number): string {
  if (opacity === undefined || opacity >= 100) return color;
  const pct = Math.max(0, Math.min(100, opacity));
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

export function resolveRootStyle(style?: RootPageStyle | null): React.CSSProperties {
  if (!style) return {};
  const css: Record<string, string | number> = {};

  if (style.bgColorToken) {
    const base = colorTokenToVar(style.bgColorToken) ?? "";
    if (base) css.backgroundColor = withOpacity(base, style.bgOpacity);
  }
  if (style.paddingX !== undefined) {
    css.paddingLeft = style.paddingX;
    css.paddingRight = style.paddingX;
  }
  if (style.paddingY !== undefined) {
    css.paddingTop = style.paddingY;
    css.paddingBottom = style.paddingY;
  }
  if (style.marginX !== undefined) {
    css.marginLeft = style.marginX;
    css.marginRight = style.marginX;
  }
  if (style.marginY !== undefined) {
    css.marginTop = style.marginY;
    css.marginBottom = style.marginY;
  }
  return css as React.CSSProperties;
}
```

> Confirm `CssLength` and `StyleColorToken` are exported from `styleToolkit.ts`; if `CssLength` is a local alias, export it. `colorTokenToVar` is already exported (`styleToolkit.ts:215`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run rootStyle`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/rootStyle.ts lib/page-builder/rootStyle.test.ts
git commit -m "feat(portfolio): add root page style type and CSS resolver"
```

### Task D2: Root style editor panel (Design + Layout tabs)

**Files:**
- Create: `lib/page-builder/RootStyleField.tsx`
- Test: `lib/page-builder/RootStyleField.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `lib/page-builder/RootStyleField.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { RootStyleField } from "./RootStyleField";

describe("RootStyleField", () => {
  it("shows only Design and Layout tabs", () => {
    render(<RootStyleField value={{}} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Design" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Layout" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Content" })).not.toBeInTheDocument();
  });

  it("writes a background opacity on the Design tab", () => {
    const onChange = vi.fn();
    render(<RootStyleField value={{ bgColorToken: "primary" }} onChange={onChange} />);
    const input = screen.getByLabelText(/background opacity/i);
    fireEvent.change(input, { target: { value: "40" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ bgOpacity: 40 }));
  });

  it("writes padding X on the Layout tab", () => {
    const onChange = vi.fn();
    render(<RootStyleField value={{}} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    // DimensionInput for "Padding X" — match by its label text
    expect(screen.getByText(/padding x/i)).toBeInTheDocument();
  });
});
```

> If `NumberInputRow`/`DimensionInput` don't expose accessible labels, adapt the queries to match `toolbarPrimitives` (inspect it first) — e.g. assert on label text + fire change on the nearest input.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run RootStyleField`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

Create `lib/page-builder/RootStyleField.tsx`. It reuses `toolbarPrimitives` and mirrors `TabHeader`'s styling, but offers only Design/Layout:

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ColorSwatchRow, NumberInputRow, DimensionInput } from "./toolbarPrimitives";
import type { RootPageStyle } from "./rootStyle";

type Tab = "design" | "layout";

export function RootStyleField({
  value,
  onChange,
}: {
  value: RootPageStyle | undefined;
  onChange: (v: RootPageStyle) => void;
}) {
  const [tab, setTab] = useState<Tab>("design");
  const s = value ?? {};
  const set = (patch: Partial<RootPageStyle>) => onChange({ ...s, ...patch });

  return (
    <div className="flex flex-col">
      <div className="flex border-b border-border">
        {(["design", "layout"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 py-2 text-xs font-medium capitalize transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              tab === id ? "border-b-2 border-foreground text-foreground" : "text-muted-foreground",
            )}
          >
            {id}
          </button>
        ))}
      </div>

      {tab === "design" && (
        <div className="flex flex-col gap-4 p-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Background color</span>
            <ColorSwatchRow value={s.bgColorToken} onChange={(t) => set({ bgColorToken: t })} />
          </div>
          <NumberInputRow
            label="Background opacity"
            value={s.bgOpacity}
            min={0}
            max={100}
            suffix="%"
            onChange={(v) => set({ bgOpacity: v })}
          />
        </div>
      )}

      {tab === "layout" && (
        <div className="flex flex-col gap-4 p-3">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Padding
            </span>
            <DimensionInput label="Padding X" value={s.paddingX} onChange={(v) => set({ paddingX: v })} />
            <DimensionInput label="Padding Y" value={s.paddingY} onChange={(v) => set({ paddingY: v })} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Margin
            </span>
            <DimensionInput label="Margin X" value={s.marginX} onChange={(v) => set({ marginX: v })} />
            <DimensionInput label="Margin Y" value={s.marginY} onChange={(v) => set({ marginY: v })} />
          </div>
        </div>
      )}
    </div>
  );
}
```

> Match `ColorSwatchRow`'s real prop names from `toolbarPrimitives` (in `StyleToolkitField.tsx` it is used as `value`/`onChange`). If the primitive uses different names, adapt.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run RootStyleField`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/RootStyleField.tsx lib/page-builder/RootStyleField.test.tsx
git commit -m "feat(portfolio): add root page style editor panel"
```

### Task D3: Register the root field in editor + production Puck config; apply in production render

**Files:**
- Modify: `lib/page-builder/editorConfig.tsx:820` (root fields)
- Modify: `lib/page-builder/config.ts:122` (root fields + render)
- Test: `lib/page-builder/config.test.tsx` (create if absent)

- [ ] **Step 1: Write the failing test**

Create/append `lib/page-builder/config.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { puckConfig } from "./config";

describe("production root render applies root style", () => {
  it("wraps children with the resolved root style", () => {
    const RootRender = puckConfig.root!.render!;
    const { container } = render(
      <RootRender _rootStyle={{ bgColorToken: "primary", paddingX: "20px" }}>
        <div data-testid="child" />
      </RootRender>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.backgroundColor).toContain("var(--pf-color-primary)");
    expect(wrapper.style.paddingLeft).toBe("20px");
    expect(wrapper.querySelector("[data-testid='child']")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run config`
Expected: FAIL — `puckConfig.root.render` is undefined.

- [ ] **Step 3: Implement production config** (`lib/page-builder/config.ts`)

Add imports near the top:

```ts
import { resolveRootStyle, type RootPageStyle } from "./rootStyle";
import type React from "react";
```

Replace `root: { fields: {} },` (line 122) with:

```ts
  root: {
    fields: {} as Config<Components>["root"] extends { fields: infer F } ? F : never,
    render: ({ _rootStyle, children }: { _rootStyle?: RootPageStyle; children?: React.ReactNode }) => (
      <div style={{ ...resolveRootStyle(_rootStyle), minHeight: "100%" }}>{children}</div>
    ),
  },
```

> Simpler if the typed `fields` cast fights you: keep `fields: {}` and add only `render`. Puck reads `data.root.props._rootStyle` and passes it to `render`. The field itself is registered in the editor config (next step), not production — production only needs `render`.

So the minimal production change is:

```ts
  root: {
    fields: {},
    render: ({ _rootStyle, children }: { _rootStyle?: RootPageStyle; children?: React.ReactNode }) => (
      <div style={{ ...resolveRootStyle(_rootStyle), minHeight: "100%" }}>{children}</div>
    ),
  },
```

- [ ] **Step 4: Implement editor config** (`lib/page-builder/editorConfig.tsx`)

Add a custom root field so the panel shows when the page root is selected. Near `styleField` (line 181), add:

```tsx
const rootStyleField = {
  type: "custom",
  label: "Page style",
  render: ({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) => (
    <RootStyleField
      value={value as RootPageStyle | undefined}
      onChange={onChange as (v: RootPageStyle) => void}
    />
  ),
} as unknown as Field<RootPageStyle | undefined>;
```

Add the import at the top of `editorConfig.tsx`:

```tsx
import { RootStyleField } from "./RootStyleField";
import type { RootPageStyle } from "./rootStyle";
```

Replace `root: { fields: {} },` (line 820) with:

```tsx
  root: { fields: { _rootStyle: rootStyleField } },
```

(Do NOT add `root.render` to the editor config — the comment at lines 815-819 explains it breaks DnD. Editor preview is handled in Task D4.)

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test --run config`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add lib/page-builder/config.ts lib/page-builder/editorConfig.tsx lib/page-builder/config.test.tsx
git commit -m "feat(portfolio): register root page style field and apply it in production render"
```

### Task D4: Live root-style preview on the editor canvas (no root.render)

The editor must reflect root bg/padding/margin on the canvas without `config.root.render`. Approach: a small client component mounted inside `<Puck>` reads `appState.data.root.props._rootStyle` via `usePuck`, and in a `useEffect` applies the resolved CSS to the **existing** Puck preview surface element (no wrapping/re-parenting). We locate the surface by walking up from a marker node we render, or by a stable Puck selector, and only mutate inline style properties.

**Files:**
- Modify: `lib/page-builder/editorConfig.tsx` — add an `overrides`-compatible component, OR
- Modify: `.../portfolio/_components/EditorShell.tsx` — pass `overrides={{ puck: ... }}` (preferred: keep editor wiring in EditorShell)
- Test: `lib/page-builder/RootCanvasStyle.test.tsx`

- [ ] **Step 1: Write the failing test (pure resolver wiring)**

We unit-test the style computation hook in isolation (DOM mutation is verified manually in Step 5). Create `lib/page-builder/RootCanvasStyle.tsx` exporting a pure helper plus the effect component. First the test:

Create `lib/page-builder/RootCanvasStyle.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { rootCanvasCssText } from "./RootCanvasStyle";

describe("rootCanvasCssText", () => {
  it("produces a CSS text block for the canvas surface", () => {
    const css = rootCanvasCssText({ bgColorToken: "primary", paddingX: "10px" });
    expect(css).toContain("background-color");
    expect(css).toContain("var(--pf-color-primary)");
    expect(css).toContain("padding-left: 10px");
  });

  it("returns empty string for no style", () => {
    expect(rootCanvasCssText(undefined)).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run RootCanvasStyle`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `RootCanvasStyle.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { usePuck } from "@measured/puck";
import { resolveRootStyle, type RootPageStyle } from "./rootStyle";

const CANVAS_STYLE_ID = "pf-root-canvas-style";

/** Serialize the resolved root style into CSS declarations (kebab-case). */
export function rootCanvasCssText(style?: RootPageStyle | null): string {
  const css = resolveRootStyle(style);
  const decls = Object.entries(css)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${v}`)
    .join("; ");
  return decls;
}

/**
 * Editor-only: reflects the page root style onto the Puck canvas surface by
 * injecting a scoped <style> tag — NOT by wrapping the DOM (which breaks DnD).
 * The selector targets Puck's drop-zone surface; adjust in Step 5 if the build's
 * Puck version uses a different class.
 */
export function RootCanvasStyle() {
  const { appState } = usePuck();
  const rootStyle = (appState?.data?.root?.props as { _rootStyle?: RootPageStyle } | undefined)
    ?._rootStyle;

  useEffect(() => {
    if (typeof document === "undefined") return;
    let tag = document.getElementById(CANVAS_STYLE_ID) as HTMLStyleElement | null;
    if (!tag) {
      tag = document.createElement("style");
      tag.id = CANVAS_STYLE_ID;
      document.head.appendChild(tag);
    }
    const decls = rootCanvasCssText(rootStyle);
    // Target the Puck preview root surface. Both common selectors are included.
    tag.textContent = decls
      ? `[data-puck-preview], .Puck-root, .PuckLayout-content { ${decls} }`
      : "";
    return () => {
      if (tag) tag.textContent = "";
    };
  }, [rootStyle]);

  return null;
}
```

- [ ] **Step 4: Mount it inside Puck via overrides**

In `EditorShell.tsx`, where `<Puck ... />` is rendered (the `showPuck` branch), add an `overrides` prop that renders children plus the side-channel (do not change layout):

```tsx
overrides={{
  puck: ({ children }) => (
    <>
      {children}
      <RootCanvasStyle />
    </>
  ),
}}
```

Add the import:

```tsx
import { RootCanvasStyle } from "@/lib/page-builder/RootCanvasStyle";
```

> If `<Puck>` already has an `overrides` prop, merge — keep existing overrides and add the `puck` wrapper (or nest `RootCanvasStyle` inside the existing one).

- [ ] **Step 5: Run unit test + manual canvas verification**

Run: `pnpm test --run RootCanvasStyle` → PASS.

Manual: `pnpm dev`, open the portfolio editor, deselect all blocks (click empty page area) to reveal the Page style panel, set a background color + padding. Confirm:
1. The canvas background/padding updates live.
2. **Drag-and-drop of blocks still works** (drag a block to reorder). If DnD breaks or the bg doesn't show, inspect the canvas DOM (`document.querySelector` in devtools) to find the real surface element/class and update the selector list in `RootCanvasStyle.tsx` Step 3. Re-verify.

- [ ] **Step 6: Commit**

```bash
git add lib/page-builder/RootCanvasStyle.tsx lib/page-builder/RootCanvasStyle.test.tsx app/[locale]/\(app\)/portfolio/_components/EditorShell.tsx
git commit -m "feat(portfolio): live root page style preview on editor canvas"
```

---

## Group E — Collections Popup live tab + header/button styling (Scope 6)

Bring the Collections Popup tab to parity with Header/Contact (preview pane + sidebar), extract shared popup chrome, and add a "Header styles" accordion (Title + Button sub-drawers).

### Task E1: Extend `PortfolioCollectionsPopupConfig` with title + close-button fields

**Files:**
- Modify: `lib/page-builder/types.ts:54-59`
- Test: `lib/page-builder/types.test.ts` (a compile-time/value test)

- [ ] **Step 1: Write the failing test**

Create/append `lib/page-builder/types.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { PortfolioCollectionsPopupConfig } from "./types";

describe("PortfolioCollectionsPopupConfig title + button fields", () => {
  it("accepts the new optional fields", () => {
    const c: PortfolioCollectionsPopupConfig = {
      titleText: "Custom",
      titleFontFamily: "inter" as PortfolioCollectionsPopupConfig["titleFontFamily"],
      titleFontSize: 24,
      titleColorToken: "primary",
      titleBold: true,
      titleItalic: false,
      titleUnderline: false,
      titleAlign: "center",
      closeButtonSize: 40,
      closeButtonRadius: "rounded",
      closeButtonBorderWidth: 1,
      closeButtonBorderColorToken: "foreground",
      closeButtonOpacity: 80,
      closeButtonBgColorToken: "background",
    };
    expect(c.titleText).toBe("Custom");
    expect(c.closeButtonSize).toBe(40);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run types` (or `pnpm typecheck`)
Expected: FAIL — unknown properties.

- [ ] **Step 3: Implement**

In `lib/page-builder/types.ts`, replace the `PortfolioCollectionsPopupConfig` type (lines 54-59) with:

```ts
export type PortfolioCollectionsPopupConfig = {
  backgroundColor?: string; // token name or hex
  borderColor?: string;     // token name or hex
  borderWidth?: number;     // px, 0 = none
  radius?: BrandKitRadius | "";
  // Title styles (global override + typography). Empty titleText -> collection name.
  titleText?: string;
  titleFontFamily?: PortfolioFontKey;
  titleFontSize?: number; // px
  titleColorToken?: string; // token name or hex
  titleBold?: boolean;
  titleItalic?: boolean;
  titleUnderline?: boolean;
  titleAlign?: TextAlign; // moves the title across the full popup header width
  // Close-button styles
  closeButtonSize?: number; // px (button width/height)
  closeButtonRadius?: BrandKitRadius | "";
  closeButtonBorderWidth?: number; // px
  closeButtonBorderColorToken?: string;
  closeButtonOpacity?: number; // 0-100
  closeButtonBgColorToken?: string;
};
```

Ensure `PortfolioFontKey` and `TextAlign` are imported/available in `types.ts`. If they live in `styleToolkit.ts`, add:

```ts
import type { PortfolioFontKey, TextAlign } from "./styleToolkit";
```

(`BrandKitRadius` is already used in this file.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run types` then `pnpm typecheck`
Expected: PASS / clean.

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/types.ts lib/page-builder/types.test.ts
git commit -m "feat(portfolio): extend collections popup config with title and close-button styles"
```

### Task E2: Extract shared popup chrome (`CollectionPopupChrome`)

Pull the shell + sticky title header + floating close button out of `CollectionPopup.tsx` into a presentational component used by both the public popup and the editor preview. It applies the new title/button style fields.

**Files:**
- Create: `lib/page-builder/blocks/CollectionPopupChrome.tsx`
- Test: `lib/page-builder/blocks/CollectionPopupChrome.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `lib/page-builder/blocks/CollectionPopupChrome.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { CollectionPopupChrome } from "./CollectionPopupChrome";

describe("CollectionPopupChrome", () => {
  it("shows the collection name when no title override", () => {
    render(
      <CollectionPopupChrome collectionName="Weddings" config={{}} onClose={() => {}}>
        <div>body</div>
      </CollectionPopupChrome>,
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Weddings");
  });

  it("uses the global title override when set", () => {
    render(
      <CollectionPopupChrome
        collectionName="Weddings"
        config={{ titleText: "Galleries", titleAlign: "center" }}
        onClose={() => {}}
      >
        <div>body</div>
      </CollectionPopupChrome>,
    );
    const h2 = screen.getByRole("heading", { level: 2 });
    expect(h2).toHaveTextContent("Galleries");
    expect(h2.style.textAlign).toBe("center");
  });

  it("applies close-button size + fires onClose", () => {
    const onClose = vi.fn();
    render(
      <CollectionPopupChrome
        collectionName="W"
        config={{ closeButtonSize: 48 }}
        onClose={onClose}
      >
        <div>body</div>
      </CollectionPopupChrome>,
    );
    const btn = screen.getByRole("button", { name: /close/i });
    expect(btn.style.width).toBe("48px");
    btn.click();
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run CollectionPopupChrome`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

Create `lib/page-builder/blocks/CollectionPopupChrome.tsx`. It renders the shell, the sticky title header (applying title typography + full-width align), and the floating close button (applying button style fields). Color resolution reuses `colorTokenToVar`; radius maps via a small table.

```tsx
import type React from "react";
import { X as XIcon } from "lucide-react";
import { colorTokenToVar } from "../styleToolkit";
import { fontFamilyValue } from "../styleToolkit";
import type { PortfolioCollectionsPopupConfig } from "../types";

const RADIUS_PX: Record<string, string> = { sharp: "0px", subtle: "6px", rounded: "16px" };

function radiusToCss(r?: string): string | undefined {
  if (!r) return undefined;
  return RADIUS_PX[r];
}

export function CollectionPopupChrome({
  collectionName,
  config,
  onClose,
  children,
  /** when true, render as a plain absolutely-filled box (editor preview) rather than fixed */
  preview = false,
}: {
  collectionName: string;
  config: PortfolioCollectionsPopupConfig;
  onClose: () => void;
  children: React.ReactNode;
  preview?: boolean;
}) {
  const bg = config.backgroundColor ? colorTokenToVar(config.backgroundColor) : undefined;
  const borderWidth = config.borderWidth ?? 0;
  const borderColor = config.borderColor ? colorTokenToVar(config.borderColor) : undefined;
  const shellRadius = radiusToCss(config.radius || undefined);

  const title = config.titleText?.trim() ? config.titleText : collectionName;

  const closeSize = config.closeButtonSize ?? 36;
  const closeRadius = config.closeButtonRadius
    ? radiusToCss(config.closeButtonRadius)
    : "50%";
  const closeBorderW = config.closeButtonBorderWidth ?? 1;
  const closeBorderColor = config.closeButtonBorderColorToken
    ? colorTokenToVar(config.closeButtonBorderColorToken)
    : "var(--pf-color-foreground, rgba(0,0,0,0.2))";
  const closeBg = config.closeButtonBgColorToken
    ? colorTokenToVar(config.closeButtonBgColorToken)
    : "var(--pf-color-surface, #fff)";

  const shellStyle: React.CSSProperties = preview
    ? {
        position: "absolute",
        inset: "5%",
        backgroundColor: bg ?? "var(--pf-color-surface, #fff)",
        borderWidth: borderWidth > 0 ? `${borderWidth}px` : "1px",
        borderStyle: "solid",
        borderColor: borderWidth > 0 && borderColor ? borderColor : "var(--pf-color-border, rgba(0,0,0,0.12))",
        borderRadius: shellRadius ?? "0px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }
    : {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 100,
        maxHeight: "90vh",
        minWidth: "90vw",
        maxWidth: "900px",
        width: "90vw",
        backgroundColor: bg ?? "var(--pf-color-surface, #fff)",
        borderWidth: borderWidth > 0 ? `${borderWidth}px` : "1px",
        borderStyle: "solid",
        borderColor: borderWidth > 0 && borderColor ? borderColor : "var(--pf-color-border, rgba(0,0,0,0.12))",
        borderRadius: shellRadius ?? "0px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      };

  return (
    <div style={shellStyle}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: `${closeSize}px`,
          height: `${closeSize}px`,
          borderRadius: closeRadius,
          borderWidth: `${closeBorderW}px`,
          borderStyle: "solid",
          borderColor: closeBorderColor,
          background: closeBg,
          color: "var(--pf-color-foreground, #111)",
          opacity: (config.closeButtonOpacity ?? 100) / 100,
          cursor: "pointer",
        }}
      >
        <XIcon aria-hidden style={{ width: "16px", height: "16px" }} />
      </button>

      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          backgroundColor: bg ?? "var(--pf-color-surface, #fff)",
          padding: "16px 56px 12px 16px",
          borderBottom: "1px solid var(--pf-color-border, rgba(0,0,0,0.1))",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: config.titleFontSize ? `${config.titleFontSize}px` : "1.125rem",
            fontWeight: config.titleBold ? 700 : 600,
            fontStyle: config.titleItalic ? "italic" : undefined,
            textDecoration: config.titleUnderline ? "underline" : undefined,
            lineHeight: 1.3,
            textAlign: config.titleAlign ?? "left",
            fontFamily: fontFamilyValue(config.titleFontFamily) ?? "inherit",
            color: config.titleColorToken
              ? colorTokenToVar(config.titleColorToken) ?? "var(--pf-color-foreground, #111)"
              : "var(--pf-color-foreground, #111)",
          }}
        >
          {title}
        </h2>
      </div>

      {children}
    </div>
  );
}
```

> Confirm `fontFamilyValue` is exported from `styleToolkit.ts` (it is used in `GalleryText.tsx`). If not exported, export it.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run CollectionPopupChrome`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/blocks/CollectionPopupChrome.tsx lib/page-builder/blocks/CollectionPopupChrome.test.tsx
git commit -m "feat(portfolio): add shared collection popup chrome component"
```

### Task E3: Use the shared chrome in the public `CollectionPopup`

**Files:**
- Modify: `lib/page-builder/blocks/CollectionPopup.tsx` (replace inline shell/header/close with `CollectionPopupChrome`)
- Test: `lib/page-builder/blocks/CollectionPopup.test.tsx` (append; create if absent)

- [ ] **Step 1: Write the failing test**

Append a test asserting the public popup now honors the global title override:

```tsx
// CollectionPopup.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { CollectionPopup } from "./CollectionPopup";

describe("CollectionPopup title override", () => {
  it("renders the configured title override instead of the collection name", () => {
    render(
      <CollectionPopup
        collectionId="c1"
        collectionName="Weddings"
        mode="owner"
        popupConfig={{ titleText: "Galleries" }}
        open
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Galleries");
  });
});
```

> If `CollectionPopup` requires more context to render (portal/dialog/data fetch), mirror the existing `CollectionPopup` tests' setup. Inspect any existing `CollectionPopup.test.tsx` first and reuse its mocks. If the popup is heavily portal/dialog-bound, instead assert at the chrome boundary by checking the rendered `<h2>` after `open` is set.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run CollectionPopup`
Expected: FAIL — still renders "Weddings".

- [ ] **Step 3: Implement**

In `CollectionPopup.tsx`, remove the local `FloatingCloseButton`, the inline `shellStyle`, and the sticky-header `<div><h2>...</h2></div>` (lines 121-174, 351-372, 406-428 regions). Replace the popup body with the shared chrome, keeping the existing scroll/content and `DialogPrimitive` wiring. Concretely, where the popup currently renders `DialogPrimitive.Popup` with `shellStyle` + close button + sticky header + body, render:

```tsx
<DialogPrimitive.Popup data-popup-shell="" aria-label={collectionName} style={{ /* keep positioning wrapper if needed */ }}>
  <style>{FOCUS_VISIBLE_STYLES}</style>
  <CollectionPopupChrome collectionName={collectionName} config={popupConfig} onClose={onClose}>
    {/* existing scrollable gallery body that was below the sticky header */}
  </CollectionPopupChrome>
</DialogPrimitive.Popup>
```

> Keep `data-popup-close` behavior: if external code keys off the `data-popup-close` attribute on the close button, pass it through. Add an optional `closeDataAttr` prop to `CollectionPopupChrome` and spread it on the button (`{ "data-popup-close": "" }`) to preserve existing close-on-attribute logic. Search for `data-popup-close` usages first and preserve them.

Add the import:

```tsx
import { CollectionPopupChrome } from "./CollectionPopupChrome";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run CollectionPopup`
Expected: PASS. Also re-run any existing CollectionPopup tests to ensure no regression.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add lib/page-builder/blocks/CollectionPopup.tsx lib/page-builder/blocks/CollectionPopup.test.tsx
git commit -m "feat(portfolio): render public collection popup via shared chrome"
```

### Task E4: Editor live preview pane (`CollectionsPopupPreview`)

**Files:**
- Create: `.../portfolio/_components/CollectionsPopupPreview.tsx`
- Test: `.../portfolio/_components/CollectionsPopupPreview.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `app/[locale]/(app)/portfolio/_components/CollectionsPopupPreview.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { CollectionsPopupPreview } from "./CollectionsPopupPreview";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";

describe("CollectionsPopupPreview", () => {
  it("renders the popup chrome with a sample title and close button", () => {
    render(<CollectionsPopupPreview config={{}} brandKit={DEFAULT_BRAND_KIT} />);
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  it("reflects a title override", () => {
    render(
      <CollectionsPopupPreview config={{ titleText: "My Galleries" }} brandKit={DEFAULT_BRAND_KIT} />,
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("My Galleries");
  });
});
```

> Confirm `DEFAULT_BRAND_KIT` is exported from `types.ts` (it is imported by the preview page). If not, use a literal brand kit object.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run CollectionsPopupPreview`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

Create `CollectionsPopupPreview.tsx`. It mirrors `HeaderFormPreview`'s outer layout (full-height muted backdrop) and renders `CollectionPopupChrome` with a sample collection name and a placeholder gallery body. Brand-kit colors are applied via CSS vars so token colors resolve.

```tsx
"use client";

import type { PortfolioBrandKit, PortfolioCollectionsPopupConfig } from "@/lib/page-builder/types";
import { CollectionPopupChrome } from "@/lib/page-builder/blocks/CollectionPopupChrome";
import { resolveBrandKit } from "@/lib/page-builder/resolveBrandKit";

export function CollectionsPopupPreview({
  config,
  brandKit,
}: {
  config: PortfolioCollectionsPopupConfig;
  brandKit: PortfolioBrandKit;
}) {
  const { cssVars, className } = resolveBrandKit(brandKit);
  return (
    <div
      className={className}
      style={{ ...(cssVars as React.CSSProperties) }}
      aria-hidden="true"
    >
      <div className="relative h-full w-full overflow-hidden bg-black/45">
        <CollectionPopupChrome collectionName="Sample Collection" config={config} onClose={() => {}} preview>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "8px",
              }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    aspectRatio: "1 / 1",
                    backgroundColor: "var(--pf-color-fg)",
                    opacity: 0.12,
                  }}
                />
              ))}
            </div>
          </div>
        </CollectionPopupChrome>
      </div>
    </div>
  );
}
```

> Confirm `resolveBrandKit` returns `{ cssVars, className }` (it does — used in the preview page). If importing it into a client component pulls server-only deps, inline the brand-kit → CSS-var mapping instead (read the function first).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run CollectionsPopupPreview`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/\(app\)/portfolio/_components/CollectionsPopupPreview.tsx app/[locale]/\(app\)/portfolio/_components/CollectionsPopupPreview.test.tsx
git commit -m "feat(portfolio): add collections popup live preview pane"
```

### Task E5: Wire the preview pane into EditorShell's Collections Popup tab

**Files:**
- Modify: `.../portfolio/_components/EditorShell.tsx:750-759`
- Test: covered by existing `EditorShell.test.tsx` (add an assertion)

- [ ] **Step 1: Write the failing assertion**

In `EditorShell.test.tsx`, in the scenario that opens the collections popup tab (or add one), assert the preview renders rather than a blank div. Add:

```tsx
it("renders the collections popup preview pane when the tab is open", async () => {
  // ...render EditorShell and open the collections popup tab via its trigger...
  // then:
  expect(await screen.findByRole("heading", { level: 2 })).toBeInTheDocument();
});
```

> Mirror how existing EditorShell tests open the Header/Contact tabs (find the trigger button by its label) to open the Collections Popup tab. Inspect the existing test file for the open mechanism and reuse it.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run EditorShell`
Expected: FAIL — left pane is currently an empty div.

- [ ] **Step 3: Implement**

In `EditorShell.tsx`, replace the empty placeholder (line 752):

```tsx
                  <div className="flex-1 overflow-auto bg-muted/40" />
```

with:

```tsx
                  <div className="flex-1 overflow-auto bg-muted/40">
                    <CollectionsPopupPreview config={collectionsPopup} brandKit={brandKit} />
                  </div>
```

Add the import:

```tsx
import { CollectionsPopupPreview } from "./CollectionsPopupPreview";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run EditorShell`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/\(app\)/portfolio/_components/EditorShell.tsx app/[locale]/\(app\)/portfolio/_components/EditorShell.test.tsx
git commit -m "feat(portfolio): show live preview in collections popup tab"
```

### Task E6: Add the "Header styles" accordion (Title + Button sub-drawers) to the sidebar

`CollectionsPopupPanelDialog.tsx` currently has one `DesignDrawer` ("Popup"). Add a second top-level `DesignDrawer` "Header styles" containing two nested `DesignDrawer`s: "Title styles" and "Button styles". Also remove the now-redundant tiny inline preview (the real preview lives in the left pane).

**Files:**
- Modify: `.../portfolio/_components/CollectionsPopupPanelDialog.tsx`
- Test: `.../portfolio/_components/CollectionsPopupPanelDialog.test.tsx` (create if absent)

- [ ] **Step 1: Write the failing test**

Create `CollectionsPopupPanelDialog.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { CollectionsPopupPanelDialog } from "./CollectionsPopupPanelDialog";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";

function setup(config = {}) {
  const onChange = vi.fn();
  render(
    <CollectionsPopupPanelDialog config={config} onChange={onChange} brandKit={DEFAULT_BRAND_KIT} />,
  );
  return { onChange };
}

describe("CollectionsPopupPanelDialog header styles", () => {
  it("exposes a Header styles drawer with Title and Button sub-sections", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /header styles/i }));
    expect(screen.getByRole("button", { name: /title styles/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /button styles/i })).toBeInTheDocument();
  });

  it("writes a title text override", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: /header styles/i }));
    fireEvent.click(screen.getByRole("button", { name: /title styles/i }));
    const input = screen.getByLabelText(/header text/i);
    fireEvent.change(input, { target: { value: "Galleries" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ titleText: "Galleries" }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run CollectionsPopupPanelDialog`
Expected: FAIL — no Header styles drawer.

- [ ] **Step 3: Implement**

In `CollectionsPopupPanelDialog.tsx`:

1. Widen the drawer-id type and state:

```tsx
type DrawerId = "popup" | "header";
type SubDrawerId = "title" | "button";
```

```tsx
  const [openDrawer, setOpenDrawer] = useState<DrawerId | null>("popup");
  const [openSub, setOpenSub] = useState<SubDrawerId | null>("title");
```

2. Remove the tiny inline preview block (the `data-testid="collections-popup-preview"` div, lines ~297-309). The live preview is now the left pane.

3. After the existing "Popup" `DesignDrawer`, add the "Header styles" drawer. Place inside the same controls container:

```tsx
          <DesignDrawer
            title="Header styles"
            open={openDrawer === "header"}
            onToggle={() => setOpenDrawer((c) => (c === "header" ? null : "header"))}
          >
            {/* Title styles */}
            <DesignDrawer
              title="Title styles"
              open={openSub === "title"}
              onToggle={() => setOpenSub((c) => (c === "title" ? null : "title"))}
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground" htmlFor="popup-title-text">
                  Header text
                </label>
                <input
                  id="popup-title-text"
                  type="text"
                  value={config.titleText ?? ""}
                  placeholder="Defaults to collection name"
                  onChange={(e) => set("titleText", e.target.value || undefined)}
                  className="h-8 border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {/* Typography: bold/italic/underline + align (full-width) */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" aria-pressed={!!config.titleBold} aria-label="Bold"
                  onClick={() => set("titleBold", !config.titleBold)}
                  className={cn("inline-flex h-7 w-7 items-center justify-center border border-border bg-background text-xs font-bold", config.titleBold && "bg-foreground text-background")}>B</button>
                <button type="button" aria-pressed={!!config.titleItalic} aria-label="Italic"
                  onClick={() => set("titleItalic", !config.titleItalic)}
                  className={cn("inline-flex h-7 w-7 items-center justify-center border border-border bg-background text-xs italic", config.titleItalic && "bg-foreground text-background")}>I</button>
                <button type="button" aria-pressed={!!config.titleUnderline} aria-label="Underline"
                  onClick={() => set("titleUnderline", !config.titleUnderline)}
                  className={cn("inline-flex h-7 w-7 items-center justify-center border border-border bg-background text-xs underline", config.titleUnderline && "bg-foreground text-background")}>U</button>
                {(["left", "center", "right"] as const).map((a) => (
                  <button key={a} type="button" aria-pressed={config.titleAlign === a} aria-label={`Align ${a}`}
                    onClick={() => set("titleAlign", config.titleAlign === a ? undefined : a)}
                    className={cn("inline-flex h-7 w-7 items-center justify-center border border-border bg-background text-xs", config.titleAlign === a && "bg-foreground text-background")}>
                    {a === "left" ? "L" : a === "center" ? "C" : "R"}
                  </button>
                ))}
              </div>

              {/* Font family */}
              <div className="flex items-center justify-between gap-2">
                <span className="shrink-0 text-xs text-muted-foreground">Font</span>
                <select
                  value={config.titleFontFamily ?? ""}
                  onChange={(e) => set("titleFontFamily", (e.target.value || undefined) as PortfolioFontKey | undefined)}
                  className="h-7 cursor-pointer border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Theme font</option>
                  {PORTFOLIO_FONT_KEYS.map((key) => (
                    <option key={key} value={key}>{PORTFOLIO_FONTS[key].label}</option>
                  ))}
                </select>
              </div>

              {/* Font size */}
              <NumberInputRow
                label="Font size"
                value={config.titleFontSize}
                min={10}
                max={120}
                suffix="px"
                onChange={(v) => set("titleFontSize", v)}
              />

              {/* Title color */}
              <ColorSwatchRow
                label="Title color"
                active={config.titleColorToken}
                brandKit={brandKit}
                onToggle={(c) => set("titleColorToken", c)}
              />
            </DesignDrawer>

            {/* Button styles */}
            <DesignDrawer
              title="Button styles"
              open={openSub === "button"}
              onToggle={() => setOpenSub((c) => (c === "button" ? null : "button"))}
            >
              <NumberInputRow
                label="Button size"
                value={config.closeButtonSize}
                min={24}
                max={72}
                suffix="px"
                onChange={(v) => set("closeButtonSize", v)}
              />
              <RadiusRow
                label="Corners"
                active={config.closeButtonRadius}
                onToggle={(r) => set("closeButtonRadius", r)}
              />
              <BorderRow
                widthLabel="Border"
                colorLabel="Border color"
                width={config.closeButtonBorderWidth}
                color={config.closeButtonBorderColorToken}
                brandKit={brandKit}
                onWidthChange={(v) => set("closeButtonBorderWidth", v)}
                onColorChange={(v) => set("closeButtonBorderColorToken", v)}
              />
              <NumberInputRow
                label="Opacity"
                value={config.closeButtonOpacity}
                min={0}
                max={100}
                suffix="%"
                onChange={(v) => set("closeButtonOpacity", v)}
              />
              <ColorSwatchRow
                label="Background"
                active={config.closeButtonBgColorToken}
                brandKit={brandKit}
                onToggle={(c) => set("closeButtonBgColorToken", c)}
              />
            </DesignDrawer>
          </DesignDrawer>
```

4. Add the needed imports at the top of the file:

```tsx
import { cn } from "@/lib/utils";
import { PORTFOLIO_FONT_KEYS, PORTFOLIO_FONTS } from "@/lib/page-builder/fonts";
import type { PortfolioFontKey } from "@/lib/page-builder/styleToolkit";
```

> Verify the font registry path/exports (`PORTFOLIO_FONT_KEYS`, `PORTFOLIO_FONTS`) — they are referenced in `StyleToolkitField.tsx`; reuse the same import source. `ColorSwatchRow`, `BorderRow`, `RadiusRow`, `NumberInputRow`, `DesignDrawer`, and `set` already exist in this file.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run CollectionsPopupPanelDialog`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add app/[locale]/\(app\)/portfolio/_components/CollectionsPopupPanelDialog.tsx app/[locale]/\(app\)/portfolio/_components/CollectionsPopupPanelDialog.test.tsx
git commit -m "feat(portfolio): add header + button styling drawers to collections popup panel"
```

### Task E7: Persist + apply the new popup config end to end

The new fields must (a) survive save (already serialized via `collectionsPopup` in the draft + `saveCollectionsPopupSnapshot`), and (b) reach the public render. The public `CollectionPopup` receives `popupConfig`. Confirm the public page passes the full config including new fields.

**Files:**
- Verify/Modify: the public page/component that builds `popupConfig` for `CollectionPopup` (search `popupConfig=` / `collectionsPopup`)
- Verify: `buildRenderWorkspace` (`serverContext.tsx:48-117`) only maps the 4 original fields into `RenderWorkspace.publicPage.collectionsPopup` — extend if the popup reads its config from there.

- [ ] **Step 1: Trace the public popup config source**

Run: `pnpm exec rg -n "popupConfig|collectionsPopup" app lib --glob '!**/*.test.*'`
Identify where the public `CollectionPopup` gets its `popupConfig`. If it comes from `RenderWorkspace.publicPage.collectionsPopup` (built by `buildRenderWorkspace`), that mapper must be extended to carry the new fields.

- [ ] **Step 2: Write the failing test (if mapper needs extension)**

Append to the `serverContext` test (create `lib/page-builder/serverContext.test.ts` if absent):

```ts
import { describe, it, expect } from "vitest";
import { buildRenderWorkspace } from "./serverContext";

describe("buildRenderWorkspace collections popup", () => {
  it("carries the title + close-button fields", () => {
    const ws = buildRenderWorkspace({
      _id: "1",
      name: "W",
      publicPage: {
        collectionsPopup: {
          titleText: "Galleries",
          titleAlign: "center",
          closeButtonSize: 44,
        } as never,
      },
    });
    expect(ws.publicPage?.collectionsPopup?.titleText).toBe("Galleries");
    expect(ws.publicPage?.collectionsPopup?.closeButtonSize).toBe(44);
  });
});
```

- [ ] **Step 3: Run test to verify it fails (if applicable)**

Run: `pnpm test --run serverContext`
Expected: FAIL if the mapper drops the new fields.

- [ ] **Step 4: Implement**

Two options depending on Step 1:
- If the popup reads config straight from `workspace.publicPage.collectionsPopup` (full object), no mapper change is needed — skip to verification.
- If it reads from the trimmed `RenderWorkspace.publicPage.collectionsPopup` (`serverContext.tsx:86-96` only maps 4 fields), broaden the `RenderWorkspace` type's `collectionsPopup` to `PortfolioCollectionsPopupConfig` and spread the whole object in `buildRenderWorkspace`:

```ts
collectionsPopup: (workspace.publicPage.collectionsPopup ?? null) as PortfolioCollectionsPopupConfig | null,
```

Update the `RenderWorkspace` type accordingly (import `PortfolioCollectionsPopupConfig`).

- [ ] **Step 5: Run test + typecheck**

Run: `pnpm test --run serverContext` then `pnpm typecheck`
Expected: PASS / clean.

- [ ] **Step 6: Commit**

```bash
git add lib/page-builder/serverContext.tsx lib/page-builder/serverContext.test.ts
git commit -m "feat(portfolio): carry full collections popup config to public render"
```

---

## Group F — Fix preview HTTP 431 (Scope 7)

The draft already lives in `localStorage` under `gallurio:portfolio-draft:${slug}` (written by `persistLocalDraft`). Stop inlining it into the iframe URL; client-render the preview by reading localStorage. Gallery images are baked into block props, so a client `<Render>` needs no server data fetch — only auth/translations/config, which the server shell supplies as serializable props.

### Task F1: Shrink the preview URL (remove the draft param)

**Files:**
- Modify: `.../portfolio/_components/EditorShell.tsx:559-572`
- Test: `EditorShell.test.tsx` (assert the iframe src has no `draft=`)

- [ ] **Step 1: Write the failing test**

In `EditorShell.test.tsx`, in the preview scenario, assert the iframe `src` does NOT contain `draft=` and DOES contain `zone=`/`v=`. Add (adapt to how the suite enters preview):

```tsx
it("builds a preview src without inlining the draft", async () => {
  // ...render EditorShell, click the Preview button...
  const iframe = await screen.findByTitle(/preview/i);
  const src = iframe.getAttribute("src") ?? "";
  expect(src).not.toContain("draft=");
  expect(src).toContain("zone=");
  expect(src).toContain("v=");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run EditorShell`
Expected: FAIL — src still contains `draft=`.

- [ ] **Step 3: Implement**

In `EditorShell.tsx`, delete the `previewDraft` block (lines 559-569) and change `previewSrc` (lines 570-572) to:

```tsx
  const previewSrc =
    `${previewBasePath}?zone=${activeSection === "contact" ? "contact" : activeZone}` +
    `&v=${previewNonce}`;
```

Ensure `togglePreview` still calls `await flushPendingSave(activeZone)` before entering preview (it does, line 391) so localStorage holds the freshest draft. `persistLocalDraft` writes the active zone via `zoneDataRef.current` — confirm `zoneDataRef` is current at preview time (the existing flow updates it on change).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run EditorShell`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/\(app\)/portfolio/_components/EditorShell.tsx app/[locale]/\(app\)/portfolio/_components/EditorShell.test.tsx
git commit -m "fix(portfolio): stop inlining preview draft into the iframe url"
```

### Task F2: Client preview renderer reading localStorage

**Files:**
- Create: `app/[locale]/portfolio-preview/_components/PreviewClient.tsx`
- Test: `app/[locale]/portfolio-preview/_components/PreviewClient.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `PreviewClient.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@measured/puck", () => ({
  Render: ({ data }: { data: unknown }) => (
    <pre data-testid="render-data">{JSON.stringify(data)}</pre>
  ),
}));

import { PreviewClient } from "./PreviewClient";

const KEY = "gallurio:portfolio-draft:studio-aurora";

describe("PreviewClient", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the home zone from the localStorage draft", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        data: { home: { content: [{ type: "Heading", props: { id: "h1", text: "Hi" } }], root: {} }, gallery: { content: [], root: {} } },
      }),
    );
    render(
      <PreviewClient
        slug="studio-aurora"
        zone="home"
        workspace={{ slug: "studio-aurora" } as never}
        fallbackData={{ content: [], root: {} }}
      />,
    );
    expect(screen.getByTestId("render-data").textContent).toContain("Hi");
  });

  it("falls back to server data when no draft is present", () => {
    render(
      <PreviewClient
        slug="studio-aurora"
        zone="home"
        workspace={{ slug: "studio-aurora" } as never}
        fallbackData={{ content: [{ type: "Heading", props: { id: "f1", text: "Fallback" } }], root: {} }}
      />,
    );
    expect(screen.getByTestId("render-data").textContent).toContain("Fallback");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run PreviewClient`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

Create `app/[locale]/portfolio-preview/_components/PreviewClient.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Render } from "@measured/puck";
import { puckConfig } from "@/lib/page-builder/config";
import type { PuckData } from "@/lib/page-builder/types";
import type { RenderWorkspace } from "@/lib/page-builder/serverContext";

const LOCAL_DRAFT_VERSION = 1;

type DraftShape = {
  version?: number;
  data?: Partial<Record<"home" | "gallery", PuckData>>;
};

export function PreviewClient({
  slug,
  zone,
  workspace,
  fallbackData,
}: {
  slug: string;
  zone: "home" | "gallery";
  workspace: RenderWorkspace;
  fallbackData: PuckData;
}) {
  const [data, setData] = useState<PuckData>(fallbackData);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`gallurio:portfolio-draft:${slug}`);
      if (!raw) return;
      const draft = JSON.parse(raw) as DraftShape;
      if (draft.version !== LOCAL_DRAFT_VERSION) return;
      const zoneData = draft.data?.[zone];
      if (zoneData && Array.isArray(zoneData.content)) setData(zoneData);
    } catch {
      // ignore malformed draft; keep server fallback
    }
  }, [slug, zone]);

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Render data={data as any} config={puckConfig as any} metadata={{ workspace }} />
  );
}
```

> Critical verification: confirm `@/lib/page-builder/config` (`puckConfig`) and all block render components are client-safe (no `server-only` import, no Node APIs at module load). The editor already imports block components client-side, and gallery blocks read images from props, so this should hold. If `config.ts` transitively imports `server-only`, create a client-safe config (same component map) for the preview, or guard the server-only import. Run `pnpm typecheck` and the dev preview to confirm.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run PreviewClient`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/portfolio-preview/_components/PreviewClient.tsx app/[locale]/portfolio-preview/_components/PreviewClient.test.tsx
git commit -m "feat(portfolio): client preview renderer reading the local draft"
```

### Task F3: Convert the preview page to a server shell that delegates to `PreviewClient`

The server page keeps doing auth, translations, brand-kit CSS, header config, and chrome labels, then renders `PreviewClient` (for home/gallery) or the existing contact card (for contact) instead of the RSC `<Render>` fed by `?draft=`.

**Files:**
- Modify: `app/[locale]/portfolio-preview/page.tsx`
- Test: `app/[locale]/portfolio-preview/page.test.tsx` (update)

- [ ] **Step 1: Update the failing test**

The existing test feeds `?draft=` and asserts DB-vs-draft precedence server-side. Since the draft now lives in localStorage (client), update the test to assert the server page renders `PreviewClient` with the right `zone`, `slug`, and `fallbackData` (from DB) and passes the resolved `headerConfig`. Mock `PreviewClient`:

```tsx
vi.mock("./_components/PreviewClient", () => ({
  PreviewClient: ({ zone, slug }: { zone: string; slug: string }) => (
    <div data-testid="preview-client">{zone}:{slug}</div>
  ),
}));
```

Then assert, for a non-contact zone, that `screen.getByTestId("preview-client")` shows `home:studio-aurora`. Keep the contact-zone test (contact still renders server-side from draft? No — see Step 3). Adjust contact assertions per Step 3.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run portfolio-preview` (or the page test path)
Expected: FAIL — page still uses `?draft=` + RSC Render.

- [ ] **Step 3: Implement**

Rewrite `page.tsx` to:
1. Drop `parseDraft`/`draft` usage and the `draft` searchParam.
2. Keep `requireOrg()` owner gate, `resolveBrandKit`, translations, `headerConfig` (from DB `pp.header` + `liveHeader` query fallback — keep the `?header=` path if still used, else drop), and `renderWorkspace` (`buildRenderWorkspace` + chrome labels).
3. For `zone === "contact"`, the contact preview needs the **draft** contact config which is now client-side. Render a small client contact wrapper that reads the draft, OR keep server contact using DB values. Per spec, the preview should reflect unsaved edits — so move the contact preview into a client path too. Simplest: have `PreviewClient` handle all three zones; for contact, render the existing `PreviewContactCard` from within a client wrapper using draft `contact`/`formLocale`. Pass the resolved labels (server-computed) as props.

Concretely, render:

```tsx
  const fallbackZoneData =
    zone === "contact"
      ? null
      : (((pp?.data as Record<string, unknown> | null | undefined)?.[zone]) as PuckData | undefined) ??
        { content: [], root: {} };

  // ... inside the returned wrapper, replacing `{body}`:
  {zone === "contact" ? (
    <PreviewContactClient
      slug={workspace.slug}
      labels={contactLabels}
      fallbackTitle={contactFallbackTitle}
      fallbackDescription={contactFallbackDescription}
    />
  ) : (
    <PreviewClient
      slug={workspace.slug}
      zone={zone}
      workspace={renderWorkspace}
      fallbackData={fallbackZoneData!}
    />
  )}
```

> This introduces a `PreviewContactClient` (client) that reads `contact`/`formLocale` from the localStorage draft and renders `PreviewContactCard`. If you prefer to keep scope tight, render contact server-side from DB values (acceptable: contact rarely needs unsaved preview) and note the limitation. Decide based on effort; the home/gallery 431 fix (the reported bug) does not depend on contact.

Keep the `PortfolioHeader` server-rendered with `headerConfig` resolved from DB (the header is edited in its own tab with its own preview; reading DB here is fine, or also thread via client if needed).

Remove `import { Render } from "@measured/puck/rsc";`, `runWithRenderWorkspace`, and unused parse helpers if no longer referenced.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run portfolio-preview`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm typecheck` then `pnpm lint`
Expected: clean (remove any now-unused imports flagged by lint).

- [ ] **Step 6: Manual verification (the actual bug)**

Run `pnpm dev`. Build a portfolio with several image-heavy blocks. Click **Preview**. Confirm:
1. No HTTP 431; the preview iframe loads.
2. The preview reflects the latest unsaved edits (since it reads localStorage).
3. Gallery images render in the preview.

- [ ] **Step 7: Commit**

```bash
git add app/[locale]/portfolio-preview/page.tsx app/[locale]/portfolio-preview/page.test.tsx
git commit -m "fix(portfolio): client-render preview from local draft to avoid 431"
```

---

## Group G — Final verification

### Task G1: Full sweep + manual 375px check

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`
Expected: all green. Fix any regressions (especially the existing `buildRenderWorkspace`/EditorShell suites touched by Groups C/E/F).

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck` then `pnpm lint`
Expected: clean.

- [ ] **Step 3: Manual 375px review**

`pnpm dev`, devtools at 375px. Verify:
1. Carousel heading gap control works; gap visible.
2. "Gallery Masonry" label in the Add-section list.
3. Page (root) style panel appears on deselect; bg/padding/margin apply live in canvas; DnD intact.
4. Padding control is in the Layout tab (not Design) for containers + gallery section presets.
5. Gallery section presets (Grid/Masonry/Featured Work) show banner bg-color + padding.
6. Collections Popup tab: live preview pane + Header styles (Title/Button) drawers; title override + typography + full-width align reflected in preview and on the published popup; close-button size/radius/border/opacity/bg reflected.
7. Preview opens with no 431 and shows latest edits.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "test(portfolio): final fixes from full sweep and 375px review"
```

---

## Self-review notes (for the executor)

- **Per-zone root style:** root `_rootStyle` is stored per Puck zone (home/gallery edited separately). This is intentional — each page can have its own background. If a global page background is later desired, lift it into `Workspace.publicPage` and apply in both zone renders.
- **Editor canvas selector (D4):** the Puck preview-surface selector is the one fragile point. Verify in-browser and adjust the selector list; the unit test covers the CSS serialization, not the live DOM.
- **Client config safety (F2):** if `puckConfig` is not client-safe, build a parallel client component map for the preview. Verify via `pnpm typecheck` + dev preview before declaring F done.
- **Contact preview (F3):** decide whether contact preview reads the live draft (client) or DB (server); the 431 fix itself only requires home/gallery to move off the URL param.
