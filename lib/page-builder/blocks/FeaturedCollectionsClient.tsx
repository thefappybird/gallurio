"use client";

import { useState } from "react";
import { CollectionPopup } from "./CollectionPopup";
import type { PortfolioCollectionsPopupConfig } from "@/lib/page-builder/types";
import type { CollectionPopupLabels } from "@/lib/page-builder/blockContext";
import { gridColsVar } from "@/lib/page-builder/responsive";

// ---------------------------------------------------------------------------
// Types (exported so the parent block can import and adapt to this shape)
// ---------------------------------------------------------------------------

export type FeaturedTile = {
  id: string;
  name: string;
  count: number;
  coverUrl: string;
};

export type FeaturedCollectionsClientProps = {
  tiles: FeaturedTile[];
  columns: 2 | 3 | 4;
  mode: "owner" | "public";
  slug?: string;
  popupConfig: PortfolioCollectionsPopupConfig;
  /** Localized popup labels threaded from puck metadata. */
  popupLabels?: CollectionPopupLabels;
  /** Brand-kit CSS vars, re-applied on the popup's portaled root (see CollectionPopup). */
  brandVars?: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Count label (English, no function prop — serialization-safe)
// ---------------------------------------------------------------------------

function formatCount(n: number): string {
  if (n === 0) return "No photos";
  if (n === 1) return "1 photo";
  return `${n} photos`;
}

// ---------------------------------------------------------------------------
// Scoped focus-visible style for tile buttons
// ---------------------------------------------------------------------------

const TILE_FOCUS_STYLES = `
[data-featured-tile]:focus-visible {
  outline: 2px solid var(--pf-color-foreground, #111);
  outline-offset: 2px;
}
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FeaturedCollectionsClient({
  tiles,
  columns,
  mode,
  slug,
  popupConfig,
  popupLabels,
  brandVars,
}: FeaturedCollectionsClientProps) {
  const [active, setActive] = useState<FeaturedTile | null>(null);

  return (
    <>
      {/* Scoped focus-visible styles — inline styles cannot handle pseudo-classes */}
      <style>{TILE_FOCUS_STYLES}</style>

      <div
        className="pf-featured-grid"
        style={{
          display: "grid",
          gridTemplateColumns: gridColsVar(`repeat(${columns}, 1fr)`),
          gap: "1.5rem",
        }}
      >
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            data-featured-tile=""
            aria-label={`${tile.name} — ${formatCount(tile.count)}`}
            onClick={() => setActive(tile)}
            style={{
              display: "block",
              width: "100%",
              padding: 0,
              border: "1px solid var(--pf-color-border, rgba(0,0,0,0.12))",
              borderRadius: 0,
              background: "var(--pf-color-surface, #fff)",
              cursor: "pointer",
              textAlign: "left",
              fontFamily: "var(--pf-font-body, inherit)",
              color: "var(--pf-color-foreground, #111)",
              transition: "border-color 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "var(--pf-color-foreground, #111)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "var(--pf-color-border, rgba(0,0,0,0.12))";
            }}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--pf-color-muted, #f5f5f5)";
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--pf-color-surface, #fff)";
            }}
          >
            {/* Cover */}
            {tile.coverUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={tile.coverUrl}
                alt=""
                loading="lazy"
                decoding="async"
                style={{
                  width: "100%",
                  aspectRatio: "7 / 9",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : (
              <div
                aria-hidden="true"
                data-cover-placeholder=""
                style={{
                  width: "100%",
                  aspectRatio: "7 / 9",
                  background: "var(--pf-color-muted, #ebebeb)",
                  display: "block",
                }}
              />
            )}

            {/* Text chrome */}
            <div
              style={{
                padding: "0.75rem 1rem",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "1rem",
                  fontWeight: 600,
                  lineHeight: 1.3,
                  color: "var(--pf-color-foreground, #111)",
                }}
              >
                {tile.name}
              </p>
              <p
                style={{
                  margin: "0.25rem 0 0",
                  fontSize: "0.875rem",
                  lineHeight: 1.4,
                  color: "var(--pf-color-foreground, #555)",
                  opacity: 0.75,
                }}
              >
                {formatCount(tile.count)}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Active-collection popup — only one rendered at a time */}
      {active && (
        <CollectionPopup
          open
          collectionId={active.id}
          collectionName={active.name}
          mode={mode}
          slug={slug}
          popupConfig={popupConfig}
          onClose={() => setActive(null)}
          labels={popupLabels}
          brandVars={brandVars}
        />
      )}
    </>
  );
}
