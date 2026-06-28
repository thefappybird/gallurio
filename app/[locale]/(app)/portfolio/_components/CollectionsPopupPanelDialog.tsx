"use client";

import { cn } from "@/lib/utils";
import { NumberInputRow, ColorSwatchRow } from "@/lib/page-builder/toolbarPrimitives";
import { EditorDrawerSection, EditorDrawerGroup } from "@/lib/page-builder/EditorDrawerSection";
import { PORTFOLIO_FONT_KEYS, PORTFOLIO_FONTS } from "@/lib/page-builder/fonts";
import type { PortfolioFontKey } from "@/lib/page-builder/fonts";
import { useBrandRadius } from "@/lib/page-builder/brandColors";
import {
  BRAND_KIT_RADII,
  type BrandKitRadius,
  type PortfolioBrandKit,
  type PortfolioCollectionsPopupConfig,
} from "@/lib/page-builder/types";
import type { StyleColorToken } from "@/lib/page-builder/styleToolkit";

// ---------------------------------------------------------------------------
// Local sub-components
// ---------------------------------------------------------------------------

/**
 * Labelled wrapper around the shared ColorSwatchRow.
 * Mirrors HeaderPanelDialog.LabeledSwatchRow.
 */
function LabeledSwatchRow({
  label,
  value,
  onChange,
  allowNone,
  effectiveValue,
}: {
  label: string;
  value: StyleColorToken | string | undefined;
  onChange: (next: StyleColorToken | string | undefined) => void;
  allowNone?: boolean;
  effectiveValue?: StyleColorToken | string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <ColorSwatchRow
        value={value}
        onChange={onChange}
        allowNone={allowNone}
        effectiveValue={effectiveValue}
      />
    </div>
  );
}

