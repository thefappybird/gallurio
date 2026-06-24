"use client";

import { CollectionPopupChrome } from "@/lib/page-builder/blocks/CollectionPopupChrome";
import type { PortfolioCollectionsPopupConfig } from "@/lib/page-builder/types";
import { usePreviewDraft } from "./PreviewDraftContext";

/**
 * Renders the collections popup chrome in the portfolio preview iframe so
 * the owner can see how their collections popup will look before saving.
 *
 * Reads the unsaved draft collectionsPopup config from PreviewDraftContext
 * (provided by PreviewBrandShell) and overrides the server-supplied DB
 * fallback so unsaved popup style edits are visible in preview.
 *
 * Uses preview mode on CollectionPopupChrome so it renders in-place
 * (position: absolute, inset: 5%) instead of fixed-center.
 */
export function PreviewPopupShell({
  fallbackConfig,
}: {
  fallbackConfig: PortfolioCollectionsPopupConfig | null;
}) {
  const { collectionsPopup } = usePreviewDraft();
  const config = collectionsPopup ?? fallbackConfig ?? {};

  return (
    <div style={{ position: "relative", minHeight: "320px" }}>
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
  );
}