"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import Image from "next/image";
import { useVirtualizer } from "@tanstack/react-virtual";
import { imageDeliveryUrl } from "@/lib/storage/imageDelivery.client";
import { cfImageLoader } from "@/lib/storage/cfImageLoader";
import { packRows, DEFAULT_GUTTER, DEFAULT_TARGET_HEIGHT } from "./packRows";
import { formatPhotoCount, type PopupLayoutBodyProps } from "./types";

const FALLBACK_ROW_COUNT = 4;

/** The editor's justified-layout swatch is intentionally a fixed visual
 * rhythm, not a promise about the uploaded files' dimensions. Keep the live
 * popup on the same rhythm so square images and older images without metadata
 * do not silently turn the selected justified layout into a regular grid. */
export const JUSTIFIED_LAYOUT_WEIGHTS = [1.5, 1, 0.8, 1.25, 0.9, 1.2, 0.7] as const;

/**
 * `justified` — rows scaled to a common height so every photograph keeps its
 * own aspect ratio; no crop. Container width is measured with a
 * ResizeObserver (packRows is pure and needs a real px width), and the
 * packed row heights are reserved up front so nothing reflows after paint —
 * width starts `null` and renders a fixed-height skeleton row until the
 * first measurement lands.
 */
export function Justified({
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
  const containerRef = useRef<HTMLUListElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const indexById = useMemo(() => new Map(images.map((img, i) => [img.id, i])), [images]);
  const layoutImages = useMemo(
    () => images.map((image, index) => ({ ...image, width: JUSTIFIED_LAYOUT_WEIGHTS[index % JUSTIFIED_LAYOUT_WEIGHTS.length], height: 1 })),
    [images]
  );
  const rows = useMemo(
    () =>
      width
        ? packRows(layoutImages, {
            containerWidth: width,
            targetHeight: DEFAULT_TARGET_HEIGHT,
            gutter: DEFAULT_GUTTER,
            itemsPerRow: popupColumns,
          })
        : [],
    [layoutImages, popupColumns, width]
  );
  const countLabel = formatPhotoCount(total, labels);

  // packRows already computed every row's real pixel height for the measured
  // width — reuse those (not a guess) as the virtualizer's per-row size.
  const rowOffsets = useMemo(() => {
    let acc = 0;
    return rows.map((row) => {
      const start = acc;
      acc += row.height + DEFAULT_GUTTER;
      return start;
    });
  }, [rows]);
  const totalRowsHeight = rows.length > 0 ? rowOffsets[rows.length - 1] + rows[rows.length - 1].height : 0;
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef?.current ?? null,
    estimateSize: (i) => (rows[i]?.height ?? DEFAULT_TARGET_HEIGHT) + DEFAULT_GUTTER,
    overscan: 3,
  });
  const rawVirtualRows = rowVirtualizer.getVirtualItems();
  // Before the scroll container has a real measured size, fall back to a
  // small fixed window (using the exact row heights we already computed)
  // rather than rendering nothing.
  const virtualRows =
    rawVirtualRows.length > 0
      ? rawVirtualRows
      : Array.from({ length: Math.min(rows.length, FALLBACK_ROW_COUNT) }, (_, i) => ({
          index: i,
          start: rowOffsets[i] ?? 0,
          end: (rowOffsets[i] ?? 0) + (rows[i]?.height ?? 0) + DEFAULT_GUTTER,
        }));
  const firstRow = virtualRows[0];
  const lastRow = virtualRows[virtualRows.length - 1];
  const topSpacer = firstRow ? firstRow.start : 0;
  const bottomSpacer = lastRow ? Math.max(0, totalRowsHeight - lastRow.end) : 0;

  return (
    <>
      {collectionDescription ? (
        <div style={{ marginBottom: "16px" }}>
          <p style={{ margin: 0, fontSize: "0.9375rem", lineHeight: 1.5, color: "var(--pf-color-fg, #111)" }}>
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

      <ul
        ref={containerRef}
        aria-label={collectionName}
        data-popup-columns={popupColumns}
        style={{ listStyle: "none", margin: 0, padding: 0 }}
      >
        {width == null ? (
          // Reserves target-height space so the ResizeObserver's first tick
          // doesn't cause a visible height jump.
          <li aria-hidden style={{ height: `${DEFAULT_TARGET_HEIGHT}px` }} />
        ) : (
          <>
          {topSpacer > 0 && <li aria-hidden style={{ height: topSpacer }} />}
          {rows.slice(firstRow?.index ?? 0, (lastRow?.index ?? -1) + 1).map((row, i) => {
            const ri = (firstRow?.index ?? 0) + i;
            return (
            <li
              key={ri}
              style={{
                display: "flex",
                gap: `${DEFAULT_GUTTER}px`,
                marginBottom: ri < rows.length - 1 ? `${DEFAULT_GUTTER}px` : 0,
              }}
            >
              {row.items.map(({ item, width: itemWidth }) => {
                const index = indexById.get(item.id) ?? 0;
                const thumbSrc = imageDeliveryUrl(item.publicId, {
                  width: Math.round(itemWidth * 2),
                  height: Math.round(row.height * 2),
                  fit: "cover",
                });
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={item.alt || labels.openPhoto}
                    data-popup-thumb=""
                    onClick={() => onOpen(index)}
                    style={{
                      width: `${itemWidth}px`,
                      height: `${row.height}px`,
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      overflow: "hidden",
                      display: "block",
                      flexShrink: 0,
                    }}
                  >
                    {thumbSrc ? (
                      <Image
                        src={thumbSrc}
                        alt={item.alt || labels.photo}
                        loader={cfImageLoader}
                        width={Math.round(itemWidth)}
                        height={Math.round(row.height)}
                        sizes={`${Math.round(itemWidth)}px`}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          background: "var(--pf-color-muted, #f0f0f0)",
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </li>
            );
          })}
          {bottomSpacer > 0 && <li aria-hidden style={{ height: bottomSpacer }} />}
          </>
        )}
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
    </>
  );
}