function BorderRow({
  widthLabel,
  colorLabel,
  width,
  color,
  onWidthChange,
  onColorChange,
}: {
  widthLabel: string;
  colorLabel: string;
  width: number | undefined;
  color: string | undefined;
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
        effectiveValue={0}
      />
      {!!width && (
        // borderColor fallback: var(--pf-color-border, rgba(0,0,0,0.12)) — no clean single token
        <LabeledSwatchRow
          label={colorLabel}
          value={color}
          onChange={onColorChange}
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
  effectiveValue,
}: {
  label: string;
  active: BrandKitRadius | "" | undefined;
  onToggle: (radius: BrandKitRadius | "") => void;
  effectiveValue?: BrandKitRadius;
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
        {BRAND_KIT_RADII.map((radius) => {
          const isExplicit = active === radius;
          const isEffective = !active && effectiveValue === radius;
          return (
            <button
              key={radius}
              type="button"
              aria-label={radiusLabels[radius]}
              aria-pressed={isExplicit || isEffective}
              onClick={() => onToggle(isExplicit ? "" : radius)}
              className={cn(
                "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isExplicit && "bg-foreground text-background hover:bg-foreground",
                isEffective && "border-foreground opacity-70",
              )}
            >
              {radiusLabels[radius]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Props = {
  config: PortfolioCollectionsPopupConfig;
  onChange: (c: PortfolioCollectionsPopupConfig) => void;
  /** Accepted for API compat but no longer consumed — shared ColorSwatchRow uses BrandColorsContext. */
  brandKit?: PortfolioBrandKit;
  onSaved?: () => void;
  onCancel?: () => void;
};

export function CollectionsPopupPanelDialog({
  config,
  onChange,
}: Props) {
  // Effective brand radius for the radius pickers (display-only, theme-coupled)
  const effectiveBrandRadius = useBrandRadius();

  function set<K extends keyof PortfolioCollectionsPopupConfig>(
    key: K,
    value: PortfolioCollectionsPopupConfig[K],
  ) {
    onChange({ ...config, [key]: value });
  }

  return (
    <div
      className="flex w-[360px] flex-col border-s border-border bg-card"
      role="complementary"
      aria-label="Featured popup style"
    >
      {/* Header */}
      <div className="flex items-center border-b border-border px-4 py-3">
        <span className="text-sm font-semibold text-foreground">
          Featured popup
        </span>
      </div>

      {/* Scrollable controls */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
        <EditorDrawerGroup plain>
          {/* ── Popup ────────────────────────────── */}
          <EditorDrawerSection title="Popup">
            {/* backgroundColor: fallback = var(--pf-color-surface, #fff)
                surface is not a brand palette token — effectiveValue left unset */}
            <LabeledSwatchRow
              label="Background"
              value={config.backgroundColor}
              onChange={(c) => set("backgroundColor", c)}
            />

            <BorderRow
              widthLabel="Border"
              colorLabel="Border color"
              width={config.borderWidth}
              color={config.borderColor}
              onWidthChange={(v) => set("borderWidth", v)}
              onColorChange={(v) => set("borderColor", v)}
            />

            {/* radius: fallback = "0px" (sharp) when unset → effective = brand radius */}
            <RadiusRow
              label="Corners"
              active={config.radius}
              onToggle={(r) => set("radius", r)}
              effectiveValue={effectiveBrandRadius}
            />
          </EditorDrawerSection>

          {/* ── Title styles ──────────────────────── */}
          <EditorDrawerSection title="Title styles">
            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs text-muted-foreground"
                htmlFor="popup-title-text"
              >
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
              <button
                type="button"
                aria-pressed={!!config.titleBold}
                aria-label="Bold"
                onClick={() => set("titleBold", !config.titleBold)}
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center border border-border bg-background text-xs font-bold",
                  config.titleBold && "bg-foreground text-background",
                )}
              >
                B
              </button>
              <button
                type="button"
                aria-pressed={!!config.titleItalic}
                aria-label="Italic"
                onClick={() => set("titleItalic", !config.titleItalic)}
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center border border-border bg-background text-xs italic",
                  config.titleItalic && "bg-foreground text-background",
                )}
              >
                I
              </button>
              <button
                type="button"
                aria-pressed={!!config.titleUnderline}
                aria-label="Underline"
                onClick={() => set("titleUnderline", !config.titleUnderline)}
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center border border-border bg-background text-xs underline",
                  config.titleUnderline && "bg-foreground text-background",
                )}
              >
                U
              </button>
              {(["left", "center", "right"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={config.titleAlign === a}
                  aria-label={`Align ${a}`}
                  onClick={() =>
                    set("titleAlign", config.titleAlign === a ? undefined : a)
                  }
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center border border-border bg-background text-xs",
                    config.titleAlign === a && "bg-foreground text-background",
                  )}
                >
                  {a === "left" ? "L" : a === "center" ? "C" : "R"}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="shrink-0 text-xs text-muted-foreground">Font</span>
              <select
                value={config.titleFontFamily ?? ""}
                onChange={(e) =>
                  set(
                    "titleFontFamily",
                    (e.target.value || undefined) as PortfolioFontKey | undefined,
                  )
                }
                className="h-7 cursor-pointer border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Theme font</option>
                {PORTFOLIO_FONT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {PORTFOLIO_FONTS[key].label}
                  </option>
                ))}
              </select>
            </div>

            {/* titleFontSize: fallback = 1.125rem (18px) — no standard token; effectiveValue unset */}
            <NumberInputRow
              label="Font size"
              value={config.titleFontSize}
              min={10}
              max={120}
              suffix="px"
              onChange={(v) => set("titleFontSize", v)}
            />

            {/* titleColorToken: fallback = var(--pf-color-foreground, #111) → "foreground" */}
            <LabeledSwatchRow
              label="Title color"
              value={config.titleColorToken}
              onChange={(c) => set("titleColorToken", c)}
              effectiveValue="foreground"
            />
          </EditorDrawerSection>

          {/* ── Button styles ─────────────────────── */}
          <EditorDrawerSection title="Button styles">
            {/* closeButtonSize: fallback = 36px */}
            <NumberInputRow
              label="Button size"
              value={config.closeButtonSize}
              min={24}
              max={72}
              suffix="px"
              onChange={(v) => set("closeButtonSize", v)}
              effectiveValue={36}
            />

            {/* closeButtonRadius: fallback = "50%" when unset — not a BrandKitRadius; effectiveValue unset */}
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
              onWidthChange={(v) => set("closeButtonBorderWidth", v)}
              onColorChange={(v) => set("closeButtonBorderColorToken", v)}
            />

            {/* closeButtonOpacity: fallback = 100 */}
            <NumberInputRow
              label="Opacity"
              value={config.closeButtonOpacity}
              min={0}
              max={100}
              suffix="%"
              onChange={(v) => set("closeButtonOpacity", v)}
              effectiveValue={100}
            />

            {/* closeButtonBgColorToken: fallback = var(--pf-color-surface, #fff) — no palette token; effectiveValue unset */}
            <LabeledSwatchRow
              label="Background"
              value={config.closeButtonBgColorToken}
              onChange={(c) => set("closeButtonBgColorToken", c)}
            />
          </EditorDrawerSection>
        </EditorDrawerGroup>
      </div>
    </div>
  );
}
