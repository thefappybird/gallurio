"use client";

import type React from "react";
import { useTranslations } from "next-intl";
import type { PortfolioBrandKit, PortfolioCollectionsPopupConfig } from "@/lib/page-builder/types";
import { resolvePopupLayout } from "@/lib/page-builder/types";
import { CollectionPopupChrome } from "@/lib/page-builder/blocks/CollectionPopupChrome";
import { resolveBrandKit } from "@/lib/page-builder/resolveBrandKit";

// ---------------------------------------------------------------------------
// Decorative placeholder swatches — one per popupLayout, so the editor's
// left-hand preview always agrees with the tile the owner just clicked
// (LayoutPicker sets `config.popupLayout`; this reads it back via
// `resolvePopupLayout` so an unset "" still previews as contact-sheet).
// ---------------------------------------------------------------------------

function ContactSheetSwatch() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ aspectRatio: "1 / 1", backgroundColor: "var(--pf-color-fg)", opacity: 0.12 }} />
      ))}
    </div>
  );
}

function JustifiedSwatch() {
  const rows: number[][] = [
    [1.5, 1, 0.8],
    [1, 1, 1, 1],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
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

function SplitIndexSwatch() {
  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
      <div style={{ flex: "0 0 35%", alignSelf: "stretch", backgroundColor: "var(--pf-color-secondary)" }} />
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px" }}>
        {Array.from({ length: 4 }).map((_, i) => (
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
}: {
  config: PortfolioCollectionsPopupConfig;
  brandKit: PortfolioBrandKit;
}) {
  const t = useTranslations("app.pageBuilder.editor");
  const { cssVars, className } = resolveBrandKit(brandKit);
  const layout = resolvePopupLayout(config.popupLayout);

  return (
    <div data-testid="collections-popup-preview-root" className={`h-full ${className}`} style={{ ...(cssVars as React.CSSProperties) }}>
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
              {layout === "justified" ? <JustifiedSwatch /> : layout === "split-index" ? <SplitIndexSwatch /> : <ContactSheetSwatch />}
            </div>
          </CollectionPopupChrome>
        )}
      </div>
    </div>
  );
}
