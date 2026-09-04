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
 * Editor chrome is intentionally English-only.
 */

import { useRef, useState } from "react";
import {
  SECTION_PRESET_KEYS,
  NAV_PRESET_KEYS,
  LEGACY_NAV_PRESET_KEYS,
} from "./blocks/sectionPresets";
import { getBlockTab, setBlockTab, type BlockTab } from "./blockTabStore";
import { BlockIdContext } from "./drawerOpenStore";
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
  PanelTop,
  PanelRight,
  PanelBottom,
  PanelLeft,
  Upload,
} from "lucide-react";
import type { ComponentData } from "@measured/puck";
import { usePuckStore } from "./puckHooks";
import { SingleImageControl, MultiImageControl, MultiCollectionControl, SingleCollectionControl } from "./galleryPicker/MediaField";
import { ImageBlockMetaSection } from "./ImageBlockMetaSection";
import type { MediaPickerSelection } from "./galleryPicker/MediaPicker";
import type { CollectionRef } from "./galleryPicker/MediaField";
import { useDemoPicker } from "./demoPickerContext";
import { DemoSingleImageControl, DemoMultiImageControl } from "@/app/[locale]/(app)/portfolio/_components/DemoImagePicker";
import {
  ToolbarToggle,
  ColorSwatchRow,
  NumberInputRow,
  DimensionInput,
  IconRow,
  ResetButton,
  FloatingLabelInput,
  FontFamilyRow,
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
  type BorderSide,
  type StyleColorToken,
  effectiveButtonTextToken,
  bgImageUrl,
} from "./styleToolkit";
import { GALLERY_EFFECTIVE_PAD } from "./responsive";
import { CountControl } from "./CountControl";
import {
  galleryPropsWithZones,
  gallerySlotPatch,
  gallerySlotSelections,
  galleryZonesWithPatch,
} from "./gallerySlotImages";
import {
  navigationLogoAssetId,
  navigationLogoPatch,
  navigationPropsWithZones,
  navigationZonesWithPatch,
} from "./navigationLogo";
import { useEffectiveBrandRadius, useEffectiveBrandFont, useBrandRadius } from "./brandColors";
import {
  BUTTON_SIZE_FONT_PX,
  CONTAINER_EFFECTIVE_PAD,
  COLUMNS_EFFECTIVE_PAD,
  TEXT_EFFECTIVE_PAD,
} from "./blocks/manualBlocks";
import { uploadAsset } from "@/lib/storage/uploadAsset.client";
import {
  HEADER_SHADOW_SIZES,
  HEADER_FONT_SIZES,
  HEADER_NAVBAR_SIZES,
  BRAND_KIT_RADII,
  type BrandKitRadius,
  type PortfolioHeaderConfig,
} from "@/lib/page-builder/types";

// Block types that are containers (no text/video inputs in Content tab).
// Derived from the section-preset registry (33 keys) rather than hand-listed —
// every preset is a Container under the hood, so this also newly picks up
// VideoPreset, which the old hand-list omitted (a live bug: Video presets got
// the wrong toolkit tab set). Navigation preset keys are excluded — they render
// through NavigationBlock, are not Container-shaped, and carry no `_style`.
const CONTAINER_SECTION_KEYS = SECTION_PRESET_KEYS.filter(
  (key) => !(NAV_PRESET_KEYS as readonly string[]).includes(key)
);
export const CONTAINER_TYPES = new Set<string>(["Container", ...CONTAINER_SECTION_KEYS]);

// The actual Puck block type ("Navigation"), the insertable preset, and its
// render-only legacy aliases. ContentInputs must match on this set, not on
// NAV_PRESET_KEYS alone, since "Navigation" is never a SectionPresetKey (it's
// a separate registered block, not a section preset).
const NAV_CONFIG_TYPES = new Set<string>([
  "Navigation",
  ...(NAV_PRESET_KEYS as readonly string[]),
  ...(LEGACY_NAV_PRESET_KEYS as readonly string[]),
]);

const CONTENT_DESIGN_TABS: readonly BlockTab[] = ["content", "design"];
const ALL_BLOCK_TABS: readonly BlockTab[] = ["content", "design", "layout"];

export function blockTabsForType(type: string): readonly BlockTab[] {
  return type === "ContactDetails" || NAV_CONFIG_TYPES.has(type)
    ? CONTENT_DESIGN_TABS
    : ALL_BLOCK_TABS;
}

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
// CollectionCard renders its caption through the same hardcoded FeaturedCollectionsClient
// chrome as FeaturedWork (not driven by _style.textColorToken/fontFamily), so its
// typography controls would be dead the same way — included here for that reason.
const GALLERY_NO_TEXT_BLOCKS = new Set(["GalleryGrid", "GalleryMasonry", "FeaturedWork", "CollectionCard"]);
// Same membership as CONTAINER_TYPES today, but kept as a separate export:
// callers consult it for a different decision (flex vs. grid layout controls)
// and other code imports it by name. Nav keys excluded — see CONTAINER_TYPES.
export const FLEX_CONTAINER_BLOCKS = new Set<string>(["Container", ...CONTAINER_SECTION_KEYS]);

const COLLECTION_GALLERY_BLOCKS = new Set(["GalleryGrid", "GalleryMasonry"]);
const SLOT_GALLERY_PICKER_BLOCKS = new Set(["GalleryGrid", "GalleryMasonry"]);
const COLLECTION_CARD_RATIOS = ["7 / 9", "1 / 1", "4 / 5", "3 / 2", "16 / 9"] as const;

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

const CONTENT_HORIZONTAL_OPTIONS: { value: NonNullable<BlockStyle["contentHorizontalAlign"]>; label: string; Icon: LucideIcon }[] = [
  { value: "start",   label: "Content start",   Icon: AlignHorizontalJustifyStart },
  { value: "center",  label: "Content center",  Icon: AlignHorizontalJustifyCenter },
  { value: "end",     label: "Content end",     Icon: AlignHorizontalJustifyEnd },
  { value: "stretch", label: "Stretch content", Icon: Maximize2 },
];

const CONTENT_VERTICAL_OPTIONS: { value: NonNullable<BlockStyle["contentVerticalDistribution"]>; label: string; Icon: LucideIcon }[] = [
  { value: "start",   label: "Content top",      Icon: AlignVerticalJustifyStart },
  { value: "center",  label: "Content middle",   Icon: AlignVerticalJustifyCenter },
  { value: "end",     label: "Content bottom",   Icon: AlignVerticalJustifyEnd },
  { value: "between", label: "Spread apart",     Icon: AlignVerticalSpaceBetween },
  { value: "around",  label: "Spread evenly",    Icon: AlignVerticalSpaceAround },
];

const CELL_HORIZONTAL_OPTIONS: { value: NonNullable<BlockStyle["cellHorizontalAlign"]>; label: string; Icon: LucideIcon }[] = [
  { value: "stretch", label: "Fill cell width", Icon: Maximize2 },
  { value: "start",   label: "Cell start",      Icon: AlignHorizontalJustifyStart },
  { value: "center",  label: "Cell center",     Icon: AlignHorizontalJustifyCenter },
  { value: "end",     label: "Cell end",        Icon: AlignHorizontalJustifyEnd },
];

const CELL_VERTICAL_OPTIONS: { value: NonNullable<BlockStyle["cellVerticalAlign"]>; label: string; Icon: LucideIcon }[] = [
  { value: "stretch", label: "Fill cell height", Icon: Maximize2 },
  { value: "start",   label: "Cell top",         Icon: AlignVerticalJustifyStart },
  { value: "center",  label: "Cell middle",      Icon: AlignVerticalJustifyCenter },
  { value: "end",     label: "Cell bottom",      Icon: AlignVerticalJustifyEnd },
];

const CONTACT_ICON_ALIGN_OPTIONS: { value: NonNullable<BlockStyle["contactIconAlign"]>; label: string; Icon: LucideIcon }[] = [
  { value: "left",   label: "Align icons left",   Icon: AlignLeft },
  { value: "center", label: "Align icons center", Icon: AlignCenter },
  { value: "right",  label: "Align icons right",  Icon: AlignRight },
];

const BORDER_SIDE_OPTIONS: { value: BorderSide; label: string; Icon: LucideIcon }[] = [
  { value: "left", label: "Left border", Icon: PanelLeft },
  { value: "top", label: "Top border", Icon: PanelTop },
  { value: "bottom", label: "Bottom border", Icon: PanelBottom },
  { value: "right", label: "Right border", Icon: PanelRight },
];
const ALL_BORDER_SIDES: BorderSide[] = ["top", "right", "bottom", "left"];

