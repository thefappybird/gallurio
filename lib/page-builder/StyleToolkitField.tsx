"use client";

/**
 * StyleToolkitField — the block-level styling panel (`_style` custom Puck field).
 * Organises controls into THREE tabs:
 *   1. Content — Banner (bg image/color) + block-specific content inputs
 *   2. Design  — Typography (6-icon row), borders, shadow, padding, margin, animations
 *   3. Layout  — Gap, min-height, align/justify icon rows (or colSpan/rowSpan for grid children)
 *
 * Simplified blocks (Divider, Spacer, Image, Video, ContactDetails) bypass the
 * tab system and render a minimal inline panel.
 *
 * Editor chrome → English-only (RELEASE-CHECKLIST §4f).
 */

import { useRef, useState } from "react";
import { getBlockTab, setBlockTab, type BlockTab } from "./blockTabStore";
import { BlockIdContext } from "./drawerOpenStore";
import { EmojiButton } from "./EmojiTextInput";
import type { LucideIcon } from "lucide-react";
import {
  Bold,
  Italic,
  Underline,
  Baseline,
  PaintBucket,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  Maximize2,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalSpaceBetween,
  AlignVerticalSpaceAround,
  ChevronDown,
  ChevronUp,
  Square,
  Layers2,
  Layers,
  Minus,
} from "lucide-react";
import type { ComponentData } from "@measured/puck";
import { usePuckStore } from "./puckHooks";
import { SingleImagePicker } from "./galleryPicker/SingleImagePicker";
import { SingleImageControl, MultiImageControl, MultiCollectionControl } from "./galleryPicker/MediaField";
import type { MediaPickerSelection } from "./galleryPicker/MediaPicker";
import type { CollectionRef } from "./galleryPicker/MediaField";
import {
  ToolbarToggle,
  ColorSwatchRow,
  NumberInputRow,
  DimensionInput,
  IconRow,
  ResetButton,
  FloatingLabelInput,
} from "./toolbarPrimitives";
import { cn } from "@/lib/utils";
import { EditorDrawerSection, EditorDrawerGroup } from "./EditorDrawerSection";
import {
  STYLE_LIMITS,
  ANIMATION_TYPES,
  HOVER_EFFECTS,
  type BlockStyle,
  type ShadowSize,
  type AnimationType,
  type HoverEffect,
  type SelfAlign,
  type HighlightShape,
  type HighlightSize,
  effectiveButtonTextToken,
} from "./styleToolkit";
import { PORTFOLIO_FONT_KEYS, PORTFOLIO_FONTS, type PortfolioFontKey } from "./fonts";
import { CountControl } from "./CountControl";
import { useEffectiveBrandRadius, useEffectiveBrandFont } from "./brandColors";
import { CONTAINER_EFFECTIVE_PAD, COLUMNS_EFFECTIVE_PAD } from "./blocks/manualBlocks";

// Block types that are containers (no text/video inputs in Content tab)
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
  "GalleryLandingPreset",
]);

const TEXT_ONLY_BLOCKS = new Set(["Heading", "Text", "Divider", "Spacer", "Button"]);
// Frame (border/radius/shadow) is hidden for text/spacer/button leaf blocks.
// Button has its own consolidated design controls (see DesignTab isButton branch).
// GalleryGrid, GalleryMasonry, and FeaturedWork are container-like and DO show Frame.
const NO_FRAME_BLOCKS = new Set([
  "Heading", "Text", "Divider", "Spacer", "Button", "ContactDetails",
]);
// Gallery blocks that support banner/container props: same tab set as Container minus Typography.
export const GALLERY_CONTAINER_BLOCKS = new Set(["GalleryGrid", "GalleryMasonry", "FeaturedWork"]);
const GALLERY_BLOCKS = new Set(["GalleryGrid", "GalleryMasonry", "FeaturedWork"]);
// Gallery blocks that render images only (no on-page text) — typography controls are hidden.
const GALLERY_NO_TEXT_BLOCKS = new Set(["GalleryGrid", "GalleryMasonry", "FeaturedWork"]);
export const FLEX_CONTAINER_BLOCKS = new Set([
  "Container",
  "HeroPreset", "AboutPreset", "ServicesPreset", "CtaPreset", "ContactPreset",
  "GalleryGridPreset", "GalleryMasonryPreset", "FeaturedWorkPreset", "GalleryLandingPreset",
]);

const COLLECTION_GALLERY_BLOCKS = new Set(["GalleryGrid", "GalleryMasonry"]);

const ANIMATION_LABEL: Record<AnimationType, string> = {
  none: "None",
  fade: "Fade in",
  "slide-up": "Slide up",
  "slide-down": "Slide down",
  "slide-left": "Slide left",
  "slide-right": "Slide right",
  zoom: "Zoom in",
};

const HOVER_LABEL: Record<HoverEffect, string> = {
  none: "None",
  scale: "Scale up",
  lift: "Lift",
  dim: "Dim",
  brighten: "Brighten",
};

const SHADOW_OPTIONS: { value: ShadowSize; label: string; Icon: LucideIcon }[] = [
  { value: "none", label: "No shadow", Icon: Minus },
  { value: "sm", label: "Small", Icon: Square },
  { value: "md", label: "Medium", Icon: Layers2 },
  { value: "lg", label: "Large", Icon: Layers },
];

const BLOCK_POSITION_OPTIONS: { value: SelfAlign; label: string; Icon: LucideIcon }[] = [
  { value: "left",   label: "Align block left",   Icon: AlignHorizontalJustifyStart },
  { value: "center", label: "Align block center",  Icon: AlignHorizontalJustifyCenter },
  { value: "right",  label: "Align block right",   Icon: AlignHorizontalJustifyEnd },
];

const ALIGN_OPTIONS: { value: NonNullable<BlockStyle["alignItems"]>; label: string; Icon: LucideIcon }[] = [
  { value: "start",   label: "Left",           Icon: AlignHorizontalJustifyStart },
  { value: "center",  label: "Center",          Icon: AlignHorizontalJustifyCenter },
  { value: "end",     label: "Right",           Icon: AlignHorizontalJustifyEnd },
  { value: "stretch", label: "Stretch to fill", Icon: Maximize2 },
];

