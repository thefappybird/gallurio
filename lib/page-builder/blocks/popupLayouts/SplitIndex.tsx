"use client";

import { useId } from "react";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import Image from "next/image";
import { useVirtualizer } from "@tanstack/react-virtual";
import { imageDeliveryUrl } from "@/lib/storage/imageDelivery.client";
import { cfImageLoader } from "@/lib/storage/cfImageLoader";
import { formatPhotoCount, type PopupLayoutBodyProps } from "./types";

// Rough per-tile height guess (masonry columns balance items dynamically —
// no fixed row concept) — only used as the virtualizer's estimate.
const ESTIMATED_ITEM_PX = 260;
const ITEM_GAP_PX = 8;
const FALLBACK_ITEM_COUNT = 12;

/**
 * `split-index` — a sticky narrative column (name, description, facts) on the
 * inline-start side, with a `popupColumns`-wide masonry beside it. Stacks under the text
 * on narrow viewports via a scoped media query (mirrors the FOCUS_VISIBLE_STYLES
 * pattern used elsewhere in this file family — inline styles can't express
 * pseudo-classes/media queries on their own).
 *
 * `flexDirection: "row"` is used (never "row-reverse") so the column order
 * follows the document's writing direction automatically under RTL — no
 * manual left/right flip needed.
 */
export function SplitIndex({
  images,
  collectionName,
  collectionDescription,
  total,
  popupColumns,
  hasMore,
  isLoadingMore,
  loadMoreError,
  onLoadMore,
  onOpen,
  labels,
  scrollContainerRef,
}: PopupLayoutBodyProps) {
  const scopeId = useId().replace(/:/g, "");
  const countLabel = formatPhotoCount(total, labels);

  const itemVirtualizer = useVirtualizer({
    count: images.length,
    getScrollElement: () => scrollContainerRef?.current ?? null,
    estimateSize: () => ESTIMATED_ITEM_PX + ITEM_GAP_PX,
    overscan: 6,
  });
  const rawVirtualItems = itemVirtualizer.getVirtualItems();
  // Before the scroll container has a real measured size, fall back to a
  // small fixed window rather than rendering nothing.
  const virtualItems =
    rawVirtualItems.length > 0
      ? rawVirtualItems
      : Array.from({ length: Math.min(images.length, FALLBACK_ITEM_COUNT) }, (_, i) => ({
          index: i,
          start: i * (ESTIMATED_ITEM_PX + ITEM_GAP_PX),
          end: (i + 1) * (ESTIMATED_ITEM_PX + ITEM_GAP_PX),
        }));
  const totalSize = rawVirtualItems.length > 0 ? itemVirtualizer.getTotalSize() : 0;
  const firstItem = virtualItems[0];
  const lastItem = virtualItems[virtualItems.length - 1];
  const topSpacer = firstItem ? firstItem.start : 0;
  const bottomSpacer = lastItem ? Math.max(0, totalSize - lastItem.end) : 0;
  const startIndex = firstItem?.index ?? 0;
  const endIndex = Math.min(images.length, (lastItem?.index ?? 0) + 1);

  return (
    <div className={`pf-split-index-${scopeId}`} style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
      <style>{`
        .pf-split-index-${scopeId} { flex-direction: row; }
        .pf-split-index-${scopeId} > [data-split-index-nav] { position: sticky; top: 0; flex: 0 0 300px; }
        @media (max-width: 640px) {
          .pf-split-index-${scopeId} { flex-direction: column; }
          .pf-split-index-${scopeId} > [data-split-index-nav] { position: static; flex-basis: auto; width: 100%; }
        }
      `}</style>

      <div
        data-split-index-nav=""
        style={{
          backgroundColor: "var(--pf-color-secondary, #f0ede7)",
          padding: "24px",
          color: "var(--pf-color-fg, #111)",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600, fontFamily: "var(--pf-font-heading)" }}>
          {collectionName}
        </h3>
        {collectionDescription ? (
          <p style={{ margin: "12px 0 0", fontSize: "0.9375rem", lineHeight: 1.5 }}>{collectionDescription}</p>
        ) : null}
        {countLabel ? (
          <dl style={{ margin: "16px 0 0", padding: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
              <dt style={{ opacity: 0.7 }}>{labels.photo}</dt>
              <dd style={{ margin: 0 }}>{countLabel}</dd>
            </div>
          </dl>
        ) : null}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <ul
          aria-label={collectionName}
          data-popup-columns={popupColumns}
          style={{
            columnCount: popupColumns,
            columnGap: "8px",
            listStyle: "none",
            margin: 0,
            padding: 0,
          }}
        >
          {topSpacer > 0 && <li aria-hidden style={{ columnSpan: "all", height: topSpacer }} />}
          {images.slice(startIndex, endIndex).map((img, i) => {
            const index = startIndex + i;
            const thumbSrc = imageDeliveryUrl(img.publicId, { width: 600, fit: "scale-down" });
            const aspect =
              img.width && img.height && img.width > 0 && img.height > 0 ? img.width / img.height : 1;
            return (
              <li key={img.id} style={{ breakInside: "avoid", marginBottom: "8px" }}>
                <button
                  type="button"
                  aria-label={img.alt || labels.openPhoto}
                  data-popup-thumb=""
                  onClick={() => onOpen(index)}
                  style={{
                    display: "block",
                    width: "100%",
                    aspectRatio: `${aspect}`,
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    overflow: "hidden",
                  }}
                >
                  {thumbSrc ? (
                    <Image
                      src={thumbSrc}
                      alt={img.alt || labels.photo}
                      loader={cfImageLoader}
                      width={img.width ?? 600}
                      height={img.height ?? Math.round(600 / aspect)}
                      sizes={`${Math.round(100 / popupColumns)}vw`}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: "var(--pf-color-muted, #f0f0f0)" }} />
                  )}
                </button>
              </li>
            );
          })}
          {bottomSpacer > 0 && <li aria-hidden style={{ columnSpan: "all", height: bottomSpacer }} />}
        </ul>

        {hasMore && !loadMoreError && !isLoadingMore ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "24px 0 8px" }}>
            <button
              type="button"
              onClick={onLoadMore}
              style={{
                padding: "8px 24px",
                border: "1px solid var(--pf-color-fg, #111)",
                borderRadius: "4px",
                background: "transparent",
                color: "var(--pf-color-fg, #111)",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              {labels.loadMore}
            </button>
          </div>
        ) : loadMoreError ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
              padding: "16px 0 8px",
              textAlign: "center",
              color: "var(--pf-color-fg, #111)",
              fontSize: "0.875rem",
            }}
          >
            <span>{labels.loadMoreFailed}</span>
            <button
              type="button"
              data-testid="load-more-retry"
              onClick={onLoadMore}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                border: "1px solid currentColor",
                borderRadius: "4px",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              <RefreshCwIcon aria-hidden style={{ width: "14px", height: "14px" }} />
              {labels.retry}
            </button>
          </div>
        ) : isLoadingMore ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px 0 8px",
              gap: "8px",
              color: "var(--pf-color-fg, #111)",
            }}
          >
            <Loader2Icon aria-hidden style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />
            <span>{labels.loadingMore}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
