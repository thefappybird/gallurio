"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { EditorDrawerSection, EditorDrawerGroup } from "@/lib/page-builder/EditorDrawerSection";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { NumberInputRow, ColorSwatchRow } from "@/lib/page-builder/toolbarPrimitives";
import { useBrandRadius } from "@/lib/page-builder/brandColors";
import { CRM_ERROR_COLOR } from "@/app/(public)/w/[orgSlug]/_components/contactButtonAppearance";
import type { StyleColorToken } from "@/lib/page-builder/styleToolkit";
import {
  BRAND_KIT_BUTTON_STYLES,
  BRAND_KIT_RADII,
  HEADER_FONT_SIZES,
  type BrandKitRadius,
  type PortfolioBrandKit,
  type PortfolioContactConfig,
} from "@/lib/page-builder/types";

const FORM_LOCALES = ["", "en", "fil", "ms", "id"] as const;

const selectClass =
  "min-h-9 w-full border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

type Tab = "setup" | "design";

type Props = {
  open: boolean;
  contact: PortfolioContactConfig;
  onContactChange: (next: PortfolioContactConfig) => void;
  formLocale: string;
  onFormLocaleChange: (next: string) => void;
  /** Accepted for API compat but no longer consumed — shared ColorSwatchRow uses BrandColorsContext. */
  brandKit?: PortfolioBrandKit;
  /** Called after a successful DB save — parent updates snapshot. */
  onSaved: () => void;
  /** Called on X / cancel — parent reverts to snapshot. */
  onCancel: () => void;
};