const JUSTIFY_OPTIONS: { value: NonNullable<BlockStyle["justifyContent"]>; label: string; Icon: LucideIcon }[] = [
  { value: "start",   label: "Top",           Icon: AlignVerticalJustifyStart },
  { value: "center",  label: "Middle",        Icon: AlignVerticalJustifyCenter },
  { value: "end",     label: "Bottom",        Icon: AlignVerticalJustifyEnd },
  { value: "between", label: "Spread apart",  Icon: AlignVerticalSpaceBetween },
  { value: "around",  label: "Spread evenly", Icon: AlignVerticalSpaceAround },
];

const MIN_HEIGHT_OPTIONS = [
  { value: "auto",   label: "Auto" },
  { value: "short",  label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "tall",   label: "Tall" },
] as const;

// ---------------------------------------------------------------------------
// Tab header
// ---------------------------------------------------------------------------

function TabHeader({
  tab,
  tabs,
  onTabChange,
}: {
  tab: string;
  tabs: readonly ("content" | "design" | "layout")[];
  onTabChange: (t: "content" | "design" | "layout") => void;
}) {
  const LABELS: Record<string, string> = { content: "Content", design: "Design", layout: "Layout" };
  const TOUR_IDS: Record<string, string> = {
    content: "style-tab-content",
    design: "style-tab-design",
    layout: "style-tab-layout",
  };
  return (
    <div className="flex border-b border-border">
      {tabs.map((id) => (
        <button
          key={id}
          type="button"
          data-tour-id={TOUR_IDS[id]}
          onClick={() => onTabChange(id)}
          className={cn(
            "flex-1 py-2 text-xs font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            tab === id
              ? "border-b-2 border-foreground text-foreground"
              : "text-muted-foreground"
          )}
        >
          {LABELS[id]}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Heading level buttons
// ---------------------------------------------------------------------------

const HEADING_LEVELS = [
  { value: "h1", label: "Display" },
  { value: "h2", label: "Title" },
  { value: "h3", label: "Heading" },
  { value: "h4", label: "Subheading" },
  { value: "h5", label: "Caption" },
  { value: "h6", label: "Label" },
] as const;

function HeadingLevelButtons({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (v: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Level</span>
      <div className="grid grid-cols-3 gap-1.5">
        {HEADING_LEVELS.map(({ value: v, label }) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={cn(
              "inline-flex h-7 cursor-pointer items-center justify-center border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              value === v && "bg-foreground text-background hover:bg-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content tab
// ---------------------------------------------------------------------------

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

type ContainerBgControls = {
  images: MediaPickerSelection[];
  onImagesChange: (v: MediaPickerSelection[]) => void;
  animation: string;
  speed: string;
  onAnimationChange: (v: string) => void;
  onSpeedChange: (v: string) => void;
};

export function BannerSection({
  s,
  set,
  container,
  hideBgImage = false,
}: {
  s: BlockStyle;
  set: (p: Partial<BlockStyle>) => void;
  container?: ContainerBgControls | null;
  /** When true, suppresses all background-image pickers (gallery blocks: color only). */
  hideBgImage?: boolean;
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
      {!hideBgImage && (container ? (
        <ContainerBackgroundControls {...container} />
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Image</span>
          <SingleImagePicker
            value={s.bgImagePublicId ?? ""}
            onChange={(pid) => set({ bgImagePublicId: pid || undefined })}
          />
        </div>
      ))}
    </div>
  );
}

export function ContentInputs({
  type,
  props,
  setProp,
}: {
  type: string;
  props: Record<string, unknown>;
  setProp: (key: string, val: unknown) => void;
}) {
  // Refs for emoji insert-at-caret (declared unconditionally per Rules of Hooks)
  const headingRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const buttonLabelRef = useRef<HTMLInputElement>(null);

  if (type === "Heading") {
    return (
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>Text</span>
          <div className="flex items-center gap-1">
            <input
              ref={headingRef}
              type="text"
              value={(props.text as string) ?? ""}
              onChange={(e) => setProp("text", e.target.value)}
              className="h-9 flex-1 border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <EmojiButton inputRef={headingRef} onChange={(v) => setProp("text", v)} />
          </div>
        </label>
        <HeadingLevelButtons
          value={props.level as string}
          onChange={(v) => setProp("level", v)}
        />
      </div>
    );
  }
  if (type === "Text") {
    return (
      <label className="flex flex-col gap-1 text-sm">
        <span>Text</span>
        <div className="flex items-start gap-1">
          <textarea
            ref={textRef}
            rows={4}
            value={(props.text as string) ?? ""}
            onChange={(e) => setProp("text", e.target.value)}
            className="flex-1 border border-border bg-background px-2 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <EmojiButton inputRef={textRef} onChange={(v) => setProp("text", v)} />
        </div>
      </label>
    );
  }
  if (type === "Button") {
    return (
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>Button text</span>
          <div className="flex items-center gap-1">
            <input
              ref={buttonLabelRef}
              type="text"
              value={(props.label as string) ?? ""}
              onChange={(e) => setProp("label", e.target.value)}
              className="h-9 flex-1 border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <EmojiButton inputRef={buttonLabelRef} onChange={(v) => setProp("label", v)} />
          </div>
        </label>
        <div className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">Action</span>
          <select
            value={(props.action as string) ?? "open-contact"}
            onChange={(e) => setProp("action", e.target.value)}
            className="h-7 flex-1 cursor-pointer border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="open-contact">Open contact form</option>
            <option value="go-to-gallery">Go to Gallery page</option>
          </select>
        </div>
      </div>
    );
  }
  if (COLLECTION_GALLERY_BLOCKS.has(type)) {
    // GalleryGrid and GalleryMasonry are images-only — expose the Photos picker.
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Photos</span>
          <MultiImageControl
            value={(props.images as MediaPickerSelection[]) ?? []}
            onChange={(v) => setProp("images", v)}
            max={60}
          />
        </div>
      </div>
    );
  }
  if (type === "FeaturedWork") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Collections</span>
          <MultiCollectionControl
            value={(props.collections as CollectionRef[]) ?? []}
            onChange={(v) => setProp("collections", v)}
          />
        </div>
      </div>
    );
  }
  if (type === "Columns") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Columns</span>
          <CountControl
            value={props.columns as number | undefined}
            onChange={(v) => setProp("columns", v ?? 1)}
            quickValues={[1, 2, 3]}
            min={1}
            max={6}
            allowAuto={false}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rows</span>
          <CountControl
            value={props.rows as number | undefined}
            onChange={(v) => setProp("rows", v)}
            quickValues={[1, 2, 3]}
            min={1}
            max={6}
            allowAuto
          />
        </div>
      </div>
    );
  }
  if (type === "ContactDetails") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">Leave blank to use your workspace contact details.</p>
        <FloatingLabelInput
          label="Email"
          value={(props.email as string) ?? ""}
          onChange={(v) => setProp("email", v)}
          type="email"
        />
        <FloatingLabelInput
          label="Phone"
          value={(props.phone as string) ?? ""}
          onChange={(v) => setProp("phone", v)}
          type="tel"
        />
        <FloatingLabelInput
          label="Address"
          value={(props.address as string) ?? ""}
          onChange={(v) => setProp("address", v)}
        />
        <FloatingLabelInput
          label="Instagram"
          value={(props.instagram as string) ?? ""}
          onChange={(v) => setProp("instagram", v)}
        />
        <FloatingLabelInput
          label="Facebook"
          value={(props.facebook as string) ?? ""}
          onChange={(v) => setProp("facebook", v)}
        />
        <FloatingLabelInput
          label="TikTok"
          value={(props.tiktok as string) ?? ""}
          onChange={(v) => setProp("tiktok", v)}
        />
        <FloatingLabelInput
          label="Website"
          value={(props.website as string) ?? ""}
          onChange={(v) => setProp("website", v)}
          type="url"
        />
      </div>
    );
  }
  return null;
}

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
  // Gallery container blocks need both the banner AND their gallery-specific content inputs
  // (collections picker / photo picker) — unlike true containers (slots), they have
  // direct gallery content controlled via ContentInputs.
  const showContentInputs = !isContainer || GALLERY_CONTAINER_BLOCKS.has(type);
  // Gallery blocks (GalleryGrid/GalleryMasonry/FeaturedWork) show the banner Color swatch
  // but NOT the background-images picker — the images are the block content, not a backdrop.
  const hideBgImage = GALLERY_CONTAINER_BLOCKS.has(type);
  return (
    <div className="flex flex-col gap-4 p-3">
      {showBanner && <BannerSection s={s} set={set} container={container} hideBgImage={hideBgImage} />}
      {showContentInputs && p && <ContentInputs type={type} props={p} setProp={setProp} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Carousel text controls — Text Padding + independent heading/description
// highlight bands. Carousel-only; stored on `_style` (BlockStyle), threaded into
// GalleryHeader by GalleryCarouselBlock.
// ---------------------------------------------------------------------------


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

const RADIUS_PRESETS: { label: string; value: number }[] = [
  { label: "None", value: 0 },
  { label: "S", value: 4 },
  { label: "M", value: 8 },
  { label: "L", value: 16 },
  { label: "Full", value: 9999 },
];

/**
 * Maps a brand-kit radius token to the nearest RADIUS_PRESETS value.
 * Brand-kit rem values use a 16px base:
 *   sharp   → "0"      → 0px  → preset 0   (None)
 *   subtle  → "0.25rem"→ 4px  → preset 4   (S)
 *   rounded → "0.5rem" → 8px  → preset 8   (M)
 */
export const BRAND_RADIUS_TO_PRESET: Record<"sharp" | "subtle" | "rounded", number> = {
  sharp: 0,
  subtle: 4,
  rounded: 8,
};

export function RadiusButtons({
  value,
  onChange,
  effectiveValue,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  /** The preset value that the theme's brand-kit radius maps to. When the
   *  block's own radius is unset (theme-coupled), this is shown as active so
   *  the user can see what the theme is applying. Writing `effectiveValue`
   *  into block props is NOT done here — only the display changes. */
  effectiveValue?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">Corner radius</span>
      <div className="flex items-center gap-1.5">
        {RADIUS_PRESETS.map(({ label, value: v }) => {
          const isExplicit = value === v;
          // When the block has no explicit radius, show the theme's effective preset.
          const isEffective = value === undefined && effectiveValue === v;
          const isActive = isExplicit || isEffective;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(value === v ? undefined : v)}
              className={cn(
                "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isExplicit && "bg-foreground text-background hover:bg-foreground",
                isEffective && "border-foreground"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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

export function CarouselTextPadding({
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
      <NumberInputRow
        label="Heading gap"
        value={s.headingGap}
        min={0}
        max={96}
        suffix="px"
        onChange={(v) => set({ headingGap: v })}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Padding controls — shared by LayoutTabBody (flex containers only)
// ---------------------------------------------------------------------------

type EffectivePad = { top: string; right: string; bottom: string; left: string };

function PaddingControls({
  s,
  set,
  effectivePad,
}: {
  s: BlockStyle;
  set: (p: Partial<BlockStyle>) => void;
  effectivePad?: EffectivePad;
}) {
  const [paddingAdvanced, setPaddingAdvanced] = useState(false);
  const paddingX =
    s.paddingLeft !== undefined && s.paddingLeft === s.paddingRight ? s.paddingLeft : undefined;
  const paddingY =
    s.paddingTop !== undefined && s.paddingTop === s.paddingBottom ? s.paddingTop : undefined;
  // Collapsed-mode effective values: only show when L===R or T===B respectively.
  const effectiveX =
    effectivePad && effectivePad.left === effectivePad.right ? effectivePad.left : undefined;
  const effectiveY =
    effectivePad && effectivePad.top === effectivePad.bottom ? effectivePad.top : undefined;
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
          <DimensionInput label="Top" value={s.paddingTop} effectiveValue={effectivePad?.top} onChange={(v) => set({ paddingTop: v })} />
          <DimensionInput label="Right" value={s.paddingRight} effectiveValue={effectivePad?.right} onChange={(v) => set({ paddingRight: v })} />
          <DimensionInput label="Bottom" value={s.paddingBottom} effectiveValue={effectivePad?.bottom} onChange={(v) => set({ paddingBottom: v })} />
          <DimensionInput label="Left" value={s.paddingLeft} effectiveValue={effectivePad?.left} onChange={(v) => set({ paddingLeft: v })} />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <DimensionInput
            label="Horizontal (X)"
            value={paddingX}
            effectiveValue={effectiveX}
            onChange={(v) => set({ paddingLeft: v, paddingRight: v })}
          />
          <DimensionInput
            label="Vertical (Y)"
            value={paddingY}
            effectiveValue={effectiveY}
            onChange={(v) => set({ paddingTop: v, paddingBottom: v })}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Design tab
// ---------------------------------------------------------------------------

export function DesignTab({
  s,
  set,
  blockType = "",
}: {
  s: BlockStyle;
  set: (p: Partial<BlockStyle>) => void;
  blockType?: string;
}) {
  const isButton = blockType === "Button";
  const showFrame = !NO_FRAME_BLOCKS.has(blockType);
  const effectiveRadius = useEffectiveBrandRadius();
  // Image-only gallery blocks have no on-page text — hide typography controls.
  const showTypography = !GALLERY_NO_TEXT_BLOCKS.has(blockType);
  // Heading blocks follow the brand heading font; all others follow the body font.
  // ponytail: "body" covers Text, Button, Container, and all other block types since
  // only Heading maps to --pf-font-heading; everything else inherits body via CSS.
  const effectiveFontFamily = useEffectiveBrandFont(blockType === "Heading" ? "heading" : "body");

  return (
    <EditorDrawerGroup>
      {/* Typography drawer */}
      {showTypography && (
        <EditorDrawerSection title="Typography">
          <div className="flex flex-wrap items-center gap-1.5">
            {blockType !== "Heading" && (
              <ToolbarToggle active={!!s.bold} title="Bold" Icon={Bold} onClick={() => set({ bold: !s.bold })} />
            )}
            <ToolbarToggle active={!!s.italic} title="Italic" Icon={Italic} onClick={() => set({ italic: !s.italic })} />
            <ToolbarToggle active={!!s.underline} title="Underline" Icon={Underline} onClick={() => set({ underline: !s.underline })} />
            {!isButton && (
              <>
                <ToolbarToggle
                  active={s.align === "left"}
                  title="Align left"
                  Icon={AlignLeft}
                  onClick={() => set({ align: s.align === "left" ? undefined : "left" })}
                />
                <ToolbarToggle
                  active={s.align === "center"}
                  title="Align center"
                  Icon={AlignCenter}
                  onClick={() => set({ align: s.align === "center" ? undefined : "center" })}
                />
                <ToolbarToggle
                  active={s.align === "right"}
                  title="Align right"
                  Icon={AlignRight}
                  onClick={() => set({ align: s.align === "right" ? undefined : "right" })}
                />
              </>
            )}
          </div>
          {/* Text color: shown in Typography for non-button blocks; Button has it in the Button section. */}
          {!isButton && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <Baseline className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="text-xs text-muted-foreground">Text color</span>
              </div>
              <ColorSwatchRow
                value={s.textColorToken}
                effectiveValue="foreground"
                onChange={(t) => set({ textColorToken: t })}
              />
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">Font</span>
            <div className="flex items-center gap-1">
              {/* When fontFamily is unset, show the effective brand font as selected
                  (lighter opacity = "following theme"). Editing writes the real _style. */}
              <select
                value={s.fontFamily ?? effectiveFontFamily ?? ""}
                onChange={(e) =>
                  set({
                    fontFamily: e.target.value
                      ? (e.target.value as PortfolioFontKey)
                      : undefined,
                  })
                }
                className={cn(
                  "h-7 cursor-pointer border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  s.fontFamily === undefined && effectiveFontFamily !== undefined && "opacity-60"
                )}
              >
                <option value="">Theme font</option>
                {PORTFOLIO_FONT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {PORTFOLIO_FONTS[key].label}
                  </option>
                ))}
              </select>
              <ResetButton onClick={() => set({ fontFamily: undefined })} label="Font" />
            </div>
          </div>
          {blockType !== "Heading" && (
            <NumberInputRow
              label="Font size"
              value={s.fontSize}
              min={STYLE_LIMITS.fontSize.min}
              max={STYLE_LIMITS.fontSize.max}
              // ponytail: fontSize renders as CSS `inherit` (manualBlocks ~L173), resolving to
              // the page's cascaded font-size. 16px is the browser default base and the most
              // likely effective value, so we use it as the placeholder for unset fontSize.
              effectiveValue={16}
              onChange={(v) => set({ fontSize: v })}
            />
          )}
          {/* Highlight band — Heading and Text blocks only */}
          {(blockType === "Heading" || blockType === "Text") && (
            <div className="flex flex-col gap-2">
              <HighlightToggle
                label="Highlight"
                on={!!s.highlight}
                onToggle={() => set({ highlight: !s.highlight })}
              />
              {s.highlight && (
                <div className="flex flex-col gap-2">
                  <ColorSwatchRow
                    value={s.highlightToken}
                    onChange={(t) => set({ highlightToken: t })}
                    allowNone={false}
                  />
                  <ChoiceRow
                    label="Shape"
                    value={(s.highlightShape ?? "subtle") as HighlightShape}
                    options={HIGHLIGHT_SHAPE_OPTIONS}
                    onChange={(v) => set({ highlightShape: v as HighlightShape })}
                  />
                  <ChoiceRow
                    label="Size"
                    value={(s.highlightSize ?? "md") as HighlightSize}
                    options={HIGHLIGHT_SIZE_OPTIONS}
                    onChange={(v) => set({ highlightSize: v as HighlightSize })}
                  />
                </div>
              )}
            </div>
          )}
        </EditorDrawerSection>
      )}

      {/* Button section — consolidated design controls for the Button block only.
          Order matches the brief: color → opacity → text color → radius → style. */}
      {isButton && (
        <EditorDrawerSection title="Button">
          {/* 1. Button color */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <PaintBucket className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="text-xs text-muted-foreground">Button color</span>
            </div>
            <ColorSwatchRow
              value={s.buttonColorToken}
              onChange={(t) => set({ buttonColorToken: t })}
            />
          </div>
          {/* 2. Button opacity — effective 100 when unset (prop stays unset until edited) */}
          <NumberInputRow
            label="Button opacity"
            value={s.buttonOpacity}
            min={0}
            max={100}
            suffix="%"
            effectiveValue={100}
            onChange={(v) => set({ buttonOpacity: v })}
          />
          {/* 3. Button text color */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Baseline className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="text-xs text-muted-foreground">Button text color</span>
            </div>
            <ColorSwatchRow
              value={s.textColorToken}
              effectiveValue={effectiveButtonTextToken(s)}
              onChange={(t) => set({ textColorToken: t })}
            />
          </div>
          {/* 4. Corner radius */}
          <RadiusButtons value={s.radius} onChange={(v) => set({ radius: v })} effectiveValue={effectiveRadius} />
          {/* 5. Button style */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Button style</span>
            <div className="flex items-center gap-1.5">
              {(["solid", "outline", "soft"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={s.buttonStyle === v}
                  onClick={() => set({ buttonStyle: s.buttonStyle === v ? undefined : v })}
                  className={cn(
                    "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    s.buttonStyle === v && "bg-foreground text-background hover:bg-foreground"
                  )}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </EditorDrawerSection>
      )}

      {/* Frame drawer — hidden for text/button leaf blocks and gallery blocks */}
      {showFrame && (
        <EditorDrawerSection title="Frame">
          <NumberInputRow
            label="Border width"
            value={s.borderWidth}
            min={STYLE_LIMITS.borderWidth.min}
            max={STYLE_LIMITS.borderWidth.max}
            effectiveValue={0}
            onChange={(v) => set({ borderWidth: v })}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Border color</span>
            {/* Effective: resolveBlockStyle falls back to var(--pf-color-fg) when borderColorToken
                is unset (styleToolkit.ts ~L257), mapping to the "foreground" token. */}
            <ColorSwatchRow
              value={s.borderColorToken}
              onChange={(t) => set({ borderColorToken: t })}
              allowNone={false}
              effectiveValue="foreground"
            />
          </div>
          <RadiusButtons value={s.radius} onChange={(v) => set({ radius: v })} effectiveValue={effectiveRadius} />
          <IconRow
            label="Shadow"
            value={s.shadow}
            options={SHADOW_OPTIONS}
            effectiveValue="none"
            onChange={(v) => set({ shadow: v as ShadowSize | undefined })}
          />
        </EditorDrawerSection>
      )}

      {/* Effects drawer — entrance animation + hover */}
      <EditorDrawerSection title="Effects">
        <div className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">Entrance</span>
          <div className="flex items-center gap-1">
            <select
              value={s.animation ?? "none"}
              onChange={(e) => set({ animation: e.target.value as AnimationType })}
              className="h-7 cursor-pointer border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {ANIMATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ANIMATION_LABEL[type]}
                </option>
              ))}
            </select>
            <ResetButton onClick={() => set({ animation: "none" })} label="Entrance" />
          </div>
        </div>
        <NumberInputRow
          label="Duration"
          value={s.animationDuration}
          min={50}
          max={5000}
          suffix="ms"
          onChange={(v) => set({ animationDuration: v })}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">Hover effect</span>
          <div className="flex items-center gap-1">
            <select
              value={s.hover ?? "none"}
              onChange={(e) => set({ hover: e.target.value as HoverEffect })}
              className="h-7 cursor-pointer border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {HOVER_EFFECTS.map((effect) => (
                <option key={effect} value={effect}>
                  {HOVER_LABEL[effect]}
                </option>
              ))}
            </select>
            <ResetButton onClick={() => set({ hover: "none" })} label="Hover effect" />
          </div>
        </div>
      </EditorDrawerSection>
    </EditorDrawerGroup>
  );
}

// ---------------------------------------------------------------------------
// Layout tab
// ---------------------------------------------------------------------------

function ColSpanRowSpanControls({
  s,
  set,
  parentColumnsCount = 12,
  parentRowsCount = 12,
}: {
  s: BlockStyle;
  set: (p: Partial<BlockStyle>) => void;
  parentColumnsCount?: number;
  parentRowsCount?: number;
}) {
  return (
    <>
      <NumberInputRow
        label="Column span"
        value={s.colSpan}
        min={1}
        max={parentColumnsCount}
        suffix="cols"
        onChange={(v) => set({ colSpan: v })}
      />
      <NumberInputRow
        label="Row span"
        value={s.rowSpan}
        min={1}
        max={parentRowsCount}
        suffix="rows"
        onChange={(v) => set({ rowSpan: v })}
      />
    </>
  );
}

const GAP_OPTIONS = [
  { value: "tight",  label: "Tight" },
  { value: "normal", label: "Normal" },
  { value: "loose",  label: "Loose" },
] as const;

const COLUMNS_OPTIONS = [
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
] as const;

function GalleryLayoutControls({
  type,
  s,
  set,
}: {
  type: string;
  s: BlockStyle;
  set: (patch: Partial<BlockStyle>) => void;
}) {
  if (COLLECTION_GALLERY_BLOCKS.has(type)) {
    // GalleryGrid and GalleryMasonry: show Columns + Gap controls.
    // Values live in _style.galleryColumns / _style.galleryGap.
    // Effective defaults: columns=3, gap="normal" (shown with lighter "following theme" ring).
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Columns</span>
          <div className="flex items-center gap-1.5">
            {COLUMNS_OPTIONS.map(({ value, label }) => {
              const isExplicit = s.galleryColumns === value;
              const isEffective = s.galleryColumns === undefined && value === 3;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={isExplicit || isEffective}
                  onClick={() => set({ galleryColumns: value })}
                  className={cn(
                    "inline-flex h-7 min-w-[2.5rem] cursor-pointer items-center justify-center border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    isExplicit && "bg-foreground text-background hover:bg-foreground",
                    isEffective && "border-foreground opacity-70"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Image spacing</span>
          <div className="flex items-center gap-1.5">
            {GAP_OPTIONS.map(({ value, label }) => {
              const isExplicit = s.galleryGap === value;
              const isEffective = s.galleryGap === undefined && value === "normal";
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={isExplicit || isEffective}
                  onClick={() => set({ galleryGap: value })}
                  className={cn(
                    "inline-flex h-7 cursor-pointer items-center justify-center border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    isExplicit && "bg-foreground text-background hover:bg-foreground",
                    isEffective && "border-foreground opacity-70"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (type === "FeaturedWork") {
    // FeaturedWork: columns only, no gap. Value in _style.galleryColumns.
    // Effective default: columns=3.
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Columns</span>
          <div className="flex items-center gap-1.5">
            {COLUMNS_OPTIONS.map(({ value, label }) => {
              const isExplicit = s.galleryColumns === value;
              const isEffective = s.galleryColumns === undefined && value === 3;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={isExplicit || isEffective}
                  onClick={() => set({ galleryColumns: value })}
                  className={cn(
                    "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    isExplicit && "bg-foreground text-background hover:bg-foreground",
                    isEffective && "border-foreground opacity-70"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export function LayoutTabBody({
  s,
  set,
  isGridChild,
  showJustify,
  blockType = "",
  p,
  setProp,
  parentColumnsCount = 12,
  parentRowsCount = 12,
}: {
  s: BlockStyle;
  set: (patch: Partial<BlockStyle>) => void;
  isGridChild: boolean;
  showJustify: boolean;
  blockType?: string;
  p?: Record<string, unknown>;
  setProp?: (key: string, val: unknown) => void;
  parentColumnsCount?: number;
  parentRowsCount?: number;
}) {
  const isGalleryLayout = GALLERY_BLOCKS.has(blockType);
  const isGalleryContainer = GALLERY_CONTAINER_BLOCKS.has(blockType);
  const isFlexContainer = FLEX_CONTAINER_BLOCKS.has(blockType);
  // Columns is a grid container (not flex), but it shares the same spacing
  // (padding) + gap controls as Container.
  const isColumns = blockType === "Columns";

  // Effective padding for the plain Container and Columns blocks only.
  // Preset blocks have explicit curated padding already baked in -- no effectivePad.
  const effectivePad: EffectivePad | undefined =
    blockType === "Container" ? CONTAINER_EFFECTIVE_PAD :
    blockType === "Columns" ? COLUMNS_EFFECTIVE_PAD :
    undefined;

  if (isGalleryLayout) {
    if (isGalleryContainer) {
      // Gallery container blocks: gallery-specific controls (columns/gap via _style) +
      // container layout drawers (Spacing with padding, Layout with gap/min-height/align).
      return (
        <EditorDrawerGroup>
          <EditorDrawerSection title="Gallery">
            <GalleryLayoutControls type={blockType} s={s} set={set} />
          </EditorDrawerSection>
          <EditorDrawerSection title="Spacing">
            <PaddingControls s={s} set={set} />
          </EditorDrawerSection>
          <EditorDrawerSection title="Layout">
            <NumberInputRow
              label="Gap"
              value={s.gap}
              min={0}
              max={96}
              suffix="px"
              effectiveValue={16}
              onChange={(v) => set({ gap: v })}
            />
            {p !== undefined && setProp !== undefined && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Min height</span>
                <div className="flex items-center gap-1.5">
                  {MIN_HEIGHT_OPTIONS.map(({ value, label }) => {
                    const isExplicit = p.minHeight !== undefined && (p.minHeight as string) === value;
                    // Effective default: when minHeight is unset, "auto" is the fallback.
                    const isEffective = p.minHeight === undefined && value === "auto";
                    const isActive = isExplicit || isEffective;
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => setProp("minHeight", value)}
                        className={cn(
                          "inline-flex h-7 cursor-pointer items-center justify-center border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                          isExplicit && "bg-foreground text-background hover:bg-foreground",
                          isEffective && "border-foreground"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {isGridChild ? (
              <>
                <ColSpanRowSpanControls s={s} set={set} parentColumnsCount={parentColumnsCount} parentRowsCount={parentRowsCount} />
                <IconRow
                  label="Align"
                  value={s.alignItems}
                  options={ALIGN_OPTIONS}
                  effectiveValue="stretch"
                  onChange={(v) => set({ alignItems: v })}
                />
              </>
            ) : (
              <IconRow
                label="Align"
                value={s.alignItems}
                options={ALIGN_OPTIONS}
                effectiveValue="stretch"
                onChange={(v) => set({ alignItems: v })}
              />
            )}
          </EditorDrawerSection>
        </EditorDrawerGroup>
      );
    }
    // Non-container gallery blocks: simple layout view with gallery controls only.
    return (
      <div className="flex flex-col gap-4 p-3">
        <GalleryLayoutControls type={blockType} s={s} set={set} />
      </div>
    );
  }

  // For text-only and button leaf blocks: position/size + spacing controls.
  if (TEXT_ONLY_BLOCKS.has(blockType)) {
    const isButton = blockType === "Button";
    return (
      <EditorDrawerGroup>
        {isButton && p && setProp && (
          <EditorDrawerSection title="Layout">
            {/* Button style and Corner radius moved to Design tab → Button section (Pass 2). */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Size</span>
              <div className="flex items-center gap-1.5">
                {(["sm", "md", "lg"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={(p.size as string | undefined) === v || (p.size === undefined && v === "md")}
                    onClick={() => setProp("size", v)}
                    className={cn(
                      "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      ((p.size as string | undefined) === v || (p.size === undefined && v === "md")) &&
                        "bg-foreground text-background hover:bg-foreground"
                    )}
                  >
                    {v === "sm" ? "S" : v === "md" ? "M" : "L"}
                  </button>
                ))}
              </div>
            </div>
            <IconRow
              label="Block position"
              value={s.selfAlign}
              options={BLOCK_POSITION_OPTIONS}
              onChange={(v) => set({ selfAlign: v })}
            />
            <DimensionInput label="Width" value={s.width} onChange={(v) => set({ width: v })} />
          </EditorDrawerSection>
        )}
        {!isButton && (
          <EditorDrawerSection title="Layout">
            <IconRow
              label="Block position"
              value={s.selfAlign}
              options={BLOCK_POSITION_OPTIONS}
              onChange={(v) => set({ selfAlign: v })}
            />
            <DimensionInput label="Width" value={s.width} onChange={(v) => set({ width: v })} />
            <DimensionInput label="Height" value={s.height} onChange={(v) => set({ height: v })} />
          </EditorDrawerSection>
        )}
      </EditorDrawerGroup>
    );
  }

  // Container / generic block layout
  return (
    <EditorDrawerGroup>
      <EditorDrawerSection title="Spacing">
        {(isFlexContainer || isColumns) && <PaddingControls s={s} set={set} effectivePad={effectivePad} />}
      </EditorDrawerSection>
      <EditorDrawerSection title="Layout">
        <NumberInputRow
          label="Gap"
          value={s.gap}
          min={0}
          max={96}
          suffix="px"
          effectiveValue={16}
          onChange={(v) => set({ gap: v })}
        />
        {/* Min height — only for flex containers, controlled via block prop */}
        {isFlexContainer && p !== undefined && setProp && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Min height</span>
            <div className="flex items-center gap-1.5">
              {MIN_HEIGHT_OPTIONS.map(({ value, label }) => {
                const isExplicit = p.minHeight !== undefined && (p.minHeight as string) === value;
                // Effective default: when minHeight is unset, "auto" is the fallback.
                const isEffective = p.minHeight === undefined && value === "auto";
                const isActive = isExplicit || isEffective;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setProp("minHeight", value)}
                    className={cn(
                      "inline-flex h-7 cursor-pointer items-center justify-center border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      isExplicit && "bg-foreground text-background hover:bg-foreground",
                      isEffective && "border-foreground"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {isGridChild ? (
          <>
            <ColSpanRowSpanControls s={s} set={set} parentColumnsCount={parentColumnsCount} parentRowsCount={parentRowsCount} />
            <IconRow
              label="Align"
              value={s.alignItems}
              options={ALIGN_OPTIONS}
              effectiveValue="stretch"
              onChange={(v) => set({ alignItems: v })}
            />
            <IconRow
              label="Justify"
              value={s.justifyContent}
              options={JUSTIFY_OPTIONS}
              effectiveValue="start"
              onChange={(v) => set({ justifyContent: v })}
            />
          </>
        ) : (
          <>
            <IconRow
              label="Align"
              value={s.alignItems}
              options={ALIGN_OPTIONS}
              effectiveValue="stretch"
              onChange={(v) => set({ alignItems: v })}
            />
            {showJustify && (
              <IconRow
                label="Justify"
                value={s.justifyContent}
                options={JUSTIFY_OPTIONS}
                effectiveValue="start"
                onChange={(v) => set({ justifyContent: v })}
              />
            )}
          </>
        )}
      </EditorDrawerSection>
    </EditorDrawerGroup>
  );
}

// ---------------------------------------------------------------------------
// Simplified panels — blocks that bypass the tab system
// ---------------------------------------------------------------------------

function ImagePanel({ p, setProp }: { p: Record<string, unknown> | undefined; setProp: (k: string, v: unknown) => void }) {
  return (
    <div className="flex flex-col gap-3 p-3">
      <SingleImageControl
        value={(p?.imagePublicId as string) ?? ""}
        onChange={(v) => setProp("imagePublicId", v)}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="shrink-0 text-xs text-muted-foreground">Alt text</span>
        <input
          type="text"
          value={(p?.alt as string) ?? ""}
          onChange={(e) => setProp("alt", e.target.value)}
          className="h-7 flex-1 border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Fit</span>
        <div className="flex items-center gap-1.5">
          {(["cover", "contain"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={(p?.fit as string) === v}
              onClick={() => setProp("fit", v)}
              className={cn(
                "inline-flex h-7 cursor-pointer items-center px-3 text-xs border border-border bg-background text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                (p?.fit as string) === v && "bg-foreground text-background hover:bg-foreground"
              )}
            >
              {v === "cover" ? "Cover" : "Contain"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function VideoPanel({ p, setProp }: { p: Record<string, unknown> | undefined; setProp: (k: string, v: unknown) => void }) {
  return (
    <div className="flex flex-col gap-3 p-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Video URL</span>
        <input
          type="url"
          value={(p?.videoUrl as string) ?? ""}
          onChange={(e) => setProp("videoUrl", e.target.value)}
          placeholder="YouTube or Vimeo URL"
          className="h-9 border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </label>
    </div>
  );
}

function DividerPanel({ p, setProp }: { p: Record<string, unknown> | undefined; setProp: (k: string, v: unknown) => void }) {
  return (
    <div className="p-3">
      <NumberInputRow
        label="Thickness"
        value={p?.thickness as number | undefined}
        min={1}
        max={12}
        suffix="px"
        onChange={(v) => setProp("thickness", v)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Block-aware panel — single usePuck() call, derives type/context from selection
// ---------------------------------------------------------------------------

function BlockAwarePanel({
  s,
  set,
}: {
  s: BlockStyle;
  set: (patch: Partial<BlockStyle>) => void;
  /** @deprecated kept for call-site compatibility; ignored in favour of the block-tab store */
  tab?: "content" | "design" | "layout";
  /** @deprecated kept for call-site compatibility; ignored in favour of the block-tab store */
  onTabChange?: (t: "content" | "design" | "layout") => void;
}) {
  const selectedItem = usePuckStore((s) => s.selectedItem);
  const dispatch = usePuckStore((s) => s.dispatch);
  const getSelectorForId = usePuckStore((s) => s.getSelectorForId);
  const getItemById = usePuckStore((s) => s.getItemById);

  const blockId = (selectedItem?.props?.id as string | undefined) ?? "";

  // Store-backed tab: survives StyleToolkitField remounts (Puck re-invokes the
  // field render on every value change). Using blockId as key means selecting a
  // different block starts at "content" while edits on the same block preserve
  // whichever tab the user navigated to.
  const [activeTab, setActiveTabState] = useState<BlockTab>(() => getBlockTab(blockId));
  function setActiveTab(t: BlockTab) {
    setActiveTabState(t);
    if (blockId) setBlockTab(blockId, t);
  }

  const type = (selectedItem?.type ?? "") as string;
  const isGallery = GALLERY_BLOCKS.has(type);
  const isContainer = CONTAINER_TYPES.has(type);
  // Gallery container blocks (GalleryGrid, GalleryMasonry, FeaturedWork) get the same
  // Content/Design/Layout drawers as Container, minus Typography. They are NOT true
  // containers (no slot), so ContentInputs still shows their gallery-specific controls.
  const isGalleryContainer = GALLERY_CONTAINER_BLOCKS.has(type);
  const isFlexContainer = FLEX_CONTAINER_BLOCKS.has(type);

  const availableTabs = type === "ContactDetails"
    ? (["content", "design"] as const)
    : (["content", "design", "layout"] as const);

  const isGridChild = (() => {
    if (!selectedItem) return false;
    const sel = getSelectorForId(selectedItem.props.id as string);
    if (!sel?.zone) return false;
    const parentId = sel.zone.split(":")[0];
    return getItemById(parentId)?.type === "Columns";
  })();

  const parentColumnsCount = (() => {
    if (!selectedItem) return 12;
    const sel = getSelectorForId(selectedItem.props.id as string);
    if (!sel?.zone) return 12;
    const parentId = sel.zone.split(":")[0];
    const parent = getItemById(parentId);
    if (parent?.type === "Columns") return (parent.props.columns as number) ?? 2;
    return 12;
  })();

  const parentRowsCount = (() => {
    if (!selectedItem) return 12;
    const sel = getSelectorForId(selectedItem.props.id as string);
    if (!sel?.zone) return 12;
    const parentId = sel.zone.split(":")[0];
    const parent = getItemById(parentId);
    if (parent?.type === "Columns") {
      const r = parent.props.rows as number | undefined;
      return r !== undefined && Number.isFinite(r) ? Math.min(12, Math.max(1, Math.floor(r))) : 12;
    }
    return 12;
  })();

  function setProp(key: string, val: unknown) {
    if (!selectedItem) return;
    const id = selectedItem.props?.id;
    if (typeof id !== "string" || !id) return;
    const sel = getSelectorForId(id);
    if (!sel) return;
    const current = getItemById(id) ?? selectedItem;
    dispatch({
      type: "replace",
      destinationZone: sel.zone,
      destinationIndex: sel.index,
      data: {
        ...current,
        props: { ...current.props, [key]: val },
      } as ComponentData,
    });
  }

  const p = selectedItem?.props as Record<string, unknown> | undefined;

  // Simplified blocks bypass the tab system entirely.
  if (type === "Divider") return <DividerPanel p={p} setProp={setProp} />;
  if (type === "Image") return <ImagePanel p={p} setProp={setProp} />;
  if (type === "Video") return <VideoPanel p={p} setProp={setProp} />;

  return (
    <BlockIdContext.Provider value={blockId}>
      <div className="flex flex-col">
        <TabHeader tab={activeTab} tabs={availableTabs} onTabChange={setActiveTab} />
        {activeTab === "content" && (
          <ContentTabBody
            s={s}
            set={set}
            type={type}
            p={p}
            setProp={setProp}
            showBanner={isContainer || isGalleryContainer || type === "ContactDetails"}
            isContainer={isContainer || isGalleryContainer}
          />
        )}
        {activeTab === "design" && <DesignTab s={s} set={set} blockType={type} />}
        {activeTab === "layout" && (
          <LayoutTabBody
            s={s}
            set={set}
            isGridChild={isGridChild}
            showJustify={isFlexContainer && !isGallery}
            blockType={type}
            p={p}
            setProp={setProp}
            parentColumnsCount={parentColumnsCount}
            parentRowsCount={parentRowsCount}
          />
        )}
      </div>
    </BlockIdContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function StyleToolkitField({
  value,
  onChange,
  fieldId,
  blockType = "",
}: {
  value: BlockStyle | undefined;
  onChange: (next: BlockStyle) => void;
  fieldId?: string;
  blockType?: string;
}) {
  const [tab, setTab] = useState<"content" | "design" | "layout">("content");
  const s = value ?? {};
  const set = (patch: Partial<BlockStyle>) => onChange({ ...s, ...patch });

  if (fieldId) {
    return <BlockAwarePanel s={s} set={set} tab={tab} onTabChange={setTab} />;
  }

  // Standalone render (tests — no Puck provider): show full 3-tab panel
  const allTabs = ["content", "design", "layout"] as const;
  const standaloneIsContainer = CONTAINER_TYPES.has(blockType) || GALLERY_CONTAINER_BLOCKS.has(blockType);
  return (
    <div className="flex flex-col">
      <TabHeader tab={tab} tabs={allTabs} onTabChange={setTab} />
      {tab === "content" && (
        <ContentTabBody
          s={s}
          set={set}
          type={blockType}
          p={undefined}
          setProp={() => {}}
          showBanner={standaloneIsContainer || !GALLERY_BLOCKS.has(blockType)}
          isContainer={standaloneIsContainer}
        />
      )}
      {tab === "design" && <DesignTab s={s} set={set} blockType={blockType} />}
      {tab === "layout" && (
        <LayoutTabBody s={s} set={set} isGridChild={false} showJustify={true} blockType={blockType} />
      )}
    </div>
  );
}
