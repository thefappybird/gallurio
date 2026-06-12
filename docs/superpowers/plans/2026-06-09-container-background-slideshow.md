# Container Background Slideshow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Container block's background alternate between multiple baked images with a crossfade / Ken Burns / slide animation, so a "carousel" can live behind a section's content.

**Architecture:** Container's single `backgroundImagePublicId` becomes a multi-image `backgroundImages: GalleryImage[]` (same baked shape + `reconcileGalleryImages` pipeline as sub-project #2's gallery blocks). The isomorphic `ContainerBlock` branches on image count: 0 → no bg, 1 → today's static `<img>`, 2+ → a new `"use client"` `ContainerBackgroundSlideshow` island that animates GPU-friendly opacity/transform layers, pauses on tab-hide, and honors `prefers-reduced-motion`. Editing flows through the existing `StyleToolkitField` Content tab; `bgAnimation`/`bgSpeed` controls appear only at ≥2 images.

**Tech Stack:** Next.js 16, React 19, Puck (`@measured/puck`), TypeScript, Vitest + Testing Library, Mongoose (reconcile query), Cloudinary (client-safe URL builder).

---

## Background: key facts the executor must know

- `ContainerBlock` lives in `lib/page-builder/blocks/manualBlocks.tsx` and is **isomorphic** (no server-only imports). The SAME component renders in the editor canvas (WYSIWYG) and on the public page. All 8 preset blocks (`HeroPreset`/`AboutPreset`/`ServicesPreset`/`CtaPreset`/`ContactPreset`/`GalleryGridPreset`/`GalleryMasonryPreset`/`FeaturedWorkPreset`) ALSO render `ContainerBlock`.
- `GalleryImage = { id: string; publicId: string; alt?: string }` is exported from `lib/page-builder/blocks/GalleryGridBlock.tsx`. `MediaPickerSelection = { id: string; publicId: string }` (from `galleryPicker/MediaPicker.tsx`) is a structural subset — the picker writes `MediaPickerSelection[]`, reconcile refreshes it into full `GalleryImage[]`.
- `cloudinaryImageUrl(publicId, { width, height?, crop? })` (`lib/page-builder/cloudinaryClient.ts`) is the client-safe URL builder; returns `""` when the public cloud name or publicId is missing. In the test env `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` is unset, so it returns `""` unless `vi.stubEnv(...)` is used.
- The module-private helper `cloudinaryUrl(publicId, w=1200)` in `manualBlocks.tsx` wraps it as `cloudinaryImageUrl(publicId, { width: w, height: w*4, crop: "limit" }) || null`. The current single background uses `cloudinaryUrl(backgroundImagePublicId, 2000)`.
- **The pattern to mirror** for the island is `GalleryCarouselBlock` (isomorphic block, resolves URLs) → `GalleryCarouselClient` (`"use client"` island, receives resolved `src`, owns timers + reduced-motion via `useSyncExternalStore`). Read both before starting.
- Editing for Container/preset blocks happens in `StyleToolkitField.tsx` Content tab (`BannerSection`) + Layout tab — NOT raw Puck sidebar fields. The sidebar `editorContainerFields` are stripped by `resolveContainerFields` down to `_style` + `content`. Production `containerFields` (`manualBlocks.tsx`) exist only so the editor↔prod parity test (`editorConfig.test.ts`) sees matching field KEYS — `<Render>` ignores them.
- `reconcileGalleryImages(workspaceId, data)` (`lib/page-builder/reconcile.ts`) already walks `data.content` + every `data.zones[*]` array and is already wired into editor-load (in-memory) and `publishPortfolioAction` (persisted). Container/preset blocks already pass through it. **No publish/page wiring changes are needed** — only the reconcile walker itself must learn to refresh `backgroundImages[]`.

## File structure (what changes)

- **Create** `lib/page-builder/blocks/ContainerBackgroundSlideshow.tsx` — the `"use client"` animation island.
- **Create** `lib/page-builder/blocks/ContainerBackgroundSlideshow.test.tsx` — island unit tests.
- **Modify** `lib/page-builder/blocks/manualBlocks.tsx` — Container props/defaults/render branch + `containerFields`.
- **Modify** `lib/page-builder/blocks/manualBlocks.test.tsx` — Container render-branch tests.
- **Modify** `lib/page-builder/blocks/sectionPresets.ts` — `backgroundImagePublicId: ""` → `backgroundImages: []` for all presets.
- **Modify** `lib/page-builder/editorConfig.tsx` — `editorContainerFields` (drop bg-publicId, add `bgAnimation`/`bgSpeed`), `resolveContainerFields`, remove now-unused `imagePickerField`/`SingleImagePicker`.
- **Modify** `lib/page-builder/editorConfig.test.ts` — assert new Container field keys.
- **Modify** `lib/page-builder/StyleToolkitField.tsx` — Container Banner: `MultiImageControl` on `backgroundImages` + gated `bgAnimation`/`bgSpeed`; export a pure `ContainerBackgroundControls`.
- **Modify** `lib/page-builder/StyleToolkitField.test.tsx` — gating tests for `ContainerBackgroundControls`.
- **Modify** `lib/page-builder/reconcile.ts` — refresh `backgroundImages[]` on Container/preset blocks.
- **Modify** `lib/page-builder/reconcile.test.ts` — backgroundImages reconcile cases.
- **Modify** `docs/superpowers/specs/2026-06-08-unified-media-picker-design.md` — note container-bg removed from spec #1 scope.

