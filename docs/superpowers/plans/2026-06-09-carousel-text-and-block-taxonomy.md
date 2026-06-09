# Carousel Text Controls + Block Taxonomy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Gallery Carousel's floating heading/description honor the toolkit's text color + bold/italic/underline/align, add a "Text Padding" (X/Y) control and an independent heading/description highlighter band, then rename the gallery/featured blocks and move the carousel into the Preset blocks group.

**Architecture:** The carousel is an isomorphic block (`GalleryCarouselBlock.tsx`) that renders a `data-gallery-overlay` floating layer wrapping the shared `GalleryHeader` (`GalleryText.tsx`). `GalleryHeader` currently hardcodes its text color and ignores `_style`, so the toolkit color/typography controls don't reach it — the fix threads them through. New carousel-only style is stored on `BlockStyle` (`_style`), so there are no new Puck fields and the editor/production parity test is untouched. Taxonomy lives in `blockCategories.ts` (category arrays), `sectionPresets.ts` (preset labels), the block config files + `editorConfig.tsx` (manual labels).

**Tech Stack:** Next.js 16, React 19, Puck (`@measured/puck`), TypeScript, Tailwind v4, Vitest + Testing Library (jsdom). Test runner: `pnpm test <fragment>` (script is `vitest run`).

---

## Ground-truth references (verified verbatim)

- `lib/page-builder/blocks/GalleryText.tsx` — `GalleryHeader({heading, description, align="center", overlay=false})`; computes `textColor = overlay ? "var(--pf-color-bg)" : "var(--pf-color-fg)"` and applies it to the `h2`/`p` (overriding any inherited section color — this is the color bug). Imports only `asText`.
- `lib/page-builder/blocks/GalleryCarouselBlock.tsx` — synchronous, isomorphic. `GalleryCarouselProps = { _style?, images, heading, description, aspect, floatX, floatY, autoplay }`. Renders `<section data-block="gallery-carousel">` → `<div position:relative>` → `<GalleryCarouselClient/>` + `<div data-gallery-overlay style={{position:absolute, inset:0, display:flex, alignItems:FLOAT_Y_TO_ALIGN[vertical], justifyContent:FLOAT_X_TO_JUSTIFY[horizontal], padding:"1.5rem", pointerEvents:"none"}}>` → `<div width:min(100%,40rem)>` → `<GalleryHeader heading={heading} description={description} align={horizontal} overlay />`. `horizontal = floatX ?? "center"`.
- `lib/page-builder/styleToolkit.ts` — `StyleColorToken`, `TextAlign = "left"|"center"|"right"`, `CssLength = string`, `BlockStyle` (already has `textColorToken`, `bold`, `italic`, `underline`, `align`), `colorTokenToVar(token)`, `asText(value)`.
- `lib/page-builder/StyleToolkitField.tsx` — standalone component accepts a `blockType` prop (tests already pass `blockType="GalleryCarousel"`). `DesignTab({s, set, blockType})`: `showTypography = !GALLERY_NO_TEXT_BLOCKS.has(blockType)` (carousel NOT in the set → typography shows: bold/italic/underline/align + text color). `showPadding = FLEX_CONTAINER_BLOCKS.has(blockType)` (carousel false). The Typography section spans the `{showTypography && ( … )}` block ending at the standalone `)}` right before the Frame section comment. Imports `ToolbarToggle, ColorSwatchRow, NumberInputRow, DimensionInput, IconRow, ResetButton` from `./toolbarPrimitives` and `cn` from `@/lib/utils`. The exported sibling `ContainerBackgroundControls` is the precedent for an exported, directly-tested sub-control.
- `lib/page-builder/toolbarPrimitives.tsx` — `DimensionInput({label, value, onChange, min?, max?})`; `ColorSwatchRow({value, onChange, allowNone?})` (swatch buttons have `aria-label` = `COLOR_LABEL[token]`: "Primary"/"Secondary"/"Accent"/"Background"/"Text"); switch pattern is `<button role="switch" aria-checked … aria-label=…>`.
- `lib/page-builder/brandColors.tsx` — `useBrandColors()` has a context default, so `ColorSwatchRow` renders with no provider in tests.
- `lib/page-builder/blockCategories.ts` — `PRESET_BLOCK_KEYS` = [Hero/About/Services/Cta/Contact + `GalleryGridPreset`,`GalleryMasonryPreset`,`FeaturedWorkPreset`]; `MANUAL_BLOCK_KEYS` = [`GalleryGrid`,`GalleryMasonry`,`GalleryCarousel`,`FeaturedWork`,Heading,Text,Image,Button,Video,Columns,Container,ContactDetails,Spacer,Divider].
- Preset labels: `lib/page-builder/blocks/sectionPresets.ts:173-175` (`SECTION_PRESETS`), read by BOTH configs.
- Manual labels are DUPLICATED: block config files (`GalleryGridBlock.tsx:140`, `GalleryMasonryBlock.tsx:137`, `FeaturedWorkBlock.tsx:162`) AND `editorConfig.tsx` (378 `"Gallery Grid"`, 410 `"Gallery Masonry"`, 490 `"Featured Work"`). Renaming a manual label requires editing BOTH.

