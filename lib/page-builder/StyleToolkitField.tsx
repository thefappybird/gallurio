"use client";

/**
 * StyleToolkitField — the block-level styling toolbar (`_style` custom Puck
 * field), shown as the FIRST section of every block's edit form. It controls
 * SECTION styling only: background, border, radius, shadow, padding, margin.
 *
 * Text formatting (bold/italic/underline, font, size, color, highlight, align)
 * now lives PER TEXT FIELD via `RichTextField` — so each headline/paragraph is
 * styled independently and the controls only appear when that field is active.
 * `BlockStyle` still carries its legacy text props (resolved by
 * `resolveBlockStyle`) for back-compat with portfolios saved before this split.
 *
 * Editor chrome → English-only (RELEASE-CHECKLIST §4f).
 */

import { PaintBucket, Square, Frame, Layers, Scaling, MoveVertical } from "lucide-react";
import { SingleImagePicker } from "./galleryPicker/SingleImagePicker";
import {
  ToolbarPopover,
  ColorSwatchRow,
  NumberInputRow,
  toolbarButtonBase,
} from "./toolbarPrimitives";
import { cn } from "@/lib/utils";
import { STYLE_LIMITS, SHADOW_SIZES, type BlockStyle, type ShadowSize } from "./styleToolkit";

const SHADOW_LABEL: Record<ShadowSize, string> = {
  none: "None",
  sm: "Small",
  md: "Medium",
  lg: "Large",
};

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
      <span className="text-xs font-medium text-muted-foreground">Section style</span>
      <div className="flex flex-wrap gap-1.5">
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
      </div>
    </div>
  );
}
