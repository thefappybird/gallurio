"use client";

import { useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { NumberInputRow } from "@/lib/page-builder/toolbarPrimitives";
import { PORTFOLIO_FONT_KEYS, PORTFOLIO_FONTS } from "@/lib/page-builder/fonts";
import type { PortfolioFontKey } from "@/lib/page-builder/fonts";
import {
  BRAND_KIT_RADII,
  CONTACT_BUTTON_COLORS,
  type BrandKitRadius,
  type PortfolioBrandKit,
  type PortfolioCollectionsPopupConfig,
} from "@/lib/page-builder/types";

// ---------------------------------------------------------------------------
// Shared panel primitives (inlined — same pattern as ContactPanelDialog)
// ---------------------------------------------------------------------------

function resolveSwatchHex(
  token: (typeof CONTACT_BUTTON_COLORS)[number],
  brandKit: PortfolioBrandKit,
): string {
  switch (token) {
    case "primary":    return brandKit.primaryColor;
    case "secondary":  return brandKit.secondaryColor;
    case "accent":     return brandKit.accentColor;
    case "background": return brandKit.backgroundColor;
    case "foreground": return brandKit.foregroundColor;
  }
}

function ColorSwatchRow({
  label,
  active,
  brandKit,
  onToggle,
  allowNone = true,
}: {
  label: string;
  active: string | undefined;
  brandKit: PortfolioBrandKit;
  onToggle: (color: string | undefined) => void;
  allowNone?: boolean;
}) {
  const isCustomHex =
    typeof active === "string" &&
    active.startsWith("#") &&
    !(CONTACT_BUTTON_COLORS as readonly string[]).includes(active);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {CONTACT_BUTTON_COLORS.map((colorToken) => {
          const hex = resolveSwatchHex(colorToken, brandKit);
          const isActive = active === colorToken;
          return (
            <button
              key={colorToken}
              type="button"
              aria-label={colorToken}
              aria-pressed={isActive}
              onClick={() => onToggle(isActive ? undefined : colorToken)}
              style={{ backgroundColor: hex }}
              className={cn(
                "size-7 cursor-pointer border border-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isActive && "ring-2 ring-foreground ring-offset-1 ring-offset-background",
              )}
            />
          );
        })}
        {allowNone && (
          <button
            type="button"
            onClick={() => onToggle(undefined)}
            title="Reset"
            aria-label="Reset color"
            className="inline-flex size-7 cursor-pointer items-center justify-center border border-border bg-background text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <RotateCcw className="size-3.5" aria-hidden />
          </button>
        )}
        <label
          title="Custom color"
          aria-label="Custom color"
          className={cn(
            "relative size-7 cursor-pointer overflow-hidden border border-border focus-within:ring-1 focus-within:ring-ring",
            isCustomHex && "ring-2 ring-foreground ring-offset-1 ring-offset-background",
          )}
          style={{ background: isCustomHex ? active : undefined }}
        >
          <input
            type="color"
            value={isCustomHex ? active : "#000000"}
            onChange={(e) => onToggle(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Pick custom color"
          />
          {!isCustomHex && (
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
                opacity: 0.85,
              }}
            />
          )}
        </label>
      </div>
    </div>
  );
}

