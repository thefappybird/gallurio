"use client";

import { CollectionPopupChrome } from "@/lib/page-builder/blocks/CollectionPopupChrome";
import type { PortfolioCollectionsPopupConfig } from "@/lib/page-builder/types";
import { usePreviewDraft } from "./PreviewDraftContext";

/**
 * Dedicated popup-preview surface for the portfolio preview route (loaded in
 * the editor's iframe when the collections-popup panel is open).
 *
 * Mirrors the editor's CollectionsPopupPreview layout: a full-height backdrop
 * with the popup chrome centred inside it, driven by the unsaved draft config
 * from PreviewDraftContext (falling back to the server-supplied DB config).
 *
 * The brand-kit CSS vars are already applied by the outer PreviewBrandShell,
 * so there is no need to resolve them here — CollectionPopupChrome reads
 * var(--pf-color-*) directly from the cascade.
 *
 * Rendered only when zone=popup; never injected into the Home/Gallery body.
 */
export function PreviewPopupShell({
  fallbackConfig,
}: {
  fallbackConfig: PortfolioCollectionsPopupConfig | null;
}) {
  const { collectionsPopup } = usePreviewDraft();
  const config = collectionsPopup ?? fallbackConfig ?? {};

  return (
    <div
      data-testid="popup-preview-surface"
      style={{ position: "relative", height: "100dvh", overflow: "hidden" }}
      className="bg-black/45"
    >
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
