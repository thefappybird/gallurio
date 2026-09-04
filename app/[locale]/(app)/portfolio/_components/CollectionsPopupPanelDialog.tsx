"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { NumberInputRow, ColorSwatchRow } from "@/lib/page-builder/toolbarPrimitives";
import { EditorDrawerSection, EditorDrawerGroup } from "@/lib/page-builder/EditorDrawerSection";
import { PORTFOLIO_FONT_KEYS, PORTFOLIO_FONTS } from "@/lib/page-builder/fonts";
import type { PortfolioFontKey } from "@/lib/page-builder/fonts";
import { useBrandRadius } from "@/lib/page-builder/brandColors";
import {
  BRAND_KIT_RADII,
  POPUP_LAYOUTS,
  IMAGE_MODAL_LAYOUTS,
  resolvePopupLayout,
  resolveImageModalLayout,
  type BrandKitRadius,
  type PopupLayout,
  type ImageModalLayout,
  type PortfolioBrandKit,
  type PortfolioCollectionsPopupConfig,
} from "@/lib/page-builder/types";
import type { StyleColorToken } from "@/lib/page-builder/styleToolkit";
import {
  LayoutPicker,
  LayoutPreviewCard,
  renderPopupLayoutThumb,
  renderImageModalLayoutThumb,
  type LayoutPickerOption,
} from "./LayoutPicker";

// Maps a PopupLayout id (kebab-case) to its camelCase locale-key segment —
// JSON object keys avoid hyphens elsewhere in this catalog, so keep that rule.
const POPUP_LAYOUT_MESSAGE_KEY: Record<PopupLayout, string> = {
  "contact-sheet": "contactSheet",
  justified: "justified",
  "split-index": "splitIndex",
  immersive: "immersive",
};

// Which of this dialog's three control sections apply to a given popup
// layout. `immersive` renders full-viewport instead of the popup chrome, so
// none of the chrome's own style controls (background/border/corners, title,
// close button) affect it. Annotate only — never hide or disable these.
const LAYOUT_RELEVANCE: Record<PopupLayout, { popup: boolean; titleStyles: boolean; buttonStyles: boolean }> = {
  "contact-sheet": { popup: true, titleStyles: true, buttonStyles: true },
  justified: { popup: true, titleStyles: true, buttonStyles: true },
  "split-index": { popup: true, titleStyles: true, buttonStyles: true },
  immersive: { popup: false, titleStyles: false, buttonStyles: false },
};

