"use client";

/**
 * StyleToolkitField — the block-level styling toolbar (`_style` custom Puck
 * field). Controls are organised into SIX context-grouped popovers:
 *   1. Background — bg color + image
 *   2. Borders    — border width/color, corner radius, shadow
 *   3. Text       — font, size, color, highlight, alignment (bold/italic/underline inline)
 *   4. Layout     — position (selfAlign), width/height, margin top/bottom, padding (4 sides)
 *   5. Container  — colSpan / rowSpan (grid placement)
 *   6. Animations — entrance animation + duration, hover effect
 *
 * Editor chrome → English-only (RELEASE-CHECKLIST §4f).
 */

import {
  PaintBucket,
  Square,
  Type,
  LayoutGrid,
  Columns3,
  Sparkles,
  Bold,
  Italic,
  Underline,
  Baseline,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import { SingleImagePicker } from "./galleryPicker/SingleImagePicker";
import {
  ToolbarPopover,
  ToolbarToggle,
  ColorSwatchRow,
  NumberInputRow,
  DimensionInput,
  toolbarButtonBase,
} from "./toolbarPrimitives";
import { cn } from "@/lib/utils";
import {
  STYLE_LIMITS,
  SHADOW_SIZES,
  ANIMATION_TYPES,
  HOVER_EFFECTS,
  type BlockStyle,
  type ShadowSize,
  type TextAlign,
  type AnimationType,
  type HoverEffect,
  type SelfAlign,
} from "./styleToolkit";
import { PORTFOLIO_FONT_KEYS, PORTFOLIO_FONTS, type PortfolioFontKey } from "./fonts";

const SHADOW_LABEL: Record<ShadowSize, string> = {
  none: "None",
  sm: "Small",
  md: "Medium",
  lg: "Large",
};

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

const ALIGNS: { value: TextAlign; label: string; Icon: typeof AlignLeft }[] = [
  { value: "left", label: "Align left", Icon: AlignLeft },
  { value: "center", label: "Align center", Icon: AlignCenter },
  { value: "right", label: "Align right", Icon: AlignRight },
];

const SELF_ALIGNS: { value: SelfAlign; label: string; Icon: typeof AlignLeft }[] = [
  { value: "left", label: "Left", Icon: AlignLeft },
  { value: "center", label: "Center", Icon: AlignCenter },
  { value: "right", label: "Right", Icon: AlignRight },
];

export function StyleToolkitField({
  value,
  onChange,
}: {
  value: BlockStyle | undefined;
  onChange: (next: BlockStyle) => void;
}) {
  const s = value ?? {};
  const set = (patch: Partial<BlockStyle>) => onChange({ ...s, ...patch });

  // Active flags per context
  const bgActive = !!s.bgColorToken || !!s.bgImagePublicId;
  const bordersActive =
    !!s.borderWidth || s.radius !== undefined || (!!s.shadow && s.shadow !== "none");
  const textActive =
    !!s.fontFamily ||
    s.fontSize !== undefined ||
    !!s.textColorToken ||
    !!s.highlightColorToken ||
    !!s.align;
  const layoutActive =
    !!s.selfAlign ||
    !!s.width ||
    !!s.height ||
    !!s.marginTop ||
    !!s.marginBottom ||
    !!s.paddingTop ||
    !!s.paddingRight ||
    !!s.paddingBottom ||
    !!s.paddingLeft;
  const containerActive = s.colSpan !== undefined || s.rowSpan !== undefined;
  const animationsActive =
    (!!s.animation && s.animation !== "none") ||
    (!!s.hover && s.hover !== "none");

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">Section style</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {/* 1. Background */}
        <ToolbarPopover title="Background" Icon={PaintBucket} active={bgActive}>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Color</span>
            <ColorSwatchRow value={s.bgColorToken} onChange={(t) => set({ bgColorToken: t })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Image</span>
            <SingleImagePicker
              value={s.bgImagePublicId ?? ""}
              onChange={(pid) => set({ bgImagePublicId: pid || undefined })}
            />
          </div>
        </ToolbarPopover>

        {/* 2. Borders (border width/color + radius + shadow consolidated) */}
        <ToolbarPopover title="Borders" Icon={Square} active={bordersActive}>
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
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Shadow</span>
            <div className="flex flex-wrap gap-1.5">
              {SHADOW_SIZES.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  aria-pressed={(s.shadow ?? "none") === sz}
                  onClick={() => set({ shadow: sz })}
                  className={cn(
                    toolbarButtonBase,
                    "size-auto px-2 py-1.5 text-sm",
                    (s.shadow ?? "none") === sz && "border-foreground bg-accent"
                  )}
                >
                  {SHADOW_LABEL[sz]}
                </button>
              ))}
            </div>
          </div>
        </ToolbarPopover>

        <span className="mx-0.5 h-7 w-px bg-border" aria-hidden />

        {/* 3. Text — bold/italic/underline inline; rest in popover */}
        <ToolbarToggle active={!!s.bold} title="Bold" Icon={Bold} onClick={() => set({ bold: !s.bold })} />
        <ToolbarToggle active={!!s.italic} title="Italic" Icon={Italic} onClick={() => set({ italic: !s.italic })} />
        <ToolbarToggle
          active={!!s.underline}
          title="Underline"
          Icon={Underline}
          onClick={() => set({ underline: !s.underline })}
        />

        <ToolbarPopover title="Text" Icon={Type} active={textActive}>
          <label className="flex flex-col gap-1 text-sm">
            <span>Font</span>
            <select
              value={s.fontFamily ?? ""}
              onChange={(e) =>
                set({ fontFamily: e.target.value ? (e.target.value as PortfolioFontKey) : undefined })
              }
              className="h-9 cursor-pointer border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Theme font</option>
              {PORTFOLIO_FONT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {PORTFOLIO_FONTS[key].label}
                </option>
              ))}
            </select>
          </label>

          <NumberInputRow
            label="Font size"
            value={s.fontSize}
            min={STYLE_LIMITS.fontSize.min}
            max={STYLE_LIMITS.fontSize.max}
            onChange={(v) => set({ fontSize: v })}
          />

          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Baseline className="size-3.5" aria-hidden /> Text color
            </span>
            <ColorSwatchRow value={s.textColorToken} onChange={(t) => set({ textColorToken: t })} />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Highlighter className="size-3.5" aria-hidden /> Highlight
            </span>
            <ColorSwatchRow value={s.highlightColorToken} onChange={(t) => set({ highlightColorToken: t })} />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Alignment</span>
            <div className="flex items-center gap-1.5">
              {ALIGNS.map(({ value: a, label, Icon }) => (
                <ToolbarToggle
                  key={a}
                  active={s.align === a}
                  title={label}
                  Icon={Icon}
                  onClick={() => set({ align: s.align === a ? undefined : a })}
                />
              ))}
            </div>
          </div>
        </ToolbarPopover>

        <span className="mx-0.5 h-7 w-px bg-border" aria-hidden />

        {/* 4. Layout */}
        <ToolbarPopover title="Layout" Icon={LayoutGrid} active={layoutActive}>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Position</span>
            <div className="flex items-center gap-1.5">
              {SELF_ALIGNS.map(({ value: a, label, Icon }) => (
                <ToolbarToggle
                  key={a}
                  active={s.selfAlign === a}
                  title={label}
                  Icon={Icon}
                  onClick={() => set({ selfAlign: s.selfAlign === a ? undefined : a })}
                />
              ))}
            </div>
          </div>

          <DimensionInput
            label="Width"
            value={s.width}
            onChange={(v) => set({ width: v })}
          />
          <DimensionInput
            label="Height"
            value={s.height}
            onChange={(v) => set({ height: v })}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Margin</span>
            <DimensionInput
              label="Margin top"
              value={s.marginTop}
              onChange={(v) => set({ marginTop: v })}
            />
            <DimensionInput
              label="Margin bottom"
              value={s.marginBottom}
              onChange={(v) => set({ marginBottom: v })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Padding</span>
            <DimensionInput
              label="Padding top"
              value={s.paddingTop}
              onChange={(v) => set({ paddingTop: v })}
            />
            <DimensionInput
              label="Padding right"
              value={s.paddingRight}
              onChange={(v) => set({ paddingRight: v })}
            />
            <DimensionInput
              label="Padding bottom"
              value={s.paddingBottom}
              onChange={(v) => set({ paddingBottom: v })}
            />
            <DimensionInput
              label="Padding left"
              value={s.paddingLeft}
              onChange={(v) => set({ paddingLeft: v })}
            />
          </div>
        </ToolbarPopover>

        {/* 5. Container (grid placement) */}
        <ToolbarPopover title="Container" Icon={Columns3} active={containerActive}>
          <NumberInputRow
            label="Column span"
            value={s.colSpan}
            min={1}
            max={12}
            suffix="cols"
            onChange={(v) => set({ colSpan: v })}
          />
          <NumberInputRow
            label="Row span"
            value={s.rowSpan}
            min={1}
            max={12}
            suffix="rows"
            onChange={(v) => set({ rowSpan: v })}
          />
        </ToolbarPopover>

        {/* 6. Animations */}
        <ToolbarPopover title="Animations" Icon={Sparkles} active={animationsActive}>
          <label className="flex flex-col gap-1 text-sm">
            <span>Entrance</span>
            <select
              value={s.animation ?? "none"}
              onChange={(e) => set({ animation: e.target.value as AnimationType })}
              className="h-9 cursor-pointer border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {ANIMATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ANIMATION_LABEL[type]}
                </option>
              ))}
            </select>
          </label>

          <NumberInputRow
            label="Duration"
            value={s.animationDuration}
            min={50}
            max={5000}
            suffix="ms"
            onChange={(v) => set({ animationDuration: v })}
          />

          <label className="flex flex-col gap-1 text-sm">
            <span>Hover effect</span>
            <select
              value={s.hover ?? "none"}
              onChange={(e) => set({ hover: e.target.value as HoverEffect })}
              className="h-9 cursor-pointer border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {HOVER_EFFECTS.map((effect) => (
                <option key={effect} value={effect}>
                  {HOVER_LABEL[effect]}
                </option>
              ))}
            </select>
          </label>
        </ToolbarPopover>
      </div>
    </div>
  );
}
