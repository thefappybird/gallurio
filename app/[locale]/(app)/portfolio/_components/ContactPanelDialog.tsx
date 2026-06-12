"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { NumberInputRow } from "@/lib/page-builder/toolbarPrimitives";
import {
  BRAND_KIT_BUTTON_STYLES,
  BRAND_KIT_RADII,
  CONTACT_BUTTON_COLORS,
  HEADER_FONT_SIZES,
  type BrandKitRadius,
  type PortfolioBrandKit,
  type PortfolioContactConfig,
} from "@/lib/page-builder/types";

const FORM_LOCALES = ["", "en", "fil", "ms", "id"] as const;

const selectClass =
  "min-h-9 w-full border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

type Tab = "setup" | "design";
type DrawerId = "popup" | "button" | "tabs";
type ButtonDrawerId = "submit" | "addSession";
type TabDrawerId = "inactiveTabs" | "activeTab";

type Props = {
  open: boolean;
  contact: PortfolioContactConfig;
  onContactChange: (next: PortfolioContactConfig) => void;
  formLocale: string;
  onFormLocaleChange: (next: string) => void;
  brandKit: PortfolioBrandKit;
  /** Called after a successful DB save — parent updates snapshot. */
  onSaved: () => void;
  /** Called on X / cancel — parent reverts to snapshot. */
  onCancel: () => void;
};

/** Map brand-kit color token names to their actual hex values. */
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
  getLabel,
  allowNone = true,
}: {
  label: string;
  active: string | undefined;
  brandKit: PortfolioBrandKit;
  onToggle: (color: string | undefined) => void;
  getLabel: (color: (typeof CONTACT_BUTTON_COLORS)[number]) => string;
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
              title={getLabel(colorToken)}
              aria-label={getLabel(colorToken)}
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
  getColorLabel,
}: {
  widthLabel: string;
  colorLabel: string;
  width: number | undefined;
  color: string | undefined;
  brandKit: PortfolioBrandKit;
  onWidthChange: (v: number | undefined) => void;
  onColorChange: (v: string | undefined) => void;
  getColorLabel: (c: (typeof CONTACT_BUTTON_COLORS)[number]) => string;
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
          getLabel={getColorLabel}
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
  getLabel,
}: {
  label: string;
  active: BrandKitRadius | undefined;
  onToggle: (radius: BrandKitRadius) => void;
  getLabel: (radius: BrandKitRadius) => string;
}) {
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
              aria-label={getLabel(r)}
              aria-pressed={isActive}
              onClick={() => onToggle(r)}
              className={cn(
                "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isActive && "bg-foreground text-background hover:bg-foreground",
              )}
            >
              {getLabel(r)}
            </button>
          );
        })}
      </div>
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

