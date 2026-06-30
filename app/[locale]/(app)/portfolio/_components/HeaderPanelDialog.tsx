"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { EditorDrawerSection, EditorDrawerGroup } from "@/lib/page-builder/EditorDrawerSection";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { uploadAsset } from "@/lib/storage/uploadAsset.client";
import { cn } from "@/lib/utils";
import { NumberInputRow, ColorSwatchRow } from "@/lib/page-builder/toolbarPrimitives";
import { useBrandRadius } from "@/lib/page-builder/brandColors";
import {
  HEADER_SHADOW_SIZES,
  HEADER_FONT_SIZES,
  HEADER_NAVBAR_SIZES,
  BRAND_KIT_RADII,
  type BrandKitRadius,
  type PortfolioBrandKit,
  type PortfolioHeaderConfig,
} from "@/lib/page-builder/types";
import type { StyleColorToken } from "@/lib/page-builder/styleToolkit";

type Tab = "setup" | "design";
const LOGO_MAX_BYTES = 250 * 1024;
const LOGO_MAX_WIDTH = 512;
const LOGO_MAX_HEIGHT = 256;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

type Props = {
  header: PortfolioHeaderConfig;
  onHeaderChange: (next: PortfolioHeaderConfig) => void;
  /** Accepted for API compat but no longer consumed — shared ColorSwatchRow uses BrandColorsContext. */
  brandKit?: PortfolioBrandKit;
  workspaceName: string;
  /** Called after a successful DB save — parent updates snapshot. */
  onSaved?: () => void;
  /** Called on X/cancel — parent reverts to snapshot. */
  onCancel?: () => void;
};

/**
 * Labelled wrapper around the shared ColorSwatchRow.
 * The shared control only renders the swatch buttons; the label lives here.
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
      <NumberInputRow label={widthLabel} value={width} min={0} max={8} onChange={onWidthChange} effectiveValue={0} />
      {!!width && (
        // borderBottomColor fallback is "color-mix(in srgb, var(--pf-color-fg) 14%, transparent)" —
        // no clean single token; leave effectiveValue unset
        <LabeledSwatchRow label={colorLabel} value={color} onChange={onColorChange} allowNone={false} />
      )}
    </div>
  );
}

function ToggleButton({
  active,
  isEffective,
  onClick,
  children,
}: {
  active: boolean;
  /** True when the field is unset but the effective default makes it appear active.
   * Renders lighter than an explicitly-set active state ("following theme"). */
  isEffective?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        active && !isEffective && "bg-foreground text-background hover:bg-foreground",
        isEffective && "border-foreground opacity-70",
      )}
    >
      {children}
    </button>
  );
}

function RadiusRow({
  label,
  active,
  onToggle,
  getLabel,
  effectiveValue,
}: {
  label: string;
  active: BrandKitRadius | "" | undefined;
  onToggle: (radius: BrandKitRadius | "") => void;
  getLabel: (radius: BrandKitRadius) => string;
  effectiveValue?: BrandKitRadius;
}) {
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
              aria-label={getLabel(radius)}
              aria-pressed={isExplicit || isEffective}
              onClick={() => onToggle(isExplicit ? "" : radius)}
              className={cn(
                "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isExplicit && "bg-foreground text-background hover:bg-foreground",
                isEffective && "border-foreground opacity-70",
              )}
            >
              {getLabel(radius)}
            </button>
          );
        })}
      </div>
    </div>
  );
}



