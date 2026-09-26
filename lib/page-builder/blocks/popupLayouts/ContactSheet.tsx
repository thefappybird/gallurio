"use client";

import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import Image from "next/image";
import { useVirtualizer } from "@tanstack/react-virtual";
import { imageDeliveryUrl } from "@/lib/storage/imageDelivery.client";
import { cfImageLoader } from "@/lib/storage/cfImageLoader";
import { formatPhotoCount, type PopupLayoutBodyProps } from "./types";

// Rough square-tile row height guess (no measured column width available) —
// only used as the virtualizer's estimate; overscan absorbs the slack.
const ESTIMATED_ROW_PX = 220;
const ROW_GAP_PX = 8;
const FALLBACK_ROW_COUNT = 4;

/**
 * `contact-sheet` — the original popup body (uniform squares, laid out in an
 * exact `popupColumns`-wide grid), extracted verbatim from CollectionPopup.tsx.
 *
 * BACK-COMPAT CONTRACT: when `collectionDescription` is absent (every page
 * saved before this feature), this must render exactly what shipped before —
 * same elements, same styles, same text — so CollectionPopup.test.tsx (which
 * never passes a description) keeps passing unmodified. The only structural
 * change from the original inline JSX is wrapping the grid in a real
 * `<ul>/<li>` list (the a11y non-negotiable) instead of a bare flex `<div>`;
 * every button/img attribute, style and string is untouched, so no existing
 * assertion (which never queries the parent tag) is affected.
 */
export function ContactSheet({
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
  const countLabel = formatPhotoCount(total, labels);
  const columns = popupColumns || 1;
  const rowCount = Math.ceil(images.length / columns);
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollContainerRef?.current ?? null,
    estimateSize: () => ESTIMATED_ROW_PX + ROW_GAP_PX,
    overscan: 3,
  });
  const rawVirtualRows = rowVirtualizer.getVirtualItems();
  // Before the scroll container has a real measured size (no scrollContainerRef,
  // or this environment's ResizeObserver never fires — see popupLayouts.test.tsx),
  // fall back to a small fixed window rather than rendering nothing.
  const virtualRows =
    rawVirtualRows.length > 0
      ? rawVirtualRows
      : Array.from({ length: Math.min(rowCount, FALLBACK_ROW_COUNT) }, (_, i) => ({
          index: i,
          start: i * (ESTIMATED_ROW_PX + ROW_GAP_PX),
          end: (i + 1) * (ESTIMATED_ROW_PX + ROW_GAP_PX),
        }));
  const totalSize = rawVirtualRows.length > 0 ? rowVirtualizer.getTotalSize() : 0;
  const firstRow = virtualRows[0];
  const lastRow = virtualRows[virtualRows.length - 1];
  const topSpacer = firstRow ? firstRow.start : 0;
  const bottomSpacer = lastRow ? Math.max(0, totalSize - lastRow.end) : 0;

  return (
    <>
      {/* Net-new header — only rendered once a collection has a description,
       *  so pages saved before this feature never see it (back-compat). */}
      {collectionDescription ? (
        <div style={{ marginBottom: "16px" }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.9375rem",
              lineHeight: 1.5,
              color: "var(--pf-color-fg, #111)",
            }}
          >
            {collectionDescription}
          </p>
          {countLabel ? (
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "0.875rem",
                color: "color-mix(in srgb, var(--pf-color-fg, #111) 62%, transparent)",
              }}
            >
              {countLabel}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Exact configured column count — shared with the editor preview. */}
      <ul
        aria-label={collectionName}
        data-popup-columns={popupColumns}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${popupColumns}, minmax(0, 1fr))`,
          gap: "8px",
          listStyle: "none",
          margin: 0,
          padding: 0,
        }}
      >
        {topSpacer > 0 && <li aria-hidden style={{ gridColumn: "1 / -1", height: topSpacer }} />}
        {(() => {
          const startIndex = (firstRow?.index ?? 0) * columns;
          const endIndex = Math.min(images.length, ((lastRow?.index ?? 0) + 1) * columns);
          return images.slice(startIndex, endIndex).map((img, i) => {
            const index = startIndex + i;
            const thumbSrc = imageDeliveryUrl(img.publicId, {
              width: 400,
              height: 400,
              fit: "cover",
            });
            return (
              <li
                key={img.id}
              >
              <button
                type="button"
                aria-label={img.alt || labels.openPhoto}
                data-popup-thumb=""
                onClick={() => onOpen(index)}
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "1 / 1",
                  padding: 0,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  overflow: "hidden",
                  display: "block",
                }}
              >
                {thumbSrc ? (
                  <Image
                    src={thumbSrc}
                    alt={img.alt || labels.photo}
                    loader={cfImageLoader}
                    fill
                    sizes={`${Math.round(100 / (popupColumns || 1))}vw`}
                    style={{
                      objectFit: "cover",
                      transition: "opacity 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLImageElement).style.opacity = "0.85";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLImageElement).style.opacity = "1";
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      background: "var(--pf-color-muted, #f0f0f0)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.75rem",
                      color: "#888",
                    }}
                  >
                    {img.alt || labels.photo}
                  </div>
                )}
              </button>
            </li>
            );
          });
        })()}
        {bottomSpacer > 0 && <li aria-hidden style={{ gridColumn: "1 / -1", height: bottomSpacer }} />}
      </ul>

      {/* Load more / loading more / inline load-more error */}
      {hasMore && !loadMoreError && !isLoadingMore ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "24px 0 8px",
          }}
        >
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
          <Loader2Icon
            aria-hidden
            style={{
              width: "16px",
              height: "16px",
              animation: "spin 1s linear infinite",
            }}
          />
          <span>{labels.loadingMore}</span>
        </div>
      ) : null}
    </>
  );
}
