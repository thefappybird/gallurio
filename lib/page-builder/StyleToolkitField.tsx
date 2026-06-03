"use client";

/**
 * StyleToolkitField — the block-level styling toolbar (`_style` custom Puck
 * field), shown as the FIRST section of every block's edit form. It is the
 * SINGLE toolkit: section styling (background, border, radius, shadow, padding,
 * margin) PLUS text formatting (bold/italic/underline, alignment, font, size,
 * text color, highlight) — all applied SECTION-WIDE to the whole block via
 * `resolveBlockStyle`.
 *
 * Editor chrome → English-only (RELEASE-CHECKLIST §4f).
 */

import {
  PaintBucket,
  Square,
  Frame,
  Layers,
  Scaling,
  MoveVertical,
  Bold,
  Italic,
  Underline,
  Type,
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
  toolbarButtonBase,
} from "./toolbarPrimitives";
import { cn } from "@/lib/utils";
import { STYLE_LIMITS, SHADOW_SIZES, type BlockStyle, type ShadowSize, type TextAlign } from "./styleToolkit";
import { PORTFOLIO_FONT_KEYS, PORTFOLIO_FONTS, type PortfolioFontKey } from "./fonts";

const SHADOW_LABEL: Record<ShadowSize, string> = {
  none: "None",
  sm: "Small",
  md: "Medium",
  lg: "Large",
};

const ALIGNS: { value: TextAlign; label: string; Icon: typeof AlignLeft }[] = [
  { value: "left", label: "Align left", Icon: AlignLeft },
  { value: "center", label: "Align center", Icon: AlignCenter },
  { value: "right", label: "Align right", Icon: AlignRight },
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

  const textActive =
    !!s.bold ||
    !!s.italic ||
    !!s.underline ||
    !!s.align ||
    !!s.fontFamily ||
    s.fontSize !== undefined ||
    !!s.textColorToken ||
    !!s.highlightColorToken;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">Section style</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Background */}
        <ToolbarPopover title="Background" Icon={PaintBucket} active={!!s.bgColorToken || !!s.bgImagePublicId}>
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

        {/* Border */}
        <ToolbarPopover title="Border" Icon={Square} active={!!s.borderWidth}>
          <NumberInputRow
            label="Border width"
            value={s.borderWidth}
            min={STYLE_LIMITS.borderWidth.min}
            max={STYLE_LIMITS.borderWidth.max}
            onChange={(v) => set({ borderWidth: v })}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Border color</span>
            <ColorSwatchRow value={s.borderColorToken} onChange={(t) => set({ borderColorToken: t })} allowNone={false} />
          </div>
        </ToolbarPopover>

        {/* Radius */}
        <ToolbarPopover title="Corner radius" Icon={Frame} active={s.radius !== undefined}>
          <NumberInputRow
            label="Corner radius"
            value={s.radius}
            min={STYLE_LIMITS.radius.min}
            max={STYLE_LIMITS.radius.max}
            onChange={(v) => set({ radius: v })}
          />
        </ToolbarPopover>

        {/* Shadow */}
        <ToolbarPopover title="Shadow" Icon={Layers} active={!!s.shadow && s.shadow !== "none"}>
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
        </ToolbarPopover>

        {/* Padding */}
        <ToolbarPopover title="Padding" Icon={Scaling} active={s.paddingX !== undefined || s.paddingY !== undefined}>
          <NumberInputRow
            label="Vertical padding"
            value={s.paddingY}
            min={STYLE_LIMITS.paddingY.min}
            max={STYLE_LIMITS.paddingY.max}
            onChange={(v) => set({ paddingY: v })}
          />
          <NumberInputRow
            label="Horizontal padding"
            value={s.paddingX}
            min={STYLE_LIMITS.paddingX.min}
            max={STYLE_LIMITS.paddingX.max}
            onChange={(v) => set({ paddingX: v })}
          />
        </ToolbarPopover>

        {/* Margin */}
        <ToolbarPopover title="Margin" Icon={MoveVertical} active={s.marginY !== undefined}>
          <NumberInputRow
            label="Vertical margin"
            value={s.marginY}
            min={STYLE_LIMITS.marginY.min}
            max={STYLE_LIMITS.marginY.max}
            onChange={(v) => set({ marginY: v })}
          />
        </ToolbarPopover>

        <span className="mx-0.5 h-7 w-px bg-border" aria-hidden />

        {/* Text formatting (section-wide) */}
        <ToolbarToggle active={!!s.bold} title="Bold" Icon={Bold} onClick={() => set({ bold: !s.bold })} />
        <ToolbarToggle active={!!s.italic} title="Italic" Icon={Italic} onClick={() => set({ italic: !s.italic })} />
        <ToolbarToggle
          active={!!s.underline}
          title="Underline"
          Icon={Underline}
          onClick={() => set({ underline: !s.underline })}
        />

        {/* Font / size / color / highlight / alignment */}
        <ToolbarPopover title="Text" Icon={Type} active={textActive}>
          <label className="flex flex-col gap-1 text-sm">
            <span>Font</span>
            <select
              value={s.fontFamily ?? ""}
              onChange={(e) => set({ fontFamily: e.target.value ? (e.target.value as PortfolioFontKey) : undefined })}
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
      </div>
    </div>
  );
}
