# Carousel Heading / Description Drawers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the gallery carousel's text styling into two collapsible Heading/Description drawers with independent typography, sizing, and shape/size highlight bands; move Text Padding to the Layout tab.

**Architecture:** All new state lives on `_style` (`BlockStyle`). `GalleryHeader` (carousel-only) takes two per-target style groups; `GalleryCarouselBlock` threads `_style.heading*`/`_style.description*` into them; `StyleToolkitField` renders two collapsible drawers and moves Text Padding to Layout. No new Puck block props → editor/production parity untouched.

**Tech Stack:** Next.js 16, React 19, Puck, TypeScript, Tailwind v4, Vitest + Testing Library (jsdom). Run tests with `npx vitest run <file>` (not full `pnpm test`).

Reference design: `docs/superpowers/specs/2026-06-09-carousel-heading-description-drawers-design.md`.

---

## Task 1: BlockStyle types + per-target keys

**Files:**
- Modify: `lib/page-builder/styleToolkit.ts`
- Test: `lib/page-builder/styleToolkit.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `lib/page-builder/styleToolkit.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { HIGHLIGHT_SHAPES, HIGHLIGHT_SIZES } from "./styleToolkit";

describe("highlight option constants", () => {
  it("exposes the three band shapes in order", () => {
    expect(HIGHLIGHT_SHAPES).toEqual(["sharp", "subtle", "rounded"]);
  });
  it("exposes the three band sizes in order", () => {
    expect(HIGHLIGHT_SIZES).toEqual(["sm", "md", "lg"]);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run lib/page-builder/styleToolkit.test.ts`
Expected: FAIL (`HIGHLIGHT_SHAPES` is not exported).

- [ ] **Step 3: Add the types + constants**

In `lib/page-builder/styleToolkit.ts`, immediately after `export type TextAlign = "left" | "center" | "right";` (currently line 39), add:

```ts
export type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

// Highlight (marker band) appearance — shared by the carousel heading/description.
export const HIGHLIGHT_SHAPES = ["sharp", "subtle", "rounded"] as const;
export type HighlightShape = (typeof HIGHLIGHT_SHAPES)[number];
export const HIGHLIGHT_SIZES = ["sm", "md", "lg"] as const;
export type HighlightSize = (typeof HIGHLIGHT_SIZES)[number];
```

- [ ] **Step 4: Add the per-target BlockStyle keys**

In the same file, inside `BlockStyle`, REPLACE the existing carousel block (currently lines 94–101):

```ts
  // Carousel-only: floating-overlay text padding + independent heading/description
  // highlighter bands. Threaded into GalleryHeader by GalleryCarouselBlock.
  textPaddingX?: CssLength;
  textPaddingY?: CssLength;
  headingHighlight?: boolean;
  headingHighlightToken?: StyleColorToken | string;
  descriptionHighlight?: boolean;
  descriptionHighlightToken?: StyleColorToken | string;
```

with:

```ts
  // Carousel-only: floating-overlay text padding (shared) + per-target text
  // styling. Heading and description are styled independently and threaded into
  // GalleryHeader by GalleryCarouselBlock. All optional; supersedes the earlier
  // shared carousel typography (same branch, unreleased) so no migration needed.
  textPaddingX?: CssLength;
  textPaddingY?: CssLength;
  // Heading target
  headingBold?: boolean;
  headingItalic?: boolean;
  headingUnderline?: boolean;
  headingAlign?: TextAlign;
  headingColorToken?: StyleColorToken | string;
  headingFontFamily?: PortfolioFontKey;
  headingLevel?: HeadingLevel;
  headingHighlight?: boolean;
  headingHighlightToken?: StyleColorToken | string;
  headingHighlightShape?: HighlightShape;
  headingHighlightSize?: HighlightSize;
  // Description target
  descriptionBold?: boolean;
  descriptionItalic?: boolean;
  descriptionUnderline?: boolean;
  descriptionAlign?: TextAlign;
  descriptionColorToken?: StyleColorToken | string;
  descriptionFontFamily?: PortfolioFontKey;
  descriptionFontSize?: number; // px
  descriptionHighlight?: boolean;
  descriptionHighlightToken?: StyleColorToken | string;
  descriptionHighlightShape?: HighlightShape;
  descriptionHighlightSize?: HighlightSize;
```

(`PortfolioFontKey` is already imported at the top of the file. `resolveBlockStyle` needs **no** change — these keys are consumed only by `GalleryHeader`.)

- [ ] **Step 5: Run the test + typecheck**

Run: `npx vitest run lib/page-builder/styleToolkit.test.ts`
Expected: PASS (2 tests).
Run: `rtk tsc`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add lib/page-builder/styleToolkit.ts lib/page-builder/styleToolkit.test.ts
git commit -m "feat(portfolio): per-target carousel text keys + highlight shape/size types"
```

---

## Task 2: GalleryHeader — per-target grouped props

**Files:**
- Modify: `lib/page-builder/blocks/GalleryText.tsx` (replace the `GalleryHeader` export; keep `GalleryFooter`)
- Test: `lib/page-builder/blocks/GalleryText.test.tsx` (replace the describe block)

- [ ] **Step 1: Write the failing tests**

Replace the entire body of `lib/page-builder/blocks/GalleryText.test.tsx` with:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GalleryHeader } from "./GalleryText";

describe("GalleryHeader — per-target text styling", () => {
  it("uses the overlay default color when no token is given", () => {
    const { container } = render(<GalleryHeader heading="Hi" overlay />);
    expect(container.querySelector("h2")!.getAttribute("style") ?? "").toContain("var(--pf-color-bg)");
  });

  it("applies heading and description colors independently", () => {
    const { container } = render(
      <GalleryHeader
        heading="Hi"
        description="Yo"
        overlay
        headingStyle={{ colorToken: "primary" }}
        descriptionStyle={{ colorToken: "secondary" }}
      />
    );
    expect(container.querySelector("h2")!.getAttribute("style") ?? "").toContain("var(--pf-color-primary)");
    expect(container.querySelector("p")!.getAttribute("style") ?? "").toContain("var(--pf-color-secondary)");
  });

  it("applies bold/italic/underline only to the targeted text", () => {
    const { container } = render(
      <GalleryHeader heading="Hi" description="Yo" headingStyle={{ bold: true, italic: true, underline: true }} />
    );
    const h2 = container.querySelector("h2")!.getAttribute("style") ?? "";
    const p = container.querySelector("p")!.getAttribute("style") ?? "";
    expect(h2).toContain("font-weight: 700");
    expect(h2).toContain("font-style: italic");
    expect(h2).toContain("text-decoration: underline");
    expect(p).not.toContain("font-weight: 700");
  });

  it("renders the heading at the chosen level tag and size", () => {
    const { container } = render(<GalleryHeader heading="Big" headingStyle={{ level: "h1" }} />);
    const h1 = container.querySelector("h1");
    expect(h1).not.toBeNull();
    expect(container.querySelector("h2")).toBeNull();
    expect(h1!.getAttribute("style") ?? "").toContain("font-size: 3rem");
  });

  it("applies a custom description font size", () => {
    const { container } = render(<GalleryHeader description="Yo" descriptionStyle={{ fontSize: 20 }} />);
    expect(container.querySelector("p")!.getAttribute("style") ?? "").toContain("font-size: 20px");
  });

  it("aligns heading and description independently", () => {
    const { container } = render(
      <GalleryHeader
        heading="Hi"
        description="Yo"
        align="center"
        headingStyle={{ align: "left" }}
        descriptionStyle={{ align: "right" }}
      />
    );
    expect(container.querySelector("h2")!.getAttribute("style") ?? "").toContain("text-align: left");
    expect(container.querySelector("p")!.getAttribute("style") ?? "").toContain("text-align: right");
  });

  it("wraps only the heading in a <mark> band when its highlight is on", () => {
    const { container } = render(
      <GalleryHeader heading="Hi" description="Yo" headingStyle={{ highlight: true, highlightToken: "accent" }} />
    );
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBe(1);
    expect(container.querySelector("h2 mark")).not.toBeNull();
    expect(container.querySelector("p mark")).toBeNull();
    expect(marks[0].getAttribute("style") ?? "").toContain("var(--pf-color-accent)");
  });

  it("applies highlight shape and size to the band", () => {
    const { container } = render(
      <GalleryHeader heading="Hi" headingStyle={{ highlight: true, highlightShape: "rounded", highlightSize: "lg" }} />
    );
    const mark = container.querySelector("mark")!.getAttribute("style") ?? "";
    expect(mark).toContain("border-radius: 0.6em");
    expect(mark).toContain("padding: 0.2em 0.45em");
  });

  it("renders no <mark> when highlights are off", () => {
    const { container } = render(<GalleryHeader heading="Hi" description="Yo" />);
    expect(container.querySelector("mark")).toBeNull();
    expect(screen.getByText("Hi")).toBeInTheDocument();
    expect(screen.getByText("Yo")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run lib/page-builder/blocks/GalleryText.test.tsx`
Expected: FAIL (current `GalleryHeader` has no `headingStyle`/`descriptionStyle`).

- [ ] **Step 3: Rewrite `GalleryHeader`**

In `lib/page-builder/blocks/GalleryText.tsx`, REPLACE the import block and the entire `GalleryHeader` function (lines 8–104; leave `GalleryFooter` below untouched) with:

```tsx
import type { CSSProperties } from "react";
import {
  asText,
  colorTokenToVar,
  type StyleColorToken,
  type TextAlign,
  type HeadingLevel,
  type HighlightShape,
  type HighlightSize,
} from "@/lib/page-builder/styleToolkit";
import { fontFamilyValue, type PortfolioFontKey } from "@/lib/page-builder/fonts";

// Fixed level → size scale, mirrors HeadingBlock's HEADING_SIZE (manualBlocks.tsx)
// so the carousel heading matches the rest of the builder's heading sizes.
const HEADING_LEVEL_SIZE: Record<HeadingLevel, string> = {
  h1: "3rem",
  h2: "2.25rem",
  h3: "1.75rem",
  h4: "1.375rem",
  h5: "1.125rem",
  h6: "0.875rem",
};

const HL_RADIUS: Record<HighlightShape, string> = {
  sharp: "0",
  subtle: "0.15em",
  rounded: "0.6em",
};

const HL_PADDING: Record<HighlightSize, string> = {
  sm: "0.05em 0.2em",
  md: "0.1em 0.3em",
  lg: "0.2em 0.45em",
};

type GalleryTextTargetStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: TextAlign;
  colorToken?: StyleColorToken | string;
  fontFamily?: PortfolioFontKey;
  highlight?: boolean;
  highlightToken?: StyleColorToken | string;
  highlightShape?: HighlightShape;
  highlightSize?: HighlightSize;
};

// A marker-pen band that hugs each wrapped line (box-decoration-break: clone),
// its color/shape/size from the picked options (defaults match the prior band).
function band(
  token: StyleColorToken | string | undefined,
  shape: HighlightShape | undefined,
  size: HighlightSize | undefined
): CSSProperties {
  return {
    background: colorTokenToVar(token) ?? "var(--pf-color-accent)",
    color: "inherit",
    padding: HL_PADDING[size ?? "md"],
    borderRadius: HL_RADIUS[shape ?? "subtle"],
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
  };
}

export function GalleryHeader({
  heading,
  description,
  align = "center",
  overlay = false,
  headingStyle = {},
  descriptionStyle = {},
}: {
  heading?: string;
  description?: string;
  align?: TextAlign;
  overlay?: boolean;
  headingStyle?: GalleryTextTargetStyle & { level?: HeadingLevel };
  descriptionStyle?: GalleryTextTargetStyle & { fontSize?: number };
}) {
  const h = asText(heading);
  const d = asText(description);
  if (!h && !d) return null;

  const defaultColor = overlay ? "var(--pf-color-bg)" : "var(--pf-color-fg)";

  // Heading
  const HeadingTag = (headingStyle.level ?? "h2") as HeadingLevel;
  const hAlign = headingStyle.align ?? align;
  const hColor = headingStyle.colorToken
    ? colorTokenToVar(headingStyle.colorToken) ?? defaultColor
    : defaultColor;

  // Description
  const dAlign = descriptionStyle.align ?? align;
  const dColor = descriptionStyle.colorToken
    ? colorTokenToVar(descriptionStyle.colorToken) ?? defaultColor
    : defaultColor;
  const dMaxWidth = dAlign === "center" ? "40rem" : "36rem";
  const dMargin =
    dAlign === "center" ? "0.5rem auto 0" : dAlign === "right" ? "0.5rem 0 0 auto" : "0.5rem 0 0";

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      {h && (
        <HeadingTag
          style={{
            fontFamily: fontFamilyValue(headingStyle.fontFamily) ?? "var(--pf-font-heading)",
            fontSize: HEADING_LEVEL_SIZE[HeadingTag],
            lineHeight: 1.2,
            color: hColor,
            margin: 0,
            textAlign: hAlign,
            fontWeight: headingStyle.bold ? 700 : undefined,
            fontStyle: headingStyle.italic ? "italic" : undefined,
            textDecoration: headingStyle.underline ? "underline" : undefined,
            // The band provides its own contrast — drop the overlay text-shadow when highlighted.
            textShadow: overlay && !headingStyle.highlight ? "0 1px 3px rgba(0,0,0,0.45)" : undefined,
          }}
        >
          {headingStyle.highlight ? (
            <mark style={band(headingStyle.highlightToken, headingStyle.highlightShape, headingStyle.highlightSize)}>
              {h}
            </mark>
          ) : (
            h
          )}
        </HeadingTag>
      )}
      {d && (
        <p
          style={{
            fontFamily: fontFamilyValue(descriptionStyle.fontFamily) ?? "var(--pf-font-body)",
            fontSize: descriptionStyle.fontSize ? `${descriptionStyle.fontSize}px` : "1rem",
            lineHeight: 1.6,
            color: dColor,
            opacity: overlay ? 0.92 : 0.75,
            maxWidth: dMaxWidth,
            margin: dMargin,
            textAlign: dAlign,
            whiteSpace: "pre-line",
            fontWeight: descriptionStyle.bold ? 700 : undefined,
            fontStyle: descriptionStyle.italic ? "italic" : undefined,
            textDecoration: descriptionStyle.underline ? "underline" : undefined,
            textShadow: overlay && !descriptionStyle.highlight ? "0 1px 3px rgba(0,0,0,0.45)" : undefined,
          }}
        >
          {descriptionStyle.highlight ? (
            <mark
              style={band(descriptionStyle.highlightToken, descriptionStyle.highlightShape, descriptionStyle.highlightSize)}
            >
              {d}
            </mark>
          ) : (
            d
          )}
        </p>
      )}
    </div>
  );
}
```

Keep the existing `GalleryFooter` function unchanged below.

- [ ] **Step 4: Run to confirm pass**

Run: `npx vitest run lib/page-builder/blocks/GalleryText.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/blocks/GalleryText.tsx lib/page-builder/blocks/GalleryText.test.tsx
git commit -m "feat(portfolio): GalleryHeader per-target heading/description styling"
```

---

## Task 3: GalleryCarouselBlock — thread per-target groups

**Files:**
- Modify: `lib/page-builder/blocks/GalleryCarouselBlock.tsx` (only the `GalleryHeader` call, lines 126–139)
- Test: `lib/page-builder/blocks/GalleryCarouselBlock.test.tsx` (update carousel-text tests)

- [ ] **Step 1: Update the failing tests**

In `lib/page-builder/blocks/GalleryCarouselBlock.test.tsx`, REPLACE the test `"threads the picked text color token into the heading"` (and keep going through the file's last carousel-text tests) so the relevant tests read:

```tsx
  it("threads heading and description colors independently", () => {
    const { container } = render(
      GalleryCarouselBlock({
        ...base,
        images: imgs(2),
        heading: "Hi",
        description: "Yo",
        _style: { headingColorToken: "primary", descriptionColorToken: "secondary" },
      })
    );
    expect(container.querySelector("h2")!.getAttribute("style") ?? "").toContain("var(--pf-color-primary)");
    expect(container.querySelector("p")!.getAttribute("style") ?? "").toContain("var(--pf-color-secondary)");
  });

  it("renders the heading at the chosen level", () => {
    const { container } = render(
      GalleryCarouselBlock({ ...base, images: imgs(2), heading: "Hi", _style: { headingLevel: "h1" } })
    );
    expect(container.querySelector("h1")).not.toBeNull();
  });

  it("applies the description font size", () => {
    const { container } = render(
      GalleryCarouselBlock({ ...base, images: imgs(2), description: "Yo", _style: { descriptionFontSize: 22 } })
    );
    expect(container.querySelector("p")!.getAttribute("style") ?? "").toContain("font-size: 22px");
  });

  it("renders a heading highlight band with the chosen shape and size", () => {
    const { container } = render(
      GalleryCarouselBlock({
        ...base,
        images: imgs(2),
        heading: "Hi",
        _style: { headingHighlight: true, headingHighlightToken: "accent", headingHighlightShape: "rounded", headingHighlightSize: "lg" },
      })
    );
    const mark = container.querySelector("[data-gallery-overlay] h2 mark");
    expect(mark).not.toBeNull();
    expect(mark!.getAttribute("style") ?? "").toContain("border-radius: 0.6em");
    expect(mark!.getAttribute("style") ?? "").toContain("padding: 0.2em 0.45em");
  });

  it("applies Text Padding to the overlay layer (default 1.5rem, overridable)", () => {
    const def = render(GalleryCarouselBlock({ ...base, images: imgs(2), heading: "Hi" }));
    expect(def.container.querySelector("[data-gallery-overlay]")!.getAttribute("style") ?? "").toContain("padding: 1.5rem");

    const custom = render(
      GalleryCarouselBlock({ ...base, images: imgs(2), heading: "Hi", _style: { textPaddingX: "2rem", textPaddingY: "3rem" } })
    );
    const style = custom.container.querySelector("[data-gallery-overlay]")!.getAttribute("style") ?? "";
    expect(style).toContain("padding: 3rem 2rem");
  });

  it("lets _style.headingAlign override the float-derived heading alignment", () => {
    const { container } = render(
      GalleryCarouselBlock({ ...base, images: imgs(2), heading: "Hi", floatX: "center", _style: { headingAlign: "left" } })
    );
    expect(container.querySelector("h2")!.getAttribute("style") ?? "").toContain("text-align: left");
  });
```

Remove the now-superseded old `"threads the picked text color token into the heading"`, the old `"renders a heading highlight band when _style.headingHighlight is on"`, the old `"applies Text Padding ..."`, and the old `"lets _style.align override ..."` tests (replaced above). Keep the isomorphic/empty/default-props tests as-is.

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run lib/page-builder/blocks/GalleryCarouselBlock.test.tsx`
Expected: FAIL (block still threads the old flat props).

- [ ] **Step 3: Rewrite the `GalleryHeader` call**

In `lib/page-builder/blocks/GalleryCarouselBlock.tsx`, REPLACE the `<GalleryHeader ... />` element (lines 126–139) with:

```tsx
            <GalleryHeader
              heading={heading}
              description={description}
              align={horizontal}
              overlay
              headingStyle={{
                bold: _style?.headingBold,
                italic: _style?.headingItalic,
                underline: _style?.headingUnderline,
                align: _style?.headingAlign,
                colorToken: _style?.headingColorToken,
                fontFamily: _style?.headingFontFamily,
                level: _style?.headingLevel,
                highlight: _style?.headingHighlight,
                highlightToken: _style?.headingHighlightToken,
                highlightShape: _style?.headingHighlightShape,
                highlightSize: _style?.headingHighlightSize,
              }}
              descriptionStyle={{
                bold: _style?.descriptionBold,
                italic: _style?.descriptionItalic,
                underline: _style?.descriptionUnderline,
                align: _style?.descriptionAlign,
                colorToken: _style?.descriptionColorToken,
                fontFamily: _style?.descriptionFontFamily,
                fontSize: _style?.descriptionFontSize,
                highlight: _style?.descriptionHighlight,
                highlightToken: _style?.descriptionHighlightToken,
                highlightShape: _style?.descriptionHighlightShape,
                highlightSize: _style?.descriptionHighlightSize,
              }}
            />
```

(`horizontal` is the existing `CarouselFloatX` value — `"left" | "center" | "right"` — a valid `TextAlign`. The overlay wrapper's `padding` line at 121 stays as-is.)

- [ ] **Step 4: Run to confirm pass**

Run: `npx vitest run lib/page-builder/blocks/GalleryCarouselBlock.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/blocks/GalleryCarouselBlock.tsx lib/page-builder/blocks/GalleryCarouselBlock.test.tsx
git commit -m "feat(portfolio): thread per-target heading/description style into carousel"
```

---

## Task 4: StyleToolkitField — drawers + Layout Text Padding

**Files:**
- Modify: `lib/page-builder/StyleToolkitField.tsx`
- Test: `lib/page-builder/StyleToolkitField.test.tsx`

- [ ] **Step 1: Update the tests**

In `lib/page-builder/StyleToolkitField.test.tsx`:

(a) REPLACE the test `"hides Frame but keeps Typography for the GalleryCarousel (it renders text)"` (currently lines 122–127) with:

```tsx
  it("hides Frame and the shared Typography for the GalleryCarousel (uses drawers)", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryCarousel" />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    expect(screen.queryByText("Frame")).toBeNull();
    expect(screen.queryByText("Typography")).toBeNull();
    expect(screen.getByRole("button", { name: "Heading" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Description" })).toBeTruthy();
  });
```

(b) REMOVE the `import { CarouselTextControls } ...` line and the entire `describe("CarouselTextControls", ...)` block and the `describe("StyleToolkitField — carousel Design tab wiring", ...)` block (currently lines 183–238).

(c) APPEND these new describes at the end of the file:

```tsx
describe("StyleToolkitField — carousel per-target drawers", () => {
  it("keeps both drawers collapsed by default (inner controls hidden)", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryCarousel" />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    expect(screen.queryByRole("button", { name: "Bold" })).toBeNull();
  });

  it("expanding the Heading drawer reveals B/I/U, Level and the heading highlight", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryCarousel" />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Heading" }));
    expect(screen.getByRole("button", { name: "Bold" })).toBeTruthy();
    expect(screen.getByText("Level")).toBeTruthy();
    expect(screen.getByLabelText("Heading highlight")).toBeTruthy();
  });

  it("expanding the Description drawer reveals a Font size control", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryCarousel" />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Description" }));
    expect(screen.getByText("Font size")).toBeTruthy();
    expect(screen.getByLabelText("Description highlight")).toBeTruthy();
  });

  it("toggling the heading highlight writes headingHighlight: true", () => {
    const onChange = vi.fn();
    render(<StyleToolkitField value={undefined} onChange={onChange} blockType="GalleryCarousel" />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Heading" }));
    fireEvent.click(screen.getByLabelText("Heading highlight"));
    expect((onChange.mock.calls[0][0] as BlockStyle).headingHighlight).toBe(true);
  });

  it("shows Shape and Size rows once a highlight is on and writes the picked shape", () => {
    const onChange = vi.fn();
    render(<StyleToolkitField value={{ headingHighlight: true }} onChange={onChange} blockType="GalleryCarousel" />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Heading" }));
    expect(screen.getByText("Shape")).toBeTruthy();
    expect(screen.getByText("Size")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Rounded" }));
    expect((onChange.mock.calls[0][0] as BlockStyle).headingHighlightShape).toBe("rounded");
  });
});

describe("StyleToolkitField — carousel Layout tab", () => {
  it("shows the shared Text padding control on the Layout tab", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryCarousel" />);
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    expect(screen.getByText("Text padding")).toBeTruthy();
  });

  it("does not show Text padding on the Design tab for the carousel", () => {
    render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryCarousel" />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    expect(screen.queryByText("Text padding")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run lib/page-builder/StyleToolkitField.test.tsx`
Expected: FAIL (no drawers; `CarouselTextControls` import removed; Text padding still on Design).

- [ ] **Step 3: Add imports + primitives**

In `lib/page-builder/StyleToolkitField.tsx`:

(a) Add `type TextAlign`, `type HighlightShape`, `type HighlightSize` to the existing `styleToolkit` import (the block currently importing `STYLE_LIMITS, ANIMATION_TYPES, ... type SelfAlign`):

```ts
  type SelfAlign,
  type TextAlign,
  type HighlightShape,
  type HighlightSize,
} from "./styleToolkit";
```

(b) Add `PORTFOLIO_FONTS` is already imported; ensure `PortfolioFontKey` is too (it is). No other import changes.

(c) Add these option constants near the other `*_OPTIONS` consts (after `BG_SPEED_OPTIONS`, ~line 252):

```tsx
const HIGHLIGHT_SHAPE_OPTIONS = [
  { value: "sharp", label: "Sharp" },
  { value: "subtle", label: "Subtle" },
  { value: "rounded", label: "Rounded" },
] as const;

const HIGHLIGHT_SIZE_OPTIONS = [
  { value: "sm", label: "S" },
  { value: "md", label: "M" },
  { value: "lg", label: "L" },
] as const;
```

(d) Add a `Drawer` and a `ChoiceRow` primitive just above the `HighlightToggle` function (~line 540):

```tsx
function Drawer({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {title}
        {open ? <ChevronUp className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
      </button>
      {open && <div className="flex flex-col gap-3 border-t border-border p-3">{children}</div>}
    </div>
  );
}

function ChoiceRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | undefined;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {options.map(({ value: v, label: l }) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={cn(
              "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              value === v && "bg-foreground text-background hover:bg-foreground"
            )}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Replace `CarouselTextControls` with the per-target controls**

REPLACE the entire `export function CarouselTextControls({ s, set }) { ... }` (currently lines 574–628) with:

```tsx
function CarouselTargetControls({
  target,
  s,
  set,
}: {
  target: "heading" | "description";
  s: BlockStyle;
  set: (patch: Partial<BlockStyle>) => void;
}) {
  const isHeading = target === "heading";
  const bold = isHeading ? s.headingBold : s.descriptionBold;
  const italic = isHeading ? s.headingItalic : s.descriptionItalic;
  const underline = isHeading ? s.headingUnderline : s.descriptionUnderline;
  const align = isHeading ? s.headingAlign : s.descriptionAlign;
  const colorToken = isHeading ? s.headingColorToken : s.descriptionColorToken;
  const fontFamily = isHeading ? s.headingFontFamily : s.descriptionFontFamily;
  const highlight = isHeading ? s.headingHighlight : s.descriptionHighlight;
  const highlightToken = isHeading ? s.headingHighlightToken : s.descriptionHighlightToken;
  const highlightShape = isHeading ? s.headingHighlightShape : s.descriptionHighlightShape;
  const highlightSize = isHeading ? s.headingHighlightSize : s.descriptionHighlightSize;

  const setAlign = (a: TextAlign) => {
    const next = align === a ? undefined : a;
    set(isHeading ? { headingAlign: next } : { descriptionAlign: next });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <ToolbarToggle
          active={!!bold}
          title="Bold"
          Icon={Bold}
          onClick={() => set(isHeading ? { headingBold: !bold } : { descriptionBold: !bold })}
        />
        <ToolbarToggle
          active={!!italic}
          title="Italic"
          Icon={Italic}
          onClick={() => set(isHeading ? { headingItalic: !italic } : { descriptionItalic: !italic })}
        />
        <ToolbarToggle
          active={!!underline}
          title="Underline"
          Icon={Underline}
          onClick={() => set(isHeading ? { headingUnderline: !underline } : { descriptionUnderline: !underline })}
        />
        <ToolbarToggle active={align === "left"} title="Align left" Icon={AlignLeft} onClick={() => setAlign("left")} />
        <ToolbarToggle active={align === "center"} title="Align center" Icon={AlignCenter} onClick={() => setAlign("center")} />
        <ToolbarToggle active={align === "right"} title="Align right" Icon={AlignRight} onClick={() => setAlign("right")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <Baseline className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="text-xs text-muted-foreground">Text color</span>
        </div>
        <ColorSwatchRow
          value={colorToken}
          onChange={(t) => set(isHeading ? { headingColorToken: t } : { descriptionColorToken: t })}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="shrink-0 text-xs text-muted-foreground">Font</span>
        <div className="flex items-center gap-1">
          <select
            value={fontFamily ?? ""}
            onChange={(e) => {
              const f = e.target.value ? (e.target.value as PortfolioFontKey) : undefined;
              set(isHeading ? { headingFontFamily: f } : { descriptionFontFamily: f });
            }}
            className="h-7 cursor-pointer border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Theme font</option>
            {PORTFOLIO_FONT_KEYS.map((key) => (
              <option key={key} value={key}>
                {PORTFOLIO_FONTS[key].label}
              </option>
            ))}
          </select>
          <ResetButton
            onClick={() => set(isHeading ? { headingFontFamily: undefined } : { descriptionFontFamily: undefined })}
            label="Font"
          />
        </div>
      </div>

      {isHeading ? (
        <HeadingLevelButtons value={s.headingLevel} onChange={(v) => set({ headingLevel: v })} />
      ) : (
        <NumberInputRow
          label="Font size"
          value={s.descriptionFontSize}
          min={STYLE_LIMITS.fontSize.min}
          max={STYLE_LIMITS.fontSize.max}
          onChange={(v) => set({ descriptionFontSize: v })}
        />
      )}

      <div className="flex flex-col gap-1.5">
        <HighlightToggle
          label={isHeading ? "Heading highlight" : "Description highlight"}
          on={!!highlight}
          onToggle={() => set(isHeading ? { headingHighlight: !highlight } : { descriptionHighlight: !highlight })}
        />
        {highlight && (
          <div className="flex flex-col gap-2">
            <ColorSwatchRow
              value={highlightToken}
              onChange={(t) => set(isHeading ? { headingHighlightToken: t } : { descriptionHighlightToken: t })}
              allowNone={false}
            />
            <ChoiceRow
              label="Shape"
              value={(highlightShape ?? "subtle") as HighlightShape}
              options={HIGHLIGHT_SHAPE_OPTIONS}
              onChange={(v) => set(isHeading ? { headingHighlightShape: v } : { descriptionHighlightShape: v })}
            />
            <ChoiceRow
              label="Size"
              value={(highlightSize ?? "md") as HighlightSize}
              options={HIGHLIGHT_SIZE_OPTIONS}
              onChange={(v) => set(isHeading ? { headingHighlightSize: v } : { descriptionHighlightSize: v })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function CarouselTextPadding({
  s,
  set,
}: {
  s: BlockStyle;
  set: (patch: Partial<BlockStyle>) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Text padding</span>
      <DimensionInput label="Horizontal (X)" value={s.textPaddingX} onChange={(v) => set({ textPaddingX: v })} />
      <DimensionInput label="Vertical (Y)" value={s.textPaddingY} onChange={(v) => set({ textPaddingY: v })} />
    </div>
  );
}
```

(`HighlightToggle` directly above stays as-is.)

- [ ] **Step 5: Wire the drawers into `DesignTab`**

In `DesignTab`, change the `showTypography` line (currently line 648) to also exclude the carousel:

```tsx
  const isCarousel = blockType === "GalleryCarousel";
  // Image-only gallery blocks have no on-page text; the carousel uses per-target drawers.
  const showTypography = !GALLERY_NO_TEXT_BLOCKS.has(blockType) && !isCarousel;
```

Then REPLACE the line `{blockType === "GalleryCarousel" && <CarouselTextControls s={s} set={set} />}` (currently line 755) with:

```tsx
      {isCarousel && (
        <div className="flex flex-col gap-2">
          <Drawer title="Heading">
            <CarouselTargetControls target="heading" s={s} set={set} />
          </Drawer>
          <Drawer title="Description">
            <CarouselTargetControls target="description" s={s} set={set} />
          </Drawer>
        </div>
      )}
```

- [ ] **Step 6: Wire Text padding into `LayoutTabBody`**

In `LayoutTabBody`, REPLACE the gallery branch (currently lines 1166–1172):

```tsx
  if (isGalleryLayout && p && setProp) {
    return (
      <div className="flex flex-col gap-4 p-3">
        <GalleryLayoutControls type={blockType} p={p} setProp={setProp} />
      </div>
    );
  }
```

with:

```tsx
  const isCarousel = blockType === "GalleryCarousel";
  if (isGalleryLayout && p && setProp) {
    return (
      <div className="flex flex-col gap-4 p-3">
        <GalleryLayoutControls type={blockType} p={p} setProp={setProp} />
        {isCarousel && <CarouselTextPadding s={s} set={set} />}
      </div>
    );
  }
  // Standalone (no Puck provider — tests): the carousel still exposes Text padding.
  if (isGalleryLayout) {
    return <div className="flex flex-col gap-4 p-3">{isCarousel && <CarouselTextPadding s={s} set={set} />}</div>;
  }
```

- [ ] **Step 7: Run to confirm pass**

Run: `npx vitest run lib/page-builder/StyleToolkitField.test.tsx`
Expected: PASS (existing non-carousel tests + the new drawer/layout tests).

- [ ] **Step 8: Commit**

```bash
git add lib/page-builder/StyleToolkitField.tsx lib/page-builder/StyleToolkitField.test.tsx
git commit -m "feat(portfolio): carousel heading/description drawers + Layout text padding"
```

---

## Task 5: Verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Touched-area tests**

Run: `npx vitest run GalleryText GalleryCarouselBlock StyleToolkitField styleToolkit editorConfig`
Expected: all PASS (editorConfig parity stays green — no new block props/fields).

- [ ] **Step 2: Typecheck**

Run: `rtk tsc`
Expected: clean (0 errors).

- [ ] **Step 3: Lint**

Run: `rtk lint`
Expected: no NEW errors (pre-existing `_`-prefixed unused-var warnings in unrelated files are acceptable).

- [ ] **Step 4: Build (client-bundle hygiene for the isomorphic carousel)**

Run: `rtk next build`
Expected: exit 0, full route manifest emitted.

- [ ] **Step 5: Manual 375px check (note for reviewer)**

Confirm in the editor that the two drawers stack cleanly at 375px and the overlay heading/description render at the chosen level/size. (Cannot be automated; flag for the human reviewer.)
