"use client";

/**
 * StyleToolkitField — the Canva-style icon toolbar shown as the FIRST section of
 * every block's edit form (the `_style` custom Puck field). Each button has an
 * SVG icon, a hover title, and (where it has options) a popover. Output is a
 * `BlockStyle` consumed by `resolveBlockStyle` in both the editor preview and the
 * production render. Editor chrome → English-only (RELEASE-CHECKLIST §4f).
 */

import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  ALargeSmall,
  Palette,
  PaintBucket,
  Square,
  Frame,
  Layers,
  Scaling,
  MoveVertical,
  type LucideIcon,
} from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { SingleImagePicker } from "./galleryPicker/SingleImagePicker";
import { cn } from "@/lib/utils";
import {
  STYLE_COLOR_TOKENS,
  STYLE_LIMITS,
  SHADOW_SIZES,
  type BlockStyle,
  type StyleColorToken,
  type ShadowSize,
  type TextAlign,
} from "./styleToolkit";
import { BRAND_KIT_FONT_PAIRS, type BrandKitFontPair } from "./types";

const COLOR_VAR: Record<StyleColorToken, string> = {
  primary: "var(--pf-color-primary)",
  secondary: "var(--pf-color-secondary)",
  accent: "var(--pf-color-accent)",
  background: "var(--pf-color-bg)",
  foreground: "var(--pf-color-fg)",
};

const COLOR_LABEL: Record<StyleColorToken, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  background: "Background",
  foreground: "Text",
};

const FONT_LABEL: Record<BrandKitFontPair, string> = {
  "merriweather-only": "Merriweather",
  "playfair-inter": "Playfair · Inter",
  "dm-serif-dm-sans": "DM Serif · DM Sans",
  "cormorant-montserrat": "Cormorant · Montserrat",
  "fraunces-inter": "Fraunces · Inter",
};

const SHADOW_LABEL: Record<ShadowSize, string> = {
  none: "None",
  sm: "Small",
  md: "Medium",
  lg: "Large",
};

const ALIGNS: { value: TextAlign; label: string; Icon: LucideIcon }[] = [
  { value: "left", label: "Align left", Icon: AlignLeft },
  { value: "center", label: "Align center", Icon: AlignCenter },
  { value: "right", label: "Align right", Icon: AlignRight },
];

const buttonBase =
  "inline-flex size-9 items-center justify-center border border-border bg-background text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function ToolbarToggle({
  active,
  title,
  onClick,
  Icon,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  Icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={cn(buttonBase, active && "bg-foreground text-background hover:bg-foreground")}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

function ToolbarPopover({
  title,
  Icon,
  active,
  children,
}: {
  title: string;
  Icon: LucideIcon;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger
        title={title}
        aria-label={title}
        className={cn(buttonBase, active && "ring-1 ring-ring")}
      >
        <Icon className="size-4" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SwatchRow({
  value,
  onChange,
  allowNone = true,
}: {
  value: StyleColorToken | undefined;
  onChange: (next: StyleColorToken | undefined) => void;
  allowNone?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STYLE_COLOR_TOKENS.map((token) => (
        <button
          key={token}
          type="button"
          title={COLOR_LABEL[token]}
          aria-label={COLOR_LABEL[token]}
          aria-pressed={value === token}
          onClick={() => onChange(token)}
          className={cn(
            "size-7 border border-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            value === token && "ring-2 ring-foreground ring-offset-1 ring-offset-background"
          )}
          style={{ background: COLOR_VAR[token] }}
        />
      ))}
      {allowNone && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="h-7 border border-border px-2 text-xs text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          None
        </button>
      )}
    </div>
  );
}

function NumberRow({
  label,
  value,
  fallback,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number | undefined;
  fallback: number;
  min: number;
  max: number;
  onChange: (next: number | undefined) => void;
}) {
  const current = value ?? fallback;
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="flex items-center justify-between">
        <span>{label}</span>
        <span className="text-xs text-muted-foreground">{current}px</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  );
}

