"use client";

import { useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { NumberInputRow } from "@/lib/page-builder/toolbarPrimitives";
import {
  BRAND_KIT_RADII,
  CONTACT_BUTTON_COLORS,
  type BrandKitRadius,
  type PortfolioBrandKit,
  type PortfolioCollectionsPopupConfig,
} from "@/lib/page-builder/types";

// ---------------------------------------------------------------------------
// Radius scale for live preview
// ---------------------------------------------------------------------------

const RADIUS_PX: Record<BrandKitRadius, string> = {
  sharp: "0px",
  subtle: "6px",
  rounded: "16px",
};

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
// Preview helpers
// ---------------------------------------------------------------------------

function resolveColorValue(
  token: string | undefined,
  brandKit: PortfolioBrandKit,
): string | undefined {
  if (!token) return undefined;
  if (token.startsWith("#")) return token;
  const key = token as (typeof CONTACT_BUTTON_COLORS)[number];
  if ((CONTACT_BUTTON_COLORS as readonly string[]).includes(key)) {
    return resolveSwatchHex(key, brandKit);
  }
  return token;
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

type DrawerId = "popup";

export function CollectionsPopupPanelDialog({
  config,
  onChange,
  brandKit,
}: Props) {
  const [openDrawer, setOpenDrawer] = useState<DrawerId | null>("popup");

  function set<K extends keyof PortfolioCollectionsPopupConfig>(
    key: K,
    value: PortfolioCollectionsPopupConfig[K],
  ) {
    onChange({ ...config, [key]: value });
  }

  // Preview styles
  const previewBg = resolveColorValue(config.backgroundColor, brandKit);
  const previewBorderColor = resolveColorValue(config.borderColor, brandKit);
  const previewBorderWidth = config.borderWidth ?? 0;
  const radiusValue = config.radius;
  const activeRadius =
    radiusValue && (BRAND_KIT_RADII as readonly string[]).includes(radiusValue)
      ? (radiusValue as BrandKitRadius)
      : undefined;
  const previewRadius = activeRadius ? RADIUS_PX[activeRadius] : "0px";

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

      {/* Live preview */}
      <div className="flex items-center justify-center border-b border-border bg-muted/30 p-4">
        <div
          data-testid="collections-popup-preview"
          aria-hidden
          style={{
            width: "140px",
            height: "80px",
            backgroundColor: previewBg ?? "var(--background)",
            borderWidth: previewBorderWidth > 0 ? `${previewBorderWidth}px` : "1px",
            borderStyle: "solid",
            borderColor:
              previewBorderWidth > 0 && previewBorderColor
                ? previewBorderColor
                : "var(--border)",
            borderRadius: previewRadius,
          }}
        />
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
        </div>
      </div>
    </div>
  );
}