const ERROR_SWATCHES: { value: string; label: string }[] = [{ value: CRM_ERROR_COLOR, label: "Error" }];

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
  extraSwatches,
}: {
  label: string;
  value: StyleColorToken | string | undefined;
  onChange: (next: StyleColorToken | string | undefined) => void;
  allowNone?: boolean;
  effectiveValue?: StyleColorToken | string;
  extraSwatches?: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <ColorSwatchRow
        value={value}
        onChange={onChange}
        allowNone={allowNone}
        effectiveValue={effectiveValue}
        extraSwatches={extraSwatches}
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
        // borderColor fallback varies; leave effectiveValue unset
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
  getLabel,
  effectiveValue,
}: {
  label: string;
  active: BrandKitRadius | undefined;
  onToggle: (radius: BrandKitRadius) => void;
  getLabel: (radius: BrandKitRadius) => string;
  effectiveValue?: BrandKitRadius;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex">
        {BRAND_KIT_RADII.map((r) => {
          const isExplicit = active === r;
          const isEffective = !active && effectiveValue === r;
          return (
            <button
              key={r}
              type="button"
              aria-label={getLabel(r)}
              aria-pressed={isExplicit || isEffective}
              onClick={() => onToggle(r)}
              className={cn(
                "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isExplicit && "bg-foreground text-background hover:bg-foreground",
                isEffective && "border-foreground opacity-70",
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


export function ContactPanelDialog({
  open,
  contact,
  onContactChange,
  formLocale,
  onFormLocaleChange,
}: Props) {
  const t = useTranslations("app.pageBuilder.editor.contactDialog");
  const [tab, setTab] = useState<Tab>("setup");

  // Effective brand radius for radius pickers (display-only, theme-coupled)
  const effectiveBrandRadius = useBrandRadius();

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
            data-tour-id={`contact-${id}-tab`}
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
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
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
          <EditorDrawerGroup plain>
            {/* ── Popup section ─────────────────────────── */}
            <EditorDrawerSection title={t("sectionPopup")}>
              {/* text color: resolvePopupStyle falls back to brandKit.foregroundColor → "foreground" token */}
              <LabeledSwatchRow
                label={t("textColorLabel")}
                value={contact.textColor}
                onChange={(c) => set("textColor", c)}
                effectiveValue="foreground"
              />

              {/* bg color: resolvePopupStyle falls back to brandKit.backgroundColor → "background" token */}
              <LabeledSwatchRow
                label={t("bgColorLabel")}
                value={contact.backgroundColor}
                onChange={(c) => set("backgroundColor", c)}
                effectiveValue="background"
              />

              {/* error color: resolveSubmitAppearance falls back to CRM_ERROR_COLOR */}
              <LabeledSwatchRow
                label={t("errorColorLabel")}
                value={contact.errorMessageColor}
                onChange={(c) => set("errorMessageColor", c)}
                effectiveValue={CRM_ERROR_COLOR}
                extraSwatches={ERROR_SWATCHES}
              />

              <RadiusRow
                label={t("cornerRadiusLabel")}
                active={contact.popupRadius}
                onToggle={(r) => toggleRadius("popupRadius", r)}
                getLabel={(r) => t(`radius.${r}`)}
                effectiveValue={effectiveBrandRadius}
              />

              <BorderRow
                widthLabel={t("borderWidthLabel")}
                colorLabel={t("borderColorLabel")}
                width={contact.popupBorderWidth}
                color={contact.popupBorderColor}
                onWidthChange={(v) => set("popupBorderWidth", v)}
                onColorChange={(v) => set("popupBorderColor", v)}
              />
            </EditorDrawerSection>

            {/* ── Button section ────────────────────────── */}
            <EditorDrawerSection title={t("sectionButton")}>
              <ButtonControlsSection
                title={t("submitButtonSection")}
                styleValue={contact.buttonStyle}
                onStyleToggle={(style) => toggleColor("buttonStyle", style)}
                textColorValue={contact.buttonTextColor}
                onTextColorToggle={(c) => set("buttonTextColor", c)}
                buttonColorValue={contact.buttonColor}
                onButtonColorToggle={(c) => set("buttonColor", c)}
                radiusValue={contact.buttonRadius}
                onRadiusToggle={(r) => toggleRadius("buttonRadius", r)}
                borderWidthValue={contact.buttonBorderWidth}
                onBorderWidthChange={(v) => set("buttonBorderWidth", v)}
                borderColorValue={contact.buttonBorderColor}
                onBorderColorChange={(v) => set("buttonBorderColor", v)}
                effectiveBrandRadius={effectiveBrandRadius}
                defaultStyle="solid"
                defaultButtonColorToken="primary"
                t={t}
              />

              <ButtonControlsSection
                title={t("addSessionButtonSection")}
                styleValue={contact.addSessionButtonStyle}
                onStyleToggle={(style) => toggleColor("addSessionButtonStyle", style)}
                textColorValue={contact.addSessionButtonTextColor}
                onTextColorToggle={(c) => set("addSessionButtonTextColor", c)}
                buttonColorValue={contact.addSessionButtonColor}
                onButtonColorToggle={(c) => set("addSessionButtonColor", c)}
                radiusValue={contact.addSessionButtonRadius}
                onRadiusToggle={(r) => toggleRadius("addSessionButtonRadius", r)}
                borderWidthValue={contact.addSessionButtonBorderWidth}
                onBorderWidthChange={(v) => set("addSessionButtonBorderWidth", v)}
                borderColorValue={contact.addSessionButtonBorderColor}
                onBorderColorChange={(v) => set("addSessionButtonBorderColor", v)}
                effectiveBrandRadius={effectiveBrandRadius}
                defaultStyle="outline"
                defaultButtonColorToken="foreground"
                t={t}
              />
            </EditorDrawerSection>

            {/* ── Tabs section ──────────────────────────── */}
            <EditorDrawerSection title={t("sectionTabs")}>
              {/* Tab font size applies to ALL tabs (active + inactive), so it lives at
                  the Tabs level — outside both the inactive and active sub-sections. */}
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

              {/* Inactive tabs sub-section */}
              <EditorDrawerSection title={t("inactiveTabsSection")}>
                {/* inactive tab color: resolveTabColor falls back to "" (no color applied) — no effective token */}
                <LabeledSwatchRow
                  label={t("tabColorLabel")}
                  value={contact.tabColor}
                  onChange={(c) => set("tabColor", c)}
                />
              </EditorDrawerSection>

              {/* Active tab sub-section */}
              <EditorDrawerSection title={t("activeTabSection")}>
                {/* active tab color: getActiveTabExtraStyle falls back to var(--pf-color-fg) → "foreground" */}
                <LabeledSwatchRow
                  label={t("activeTabColorLabel")}
                  value={contact.activeTabColor}
                  onChange={(c) => set("activeTabColor", c)}
                  effectiveValue="foreground"
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
                  <>
                    {/* highlight color: resolveTabColor falls back to fg-mix (~"foreground") */}
                    <LabeledSwatchRow
                      label={t("tabHighlightColorLabel")}
                      value={contact.tabHighlightColor}
                      onChange={(c) => set("tabHighlightColor", c)}
                      effectiveValue="foreground"
                    />
                    <NumberInputRow
                      label={t("tabHighlightOpacityLabel")}
                      value={contact.tabHighlightOpacity}
                      min={0}
                      max={100}
                      suffix="%"
                      onChange={(v) => set("tabHighlightOpacity", v)}
                      effectiveValue={100}
                    />
                    <ActiveTabRadiusRow
                      label={t("cornerRadiusLabel")}
                      active={contact.activeTabRadius}
                      onToggle={toggleTabRadius}
                      getLabel={(r) => t(`radius.${r}`)}
                    />
                  </>
                )}

                {/* Conditional: underline color — resolveTabColor falls back to var(--pf-color-accent) → "accent" */}
                {contact.activeTabUnderline && (
                  <LabeledSwatchRow
                    label={t("tabUnderlineColorLabel")}
                    value={contact.tabUnderlineColor}
                    onChange={(c) => set("tabUnderlineColor", c)}
                    effectiveValue="accent"
                  />
                )}
              </EditorDrawerSection>
            </EditorDrawerSection>
          </EditorDrawerGroup>
        )}
      </div>

    </div>
  );
}

/**
 * Derive the effective button text color token given button style + button color.
 * Mirrors resolveSubmitAppearance / buildButtonStyle variant rules so the control
 * display matches what the render applies.
 *
 * solid → "background" (text on filled button)
 * outline / soft → buttonColorToken ?? defaultButtonColorToken (text matches border/bg)
 * unset → "foreground" (fallback for legacy / unset style)
 */
function effectiveTextColorToken(
  style: string | undefined,
  buttonColorToken: string | undefined,
  defaultButtonColorToken: StyleColorToken,
): StyleColorToken | string {
  if (style === "solid") return "background";
  if (style === "outline" || style === "soft") {
    return (buttonColorToken && !buttonColorToken.startsWith("#"))
      ? (buttonColorToken as StyleColorToken)
      : (buttonColorToken ?? defaultButtonColorToken);
  }
  return "foreground";
}

function ButtonControlsSection({
  title,
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
  effectiveBrandRadius,
  defaultStyle,
  defaultButtonColorToken,
  t,
}: {
  title: string;
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
  effectiveBrandRadius: BrandKitRadius | undefined;
  /** Default style token when styleValue is unset (used to compute effective text color). */
  defaultStyle: "solid" | "outline";
  /** Default button color token when buttonColorValue is unset and style is outline/soft. */
  defaultButtonColorToken: StyleColorToken;
  t: ReturnType<typeof useTranslations>;
}) {
  const activeStyle = styleValue ?? defaultStyle;
  const effectiveTextToken = effectiveTextColorToken(
    activeStyle,
    buttonColorValue,
    defaultButtonColorToken,
  );

  // Effective button color token: resolveSubmitAppearance falls back to defaultButtonColorToken
  const effectiveButtonColorToken: StyleColorToken = defaultButtonColorToken;

  return (
    <EditorDrawerSection title={title}>
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

      {/* text color: effective token depends on button variant */}
      <LabeledSwatchRow
        label={t("textColorLabel")}
        value={textColorValue}
        onChange={onTextColorToggle}
        effectiveValue={effectiveTextToken}
      />

      {/* button color: resolveSubmitAppearance / resolveAddSessionAppearance fallback */}
      <LabeledSwatchRow
        label={t("buttonColorLabel")}
        value={buttonColorValue}
        onChange={onButtonColorToggle}
        effectiveValue={effectiveButtonColorToken}
      />

      <RadiusRow
        label={t("cornerRadiusLabel")}
        active={radiusValue}
        onToggle={onRadiusToggle}
        getLabel={(r) => t(`radius.${r}`)}
        effectiveValue={effectiveBrandRadius}
      />

      <BorderRow
        widthLabel={t("borderWidthLabel")}
        colorLabel={t("borderColorLabel")}
        width={borderWidthValue}
        color={borderColorValue}
        onWidthChange={onBorderWidthChange}
        onColorChange={onBorderColorChange}
      />
    </EditorDrawerSection>
  );
}
