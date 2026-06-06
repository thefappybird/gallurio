"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { RotateCcw, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { NumberInputRow } from "@/lib/page-builder/toolbarPrimitives";
import {
  CONTACT_BUTTON_COLORS,
  HEADER_SHADOW_SIZES,
  HEADER_FONT_SIZES,
  type PortfolioBrandKit,
  type PortfolioHeaderConfig,
} from "@/lib/page-builder/types";
import { updateHeaderConfigAction } from "../_actions";

type Tab = "setup" | "design";

const COLOR_TOKENS = CONTACT_BUTTON_COLORS;

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

const CLOUDINARY_UPLOAD_URL = (cloudName: string) =>
  `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

export function HeaderPanelDialog({
  header,
  onHeaderChange,
  brandKit,
  workspaceName,
  onSaved,
  onCancel,
}: Props) {
  const t = useTranslations("app.pageBuilder.editor.headerDialog");
  const te = useTranslations("app.pageBuilder.editor");
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [tab, setTab] = useState<Tab>("setup");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof PortfolioHeaderConfig>(key: K, value: PortfolioHeaderConfig[K]) {
    onHeaderChange({ ...header, [key]: value });
  }

  function toggleBool<K extends "activeLinkScale" | "activeLinkHighlight" | "activeLinkUnderline">(key: K) {
    set(key, !header[key]);
  }

  async function uploadLogo(file: File) {
    setLogoUploading(true);
    try {
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: "portfolio/header" }),
      });
      if (!signRes.ok) throw new Error("sign_failed");
      const { signature, timestamp, api_key, cloud_name, folder } = await signRes.json() as {
        signature: string; timestamp: number; api_key: string; cloud_name: string; folder: string;
      };

      const formData = new FormData();
      formData.append("file", file);
      formData.append("signature", signature);
      formData.append("timestamp", String(timestamp));
      formData.append("api_key", api_key);
      formData.append("folder", folder);

      const uploadRes = await fetch(CLOUDINARY_UPLOAD_URL(cloud_name), { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("upload_failed");
      const { secure_url, public_id } = await uploadRes.json() as { secure_url: string; public_id: string };

      onHeaderChange({ ...header, logoUrl: secure_url, logoPublicId: public_id });
    } catch {
      toast.error(te("errorToast"));
    } finally {
      setLogoUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const res = await updateHeaderConfigAction(header);
      if ("error" in res) {
        toast.error(te("errorToast"));
        return;
      }
      toast.success(te("savedToast"));
      onSaved();
    } finally {
      setSaving(false);
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

  return (
    <div
      className="flex w-[280px] flex-col border-l border-border bg-card"
      role="complementary"
      aria-label={t("title")}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold text-foreground">{t("title")}</span>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("close")}
          className="flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <X className="size-4" aria-hidden />
        </button>
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
                value={header.brandText ?? ""}
                placeholder={workspaceName}
                maxLength={80}
                onChange={(e) => set("brandText", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t("brandTextHelp")}</p>
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
                    onClick={() => onHeaderChange({ ...header, logoUrl: "", logoPublicId: "" })}
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
                  className="inline-flex h-9 items-center justify-center gap-1.5 border border-border bg-background px-3 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
                >
                  <Upload className="size-3.5" aria-hidden />
                  {logoUploading ? t("logoUploading") : t("logoUpload")}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
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
            <div className="flex flex-col gap-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-foreground">
                {t("sectionBanner")}
              </span>

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
            </div>

            <div className="border-t border-border" />

            {/* ── Links ──────────────────────────────── */}
            <div className="flex flex-col gap-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-foreground">
                {t("sectionLinks")}
              </span>

              {/* Font size */}
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
                label={t("activeLinkColorLabel")}
                active={header.activeLinkColor}
                brandKit={brandKit}
                onToggle={(c) => set("activeLinkColor", c)}
              />
            </div>

            <div className="border-t border-border" />

            {/* ── Active link style ──────────────────── */}
            <div className="flex flex-col gap-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-foreground">
                {t("sectionActiveStyle")}
              </span>

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

              {/* Conditional: underline color */}
              {header.activeLinkUnderline && (
                <ColorSwatchRow
                  label={t("underlineColorLabel")}
                  active={header.underlineColor}
                  brandKit={brandKit}
                  onToggle={(c) => set("underlineColor", c)}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-2 border-t border-border px-4 py-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving} className="flex-1">
          {te("publishDialog.cancel")}
        </Button>
        <Button type="button" onClick={save} disabled={saving} className="flex-1">
          {saving ? t("saving") : t("save")}
        </Button>
      </div>
    </div>
  );
}
