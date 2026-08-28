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
  /** 1 is the single-tile case used by the CollectionCard block. */
  columns: 1 | 2 | 3 | 4;
  /** Cover crop. Defaults to the grid's own 7/9 tile. */
  aspectRatio?: string;
  /** Whether the name/count chrome renders under the cover. Defaults to true. */
  showCaption?: boolean;
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
  outline: 2px solid var(--pf-color-fg, #111);
  outline-offset: 2px;
}
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FeaturedCollectionsClient({
  tiles,
  columns,
  aspectRatio = "7 / 9",
  showCaption = true,
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
              border: "1px solid color-mix(in srgb, var(--pf-color-fg, #111) 14%, transparent)",
              borderRadius: 0,
              background: "var(--pf-color-bg, #fff)",
              cursor: "pointer",
              textAlign: "left",
              fontFamily: "var(--pf-font-body, inherit)",
              color: "var(--pf-color-fg, #111)",
              transition: "border-color 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "var(--pf-color-fg, #111)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "color-mix(in srgb, var(--pf-color-fg, #111) 14%, transparent)";
            }}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--pf-color-muted, #f5f5f5)";
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--pf-color-bg, #fff)";
            }}
          >
            {/* Cover */}
            {tile.coverUrl ? (
              // Cover is a meaningful image — real alt (the collection name) so
              // it's crawlable in server HTML. aria-hidden keeps it out of the
              // a11y tree so it isn't announced twice: the wrapping <button>
              // already carries the collection name as its accessible name.
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={tile.coverUrl}
                alt={tile.name}
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                style={{
                  width: "100%",
                  aspectRatio,
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
                  aspectRatio,
                  background: "var(--pf-color-muted, #ebebeb)",
                  display: "block",
                }}
              />
            )}

            {/* Text chrome */}
            {showCaption && (
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
                  color: "var(--pf-color-fg, #111)",
                }}
              >
                {tile.name}
              </p>
              <p
                style={{
                  margin: "0.25rem 0 0",
                  fontSize: "0.875rem",
                  lineHeight: 1.4,
                  color: "color-mix(in srgb, var(--pf-color-fg, #111) 70%, transparent)",
                  opacity: 0.75,
                }}
              >
                {formatCount(tile.count)}
              </p>
            </div>
            )}
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