const MIN_HEIGHT_OPTIONS = [
  { value: "auto",   label: "Auto" },
  { value: "short",  label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "tall",   label: "Tall" },
  { value: "custom", label: "Custom" },
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
  overlayOpacity,
  overlayColorToken,
  onOverlayOpacityChange,
  onOverlayColorChange,
}: {
  images: MediaPickerSelection[];
  onImagesChange: (v: MediaPickerSelection[]) => void;
  animation: string;
  speed: string;
  onAnimationChange: (v: string) => void;
  onSpeedChange: (v: string) => void;
  overlayOpacity: number | undefined;
  overlayColorToken: StyleColorToken | undefined;
  onOverlayOpacityChange: (v: number | undefined) => void;
  onOverlayColorChange: (v: StyleColorToken | undefined) => void;
}) {
  const showAnimation = images.length >= 2;
  // A scrim only tints something when there's a background image to tint —
  // with none, an "enabled" scrim control would do nothing (forbidden by the
  // control contract), so gate on the same images.length check.
  const showScrim = images.length >= 1;
  const demo = useDemoPicker();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Background images</span>
        {demo ? (
          <DemoMultiImageControl value={images} onChange={onImagesChange} max={12} />
        ) : (
          <MultiImageControl value={images} onChange={onImagesChange} max={12} />
        )}
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
      {showScrim && (
        <>
          <NumberInputRow
            label="Overlay opacity"
            value={overlayOpacity}
            min={0}
            max={100}
            suffix="%"
            effectiveValue={0}
            onChange={onOverlayOpacityChange}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Overlay color</span>
            {/* allowNone's "Reset color" clears to undefined — the legacy black
                scrim — rather than materializing a token. */}
            {/* ColorSwatchRow's onChange is widened to `string | undefined` for
                custom-hex callers; the scrim only ever accepts a palette token,
                so narrow it back here rather than widening the prop. */}
            <ColorSwatchRow
              value={overlayColorToken}
              onChange={(next) => onOverlayColorChange(next as StyleColorToken | undefined)}
            />
          </div>
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
  overlayOpacity: number | undefined;
  overlayColorToken: StyleColorToken | undefined;
  onOverlayOpacityChange: (v: number | undefined) => void;
  onOverlayColorChange: (v: StyleColorToken | undefined) => void;
};

export function BannerSection({
  s,
  set,
  container,
  hideBgImage = false,
  effectiveColorToken,
}: {
  s: BlockStyle;
  set: (p: Partial<BlockStyle>) => void;
  container?: ContainerBgControls | null;
  /** When true, suppresses all background-image pickers (gallery blocks: color only). */
  hideBgImage?: boolean;
  /** Render fallback shown without materializing a token into the block. */
  effectiveColorToken?: "background" | "foreground";
}) {
  const demo = useDemoPicker();
  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Banner
      </span>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Color</span>
        <ColorSwatchRow
          value={s.bgColorToken}
          effectiveValue={effectiveColorToken}
          onChange={(tok) => set({ bgColorToken: tok })}
        />
      </div>
      {!hideBgImage && (container ? (
        <ContainerBackgroundControls {...container} />
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Image</span>
          {demo ? (
            <DemoSingleImageControl
              value={s.bgImagePublicId ?? ""}
              onChange={(pid) => set({ bgImagePublicId: pid || undefined })}
            />
          ) : (
            <SingleImageControl
              value={s.bgImagePublicId ?? ""}
              onChange={(pid) => set({ bgImagePublicId: pid || undefined })}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Navigation block field panels — the full `PortfolioHeaderConfig` shape,
// split between Content and Design. The config lives on the block's OWN props,
// not `_style`, so both panels write through ContentInputs's setProp mechanism.
// ---------------------------------------------------------------------------

const NAV_SHADOW_LABELS: Record<string, string> = { none: "None", sm: "Small", md: "Medium", lg: "Large" };
const NAV_FONT_SIZE_LABELS: Record<string, string> = { sm: "Small", md: "Medium", lg: "Large" };
const NAV_NAVBAR_SIZE_LABELS: Record<string, string> = { sleek: "Sleek", balanced: "Balanced", flashy: "Flashy" };
const NAV_RADIUS_LABELS: Record<BrandKitRadius, string> = { sharp: "Sharp", subtle: "Subtle", rounded: "Rounded" };

const LOGO_MAX_BYTES = 250 * 1024;
const LOGO_MAX_WIDTH = 526;
const LOGO_MAX_HEIGHT = 256;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/**
 * The detach toggle's zone context. A single Puck instance only knows the
 * CURRENTLY-mounted zone's data — whether the OTHER zone (home vs gallery)
 * already holds a detached chrome block of this kind lives in EditorShell's
 * `zoneDataRef`, outside this component's reach. The caller resolves that via
 * `chromeSync.ts`'s `canDetach(zones, thisZone, "nav")` and passes the result
 * down; StyleToolkitField never reads EditorShell/Puck-zone state itself.
 */
export type NavDetachContext = {
  /** Label of the zone this Navigation instance renders in ("Home" | "Gallery") —
   *  shown in the toggle's own copy. */
  zoneLabel: string;
  /** Label of the OTHER zone — named in the disabled hint. */
  otherZoneLabel: string;
  /** True when the OTHER zone's nav is already detached — `!canDetach(zones, thisZone, "nav")`.
   *  Renders this toggle disabled with a hint naming `otherZoneLabel`. */
  disabled: boolean;
};

/**
 * Translate function for the detach toggle's copy — structurally the same
 * shape as editorConfig.tsx's `PuckTranslate` (real next-intl `t` at runtime),
 * widened here with an optional `values` param for the `{page}` ICU
 * placeholder in `chromeDetachToggleLabel`/`chromeDetachDisabledHint`. Not
 * imported from editorConfig.tsx to avoid a circular import (that file
 * imports this one).
 */
export type NavDetachTranslate = (key: string, values?: Record<string, string | number>) => string;

// English fallback — used when no `t` is supplied (tests, and any caller that
// hasn't wired next-intl yet). Text matches messages/en.json's
// chromeDetachToggleLabel/chromeDetachHint/chromeDetachDisabledHint exactly.
const NAV_DETACH_EN_FALLBACK: Record<string, string> = {
  chromeDetachToggleLabel: "Detach header on {page}",
  chromeDetachHint: "Detached headers style independently and stop mirroring the other page.",
  chromeDetachDisabledHint: "{page} already has a detached header — only one page can detach at a time.",
};

function navDetachFallbackT(key: string, values?: Record<string, string | number>): string {
  const template = NAV_DETACH_EN_FALLBACK[key] ?? key;
  return values ? template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? "")) : template;
}

function NavColorRow({
  label,
  value,
  onChange,
  effectiveValue,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  effectiveValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <ColorSwatchRow value={value} onChange={onChange} effectiveValue={effectiveValue} />
    </div>
  );
}

function NavRadiusRow({
  label,
  value,
  onChange,
  effectiveValue,
}: {
  label: string;
  value: BrandKitRadius | "" | undefined;
  onChange: (v: BrandKitRadius | "") => void;
  effectiveValue?: BrandKitRadius;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex">
        {BRAND_KIT_RADII.map((radius) => {
          const isExplicit = value === radius;
          const isEffective = !value && effectiveValue === radius;
          return (
            <button
              key={radius}
              type="button"
              aria-pressed={isExplicit || isEffective}
              onClick={() => onChange(isExplicit ? "" : radius)}
              className={cn(
                "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isExplicit && "bg-foreground text-background hover:bg-foreground",
                isEffective && "border-foreground opacity-70",
              )}
            >
              {NAV_RADIUS_LABELS[radius]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NavigationLogoUpload({
  logoUrl,
  onChange,
}: {
  logoUrl: string | undefined;
  onChange: (next: { logoUrl: string; logoAssetId: string }) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const result = await uploadAsset(
        file,
        {
          acceptedTypes: LOGO_TYPES,
          maxBytes: LOGO_MAX_BYTES,
          maxWidth: LOGO_MAX_WIDTH,
          maxHeight: LOGO_MAX_HEIGHT,
        },
        { subfolder: "portfolio_header", delivery: { width: 526, height: 256, fit: "scale-down" } },
      );
      if ("error" in result) {
        switch (result.error) {
          case "type_not_accepted": setError("PNG, JPEG, or WEBP only."); break;
          case "file_too_large": setError("Logo must be under 250KB."); break;
          case "dimensions_too_large": setError("Logo must be at most 526×256px."); break;
          case "invalid_image": setError("Could not read that image."); break;
        }
        return;
      }
      onChange({ logoUrl: result.asset.url, logoAssetId: result.asset.assetId });
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5" data-tour-id="logo-uploader">
      <span className="text-xs text-muted-foreground">Logo</span>
      {logoUrl ? (
        <div className="flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt="Logo preview"
            className="h-12 w-auto max-w-full border border-border object-contain"
          />
          <button
            type="button"
            onClick={() => onChange({ logoUrl: "", logoAssetId: "" })}
            className="w-fit text-xs text-muted-foreground underline hover:text-foreground"
          >
            Remove logo
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex min-h-24 flex-col items-center justify-center gap-2 border border-dashed border-border bg-background px-3 text-center text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
        >
          <Upload className="size-3.5" aria-hidden />
          <span>{uploading ? "Uploading…" : "Upload logo"}</span>
          <span>PNG, JPEG, or WEBP · under 250KB · up to 526×256px</span>
        </button>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          setError(null);
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function NavigationContentPanel({
  config,
  setProp,
  setProps,
  navDetach,
  detached,
  overallWidth,
  t = navDetachFallbackT,
}: {
  config: PortfolioHeaderConfig;
  setProp: (key: string, val: unknown) => void;
  setProps?: (patch: Record<string, unknown>) => void;
  navDetach?: NavDetachContext;
  detached: boolean;
  /** Layout: "page-fit" clamps the inner nav row to 80rem; "full" (the chrome
   *  default — see NavigationBlock) spans the header's full width. Unset shows
   *  Full as the effective default (Navigation is always `_chrome: "nav"`). */
  overallWidth?: "page-fit" | "full";
  t?: NavDetachTranslate;
}) {
  const set = <K extends keyof PortfolioHeaderConfig>(key: K, value: PortfolioHeaderConfig[K]) =>
    setProp(key, value);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-foreground">Brand</span>
        <ChoiceRow
          label="Navbar size"
          value={config.navbarSize || "balanced"}
          options={HEADER_NAVBAR_SIZES.map((v) => ({ value: v, label: NAV_NAVBAR_SIZE_LABELS[v] }))}
          onChange={(v) => set("navbarSize", v === "balanced" ? "" : v)}
        />
        <NavigationLogoUpload
          logoUrl={bgImageUrl(navigationLogoAssetId(config as Record<string, unknown>)) ?? undefined}
          onChange={({ logoAssetId }) => {
            setProps?.(navigationLogoPatch(config as Record<string, unknown>, logoAssetId));
          }}
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <span className="text-xs font-medium uppercase tracking-wide text-foreground">Banner</span>
        <NavColorRow label="Background color" value={config.backgroundColor} onChange={(v) => set("backgroundColor", v)} effectiveValue="background" />
        <NumberInputRow label="Background opacity" value={config.backgroundOpacity} min={0} max={100} suffix="%" effectiveValue={100} onChange={(v) => set("backgroundOpacity", v)} />
        <NumberInputRow label="Bottom border" value={config.borderBottomWidth} min={0} max={8} effectiveValue={1} onChange={(v) => set("borderBottomWidth", v)} />
        {!!config.borderBottomWidth && (
          <NavColorRow label="Border color" value={config.borderBottomColor} onChange={(v) => set("borderBottomColor", v)} />
        )}
        <ChoiceRow
          label="Shadow"
          value={config.shadowSize || "none"}
          options={HEADER_SHADOW_SIZES.map((v) => ({ value: v, label: NAV_SHADOW_LABELS[v] }))}
          onChange={(v) => set("shadowSize", v === "none" ? "" : v)}
        />
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">Overall width</span>
          <div className="flex items-center gap-1.5">
            {(["page-fit", "full"] as const).map((v) => {
              const label = v === "page-fit" ? "Page fit" : "Full";
              const isActive = overallWidth === v || (overallWidth === undefined && v === "full");
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setProp("overallWidth", v)}
                  className={cn(
                    "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    isActive && "bg-foreground text-background hover:bg-foreground"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <span className="text-xs font-medium uppercase tracking-wide text-foreground">Sync</span>
        <HighlightToggle
          label={t("chromeDetachToggleLabel", { page: navDetach?.zoneLabel ?? "this page" })}
          on={detached}
          onToggle={() => setProp("detached", !detached)}
          disabled={navDetach?.disabled}
        />
        <p className="text-xs text-muted-foreground">
          {navDetach?.disabled
            ? t("chromeDetachDisabledHint", { page: navDetach.otherZoneLabel })
            : t("chromeDetachHint")}
        </p>
      </div>
    </div>
  );
}

export function NavigationDesignPanel({
  config,
  setProp,
}: {
  config: PortfolioHeaderConfig;
  setProp: (key: string, val: unknown) => void;
}) {
  const effectiveRadius = useBrandRadius();
  const set = <K extends keyof PortfolioHeaderConfig>(key: K, value: PortfolioHeaderConfig[K]) =>
    setProp(key, value);

  return (
    <EditorDrawerGroup>
      <EditorDrawerSection title="Links">
        <ChoiceRow
          label="Font size"
          value={config.fontSize || "md"}
          options={HEADER_FONT_SIZES.map((v) => ({ value: v, label: NAV_FONT_SIZE_LABELS[v] }))}
          onChange={(v) => set("fontSize", v === "md" ? "" : v)}
        />
        <NavColorRow label="Brand text color" value={config.brandTextColor} onChange={(v) => set("brandTextColor", v)} effectiveValue="foreground" />
        <NavColorRow label="Inactive link color" value={config.linkColor} onChange={(v) => set("linkColor", v)} effectiveValue="foreground" />
        <ChoiceRow
          label="Scale active link"
          value={config.activeLinkScale ? "on" : "off"}
          options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]}
          onChange={(v) => set("activeLinkScale", v === "on")}
        />
        <ChoiceRow
          label="Highlight active link"
          value={config.activeLinkHighlight ? "on" : "off"}
          options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]}
          onChange={(v) => set("activeLinkHighlight", v === "on")}
        />
        <ChoiceRow
          label="Underline active link"
          value={config.activeLinkUnderline !== false ? "on" : "off"}
          options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]}
          onChange={(v) => set("activeLinkUnderline", v === "on" ? undefined : false)}
        />
        <NavColorRow label="Active link color" value={config.activeLinkColor} onChange={(v) => set("activeLinkColor", v)} effectiveValue="foreground" />
        {config.activeLinkHighlight && (
          <>
            <NavColorRow label="Highlight color" value={config.highlightColor} onChange={(v) => set("highlightColor", v)} effectiveValue="foreground" />
            <NumberInputRow label="Highlight opacity" value={config.highlightOpacity} min={0} max={100} suffix="%" effectiveValue={8} onChange={(v) => set("highlightOpacity", v)} />
            <NavRadiusRow label="Highlight radius" value={config.activeLinkRadius} onChange={(v) => set("activeLinkRadius", v)} effectiveValue={effectiveRadius} />
          </>
        )}
        {config.activeLinkUnderline !== false && (
          <NavColorRow label="Underline color" value={config.underlineColor} onChange={(v) => set("underlineColor", v)} effectiveValue="accent" />
        )}
      </EditorDrawerSection>

      <EditorDrawerSection title="Contact button">
        <NavColorRow label="Fill color" value={config.contactButtonColor} onChange={(v) => set("contactButtonColor", v)} effectiveValue="primary" />
        <NumberInputRow label="Fill opacity" value={config.contactButtonOpacity} min={0} max={100} suffix="%" effectiveValue={100} onChange={(v) => set("contactButtonOpacity", v)} />
        <NavColorRow label="Text color" value={config.contactButtonTextColor} onChange={(v) => set("contactButtonTextColor", v)} effectiveValue="background" />
        <NavRadiusRow label="Corner radius" value={config.contactButtonRadius} onChange={(v) => set("contactButtonRadius", v)} effectiveValue={effectiveRadius} />
      </EditorDrawerSection>
    </EditorDrawerGroup>
  );
}

export function ContentInputs({
  type,
  props,
  setProp,
  setProps,
  navDetach,
  t,
}: {
  type: string;
  props: Record<string, unknown>;
  setProp: (key: string, val: unknown) => void;
  setProps?: (patch: Record<string, unknown>) => void;
  /** Only read when `type` is one of NAV_CONFIG_TYPES — see NavDetachContext. */
  navDetach?: NavDetachContext;
  /** Only read when `type` is one of NAV_CONFIG_TYPES — the detach toggle's copy. */
  t?: NavDetachTranslate;
}) {
  const demo = useDemoPicker();
  if (type === "Heading") {
    return (
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>Text</span>
          <input
            type="text"
            value={(props.text as string) ?? ""}
            onChange={(e) => setProp("text", e.target.value)}
            className="h-9 border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </label>
        <HeadingLevelButtons
          value={props.level as string}
          onChange={(v) => setProp("level", v)}
        />
      </div>
    );
  }
  if (type === "Image") {
    const imageStyle = props._style as BlockStyle | undefined;
    return (
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>Alt text</span>
          <input
            type="text"
            value={(props.alt as string) ?? ""}
            onChange={(e) => setProp("alt", e.target.value)}
            className="h-9 border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </label>
        <ImageBlockMetaSection assetId={imageStyle?.bgImagePublicId} />
      </div>
    );
  }
  if (type === "Text") {
    return (
      <label className="flex flex-col gap-1 text-sm">
        <span>Text</span>
        <textarea
          rows={4}
          value={(props.text as string) ?? ""}
          onChange={(e) => setProp("text", e.target.value)}
          className="border border-border bg-background px-2 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </label>
    );
  }
  if (type === "Button") {
    return (
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>Button text</span>
          <input
            type="text"
            value={(props.label as string) ?? ""}
            onChange={(e) => setProp("label", e.target.value)}
            className="h-9 border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </label>
        <label className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">Action</span>
          <select
            value={(props.action as string) ?? "open-contact"}
            onChange={(e) => setProp("action", e.target.value)}
            className="h-7 flex-1 cursor-pointer border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="open-contact">Open contact form</option>
            <option value="go-to-gallery">Go to Gallery page</option>
            <option value="go-to-home">Go to Home page</option>
          </select>
        </label>
      </div>
    );
  }
  if (SLOT_GALLERY_PICKER_BLOCKS.has(type)) {
    const legacyImages = Array.isArray(props.images) ? props.images : [];
    if (legacyImages.length > 0) return null;
    const selections = gallerySlotSelections(type, props);
    const assign = (next: MediaPickerSelection[]) => setProps?.(gallerySlotPatch(type, props, next));
    // GalleryGrid and GalleryMasonry are images-only — expose the Photos picker.
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Photos</span>
          {demo ? (
            <DemoMultiImageControl
              value={selections}
              onChange={assign}
              max={60}
            />
          ) : (
            <MultiImageControl
              value={selections}
              onChange={assign}
              max={null}
            />
          )}
        </div>
      </div>
    );
  }
  if (type === "FeaturedWork") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Collections</span>
          {demo ? (
            <p className="text-xs text-muted-foreground">
              Collections aren&apos;t available in this demo. Sign up free to organize photos into collections.
            </p>
          ) : (
            <MultiCollectionControl
              value={(props.collections as CollectionRef[]) ?? []}
              onChange={(v) => setProp("collections", v)}
            />
          )}
        </div>
      </div>
    );
  }
  if (type === "CollectionCard") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Collection</span>
          {demo ? (
            <p className="text-xs text-muted-foreground">
              Collections aren&apos;t available in this demo. Sign up free to organize photos into collections.
            </p>
          ) : (
            <SingleCollectionControl
              value={props.collection as CollectionRef | undefined}
              onChange={(v) => setProp("collection", v)}
            />
          )}
        </div>
        <ChoiceRow
          label="Crop"
          value={(props.aspectRatio as string | undefined) ?? "7 / 9"}
          options={COLLECTION_CARD_RATIOS.map((value) => ({ value, label: value.replace(/ /g, "") }))}
          onChange={(v) => setProp("aspectRatio", v)}
        />
        <ChoiceRow
          label="Caption"
          value={(props.showCaption as boolean | undefined) === false ? "hide" : "show"}
          options={[{ value: "show", label: "Show" }, { value: "hide", label: "Hide"}]}
          onChange={(v) => setProp("showCaption", v === "show")}
        />
      </div>
    );
  }
  if (NAV_CONFIG_TYPES.has(type)) {
    return (
      <NavigationContentPanel
        config={props as PortfolioHeaderConfig}
        setProp={setProp}
        setProps={setProps}
        navDetach={navDetach}
        detached={!!(props as { detached?: boolean }).detached}
        overallWidth={(props as { overallWidth?: "page-fit" | "full" }).overallWidth}
        t={t}
      />
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
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Columns</span>
          <CountControl
            value={props.columns as number | undefined}
            onChange={(v) => setProp("columns", v ?? 1)}
            quickValues={[1, 2]}
            min={1}
            max={2}
            allowAuto={false}
            hideInput
          />
        </div>
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
          label="Instagram username"
          placeholder="yourhandle"
          value={(props.instagram as string) ?? ""}
          onChange={(v) => setProp("instagram", v)}
        />
        <FloatingLabelInput
          label="Facebook username"
          placeholder="your.page"
          value={(props.facebook as string) ?? ""}
          onChange={(v) => setProp("facebook", v)}
        />
        <FloatingLabelInput
          label="TikTok username"
          placeholder="yourhandle"
          value={(props.tiktok as string) ?? ""}
          onChange={(v) => setProp("tiktok", v)}
        />
        <FloatingLabelInput
          label="Website URL"
          placeholder="yoursite.com"
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
  setProps,
  showBanner,
  isContainer,
  navDetach,
  t,
}: {
  s: BlockStyle;
  set: (patch: Partial<BlockStyle>) => void;
  type: string;
  p: Record<string, unknown> | undefined;
  setProp: (key: string, val: unknown) => void;
  setProps?: (patch: Record<string, unknown>) => void;
  showBanner: boolean;
  isContainer: boolean;
  navDetach?: NavDetachContext;
  t?: NavDetachTranslate;
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
          overlayOpacity: p.overlayOpacity as number | undefined,
          overlayColorToken: p.overlayColorToken as StyleColorToken | undefined,
          onOverlayOpacityChange: (v) => setProp("overlayOpacity", v),
          onOverlayColorChange: (v) => setProp("overlayColorToken", v),
        }
      : null;
  // Gallery container blocks need both the banner AND their gallery-specific content inputs
  // (collections picker / photo picker) — unlike true containers (slots), they have
  // direct gallery content controlled via ContentInputs.
  const showContentInputs = !isContainer || GALLERY_CONTAINER_BLOCKS.has(type);
  // GalleryGrid/GalleryMasonry dropped background images entirely — the images
  // are the block content, not a backdrop — so they never show the picker and
  // always resolve to the plain background swatch. FeaturedWork still supports
  // a background-image banner and keeps the picker + foreground/background swap.
  const hideBgImage = SLOT_GALLERY_PICKER_BLOCKS.has(type);
  const hasBackgroundImages =
    Array.isArray(p?.backgroundImages) && (p.backgroundImages as unknown[]).length > 0;
  const effectiveBannerColor = SLOT_GALLERY_PICKER_BLOCKS.has(type)
    ? "background"
    : GALLERY_CONTAINER_BLOCKS.has(type)
      ? hasBackgroundImages
        ? "foreground"
        : "background"
      : isContainer && hasBackgroundImages
        ? "foreground"
        : undefined;
  return (
    <div className="flex flex-col gap-4 p-3">
      {showBanner && (
        <BannerSection
          s={s}
          set={set}
          container={container}
          hideBgImage={hideBgImage}
          effectiveColorToken={effectiveBannerColor}
        />
      )}
      {showContentInputs && p && (
        <ContentInputs type={type} props={p} setProp={setProp} setProps={setProps} navDetach={navDetach} t={t} />
      )}
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

function CollectionCardCaptionControls({
  target,
  s,
  set,
  effectiveFontFamily,
}: {
  target: "title" | "subtitle";
  s: BlockStyle;
  set: (patch: Partial<BlockStyle>) => void;
  effectiveFontFamily: BlockStyle["fontFamily"];
}) {
  const title = target === "title";
  const prefix = title ? "collectionTitle" : "collectionSubtitle";
  const bold = title ? s.collectionTitleBold : s.collectionSubtitleBold;
  const italic = title ? s.collectionTitleItalic : s.collectionSubtitleItalic;
  const underline = title ? s.collectionTitleUnderline : s.collectionSubtitleUnderline;
  const align = title ? s.collectionTitleAlign : s.collectionSubtitleAlign;
  const fontFamily = title ? s.collectionTitleFontFamily : s.collectionSubtitleFontFamily;
  const fontSize = title ? s.collectionTitleFontSize : s.collectionSubtitleFontSize;
  const color = title ? s.collectionTitleColorToken : s.collectionSubtitleColorToken;
  const setTarget = (key: "Bold" | "Italic" | "Underline" | "Align" | "FontFamily" | "FontSize" | "ColorToken", value: unknown) =>
    set({ [`${prefix}${key}`]: value } as Partial<BlockStyle>);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <ToolbarToggle active={!!bold} title="Bold" Icon={Bold} onClick={() => setTarget("Bold", !bold)} />
        <ToolbarToggle active={!!italic} title="Italic" Icon={Italic} onClick={() => setTarget("Italic", !italic)} />
        <ToolbarToggle active={!!underline} title="Underline" Icon={Underline} onClick={() => setTarget("Underline", !underline)} />
        <ToolbarToggle active={align === "left"} title="Align left" Icon={AlignLeft} onClick={() => setTarget("Align", align === "left" ? undefined : "left")} />
        <ToolbarToggle active={align === "center"} title="Align center" Icon={AlignCenter} onClick={() => setTarget("Align", align === "center" ? undefined : "center")} />
        <ToolbarToggle active={align === "right"} title="Align right" Icon={AlignRight} onClick={() => setTarget("Align", align === "right" ? undefined : "right")} />
      </div>
      <ColorSwatchRow
        value={color}
        effectiveValue="foreground"
        onChange={(value) => setTarget("ColorToken", value)}
      />
      <FontFamilyRow value={fontFamily} effectiveValue={effectiveFontFamily} onChange={(value) => setTarget("FontFamily", value)} />
      <NumberInputRow
        label="Font size"
        value={fontSize}
        min={STYLE_LIMITS.fontSize.min}
        max={STYLE_LIMITS.fontSize.max}
        effectiveValue={title ? 16 : 14}
        onChange={(value) => setTarget("FontSize", value)}
      />
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
  disabled = false,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          "relative inline-flex h-5 w-9 cursor-pointer items-center border border-border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
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

function BorderSideControls({
  s,
  set,
}: {
  s: BlockStyle;
  set: (patch: Partial<BlockStyle>) => void;
}) {
  // `borderPreset` is read-only legacy draft support. All new choices use the
  // set so users can combine sides instead of replacing their last choice.
  const selectedSides = s.borderSides ?? (
    s.borderPreset && s.borderPreset !== "all" ? [s.borderPreset] : ALL_BORDER_SIDES
  );
  const isFull = selectedSides.length === ALL_BORDER_SIDES.length;

  function save(sides: BorderSide[]) {
    // Side controls must never appear to do nothing: make a visible 1px border
    // unless the user has already made an explicit non-zero width choice.
    set({
      borderSides: sides,
      borderPreset: undefined,
      ...(s.borderWidth && s.borderWidth > 0 ? {} : { borderWidth: 1 }),
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="min-w-0 break-words text-xs text-muted-foreground">Border sides</span>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <ToolbarToggle
          active={isFull}
          title="Full border"
          Icon={Square}
          onClick={() => save(ALL_BORDER_SIDES)}
        />
        {BORDER_SIDE_OPTIONS.map(({ value, label, Icon }) => (
          <ToolbarToggle
            key={value}
            active={!isFull && selectedSides.includes(value)}
            title={label}
            Icon={Icon}
            onClick={() => {
              // Choosing a side from Full intentionally starts a fresh set;
              // further side clicks build that set one edge at a time.
              if (isFull) {
                save([value]);
                return;
              }
              save(selectedSides.includes(value)
                ? selectedSides.filter((side) => side !== value)
                : [...selectedSides, value]);
            }}
          />
        ))}
        <ResetButton onClick={() => set({ borderSides: undefined, borderPreset: undefined })} label="Border sides" />
      </div>
    </div>
  );
}

export function DesignTab({
  s,
  set,
  blockType = "",
  p,
}: {
  s: BlockStyle;
  set: (p: Partial<BlockStyle>) => void;
  blockType?: string;
  p?: Record<string, unknown>;
}) {
  const isButton = blockType === "Button";
  const isLinkButton = s.buttonStyle === "link";
  const isSolidButton = s.buttonStyle === "solid";
  const isContactDetails = blockType === "ContactDetails";
  const isCollectionCard = blockType === "CollectionCard";
  const showFrame = !NO_FRAME_BLOCKS.has(blockType);
  const effectiveRadius = useEffectiveBrandRadius();
  // Image-only gallery blocks (and the Image block itself) have no on-page text.
  // CollectionCard owns separate Collection title and Photo count controls, so
  // its generic typography drawer would edit unrelated legacy style fields.
  const showTypography = !GALLERY_NO_TEXT_BLOCKS.has(blockType)
    && blockType !== "Image"
    && blockType !== "CollectionCard";
  // Heading blocks follow the brand heading font; all others follow the body font.
  // ponytail: "body" covers Text, Button, Container, and all other block types since
  // only Heading maps to --pf-font-heading; everything else inherits body via CSS.
  const effectiveFontFamily = useEffectiveBrandFont(blockType === "Heading" ? "heading" : "body");
  // ContactDetails: local state for Labels/Inputs tab switcher in the design drawer.
  const [contactTab, setContactTab] = useState<"labels" | "inputs">("labels");

  return (
    <EditorDrawerGroup>
      {/* ContactDetails: per-target typography (Labels / Inputs) + Icons */}
      {isContactDetails && (
        <>
          <EditorDrawerSection title="Typography">
            <div className="flex items-center gap-1.5">
              {(["labels", "inputs"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  aria-pressed={contactTab === tab}
                  onClick={() => setContactTab(tab)}
                  className={cn(
                    "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background px-2 text-xs font-medium text-foreground capitalize transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    contactTab === tab && "bg-foreground text-background hover:bg-foreground"
                  )}
                >
                  {tab === "labels" ? "Labels" : "Inputs"}
                </button>
              ))}
            </div>
            {contactTab === "labels" && (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <ToolbarToggle active={!!s.labelBold} title="Bold" Icon={Bold} onClick={() => set({ labelBold: !s.labelBold })} />
                  <ToolbarToggle active={!!s.labelItalic} title="Italic" Icon={Italic} onClick={() => set({ labelItalic: !s.labelItalic })} />
                  <ToolbarToggle active={!!s.labelUnderline} title="Underline" Icon={Underline} onClick={() => set({ labelUnderline: !s.labelUnderline })} />
                  <ToolbarToggle active={s.labelAlign === "left"} title="Align left" Icon={AlignLeft} onClick={() => set({ labelAlign: s.labelAlign === "left" ? undefined : "left" })} />
                  <ToolbarToggle active={s.labelAlign === "center"} title="Align center" Icon={AlignCenter} onClick={() => set({ labelAlign: s.labelAlign === "center" ? undefined : "center" })} />
                  <ToolbarToggle active={s.labelAlign === "right"} title="Align right" Icon={AlignRight} onClick={() => set({ labelAlign: s.labelAlign === "right" ? undefined : "right" })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <Baseline className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="text-xs text-muted-foreground">Label color</span>
                  </div>
                  <ColorSwatchRow value={s.labelColorToken} effectiveValue="foreground" onChange={(t) => set({ labelColorToken: t })} />
                </div>
                <FontFamilyRow value={s.labelFontFamily} effectiveValue={effectiveFontFamily} onChange={(v) => set({ labelFontFamily: v })} />
                <NumberInputRow label="Font size" value={s.labelFontSize} min={STYLE_LIMITS.fontSize.min} max={STYLE_LIMITS.fontSize.max} effectiveValue={11} onChange={(v) => set({ labelFontSize: v })} />
              </>
            )}
            {contactTab === "inputs" && (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <ToolbarToggle active={!!s.valueBold} title="Bold" Icon={Bold} onClick={() => set({ valueBold: !s.valueBold })} />
                  <ToolbarToggle active={!!s.valueItalic} title="Italic" Icon={Italic} onClick={() => set({ valueItalic: !s.valueItalic })} />
                  <ToolbarToggle active={!!s.valueUnderline} title="Underline" Icon={Underline} onClick={() => set({ valueUnderline: !s.valueUnderline })} />
                  <ToolbarToggle active={s.valueAlign === "left"} title="Align left" Icon={AlignLeft} onClick={() => set({ valueAlign: s.valueAlign === "left" ? undefined : "left" })} />
                  <ToolbarToggle active={s.valueAlign === "center"} title="Align center" Icon={AlignCenter} onClick={() => set({ valueAlign: s.valueAlign === "center" ? undefined : "center" })} />
                  <ToolbarToggle active={s.valueAlign === "right"} title="Align right" Icon={AlignRight} onClick={() => set({ valueAlign: s.valueAlign === "right" ? undefined : "right" })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <Baseline className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="text-xs text-muted-foreground">Value color</span>
                  </div>
                  <ColorSwatchRow value={s.valueColorToken} effectiveValue="foreground" onChange={(t) => set({ valueColorToken: t })} />
                </div>
                <FontFamilyRow value={s.valueFontFamily} effectiveValue={effectiveFontFamily} onChange={(v) => set({ valueFontFamily: v })} />
                <NumberInputRow label="Font size" value={s.valueFontSize} min={STYLE_LIMITS.fontSize.min} max={STYLE_LIMITS.fontSize.max} effectiveValue={15} onChange={(v) => set({ valueFontSize: v })} />
              </>
            )}
          </EditorDrawerSection>
          <EditorDrawerSection title="Icons">
            <NumberInputRow label="Icon size" value={s.iconSize} min={12} max={64} effectiveValue={20} onChange={(v) => set({ iconSize: v })} />
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <Baseline className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="text-xs text-muted-foreground">Icon color</span>
              </div>
              <ColorSwatchRow value={s.iconColorToken} effectiveValue="foreground" onChange={(t) => set({ iconColorToken: t })} />
            </div>
            <IconRow
              label="Icon align"
              value={s.contactIconAlign}
              options={CONTACT_ICON_ALIGN_OPTIONS}
              effectiveValue={s.valueAlign ?? "center"}
              onChange={(v) => set({ contactIconAlign: v })}
            />
          </EditorDrawerSection>
        </>
      )}
      {isCollectionCard && (
        <>
          <EditorDrawerSection title="Card">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Card background</span>
              <ColorSwatchRow
                value={s.bgColorToken}
                effectiveValue="background"
                onChange={(value) => set({ bgColorToken: value })}
              />
            </div>
          </EditorDrawerSection>
          <EditorDrawerSection title="Collection title">
            <CollectionCardCaptionControls target="title" s={s} set={set} effectiveFontFamily={effectiveFontFamily} />
          </EditorDrawerSection>
          <EditorDrawerSection title="Photo count">
            <CollectionCardCaptionControls target="subtitle" s={s} set={set} effectiveFontFamily={effectiveFontFamily} />
          </EditorDrawerSection>
        </>
      )}
      {/* Typography drawer — blocks without dedicated per-target text controls */}
      {!isContactDetails && showTypography && (
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
          {/* When fontFamily is unset, show the effective brand font as selected
              (lighter opacity = "following theme"). Editing writes the real _style.
              Curated self-hosted keys, a Google Fonts shortlist, and free-text entry
              of any other Google Fonts family name all resolve through the same
              PortfolioFontSelection value (see lib/page-builder/fonts.ts). */}
          <FontFamilyRow
            value={s.fontFamily}
            effectiveValue={effectiveFontFamily}
            onChange={(v) => set({ fontFamily: v })}
          />
          {blockType !== "Heading" && (
            <NumberInputRow
              label="Font size"
              value={s.fontSize}
              min={STYLE_LIMITS.fontSize.min}
              max={STYLE_LIMITS.fontSize.max}
              // Text/container typography inherits the 16px page base. Buttons
              // use the concrete 13/15/18px size selected by their block prop.
              effectiveValue={
                isButton
                  ? BUTTON_SIZE_FONT_PX[
                      ((p?.size as "sm" | "md" | "lg" | undefined) ?? "md")
                    ]
                  : 16
              }
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
          {!isLinkButton && <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <PaintBucket className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="text-xs text-muted-foreground">Button color</span>
            </div>
            <ColorSwatchRow
              value={s.buttonColorToken}
              effectiveValue={s.buttonStyle ? "primary" : "foreground"}
              onChange={(t) => set({ buttonColorToken: t })}
            />
          </div>}
          {/* 2. Button opacity — effective 100 when unset (prop stays unset until edited) */}
          {isSolidButton && <NumberInputRow
            label="Button opacity"
            value={s.buttonOpacity}
            min={0}
            max={100}
            suffix="%"
            effectiveValue={100}
            onChange={(v) => set({ buttonOpacity: v })}
          />}
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
          {!isLinkButton && (
            <RadiusButtons value={s.radius} onChange={(v) => set({ radius: v })} effectiveValue={effectiveRadius} />
          )}
          {/* 5. Button style */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Button style</span>
            <div className="flex items-center gap-1.5">
              {(["solid", "outline", "soft", "link"] as const).map((v) => {
                const isExplicit = s.buttonStyle === v;
                const isEffective =
                  s.buttonStyle === undefined &&
                  s.buttonColorToken === undefined &&
                  v === "outline";
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={isExplicit || isEffective}
                    onClick={() => set({ buttonStyle: isExplicit ? undefined : v })}
                    className={cn(
                      "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      isExplicit && "bg-foreground text-background hover:bg-foreground",
                      isEffective && "border-foreground opacity-70",
                    )}
                  >
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                );
              })}
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
          <BorderSideControls s={s} set={set} />
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

function CellLayoutControls({
  s,
  set,
  parentColumnsCount,
  parentRowsCount,
}: {
  s: BlockStyle;
  set: (patch: Partial<BlockStyle>) => void;
  parentColumnsCount?: number;
  parentRowsCount?: number;
}) {
  const legacyHorizontal =
    s.justifyContent === "start" || s.justifyContent === "center" || s.justifyContent === "end"
      ? s.justifyContent
      : "stretch";
  const legacyVertical = s.alignItems ?? "stretch";

  return (
    <>
      <ColSpanRowSpanControls
        s={s}
        set={set}
        parentColumnsCount={parentColumnsCount}
        parentRowsCount={parentRowsCount}
      />
      <IconRow
        label="Cell horizontal"
        value={s.cellHorizontalAlign}
        options={CELL_HORIZONTAL_OPTIONS}
        effectiveValue={legacyHorizontal}
        onChange={(v) => set({ cellHorizontalAlign: v })}
        onReset={() => set({ cellHorizontalAlign: undefined })}
      />
      <IconRow
        label="Cell vertical"
        value={s.cellVerticalAlign}
        options={CELL_VERTICAL_OPTIONS}
        effectiveValue={legacyVertical}
        onChange={(v) => set({ cellVerticalAlign: v })}
        onReset={() => set({ cellVerticalAlign: undefined })}
      />
    </>
  );
}

function ContentLayoutControls({
  s,
  set,
  p,
}: {
  s: BlockStyle;
  set: (patch: Partial<BlockStyle>) => void;
  p?: Record<string, unknown>;
}) {
  const legacyHorizontal = s.align
    ? ({ left: "start", center: "center", right: "end" } as const)[s.align]
    : s.alignItems === "stretch"
      ? ({ left: "start", center: "center", right: "end" } as const)[
          (p?.alignX as "left" | "center" | "right" | undefined) ?? "left"
        ]
      : s.alignItems ?? ({ left: "start", center: "center", right: "end" } as const)[
          (p?.alignX as "left" | "center" | "right" | undefined) ?? "left"
        ];
  const legacyVertical = s.justifyContent ??
    ({ top: "start", center: "center", bottom: "end" } as const)[
      (p?.alignY as "top" | "center" | "bottom" | undefined) ?? "top"
    ];

  return (
    <>
      <IconRow
        label="Content alignment"
        value={s.contentHorizontalAlign}
        options={CONTENT_HORIZONTAL_OPTIONS}
        effectiveValue={legacyHorizontal}
        onChange={(v) => set({ contentHorizontalAlign: v })}
        onReset={() => set({ contentHorizontalAlign: undefined })}
      />
      <IconRow
        label="Content distribution"
        value={s.contentVerticalDistribution}
        options={CONTENT_VERTICAL_OPTIONS}
        effectiveValue={legacyVertical}
        onChange={(v) => set({ contentVerticalDistribution: v })}
        onReset={() => set({ contentVerticalDistribution: undefined })}
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
  p,
  setProp,
}: {
  type: string;
  s: BlockStyle;
  set: (patch: Partial<BlockStyle>) => void;
  p?: Record<string, unknown>;
  setProp?: (key: string, val: unknown) => void;
}) {
  if (COLLECTION_GALLERY_BLOCKS.has(type)) {
    const masonryUsesColumnLanes = type === "GalleryMasonry" && p?.masonryLayout !== "flow";
    const activeMasonryColumns = s.galleryColumns ?? 3;
    const masonryLoopEligible = masonryUsesColumnLanes && Array.from({ length: activeMasonryColumns }, (_, index) =>
      Array.isArray(p?.[`column${index + 1}`])
      && (p?.[`column${index + 1}`] as Array<{ type?: string }>).filter((item) => item.type === "Image").length >= 3,
    ).every(Boolean);
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
              const hasImagesInHiddenLane = masonryUsesColumnLanes && Array.from({ length: 4 - value }, (_, index) =>
                Array.isArray(p?.[`column${value + index + 1}`])
                && (p?.[`column${value + index + 1}`] as Array<{ type?: string }>).some((item) => item.type === "Image"),
              ).some(Boolean);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={isExplicit || isEffective}
                  disabled={hasImagesInHiddenLane}
                  title={hasImagesInHiddenLane ? "Move images out of hidden columns before reducing the count." : undefined}
                  onClick={() => {
                    set({ galleryColumns: value });
                    if (type === "GalleryMasonry" && p?.masonryLoop && setProp) setProp("masonryLoop", false);
                  }}
                  className={cn(
                    "inline-flex h-7 min-w-[2.5rem] cursor-pointer items-center justify-center border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45",
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
        {type === "GalleryMasonry" && (
          <div className="flex flex-col gap-2">
            {masonryUsesColumnLanes ? (
              <>
                <span className="text-xs text-muted-foreground">Loop</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-pressed={p?.masonryLoop === true}
                    disabled={!masonryLoopEligible}
                    title={!masonryLoopEligible ? "Add at least three images to every active column to enable the loop." : undefined}
                    onClick={() => setProp?.("masonryLoop", true)}
                    className={cn(
                      "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45",
                      p?.masonryLoop === true && "bg-foreground text-background hover:bg-foreground",
                    )}
                  >
                    On
                  </button>
                  <button
                    type="button"
                    aria-pressed={p?.masonryLoop !== true}
                    onClick={() => setProp?.("masonryLoop", false)}
                    className={cn(
                      "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      p?.masonryLoop !== true && "bg-foreground text-background hover:bg-foreground",
                    )}
                  >
                    Off
                  </button>
                </div>
                {!masonryLoopEligible && <p className="text-xs text-muted-foreground">Add at least 3 images to each active column to enable the loop.</p>}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">This saved masonry uses the retired flow format. New Masonry blocks use column lanes.</p>
            )}
            <span className="text-xs text-muted-foreground">Tile rhythm</span>
            <div className="flex items-center gap-1.5">
              {[
                { value: "none", label: "Free" },
                { value: "alternating", label: "Alternate" },
              ].map(({ value, label }) => {
                const active = (s.masonryHeightPattern ?? "none") === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => set({ masonryHeightPattern: value === "none" ? undefined : "alternating" })}
                    className={cn(
                      "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      active && "bg-foreground text-background hover:bg-foreground",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {s.masonryHeightPattern === "alternating" && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Odd columns</span>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberInputRow label="Odd tile" value={s.masonryOddHeight} min={STYLE_LIMITS.masonryPatternHeight.min} max={STYLE_LIMITS.masonryPatternHeight.max} effectiveValue={260} onChange={(value) => set({ masonryOddHeight: value })} />
                    <NumberInputRow label="Even tile" value={s.masonryEvenHeight} min={STYLE_LIMITS.masonryPatternHeight.min} max={STYLE_LIMITS.masonryPatternHeight.max} effectiveValue={360} onChange={(value) => set({ masonryEvenHeight: value })} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Even columns</span>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberInputRow label="Odd tile" value={s.masonryEvenColumnOddHeight} min={STYLE_LIMITS.masonryPatternHeight.min} max={STYLE_LIMITS.masonryPatternHeight.max} effectiveValue={360} onChange={(value) => set({ masonryEvenColumnOddHeight: value })} />
                    <NumberInputRow label="Even tile" value={s.masonryEvenColumnEvenHeight} min={STYLE_LIMITS.masonryPatternHeight.min} max={STYLE_LIMITS.masonryPatternHeight.max} effectiveValue={260} onChange={(value) => set({ masonryEvenColumnEvenHeight: value })} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
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
  blockType = "",
  p,
  setProp,
  parentColumnsCount = 12,
  parentRowsCount = 12,
}: {
  s: BlockStyle;
  set: (patch: Partial<BlockStyle>) => void;
  isGridChild: boolean;
  /** @deprecated retained for call-site compatibility; flex containers always expose content distribution. */
  showJustify?: boolean;
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

  // Every preset renders through ContainerBlock, so it has the same 1.5rem
  // fallback as a plain Container. Keep Columns on its own asymmetric fallback.
  const effectivePad: EffectivePad | undefined =
    isFlexContainer ? CONTAINER_EFFECTIVE_PAD :
    blockType === "Columns" ? COLUMNS_EFFECTIVE_PAD :
    isGalleryContainer ? GALLERY_EFFECTIVE_PAD :
    undefined;
  if (isGalleryLayout) {
    if (isGalleryContainer) {
      // Gallery container blocks: gallery-specific controls plus the section
      // controls their render actually consumes (padding, min-height, grid span).
      return (
        <EditorDrawerGroup>
          <EditorDrawerSection title="Gallery">
            <GalleryLayoutControls type={blockType} s={s} set={set} p={p} setProp={setProp} />
          </EditorDrawerSection>
          <EditorDrawerSection title="Spacing">
            <PaddingControls s={s} set={set} effectivePad={effectivePad} />
          </EditorDrawerSection>
          <EditorDrawerSection title="Layout">
            {p !== undefined && setProp !== undefined && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Min height</span>
                <div className="flex flex-wrap items-center gap-1.5">
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
                {(p.minHeight as string | undefined) === "custom" && (
                  <DimensionInput
                    label="Custom value"
                    value={p.minHeightValue as string | undefined}
                    onChange={(v) => setProp("minHeightValue", v)}
                  />
                )}
              </div>
            )}
            {isGridChild ? (
              <CellLayoutControls
                s={s}
                set={set}
                parentColumnsCount={parentColumnsCount}
                parentRowsCount={parentRowsCount}
              />
            ) : null}
          </EditorDrawerSection>
        </EditorDrawerGroup>
      );
    }
    // Non-container gallery blocks: simple layout view with gallery controls only.
    return (
      <div className="flex flex-col gap-4 p-3">
        <GalleryLayoutControls type={blockType} s={s} set={set} p={p} setProp={setProp} />
      </div>
    );
  }

  // Image (F1): resizable, container-like leaf — width/height + colSpan/rowSpan
  // (when a Columns child) + the bgImageOpacity control (F4), gated on a picked
  // background image so it never shows next to an empty placeholder.
  if (blockType === "CollectionCard") {
    return (
      <EditorDrawerGroup>
        <EditorDrawerSection title="Spacing">
          <PaddingControls s={s} set={set} />
        </EditorDrawerSection>
        <EditorDrawerSection title="Layout">
          <IconRow
            label="Block position"
            value={s.selfAlign}
            options={BLOCK_POSITION_OPTIONS}
            onChange={(v) => set({ selfAlign: v })}
          />
          <DimensionInput label="Width" value={s.width} onChange={(v) => set({ width: v })} />
          <DimensionInput label="Height" value={s.height} onChange={(v) => set({ height: v })} />
          {isGridChild && (
            <CellLayoutControls
              s={s}
              set={set}
              parentColumnsCount={parentColumnsCount}
              parentRowsCount={parentRowsCount}
            />
          )}
        </EditorDrawerSection>
      </EditorDrawerGroup>
    );
  }

  if (blockType === "Image") {
    return (
      <EditorDrawerGroup>
        <EditorDrawerSection title="Layout">
          <IconRow
            label="Block position"
            value={s.selfAlign}
            options={BLOCK_POSITION_OPTIONS}
            onChange={(v) => set({ selfAlign: v })}
          />
          <DimensionInput label="Width" value={s.width} onChange={(v) => set({ width: v })} />
          <DimensionInput label="Height" value={s.height} onChange={(v) => set({ height: v })} />
          {Boolean(s.bgImagePublicId) && (
            <NumberInputRow
              label="Background image opacity"
              value={s.bgImageOpacity}
              min={0}
              max={100}
              suffix="%"
              effectiveValue={100}
              onChange={(v) => set({ bgImageOpacity: v })}
            />
          )}
          {isGridChild && (
            <CellLayoutControls
              s={s}
              set={set}
              parentColumnsCount={parentColumnsCount}
              parentRowsCount={parentRowsCount}
            />
          )}
        </EditorDrawerSection>
      </EditorDrawerGroup>
    );
  }

  // For text-only and button leaf blocks: position/size + spacing controls.
  if (TEXT_ONLY_BLOCKS.has(blockType)) {
    const isButton = blockType === "Button";
    // Heading/Text render a 4px effective-default padding (grabbable drag
    // strip around the inline-editable text) — surface the same Spacing
    // controls Container/Columns get so it's visible + overridable.
    const isHeadingOrText = blockType === "Heading" || blockType === "Text";
    return (
      <EditorDrawerGroup>
        {isHeadingOrText && (
          <EditorDrawerSection title="Spacing">
            <PaddingControls s={s} set={set} effectivePad={TEXT_EFFECTIVE_PAD} />
          </EditorDrawerSection>
        )}
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
            {isGridChild && (
              <CellLayoutControls
                s={s}
                set={set}
                parentColumnsCount={parentColumnsCount}
                parentRowsCount={parentRowsCount}
              />
            )}
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
            {isGridChild && (
              <CellLayoutControls
                s={s}
                set={set}
                parentColumnsCount={parentColumnsCount}
                parentRowsCount={parentRowsCount}
              />
            )}
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
        {/* Width — Fill (default, unset) / Hug (fit-content) / Fixed (DimensionInput). */}
        {(isFlexContainer || isColumns) && (() => {
          const widthMode: "fill" | "hug" | "fixed" =
            s.width === undefined ? "fill" : s.width === "fit-content" ? "hug" : "fixed";
          return (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Width</span>
              <div className="flex items-center gap-1.5">
                {(["fill", "hug", "fixed"] as const).map((v) => {
                  const isActive = widthMode === v;
                  const label = v === "fill" ? "Fill" : v === "hug" ? "Hug" : "Fixed";
                  return (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() =>
                        set({
                          width:
                            v === "fill"
                              ? undefined
                              : v === "hug"
                                ? "fit-content"
                                : widthMode === "fixed"
                                  ? s.width
                                  : "200px",
                        })
                      }
                      className={cn(
                        "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        isActive && "bg-foreground text-background hover:bg-foreground"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {widthMode === "fixed" && (
                <DimensionInput label="Fixed width" value={s.width} onChange={(v) => set({ width: v })} />
              )}
            </div>
          );
        })()}
        {/* Overall Width — Container, Navigation-shaped presets, and Columns:
            Page fit (default) or Full (100vw full-bleed). Chrome blocks (footer)
            default to Full — see ContainerBlock's own _chrome-aware fallback,
            mirrored here so the control's "effective" tier matches the render.
            Disabled while Width is Hug — the two are contradictory and Hug wins
            (see ContainerBlock render). */}
        {(isColumns || isFlexContainer) && p !== undefined && setProp && (() => {
          const chrome = (p as { _chrome?: string })._chrome;
          const effectiveDefault: "page-fit" | "full" = !isColumns && chrome === "footer" ? "full" : "page-fit";
          const widthIsHug = s.width === "fit-content";
          return (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Overall width</span>
              <div className="flex items-center gap-1.5">
                {(["page-fit", "full"] as const).map((v) => {
                  const label = v === "page-fit" ? "Page fit" : "Full";
                  const isActive = (p.overallWidth as string | undefined) === v || (p.overallWidth === undefined && v === effectiveDefault);
                  return (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={isActive}
                      disabled={widthIsHug}
                      title={widthIsHug ? "Width is set to Hug — overall width has no effect." : undefined}
                      onClick={() => setProp("overallWidth", v)}
                      className={cn(
                        "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        isActive && "bg-foreground text-background hover:bg-foreground",
                        widthIsHug && "cursor-not-allowed opacity-50"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}
        {/* Direction — Container only (flexDirection is not consumed by Columns).
            Effective-default display: prop stays unset until the user picks
            explicitly; unset always shows Vertical as the theme/system default. */}
        {isFlexContainer && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Direction</span>
            <div className="flex items-center gap-1.5">
              {([
                { value: "column", label: "↓ Vertical" },
                { value: "row", label: "→ Horizontal" },
              ] as const).map(({ value, label }) => {
                const isExplicit = s.flexDirection === value;
                const isEffective = s.flexDirection === undefined && value === "column";
                const isActive = isExplicit || isEffective;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => set({ flexDirection: value })}
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
        )}
        {/* Min height — only for flex containers, controlled via block prop */}
        {isFlexContainer && p !== undefined && setProp && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Min height</span>
            <div className="flex flex-wrap items-center gap-1.5">
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
            {(p.minHeight as string | undefined) === "custom" && (
              <DimensionInput
                label="Custom value"
                value={p.minHeightValue as string | undefined}
                onChange={(v) => setProp("minHeightValue", v)}
              />
            )}
          </div>
        )}
        {/* Background image opacity (F4) — only once a background image is actually
            set (backgroundImages array, the Container/preset banner mechanism). */}
        {isFlexContainer && Array.isArray(p?.backgroundImages) && (p.backgroundImages as unknown[]).length > 0 && (
          <NumberInputRow
            label="Background image opacity"
            value={s.bgImageOpacity}
            min={0}
            max={100}
            suffix="%"
            effectiveValue={100}
            onChange={(v) => set({ bgImageOpacity: v })}
          />
        )}
        {/* Min height — for Columns (CSS length string, no enum) */}
        {isColumns && p !== undefined && setProp && (
          <DimensionInput
            label="Min height"
            value={p.minHeight as string | undefined}
            onChange={(v) => setProp("minHeight", v)}
          />
        )}
        {isFlexContainer && <ContentLayoutControls s={s} set={set} p={p} />}
        {isGridChild && (
          <CellLayoutControls
            s={s}
            set={set}
            parentColumnsCount={parentColumnsCount}
            parentRowsCount={parentRowsCount}
          />
        )}
      </EditorDrawerSection>
    </EditorDrawerGroup>
  );
}

// ---------------------------------------------------------------------------
// Simplified panels — blocks that bypass the tab system
// ---------------------------------------------------------------------------

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
  navDetach,
  t,
}: {
  s: BlockStyle;
  set: (patch: Partial<BlockStyle>) => void;
  /** @deprecated kept for call-site compatibility; ignored in favour of the block-tab store */
  tab?: "content" | "design" | "layout";
  /** @deprecated kept for call-site compatibility; ignored in favour of the block-tab store */
  onTabChange?: (tab: "content" | "design" | "layout") => void;
  navDetach?: NavDetachContext;
  t?: NavDetachTranslate;
}) {
  const selectedItem = usePuckStore((s) => s.selectedItem);
  const data = usePuckStore((s) => s.appState.data);
  const dispatch = usePuckStore((s) => s.dispatch);
  const getSelectorForId = usePuckStore((s) => s.getSelectorForId);
  const getItemById = usePuckStore((s) => s.getItemById);

  const blockId = (selectedItem?.props?.id as string | undefined) ?? "";

  // Store-backed tab: survives StyleToolkitField remounts (Puck re-invokes the
  // field render on every value change). Using blockId as key means selecting a
  // different block starts at "content" while edits on the same block preserve
  // whichever tab the user navigated to.
  const [storedTab, setActiveTabState] = useState<BlockTab>(() => getBlockTab(blockId));
  function setActiveTab(t: BlockTab) {
    setActiveTabState(t);
    if (blockId) setBlockTab(blockId, t);
  }

  const type = (selectedItem?.type ?? "") as string;
  const isNavigation = NAV_CONFIG_TYPES.has(type);
  const isGallery = GALLERY_BLOCKS.has(type);
  const isContainer = CONTAINER_TYPES.has(type);
  // Gallery container blocks (GalleryGrid, GalleryMasonry, FeaturedWork) get the same
  // Content/Design/Layout drawers as Container, minus Typography. They are NOT true
  // containers (no slot), so ContentInputs still shows their gallery-specific controls.
  const isGalleryContainer = GALLERY_CONTAINER_BLOCKS.has(type);
  const isFlexContainer = FLEX_CONTAINER_BLOCKS.has(type);

  const availableTabs = blockTabsForType(type);
  const activeTab = availableTabs.includes(storedTab) ? storedTab : "content";

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

  function setProps(patch: Record<string, unknown>) {
    if (!selectedItem) return;
    const id = selectedItem.props?.id;
    if (typeof id !== "string" || !id) return;
    const sel = getSelectorForId(id);
    if (!sel) return;
    const current = getItemById(id) ?? selectedItem;
    if (SLOT_GALLERY_PICKER_BLOCKS.has(type)) {
      const nextZones = galleryZonesWithPatch(current.props, patch, data.zones);
      if (nextZones) {
        dispatch({ type: "setData", data: { ...data, zones: nextZones } });
        return;
      }
    }
    if (NAV_CONFIG_TYPES.has(type)) {
      const nextZones = navigationZonesWithPatch(current.props, patch, data.zones);
      if (nextZones) {
        dispatch({ type: "setData", data: { ...data, zones: nextZones } });
        return;
      }
    }
    dispatch({
      type: "replace",
      destinationZone: sel.zone,
      destinationIndex: sel.index,
      data: {
        ...current,
        props: { ...current.props, ...patch },
      } as ComponentData,
    });
  }

  function setProp(key: string, val: unknown) {
    setProps({ [key]: val });
  }

  const selectedProps = selectedItem?.props as Record<string, unknown> | undefined;
  const p = selectedProps && SLOT_GALLERY_PICKER_BLOCKS.has(type)
    ? galleryPropsWithZones(selectedProps, data.zones)
    : selectedProps && NAV_CONFIG_TYPES.has(type)
      ? navigationPropsWithZones(selectedProps, data.zones)
      : selectedProps;

  // Simplified blocks bypass the tab system entirely. Image (F1) no longer
  // bypasses — it uses the full Content/Design/Layout tabs (Banner for the
  // background image, Frame, Layout resize/colSpan/rowSpan controls).
  if (type === "Divider") return <DividerPanel p={p} setProp={setProp} />;
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
            setProps={setProps}
            showBanner={isContainer || isGalleryContainer || type === "ContactDetails" || type === "Image"}
            isContainer={isContainer || isGalleryContainer}
            navDetach={navDetach}
            t={t}
          />
        )}
        {activeTab === "design" && (
          isNavigation && p
            ? <NavigationDesignPanel config={p as PortfolioHeaderConfig} setProp={setProp} />
            : <DesignTab s={s} set={set} blockType={type} p={p} />
        )}
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
  navDetach,
  t,
}: {
  value: BlockStyle | undefined;
  onChange: (next: BlockStyle) => void;
  fieldId?: string;
  blockType?: string;
  /** Only relevant when `blockType` is one of NAV_CONFIG_TYPES. StyleToolkitField
   *  cannot compute this itself — see NavDetachContext. */
  navDetach?: NavDetachContext;
  /** Only relevant when `blockType` is one of NAV_CONFIG_TYPES — the detach
   *  toggle's copy. Falls back to hardcoded English when omitted. */
  t?: NavDetachTranslate;
}) {
  const [tab, setTab] = useState<"content" | "design" | "layout">("content");
  const s = value ?? {};
  const set = (patch: Partial<BlockStyle>) => onChange({ ...s, ...patch });

  if (fieldId) {
    return <BlockAwarePanel s={s} set={set} tab={tab} onTabChange={setTab} navDetach={navDetach} t={t} />;
  }

  // Standalone render (tests — no Puck provider).
  const allTabs = blockTabsForType(blockType);
  const standaloneTab = allTabs.includes(tab) ? tab : "content";
  const standaloneIsNavigation = NAV_CONFIG_TYPES.has(blockType);
  const standaloneIsContainer = CONTAINER_TYPES.has(blockType) || GALLERY_CONTAINER_BLOCKS.has(blockType);
  return (
    <div className="flex flex-col">
      <TabHeader tab={standaloneTab} tabs={allTabs} onTabChange={setTab} />
      {standaloneTab === "content" && (
        <ContentTabBody
          s={s}
          set={set}
          type={blockType}
          p={standaloneIsNavigation ? {} : undefined}
          setProp={() => {}}
          showBanner={standaloneIsContainer || !GALLERY_BLOCKS.has(blockType)}
          isContainer={standaloneIsContainer}
          navDetach={navDetach}
          t={t}
        />
      )}
      {standaloneTab === "design" && (
        standaloneIsNavigation
          ? <NavigationDesignPanel config={{}} setProp={() => {}} />
          : <DesignTab s={s} set={set} blockType={blockType} />
      )}
      {standaloneTab === "layout" && (
        <LayoutTabBody s={s} set={set} isGridChild={false} showJustify={true} blockType={blockType} />
      )}
    </div>
  );
}