function NotUsedNote({ text }: { text: string }) {
  return <p className="text-xs italic text-muted-foreground">{text}</p>;
}

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
  effectiveWidth = 1,
}: {
  widthLabel: string;
  colorLabel: string;
  width: number | undefined;
  color: string | undefined;
  onWidthChange: (v: number | undefined) => void;
  onColorChange: (v: string | undefined) => void;
  effectiveWidth?: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <NumberInputRow
        label={widthLabel}
        value={width}
        min={0}
        max={12}
        onChange={onWidthChange}
        effectiveValue={effectiveWidth}
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
  const t = useTranslations("app.pageBuilder.editor");
  const radiusLabels: Record<BrandKitRadius, string> = {
    sharp: t("collectionsDialog.radius.sharp"),
    subtle: t("collectionsDialog.radius.subtle"),
    rounded: t("collectionsDialog.radius.rounded"),
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
  const t = useTranslations("app.pageBuilder.editor");

  function set<K extends keyof PortfolioCollectionsPopupConfig>(
    key: K,
    value: PortfolioCollectionsPopupConfig[K],
  ) {
    onChange({ ...config, [key]: value });
  }

  const popupLayout = resolvePopupLayout(config.popupLayout);
  const imageModalLayout = resolveImageModalLayout(config.imageModalLayout);
  const relevance = LAYOUT_RELEVANCE[popupLayout];
  const immersiveSelected = popupLayout === "immersive";

  const popupLayoutOptions: LayoutPickerOption[] = POPUP_LAYOUTS.map((id) => ({
    id,
    label: t(`collectionsDialog.popupLayouts.${POPUP_LAYOUT_MESSAGE_KEY[id]}.label`),
    description: t(`collectionsDialog.popupLayouts.${POPUP_LAYOUT_MESSAGE_KEY[id]}.description`),
  }));

  const imageModalLayoutOptions: LayoutPickerOption[] = IMAGE_MODAL_LAYOUTS.map((id) => ({
    id,
    label: t(`collectionsDialog.imageModalLayouts.${id}.label`),
    description: t(`collectionsDialog.imageModalLayouts.${id}.description`),
  }));

  return (
    <div
      className="flex w-[360px] flex-col border-s border-border bg-card"
      role="complementary"
      aria-label="Featured popup style"
    >
      {/* Header */}
      <div className="flex items-center border-b border-border px-4 py-3">
        <span className="text-sm font-semibold text-foreground">
          {t("collectionsDialog.featuredPopup")}
        </span>
      </div>

      {/* One shared, anchored preview card for both layout pickers below —
          never one per picker instance. See LayoutPicker.tsx. */}
      <LayoutPreviewCard />

      {/* Scrollable controls */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
        <EditorDrawerGroup plain>
          <EditorDrawerSection title={t("collectionsDialog.layout")} flat>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">
                {t("collectionsDialog.popupLayoutLabel")}
              </span>
              <LayoutPicker
                ariaLabel={t("collectionsDialog.popupLayoutLabel")}
                options={popupLayoutOptions}
                value={popupLayout}
                onChange={(id) => set("popupLayout", id as PopupLayout)}
                renderThumb={renderPopupLayoutThumb}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">
                {t("collectionsDialog.imageModalLayoutLabel")}
              </span>
              <LayoutPicker
                ariaLabel={t("collectionsDialog.imageModalLayoutLabel")}
                options={imageModalLayoutOptions}
                value={imageModalLayout}
                onChange={(id) => set("imageModalLayout", id as ImageModalLayout)}
                renderThumb={renderImageModalLayoutThumb}
              />
              {immersiveSelected && (
                <p className="text-xs text-muted-foreground">
                  {t("collectionsDialog.immersiveModalScopeNote")}
                </p>
              )}
            </div>
          </EditorDrawerSection>
        </EditorDrawerGroup>

        <EditorDrawerGroup plain>
          {/* ── Popup ────────────────────────────── */}
          <EditorDrawerSection title={t("collectionsDialog.popup")}>
            {!relevance.popup && <NotUsedNote text={t("collectionsDialog.notUsedByLayout")} />}
            {/* backgroundColor: unset → var(--pf-color-bg); effective = "background" token */}
            <LabeledSwatchRow
              label={t("collectionsDialog.background")}
              value={config.backgroundColor}
              onChange={(c) => set("backgroundColor", c)}
              effectiveValue="background"
            />

            <BorderRow
              widthLabel={t("collectionsDialog.border")}
              colorLabel={t("collectionsDialog.borderColor")}
              width={config.borderWidth}
              color={config.borderColor}
              onWidthChange={(v) => set("borderWidth", v)}
              onColorChange={(v) => set("borderColor", v)}
            />

            {/* radius: fallback = "0px" (sharp) when unset → effective = brand radius */}
            <RadiusRow
              label={t("collectionsDialog.corners")}
              active={config.radius}
              onToggle={(r) => set("radius", r)}
              effectiveValue={effectiveBrandRadius}
            />
          </EditorDrawerSection>

          {/* ── Title styles ──────────────────────── */}
          <EditorDrawerSection title={t("collectionsDialog.titleStyles")}>
            {!relevance.titleStyles && <NotUsedNote text={t("collectionsDialog.notUsedByLayout")} />}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs text-muted-foreground"
                htmlFor="popup-title-text"
              >
                {t("collectionsDialog.headerText")}
              </label>
              <input
                id="popup-title-text"
                type="text"
                value={config.titleText ?? ""}
                placeholder={t("collectionsDialog.headerPlaceholder")}
                onChange={(e) => set("titleText", e.target.value || undefined)}
                className="h-8 border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                aria-pressed={!!config.titleBold}
                aria-label={t("collectionsDialog.bold")}
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
                aria-label={t("collectionsDialog.italic")}
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
                aria-label={t("collectionsDialog.underline")}
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
                  aria-label={t("collectionsDialog.alignAria", { align: a })}
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
              <span className="shrink-0 text-xs text-muted-foreground">{t("collectionsDialog.font")}</span>
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
                <option value="">{t("collectionsDialog.themeFont")}</option>
                {PORTFOLIO_FONT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {PORTFOLIO_FONTS[key].label}
                  </option>
                ))}
              </select>
            </div>

            {/* titleFontSize: effective default = 16 (browser default; no brand font-size token) */}
            <NumberInputRow
              label={t("collectionsDialog.fontSize")}
              value={config.titleFontSize}
              min={10}
              max={120}
              suffix="px"
              onChange={(v) => set("titleFontSize", v)}
              effectiveValue={18}
            />

            {/* titleColorToken: fallback = var(--pf-color-foreground, #111) → "foreground" */}
            <LabeledSwatchRow
              label={t("collectionsDialog.titleColor")}
              value={config.titleColorToken}
              onChange={(c) => set("titleColorToken", c)}
              effectiveValue="foreground"
            />
          </EditorDrawerSection>

          {/* ── Button styles ─────────────────────── */}
          <EditorDrawerSection title={t("collectionsDialog.buttonStyles")}>
            {!relevance.buttonStyles && <NotUsedNote text={t("collectionsDialog.notUsedByLayout")} />}
            {/* closeButtonSize: fallback = 36px */}
            <NumberInputRow
              label={t("collectionsDialog.buttonSize")}
              value={config.closeButtonSize}
              min={24}
              max={72}
              suffix="px"
              onChange={(v) => set("closeButtonSize", v)}
              effectiveValue={36}
            />

            {/* closeButtonRadius: unset/cleared → rounded (16px); effectiveValue = "rounded" */}
            <RadiusRow
              label={t("collectionsDialog.corners")}
              active={config.closeButtonRadius}
              onToggle={(r) => set("closeButtonRadius", r)}
              effectiveValue="rounded"
            />

            <BorderRow
              widthLabel={t("collectionsDialog.border")}
              colorLabel={t("collectionsDialog.borderColor")}
              width={config.closeButtonBorderWidth}
              color={config.closeButtonBorderColorToken}
              onWidthChange={(v) => set("closeButtonBorderWidth", v)}
              onColorChange={(v) => set("closeButtonBorderColorToken", v)}
              effectiveWidth={1}
            />

            {/* closeButtonOpacity: fallback = 100 */}
            <NumberInputRow
              label={t("collectionsDialog.opacity")}
              value={config.closeButtonOpacity}
              min={0}
              max={100}
              suffix="%"
              onChange={(v) => set("closeButtonOpacity", v)}
              effectiveValue={100}
            />

            {/* closeButtonBgColorToken: fallback = var(--pf-color-surface, #fff) — no palette token; effectiveValue unset */}
            <LabeledSwatchRow
              label={t("collectionsDialog.background")}
              value={config.closeButtonBgColorToken}
              onChange={(c) => set("closeButtonBgColorToken", c)}
              effectiveValue="background"
            />
          </EditorDrawerSection>
        </EditorDrawerGroup>
      </div>
    </div>
  );
}