> **Out of scope (do NOT fix here):** `sectionPresets.ts` still passes stale `collectionId`/`maxItems` to its nested `GalleryGrid`/`GalleryMasonry` children (a sub-project #2 leftover; harmless — the images-based blocks ignore unknown props). Leave it; flag in the final summary.

---

## Task 1: `ContainerBackgroundSlideshow` client island

**Files:**
- Create: `lib/page-builder/blocks/ContainerBackgroundSlideshow.tsx`
- Test: `lib/page-builder/blocks/ContainerBackgroundSlideshow.test.tsx`

The island receives ALREADY-RESOLVED image `src`s (the Container resolves them, exactly like `GalleryCarouselBlock` → `GalleryCarouselClient`). It owns the timer, the active-layer index, reduced-motion, and tab-visibility pause. Only `opacity`/`transform` animate (GPU-friendly).

- [ ] **Step 1: Write the failing test**

Create `lib/page-builder/blocks/ContainerBackgroundSlideshow.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { ContainerBackgroundSlideshow } from "./ContainerBackgroundSlideshow";

const IMAGES = [
  { id: "a", src: "https://x/a.jpg" },
  { id: "b", src: "https://x/b.jpg" },
  { id: "c", src: "https://x/c.jpg" },
];

function setReducedMotion(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }));
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
}

beforeEach(() => {
  setReducedMotion(false);
  setHidden(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ContainerBackgroundSlideshow", () => {
  it("renders one layer per image with the active layer marked (crossfade)", () => {
    const { container } = render(
      <ContainerBackgroundSlideshow images={IMAGES} animation="crossfade" speed="medium" />
    );
    const layers = container.querySelectorAll("[data-bg-layer]");
    expect(layers.length).toBe(3);
    expect(container.querySelectorAll('[data-active="true"]').length).toBe(1);
    expect(container.querySelector('[data-active="true"]')?.getAttribute("data-bg-layer")).toBe("0");
  });

  it("marks the root with the animation mode", () => {
    const { container } = render(
      <ContainerBackgroundSlideshow images={IMAGES} animation="slide" speed="fast" />
    );
    expect(container.querySelector("[data-bg-slideshow]")?.getAttribute("data-animation")).toBe("slide");
  });

  it("advances to the next layer after the speed interval (medium = 5s)", () => {
    vi.useFakeTimers();
    const { container } = render(
      <ContainerBackgroundSlideshow images={IMAGES} animation="crossfade" speed="medium" />
    );
    expect(container.querySelector('[data-active="true"]')?.getAttribute("data-bg-layer")).toBe("0");
    act(() => { vi.advanceTimersByTime(5000); });
    expect(container.querySelector('[data-active="true"]')?.getAttribute("data-bg-layer")).toBe("1");
  });

  it("fast speed advances at 3s", () => {
    vi.useFakeTimers();
    const { container } = render(
      <ContainerBackgroundSlideshow images={IMAGES} animation="crossfade" speed="fast" />
    );
    act(() => { vi.advanceTimersByTime(3000); });
    expect(container.querySelector('[data-active="true"]')?.getAttribute("data-bg-layer")).toBe("1");
  });

  it("under prefers-reduced-motion renders only the first image and never advances", () => {
    setReducedMotion(true);
    vi.useFakeTimers();
    const { container } = render(
      <ContainerBackgroundSlideshow images={IMAGES} animation="kenburns" speed="fast" />
    );
    expect(container.querySelectorAll("[data-bg-layer]").length).toBe(1);
    act(() => { vi.advanceTimersByTime(60000); });
    expect(container.querySelectorAll("[data-bg-layer]").length).toBe(1);
    expect(container.querySelector('[data-bg-layer]')?.getAttribute("data-active")).toBe("true");
  });

  it("pauses advancing while the tab is hidden", () => {
    vi.useFakeTimers();
    const { container } = render(
      <ContainerBackgroundSlideshow images={IMAGES} animation="crossfade" speed="fast" />
    );
    act(() => {
      setHidden(true);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    act(() => { vi.advanceTimersByTime(30000); });
    expect(container.querySelector('[data-active="true"]')?.getAttribute("data-bg-layer")).toBe("0");
  });

  it("is decorative: root is aria-hidden and every image has empty alt", () => {
    const { container } = render(
      <ContainerBackgroundSlideshow images={IMAGES} animation="crossfade" speed="slow" />
    );
    expect(container.querySelector("[data-bg-slideshow]")?.getAttribute("aria-hidden")).toBe("true");
    container.querySelectorAll("img").forEach((img) => expect(img.getAttribute("alt")).toBe(""));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run ContainerBackgroundSlideshow`
Expected: FAIL — `Failed to resolve import "./ContainerBackgroundSlideshow"`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/page-builder/blocks/ContainerBackgroundSlideshow.tsx`:

```tsx
"use client";

/**
 * ContainerBackgroundSlideshow — client island that animates a Container's
 * baked background images. Receives ALREADY-RESOLVED src URLs from the
 * isomorphic ContainerBlock (same split as GalleryCarouselBlock →
 * GalleryCarouselClient): the block owns Cloudinary URL building, this island
 * owns the timer, active-layer index, tab-visibility pause, and reduced-motion.
 *
 * GPU-friendly: only `opacity`/`transform` animate. Decorative: the whole layer
 * is aria-hidden and every <img> carries alt="" (it is a background, never a
 * foreground carousel — no interactive controls).
 */

import { useEffect, useState, useSyncExternalStore } from "react";

export type SlideshowImage = { id: string; src: string };
export type BgAnimation = "crossfade" | "kenburns" | "slide";
export type BgSpeed = "slow" | "medium" | "fast";

const SPEED_MS: Record<BgSpeed, number> = { slow: 7000, medium: 5000, fast: 3000 };

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(callback: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}
function getReducedMotionSnapshot() {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

const LAYER_BASE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

export function ContainerBackgroundSlideshow({
  images,
  animation,
  speed,
}: {
  images: SlideshowImage[];
  animation: BgAnimation;
  speed: BgSpeed;
}) {
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false
  );
  const [active, setActive] = useState(0);
  const [hidden, setHidden] = useState(false);

  // Pause off-screen (Page Visibility) — no animation churn on a hidden tab.
  useEffect(() => {
    function onVis() {
      setHidden(document.hidden);
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (reducedMotion || hidden || images.length < 2) return;
    const interval = SPEED_MS[speed] ?? SPEED_MS.medium;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % images.length);
    }, interval);
    return () => window.clearInterval(id);
  }, [reducedMotion, hidden, images.length, speed]);

  // Reduced motion → a single static first frame, no layering, no timer.
  if (reducedMotion) {
    const first = images[0];
    return (
      <div data-bg-slideshow data-animation={animation} aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        {first && (
          // eslint-disable-next-line @next/next/no-img-element
          <img data-bg-layer="0" data-active="true" src={first.src} alt="" style={LAYER_BASE} />
        )}
      </div>
    );
  }

  const showIndex = active % images.length;

  return (
    <div
      data-bg-slideshow
      data-animation={animation}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, overflow: "hidden" }}
    >
      {animation === "kenburns" && (
        <style>{`
          @keyframes pf-bg-kenburns {
            from { transform: scale(1); }
            to   { transform: scale(1.08); }
          }
        `}</style>
      )}
      {images.map((img, i) => {
        const isActive = i === showIndex;
        const style: React.CSSProperties = { ...LAYER_BASE };
        if (animation === "slide") {
          style.transform = `translateX(${(i - showIndex) * 100}%)`;
          style.transition = "transform 800ms ease-in-out";
        } else {
          style.opacity = isActive ? 1 : 0;
          style.transition = "opacity 1000ms ease-in-out";
          if (animation === "kenburns") {
            // Subtle continuous zoom; alternate so it never hard-resets.
            style.animation = "pf-bg-kenburns 8s ease-in-out infinite alternate";
          }
        }
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={img.id}
            data-bg-layer={i}
            data-active={isActive}
            src={img.src}
            alt=""
            loading={isActive ? undefined : "lazy"}
            decoding="async"
            style={style}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run ContainerBackgroundSlideshow`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/page-builder/blocks/ContainerBackgroundSlideshow.tsx lib/page-builder/blocks/ContainerBackgroundSlideshow.test.tsx
git commit -m "feat(portfolio): container background slideshow island"
```

---

## Task 2: Container data-model + render branch

**Files:**
- Modify: `lib/page-builder/blocks/manualBlocks.tsx` (Container types/defaults/render + `containerFields`)
- Test: `lib/page-builder/blocks/manualBlocks.test.tsx`

Replace the single `backgroundImagePublicId` with `backgroundImages: GalleryImage[]`, add `bgAnimation`/`bgSpeed`, and branch the render: 0 → no bg, 1 → static `<img>` (unchanged), 2+ → `<ContainerBackgroundSlideshow>`.

- [ ] **Step 1: Write the failing tests**

Append to `lib/page-builder/blocks/manualBlocks.test.tsx` (after the existing `ContainerBlock flex defaults` describe). Note: the test env has no cloud name, so we stub it to make `cloudinaryUrl` produce a URL.

```tsx
// ---------------------------------------------------------------------------
// ContainerBlock — background slideshow branch
// ---------------------------------------------------------------------------

describe("ContainerBlock background images", () => {
  const Slot: SlotComponent = (props) => <div data-testid="slot-inner" style={props?.style} />;

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME", "demo");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders no background layer when backgroundImages is empty", () => {
    const { container } = render(<ContainerBlock content={Slot} backgroundImages={[]} />);
    expect(container.querySelector("[data-bg-slideshow]")).toBeNull();
    // No absolutely-positioned background <img> either.
    expect(container.querySelector('section > img')).toBeNull();
  });

  it("renders a single static <img> (no slideshow island) for exactly one image", () => {
    const { container } = render(
      <ContainerBlock content={Slot} backgroundImages={[{ id: "a", publicId: "ws/a" }]} />
    );
    expect(container.querySelector("[data-bg-slideshow]")).toBeNull();
    const img = container.querySelector("section > img") as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.getAttribute("aria-hidden")).toBe("true");
    expect(img!.src).toContain("ws/a");
  });

  it("renders the slideshow island for two or more images", () => {
    const { container } = render(
      <ContainerBlock
        content={Slot}
        backgroundImages={[{ id: "a", publicId: "ws/a" }, { id: "b", publicId: "ws/b" }]}
        bgAnimation="slide"
        bgSpeed="fast"
      />
    );
    const island = container.querySelector("[data-bg-slideshow]");
    expect(island).not.toBeNull();
    expect(island?.getAttribute("data-animation")).toBe("slide");
    expect(container.querySelectorAll("[data-bg-layer]").length).toBe(2);
  });

  it("layers the dark scrim above the slideshow when overlayOpacity > 0", () => {
    const { container } = render(
      <ContainerBlock
        content={Slot}
        backgroundImages={[{ id: "a", publicId: "ws/a" }, { id: "b", publicId: "ws/b" }]}
        overlayOpacity={50}
      />
    );
    const scrim = container.querySelector('section > div[aria-hidden="true"]') as HTMLElement | null;
    expect(scrim).not.toBeNull();
    expect(scrim!.style.backgroundColor).toBe("rgba(0, 0, 0, 0.5)");
  });

  it("keeps the content slot rendered above the background (z-index 1)", () => {
    render(
      <ContainerBlock
        content={Slot}
        backgroundImages={[{ id: "a", publicId: "ws/a" }, { id: "b", publicId: "ws/b" }]}
      />
    );
    const inner = screen.getByTestId("slot-inner");
    expect(inner.style.zIndex).toBe("1");
  });
});
```

Add `beforeEach`, `afterEach`, and `vi` to the existing top import: change line 1 to
`import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";`

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run manualBlocks`
Expected: FAIL — `ContainerBlock` does not accept `backgroundImages` / renders nothing for the new branch.

- [ ] **Step 3: Write the implementation**

In `lib/page-builder/blocks/manualBlocks.tsx`:

(a) Add the import near the other block imports (after the `cloudinaryImageUrl` import, line 27):

```tsx
import { ContainerBackgroundSlideshow } from "./ContainerBackgroundSlideshow";
import type { GalleryImage } from "./GalleryGridBlock";
```

(b) Replace the `ContainerBlockProps` type (lines 499-508) with:

```tsx
export type ContainerBlockProps = {
  _style?: BlockStyle;
  /** Baked background images (reconciled like gallery blocks). 0 → none, 1 → static, 2+ → slideshow. */
  backgroundImages: GalleryImage[];
  bgAnimation?: "crossfade" | "kenburns" | "slide";
  bgSpeed?: "slow" | "medium" | "fast";
  /** Dark scrim over the background, 0-100. Only meaningful with >=1 image. */
  overlayOpacity?: number;
  minHeight?: ContainerHeight;
  alignX?: ContainerAlignX;
  alignY?: ContainerAlignY;
  content: Slot;
};
```

(c) Replace `containerDefaultProps` (lines 510-523) — swap the bg key:

```tsx
export const containerDefaultProps: ContainerBlockProps = {
  backgroundImages: [],
  overlayOpacity: 0,
  minHeight: "auto",
  alignX: "left",
  alignY: "top",
  content: [],
  _style: {
    paddingTop: "1.5rem",
    paddingRight: "1.5rem",
    paddingBottom: "1.5rem",
    paddingLeft: "1.5rem",
  },
};
```

(d) Replace the `ContainerBlock` function (lines 539-635). Change the destructured props + signature, replace the `bgSrc` computation with a count-based branch, and render the right background layer:

```tsx
export function ContainerBlock({
  _style,
  backgroundImages,
  bgAnimation,
  bgSpeed,
  overlayOpacity,
  minHeight,
  alignX,
  alignY,
  content: Content,
}: {
  _style?: BlockStyle;
  backgroundImages: GalleryImage[];
  bgAnimation?: "crossfade" | "kenburns" | "slide";
  bgSpeed?: "slow" | "medium" | "fast";
  overlayOpacity?: number;
  minHeight?: ContainerHeight;
  alignX?: ContainerAlignX;
  alignY?: ContainerAlignY;
  content: SlotComponent;
}) {
  const ax = alignX ?? "left";
  const ay = alignY ?? "top";
  const s = _style ?? {};

  // Resolve baked background images → cover-layer URLs (same transform as the
  // legacy single background). Drop any that don't resolve (blank publicId / no
  // cloud name) so a 3-image set with one bad id still animates the good two.
  const layers = (Array.isArray(backgroundImages) ? backgroundImages : [])
    .map((img) => ({ id: img.id, src: cloudinaryUrl(img.publicId, 2000) }))
    .filter((l): l is { id: string; src: string } => Boolean(l.src));
  const hasBg = layers.length > 0;
  const overlayAlpha = Math.min(100, Math.max(0, overlayOpacity ?? 0)) / 100;

  // Vertical positioning of the content block within the section height.
  const effectiveJustify = s.justifyContent
    ? FLEX_JUSTIFY_MAP[s.justifyContent as keyof typeof FLEX_JUSTIFY_MAP] ?? ALIGN_Y_MAP[ay]
    : ALIGN_Y_MAP[ay];

  // Horizontal TEXT alignment inside child blocks. Children always stretch to full
  // width so that text-align, button justify, etc. have the full container width to
  // work within. _style.align (typography toolbar) takes highest priority, then
  // _style.alignItems maps to text-align semantics (start->left, end->right).
  const effectiveTextAlign = s.align
    ? s.align
    : s.alignItems
    ? (ALIGN_TO_TEXT[s.alignItems] ?? ax)
    : ax;

  const effectiveGap =
    s.gap != null ? `${Math.min(96, Math.max(0, s.gap))}px` : "1rem";

  // Remove `gap` from the resolved style: it belongs on the inner content wrapper
  // (via effectiveGap), not on the outer section whose only flex children are the
  // background layer, the overlay div, and the slot.
  const sectionStyle = resolveBlockStyle(_style);
  delete (sectionStyle as Record<string, unknown>).gap;

  return (
    <section
      data-block="container"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        justifyContent: effectiveJustify,
        minHeight: CONTAINER_MIN_HEIGHT[minHeight ?? "auto"],
        padding: "1.5rem",
        overflow: "hidden",
        backgroundColor: hasBg ? "var(--pf-color-fg)" : undefined,
        ...sectionStyle,
      }}
      {...resolveBlockAttrs(_style)}
    >
      {layers.length === 1 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={layers[0].src}
          alt=""
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
      {layers.length >= 2 && (
        <ContainerBackgroundSlideshow
          images={layers}
          animation={bgAnimation ?? "crossfade"}
          speed={bgSpeed ?? "medium"}
        />
      )}
      {hasBg && overlayAlpha > 0 && (
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, backgroundColor: `rgba(0,0,0,${overlayAlpha})` }} />
      )}
      {Content({
        style: {
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: "80rem",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          textAlign: effectiveTextAlign as React.CSSProperties["textAlign"],
          gap: effectiveGap,
        },
      })}
    </section>
  );
}
```

(e) Replace `containerFields` (lines 637-670). Drop `backgroundImagePublicId`, add `bgAnimation`/`bgSpeed` selects, omit `backgroundImages` (driven by StyleToolkitField — mirrors how gallery blocks omit `images`), and cast:

```tsx
export const containerFields = {
  _style: productionStyleField,
  bgAnimation: {
    type: "select",
    label: "Background animation",
    options: [
      { label: "Crossfade", value: "crossfade" },
      { label: "Ken Burns", value: "kenburns" },
      { label: "Slide", value: "slide" },
    ],
  } as Field<ContainerBlockProps["bgAnimation"]>,
  bgSpeed: {
    type: "select",
    label: "Animation speed",
    options: [
      { label: "Slow (7s)", value: "slow" },
      { label: "Medium (5s)", value: "medium" },
      { label: "Fast (3s)", value: "fast" },
    ],
  } as Field<ContainerBlockProps["bgSpeed"]>,
  overlayOpacity: { type: "number", label: "Overlay opacity (0-100)", min: 0, max: 100 } as Field<number | undefined>,
  minHeight: {
    type: "select",
    label: "Min height",
    options: [
      { label: "Auto", value: "auto" },
      { label: "Short (40vh)", value: "short" },
      { label: "Medium (60vh)", value: "medium" },
      { label: "Tall (80vh)", value: "tall" },
    ],
  } as Field<ContainerHeight | undefined>,
  alignX: {
    type: "select",
    label: "Horizontal align",
    options: [
      { label: "Left", value: "left" },
      { label: "Center", value: "center" },
      { label: "Right", value: "right" },
    ],
  } as Field<ContainerAlignX | undefined>,
  alignY: {
    type: "select",
    label: "Vertical align",
    options: [
      { label: "Top", value: "top" },
      { label: "Center", value: "center" },
      { label: "Bottom", value: "bottom" },
    ],
  } as Field<ContainerAlignY | undefined>,
  content: { type: "slot" },
} as unknown as ComponentConfig<ContainerBlockProps>["fields"];
```

> Note: `ComponentConfig` and `Field` are already imported at the top of `manualBlocks.tsx`. `Slot` is too.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test --run manualBlocks`
Expected: PASS (all existing ContainerBlock tests + the 5 new background tests). The pre-existing flex/align tests still pass because the inner-wrapper logic is unchanged.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: no errors. (If `cloudinaryUrl`'s old single-bg caller in `ImageBlock`/`BannerSection` is untouched, only the Container changed.)

- [ ] **Step 6: Commit**

```bash
git add lib/page-builder/blocks/manualBlocks.tsx lib/page-builder/blocks/manualBlocks.test.tsx
git commit -m "feat(portfolio): container backgroundImages render branch (static/slideshow)"
```

---

## Task 3: Migrate SECTION_PRESETS to `backgroundImages`

**Files:**
- Modify: `lib/page-builder/blocks/sectionPresets.ts`
- Test: `lib/page-builder/blocks/sectionPresets.test.tsx`

Every preset currently sets `backgroundImagePublicId: ""`. Replace each with `backgroundImages: []` (1-element max in future; all current presets ship 0). This keeps current visuals identical (no preset shipped a background image).

- [ ] **Step 1: Write the failing test**

Append to `lib/page-builder/blocks/sectionPresets.test.tsx`:

```tsx
import { SECTION_PRESETS } from "./sectionPresets";

describe("section preset background shape", () => {
  it("every preset uses backgroundImages: [] (not the legacy backgroundImagePublicId)", () => {
    for (const [key, preset] of Object.entries(SECTION_PRESETS)) {
      const props = preset.defaultProps as Record<string, unknown>;
      expect(props, `${key} should expose backgroundImages`).toHaveProperty("backgroundImages");
      expect(Array.isArray(props.backgroundImages), `${key}.backgroundImages is an array`).toBe(true);
      expect(props, `${key} should drop backgroundImagePublicId`).not.toHaveProperty("backgroundImagePublicId");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run sectionPresets`
Expected: FAIL — presets still have `backgroundImagePublicId`.

- [ ] **Step 3: Edit the presets**

In `lib/page-builder/blocks/sectionPresets.ts`, replace every occurrence of the line
`  backgroundImagePublicId: "",`
with
`  backgroundImages: [],`

There are 8 occurrences (HERO_PRESET, ABOUT_PRESET, CTA_PRESET, SERVICES_PRESET, CONTACT_PRESET, GALLERY_GRID_PRESET, GALLERY_MASONRY_PRESET, FEATURED_WORK_PRESET). Use a global replace; confirm 8 replacements. Do NOT touch the nested `child("Container", {...})` calls inside SERVICES_PRESET (they never set a background — `backgroundImages` defaults via `containerDefaultProps`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test --run sectionPresets`
Expected: PASS (existing render/compose tests + the new shape test).

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: no errors (`ContainerBlockProps.backgroundImages` is now satisfied; the old `backgroundImagePublicId` no longer exists on the type).

- [ ] **Step 6: Commit**

```bash
git add lib/page-builder/blocks/sectionPresets.ts lib/page-builder/blocks/sectionPresets.test.tsx
git commit -m "feat(portfolio): migrate section presets to backgroundImages"
```

---

## Task 4: editor config — container fields + parity

**Files:**
- Modify: `lib/page-builder/editorConfig.tsx`
- Test: `lib/page-builder/editorConfig.test.ts`

`editorContainerFields` must have the SAME keys as production `containerFields` (the parity test enforces it). Drop `backgroundImagePublicId`, add `bgAnimation`/`bgSpeed`, and strip them in `resolveContainerFields` (editing happens in StyleToolkitField).

- [ ] **Step 1: Write the failing test**

Append to `lib/page-builder/editorConfig.test.ts` (inside the top-level `describe`, after the existing `it(...)` blocks):

```ts
  it("Container exposes bgAnimation + bgSpeed and drops the legacy bg-publicId field", () => {
    const editorFields = Object.keys(editorPuckConfig.components.Container.fields ?? {});
    const prodFields = Object.keys(puckConfig.components.Container.fields ?? {});
    expect(editorFields).toContain("bgAnimation");
    expect(editorFields).toContain("bgSpeed");
    expect(editorFields).not.toContain("backgroundImagePublicId");
    expect(prodFields).toContain("bgAnimation");
    expect(prodFields).toContain("bgSpeed");
    expect(prodFields).not.toContain("backgroundImagePublicId");
  });

  it("Hero preset inherits the container background animation fields", () => {
    const heroFields = Object.keys(editorPuckConfig.components.HeroPreset.fields ?? {});
    expect(heroFields).toEqual(expect.arrayContaining(["bgAnimation", "bgSpeed"]));
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run editorConfig.test`
Expected: FAIL — editor `Container` still has `backgroundImagePublicId`, no `bgAnimation`/`bgSpeed`. The parity test `Container: editor field keys match` will also fail once Task 2 changed production keys (this confirms the dependency).

- [ ] **Step 3: Edit `editorConfig.tsx`**

(a) Replace `editorContainerFields` (lines 246-281) with the new field set (same KEYS as production `containerFields`; the visual editing is in StyleToolkitField, so most are `visible: false`):

```tsx
const editorContainerFields = {
  _style: styleField,
  bgAnimation: {
    type: "select",
    label: "Background animation",
    visible: false,
    options: [
      { label: "Crossfade", value: "crossfade" },
      { label: "Ken Burns", value: "kenburns" },
      { label: "Slide", value: "slide" },
    ],
  } as unknown as Field<ContainerBlockProps["bgAnimation"]>,
  bgSpeed: {
    type: "select",
    label: "Animation speed",
    visible: false,
    options: [
      { label: "Slow (7s)", value: "slow" },
      { label: "Medium (5s)", value: "medium" },
      { label: "Fast (3s)", value: "fast" },
    ],
  } as unknown as Field<ContainerBlockProps["bgSpeed"]>,
  overlayOpacity: { type: "number", label: "Overlay opacity (0-100)", min: 0, max: 100, visible: false } as unknown as Field<number | undefined>,
  minHeight: {
    type: "select",
    label: "Min height",
    options: [
      { label: "Auto", value: "auto" },
      { label: "Short (40vh)", value: "short" },
      { label: "Medium (60vh)", value: "medium" },
      { label: "Tall (80vh)", value: "tall" },
    ],
  } as unknown as Field<ContainerHeight | undefined>,
  alignX: {
    type: "select",
    label: "Horizontal align",
    visible: false,
    options: [
      { label: "Left", value: "left" },
      { label: "Center", value: "center" },
      { label: "Right", value: "right" },
    ],
  } as unknown as Field<ContainerAlignX | undefined>,
  alignY: {
    type: "select",
    label: "Vertical align",
    visible: false,
    options: [
      { label: "Top", value: "top" },
      { label: "Center", value: "center" },
      { label: "Bottom", value: "bottom" },
    ],
  } as unknown as Field<ContainerAlignY | undefined>,
  content: { type: "slot" },
} as unknown as ComponentConfig<ContainerBlockProps>["fields"];
```

(b) Replace `resolveContainerFields` (lines 291-294) — strip the new bg keys, drop the gone `backgroundImagePublicId`:

```tsx
function resolveContainerFields(_data: unknown, { fields }: { fields: Record<string, unknown> }) {
  const { bgAnimation: _ba, bgSpeed: _bs, overlayOpacity: _o, alignX: _ax, alignY: _ay, minHeight: _mh, ...rest } = fields;
  return rest;
}
```

(c) Remove the now-unused `imagePickerField` helper (lines 202-210) and its only remaining consumer (it was only used by the old `backgroundImagePublicId` editor field). Then remove the now-unused `SingleImagePicker` import (line 30) **only if** no other usage remains in this file (grep the file for `SingleImagePicker` — it is also used inside `StyleToolkitField`, but that's a different module; within `editorConfig.tsx` the only use is `imagePickerField`). If `imagePickerField` had no other callers, both the function and the import are dead — delete them to keep lint clean.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test --run editorConfig.test`
Expected: PASS — parity (`Container` + all 8 presets) holds, and the two new assertions pass.

- [ ] **Step 5: Lint + typecheck**

Run: `pnpm lint`
Expected: no new errors (no unused `imagePickerField`/`SingleImagePicker`).
Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/page-builder/editorConfig.tsx lib/page-builder/editorConfig.test.ts
git commit -m "feat(portfolio): editor container fields for background animation"
```

---

## Task 5: StyleToolkitField — Container background controls

**Files:**
- Modify: `lib/page-builder/StyleToolkitField.tsx`
- Test: `lib/page-builder/StyleToolkitField.test.tsx`

The Container Content tab's Banner currently shows a single `SingleImagePicker` (bound to `backgroundImagePublicId`). Replace it — for containers — with a `MultiImageControl` bound to `backgroundImages`, plus `bgAnimation`/`bgSpeed` selects that appear ONLY at ≥2 images. Extract a pure, exported `ContainerBackgroundControls` so the gating is unit-testable without a Puck provider.

- [ ] **Step 1: Write the failing test**

Append to `lib/page-builder/StyleToolkitField.test.tsx`:

```tsx
import { ContainerBackgroundControls } from "./StyleToolkitField";

describe("ContainerBackgroundControls — animation gating", () => {
  const noop = () => {};

  it("hides animation + speed selects with fewer than 2 images", () => {
    render(
      <ContainerBackgroundControls
        images={[{ id: "a", publicId: "p" }]}
        onImagesChange={noop}
        animation="crossfade"
        speed="medium"
        onAnimationChange={noop}
        onSpeedChange={noop}
      />
    );
    expect(screen.getByText("Background images")).toBeTruthy();
    expect(screen.queryByLabelText("Background animation")).toBeNull();
    expect(screen.queryByLabelText("Animation speed")).toBeNull();
  });

  it("shows animation + speed selects at 2 or more images", () => {
    render(
      <ContainerBackgroundControls
        images={[{ id: "a", publicId: "p" }, { id: "b", publicId: "q" }]}
        onImagesChange={noop}
        animation="crossfade"
        speed="medium"
        onAnimationChange={noop}
        onSpeedChange={noop}
      />
    );
    expect(screen.getByLabelText("Background animation")).toBeTruthy();
    expect(screen.getByLabelText("Animation speed")).toBeTruthy();
  });

  it("fires onAnimationChange when the animation select changes", () => {
    const onAnimationChange = vi.fn();
    render(
      <ContainerBackgroundControls
        images={[{ id: "a", publicId: "p" }, { id: "b", publicId: "q" }]}
        onImagesChange={noop}
        animation="crossfade"
        speed="medium"
        onAnimationChange={onAnimationChange}
        onSpeedChange={noop}
      />
    );
    fireEvent.change(screen.getByLabelText("Background animation"), { target: { value: "slide" } });
    expect(onAnimationChange).toHaveBeenCalledWith("slide");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run StyleToolkitField`
Expected: FAIL — `ContainerBackgroundControls` is not exported.

- [ ] **Step 3: Edit `StyleToolkitField.tsx`**

(a) Add the exported control component (place it just above `BannerSection`, near line 242). It uses the already-imported `MultiImageControl` + `MediaPickerSelection`:

```tsx
const BG_ANIMATION_OPTIONS = [
  { value: "crossfade", label: "Crossfade" },
  { value: "kenburns", label: "Ken Burns" },
  { value: "slide", label: "Slide" },
] as const;

const BG_SPEED_OPTIONS = [
  { value: "slow", label: "Slow (7s)" },
  { value: "medium", label: "Medium (5s)" },
  { value: "fast", label: "Fast (3s)" },
] as const;

export function ContainerBackgroundControls({
  images,
  onImagesChange,
  animation,
  speed,
  onAnimationChange,
  onSpeedChange,
}: {
  images: MediaPickerSelection[];
  onImagesChange: (v: MediaPickerSelection[]) => void;
  animation: string;
  speed: string;
  onAnimationChange: (v: string) => void;
  onSpeedChange: (v: string) => void;
}) {
  const showAnimation = images.length >= 2;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Background images</span>
        <MultiImageControl value={images} onChange={onImagesChange} max={12} />
      </div>
      {showAnimation && (
        <>
          <label className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">Background animation</span>
            <select
              aria-label="Background animation"
              value={animation}
              onChange={(e) => onAnimationChange(e.target.value)}
              className="h-7 flex-1 cursor-pointer border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {BG_ANIMATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">Animation speed</span>
            <select
              aria-label="Animation speed"
              value={speed}
              onChange={(e) => onSpeedChange(e.target.value)}
              className="h-7 flex-1 cursor-pointer border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {BG_SPEED_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </>
      )}
    </div>
  );
}
```

(b) Rework `BannerSection` (lines 242-275) to branch on a `container` prop. Keep the color swatch always; for containers show `ContainerBackgroundControls`, otherwise keep the legacy single image picker (used by the standalone test path):

```tsx
type ContainerBgControls = {
  images: MediaPickerSelection[];
  onImagesChange: (v: MediaPickerSelection[]) => void;
  animation: string;
  speed: string;
  onAnimationChange: (v: string) => void;
  onSpeedChange: (v: string) => void;
};

function BannerSection({
  s,
  set,
  container,
}: {
  s: BlockStyle;
  set: (p: Partial<BlockStyle>) => void;
  container?: ContainerBgControls | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Banner
      </span>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Color</span>
        <ColorSwatchRow value={s.bgColorToken} onChange={(t) => set({ bgColorToken: t })} />
      </div>
      {container ? (
        <ContainerBackgroundControls {...container} />
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Image</span>
          <SingleImagePicker
            value={s.bgImagePublicId ?? ""}
            onChange={(pid) => set({ bgImagePublicId: pid || undefined })}
          />
        </div>
      )}
    </div>
  );
}
```

(c) Update `ContentTabBody` (lines 423-454) to build the `container` controls from the selected block's props when it's a container, and pass them to `BannerSection`:

```tsx
function ContentTabBody({
  s,
  set,
  type,
  p,
  setProp,
  showBanner,
  isContainer,
}: {
  s: BlockStyle;
  set: (patch: Partial<BlockStyle>) => void;
  type: string;
  p: Record<string, unknown> | undefined;
  setProp: (key: string, val: unknown) => void;
  showBanner: boolean;
  isContainer: boolean;
}) {
  const container: ContainerBgControls | null =
    isContainer && p
      ? {
          images: (p.backgroundImages as MediaPickerSelection[]) ?? [],
          onImagesChange: (v) => setProp("backgroundImages", v),
          animation: (p.bgAnimation as string) ?? "crossfade",
          speed: (p.bgSpeed as string) ?? "medium",
          onAnimationChange: (v) => setProp("bgAnimation", v),
          onSpeedChange: (v) => setProp("bgSpeed", v),
        }
      : null;
  return (
    <div className="flex flex-col gap-4 p-3">
      {showBanner && <BannerSection s={s} set={set} container={container} />}
      {!isContainer && p && <ContentInputs type={type} props={p} setProp={setProp} />}
    </div>
  );
}
```

> The standalone (no-Puck) render path passes `isContainer={false}` and `p={undefined}`, so `container` is `null` and the legacy single Image picker still renders — the existing "Content tab shows Banner section ... Image" test stays green.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test --run StyleToolkitField`
Expected: PASS — existing 18 tests + 3 new gating tests.

- [ ] **Step 5: Lint + typecheck**

Run: `pnpm lint`
Expected: no errors. (`SingleImagePicker` is still imported and used by the legacy branch.)
Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/page-builder/StyleToolkitField.tsx lib/page-builder/StyleToolkitField.test.tsx
git commit -m "feat(portfolio): container background image + animation controls in toolkit"
```

---

## Task 6: Reconcile `backgroundImages`

**Files:**
- Modify: `lib/page-builder/reconcile.ts`
- Test: `lib/page-builder/reconcile.test.ts`

Extend the existing walker so Container + preset blocks' `backgroundImages[]` is refreshed/pruned exactly like gallery blocks' `images[]` — same single tenant-scoped `$in` query, same order/prune/never-add rules. No new query; ids from both prop keys are collected together.

- [ ] **Step 1: Write the failing tests**

Append to `lib/page-builder/reconcile.test.ts` (inside the `describe("reconcileGalleryImages", ...)` block):

```ts
  function containerBlock(
    type: string,
    backgroundImages: Array<{ id: string; publicId: string; alt?: string }>
  ): { type: string; props: Record<string, unknown> } {
    return { type, props: { id: "c1", backgroundImages, overlayOpacity: 0, content: [] } };
  }

  it("refreshes a Container's backgroundImages like a gallery block", async () => {
    const ws = new Types.ObjectId();
    const it = await makeItem(ws, 5);
    const data: PuckData = {
      root: {},
      content: [containerBlock("Container", [{ id: String(it._id), publicId: "STALE", alt: "stale" }])],
    };
    const out = await reconcileGalleryImages(ws.toString(), data);
    expect(out.content[0].props.backgroundImages).toEqual([
      { id: String(it._id), publicId: `ws/${ws}/item5`, alt: "Alt 5" },
    ]);
  });

  it("prunes a foreign-workspace background image (tenant isolation)", async () => {
    const wsA = new Types.ObjectId();
    const wsB = new Types.ObjectId();
    const foreign = await makeItem(wsB, 0);
    const mine = await makeItem(wsA, 1);
    const data: PuckData = {
      root: {},
      content: [containerBlock("HeroPreset", [
        { id: String(foreign._id), publicId: "x" },
        { id: String(mine._id), publicId: "x" },
      ])],
    };
    const out = await reconcileGalleryImages(wsA.toString(), data);
    const ids = (out.content[0].props.backgroundImages as Array<{ id: string }>).map((i) => i.id);
    expect(ids).toEqual([String(mine._id)]);
  });

  it("collects gallery images AND container backgrounds in a SINGLE query", async () => {
    const ws = new Types.ObjectId();
    const a = await makeItem(ws, 0);
    const b = await makeItem(ws, 1);
    const findSpy = vi.spyOn(GalleryItem, "find");
    const data: PuckData = {
      root: {},
      content: [
        gridBlock([{ id: String(a._id), publicId: "x" }]),
        containerBlock("Container", [{ id: String(b._id), publicId: "x" }]),
      ],
    };
    const out = await reconcileGalleryImages(ws.toString(), data);
    expect(findSpy).toHaveBeenCalledTimes(1);
    expect((out.content[0].props.images as unknown[]).length).toBe(1);
    expect((out.content[1].props.backgroundImages as unknown[]).length).toBe(1);
    findSpy.mockRestore();
  });

  it("is still a no-op (no query) for a Container with an empty backgroundImages", async () => {
    const ws = new Types.ObjectId();
    const findSpy = vi.spyOn(GalleryItem, "find");
    const data: PuckData = { root: {}, content: [containerBlock("Container", [])] };
    const out = await reconcileGalleryImages(ws.toString(), data);
    expect(findSpy).not.toHaveBeenCalled();
    expect(out.content[0].props.backgroundImages).toEqual([]);
    findSpy.mockRestore();
  });
```

> Note: `gridBlock` and `makeItem` already exist in this test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run reconcile`
Expected: FAIL — `backgroundImages` is returned unchanged (the walker doesn't touch it yet); the "single query" test finds 0 calls because the container has no `images` key and the gallery grid alone fires one — actually the refresh assertions fail first.

- [ ] **Step 3: Edit `reconcile.ts`**

Generalize the walker to handle BOTH `images` (gallery) and `backgroundImages` (container/preset) prop keys. Replace the relevant sections:

(a) After `GALLERY_BLOCK_TYPES` (line 9), add the container/preset set + a key resolver:

```ts
/** Block types whose `backgroundImages[]` cache is reconciled (Container + presets). */
const BG_BLOCK_TYPES = new Set([
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

/** Which prop keys on a block hold a baked GalleryImage[] to reconcile. */
function imageKeysOf(type: string): string[] {
  const keys: string[] = [];
  if (GALLERY_BLOCK_TYPES.has(type)) keys.push("images");
  if (BG_BLOCK_TYPES.has(type)) keys.push("backgroundImages");
  return keys;
}
```

(b) Replace `storedImagesOf` (lines 26-29) with a key-parameterized reader:

```ts
function storedImagesAt(block: PuckBlockEntry, key: string): StoredImage[] {
  const imgs = block.props?.[key];
  return Array.isArray(imgs) ? (imgs as StoredImage[]) : [];
}
```

(c) Replace the collection loop + `hasGalleryBlock` guard (lines 54-66) with one that walks every image key:

```ts
  // 1. Collect every reconciled image id across all blocks + zones (images + backgroundImages).
  const allIds = new Set<string>();
  let hasImageBlock = false;
  for (const arr of arrays) {
    for (const block of arr) {
      const keys = imageKeysOf(block.type);
      if (keys.length === 0) continue;
      hasImageBlock = true;
      for (const key of keys) {
        for (const img of storedImagesAt(block, key)) {
          if (validId(img.id)) allIds.add(img.id);
        }
      }
    }
  }
  if (!hasImageBlock) return data;
```

(d) Replace `rebuildBlock` (lines 84-94) to rebuild every image key the block has:

```ts
  // 3. Rebuild each block's image arrays, preserving order, pruning misses.
  const rebuildBlock = (block: PuckBlockEntry): PuckBlockEntry => {
    const keys = imageKeysOf(block.type);
    if (keys.length === 0) return block;
    const nextProps = { ...block.props } as Record<string, unknown>;
    for (const key of keys) {
      const next: Array<{ id: string; publicId: string; alt: string }> = [];
      for (const img of storedImagesAt(block, key)) {
        if (!validId(img.id)) continue;
        const live = map.get(img.id);
        if (!live) continue; // pruned (missing or foreign workspace)
        next.push({ id: img.id, publicId: live.publicId, alt: live.alt });
      }
      nextProps[key] = next;
    }
    return { ...block, props: nextProps };
  };
```

(e) Update the top-of-file doc comment: rename references from "every gallery block" to "every gallery block (`images`) and Container/preset block (`backgroundImages`)" so the comment stays accurate. Keep the function name `reconcileGalleryImages` (callers + wiring depend on it).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test --run reconcile`
Expected: PASS — all original 7 tests (unchanged behavior for gallery blocks) + 4 new backgroundImages tests.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/page-builder/reconcile.ts lib/page-builder/reconcile.test.ts
git commit -m "feat(portfolio): reconcile container backgroundImages alongside gallery images"
```

---

## Task 7: Amend spec #1 (drop container-bg from its scope)

**Files:**
- Modify: `docs/superpowers/specs/2026-06-08-unified-media-picker-design.md`

The container background is now a multi-image field owned by THIS spec. Record the amendment so spec #1 isn't read as still owning it.

- [ ] **Step 1: Add the amendment note**

Open `docs/superpowers/specs/2026-06-08-unified-media-picker-design.md`. Find the section that lists the single-image call sites re-pointed to `imageField` (it mentions the container background). Add a short note inline (do not delete history):

```markdown
> **Amended 2026-06-09 (spec #3):** The container background is NO LONGER a
> single-image consumer of this spec. Spec #3 (container-background-slideshow)
> makes it a MULTI-image field (`backgroundImages: GalleryImage[]`). The Image
> block remains this spec's single-field consumer.
```

If the spec has no such explicit list, add the note under its "Scope" or "Decisions" section.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-06-08-unified-media-picker-design.md
git commit -m "docs(picker): amend spec #1 — container background moved to multi-image"
```

---

## Task 8: Full verification sweep

**Files:** none (verification only).

- [ ] **Step 1: Run the full touched-area suite**

Run: `pnpm test --run ContainerBackgroundSlideshow manualBlocks sectionPresets editorConfig StyleToolkitField reconcile`
Expected: all PASS.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: 0 errors (pre-existing `_`-prefixed warnings are fine; no NEW ones).

- [ ] **Step 4: Production build (client-bundle hygiene)**

Run: `pnpm next build`
Expected: succeeds. This proves the slideshow island + Container changes keep `node:async_hooks`/mongoose out of the client bundle (the island is `"use client"` and imports nothing server-only; `reconcile.ts` keeps `import "server-only"`).

- [ ] **Step 5: Full suite (pre-review sweep)**

Run: `pnpm test --run`
Expected: full green (the prior baseline was 163 files / 1997 tests; this adds files + tests).

- [ ] **Step 6: Final commit (only if any verification fix was needed)**

```bash
git add -A
git commit -m "test(portfolio): container background slideshow verification fixes"
```

---

## Self-Review (completed during planning)

**Spec coverage:**
- Multi-image `backgroundImages` source + reconcile → Tasks 2, 6. ✓
- `bgAnimation` (crossfade/kenburns/slide) + `bgSpeed` (slow/medium/fast ≈ 7/5/3s) → Tasks 1, 2, 5. ✓
- Controls visible only at ≥2 images → Task 5 gating + test. ✓
- 0→none, 1→static `<img>` (no JS), 2+→client island → Task 2 branch + tests. ✓
- Reduced-motion → static first image, no timer; pause when tab hidden → Task 1 island + tests. ✓
- Remove `backgroundImagePublicId` + legacy `_style.bgImagePublicId` background path → Task 2 (type + render). ✓
- Presets default to `backgroundImages` (0/1 element) → Task 3. ✓
- Editor fields + production fields + parity test → Task 4. ✓
- Decorative a11y (alt="", aria-hidden) → Task 1 + Task 2 (single `<img>`). ✓
- Spec #1 amendment → Task 7. ✓
- Tests + typecheck + lint + build → Task 8. ✓

**Type consistency:** `GalleryImage = {id,publicId,alt?}` and `MediaPickerSelection = {id,publicId}` used consistently. Island prop `SlideshowImage = {id,src}` (block resolves URLs, matching `GalleryCarouselBlock`→`GalleryCarouselClient`). `bgAnimation`/`bgSpeed` string unions identical across `manualBlocks.tsx`, `editorConfig.tsx`, the island, and `StyleToolkitField` option lists.

**Mobile/375px:** background layers are absolutely positioned (`inset:0`, `object-fit:cover`) and don't affect content flow; `min-height` governs section height as today — no new horizontal overflow. Verify visually at 375px during review.