function ActiveTabRadiusRow({
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

export function ContactPanelDialog({
  open,
  contact,
  onContactChange,
  formLocale,
  onFormLocaleChange,
  brandKit,
}: Props) {
  const t = useTranslations("app.pageBuilder.editor.contactDialog");
  const [tab, setTab] = useState<Tab>("setup");
  const [openDrawer, setOpenDrawer] = useState<DrawerId | null>(null);
  const [openButtonDrawer, setOpenButtonDrawer] = useState<ButtonDrawerId | null>(null);
  const [openTabDrawer, setOpenTabDrawer] = useState<TabDrawerId | null>(null);

  if (!open) return null;

  function set<K extends keyof PortfolioContactConfig>(
    key: K,
    value: PortfolioContactConfig[K],
  ) {
    onContactChange({ ...contact, [key]: value });
  }

  function toggleColor<K extends keyof PortfolioContactConfig>(
    key: K,
    color: PortfolioContactConfig[K],
  ) {
    set(key, contact[key] === color ? undefined : color);
  }

  function toggleRadius<K extends "popupRadius" | "buttonRadius" | "addSessionButtonRadius">(
    key: K,
    radius: BrandKitRadius,
  ) {
    set(key, contact[key] === radius ? undefined : radius);
  }

  function toggleTabBool<K extends "activeTabScale" | "activeTabHighlight" | "activeTabUnderline">(key: K) {
    set(key, !contact[key]);
  }

  function toggleTabRadius(radius: BrandKitRadius | "") {
    set("activeTabRadius", radius);
  }

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
              tab === id
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground",
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
            <p className="text-sm text-muted-foreground">{t("formFixedNote")}</p>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-language">{t("languageLabel")}</Label>
              <p className="text-xs text-muted-foreground">{t("languageHelp")}</p>
              <select
                id="contact-language"
                className={selectClass}
                value={formLocale}
                onChange={(e) => onFormLocaleChange(e.target.value)}
              >
                {FORM_LOCALES.map((loc) => (
                  <option key={loc || "auto"} value={loc}>
                    {t(`languages.${loc || "auto"}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-title">{t("titleLabel")}</Label>
              <Input
                id="contact-title"
                value={contact.title ?? ""}
                maxLength={80}
                placeholder={t("titlePlaceholder")}
                onChange={(e) => set("title", e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-description">{t("descriptionLabel")}</Label>
              <Textarea
                id="contact-description"
                rows={4}
                value={contact.description ?? ""}
                maxLength={280}
                placeholder={t("descriptionPlaceholder")}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>
          </>
        )}

        {tab === "design" && (
          <div className="flex flex-col gap-6">
            {/* ── Popup section ─────────────────────────── */}
            <DesignDrawer
              title={t("sectionPopup")}
              open={openDrawer === "popup"}
              onToggle={() => setOpenDrawer((current) => current === "popup" ? null : "popup")}
            >

              <ColorSwatchRow
                label={t("textColorLabel")}
                active={contact.textColor}
                brandKit={brandKit}
                onToggle={(c) => toggleColor("textColor", c)}
                getLabel={(c) => t(`buttonColors.${c}`)}
              />

              <ColorSwatchRow
                label={t("bgColorLabel")}
                active={contact.backgroundColor}
                brandKit={brandKit}
                onToggle={(c) => toggleColor("backgroundColor", c)}
                getLabel={(c) => t(`buttonColors.${c}`)}
              />

              <ColorSwatchRow
                label={t("errorColorLabel")}
                active={contact.errorMessageColor}
                brandKit={brandKit}
                onToggle={(c) => toggleColor("errorMessageColor", c)}
                getLabel={(c) => t(`buttonColors.${c}`)}
              />

              <RadiusRow
                label={t("cornerRadiusLabel")}
                active={contact.popupRadius}
                onToggle={(r) => toggleRadius("popupRadius", r)}
                getLabel={(r) => t(`radius.${r}`)}
              />

              <BorderRow
                widthLabel={t("borderWidthLabel")}
                colorLabel={t("borderColorLabel")}
                width={contact.popupBorderWidth}
                color={contact.popupBorderColor}
                brandKit={brandKit}
                onWidthChange={(v) => set("popupBorderWidth", v)}
                onColorChange={(v) => set("popupBorderColor", v)}
                getColorLabel={(c) => t(`buttonColors.${c}`)}
              />
            </DesignDrawer>

            <div className="border-t border-border" />

            {/* ── Button section ────────────────────────── */}
            <DesignDrawer
              title={t("sectionButton")}
              open={openDrawer === "button"}
              onToggle={() => setOpenDrawer((current) => current === "button" ? null : "button")}
            >
              <ButtonControlsSection
                title={t("submitButtonSection")}
                open={openButtonDrawer === "submit"}
                onToggle={() => setOpenButtonDrawer((current) => current === "submit" ? null : "submit")}
                styleValue={contact.buttonStyle}
                onStyleToggle={(style) => toggleColor("buttonStyle", style)}
                textColorValue={contact.buttonTextColor}
                onTextColorToggle={(c) => toggleColor("buttonTextColor", c)}
                buttonColorValue={contact.buttonColor}
                onButtonColorToggle={(c) => toggleColor("buttonColor", c)}
                radiusValue={contact.buttonRadius}
                onRadiusToggle={(r) => toggleRadius("buttonRadius", r)}
                borderWidthValue={contact.buttonBorderWidth}
                onBorderWidthChange={(v) => set("buttonBorderWidth", v)}
                borderColorValue={contact.buttonBorderColor}
                onBorderColorChange={(v) => set("buttonBorderColor", v)}
                brandKit={brandKit}
                t={t}
              />

              <ButtonControlsSection
                title={t("addSessionButtonSection")}
                open={openButtonDrawer === "addSession"}
                onToggle={() => setOpenButtonDrawer((current) => current === "addSession" ? null : "addSession")}
                styleValue={contact.addSessionButtonStyle}
                onStyleToggle={(style) => toggleColor("addSessionButtonStyle", style)}
                textColorValue={contact.addSessionButtonTextColor}
                onTextColorToggle={(c) => toggleColor("addSessionButtonTextColor", c)}
                buttonColorValue={contact.addSessionButtonColor}
                onButtonColorToggle={(c) => toggleColor("addSessionButtonColor", c)}
                radiusValue={contact.addSessionButtonRadius}
                onRadiusToggle={(r) => toggleRadius("addSessionButtonRadius", r)}
                borderWidthValue={contact.addSessionButtonBorderWidth}
                onBorderWidthChange={(v) => set("addSessionButtonBorderWidth", v)}
                borderColorValue={contact.addSessionButtonBorderColor}
                onBorderColorChange={(v) => set("addSessionButtonBorderColor", v)}
                brandKit={brandKit}
                t={t}
              />
            </DesignDrawer>

            <div className="border-t border-border" />

            {/* ── Tabs section ──────────────────────────── */}
            <DesignDrawer
              title={t("sectionTabs")}
              open={openDrawer === "tabs"}
              onToggle={() => setOpenDrawer((current) => current === "tabs" ? null : "tabs")}
            >
              {/* Inactive tabs sub-drawer */}
              <DesignDrawer
                title={t("inactiveTabsSection")}
                open={openTabDrawer === "inactiveTabs"}
                onToggle={() => setOpenTabDrawer((current) => current === "inactiveTabs" ? null : "inactiveTabs")}
              >
                {/* Font size */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted-foreground">{t("tabFontSizeLabel")}</span>
                  <div className="flex">
                    {HEADER_FONT_SIZES.map((s) => {
                      const isActive = (contact.tabFontSize || "md") === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          aria-label={t(`tabFontSize.${s}`)}
                          aria-pressed={isActive}
                          onClick={() => set("tabFontSize", s === "md" ? "" : s)}
                          className={cn(
                            "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                            isActive && "bg-foreground text-background hover:bg-foreground",
                          )}
                        >
                          {t(`tabFontSize.${s}`)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <ColorSwatchRow
                  label={t("tabColorLabel")}
                  active={contact.tabColor}
                  brandKit={brandKit}
                  onToggle={(c) => set("tabColor", c)}
                  getLabel={(c) => t(`buttonColors.${c}`)}
                />
              </DesignDrawer>

              {/* Active tab sub-drawer */}
              <DesignDrawer
                title={t("activeTabSection")}
                open={openTabDrawer === "activeTab"}
                onToggle={() => setOpenTabDrawer((current) => current === "activeTab" ? null : "activeTab")}
              >
                <ColorSwatchRow
                  label={t("activeTabColorLabel")}
                  active={contact.activeTabColor}
                  brandKit={brandKit}
                  onToggle={(c) => set("activeTabColor", c)}
                  getLabel={(c) => t(`buttonColors.${c}`)}
                />

                {/* Scale / Highlight / Underline toggles */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted-foreground">{t("activeTabStyleLabel")}</span>
                  <div className="flex">
                    <ToggleButton active={!!contact.activeTabScale} onClick={() => toggleTabBool("activeTabScale")}>
                      {t("activeTabStyleScale")}
                    </ToggleButton>
                    <ToggleButton active={!!contact.activeTabHighlight} onClick={() => toggleTabBool("activeTabHighlight")}>
                      {t("activeTabStyleHighlight")}
                    </ToggleButton>
                    <ToggleButton active={!!contact.activeTabUnderline} onClick={() => toggleTabBool("activeTabUnderline")}>
                      {t("activeTabStyleUnderline")}
                    </ToggleButton>
                  </div>
                </div>

                {/* Conditional: highlight controls */}
                {contact.activeTabHighlight && (
                  <ColorSwatchRow
                    label={t("tabHighlightColorLabel")}
                    active={contact.tabHighlightColor}
                    brandKit={brandKit}
                    onToggle={(c) => set("tabHighlightColor", c)}
                    getLabel={(c) => t(`buttonColors.${c}`)}
                  />
                )}
                {contact.activeTabHighlight && (
                  <NumberInputRow
                    label={t("tabHighlightOpacityLabel")}
                    value={contact.tabHighlightOpacity ?? 100}
                    min={0}
                    max={100}
                    suffix="%"
                    onChange={(v) => set("tabHighlightOpacity", v ?? 100)}
                  />
                )}
                {contact.activeTabHighlight && (
                  <ActiveTabRadiusRow
                    label={t("cornerRadiusLabel")}
                    active={contact.activeTabRadius}
                    onToggle={toggleTabRadius}
                    getLabel={(r) => t(`radius.${r}`)}
                  />
                )}

                {/* Conditional: underline color */}
                {contact.activeTabUnderline && (
                  <ColorSwatchRow
                    label={t("tabUnderlineColorLabel")}
                    active={contact.tabUnderlineColor}
                    brandKit={brandKit}
                    onToggle={(c) => set("tabUnderlineColor", c)}
                    getLabel={(c) => t(`buttonColors.${c}`)}
                  />
                )}
              </DesignDrawer>
            </DesignDrawer>
          </div>
        )}
      </div>

    </div>
  );
}

function ButtonControlsSection({
  title,
  open,
  onToggle,
  styleValue,
  onStyleToggle,
  textColorValue,
  onTextColorToggle,
  buttonColorValue,
  onButtonColorToggle,
  radiusValue,
  onRadiusToggle,
  borderWidthValue,
  onBorderWidthChange,
  borderColorValue,
  onBorderColorChange,
  brandKit,
  t,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  styleValue: PortfolioContactConfig["buttonStyle"] | PortfolioContactConfig["addSessionButtonStyle"];
  onStyleToggle: (style: (typeof BRAND_KIT_BUTTON_STYLES)[number]) => void;
  textColorValue: string | undefined;
  onTextColorToggle: (color: string | undefined) => void;
  buttonColorValue: string | undefined;
  onButtonColorToggle: (color: string | undefined) => void;
  radiusValue: BrandKitRadius | undefined;
  onRadiusToggle: (radius: BrandKitRadius) => void;
  borderWidthValue: number | undefined;
  onBorderWidthChange: (width: number | undefined) => void;
  borderColorValue: string | undefined;
  onBorderColorChange: (color: string | undefined) => void;
  brandKit: PortfolioBrandKit;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <DesignDrawer title={title} open={open} onToggle={onToggle}>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">{t("buttonStyleLabel")}</span>
        <div className="flex">
          {BRAND_KIT_BUTTON_STYLES.map((style) => {
            const active = styleValue === style;
            return (
              <button
                key={style}
                type="button"
                aria-label={t(`buttonStyles.${style}`)}
                aria-pressed={active}
                onClick={() => onStyleToggle(style)}
                className={cn(
                  "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  active && "bg-foreground text-background hover:bg-foreground",
                )}
              >
                {t(`buttonStyles.${style}`)}
              </button>
            );
          })}
        </div>
      </div>

      <ColorSwatchRow
        label={t("textColorLabel")}
        active={textColorValue}
        brandKit={brandKit}
        onToggle={onTextColorToggle}
        getLabel={(c) => t(`buttonColors.${c}`)}
      />

      <ColorSwatchRow
        label={t("buttonColorLabel")}
        active={buttonColorValue}
        brandKit={brandKit}
        onToggle={onButtonColorToggle}
        getLabel={(c) => t(`buttonColors.${c}`)}
      />

      <RadiusRow
        label={t("cornerRadiusLabel")}
        active={radiusValue}
        onToggle={onRadiusToggle}
        getLabel={(r) => t(`radius.${r}`)}
      />

      <BorderRow
        widthLabel={t("borderWidthLabel")}
        colorLabel={t("borderColorLabel")}
        width={borderWidthValue}
        color={borderColorValue}
        brandKit={brandKit}
        onWidthChange={onBorderWidthChange}
        onColorChange={onBorderColorChange}
        getColorLabel={(c) => t(`buttonColors.${c}`)}
      />
    </DesignDrawer>
  );
}
