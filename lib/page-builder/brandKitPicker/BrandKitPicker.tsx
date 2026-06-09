"use client";

import { useTranslations } from "next-intl";
import {
  type PortfolioBrandKit,
} from "@/lib/page-builder/types";
import {
  PORTFOLIO_FONTS,
  PORTFOLIO_FONT_KEYS,
  legacyFontPairToFonts,
  type PortfolioFontKey,
} from "@/lib/page-builder/fonts";
import type { PortfolioSavedTheme } from "@/lib/page-builder/types";
import { ColorPicker } from "@/components/ui/color-picker";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";
import { ThemeGrid } from "./ThemeGrid";

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

// Labels for the two independent font selectors (English — editor chrome only).
const FONT_SELECTOR_LABELS: Record<"headingFont" | "bodyFont", string> = {
  headingFont: "Heading font",
  bodyFont: "Body font",
};

type Props = {
  value: PortfolioBrandKit;
  onChange: (next: PortfolioBrandKit) => void;
  /** When provided, enables a "use workspace branding" shortcut for the colors. */
  workspaceBranding?: { primaryColor?: string; secondaryColor?: string } | null;
  /** Owner's saved named themes, shown in the unified theme grid. */
  savedThemes?: PortfolioSavedTheme[];
  /** Called when user saves the current kit as a named theme. */
  onSaveTheme?: (name: string) => Promise<void>;
  /** Called when user deletes a saved theme by id. */
  onDeleteTheme?: (id: string) => Promise<void>;
};

/** A single font-family selector — heading or body. */
function FontSelector({
  label,
  value: selectedKey,
  onChange,
}: {
  label: string;
  value: PortfolioFontKey;
  onChange: (key: PortfolioFontKey) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-xs font-medium text-muted-foreground">{label}</legend>
      <div className="flex flex-col gap-1">
        {PORTFOLIO_FONT_KEYS.map((key) => {
          const entry = PORTFOLIO_FONTS[key];
          const active = selectedKey === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(key)}
              className={cn(
                "flex min-h-11 items-center justify-between gap-3 border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                active ? "border-foreground bg-accent/20" : "border-border hover:bg-accent/40 focus-visible:bg-accent/40"
              )}
            >
              <span className="text-sm" style={{ fontFamily: entry.family }}>
                {entry.label}
              </span>
              <span className="flex items-center gap-2">
                <span
                  className="text-base text-muted-foreground"
                  style={{ fontFamily: entry.family }}
                  aria-hidden
                >
                  Aa
                </span>
                {active && <CheckIcon className="size-3.5 shrink-0 text-foreground" aria-hidden />}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function BrandKitPicker({
  value,
  onChange,
  workspaceBranding,
  savedThemes = [],
  onSaveTheme,
  onDeleteTheme,
}: Props) {
  const t = useTranslations("app.pageBuilder.brandKit");

  // Derive current heading/body from explicit keys or legacy pair fallback.
  const resolvedFonts = legacyFontPairToFonts(value.fontPair);
  const headingFont: PortfolioFontKey = value.headingFont ?? resolvedFonts.headingFont;
  const bodyFont: PortfolioFontKey = value.bodyFont ?? resolvedFonts.bodyFont;

  function set<K extends keyof PortfolioBrandKit>(key: K, v: PortfolioBrandKit[K]) {
    onChange({ ...value, [key]: v });
  }

  function setFont(slot: "headingFont" | "bodyFont", key: PortfolioFontKey) {
    onChange({ ...value, [slot]: key });
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
      {/* Unified theme grid (presets + saved) */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t("themes")}</legend>
        <ThemeGrid
          value={value}
          onChange={onChange}
          savedThemes={savedThemes}
          onSaveTheme={onSaveTheme}
          onDeleteTheme={onDeleteTheme}
        />
      </fieldset>

      {/* Independent font selectors */}
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium">Fonts</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FontSelector
            label={FONT_SELECTOR_LABELS.headingFont}
            value={headingFont}
            onChange={(key) => setFont("headingFont", key)}
          />
          <FontSelector
            label={FONT_SELECTOR_LABELS.bodyFont}
            value={bodyFont}
            onChange={(key) => setFont("bodyFont", key)}
          />
        </div>
      </div>

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
