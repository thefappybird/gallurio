"use client";

import { useTranslations } from "next-intl";
import {
  BRAND_KIT_THEME_PRESETS,
  type PortfolioBrandKit,
  type BrandKitThemePreset,
} from "@/lib/page-builder/types";
import {
  PORTFOLIO_FONTS,
  PORTFOLIO_FONT_KEYS,
  legacyFontPairToFonts,
  type PortfolioFontKey,
} from "@/lib/page-builder/fonts";
import type { PortfolioSavedTheme } from "@/lib/page-builder/types";
import { THEME_PRESET_SWATCHES } from "./themePresetSwatches";
import { ColorPicker } from "@/components/ui/color-picker";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { CheckIcon, Trash2Icon, PlusIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  /** Owner's saved named themes for the "Saved themes" section. */
  savedThemes?: PortfolioSavedTheme[];
  /** Called when user clicks "Save current as theme". */
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

  // Saved-theme inline save state.
  const [saveNameInput, setSaveNameInput] = useState("");
  const [savingTheme, setSavingTheme] = useState(false);
  const [saveThemeError, setSaveThemeError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  async function handleSaveTheme() {
    const name = saveNameInput.trim();
    if (!name) {
      setSaveThemeError("Enter a name for this theme.");
      return;
    }
    if (name.length > 60) {
      setSaveThemeError("Theme name must be 60 characters or fewer.");
      return;
    }
    setSaveThemeError(null);
    setSavingTheme(true);
    try {
      await onSaveTheme?.(name);
      setSaveNameInput("");
    } catch {
      setSaveThemeError("Could not save theme. Please try again.");
    } finally {
      setSavingTheme(false);
    }
  }

  async function handleDeleteTheme(id: string) {
    setDeletingId(id);
    try {
      await onDeleteTheme?.(id);
    } finally {
      setDeletingId(null);
    }
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
                  active ? "border-foreground" : "border-border hover:bg-accent/40 focus-visible:bg-accent/40"
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

      {/* Saved themes */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Saved themes</h3>

        {/* Save current as theme */}
        {onSaveTheme && (
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Theme name"
                value={saveNameInput}
                onChange={(e) => {
                  setSaveNameInput(e.target.value);
                  setSaveThemeError(null);
                }}
                maxLength={60}
                className="h-9 min-w-0 flex-1 border border-border bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="New theme name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSaveTheme();
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void handleSaveTheme()}
                disabled={savingTheme || !saveNameInput.trim()}
                className="shrink-0 gap-1.5"
              >
                {savingTheme ? (
                  <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <PlusIcon className="size-3.5" aria-hidden />
                )}
                Save current
              </Button>
            </div>
            {saveThemeError && (
              <p role="alert" className="text-xs text-destructive">{saveThemeError}</p>
            )}
          </div>
        )}

        {/* Saved theme cards */}
        {savedThemes.length > 0 ? (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {savedThemes.map((theme) => {
              const bk = theme.brandKit;
              const isDeleting = deletingId === theme.id;
              return (
                <li
                  key={theme.id}
                  className="group relative flex flex-col overflow-hidden border border-border"
                >
                  {/* Color swatch preview */}
                  <button
                    type="button"
                    aria-label={`Apply theme: ${theme.name}`}
                    onClick={() => onChange(bk)}
                    className="relative flex h-12 w-full items-center justify-center overflow-hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    style={{ background: bk.backgroundColor }}
                  >
                    <span
                      className="absolute left-0 top-0 h-full w-1/3"
                      style={{ background: bk.primaryColor }}
                      aria-hidden
                    />
                    <span
                      className="absolute left-1/3 top-0 h-full w-1/3"
                      style={{ background: bk.accentColor }}
                      aria-hidden
                    />
                    <span
                      className="absolute right-0 top-0 h-full w-1/3"
                      style={{ background: bk.foregroundColor }}
                      aria-hidden
                    />
                  </button>
                  <span className="flex items-center justify-between gap-1 px-2 py-1.5">
                    <span className="min-w-0 truncate text-xs font-medium" title={theme.name}>
                      {theme.name}
                    </span>
                    {onDeleteTheme && (
                      <button
                        type="button"
                        aria-label={`Delete theme: ${theme.name}`}
                        onClick={() => void handleDeleteTheme(theme.id)}
                        disabled={isDeleting}
                        className="inline-flex size-6 shrink-0 items-center justify-center border border-transparent text-muted-foreground transition-colors hover:border-border hover:text-destructive focus-visible:border-border focus-visible:text-destructive focus-visible:outline-none disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Trash2Icon className="size-3.5" aria-hidden />
                        )}
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No saved themes yet. Customise your brand kit above, then save it as a theme.
          </p>
        )}
      </section>
    </div>
  );
}
