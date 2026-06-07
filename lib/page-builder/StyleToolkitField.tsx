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

import { useState } from "react";
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
import { usePuck } from "@measured/puck";
import type { ComponentData } from "@measured/puck";
import { SingleImagePicker } from "./galleryPicker/SingleImagePicker";
import { CollectionPicker } from "./galleryPicker/CollectionPicker";
import { FeaturedItemsPicker } from "./galleryPicker/FeaturedItemsPicker";
import type { FeaturedWorkItemId } from "./blocks/FeaturedWorkBlock";
import {
  ToolbarToggle,
  ColorSwatchRow,
  NumberInputRow,
  DimensionInput,
  IconRow,
  ResetButton,
} from "./toolbarPrimitives";
import { cn } from "@/lib/utils";
import {
  STYLE_LIMITS,
  ANIMATION_TYPES,
  HOVER_EFFECTS,
  type BlockStyle,
  type ShadowSize,
  type AnimationType,
  type HoverEffect,
  type SelfAlign,
} from "./styleToolkit";
import { PORTFOLIO_FONT_KEYS, PORTFOLIO_FONTS, type PortfolioFontKey } from "./fonts";

// Block types that are containers (no text/video inputs in Content tab)
const CONTAINER_TYPES = new Set([
  "Container",
  "HeroPreset",
  "AboutPreset",
  "ServicesPreset",
  "CtaPreset",
  "ContactPreset",
]);

const TEXT_ONLY_BLOCKS = new Set(["Heading", "Text", "Divider", "Spacer", "Button"]);
const NO_FRAME_BLOCKS = new Set(["Heading", "Text", "Divider", "Spacer"]);
const GALLERY_BLOCKS = new Set(["GalleryGrid", "GalleryMasonry", "GalleryCarousel", "FeaturedWork"]);
const FLEX_CONTAINER_BLOCKS = new Set([
  "Container",
  "HeroPreset", "AboutPreset", "ServicesPreset", "CtaPreset", "ContactPreset",
]);

const COLLECTION_GALLERY_BLOCKS = new Set(["GalleryGrid", "GalleryMasonry", "GalleryCarousel"]);

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