---

## Task 1: GalleryHeader — thread text color, bold/italic/underline, highlight bands

**Files:**
- Modify: `lib/page-builder/blocks/GalleryText.tsx`
- Test (create): `lib/page-builder/blocks/GalleryText.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `lib/page-builder/blocks/GalleryText.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GalleryHeader } from "./GalleryText";

describe("GalleryHeader — text styling", () => {
  it("uses the overlay default color when no token is given", () => {
    const { container } = render(<GalleryHeader heading="Hi" overlay />);
    const style = container.querySelector("h2")!.getAttribute("style") ?? "";
    expect(style).toContain("var(--pf-color-bg)");
  });

  it("applies the picked text color token to heading and description", () => {
    const { container } = render(
      <GalleryHeader heading="Hi" description="Yo" overlay textColorToken="primary" />
    );
    const h2 = container.querySelector("h2")!.getAttribute("style") ?? "";
    const p = container.querySelector("p")!.getAttribute("style") ?? "";
    expect(h2).toContain("var(--pf-color-primary)");
    expect(p).toContain("var(--pf-color-primary)");
  });

  it("applies bold / italic / underline to heading and description", () => {
    const { container } = render(
      <GalleryHeader heading="Hi" description="Yo" bold italic underline />
    );
    const h2 = container.querySelector("h2")!.getAttribute("style") ?? "";
    const p = container.querySelector("p")!.getAttribute("style") ?? "";
    expect(h2).toContain("font-weight: 700");
    expect(h2).toContain("font-style: italic");
    expect(h2).toContain("text-decoration: underline");
    expect(p).toContain("font-weight: 700");
  });

  it("wraps only the heading in a <mark> band when headingHighlight is on", () => {
    const { container } = render(
      <GalleryHeader
        heading="Hi"
        description="Yo"
        headingHighlight
        headingHighlightToken="accent"
      />
    );
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBe(1);
    expect(container.querySelector("h2 mark")).not.toBeNull();
    expect(container.querySelector("p mark")).toBeNull();
    expect(marks[0].getAttribute("style") ?? "").toContain("var(--pf-color-accent)");
  });

  it("wraps only the description in a <mark> band when descriptionHighlight is on", () => {
    const { container } = render(
      <GalleryHeader heading="Hi" description="Yo" descriptionHighlight descriptionHighlightToken="primary" />
    );
    expect(container.querySelector("h2 mark")).toBeNull();
    expect(container.querySelector("p mark")).not.toBeNull();
  });

  it("renders no <mark> when highlights are off", () => {
    const { container } = render(<GalleryHeader heading="Hi" description="Yo" />);
    expect(container.querySelector("mark")).toBeNull();
    expect(screen.getByText("Hi")).toBeInTheDocument();
    expect(screen.getByText("Yo")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test GalleryText`
Expected: FAIL — `GalleryHeader` does not accept `textColorToken`/`bold`/`headingHighlight` etc.; no `<mark>` is rendered.

- [ ] **Step 3: Implement**

Replace the `GalleryHeader` function in `lib/page-builder/blocks/GalleryText.tsx` (keep `GalleryFooter` unchanged). Update the import line and add the new logic:

```tsx
import type { CSSProperties } from "react";
import { asText, colorTokenToVar, type StyleColorToken } from "@/lib/page-builder/styleToolkit";

export function GalleryHeader({
  heading,
  description,
  align = "center",
  overlay = false,
  textColorToken,
  bold = false,
  italic = false,
  underline = false,
  headingHighlight = false,
  headingHighlightToken,
  descriptionHighlight = false,
  descriptionHighlightToken,
}: {
  heading?: string;
  description?: string;
  align?: "left" | "center" | "right";
  overlay?: boolean;
  textColorToken?: StyleColorToken | string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  headingHighlight?: boolean;
  headingHighlightToken?: StyleColorToken | string;
  descriptionHighlight?: boolean;
  descriptionHighlightToken?: StyleColorToken | string;
}) {
  const h = asText(heading);
  const d = asText(description);
  if (!h && !d) return null;

  const maxWidth = align === "center" ? "40rem" : "36rem";
  const paragraphMargin =
    align === "center" ? "0.5rem auto 0" : align === "right" ? "0.5rem 0 0 auto" : "0.5rem 0 0";
  const defaultColor = overlay ? "var(--pf-color-bg)" : "var(--pf-color-fg)";
  const textColor = textColorToken ? colorTokenToVar(textColorToken) ?? defaultColor : defaultColor;
  const fontWeight = bold ? 700 : undefined;
  const fontStyle = italic ? "italic" : undefined;
  const textDecoration = underline ? "underline" : undefined;

  // A marker-pen band that hugs each wrapped line (box-decoration-break: clone),
  // its color from the picked token (falls back to the accent palette slot).
  const band = (token: StyleColorToken | string | undefined): CSSProperties => ({
    background: colorTokenToVar(token) ?? "var(--pf-color-accent)",
    color: "inherit",
    padding: "0.1em 0.3em",
    borderRadius: "0.15em",
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
  });

  return (
    <div style={{ textAlign: align, marginBottom: "1.5rem" }}>
      {h && (
        <h2
          style={{
            fontFamily: "var(--pf-font-heading)",
            fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
            lineHeight: 1.2,
            color: textColor,
            margin: 0,
            fontWeight,
            fontStyle,
            textDecoration,
            // The band provides its own contrast — drop the overlay text-shadow when highlighted.
            textShadow: overlay && !headingHighlight ? "0 1px 3px rgba(0,0,0,0.45)" : undefined,
          }}
        >
          {headingHighlight ? <mark style={band(headingHighlightToken)}>{h}</mark> : h}
        </h2>
      )}
      {d && (
        <p
          style={{
            fontFamily: "var(--pf-font-body)",
            fontSize: "1rem",
            lineHeight: 1.6,
            color: textColor,
            opacity: overlay ? 0.92 : 0.75,
            maxWidth,
            margin: paragraphMargin,
            whiteSpace: "pre-line",
            fontWeight,
            fontStyle,
            textDecoration,
            textShadow: overlay && !descriptionHighlight ? "0 1px 3px rgba(0,0,0,0.45)" : undefined,
          }}
        >
          {descriptionHighlight ? <mark style={band(descriptionHighlightToken)}>{d}</mark> : d}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test GalleryText`
Expected: PASS (6 tests). If jsdom drops a `var(...)` color from the serialized style, assert against `mark`/structure instead — but current cssstyle preserves `var()`.

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/blocks/GalleryText.tsx lib/page-builder/blocks/GalleryText.test.tsx
git commit -m "feat(portfolio): GalleryHeader honors text color, bold/italic/underline, highlight bands"
```

---

## Task 2: Add carousel text-style fields to BlockStyle

**Files:**
- Modify: `lib/page-builder/styleToolkit.ts:93` (inside `BlockStyle`, after `align?: TextAlign;`)

- [ ] **Step 1: Add the fields**

In `lib/page-builder/styleToolkit.ts`, inside the `BlockStyle` type, immediately after the line `  align?: TextAlign;`, insert:

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

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: PASS (0 errors). `CssLength` and `StyleColorToken` are already declared above `BlockStyle` in this file.

- [ ] **Step 3: Commit**

```bash
git add lib/page-builder/styleToolkit.ts
git commit -m "feat(portfolio): add carousel text padding + highlight fields to BlockStyle"
```

---

## Task 3: Thread `_style` text controls + Text Padding through the carousel block

**Files:**
- Modify: `lib/page-builder/blocks/GalleryCarouselBlock.tsx` (the render's overlay `<div>` + `<GalleryHeader>` call)
- Test: `lib/page-builder/blocks/GalleryCarouselBlock.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append these tests inside the existing `describe("GalleryCarouselBlock — isomorphic render", …)` block in `lib/page-builder/blocks/GalleryCarouselBlock.test.tsx` (after the existing tests, before the closing `});`):

```tsx
  it("threads the picked text color token into the heading", () => {
    const { container } = render(
      GalleryCarouselBlock({ ...base, images: imgs(2), heading: "Hi", _style: { textColorToken: "primary" } })
    );
    expect(container.querySelector("h2")!.getAttribute("style") ?? "").toContain("var(--pf-color-primary)");
  });

  it("renders a heading highlight band when _style.headingHighlight is on", () => {
    const { container } = render(
      GalleryCarouselBlock({
        ...base,
        images: imgs(2),
        heading: "Hi",
        _style: { headingHighlight: true, headingHighlightToken: "accent" },
      })
    );
    expect(container.querySelector("[data-gallery-overlay] h2 mark")).not.toBeNull();
  });

  it("applies Text Padding to the overlay layer (default 1.5rem, overridable)", () => {
    const def = render(GalleryCarouselBlock({ ...base, images: imgs(2), heading: "Hi" }));
    expect(def.container.querySelector("[data-gallery-overlay]")!.getAttribute("style") ?? "").toContain("padding: 1.5rem");

    const custom = render(
      GalleryCarouselBlock({ ...base, images: imgs(2), heading: "Hi", _style: { textPaddingX: "2rem", textPaddingY: "3rem" } })
    );
    const style = custom.container.querySelector("[data-gallery-overlay]")!.getAttribute("style") ?? "";
    expect(style).toContain("3rem");
    expect(style).toContain("2rem");
  });

  it("lets _style.align override the float-derived heading alignment", () => {
    const { container } = render(
      GalleryCarouselBlock({ ...base, images: imgs(2), heading: "Hi", floatX: "center", _style: { align: "left" } })
    );
    const wrapper = container.querySelector("h2")!.parentElement!;
    expect(wrapper.getAttribute("style") ?? "").toContain("text-align: left");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test GalleryCarouselBlock`
Expected: FAIL — color/highlight not threaded; overlay padding is the hardcoded `1.5rem` literal (the override test fails); `_style.align` is ignored.

- [ ] **Step 3: Implement**

In `lib/page-builder/blocks/GalleryCarouselBlock.tsx`, replace the overlay `<div data-gallery-overlay …>` block and the `<GalleryHeader …>` call inside the render. Find:

```tsx
        <div
          data-gallery-overlay="true"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: FLOAT_Y_TO_ALIGN[vertical],
            justifyContent: FLOAT_X_TO_JUSTIFY[horizontal],
            padding: "1.5rem",
            pointerEvents: "none",
          }}
        >
          <div style={{ width: "min(100%, 40rem)" }}>
            <GalleryHeader heading={heading} description={description} align={horizontal} overlay />
          </div>
        </div>
```

Replace with:

```tsx
        <div
          data-gallery-overlay="true"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: FLOAT_Y_TO_ALIGN[vertical],
            justifyContent: FLOAT_X_TO_JUSTIFY[horizontal],
            // Text Padding (toolkit) drives the overlay inset; default keeps the prior 1.5rem.
            padding: `${_style?.textPaddingY ?? "1.5rem"} ${_style?.textPaddingX ?? "1.5rem"}`,
            pointerEvents: "none",
          }}
        >
          <div style={{ width: "min(100%, 40rem)" }}>
            <GalleryHeader
              heading={heading}
              description={description}
              align={_style?.align ?? horizontal}
              overlay
              textColorToken={_style?.textColorToken}
              bold={_style?.bold}
              italic={_style?.italic}
              underline={_style?.underline}
              headingHighlight={_style?.headingHighlight}
              headingHighlightToken={_style?.headingHighlightToken}
              descriptionHighlight={_style?.descriptionHighlight}
              descriptionHighlightToken={_style?.descriptionHighlightToken}
            />
          </div>
        </div>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test GalleryCarouselBlock`
Expected: PASS (existing 5 + new 4).

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/blocks/GalleryCarouselBlock.tsx lib/page-builder/blocks/GalleryCarouselBlock.test.tsx
git commit -m "feat(portfolio): carousel threads _style text color/typography/highlight + Text Padding"
```

---

## Task 4: Toolkit — CarouselTextControls (Text Padding + heading/description highlight)

**Files:**
- Modify: `lib/page-builder/StyleToolkitField.tsx` (add exported `CarouselTextControls`; render it in `DesignTab` when the block is the carousel)
- Test: `lib/page-builder/StyleToolkitField.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `lib/page-builder/StyleToolkitField.test.tsx` (after the `ContainerBackgroundControls` describe block, at end of file):

```tsx
import { CarouselTextControls } from "./StyleToolkitField";

describe("CarouselTextControls", () => {
  it("renders Text padding X/Y inputs", () => {
    render(<CarouselTextControls s={{}} set={() => {}} />);
    expect(screen.getByText("Text padding")).toBeTruthy();
    expect(screen.getByText("Horizontal (X)")).toBeTruthy();
    expect(screen.getByText("Vertical (Y)")).toBeTruthy();
  });

  it("toggles the heading highlight via onChange", () => {
    const set = vi.fn();
    render(<CarouselTextControls s={{}} set={set} />);
    fireEvent.click(screen.getByLabelText("Heading highlight"));
    expect(set).toHaveBeenCalledWith({ headingHighlight: true });
  });

  it("hides the heading color swatches until the highlight is on", () => {
    const { rerender } = render(<CarouselTextControls s={{}} set={() => {}} />);
    // Off: no heading swatch row (the "Accent" swatch is absent).
    expect(screen.queryByLabelText("Accent")).toBeNull();
    rerender(<CarouselTextControls s={{ headingHighlight: true }} set={() => {}} />);
    expect(screen.getByLabelText("Accent")).toBeTruthy();
  });

  it("picks a heading highlight color via onChange", () => {
    const set = vi.fn();
    render(<CarouselTextControls s={{ headingHighlight: true }} set={set} />);
    fireEvent.click(screen.getByLabelText("Primary"));
    expect(set).toHaveBeenCalledWith({ headingHighlightToken: "primary" });
  });

  it("toggles the description highlight independently", () => {
    const set = vi.fn();
    render(<CarouselTextControls s={{}} set={set} />);
    fireEvent.click(screen.getByLabelText("Description highlight"));
    expect(set).toHaveBeenCalledWith({ descriptionHighlight: true });
  });
});

describe("StyleToolkitField — carousel Design tab wiring", () => {
  it("shows Text padding for the carousel and not for an image-only gallery block", () => {
    const carousel = render(
      <StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryCarousel" />
    );
    fireEvent.click(carousel.getByRole("button", { name: "Design" }));
    expect(carousel.getByText("Text padding")).toBeTruthy();

    const grid = render(<StyleToolkitField value={undefined} onChange={vi.fn()} blockType="GalleryGrid" />);
    fireEvent.click(grid.getByRole("button", { name: "Design" }));
    expect(grid.queryByText("Text padding")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test StyleToolkitField`
Expected: FAIL — `CarouselTextControls` is not exported; "Text padding" not rendered.

- [ ] **Step 3a: Implement the control**

In `lib/page-builder/StyleToolkitField.tsx`, add this exported component just above the `DesignTab` function definition (the `// Design tab` comment block):

```tsx
// ---------------------------------------------------------------------------
// Carousel text controls — Text Padding + independent heading/description
// highlight bands. Carousel-only; stored on `_style` (BlockStyle), threaded into
// GalleryHeader by GalleryCarouselBlock.
// ---------------------------------------------------------------------------

function HighlightToggle({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={onToggle}
        className={cn(
          "relative inline-flex h-5 w-9 cursor-pointer items-center border border-border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          on ? "bg-foreground" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "inline-block h-3 w-3 translate-x-1 transition-transform bg-background",
            on && "translate-x-5"
          )}
        />
      </button>
    </div>
  );
}

export function CarouselTextControls({
  s,
  set,
}: {
  s: BlockStyle;
  set: (patch: Partial<BlockStyle>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Text padding
        </span>
        <DimensionInput
          label="Horizontal (X)"
          value={s.textPaddingX}
          onChange={(v) => set({ textPaddingX: v })}
        />
        <DimensionInput
          label="Vertical (Y)"
          value={s.textPaddingY}
          onChange={(v) => set({ textPaddingY: v })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <HighlightToggle
          label="Heading highlight"
          on={!!s.headingHighlight}
          onToggle={() => set({ headingHighlight: !s.headingHighlight })}
        />
        {s.headingHighlight && (
          <ColorSwatchRow
            value={s.headingHighlightToken}
            onChange={(t) => set({ headingHighlightToken: t })}
            allowNone={false}
          />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <HighlightToggle
          label="Description highlight"
          on={!!s.descriptionHighlight}
          onToggle={() => set({ descriptionHighlight: !s.descriptionHighlight })}
        />
        {s.descriptionHighlight && (
          <ColorSwatchRow
            value={s.descriptionHighlightToken}
            onChange={(t) => set({ descriptionHighlightToken: t })}
            allowNone={false}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3b: Render it in the carousel's Design tab**

In the `DesignTab` function, immediately AFTER the Typography section's closing `)}` (the `{showTypography && ( … )}` block) and BEFORE the `{/* Frame … */}` comment, insert:

```tsx
      {blockType === "GalleryCarousel" && <CarouselTextControls s={s} set={set} />}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test StyleToolkitField`
Expected: PASS (existing tests + new `CarouselTextControls` describe + the wiring test).

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/StyleToolkitField.tsx lib/page-builder/StyleToolkitField.test.tsx
git commit -m "feat(portfolio): carousel Text Padding + heading/description highlight controls"
```

---

## Task 5: Rename gallery/featured block labels

**Files:**
- Modify: `lib/page-builder/blocks/sectionPresets.ts:173-175` (preset labels)
- Modify: `lib/page-builder/blocks/GalleryGridBlock.tsx:140`, `lib/page-builder/blocks/GalleryMasonryBlock.tsx:137`, `lib/page-builder/blocks/FeaturedWorkBlock.tsx:162` (manual labels, production)
- Modify: `lib/page-builder/editorConfig.tsx:378, 410, 490` (manual labels, editor)
- Test: `lib/page-builder/editorConfig.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `lib/page-builder/editorConfig.test.ts` a new `describe` (the file already imports `editorPuckConfig`, `puckConfig`, and `SECTION_PRESETS`):

```ts
describe("block label renames", () => {
  const label = (cfg: { components: Record<string, { label?: string }> }, key: string) =>
    cfg.components[key]?.label;

  it("renames the gallery/featured preset labels", () => {
    expect(SECTION_PRESETS.GalleryGridPreset.label).toBe("Gallery Grid");
    expect(SECTION_PRESETS.GalleryMasonryPreset.label).toBe("Masonry");
    expect(SECTION_PRESETS.FeaturedWorkPreset.label).toBe("Featured Work");
  });

  it("renames the manual gallery/featured labels in both configs", () => {
    for (const cfg of [editorPuckConfig, puckConfig] as const) {
      expect(label(cfg as never, "GalleryGrid")).toBe("Photo Grid");
      expect(label(cfg as never, "GalleryMasonry")).toBe("Masonry");
      expect(label(cfg as never, "FeaturedWork")).toBe("Highlights");
      expect(label(cfg as never, "GalleryCarousel")).toBe("Gallery Carousel");
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test editorConfig`
Expected: FAIL — current labels are "Gallery grid section" / "Gallery Grid" / "Gallery Masonry" / "Featured Work".

- [ ] **Step 3: Apply the renames**

In `lib/page-builder/blocks/sectionPresets.ts` (lines 173-175):

```ts
  GalleryGridPreset: { label: "Gallery Grid", defaultProps: GALLERY_GRID_PRESET },
  GalleryMasonryPreset: { label: "Masonry", defaultProps: GALLERY_MASONRY_PRESET },
  FeaturedWorkPreset: { label: "Featured Work", defaultProps: FEATURED_WORK_PRESET },
```

In `lib/page-builder/blocks/GalleryGridBlock.tsx:140` change `label: "Gallery Grid",` → `label: "Photo Grid",`
In `lib/page-builder/blocks/GalleryMasonryBlock.tsx:137` change `label: "Gallery Masonry",` → `label: "Masonry",`
In `lib/page-builder/blocks/FeaturedWorkBlock.tsx:162` change `label: "Featured Work",` → `label: "Highlights",`

In `lib/page-builder/editorConfig.tsx`:
- line 378 `label: "Gallery Grid",` → `label: "Photo Grid",`
- line 410 `label: "Gallery Masonry",` → `label: "Masonry",`
- line 490 `label: "Featured Work",` → `label: "Highlights",`
- (leave line 441 `label: "Gallery Carousel",` unchanged)

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test editorConfig sectionPresets`
Expected: PASS. The existing parity tests still pass (labels aren't part of the registration/defaultProps/field-key checks).

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/blocks/sectionPresets.ts lib/page-builder/blocks/GalleryGridBlock.tsx lib/page-builder/blocks/GalleryMasonryBlock.tsx lib/page-builder/blocks/FeaturedWorkBlock.tsx lib/page-builder/editorConfig.tsx lib/page-builder/editorConfig.test.ts
git commit -m "feat(portfolio): rename gallery/featured preset + manual block labels"
```

---

## Task 6: Move Gallery Carousel into the Preset blocks group

**Files:**
- Modify: `lib/page-builder/blockCategories.ts`
- Test (create): `lib/page-builder/blockCategories.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/page-builder/blockCategories.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { PRESET_BLOCK_KEYS, MANUAL_BLOCK_KEYS } from "./blockCategories";

describe("blockCategories", () => {
  it("groups GalleryCarousel under Preset blocks, not Manual", () => {
    expect(PRESET_BLOCK_KEYS).toContain("GalleryCarousel");
    expect(MANUAL_BLOCK_KEYS).not.toContain("GalleryCarousel");
  });

  it("keeps the manual gallery/featured primitives under Manual", () => {
    for (const key of ["GalleryGrid", "GalleryMasonry", "FeaturedWork"]) {
      expect(MANUAL_BLOCK_KEYS).toContain(key);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test blockCategories`
Expected: FAIL — `GalleryCarousel` is currently in `MANUAL_BLOCK_KEYS`.

- [ ] **Step 3: Implement**

In `lib/page-builder/blockCategories.ts`:
- Add `"GalleryCarousel",` to `PRESET_BLOCK_KEYS` immediately after `"FeaturedWorkPreset",`.
- Remove the `"GalleryCarousel",` line from `MANUAL_BLOCK_KEYS`.

Resulting arrays:

```ts
export const PRESET_BLOCK_KEYS = [
  "HeroPreset",
  "AboutPreset",
  "ServicesPreset",
  "CtaPreset",
  "ContactPreset",
  "GalleryGridPreset",
  "GalleryMasonryPreset",
  "FeaturedWorkPreset",
  "GalleryCarousel",
] as const;

export const MANUAL_BLOCK_KEYS = [
  "GalleryGrid",
  "GalleryMasonry",
  "FeaturedWork",
  "Heading",
  "Text",
  "Image",
  "Button",
  "Video",
  "Columns",
  "Container",
  "ContactDetails",
  "Spacer",
  "Divider",
] as const;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test blockCategories editorConfig`
Expected: PASS. (`editorConfig.test.ts` "registers exactly the same component types" is unaffected — only the drawer category changed, not the registered components.)

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/blockCategories.ts lib/page-builder/blockCategories.test.ts
git commit -m "feat(portfolio): move Gallery Carousel into the Preset blocks group"
```

---

## Task 7: Verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Run all touched-area tests**

Run: `pnpm test GalleryText GalleryCarouselBlock StyleToolkitField editorConfig sectionPresets blockCategories`
Expected: PASS, no failures.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (0 errors).

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: 0 errors (pre-existing `_`-prefixed unused-var warnings in unrelated files are acceptable).

- [ ] **Step 4: Production build (client-bundle hygiene)**

Run: `pnpm next build`
Expected: build succeeds — proves the carousel/GalleryText changes keep server-only code out of the client bundle (the carousel is isomorphic; `GalleryText` imports only client-safe `styleToolkit`).

- [ ] **Step 5: Full suite (pre-review sweep)**

Run: `pnpm test`
Expected: PASS (prior baseline was green; the new tests add to it).

- [ ] **Step 6: Manual editor check (note for the human)**

At 375px in the editor: select a Gallery Carousel → Design tab shows Typography (text color works), Text padding X/Y, and Heading/Description highlight toggles with color swatches; the component drawer lists "Gallery Carousel" under Preset blocks, "Photo Grid"/"Masonry"/"Highlights" under Manual, and "Gallery Grid"/"Masonry"/"Featured Work" preset sections.

---

## Self-Review (completed against the spec)

- **Spec coverage:** text color fix (Task 1+3), Text Padding (Task 3+4), highlight bands separate per text (Task 1+3+4), bold/italic/underline/align threading (Task 1+3), preset renames (Task 5), manual renames (Task 5), carousel recategorization (Task 6), verification incl. build (Task 7). All spec sections map to a task.
- **No new Puck fields / parity safety:** new style lives on `_style` (BlockStyle); `defaultProps` and field keys are unchanged → `editorConfig.test.ts` parity stays green.
- **Type consistency:** `CarouselTextControls({s, set})`, `GalleryHeader` prop names (`textColorToken`, `headingHighlight`, `headingHighlightToken`, `descriptionHighlight`, `descriptionHighlightToken`, `textPaddingX/Y` on `_style`) match across tasks 1/2/3/4.
- **No locale files:** editor chrome is English-only by design; no public-facing strings added.
