"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronDown, RotateCcw, Upload } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { uploadImageToCloudinary } from "@/lib/storage/uploadToCloudinary.client";
import { cn } from "@/lib/utils";
import { NumberInputRow } from "@/lib/page-builder/toolbarPrimitives";
import {
  CONTACT_BUTTON_COLORS,
  HEADER_SHADOW_SIZES,
  HEADER_FONT_SIZES,
  HEADER_NAVBAR_SIZES,
  BRAND_KIT_RADII,
  type BrandKitRadius,
  type PortfolioBrandKit,
  type PortfolioHeaderConfig,
} from "@/lib/page-builder/types";

type Tab = "setup" | "design";
type DrawerId = "banner" | "links" | "active" | "contactButton";
const COLOR_TOKENS = CONTACT_BUTTON_COLORS;
const LOGO_MAX_BYTES = 250 * 1024;
const LOGO_MAX_WIDTH = 512;
const LOGO_MAX_HEIGHT = 256;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

type Props = {
  header: PortfolioHeaderConfig;
  onHeaderChange: (next: PortfolioHeaderConfig) => void;
  brandKit: PortfolioBrandKit;
  workspaceName: string;
  /** Called after a successful DB save — parent updates snapshot. */
  onSaved: () => void;
  /** Called on X/cancel — parent reverts to snapshot. */
  onCancel: () => void;
};

