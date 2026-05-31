"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  BRAND_KIT_THEME_PRESETS,
  BRAND_KIT_FONT_PAIRS,
  type PortfolioBrandKit,
  type BrandKitThemePreset,
  type BrandKitFontPair,
} from "@/lib/page-builder/types";
import { THEME_PRESET_SWATCHES, FONT_PAIR_SAMPLES } from "./themePresetSwatches";
import { cn } from "@/lib/utils";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

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

  // Raw text per color field so the user can type a partial hex without it being
  // reverted; we only propagate to the parent kit when it's a valid 6-digit hex.
  // Seeded once from the incoming kit — the picker owns the text while mounted,
  // and explicit external changes (the workspace-branding shortcut) update it
  // directly, so no prop-sync effect is needed.
  const [rawColors, setRawColors] = useState<Record<ColorKey, string>>(() => ({
    primaryColor: value.primaryColor,
    secondaryColor: value.secondaryColor,
    accentColor: value.accentColor,
    backgroundColor: value.backgroundColor,
    foregroundColor: value.foregroundColor,
  }));

  function set<K extends keyof PortfolioBrandKit>(key: K, v: PortfolioBrandKit[K]) {
    onChange({ ...value, [key]: v });
  }

  function setColor(key: ColorKey, raw: string) {
    setRawColors((prev) => ({ ...prev, [key]: raw }));
    if (HEX_RE.test(raw)) set(key, raw);
  }

  function useWorkspaceBranding() {
    if (!workspaceBranding) return;
    const next = { ...value };
    const rawNext: Partial<Record<ColorKey, string>> = {};
    if (workspaceBranding.primaryColor && HEX_RE.test(workspaceBranding.primaryColor)) {
      next.primaryColor = workspaceBranding.primaryColor;
      rawNext.primaryColor = workspaceBranding.primaryColor;
    }
    if (workspaceBranding.secondaryColor && HEX_RE.test(workspaceBranding.secondaryColor)) {
      next.secondaryColor = workspaceBranding.secondaryColor;
      rawNext.secondaryColor = workspaceBranding.secondaryColor;
    }
    setRawColors((prev) => ({ ...prev, ...rawNext }));
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
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="color"
                aria-label={t(`colorLabels.${key}`)}
                value={value[key]}
                onChange={(e) => setColor(key, e.target.value)}
                className="size-9 shrink-0 cursor-pointer border border-border bg-transparent"
              />
              <span className="flex flex-1 flex-col">
                <span className="text-xs text-muted-foreground">{t(`colorLabels.${key}`)}</span>
                <input
                  type="text"
                  aria-label={`${t(`colorLabels.${key}`)} hex`}
                  value={rawColors[key]}
                  onChange={(e) => setColor(key, e.target.value)}
                  spellCheck={false}
                  className="min-h-9 w-full border border-input bg-background px-2 font-mono text-xs uppercase focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
