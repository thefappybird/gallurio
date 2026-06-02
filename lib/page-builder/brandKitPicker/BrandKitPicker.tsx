"use client";

import { useTranslations } from "next-intl";
import {
  BRAND_KIT_THEME_PRESETS,
  BRAND_KIT_FONT_PAIRS,
  type PortfolioBrandKit,
  type BrandKitThemePreset,
  type BrandKitFontPair,
} from "@/lib/page-builder/types";
import { THEME_PRESET_SWATCHES, FONT_PAIR_SAMPLES } from "./themePresetSwatches";
import { ColorPicker } from "@/components/ui/color-picker";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// Quick-pick swatches shown above the spectrum — Gallurio brand shades plus a
// few versatile neutrals/accents. Owners can still pick any custom color.
const BRAND_PRESETS = [
  "#111111",
  "#ffffff",
  "#f5f5f5",
  "#2f5d56",
  "#5fb3a8",
  "#7c5cff",
  "#e87a4f",
  "#c9aa55",
] as const;

type ColorKey = "primaryColor" | "secondaryColor" | "accentColor" | "backgroundColor" | "foregroundColor";
const COLOR_KEYS: ColorKey[] = [
  "primaryColor",
  "secondaryColor",
  "accentColor",
  "backgroundColor",
  "foregroundColor",
];

type Props = {
  value: PortfolioBrandKit;
  onChange: (next: PortfolioBrandKit) => void;
  /** When provided, enables a "use workspace branding" shortcut for the colors. */
  workspaceBranding?: { primaryColor?: string; secondaryColor?: string } | null;
};

export function BrandKitPicker({ value, onChange, workspaceBranding }: Props) {
  const t = useTranslations("app.pageBuilder.brandKit");

  function set<K extends keyof PortfolioBrandKit>(key: K, v: PortfolioBrandKit[K]) {
    onChange({ ...value, [key]: v });
  }

  function useWorkspaceBranding() {
    if (!workspaceBranding) return;
    const next = { ...value };
    if (workspaceBranding.primaryColor && HEX_RE.test(workspaceBranding.primaryColor)) {
      next.primaryColor = workspaceBranding.primaryColor;
    }
    if (workspaceBranding.secondaryColor && HEX_RE.test(workspaceBranding.secondaryColor)) {
      next.secondaryColor = workspaceBranding.secondaryColor;
    }
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Theme preset */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t("themePreset")}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BRAND_KIT_THEME_PRESETS.map((preset: BrandKitThemePreset) => {
            const sw = THEME_PRESET_SWATCHES[preset];
            const active = value.themePreset === preset;
            return (
              <button
                key={preset}
                type="button"
                aria-pressed={active}
                onClick={() => set("themePreset", preset)}
                className={cn(
                  "flex min-h-11 items-center gap-2 border p-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  active ? "border-foreground" : "border-border hover:bg-accent/40"
                )}
              >
                <span
                  className="size-7 shrink-0 border border-border"
                  style={{ background: sw.bg }}
                  aria-hidden
                >
                  <span className="block size-full" style={{ background: `linear-gradient(135deg, ${sw.accent} 50%, ${sw.fg} 50%)`, opacity: 0.85 }} />
                </span>
                <span className="capitalize">{t(`presets.${preset}`)}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Font pairing */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t("fontPair")}</legend>
        <div className="flex flex-col gap-2">
          {BRAND_KIT_FONT_PAIRS.map((pair: BrandKitFontPair) => {
            const sample = FONT_PAIR_SAMPLES[pair];
            const active = value.fontPair === pair;
            return (
              <button
                key={pair}
                type="button"
                aria-pressed={active}
                onClick={() => set("fontPair", pair)}
                className={cn(
                  "flex min-h-11 items-center justify-between gap-3 border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  active ? "border-foreground" : "border-border hover:bg-accent/40"
                )}
              >
                <span className="text-sm">{sample.label}</span>
                <span className="flex items-baseline gap-2 text-muted-foreground">
                  <span style={{ fontFamily: sample.heading }} className="text-base">Aa</span>
                  <span style={{ fontFamily: sample.body }} className="text-xs">abc</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Colors */}
      <fieldset className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <legend className="text-sm font-medium">{t("colors")}</legend>
          {workspaceBranding && (
            <button
              type="button"
              onClick={useWorkspaceBranding}
              className="text-xs text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
            >
              {t("useWorkspaceBranding")}
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {COLOR_KEYS.map((key) => (
            <Popover key={key}>
              <PopoverTrigger
                className="flex min-h-11 items-center gap-2 border border-border px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label={t(`colorLabels.${key}`)}
              >
                <span
                  className="size-7 shrink-0 border border-border"
                  style={{ background: value[key] }}
                  aria-hidden
                />
                <span className="flex flex-1 flex-col">
                  <span className="text-xs text-muted-foreground">{t(`colorLabels.${key}`)}</span>
                  <span className="font-mono text-xs uppercase">{value[key]}</span>
                </span>
              </PopoverTrigger>
              <PopoverContent className="w-auto" align="start">
                <ColorPicker
                  value={value[key]}
                  onChange={(hex) => set(key, hex)}
                  presets={BRAND_PRESETS}
                  presetsLabel={t("colors")}
                  hexLabel={`${t(`colorLabels.${key}`)} hex`}
                />
              </PopoverContent>
            </Popover>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
