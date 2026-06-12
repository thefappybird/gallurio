"use client";

import type React from "react";
import type { PortfolioBrandKit, PortfolioCollectionsPopupConfig } from "@/lib/page-builder/types";
import { CollectionPopupChrome } from "@/lib/page-builder/blocks/CollectionPopupChrome";
import { resolveBrandKit } from "@/lib/page-builder/resolveBrandKit";

export function CollectionsPopupPreview({
  config,
  brandKit,
}: {
  config: PortfolioCollectionsPopupConfig;
  brandKit: PortfolioBrandKit;
}) {
  const { cssVars, className } = resolveBrandKit(brandKit);
  return (
    <div className={className} style={{ ...(cssVars as React.CSSProperties) }}>
      <div className="relative h-full w-full overflow-hidden bg-black/45">
        <CollectionPopupChrome
          collectionName="Sample Collection"
          config={config}
          onClose={() => {}}
          preview
        >
          <div className="min-h-0 flex-1 overflow-auto p-4">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    aspectRatio: "1 / 1",
                    backgroundColor: "var(--pf-color-fg)",
                    opacity: 0.12,
                  }}
                />
              ))}
            </div>
          </div>
        </CollectionPopupChrome>
      </div>
    </div>
  );
}