function BorderRow({
  widthLabel,
  colorLabel,
  width,
  color,
  brandKit,
  onWidthChange,
  onColorChange,
}: {
  widthLabel: string;
  colorLabel: string;
  width: number | undefined;
  color: string | undefined;
  brandKit: PortfolioBrandKit;
  onWidthChange: (v: number | undefined) => void;
  onColorChange: (v: string | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <NumberInputRow
        label={widthLabel}
        value={width}
        min={0}
        max={12}
        onChange={onWidthChange}
      />
      {!!width && (
        <ColorSwatchRow
          label={colorLabel}
          active={color}
          brandKit={brandKit}
          onToggle={onColorChange}
          allowNone={false}
        />
      )}
    </div>
  );
}

function RadiusRow({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: BrandKitRadius | "" | undefined;
  onToggle: (radius: BrandKitRadius | "") => void;
}) {
  const radiusLabels: Record<BrandKitRadius, string> = {
    sharp: "Sharp",
    subtle: "Subtle",
    rounded: "Rounded",
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex">
        {BRAND_KIT_RADII.map((r) => {
          const isActive = active === r;
          return (
            <button
              key={r}
              type="button"
              aria-label={radiusLabels[r]}
              aria-pressed={isActive}
              onClick={() => onToggle(isActive ? "" : r)}
              className={cn(
                "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isActive && "bg-foreground text-background hover:bg-foreground",
              )}
            >
              {radiusLabels[r]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DesignDrawer({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border bg-background">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-11 w-full cursor-pointer items-center justify-between px-3 text-left text-xs font-semibold uppercase tracking-widest text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span>{title}</span>
        <ChevronDown
          className={cn("size-4 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && (
        <div className="flex flex-col gap-4 border-t border-border p-3">
          {children}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Props = {
  config: PortfolioCollectionsPopupConfig;
  onChange: (c: PortfolioCollectionsPopupConfig) => void;
  brandKit: PortfolioBrandKit;
  onSaved?: () => void;
  onCancel?: () => void;
};

type DrawerId = "popup" | "header";
type SubDrawerId = "title" | "button";

export function CollectionsPopupPanelDialog({
  config,
  onChange,
  brandKit,
}: Props) {
  const [openDrawer, setOpenDrawer] = useState<DrawerId | null>("popup");
  const [openSub, setOpenSub] = useState<SubDrawerId | null>(null);

  function set<K extends keyof PortfolioCollectionsPopupConfig>(
    key: K,
    value: PortfolioCollectionsPopupConfig[K],
  ) {
    onChange({ ...config, [key]: value });
  }

  return (
    <div
      className="flex w-[360px] flex-col border-l border-border bg-card"
      role="complementary"
      aria-label="Collections popup style"
    >
      {/* Header */}
      <div className="flex items-center border-b border-border px-4 py-3">
        <span className="text-sm font-semibold text-foreground">
          Collections popup
        </span>
      </div>

      {/* Scrollable controls */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="flex flex-col gap-6">
          <DesignDrawer
            title="Popup"
            open={openDrawer === "popup"}
            onToggle={() =>
              setOpenDrawer((current) =>
                current === "popup" ? null : "popup",
              )
            }
          >
            <ColorSwatchRow
              label="Background"
              active={config.backgroundColor}
              brandKit={brandKit}
              onToggle={(c) => set("backgroundColor", c)}
            />

            <BorderRow
              widthLabel="Border"
              colorLabel="Border color"
              width={config.borderWidth}
              color={config.borderColor}
              brandKit={brandKit}
              onWidthChange={(v) => set("borderWidth", v)}
              onColorChange={(v) => set("borderColor", v)}
            />

            <RadiusRow
              label="Corners"
              active={config.radius}
              onToggle={(r) => set("radius", r)}
            />
          </DesignDrawer>

          <DesignDrawer
            title="Header styles"
            open={openDrawer === "header"}
            onToggle={() => setOpenDrawer((c) => (c === "header" ? null : "header"))}
          >
            <DesignDrawer
              title="Title styles"
              open={openSub === "title"}
              onToggle={() => setOpenSub((c) => (c === "title" ? null : "title"))}
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground" htmlFor="popup-title-text">
                  Header text
                </label>
                <input
                  id="popup-title-text"
                  type="text"
                  value={config.titleText ?? ""}
                  placeholder="Defaults to collection name"
                  onChange={(e) => set("titleText", e.target.value || undefined)}
                  className="h-8 border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" aria-pressed={!!config.titleBold} aria-label="Bold"
                  onClick={() => set("titleBold", !config.titleBold)}
                  className={cn("inline-flex h-7 w-7 items-center justify-center border border-border bg-background text-xs font-bold", config.titleBold && "bg-foreground text-background")}>B</button>
                <button type="button" aria-pressed={!!config.titleItalic} aria-label="Italic"
                  onClick={() => set("titleItalic", !config.titleItalic)}
                  className={cn("inline-flex h-7 w-7 items-center justify-center border border-border bg-background text-xs italic", config.titleItalic && "bg-foreground text-background")}>I</button>
                <button type="button" aria-pressed={!!config.titleUnderline} aria-label="Underline"
                  onClick={() => set("titleUnderline", !config.titleUnderline)}
                  className={cn("inline-flex h-7 w-7 items-center justify-center border border-border bg-background text-xs underline", config.titleUnderline && "bg-foreground text-background")}>U</button>
                {(["left", "center", "right"] as const).map((a) => (
                  <button key={a} type="button" aria-pressed={config.titleAlign === a} aria-label={`Align ${a}`}
                    onClick={() => set("titleAlign", config.titleAlign === a ? undefined : a)}
                    className={cn("inline-flex h-7 w-7 items-center justify-center border border-border bg-background text-xs", config.titleAlign === a && "bg-foreground text-background")}>
                    {a === "left" ? "L" : a === "center" ? "C" : "R"}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="shrink-0 text-xs text-muted-foreground">Font</span>
                <select
                  value={config.titleFontFamily ?? ""}
                  onChange={(e) => set("titleFontFamily", (e.target.value || undefined) as PortfolioFontKey | undefined)}
                  className="h-7 cursor-pointer border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Theme font</option>
                  {PORTFOLIO_FONT_KEYS.map((key) => (
                    <option key={key} value={key}>{PORTFOLIO_FONTS[key].label}</option>
                  ))}
                </select>
              </div>

              <NumberInputRow
                label="Font size"
                value={config.titleFontSize}
                min={10}
                max={120}
                suffix="px"
                onChange={(v) => set("titleFontSize", v)}
              />

              <ColorSwatchRow
                label="Title color"
                active={config.titleColorToken}
                brandKit={brandKit}
                onToggle={(c) => set("titleColorToken", c)}
              />
            </DesignDrawer>

            <DesignDrawer
              title="Button styles"
              open={openSub === "button"}
              onToggle={() => setOpenSub((c) => (c === "button" ? null : "button"))}
            >
              <NumberInputRow
                label="Button size"
                value={config.closeButtonSize}
                min={24}
                max={72}
                suffix="px"
                onChange={(v) => set("closeButtonSize", v)}
              />
              <RadiusRow
                label="Corners"
                active={config.closeButtonRadius}
                onToggle={(r) => set("closeButtonRadius", r)}
              />
              <BorderRow
                widthLabel="Border"
                colorLabel="Border color"
                width={config.closeButtonBorderWidth}
                color={config.closeButtonBorderColorToken}
                brandKit={brandKit}
                onWidthChange={(v) => set("closeButtonBorderWidth", v)}
                onColorChange={(v) => set("closeButtonBorderColorToken", v)}
              />
              <NumberInputRow
                label="Opacity"
                value={config.closeButtonOpacity}
                min={0}
                max={100}
                suffix="%"
                onChange={(v) => set("closeButtonOpacity", v)}
              />
              <ColorSwatchRow
                label="Background"
                active={config.closeButtonBgColorToken}
                brandKit={brandKit}
                onToggle={(c) => set("closeButtonBgColorToken", c)}
              />
            </DesignDrawer>
          </DesignDrawer>
        </div>
      </div>
    </div>
  );
}