export function StyleToolkitField({
  value,
  onChange,
}: {
  value: BlockStyle | undefined;
  onChange: (next: BlockStyle) => void;
}) {
  const s = value ?? {};
  const set = (patch: Partial<BlockStyle>) => onChange({ ...s, ...patch });

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">Style</span>
      <div className="flex flex-wrap gap-1.5">
        {/* Text formatting */}
        <ToolbarToggle active={!!s.bold} title="Bold" Icon={Bold} onClick={() => set({ bold: !s.bold })} />
        <ToolbarToggle active={!!s.italic} title="Italic" Icon={Italic} onClick={() => set({ italic: !s.italic })} />
        <ToolbarToggle
          active={!!s.underline}
          title="Underline"
          Icon={Underline}
          onClick={() => set({ underline: !s.underline })}
        />

        {/* Alignment */}
        <ToolbarPopover title="Text alignment" Icon={AlignLeft} active={!!s.align}>
          <div className="flex gap-1.5">
            {ALIGNS.map(({ value: a, label, Icon }) => (
              <ToolbarToggle key={a} active={s.align === a} title={label} Icon={Icon} onClick={() => set({ align: a })} />
            ))}
            <button
              type="button"
              onClick={() => set({ align: undefined })}
              className="h-9 border border-border px-2 text-xs text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Reset
            </button>
          </div>
        </ToolbarPopover>

        {/* Font family */}
        <ToolbarPopover title="Font" Icon={Type} active={!!s.fontPair}>
          <div className="flex flex-col gap-1">
            {BRAND_KIT_FONT_PAIRS.map((fp) => (
              <button
                key={fp}
                type="button"
                aria-pressed={s.fontPair === fp}
                onClick={() => set({ fontPair: fp })}
                className={cn(
                  "border border-border px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  s.fontPair === fp && "border-foreground bg-accent"
                )}
              >
                {FONT_LABEL[fp]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => set({ fontPair: undefined })}
              className="px-2 py-1 text-left text-xs text-muted-foreground hover:underline"
            >
              Use template font
            </button>
          </div>
        </ToolbarPopover>

        {/* Font size */}
        <ToolbarPopover title="Text size" Icon={ALargeSmall} active={s.fontSize !== undefined}>
          <NumberRow
            label="Text size"
            value={s.fontSize}
            fallback={16}
            min={STYLE_LIMITS.fontSize.min}
            max={STYLE_LIMITS.fontSize.max}
            onChange={(v) => set({ fontSize: v })}
          />
          <button
            type="button"
            onClick={() => set({ fontSize: undefined })}
            className="self-start text-xs text-muted-foreground hover:underline"
          >
            Reset
          </button>
        </ToolbarPopover>

        {/* Text color */}
        <ToolbarPopover title="Text color" Icon={Palette} active={!!s.textColorToken}>
          <SwatchRow value={s.textColorToken} onChange={(t) => set({ textColorToken: t })} />
        </ToolbarPopover>

        {/* Background */}
        <ToolbarPopover title="Background" Icon={PaintBucket} active={!!s.bgColorToken || !!s.bgImagePublicId}>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Color</span>
            <SwatchRow value={s.bgColorToken} onChange={(t) => set({ bgColorToken: t })} />
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
          <NumberRow
            label="Border width"
            value={s.borderWidth}
            fallback={0}
            min={STYLE_LIMITS.borderWidth.min}
            max={STYLE_LIMITS.borderWidth.max}
            onChange={(v) => set({ borderWidth: v })}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Border color</span>
            <SwatchRow value={s.borderColorToken} onChange={(t) => set({ borderColorToken: t })} allowNone={false} />
          </div>
        </ToolbarPopover>

        {/* Radius */}
        <ToolbarPopover title="Corner radius" Icon={Frame} active={s.radius !== undefined}>
          <NumberRow
            label="Corner radius"
            value={s.radius}
            fallback={0}
            min={STYLE_LIMITS.radius.min}
            max={STYLE_LIMITS.radius.max}
            onChange={(v) => set({ radius: v })}
          />
          <button
            type="button"
            onClick={() => set({ radius: undefined })}
            className="self-start text-xs text-muted-foreground hover:underline"
          >
            Reset
          </button>
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
                  "border border-border px-2 py-1.5 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
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
          <NumberRow
            label="Vertical padding"
            value={s.paddingY}
            fallback={0}
            min={STYLE_LIMITS.paddingY.min}
            max={STYLE_LIMITS.paddingY.max}
            onChange={(v) => set({ paddingY: v })}
          />
          <NumberRow
            label="Horizontal padding"
            value={s.paddingX}
            fallback={0}
            min={STYLE_LIMITS.paddingX.min}
            max={STYLE_LIMITS.paddingX.max}
            onChange={(v) => set({ paddingX: v })}
          />
        </ToolbarPopover>

        {/* Margin */}
        <ToolbarPopover title="Margin" Icon={MoveVertical} active={s.marginY !== undefined}>
          <NumberRow
            label="Vertical margin"
            value={s.marginY}
            fallback={0}
            min={STYLE_LIMITS.marginY.min}
            max={STYLE_LIMITS.marginY.max}
            onChange={(v) => set({ marginY: v })}
          />
        </ToolbarPopover>
      </div>
    </div>
  );
}