const CONTACT_TOGGLES = [
  { key: "showEmail",   label: "Email" },
  { key: "showPhone",   label: "Phone" },
  { key: "showAddress", label: "Address" },
  { key: "showSocials", label: "Social links" },
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
  return (
    <div className="flex border-b border-border">
      {tabs.map((id) => (
        <button
          key={id}
          type="button"
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

function BannerSection({
  s,
  set,
  onImageChange,
}: {
  s: BlockStyle;
  set: (p: Partial<BlockStyle>) => void;
  onImageChange?: (pid: string) => void;
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
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Image</span>
        <SingleImagePicker
          value={s.bgImagePublicId ?? ""}
          onChange={(pid) => {
            if (onImageChange) {
              onImageChange(pid);
            } else {
              set({ bgImagePublicId: pid || undefined });
            }
          }}
        />
      </div>
    </div>
  );
}

function ContentInputs({
  type,
  props,
  setProp,
}: {
  type: string;
  props: Record<string, unknown>;
  setProp: (key: string, val: unknown) => void;
}) {
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
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Collection</span>
          <CollectionPicker
            value={(props.collectionId as string) ?? ""}
            onChange={(v) => setProp("collectionId", v)}
          />
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span>Heading</span>
          <input
            type="text"
            value={(props.heading as string) ?? ""}
            onChange={(e) => setProp("heading", e.target.value)}
            className="h-9 border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Description</span>
          <textarea
            rows={2}
            value={(props.description as string) ?? ""}
            onChange={(e) => setProp("description", e.target.value)}
            className="border border-border bg-background px-2 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Footer</span>
          <input
            type="text"
            value={(props.footer as string) ?? ""}
            onChange={(e) => setProp("footer", e.target.value)}
            className="h-9 border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </label>
      </div>
    );
  }
  if (type === "FeaturedWork") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Photos (max 3)</span>
          <FeaturedItemsPicker
            value={(props.itemIds as FeaturedWorkItemId[]) ?? []}
            onChange={(v) => setProp("itemIds", v)}
          />
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span>Heading</span>
          <input
            type="text"
            value={(props.heading as string) ?? ""}
            onChange={(e) => setProp("heading", e.target.value)}
            className="h-9 border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Subheading</span>
          <input
            type="text"
            value={(props.subheading as string) ?? ""}
            onChange={(e) => setProp("subheading", e.target.value)}
            className="h-9 border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </label>
      </div>
    );
  }
  if (type === "Columns") {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Columns</span>
        <div className="flex items-center gap-1.5">
          {([2, 3] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={(props.columns as number) === v}
              onClick={() => setProp("columns", v)}
              className={cn(
                "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                (props.columns as number) === v &&
                  "bg-foreground text-background hover:bg-foreground"
              )}
            >
              {v}
            </button>
          ))}
        </div>
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
  return (
    <div className="flex flex-col gap-4 p-3">
      {showBanner && (
        <BannerSection
          s={s}
          set={set}
          onImageChange={
            isContainer ? (pid) => setProp("backgroundImagePublicId", pid) : undefined
          }
        />
      )}
      {!isContainer && p && <ContentInputs type={type} props={p} setProp={setProp} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Design tab
// ---------------------------------------------------------------------------

function DesignTab({
  s,
  set,
  blockType = "",
}: {
  s: BlockStyle;
  set: (p: Partial<BlockStyle>) => void;
  blockType?: string;
}) {
  const [paddingAdvanced, setPaddingAdvanced] = useState(false);
  const isButton = blockType === "Button";
  const showFrame = !NO_FRAME_BLOCKS.has(blockType);
  const showPadding = FLEX_CONTAINER_BLOCKS.has(blockType);

  const paddingX =
    s.paddingLeft !== undefined && s.paddingLeft === s.paddingRight
      ? s.paddingLeft
      : undefined;
  const paddingY =
    s.paddingTop !== undefined && s.paddingTop === s.paddingBottom
      ? s.paddingTop
      : undefined;

  return (
    <div className="flex flex-col gap-4 p-3">
      {/* Typography — Bold/Italic/Underline + text align as one 6-icon row */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Typography
        </span>
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
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <Baseline className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-xs text-muted-foreground">Text color</span>
          </div>
          <ColorSwatchRow
            value={s.textColorToken}
            onChange={(t) => set({ textColorToken: t })}
          />
        </div>
        {isButton && (
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
        )}
        {/* Font — 2-column with reset */}
        <div className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">Font</span>
          <div className="flex items-center gap-1">
            <select
              value={s.fontFamily ?? ""}
              onChange={(e) =>
                set({
                  fontFamily: e.target.value
                    ? (e.target.value as PortfolioFontKey)
                    : undefined,
                })
              }
              className="h-7 cursor-pointer border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
            onChange={(v) => set({ fontSize: v })}
          />
        )}
      </div>

      {/* Frame — hidden for text/button leaf blocks */}
      {showFrame && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Frame
          </span>
          <NumberInputRow
            label="Border width"
            value={s.borderWidth}
            min={STYLE_LIMITS.borderWidth.min}
            max={STYLE_LIMITS.borderWidth.max}
            onChange={(v) => set({ borderWidth: v })}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Border color</span>
            <ColorSwatchRow
              value={s.borderColorToken}
              onChange={(t) => set({ borderColorToken: t })}
              allowNone={false}
            />
          </div>
          <NumberInputRow
            label="Corner radius"
            value={s.radius}
            min={STYLE_LIMITS.radius.min}
            max={STYLE_LIMITS.radius.max}
            onChange={(v) => set({ radius: v })}
          />
          <IconRow
            label="Shadow"
            value={s.shadow ?? "none"}
            options={SHADOW_OPTIONS}
            onChange={(v) => set({ shadow: (v ?? "none") as ShadowSize })}
          />
        </div>
      )}

      {/* Padding — containers only */}
      {showPadding && (
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
      )}


      {/* Animations */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Animations
        </span>
        {/* Entrance — 2-column with reset */}
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
        {/* Hover effect — 2-column with reset */}
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
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout tab
// ---------------------------------------------------------------------------

function ColSpanRowSpanControls({
  s,
  set,
  parentColumnsCount = 12,
}: {
  s: BlockStyle;
  set: (p: Partial<BlockStyle>) => void;
  parentColumnsCount?: number;
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
        max={parentColumnsCount}
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

const ASPECT_OPTIONS = [
  { value: "square",    label: "Square" },
  { value: "landscape", label: "Landscape" },
  { value: "portrait",  label: "Portrait" },
] as const;

const FEATURED_LAYOUT_OPTIONS = [
  { value: "row",     label: "Row" },
  { value: "stagger", label: "Stagger" },
] as const;

function GalleryLayoutControls({
  type,
  p,
  setProp,
}: {
  type: string;
  p: Record<string, unknown>;
  setProp: (key: string, val: unknown) => void;
}) {
  if (COLLECTION_GALLERY_BLOCKS.has(type)) {
    const isCarousel = type === "GalleryCarousel";
    return (
      <div className="flex flex-col gap-3">
        {!isCarousel && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Columns</span>
            <div className="flex items-center gap-1.5">
              {COLUMNS_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={(p.columns as number) === value}
                  onClick={() => setProp("columns", value)}
                  className={cn(
                    "inline-flex h-7 min-w-[2.5rem] cursor-pointer items-center justify-center border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    (p.columns as number) === value && "bg-foreground text-background hover:bg-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {isCarousel && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Image shape</span>
            <div className="flex items-center gap-1.5">
              {ASPECT_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={(p.aspect as string) === value}
                  onClick={() => setProp("aspect", value)}
                  className={cn(
                    "inline-flex h-7 cursor-pointer items-center justify-center border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    (p.aspect as string) === value && "bg-foreground text-background hover:bg-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {isCarousel && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Autoplay</span>
            <button
              type="button"
              role="switch"
              aria-checked={!!(p.autoplay)}
              onClick={() => setProp("autoplay", !p.autoplay)}
              className={cn(
                "relative inline-flex h-5 w-9 cursor-pointer items-center border border-border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                p.autoplay ? "bg-foreground" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "inline-block h-3 w-3 translate-x-1 transition-transform bg-background",
                  !!p.autoplay && "translate-x-5"
                )}
              />
            </button>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Image spacing</span>
          <div className="flex items-center gap-1.5">
            {GAP_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={(p.gap as string) === value}
                onClick={() => setProp("gap", value)}
                className={cn(
                  "inline-flex h-7 cursor-pointer items-center justify-center border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  (p.gap as string) === value && "bg-foreground text-background hover:bg-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <NumberInputRow
          label="Max items"
          value={p.maxItems as number | undefined}
          min={1}
          max={100}
          suffix=""
          onChange={(v) => setProp("maxItems", v)}
        />
      </div>
    );
  }

  if (type === "FeaturedWork") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Layout</span>
          <div className="flex items-center gap-1.5">
            {FEATURED_LAYOUT_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={(p.layout as string) === value}
                onClick={() => setProp("layout", value)}
                className={cn(
                  "inline-flex h-7 cursor-pointer items-center justify-center border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  (p.layout as string) === value && "bg-foreground text-background hover:bg-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function LayoutTabBody({
  s,
  set,
  isGridChild,
  showJustify,
  blockType = "",
  p,
  setProp,
  parentColumnsCount = 12,
}: {
  s: BlockStyle;
  set: (patch: Partial<BlockStyle>) => void;
  isGridChild: boolean;
  showJustify: boolean;
  blockType?: string;
  p?: Record<string, unknown>;
  setProp?: (key: string, val: unknown) => void;
  parentColumnsCount?: number;
}) {
  const isGalleryLayout = GALLERY_BLOCKS.has(blockType);
  const isFlexContainer = FLEX_CONTAINER_BLOCKS.has(blockType);

  if (isGalleryLayout && p && setProp) {
    return (
      <div className="flex flex-col gap-4 p-3">
        <GalleryLayoutControls type={blockType} p={p} setProp={setProp} />
      </div>
    );
  }

  // For text-only and button leaf blocks: position/size + spacing controls.
  if (TEXT_ONLY_BLOCKS.has(blockType)) {
    const isButton = blockType === "Button";
    return (
      <div className="flex flex-col gap-4 p-3">
        {isButton && p && setProp && (
          <>
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
          </>
        )}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Position</span>
          <IconRow
            label="Block position"
            value={s.selfAlign}
            options={BLOCK_POSITION_OPTIONS}
            onChange={(v) => set({ selfAlign: v })}
          />
        </div>
        <DimensionInput label="Width" value={s.width} onChange={(v) => set({ width: v })} />
        {!isButton && <DimensionInput label="Height" value={s.height} onChange={(v) => set({ height: v })} />}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Spacing</span>
          <DimensionInput label="Top spacing" value={s.marginTop} onChange={(v) => set({ marginTop: v })} />
          <DimensionInput label="Bottom spacing" value={s.marginBottom} onChange={(v) => set({ marginBottom: v })} />
        </div>
      </div>
    );
  }

  // Container / generic block layout
  return (
    <div className="flex flex-col gap-4 p-3">
      <NumberInputRow
        label="Gap"
        value={s.gap}
        min={0}
        max={96}
        suffix="px"
        onChange={(v) => set({ gap: v })}
      />
      {/* Min height — only for flex containers, controlled via block prop */}
      {isFlexContainer && p !== undefined && setProp && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Min height</span>
          <div className="flex items-center gap-1.5">
            {MIN_HEIGHT_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={(p.minHeight as string) === value}
                onClick={() => setProp("minHeight", value)}
                className={cn(
                  "inline-flex h-7 cursor-pointer items-center justify-center border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  (p.minHeight as string) === value && "bg-foreground text-background hover:bg-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {isGridChild ? (
        <ColSpanRowSpanControls s={s} set={set} parentColumnsCount={parentColumnsCount} />
      ) : (
        <>
          <IconRow
            label="Align"
            value={s.alignItems}
            options={ALIGN_OPTIONS}
            onChange={(v) => set({ alignItems: v })}
          />
          {showJustify && (
            <IconRow
              label="Justify"
              value={s.justifyContent}
              options={JUSTIFY_OPTIONS}
              onChange={(v) => set({ justifyContent: v })}
            />
          )}
        </>
      )}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Spacing</span>
        <DimensionInput label="Top spacing" value={s.marginTop} onChange={(v) => set({ marginTop: v })} />
        <DimensionInput label="Bottom spacing" value={s.marginBottom} onChange={(v) => set({ marginBottom: v })} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simplified panels — blocks that bypass the tab system
// ---------------------------------------------------------------------------

function ImagePanel({ p, setProp }: { p: Record<string, unknown> | undefined; setProp: (k: string, v: unknown) => void }) {
  return (
    <div className="flex flex-col gap-3 p-3">
      <SingleImagePicker
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

function ContactDetailsPanel({ p, setProp }: { p: Record<string, unknown> | undefined; setProp: (k: string, v: unknown) => void }) {
  return (
    <div className="flex flex-col p-3">
      {CONTACT_TOGGLES.map(({ key, label }) => (
        <div
          key={key}
          className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0"
        >
          <span className="text-xs text-muted-foreground">{label}</span>
          <button
            type="button"
            role="switch"
            aria-checked={!!(p?.[key])}
            onClick={() => setProp(key, !(p?.[key]))}
            className={cn(
              "relative inline-flex h-5 w-9 cursor-pointer items-center border border-border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              p?.[key] ? "bg-foreground" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "inline-block h-3 w-3 translate-x-1 transition-transform bg-background",
                !!(p?.[key]) && "translate-x-5"
              )}
            />
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Block-aware panel — single usePuck() call, derives type/context from selection
// ---------------------------------------------------------------------------

function BlockAwarePanel({
  s,
  set,
  tab,
  onTabChange,
}: {
  s: BlockStyle;
  set: (patch: Partial<BlockStyle>) => void;
  tab: "content" | "design" | "layout";
  onTabChange: (t: "content" | "design" | "layout") => void;
}) {
  const { selectedItem, dispatch, getSelectorForId, getItemById } = usePuck();

  const type = (selectedItem?.type ?? "") as string;
  const isGallery = GALLERY_BLOCKS.has(type);
  const isContainer = CONTAINER_TYPES.has(type);
  const isFlexContainer = FLEX_CONTAINER_BLOCKS.has(type);

  const availableTabs = ["content", "design", "layout"] as const;
  const activeTab = (availableTabs as readonly string[]).includes(tab) ? tab : "content";

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
  if (type === "ContactDetails") return <ContactDetailsPanel p={p} setProp={setProp} />;

  return (
    <div className="flex flex-col">
      <TabHeader tab={activeTab} tabs={availableTabs} onTabChange={onTabChange} />
      {activeTab === "content" && (
        <ContentTabBody
          s={s}
          set={set}
          type={type}
          p={p}
          setProp={setProp}
          showBanner={isContainer}
          isContainer={isContainer}
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
        />
      )}
    </div>
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
          showBanner={true}
          isContainer={false}
        />
      )}
      {tab === "design" && <DesignTab s={s} set={set} blockType={blockType} />}
      {tab === "layout" && (
        <LayoutTabBody s={s} set={set} isGridChild={false} showJustify={true} blockType={blockType} />
      )}
    </div>
  );
}