export function HeaderPanelDialog({
  header,
  onHeaderChange,
  workspaceName,
}: Props) {
  const t = useTranslations("app.pageBuilder.editor.headerDialog");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoDragActive, setLogoDragActive] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("setup");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Effective brand radius for the radius pickers (display-only, theme-coupled)
  const effectiveBrandRadius = useBrandRadius();

  function set<K extends keyof PortfolioHeaderConfig>(key: K, value: PortfolioHeaderConfig[K]) {
    onHeaderChange({ ...header, [key]: value });
  }

  function toggleBool<K extends "activeLinkScale" | "activeLinkHighlight">(key: K) {
    set(key, !header[key]);
  }

  /** Underline has an effective default of ON (undefined = on). Toggle cycles:
   *  undefined/true (effective/explicit on) → false (off) → undefined (reset to default). */
  function toggleUnderline() {
    set("activeLinkUnderline", header.activeLinkUnderline !== false ? false : undefined);
  }

  async function uploadLogo(file: File) {
    setLogoUploading(true);
    setLogoError(null);
    try {
      const result = await uploadAsset(
        file,
        {
          acceptedTypes: LOGO_TYPES as readonly string[],
          maxBytes: LOGO_MAX_BYTES,
          maxWidth: LOGO_MAX_WIDTH,
          maxHeight: LOGO_MAX_HEIGHT,
        },
        { subfolder: "portfolio_header" },
      );
      if ("error" in result) {
        switch (result.error) {
          case "type_not_accepted": setLogoError(t("logoErrors.type")); break;
          case "file_too_large": setLogoError(t("logoErrors.size")); break;
          case "dimensions_too_large": setLogoError(t("logoErrors.dimensions")); break;
          case "invalid_image": toast.error(t("logoErrors.image")); break;
        }
        return;
      }
      onHeaderChange({
        ...header,
        logoUrl: result.asset.url,
        logoPublicId: result.asset.assetId,
      });
    } catch {
      toast.error(t("logoErrors.upload"));
    } finally {
      setLogoUploading(false);
    }
  }

  const shadowLabels: Record<string, string> = {
    none: t("shadow.none"),
    sm: t("shadow.sm"),
    md: t("shadow.md"),
    lg: t("shadow.lg"),
  };
  const fontSizeLabels: Record<string, string> = {
    sm: t("fontSize.sm"),
    md: t("fontSize.md"),
    lg: t("fontSize.lg"),
  };
  const navbarSizeLabels: Record<string, string> = {
    sleek: t("navbarSize.sleek"),
    balanced: t("navbarSize.balanced"),
    flashy: t("navbarSize.flashy"),
  };

  return (
    <div
      className="flex w-[360px] flex-col border-s border-border bg-card"
      role="complementary"
      aria-label={t("title")}
    >
      {/* Header */}
      <div className="flex items-center border-b border-border px-4 py-3">
        <span className="text-sm font-medium text-foreground">{t("title")}</span>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border">
        {(["setup", "design"] as Tab[]).map((id) => (
          <button
            key={id}
            type="button"
            data-tour-id={`header-${id}-tab`}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 py-2 text-xs font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              tab === id ? "border-b-2 border-foreground text-foreground" : "text-muted-foreground",
            )}
          >
            {id === "setup" ? t("tabs.setup") : t("tabs.design")}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
        {tab === "setup" && (
          <>
            {/* Brand text */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="header-brand-text">{t("brandTextLabel")}</Label>
              <Input
                id="header-brand-text"
                value={header.brandText === undefined ? workspaceName : header.brandText}
                placeholder={workspaceName}
                maxLength={80}
                onChange={(e) => set("brandText", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t("brandTextHelp")}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">{t("navbarSizeLabel")}</span>
              <div className="flex">
                {HEADER_NAVBAR_SIZES.map((s) => {
                  const isActive = (header.navbarSize || "balanced") === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-label={navbarSizeLabels[s]}
                      aria-pressed={isActive}
                      onClick={() => set("navbarSize", s === "balanced" ? "" : s)}
                      className={cn(
                        "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        isActive && "bg-foreground text-background hover:bg-foreground",
                      )}
                    >
                      {navbarSizeLabels[s]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Logo upload */}
            <div className="flex flex-col gap-1.5" data-tour-id="logo-uploader">
              <Label>{t("logoLabel")}</Label>
              <p className="text-xs text-muted-foreground">{t("logoHelp")}</p>
              {header.logoUrl ? (
                <div className="flex flex-col gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={header.logoUrl}
                    alt="Logo preview"
                    className="h-12 w-auto max-w-full border border-border object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setLogoError(null);
                      onHeaderChange({ ...header, logoUrl: "", logoPublicId: "" });
                    }}
                    className="text-xs text-muted-foreground underline hover:text-foreground"
                  >
                    {t("logoRemove")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={logoUploading}
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setLogoDragActive(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setLogoDragActive(true);
                  }}
                  onDragLeave={() => setLogoDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setLogoDragActive(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) void uploadLogo(file);
                  }}
                  className={cn(
                    "inline-flex min-h-24 flex-col items-center justify-center gap-2 border border-dashed border-border bg-background px-3 text-center text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60",
                    logoDragActive && "bg-accent text-foreground",
                  )}
                >
                  <Upload className="size-3.5" aria-hidden />
                  <span>{logoUploading ? t("logoUploading") : t("logoUpload")}</span>
                  <span>{t("logoRequirements")}</span>
                </button>
              )}
              {logoError ? (
                <p role="alert" className="text-xs text-destructive">{logoError}</p>
              ) : null}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setLogoError(null);
                  if (file) void uploadLogo(file);
                  e.target.value = "";
                }}
              />
            </div>
          </>
        )}

        {tab === "design" && (
          <div data-tour-id="header-nav-style">
          <EditorDrawerGroup plain>
            {/* ── Banner ─────────────────────────────── */}
            <EditorDrawerSection title={t("sectionBanner")}>
              {/* backgroundColor: PortfolioHeader fallback = var(--pf-color-bg) → "background" */}
              <LabeledSwatchRow
                label={t("bgColorLabel")}
                value={header.backgroundColor}
                onChange={(c) => set("backgroundColor", c)}
                effectiveValue="background"
              />

              {/* backgroundOpacity: PortfolioHeader fallback = 100 */}
              <NumberInputRow
                label={t("bgOpacityLabel")}
                value={header.backgroundOpacity}
                min={0}
                max={100}
                suffix="%"
                onChange={(v) => set("backgroundOpacity", v)}
                effectiveValue={100}
              />

              <BorderRow
                widthLabel={t("borderBottomLabel")}
                colorLabel={t("borderColorLabel")}
                width={header.borderBottomWidth}
                color={header.borderBottomColor}
                onWidthChange={(v) => set("borderBottomWidth", v)}
                onColorChange={(v) => set("borderBottomColor", v)}
              />

              {/* Drop shadow */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">{t("shadowLabel")}</span>
                <div className="flex">
                  {HEADER_SHADOW_SIZES.map((s) => {
                    const isActive = (header.shadowSize || "none") === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-label={shadowLabels[s]}
                        aria-pressed={isActive}
                        onClick={() => set("shadowSize", s === "none" ? "" : s)}
                        className={cn(
                          "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                          isActive && "bg-foreground text-background hover:bg-foreground",
                        )}
                      >
                        {shadowLabels[s]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </EditorDrawerSection>

            {/* ── Links ──────────────────────────────── */}
            <EditorDrawerSection title={t("sectionLinks")}>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">{t("fontSizeLabel")}</span>
                <div className="flex">
                  {HEADER_FONT_SIZES.map((s) => {
                    const isActive = (header.fontSize || "md") === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-label={fontSizeLabels[s]}
                        aria-pressed={isActive}
                        onClick={() => set("fontSize", s === "md" ? "" : s)}
                        className={cn(
                          "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                          isActive && "bg-foreground text-background hover:bg-foreground",
                        )}
                      >
                        {fontSizeLabels[s]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* brandTextColor: governs header/brand name text — independent of link color */}
              <LabeledSwatchRow
                label={t("brandTextColorLabel")}
                value={header.brandTextColor}
                onChange={(c) => set("brandTextColor", c)}
                effectiveValue="foreground"
              />

              {/* Inactive links sub-section */}
              <EditorDrawerSection title={t("sectionInactiveLinks")}>
                {/* linkColor: PortfolioHeader fallback = var(--pf-color-fg) → "foreground" */}
                <LabeledSwatchRow
                  label={t("linkColorLabel")}
                  value={header.linkColor}
                  onChange={(c) => set("linkColor", c)}
                  effectiveValue="foreground"
                />
              </EditorDrawerSection>

              {/* Active link style sub-section */}
              <EditorDrawerSection title={t("sectionActiveStyle")}>
                {/* Multi-select: Scale / Highlight / Underline */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted-foreground">{t("activeStyleLabel")}</span>
                  <div className="flex">
                    <ToggleButton active={!!header.activeLinkScale} onClick={() => toggleBool("activeLinkScale")}>
                      {t("activeStyleScale")}
                    </ToggleButton>
                    <ToggleButton active={!!header.activeLinkHighlight} onClick={() => toggleBool("activeLinkHighlight")}>
                      {t("activeStyleHighlight")}
                    </ToggleButton>
                    <ToggleButton
                      active={header.activeLinkUnderline !== false}
                      isEffective={header.activeLinkUnderline === undefined}
                      onClick={toggleUnderline}
                    >
                      {t("activeStyleUnderline")}
                    </ToggleButton>
                  </div>
                </div>

                {/* activeLinkColor: fallback = var(--pf-color-fg) → "foreground" */}
                <LabeledSwatchRow
                  label={t("activeLinkColorLabel")}
                  value={header.activeLinkColor}
                  onChange={(c) => set("activeLinkColor", c)}
                  effectiveValue="foreground"
                />

                {/* Conditional: highlight bg color */}
                {header.activeLinkHighlight && (
                  // highlightColor fallback = "color-mix(in srgb, var(--pf-color-fg) 8%, transparent)"
                  // — no clean single token; leave effectiveValue unset
                  <LabeledSwatchRow
                    label={t("highlightColorLabel")}
                    value={header.highlightColor}
                    onChange={(c) => set("highlightColor", c)}
                  />
                )}
                {header.activeLinkHighlight && (
                  // highlightOpacity: PortfolioHeader fallback = 100
                  <NumberInputRow
                    label={t("highlightOpacityLabel")}
                    value={header.highlightOpacity}
                    min={0}
                    max={100}
                    suffix="%"
                    onChange={(v) => set("highlightOpacity", v)}
                    effectiveValue={100}
                  />
                )}
                {header.activeLinkHighlight && (
                  <RadiusRow
                    label={t("cornerRadiusLabel")}
                    active={header.activeLinkRadius}
                    onToggle={(radius) => set("activeLinkRadius", radius)}
                    getLabel={(radius) => t(`radius.${radius}`)}
                    effectiveValue={effectiveBrandRadius}
                  />
                )}

                {/* Conditional: underline color — visible when underline is on (undefined = default ON) */}
                {header.activeLinkUnderline !== false && (
                  // underlineColor: PortfolioHeader fallback = var(--pf-color-accent) → "accent"
                  <LabeledSwatchRow
                    label={t("underlineColorLabel")}
                    value={header.underlineColor}
                    onChange={(c) => set("underlineColor", c)}
                    effectiveValue="accent"
                  />
                )}
              </EditorDrawerSection>
            </EditorDrawerSection>

            {/* ── Contact button ──────────────────────── */}
            <EditorDrawerSection title={t("sectionContactButton")}>
              {/* contactButtonColor: PortfolioHeader fallback = var(--pf-color-primary) → "primary" */}
              <LabeledSwatchRow
                label={t("contactButtonColorLabel")}
                value={header.contactButtonColor}
                onChange={(c) => set("contactButtonColor", c)}
                effectiveValue="primary"
              />
              {/* contactButtonOpacity: PortfolioHeader fallback = 100 */}
              <NumberInputRow
                label={t("contactButtonOpacityLabel")}
                value={header.contactButtonOpacity}
                min={0}
                max={100}
                suffix="%"
                onChange={(v) => set("contactButtonOpacity", v)}
                effectiveValue={100}
              />
              {/* contactButtonTextColor: PortfolioHeader fallback = var(--pf-color-bg) → "background" */}
              <LabeledSwatchRow
                label={t("contactButtonTextColorLabel")}
                value={header.contactButtonTextColor}
                onChange={(c) => set("contactButtonTextColor", c)}
                effectiveValue="background"
              />
              <RadiusRow
                label={t("cornerRadiusLabel")}
                active={header.contactButtonRadius}
                onToggle={(radius) => set("contactButtonRadius", radius)}
                getLabel={(radius) => t(`radius.${radius}`)}
                effectiveValue={effectiveBrandRadius}
              />
            </EditorDrawerSection>
          </EditorDrawerGroup>
          </div>
        )}
      </div>

    </div>
  );
}
