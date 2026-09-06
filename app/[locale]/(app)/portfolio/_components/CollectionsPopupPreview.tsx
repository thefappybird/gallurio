"use client";

import type React from "react";
import { useTranslations } from "next-intl";
import type { PortfolioBrandKit, PortfolioCollectionsPopupConfig } from "@/lib/page-builder/types";
import {
  resolvePopupColumns,
  resolvePopupLayout,
  type PopupColumns,
} from "@/lib/page-builder/types";
import { CollectionPopupChrome } from "@/lib/page-builder/blocks/CollectionPopupChrome";
import { JUSTIFIED_LAYOUT_WEIGHTS } from "@/lib/page-builder/blocks/popupLayouts/Justified";
import { resolveBrandKit } from "@/lib/page-builder/resolveBrandKit";

// ---------------------------------------------------------------------------
// Decorative placeholder swatches — one per popupLayout, so the editor's
// left-hand preview always agrees with the tile the owner just clicked
// (LayoutPicker sets `config.popupLayout`; this reads it back via
// `resolvePopupLayout` so an unset "" still previews as contact-sheet).
// ---------------------------------------------------------------------------

const SAMPLE_IMAGE_COUNT: Record<ReturnType<typeof resolvePopupLayout>, number> = {
  "contact-sheet": 6,
  justified: 7,
  "split-index": 4,
  immersive: 5,
};

function ContactSheetSwatch({ columns }: { columns: PopupColumns }) {
  return (
    <div
      data-popup-preview-columns={columns}
      style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: "8px" }}
    >
      {Array.from({ length: SAMPLE_IMAGE_COUNT["contact-sheet"] }).map((_, i) => (
        <div key={i} style={{ aspectRatio: "1 / 1", backgroundColor: "var(--pf-color-fg)", opacity: 0.12 }} />
      ))}
    </div>
  );
}

function JustifiedSwatch({ columns }: { columns: PopupColumns }) {
  const weights = JUSTIFIED_LAYOUT_WEIGHTS;
  const rows = Array.from({ length: Math.ceil(SAMPLE_IMAGE_COUNT.justified / columns) }, (_, rowIndex) =>
    weights.slice(rowIndex * columns, (rowIndex + 1) * columns),
  );
  return (
    <div
      data-popup-preview-columns={columns}
      style={{ display: "flex", flexDirection: "column", gap: "4px" }}
    >
      {rows.map((widths, ri) => (
        <div key={ri} style={{ display: "flex", gap: "4px" }}>
          {widths.map((w, i) => (
            <div key={i} style={{ flex: w, aspectRatio: "4 / 3", backgroundColor: "var(--pf-color-fg)", opacity: 0.12 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function SplitIndexSwatch({ columns }: { columns: PopupColumns }) {
  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
      <div style={{ flex: "0 0 35%", alignSelf: "stretch", backgroundColor: "var(--pf-color-secondary)" }} />
      <div
        data-popup-preview-columns={columns}
        style={{ flex: 1, display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: "6px" }}
      >
        {Array.from({ length: SAMPLE_IMAGE_COUNT["split-index"] }).map((_, i) => (
          <div key={i} style={{ aspectRatio: "1 / 1", backgroundColor: "var(--pf-color-fg)", opacity: 0.12 }} />
        ))}
      </div>
    </div>
  );
}

function ImmersiveSwatch() {
  return (
    <div style={{ position: "absolute", inset: "5%", background: "#0a0a0a", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", gap: "4px", padding: "8px", background: "#000" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ width: "14%", aspectRatio: "1 / 1", background: i === 2 ? "#fff" : "#333" }} />
        ))}
      </div>
    </div>
  );
}

export function CollectionsPopupPreview({
  config,
  brandKit,
  dir = "ltr",
}: {
  config: PortfolioCollectionsPopupConfig;
  brandKit: PortfolioBrandKit;
  /** Effective direction for the portfolio's own language — this swatch
   *  mirrors the real popup's layout, so it follows the same rule. */
  dir?: "ltr" | "rtl";
}) {
  const t = useTranslations("app.pageBuilder.editor");
  const { cssVars, className } = resolveBrandKit(brandKit);
  const layout = resolvePopupLayout(config.popupLayout);
  const popupColumns = resolvePopupColumns(config.popupColumns, layout);

  return (
    <div data-testid="collections-popup-preview-root" dir={dir} className={`h-full ${className}`} style={{ ...(cssVars as React.CSSProperties) }}>
      <div className="relative h-full w-full overflow-hidden bg-black/45">
        {layout === "immersive" ? (
          <ImmersiveSwatch />
        ) : (
          <CollectionPopupChrome
            collectionName={t("collectionsDialog.sampleCollection")}
            config={config}
            onClose={() => {}}
            preview
            maxWidth={layout === "justified" || layout === "split-index" ? 1080 : 900}
          >
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {layout === "justified" ? (
                <JustifiedSwatch columns={popupColumns} />
              ) : layout === "split-index" ? (
                <SplitIndexSwatch columns={popupColumns} />
              ) : (
                <ContactSheetSwatch columns={popupColumns} />
              )}
            </div>
          </CollectionPopupChrome>
        )}
      </div>
    </div>
  );
}