function resolveSwatchHex(token: (typeof COLOR_TOKENS)[number], brandKit: PortfolioBrandKit): string {
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
    !(COLOR_TOKENS as readonly string[]).includes(active);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {COLOR_TOKENS.map((colorToken) => {
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
        {/* Spectrum / custom hex picker */}
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
      <NumberInputRow label={widthLabel} value={width} min={0} max={8} onChange={onWidthChange} />
      {!!width && (
        <ColorSwatchRow label={colorLabel} active={color} brandKit={brandKit} onToggle={onColorChange} allowNone={false} />
      )}
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
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
        active && "bg-foreground text-background hover:bg-foreground",
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
}: {
  label: string;
  active: BrandKitRadius | "" | undefined;
  onToggle: (radius: BrandKitRadius | "") => void;
  getLabel: (radius: BrandKitRadius) => string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex">
        {BRAND_KIT_RADII.map((radius) => {
          const isActive = active === radius;
          return (
            <button
              key={radius}
              type="button"
              aria-label={getLabel(radius)}
              aria-pressed={isActive}
              onClick={() => onToggle(isActive ? "" : radius)}
              className={cn(
                "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isActive && "bg-foreground text-background hover:bg-foreground",
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

function getImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("invalid_image"));
    };
    img.src = url;
  });
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
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && <div className="flex flex-col gap-4 border-t border-border p-3">{children}</div>}
    </section>
  );
}

export function HeaderPanelDialog({
  header,
  onHeaderChange,
  brandKit,
  workspaceName,
}: Props) {
  const t = useTranslations("app.pageBuilder.editor.headerDialog");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoDragActive, setLogoDragActive] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("setup");
  const [openDrawer, setOpenDrawer] = useState<DrawerId | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof PortfolioHeaderConfig>(key: K, value: PortfolioHeaderConfig[K]) {
    onHeaderChange({ ...header, [key]: value });
  }

  function toggleBool<K extends "activeLinkScale" | "activeLinkHighlight" | "activeLinkUnderline">(key: K) {
    set(key, !header[key]);
  }

  async function uploadLogo(file: File) {
    setLogoUploading(true);
    setLogoError(null);
    try {
      if (!(LOGO_TYPES as readonly string[]).includes(file.type)) {
        setLogoError(t("logoErrors.type"));
        return;
      }
      if (file.size > LOGO_MAX_BYTES) {
        setLogoError(t("logoErrors.size"));
        return;
      }
      const { width, height } = await getImageSize(file);
      if (width > LOGO_MAX_WIDTH || height > LOGO_MAX_HEIGHT) {
        setLogoError(t("logoErrors.dimensions"));
        return;
      }
      const uploaded = await uploadImageToCloudinary(file, {
        subfolder: "portfolio_header",
        validateDimensions: false,
      });
      onHeaderChange({
        ...header,
        logoUrl: uploaded.url,
        logoPublicId: uploaded.cloudinaryPublicId,
      });
    } catch (error) {
      toast.error(error instanceof Error && error.message === "invalid_image" ? t("logoErrors.image") : t("logoErrors.upload"));
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
      className="flex w-[360px] flex-col border-l border-border bg-card"
      role="complementary"
      aria-label={t("title")}
    >
      {/* Header */}
      <div className="flex items-center border-b border-border px-4 py-3">
        <span className="text-sm font-semibold text-foreground">{t("title")}</span>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border">
        {(["setup", "design"] as Tab[]).map((id) => (
          <button
            key={id}
            type="button"
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
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
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
            <div className="flex flex-col gap-1.5">
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
              {logoError ? <p className="text-xs text-destructive">{logoError}</p> : null}
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
          <div className="flex flex-col gap-6">
            {/* ── Banner ─────────────────────────────── */}
            <DesignDrawer
              title={t("sectionBanner")}
              open={openDrawer === "banner"}
              onToggle={() => setOpenDrawer((current) => current === "banner" ? null : "banner")}
            >

              <ColorSwatchRow
                label={t("bgColorLabel")}
                active={header.backgroundColor}
                brandKit={brandKit}
                onToggle={(c) => set("backgroundColor", c)}
              />

              <NumberInputRow
                label={t("bgOpacityLabel")}
                value={header.backgroundOpacity ?? 100}
                min={0}
                max={100}
                suffix="%"
                onChange={(v) => set("backgroundOpacity", v ?? 100)}
              />

              <BorderRow
                widthLabel={t("borderBottomLabel")}
                colorLabel={t("borderColorLabel")}
                width={header.borderBottomWidth}
                color={header.borderBottomColor}
                brandKit={brandKit}
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
            </DesignDrawer>

            {/* ── Links ──────────────────────────────── */}
            <DesignDrawer
              title={t("sectionLinks")}
              open={openDrawer === "links"}
              onToggle={() => setOpenDrawer((current) => current === "links" ? null : "links")}
            >

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

              <ColorSwatchRow
                label={t("linkColorLabel")}
                active={header.linkColor}
                brandKit={brandKit}
                onToggle={(c) => set("linkColor", c)}
              />

              <ColorSwatchRow
                label={t("brandTextColorLabel")}
                active={header.brandTextColor}
                brandKit={brandKit}
                onToggle={(c) => set("brandTextColor", c)}
              />

              <ColorSwatchRow
                label={t("activeLinkColorLabel")}
                active={header.activeLinkColor}
                brandKit={brandKit}
                onToggle={(c) => set("activeLinkColor", c)}
              />
            </DesignDrawer>

            {/* ── Active link style ──────────────────── */}
            <DesignDrawer
              title={t("sectionActiveStyle")}
              open={openDrawer === "active"}
              onToggle={() => setOpenDrawer((current) => current === "active" ? null : "active")}
            >

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
                  <ToggleButton active={!!header.activeLinkUnderline} onClick={() => toggleBool("activeLinkUnderline")}>
                    {t("activeStyleUnderline")}
                  </ToggleButton>
                </div>
              </div>

              {/* Conditional: highlight bg color */}
              {header.activeLinkHighlight && (
                <ColorSwatchRow
                  label={t("highlightColorLabel")}
                  active={header.highlightColor}
                  brandKit={brandKit}
                  onToggle={(c) => set("highlightColor", c)}
                />
              )}
              {header.activeLinkHighlight && (
                <NumberInputRow
                  label={t("highlightOpacityLabel")}
                  value={header.highlightOpacity ?? 100}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(v) => set("highlightOpacity", v ?? 100)}
                />
              )}
              {header.activeLinkHighlight && (
                <RadiusRow
                  label={t("cornerRadiusLabel")}
                  active={header.activeLinkRadius}
                  onToggle={(radius) => set("activeLinkRadius", radius)}
                  getLabel={(radius) => t(`radius.${radius}`)}
                />
              )}

              {/* Conditional: underline color */}
              {header.activeLinkUnderline && (
                <ColorSwatchRow
                  label={t("underlineColorLabel")}
                  active={header.underlineColor}
                  brandKit={brandKit}
                  onToggle={(c) => set("underlineColor", c)}
                />
              )}
            </DesignDrawer>

            <DesignDrawer
              title={t("sectionContactButton")}
              open={openDrawer === "contactButton"}
              onToggle={() => setOpenDrawer((current) => current === "contactButton" ? null : "contactButton")}
            >

              <ColorSwatchRow
                label={t("contactButtonColorLabel")}
                active={header.contactButtonColor}
                brandKit={brandKit}
                onToggle={(c) => set("contactButtonColor", c)}
              />
              <NumberInputRow
                label={t("contactButtonOpacityLabel")}
                value={header.contactButtonOpacity ?? 100}
                min={0}
                max={100}
                suffix="%"
                onChange={(v) => set("contactButtonOpacity", v ?? 100)}
              />
              <ColorSwatchRow
                label={t("contactButtonTextColorLabel")}
                active={header.contactButtonTextColor}
                brandKit={brandKit}
                onToggle={(c) => set("contactButtonTextColor", c)}
              />
              <RadiusRow
                label={t("cornerRadiusLabel")}
                active={header.contactButtonRadius}
                onToggle={(radius) => set("contactButtonRadius", radius)}
                getLabel={(radius) => t(`radius.${radius}`)}
              />
            </DesignDrawer>
          </div>
        )}
      </div>

    </div>
  );
}
